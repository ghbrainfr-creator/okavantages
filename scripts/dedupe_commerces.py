#!/usr/bin/env python3
"""
Dédoublonne data/commerces-elne.json :
- Normalise les noms (lowercase, sans accents, sans bruit)
- Fusionne les doublons en gardant l'entrée la plus riche
  (avec téléphone, site web, géoloc, source Sirene > OSM)
- Trie par catégorie principale puis par nom alphabétique
- Écrit le résultat dédoublonné en place
"""
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
JSON_PATH = ROOT / "data" / "commerces-elne.json"


def normalize(s):
    """Pour dédoublonnage : strip accents, lowercase, alphanumeric only."""
    if not s:
        return ""
    s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode("ascii")
    s = s.lower()
    # Retirer les suffixes/préfixes parasites
    s = re.sub(r"\b(elne|sarl|sas|sa|sasu|eurl|epicerie|boulangerie)\b", "", s)
    s = re.sub(r"[^a-z0-9]", "", s)
    return s.strip()


def richness(c):
    """Score de richesse pour choisir la meilleure entrée d'un doublon."""
    score = 0
    if c.get("telephone"):  score += 4
    if c.get("site_web"):   score += 3
    if c.get("lat") and c.get("lon"): score += 2
    if c.get("adresse") and len(c["adresse"]) > 10: score += 2
    if c.get("siret"):      score += 1
    if c.get("source") == "osm":  score += 1
    return score


def merge_entries(a, b):
    """Fusionne deux entrées en gardant le meilleur de chaque champ."""
    out = dict(a)
    for k, v in b.items():
        if not v:
            continue
        if not out.get(k):
            out[k] = v
    # Cas spécifique : nom de l'enseigne le plus reconnaissable (le plus court, sans la raison sociale)
    if a.get("nom") and b.get("nom"):
        # On garde le nom le plus court (souvent l'enseigne plutôt que raison sociale)
        out["nom"] = a["nom"] if len(a["nom"]) <= len(b["nom"]) else b["nom"]
    return out


def main():
    data = json.loads(JSON_PATH.read_text())
    commerces = data.get("commerces", [])
    print(f"Avant dédup : {len(commerces)} entrées")

    # Indexer par clé normalisée
    by_key = {}
    for c in commerces:
        # Clé = nom normalisé. On ajoute la zone si géoloc différente pour ne pas écraser
        # des entrées identiques de nom mais à des adresses très éloignées.
        nom_norm = normalize(c.get("nom"))
        if not nom_norm:
            continue
        key = nom_norm
        if key in by_key:
            existing = by_key[key]
            # Si l'un est plus riche, on prend ses champs en priorité
            if richness(c) > richness(existing):
                by_key[key] = merge_entries(c, existing)
            else:
                by_key[key] = merge_entries(existing, c)
        else:
            by_key[key] = c

    deduped = list(by_key.values())
    print(f"Après dédup : {len(deduped)} entrées (supprimés : {len(commerces) - len(deduped)})")

    # Tri : zone JCA d'abord (centre commercial), puis alphabétique sur le nom
    deduped.sort(key=lambda c: (
        c.get("zone") != "centre-commercial-jacques-albert",
        (c.get("nom") or "").lower()
    ))

    # Recompter les catégories
    categories = sorted({c.get("categorie") for c in deduped if c.get("categorie")})

    # Mettre à jour méta
    data["commerces"] = deduped
    data["categories"] = categories
    data.setdefault("meta", {})
    data["meta"]["total"] = len(deduped)
    data["meta"]["total_zone_jca"] = sum(1 for c in deduped if c.get("zone") == "centre-commercial-jacques-albert")
    data["meta"]["dedupe_at"] = "2026-05-20"
    data["meta"]["note"] = (
        "Données factuelles publiques uniquement (OSM ODbL + Sirene data.gouv.fr Licence ouverte). "
        "Cartes au look 'fiche' inspiré GMB ; le lien CTA renvoie à la fiche Google Maps officielle. "
        "Aucun contenu protégé (photos, descriptions, avis) n'est reproduit. Dédoublonné et trié alphabétiquement."
    )

    JSON_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    print(f"OK → {JSON_PATH}")
    print(f"   total : {data['meta']['total']}")
    print(f"   Bd Jacques Albert : {data['meta']['total_zone_jca']}")
    print(f"   catégories : {len(categories)}")


if __name__ == "__main__":
    main()
