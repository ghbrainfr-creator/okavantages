/* =====================================================================
   MonBonAgent · Strategy A · Front hydrator
   Reconnecte chaque section de la home au back-office Supabase.
   Le HTML statique d'index.html sert de fallback ; si Supabase
   renvoie de la data, on remplace la section.
   ===================================================================== */
(function(){
  'use strict';
  if (typeof sb === 'undefined') {
    console.warn('[strategy-a] sb (Supabase) non disponible — abandon');
    return;
  }

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------
  function $(sel, root){ return (root||document).querySelector(sel); }
  function html(s){ return (s==null) ? '' : String(s); }
  function escape(s){ return html(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function fa(iconClass, extra){ return `<i class="${html(iconClass||'')}${extra?' '+extra:''}"></i>`; }

  // Petit badge fixe en haut à droite pour identifier la version
  function injectStrategyBadge(){
    if ($('#strategy-a-badge')) return;
    const b = document.createElement('div');
    b.id = 'strategy-a-badge';
    b.innerHTML = '<i class="fas fa-flask"></i> Strategy A · admin-driven';
    b.style.cssText = 'position:fixed;top:12px;right:12px;z-index:9999;background:linear-gradient(135deg,#006fff 0%,#0f0a30 100%);color:#fff;font-family:Montserrat,sans-serif;font-size:11.5px;font-weight:600;padding:8px 14px;border-radius:999px;box-shadow:0 8px 24px rgba(15,10,48,.25);display:inline-flex;align-items:center;gap:8px;letter-spacing:.3px';
    document.body.appendChild(b);
  }

  // ------------------------------------------------------------
  // 1) Hero
  // ------------------------------------------------------------
  function renderHero(s){
    const root = $('.hero-accroche');
    if (!root || !s) return;
    const pillIcon = s.hero_pill_icon ? fa(s.hero_pill_icon,'')+' ' : '';
    const ctaP = s.hero_cta_primary_label ? `
      <a href="${escape(s.hero_cta_primary_href||'#')}" class="hero-cta-primary"
         ${s.hero_cta_primary_action==='open_signup' ? `onclick="event.preventDefault();document.getElementById('signupModal')?.classList.add('show');"` : ''}>
        <span class="hero-cta-main">${s.hero_cta_primary_icon?fa(s.hero_cta_primary_icon)+' ':''}${escape(s.hero_cta_primary_label)}</span>
        ${s.hero_cta_primary_sub?`<small>${escape(s.hero_cta_primary_sub)}</small>`:''}
      </a>` : '';
    const ctaS = s.hero_cta_secondary_label ? `
      <a href="${escape(s.hero_cta_secondary_href||'#')}" class="hero-cta-ghost">
        ${s.hero_cta_secondary_icon?fa(s.hero_cta_secondary_icon):''} ${escape(s.hero_cta_secondary_label)}
      </a>` : '';
    const stats = [];
    if (s.hero_stat_1_value) stats.push(`<div><strong>${html(s.hero_stat_1_value).replace(/ /g,'&nbsp;')}</strong><span>${escape(s.hero_stat_1_label||'')}</span></div>`);
    if (s.hero_stat_2_value) stats.push(`<div><strong>${html(s.hero_stat_2_value).replace(/ /g,'&nbsp;')}</strong><span>${escape(s.hero_stat_2_label||'')}</span></div>`);
    if (s.hero_stat_3_value) stats.push(`<div><strong>${html(s.hero_stat_3_value).replace(/ /g,'&nbsp;')}</strong><span>${escape(s.hero_stat_3_label||'')}</span></div>`);
    root.innerHTML = `
      ${s.hero_pill_text?`<span class="hero-pill">${pillIcon}${escape(s.hero_pill_text)}</span>`:''}
      ${s.hero_title?`<h1>${html(s.hero_title)}</h1>`:''}
      ${s.hero_lead?`<p class="hero-lead">${html(s.hero_lead)}</p>`:''}
      <div class="hero-cta-group">${ctaP}${ctaS}</div>
      <div class="hero-stats">${stats.join('')}</div>
    `;
  }

  // ------------------------------------------------------------
  // 2) Trust strip
  // ------------------------------------------------------------
  function renderTrustStrip(s){
    const root = $('.trust-strip .trust-strip-inner');
    if (!root || !s || !Array.isArray(s.trust_pillars) || !s.trust_pillars.length) return;
    root.innerHTML = s.trust_pillars.map(p => {
      const left = p.type==='badge'
        ? `<span class="mba-badge" aria-label="${escape(p.badge||'')}">${escape(p.badge||'')}</span>`
        : fa(p.icon||'fas fa-circle');
      return `<div class="trust-item">${left}<span>${html(p.text_html||p.text||'')}</span></div>`;
    }).join('');
  }

  // ------------------------------------------------------------
  // 3) Comment ça marche
  // ------------------------------------------------------------
  async function renderHiw(s){
    const sect = $('section.how-it-works');
    if (!sect) return;
    const title = $('.section-title h2', sect);
    const sub   = $('.section-title p',  sect);
    if (title && s && s.hiw_section_title)    title.textContent = s.hiw_section_title;
    if (sub   && s && s.hiw_section_subtitle) sub.textContent   = s.hiw_section_subtitle;

    const grid = $('.hiw-grid', sect);
    if (!grid) return;
    const { data, error } = await sb.from('how_it_works_steps').select('*').eq('active',true).order('position');
    if (error || !data || !data.length) return;
    grid.innerHTML = data.map(st => `
      <article class="hiw-step">
        <div class="hiw-step-num">${escape(st.num_label||'')}</div>
        <div class="hiw-step-visual hiw-step-visual--${escape(st.position)}">
          ${st.visual_icon?fa(st.visual_icon,'hiw-step-visual-icon'):''}
          ${st.deco_a_icon?fa(st.deco_a_icon,'hiw-step-visual-deco hiw-step-visual-deco--a'):''}
          ${st.deco_b_icon?fa(st.deco_b_icon,'hiw-step-visual-deco hiw-step-visual-deco--b'):''}
        </div>
        <div class="hiw-step-body">
          ${st.icon?`<div class="hiw-step-icon">${fa(st.icon)}</div>`:''}
          <h3>${escape(st.title||'')}</h3>
          <p>${html(st.body_html||'')}</p>
        </div>
      </article>
    `).join('');
  }

  // ------------------------------------------------------------
  // 4) Catégories grille
  // ------------------------------------------------------------
  async function renderCategories(s){
    const sect = $('#categories-grid');
    if (!sect) return;
    const title = $('.section-title h2', sect);
    const sub   = $('.section-title p',  sect);
    if (title && s && s.categories_section_title)    title.textContent = s.categories_section_title;
    if (sub   && s && s.categories_section_subtitle) sub.textContent   = s.categories_section_subtitle;

    const grid = $('.cat-grid-visual', sect);
    if (!grid) return;
    const { data, error } = await sb.from('categories_grid').select('*').eq('active',true).order('position');
    if (error || !data || !data.length) return;
    grid.innerHTML = data.map(c => `
      <a href="/categorie.html?slug=${encodeURIComponent(c.slug)}" class="cat-tile">
        ${c.image_url?`<div class="cat-tile-bg" style="background-image:url('${escape(c.image_url)}')"></div>`:''}
        ${c.icon?fa(c.icon):''}
        <span>${escape(c.label||'')}</span>
      </a>
    `).join('');
  }

  // ------------------------------------------------------------
  // 5) Pourquoi MonBonAgent (about_sections)
  // ------------------------------------------------------------
  function renderAbout(s){
    const sect = $('.about-section#about');
    if (!sect) return;
    const title = $('.section-title h2', sect);
    const sub   = $('.section-title p',  sect);
    if (title && s && s.about_section_title) {
      title.innerHTML = `<i class="fas fa-heart" style="color:var(--primary)"></i> ${escape(s.about_section_title)}`;
    }
    if (sub && s && s.about_section_subtitle) sub.textContent = s.about_section_subtitle;

    const rows = $('#aboutRows');
    if (!rows || !s || !Array.isArray(s.about_sections) || !s.about_sections.length) return;
    rows.innerHTML = s.about_sections.map(r => `
      <div class="about-row${r.reverse?' reverse':''}">
        ${r.image_url?`<div class="about-img" style="background-image:url('${escape(r.image_url)}')"></div>`:''}
        <div class="about-text">
          ${r.title?`<h3>${escape(r.title)}</h3>`:''}
          ${r.body_html?`<p>${html(r.body_html)}</p>`:''}
          ${r.cta_label?`<a href="${escape(r.cta_href||'#')}" class="about-cta">${escape(r.cta_label)} <i class="fas fa-arrow-right"></i></a>`:''}
        </div>
      </div>
    `).join('');
  }

  // ------------------------------------------------------------
  // 6) Le passeur
  // ------------------------------------------------------------
  function renderPasseur(s){
    const sect = $('#le-bon-agent');
    if (!sect || !s) return;
    // Photo
    const photo = $('.relay-photo', sect);
    if (photo && s.passeur_photo_url) photo.style.backgroundImage = `url('${s.passeur_photo_url}')`;
    const cap = $('.relay-photo-pill', sect);
    if (cap && s.passeur_caption) cap.innerHTML = `<i class="fas fa-hand-holding-heart"></i> ${escape(s.passeur_caption)}`;

    // Contenu
    const content = $('.relay-content', sect);
    if (!content) return;
    const bullets = Array.isArray(s.passeur_bullets) ? s.passeur_bullets : [];
    content.innerHTML = `
      ${s.passeur_pill?`<span class="relay-pill">${escape(s.passeur_pill)}</span>`:''}
      ${s.passeur_title_html?`<h2>${html(s.passeur_title_html)}</h2>`:''}
      ${s.passeur_lead_html?`<p class="relay-lead">${html(s.passeur_lead_html)}</p>`:''}
      ${s.passeur_body_html||''}
      ${bullets.length?`<ul class="relay-bullets">${bullets.map(b=>`<li>${fa(b.icon||'fas fa-circle-check')} ${html(b.text||'')}</li>`).join('')}</ul>`:''}
      ${s.passeur_confession?`<p class="relay-confession">${html(s.passeur_confession)}</p>`:''}
      ${s.passeur_cta_label?`<a href="${escape(s.passeur_cta_href||'#')}" class="relay-cta"><i class="fas fa-store"></i> ${escape(s.passeur_cta_label)}</a>`:''}
      ${s.passeur_foot_html?`<p class="relay-foot">${html(s.passeur_foot_html)}</p>`:''}
    `;
  }

  // ------------------------------------------------------------
  // 7) FAQ
  // ------------------------------------------------------------
  async function renderFaq(s){
    const sect = $('.faq-section#faq');
    if (!sect) return;
    const title = $('.section-title h2', sect);
    const sub   = $('.section-title p',  sect);
    if (title && s && s.faq_section_title)    title.textContent = s.faq_section_title;
    if (sub   && s && s.faq_section_subtitle) sub.innerHTML     = s.faq_section_subtitle.replace(/1er/i,'1<sup>er</sup>');

    const grid = $('.faq-grid', sect);
    if (!grid) return;
    const { data, error } = await sb.from('faq_items').select('*').eq('active',true).order('position');
    if (error || !data || !data.length) return;
    grid.innerHTML = data.map(f => `
      <details class="faq-item">
        <summary>${escape(f.question||'')}</summary>
        <div class="faq-body">${html(f.answer_html||'')}</div>
      </details>
    `).join('');
  }

  // ------------------------------------------------------------
  // 8) Bandeau immo soft
  // ------------------------------------------------------------
  function renderImmoBar(s){
    const bar = $('#immo-soft-bar');
    if (!bar || !s) return;
    if (s.immo_bar_active === false) { bar.style.display='none'; return; }
    const txt = $('.immo-soft-bar-text', bar);
    const cta = $('.immo-soft-bar-cta', bar);
    if (txt && s.immo_bar_text) {
      txt.innerHTML = `${fa(s.immo_bar_icon||'fas fa-house')}<span>${html(s.immo_bar_text)}</span>`;
    }
    if (cta) {
      if (s.immo_bar_cta_href)  cta.href = s.immo_bar_cta_href;
      if (s.immo_bar_cta_label) cta.innerHTML = `<i class="fas fa-calculator"></i> ${escape(s.immo_bar_cta_label)}`;
    }
  }

  // ------------------------------------------------------------
  // 9) Modal signup
  // ------------------------------------------------------------
  function renderSignupModal(s){
    const modal = $('#signupModal .signup-modal');
    if (!modal || !s) return;
    if (s.signup_modal_active === false) {
      const overlay = $('#signupModal');
      if (overlay) overlay.style.display='none';
      return;
    }
    const bullets = Array.isArray(s.signup_modal_bullets) ? s.signup_modal_bullets : [];
    modal.innerHTML = `
      <button class="signup-modal-close" aria-label="Fermer" onclick="document.getElementById('signupModal').classList.remove('show')">×</button>
      ${s.signup_modal_pill?`<span class="signup-modal-pill"><i class="fas fa-gift"></i> ${escape(s.signup_modal_pill)}</span>`:''}
      ${s.signup_modal_title_html?`<h2 id="signupTitle">${html(s.signup_modal_title_html)}</h2>`:''}
      ${s.signup_modal_body?`<p>${html(s.signup_modal_body)}</p>`:''}
      <form class="signup-modal-form" onsubmit="return submitSignup(event)">
        <input type="text"  id="signupName"  placeholder="Votre prénom (optionnel)">
        <input type="email" id="signupEmail" placeholder="Votre adresse email" required>
        <button type="submit"><i class="fas fa-gift"></i> ${escape(s.signup_modal_button_label||'Recevoir mon bon')}</button>
      </form>
      ${bullets.length?`<ul class="signup-modal-bullets">${bullets.map(b=>`<li>${fa(b.icon||'fas fa-check-circle')} ${escape(b.text||'')}</li>`).join('')}</ul>`:''}
    `;
  }

  // ------------------------------------------------------------
  // 10) Sticky CTA
  // ------------------------------------------------------------
  function renderStickyCta(s){
    const bar = $('#sticky-cta-bar');
    if (!bar || !s) return;
    if (s.sticky_cta_active === false) { bar.style.display='none'; return; }
    const txt = $('.sticky-cta-text', bar);
    const btn = $('.sticky-cta-btn',  bar);
    if (txt && s.sticky_cta_text_html) {
      txt.innerHTML = `<i class="fas fa-gift"></i><span>${html(s.sticky_cta_text_html)}</span>`;
    }
    if (btn && s.sticky_cta_button_label) {
      btn.textContent = s.sticky_cta_button_label;
    }
    if (typeof s.sticky_cta_scroll_pct === 'number') {
      window.__stickyCtaThreshold = s.sticky_cta_scroll_pct;
    }
  }

  // ------------------------------------------------------------
  // Orchestrateur
  // ------------------------------------------------------------
  async function hydrate(){
    injectStrategyBadge();
    const { data: settings, error } = await sb.from('site_settings').select('*').limit(1).maybeSingle();
    if (error || !settings) {
      console.warn('[strategy-a] site_settings introuvable — fallback statique conservé');
      return;
    }
    try { renderHero(settings); }        catch(e){ console.warn('[strategy-a] hero', e); }
    try { renderTrustStrip(settings); }  catch(e){ console.warn('[strategy-a] trust', e); }
    try { await renderHiw(settings); }   catch(e){ console.warn('[strategy-a] hiw',  e); }
    try { await renderCategories(settings); } catch(e){ console.warn('[strategy-a] cats', e); }
    try { renderAbout(settings); }       catch(e){ console.warn('[strategy-a] about', e); }
    try { renderPasseur(settings); }     catch(e){ console.warn('[strategy-a] passeur', e); }
    try { await renderFaq(settings); }   catch(e){ console.warn('[strategy-a] faq', e); }
    try { renderImmoBar(settings); }     catch(e){ console.warn('[strategy-a] immo', e); }
    try { renderSignupModal(settings); } catch(e){ console.warn('[strategy-a] modal', e); }
    try { renderStickyCta(settings); }   catch(e){ console.warn('[strategy-a] sticky', e); }
    console.log('[strategy-a] hydratation terminée ✓');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hydrate);
  } else {
    hydrate();
  }
})();
