#!/usr/bin/env python3
"""
Consolide les données commerces d'Elne à partir d'OSM (Overpass) + Sirene (data.gouv.fr).

Output: data/commerces-elne.json — annuaire complet pour MonBonAgent.
Aucune donnée GMB (descriptions, photos, avis textuels) n'est utilisée — seulement
des données factuelles publiques (nom, adresse, NAF, téléphone, lien externe Maps).
"""
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OSM_PATH = Path("/tmp/elne_osm.json")
OSM_BBOX_PATH = Path("/tmp/elne_bbox.json")
SIRENE_JCA_PATH = Path("/tmp/sirene_jca.json")

# Map des tags OSM vers catégorie humaine + icône FontAwesome
CATEGORIES = {
    # shop=*
    "bakery":              ("Boulangerie",       "fa-bread-slice"),
    "supermarket":         ("Supermarché",       "fa-shopping-cart"),
    "convenience":         ("Épicerie",          "fa-store"),
    "butcher":             ("Boucherie",         "fa-drumstick-bite"),
    "seafood":             ("Poissonnerie",      "fa-fish"),
    "greengrocer":         ("Primeur",           "fa-apple-alt"),
    "wine":                ("Caviste",           "fa-wine-bottle"),
    "alcohol":             ("Caviste",           "fa-wine-bottle"),
    "florist":             ("Fleuriste",         "fa-spa"),
    "hairdresser":         ("Coiffeur",          "fa-cut"),
    "beauty":              ("Beauté",            "fa-spa"),
    "clothes":             ("Mode / Vêtements",  "fa-tshirt"),
    "shoes":               ("Chaussures",        "fa-shoe-prints"),
    "jewelry":             ("Bijouterie",        "fa-gem"),
    "optician":            ("Opticien",          "fa-glasses"),
    "pharmacy":            ("Pharmacie",         "fa-prescription-bottle-alt"),
    "kiosk":               ("Tabac / Presse",    "fa-newspaper"),
    "tobacco":             ("Tabac",             "fa-smoking"),
    "gift":                ("Cadeaux",           "fa-gift"),
    "garden_centre":       ("Jardinerie",        "fa-leaf"),
    "interior_decoration": ("Décoration",        "fa-couch"),
    "furniture":           ("Mobilier",          "fa-couch"),
    "kitchen":             ("Cuisiniste",        "fa-utensils"),
    "bicycle":             ("Vélo / Scooter",    "fa-bicycle"),
    "car_repair":          ("Garage",            "fa-car-side"),
    "car":                 ("Concession auto",   "fa-car"),
    "books":               ("Librairie",         "fa-book"),
    "stationery":          ("Papeterie",         "fa-pen"),
    "ticket":              ("Billetterie",       "fa-ticket-alt"),
    "funeral_directors":   ("Pompes funèbres",   "fa-cross"),
    "laundry":             ("Pressing",          "fa-tshirt"),
    "pottery":             ("Poterie",           "fa-cubes"),
    "e-cigarette":         ("Cigarette électronique", "fa-smoking"),
    "nutrition_supplements": ("Compléments",     "fa-pills"),
    "estate_agent":        ("Agence immobilière", "fa-home"),
    "travel_agency":       ("Voyages",           "fa-plane"),
    "hardware":            ("Bricolage",         "fa-hammer"),
    "doityourself":        ("Bricolage",         "fa-hammer"),
    # amenity=*
    "restaurant":          ("Restaurant",        "fa-utensils"),
    "fast_food":           ("Restauration rapide", "fa-hamburger"),
    "cafe":                ("Café / Salon de thé", "fa-coffee"),
    "bar":                 ("Bar",               "fa-glass-cheers"),
    "pub":                 ("Bar",               "fa-glass-cheers"),
    "bank":                ("Banque",            "fa-university"),
    "post_office":         ("Poste",             "fa-envelope"),
    "fuel":                ("Station-service",   "fa-gas-pump"),
    "veterinary":          ("Vétérinaire",       "fa-paw"),
    "dentist":             ("Dentiste",          "fa-tooth"),
    "doctors":             ("Médecin",           "fa-stethoscope"),
    # office=*
    "insurance":           ("Assurances",        "fa-shield-alt"),
    "lawyer":              ("Avocat",            "fa-balance-scale"),
    "accountant":          ("Comptable",         "fa-calculator"),
    # craft=*
    "carpenter":           ("Menuisier",         "fa-tools"),
    "electrician":         ("Électricien",       "fa-bolt"),
    "plumber":             ("Plombier",          "fa-faucet"),
    "tiler":               ("Carreleur",         "fa-th-large"),
    "painter":             ("Peintre",           "fa-paint-roller"),
}

# Codes NAF Sirene → catégorie (fallback quand pas de tag OSM)
NAF_PREFIX = {
    "10.71": ("Boulangerie",     "fa-bread-slice"),
    "10.39": ("Conserverie",     "fa-jar"),
    "47.11": ("Supermarché",     "fa-shopping-cart"),
    "47.21": ("Primeur",         "fa-apple-alt"),
    "47.22": ("Boucherie",       "fa-drumstick-bite"),
    "47.23": ("Poissonnerie",    "fa-fish"),
    "47.24": ("Boulangerie",     "fa-bread-slice"),
    "47.25": ("Caviste",         "fa-wine-bottle"),
    "47.26": ("Tabac",           "fa-smoking"),
    "47.41": ("Informatique",    "fa-laptop"),
    "47.42": ("Téléphonie",      "fa-mobile-alt"),
    "47.43": ("Électronique",    "fa-tv"),
    "47.51": ("Textile",         "fa-tshirt"),
    "47.52": ("Bricolage",       "fa-hammer"),
    "47.53": ("Décoration",      "fa-couch"),
    "47.54": ("Électroménager",  "fa-blender"),
    "47.59": ("Mobilier",        "fa-couch"),
    "47.61": ("Librairie",       "fa-book"),
    "47.62": ("Presse / Papeterie", "fa-newspaper"),
    "47.63": ("Disquaire",       "fa-music"),
    "47.64": ("Sport",           "fa-running"),
    "47.65": ("Jeux et jouets",  "fa-gamepad"),
    "47.71": ("Mode / Vêtements", "fa-tshirt"),
    "47.72": ("Chaussures",      "fa-shoe-prints"),
    "47.73": ("Pharmacie",       "fa-prescription-bottle-alt"),
    "47.74": ("Opticien / Audio", "fa-glasses"),
    "47.75": ("Parfumerie / Cosmétique", "fa-spa"),
    "47.76": ("Fleurs / Jardinage", "fa-leaf"),
    "47.77": ("Bijouterie",      "fa-gem"),
    "47.78": ("Commerce détail spécialisé", "fa-store"),
    "47.79": ("Brocante / Occasion", "fa-recycle"),
    "56.10": ("Restaurant",      "fa-utensils"),
    "56.21": ("Traiteur",        "fa-utensils"),
    "56.29": ("Restauration collective", "fa-utensils"),
    "56.30": ("Bar / Café",      "fa-coffee"),
    "64.19": ("Banque",          "fa-university"),
    "65.12": ("Assurances",      "fa-shield-alt"),
    "68.31": ("Agence immobilière", "fa-home"),
    "70.22": ("Conseil",         "fa-briefcase"),
    "86.10": ("Hôpital / Clinique", "fa-hospital"),
    "86.21": ("Médecin",         "fa-stethoscope"),
    "86.23": ("Dentiste",        "fa-tooth"),
    "86.90": ("Santé / Paramédical", "fa-heart"),
    "90.01": ("Spectacle / Arts vivants", "fa-music"),
    "95.23": ("Cordonnerie",     "fa-shoe-prints"),
    "96.01": ("Pressing / Blanchisserie", "fa-tshirt"),
    "96.02": ("Coiffeur / Esthétique", "fa-cut"),
    "96.03": ("Pompes funèbres", "fa-cross"),
    "96.04": ("Soins du corps",  "fa-spa"),
    "35.11": ("Production d'électricité", "fa-bolt"),
    "43.21": ("Électricien",     "fa-bolt"),
    "43.22": ("Plombier / Chauffagiste", "fa-faucet"),
    "43.31": ("Plâtrerie",       "fa-tools"),
    "43.32": ("Menuiserie",      "fa-tools"),
    "43.33": ("Carrelage",       "fa-th-large"),
    "43.34": ("Peinture / Vitrerie", "fa-paint-roller"),
    "43.39": ("Finitions bâtiment", "fa-tools"),
}

def slugify(s: str) -> str:
    if not s:
        return ""
    s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode("ascii")
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s

def categorize_osm(tags):
    for key in ("shop", "amenity", "craft", "office"):
        val = tags.get(key)
        if val and val in CATEGORIES:
            return CATEGORIES[val]
    return ("Commerce / Service", "fa-store")

def categorize_naf(naf):
    if not naf:
        return ("Commerce / Service", "fa-store")
    prefix = naf[:5]
    if prefix in NAF_PREFIX:
        return NAF_PREFIX[prefix]
    return ("Commerce / Service", "fa-store")

def maps_link(nom: str, adresse: str) -> str:
    from urllib.parse import quote
    q = quote(f"{nom} {adresse} Elne")
    return f"https://www.google.com/maps/search/?api=1&query={q}"

def is_jca(street, addr):
    """True si l'établissement est sur Bd Jacques Albert."""
    if street and re.search(r"jacques.*albert", street, re.I):
        return True
    if addr and re.search(r"jacques.*albert", addr, re.I):
        return True
    return False

def build_from_osm(elements):
    out = []
    seen_keys = set()
    for el in elements:
        tags = el.get("tags") or {}
        nom = tags.get("name") or tags.get("brand")
        if not nom:
            continue
        cat, icone = categorize_osm(tags)
        street = tags.get("addr:street") or ""
        num    = tags.get("addr:housenumber") or ""
        cp     = tags.get("addr:postcode") or "66200"
        ville  = tags.get("addr:city") or "Elne"
        adresse = f"{num} {street}".strip()
        if cp:
            adresse_complete = f"{adresse}, {cp} {ville}".strip(", ").replace(" ,", ",")
        else:
            adresse_complete = adresse
        lat = el.get("lat") or (el.get("center") or {}).get("lat")
        lon = el.get("lon") or (el.get("center") or {}).get("lon")
        key = (slugify(nom), street.lower())
        if key in seen_keys:
            continue
        seen_keys.add(key)
        out.append({
            "id": slugify(nom) + (f"-{slugify(street)}" if street else ""),
            "nom": nom,
            "categorie": cat,
            "icone": icone,
            "adresse": adresse_complete,
            "rue": street,
            "numero": num,
            "code_postal": cp,
            "ville": ville,
            "telephone": tags.get("phone") or tags.get("contact:phone") or "",
            "site_web": tags.get("website") or tags.get("contact:website") or "",
            "lien_maps": maps_link(nom, adresse_complete),
            "lat": float(lat) if lat else None,
            "lon": float(lon) if lon else None,
            "naf": "",
            "siret": "",
            "source": "osm",
            "partenaire": False,
            "bons_actifs": [],
            "zone": "centre-commercial-jacques-albert" if is_jca(street, adresse_complete) else "elne",
        })
    return out

def build_from_sirene(results, zone="centre-commercial-jacques-albert"):
    out = []
    seen_sirets = set()
    for ent in results:
        for et in ent.get("matching_etablissements") or []:
            if et.get("etat_administratif") != "A":
                continue
            if et.get("commune") != "66065":
                continue
            siret = et.get("siret")
            if not siret or siret in seen_sirets:
                continue
            adresse = et.get("adresse") or ""
            if zone == "centre-commercial-jacques-albert" and not is_jca(None, adresse):
                continue
            seen_sirets.add(siret)
            enseignes = et.get("liste_enseignes") or []
            nom = (enseignes[0] if enseignes else None) or ent.get("nom_complet") or "Établissement"
            naf = et.get("activite_principale") or ""
            cat, icone = categorize_naf(naf)
            lat = et.get("latitude")
            lon = et.get("longitude")
            out.append({
                "id": slugify(nom) + "-" + siret[-5:],
                "nom": nom,
                "categorie": cat,
                "icone": icone,
                "adresse": adresse.title(),
                "rue": "",
                "numero": "",
                "code_postal": "66200",
                "ville": "Elne",
                "telephone": "",
                "site_web": "",
                "lien_maps": maps_link(nom, adresse),
                "lat": float(lat) if lat else None,
                "lon": float(lon) if lon else None,
                "naf": naf,
                "siret": siret,
                "source": "sirene",
                "partenaire": False,
                "bons_actifs": [],
                "zone": zone,
            })
    return out

def merge_by_name(*lists):
    """Déduplique par slug d'enseigne ; OSM gagne s'il a un téléphone/web, Sirene complète sinon."""
    merged = {}
    for lst in lists:
        for c in lst:
            key = slugify(c["nom"])
            if key not in merged:
                merged[key] = c
                continue
            existing = merged[key]
            # complète les champs manquants
            for k, v in c.items():
                if not existing.get(k) and v:
                    existing[k] = v
            # marque zone JCA si l'un des deux le dit
            if c.get("zone") == "centre-commercial-jacques-albert":
                existing["zone"] = "centre-commercial-jacques-albert"
    return list(merged.values())

def main():
    osm  = json.loads(OSM_PATH.read_text())["elements"]
    bbox = json.loads(OSM_BBOX_PATH.read_text())["elements"]
    sirene_jca = json.loads(SIRENE_JCA_PATH.read_text())["results"]

    osm_commerces  = build_from_osm(osm)
    bbox_commerces = build_from_osm(bbox)
    sirene_commerces = build_from_sirene(sirene_jca, zone="centre-commercial-jacques-albert")

    all_commerces = merge_by_name(osm_commerces, bbox_commerces, sirene_commerces)
    # trie : Bd Jacques Albert d'abord, puis alpha
    all_commerces.sort(key=lambda c: (c["zone"] != "centre-commercial-jacques-albert", c["nom"].lower()))

    # catégories distinctes (pour les filtres UI)
    categories = sorted({c["categorie"] for c in all_commerces})

    output = {
        "meta": {
            "ville": "Elne",
            "code_postal": "66200",
            "code_insee": "66065",
            "sources": [
                "OpenStreetMap (ODbL) — overpass-api.de",
                "Sirene / Recherche d'entreprises — data.gouv.fr (Licence ouverte)",
            ],
            "note": "Données factuelles publiques uniquement. Cartes au look 'fiche' inspiré GMB; le lien CTA renvoie à la fiche Google Maps officielle. Aucun contenu protégé (photos, descriptions, avis) n'est reproduit.",
            "total": len(all_commerces),
            "total_zone_jca": sum(1 for c in all_commerces if c["zone"] == "centre-commercial-jacques-albert"),
        },
        "categories": categories,
        "commerces": all_commerces,
    }

    out_path = ROOT / "data" / "commerces-elne.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(output, ensure_ascii=False, indent=2))
    print(f"OK → {out_path}")
    print(f"   total commerces : {output['meta']['total']}")
    print(f"   zone Bd Jacques Albert : {output['meta']['total_zone_jca']}")
    print(f"   catégories : {len(categories)}")

if __name__ == "__main__":
    main()
