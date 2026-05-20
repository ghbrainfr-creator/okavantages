/* ==========================================================================
   Composants CRO / neuromarketing — MonBonAgent
   Logique : compteurs animés, countdown, scarcité, bandeau immo soft.
   ========================================================================== */

(function () {
  /* ---------- Compteur animé "count up" ---------- */
  function animateCounter(el, target, duration = 1400) {
    const start = 0;
    const startTs = performance.now();
    const fmt = el.dataset.format || "int"; // "int" | "euro"
    function frame(now) {
      const p = Math.min(1, (now - startTs) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      const val = Math.floor(start + (target - start) * eased);
      el.textContent = fmt === "euro"
        ? val.toLocaleString("fr-FR") + " €"
        : val.toLocaleString("fr-FR");
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function bootCounters() {
    const counters = document.querySelectorAll("[data-counter]");
    counters.forEach((el) => {
      const target = parseInt(el.dataset.counter, 10);
      if (Number.isNaN(target)) return;
      const obs = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCounter(el, target);
            obs.unobserve(el);
          }
        });
      }, { threshold: 0.4 });
      obs.observe(el);
    });
  }

  /* ---------- Compteur live (incrément aléatoire pour social proof) ---------- */
  function bootLiveCounters() {
    document.querySelectorAll("[data-live-counter]").forEach((el) => {
      let current = parseInt(el.dataset.liveCounter, 10);
      const minInt = parseInt(el.dataset.liveMin || "8000", 10);
      const maxInt = parseInt(el.dataset.liveMax || "22000", 10);
      const increment = () => {
        current += 1 + Math.floor(Math.random() * 3);
        el.textContent = current.toLocaleString("fr-FR");
        el.classList.add("bumped");
        setTimeout(() => el.classList.remove("bumped"), 240);
        setTimeout(increment, minInt + Math.random() * (maxInt - minInt));
      };
      setTimeout(increment, 5000 + Math.random() * 8000);
    });
  }

  /* ---------- Countdown timer (data-countdown="YYYY-MM-DDTHH:MM:SSZ" ou +Xj) ---------- */
  function parseTarget(spec) {
    if (!spec) return null;
    if (/^\+\d+[hjd]$/.test(spec)) {
      const n = parseInt(spec.slice(1), 10);
      const unit = spec.slice(-1);
      const ms = unit === "h" ? n * 3600e3 : n * 86400e3;
      return Date.now() + ms;
    }
    const t = Date.parse(spec);
    return Number.isNaN(t) ? null : t;
  }

  function bootCountdowns() {
    document.querySelectorAll("[data-countdown]").forEach((el) => {
      const target = parseTarget(el.dataset.countdown);
      if (!target) return;
      function tick() {
        const left = target - Date.now();
        if (left <= 0) {
          el.innerHTML = '<i class="fas fa-hourglass-end"></i> Offre terminée';
          return;
        }
        const d = Math.floor(left / 86400e3);
        const h = Math.floor((left % 86400e3) / 3600e3);
        const m = Math.floor((left % 3600e3) / 60e3);
        const s = Math.floor((left % 60e3) / 1000);
        const units = d > 0
          ? `<span class="countdown-unit">${d}j</span><span class="countdown-unit">${String(h).padStart(2,"0")}h</span><span class="countdown-unit">${String(m).padStart(2,"0")}m</span>`
          : `<span class="countdown-unit">${String(h).padStart(2,"0")}h</span><span class="countdown-unit">${String(m).padStart(2,"0")}m</span><span class="countdown-unit">${String(s).padStart(2,"0")}s</span>`;
        el.innerHTML = `<i class="fas fa-clock"></i> Expire dans <span class="countdown-units">${units}</span>`;
        requestAnimationFrame(() => {});
        setTimeout(tick, d > 0 ? 60000 : 1000);
      }
      tick();
    });
  }

  /* ---------- Stock résiduel ---------- */
  function bootStockMeters() {
    document.querySelectorAll("[data-stock-left][data-stock-total]").forEach((bar) => {
      const left = parseInt(bar.dataset.stockLeft, 10);
      const total = parseInt(bar.dataset.stockTotal, 10);
      if (!left || !total) return;
      const pct = Math.max(2, Math.min(100, Math.round(((total - left) / total) * 100)));
      const fill = bar.querySelector(".stock-meter-bar-fill");
      if (fill) fill.style.width = pct + "%";
    });
  }

  /* ---------- Bandeau immo soft (cookie de fermeture 7j) ---------- */
  function bootImmoBar() {
    const bar = document.getElementById("immo-soft-bar");
    if (!bar) return;
    const cookieKey = "mba_immo_closed";
    const closedAt = parseInt(localStorage.getItem(cookieKey) || "0", 10);
    const dismissedRecently = closedAt && Date.now() - closedAt < 7 * 86400e3;
    if (dismissedRecently) {
      bar.remove();
      document.body.classList.remove("has-immo-bar");
      return;
    }
    document.body.classList.add("has-immo-bar");
    const close = bar.querySelector(".immo-soft-bar-close");
    if (close) {
      close.addEventListener("click", () => {
        localStorage.setItem(cookieKey, String(Date.now()));
        bar.classList.add("hidden");
        document.body.classList.remove("has-immo-bar");
        setTimeout(() => bar.remove(), 320);
      });
    }
  }

  /* ---------- Init ---------- */
  function init() {
    bootCounters();
    bootLiveCounters();
    bootCountdowns();
    bootStockMeters();
    bootImmoBar();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
