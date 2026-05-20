/* Annuaire commerces Elne — rendu cartes côté client.
   Charge data/commerces-elne.json, applique les filtres et rend la grille.
   Aucun contenu protégé (photos, descriptions, avis GMB) — uniquement nom,
   catégorie, adresse, tél, lien externe Google Maps. */

(function () {
  const grid = document.getElementById("commerces-grid");
  if (!grid) return;

  const zoneFilter = grid.dataset.zone || ""; // "" = toutes, "centre-commercial-jacques-albert" = JCA
  const searchInput = document.getElementById("commerces-search");
  const filtersWrap = document.getElementById("commerces-filters");
  const countEl = document.getElementById("commerces-count");

  let dataset = [];
  let activeCategory = "all";
  let activeQuery = "";

  function escapeHtml(s) {
    if (s == null) return "";
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
  }

  function badge(commerce) {
    if (commerce.partenaire) {
      return '<span class="commerce-badge partenaire"><i class="fas fa-check-circle"></i> Partenaire</span>';
    }
    return '<span class="commerce-badge annuaire">Annuaire local</span>';
  }

  function metaRow(icon, content, href) {
    if (!content) return "";
    const inner = href
      ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(content)}</a>`
      : escapeHtml(content);
    return `<div class="meta-row"><i class="fas ${icon}"></i><span>${inner}</span></div>`;
  }

  function renderCard(c) {
    const tel = c.telephone ? c.telephone : "";
    const telHref = tel ? "tel:" + tel.replace(/\s+/g, "") : "";
    return `
      <article class="commerce-card" data-cat="${escapeHtml(c.categorie)}" data-name="${escapeHtml(c.nom.toLowerCase())}">
        <div class="commerce-card-header">
          <div class="commerce-icon"><i class="fas ${escapeHtml(c.icone || "fa-store")}"></i></div>
          <div class="commerce-title">
            <h3>${escapeHtml(c.nom)}</h3>
            <span class="commerce-cat">${escapeHtml(c.categorie)}</span>
          </div>
        </div>
        <div class="commerce-card-body">
          ${metaRow("fa-map-marker-alt", c.adresse)}
          ${metaRow("fa-phone", tel, telHref)}
          ${c.site_web ? metaRow("fa-globe", c.site_web.replace(/^https?:\/\//, "").replace(/\/$/, ""), c.site_web) : ""}
        </div>
        <div class="commerce-card-footer">
          ${badge(c)}
          <a class="commerce-cta" href="${escapeHtml(c.lien_maps)}" target="_blank" rel="noopener">
            <i class="fas fa-map"></i> Google Maps
          </a>
        </div>
      </article>`;
  }

  function applyFilters() {
    const q = activeQuery.trim().toLowerCase();
    const filtered = dataset.filter((c) => {
      if (activeCategory !== "all" && c.categorie !== activeCategory) return false;
      if (q && !c.nom.toLowerCase().includes(q) && !c.categorie.toLowerCase().includes(q)) return false;
      return true;
    });
    if (countEl) countEl.textContent = String(filtered.length);
    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="commerces-empty">
          <i class="fas fa-search"></i>
          <p>Aucun commerce ne correspond à votre recherche.</p>
        </div>`;
      return;
    }
    grid.innerHTML = filtered.map(renderCard).join("");
  }

  function renderFilters(categories) {
    if (!filtersWrap) return;
    const chips = [
      `<button class="filter-chip active" data-cat="all">Tous</button>`,
      ...categories.map(
        (c) => `<button class="filter-chip" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`
      ),
    ].join("");
    filtersWrap.innerHTML = chips;
    filtersWrap.querySelectorAll(".filter-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        filtersWrap.querySelectorAll(".filter-chip").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        activeCategory = btn.dataset.cat;
        applyFilters();
      });
    });
  }

  fetch("/data/commerces-elne.json")
    .then((r) => r.json())
    .then((data) => {
      dataset = (data.commerces || []).filter((c) => !zoneFilter || c.zone === zoneFilter);
      const cats = Array.from(new Set(dataset.map((c) => c.categorie))).sort();
      renderFilters(cats);
      applyFilters();
    })
    .catch((err) => {
      console.error("Erreur chargement commerces:", err);
      grid.innerHTML = `
        <div class="commerces-empty">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Impossible de charger l'annuaire pour le moment.</p>
        </div>`;
    });

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      activeQuery = e.target.value;
      applyFilters();
    });
  }
})();
