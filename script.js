// Aether – web: téma, farba rozhrania, jazyk, živá ukážka grafov a animácie pri scrollovaní.
(() => {
  "use strict";

  const root = document.documentElement;
  root.classList.add("js");

  // Uložené voľby; stránka musí fungovať aj bez localStorage (súkromné okno a pod.).
  const store = {
    get(key) { try { return localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch { /* nevadí */ } },
  };
  const css = (name) => getComputedStyle(root).getPropertyValue(name).trim();

  // ---------- téma ----------
  const systemLight = window.matchMedia("(prefers-color-scheme: light)");
  const applyTheme = (theme) => root.setAttribute("data-theme", theme);
  applyTheme(store.get("aether-theme") || (systemLight.matches ? "light" : "dark"));

  document.getElementById("themeToggle").addEventListener("click", () => {
    const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
    applyTheme(next);
    store.set("aether-theme", next);
    drawAll();
  });
  systemLight.addEventListener("change", (e) => {
    if (!store.get("aether-theme")) { applyTheme(e.matches ? "light" : "dark"); drawAll(); }
  });

  // ---------- farba rozhrania (rovnaké farby ako v aplikácii) ----------
  const ACCENTS = ["#4cc9f0", "#4c8dff", "#b388ff", "#ff6b81", "#ff9f43", "#2ed573"];
  const swatchBox = document.getElementById("swatches");

  function setAccent(color) {
    root.style.setProperty("--accent", color);
    for (const b of swatchBox.children) b.setAttribute("aria-pressed", String(b.dataset.color === color));
    store.set("aether-accent", color);
    drawAll();
  }
  for (const color of ACCENTS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "swatch";
    b.dataset.color = color;
    b.style.setProperty("--c", color);
    b.addEventListener("click", () => setAccent(color));
    swatchBox.appendChild(b);
  }

  // ---------- živá ukážka (simulované dáta) ----------
  const POINTS = 60;
  const RAM_TOTAL = 8;
  const state = { cpu: [], ram: [], down: [], up: [] };
  let cpu = 22, ram = 68, down = 900, up = 120;

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const fmtRate = (kb) => (kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB/s` : `${kb.toFixed(0)} KB/s`);

  function step() {
    // náhodná prechádzka s občasnou špičkou, aby graf vyzeral ako skutočná záťaž
    cpu = clamp(cpu + (Math.random() - 0.5) * 14 + (Math.random() < 0.08 ? 35 : 0) - (cpu - 24) * 0.12, 3, 98);
    ram = clamp(ram + (Math.random() - 0.5) * 1.6 - (ram - 68) * 0.03, 40, 92);
    down = clamp(down + (Math.random() - 0.5) * 700 + (Math.random() < 0.1 ? 2600 : 0) - (down - 900) * 0.2, 5, 9000);
    up = clamp(up + (Math.random() - 0.5) * 120 - (up - 120) * 0.2, 2, 2000);
    for (const [key, value] of [["cpu", cpu], ["ram", ram], ["down", down], ["up", up]]) {
      state[key].push(value);
      if (state[key].length > POINTS) state[key].shift();
    }
  }

  function prepare(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }

  function path(ctx, series, w, h, max, pad) {
    const stepX = w / (POINTS - 1);
    ctx.beginPath();
    series.forEach((v, i) => {
      const x = w - (series.length - 1 - i) * stepX;
      const y = h - pad - Math.min(v / max, 1) * (h - pad * 2 - 4);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    return w - (series.length - 1) * stepX; // x prvého bodu
  }

  function drawGraph(id, seriesList, colors, fixedMax, label) {
    const canvas = document.getElementById(id);
    if (!canvas || !canvas.clientWidth) return;
    const { ctx, w, h } = prepare(canvas);
    const peak = Math.max(1, ...seriesList.flat());
    const max = fixedMax || peak * 1.25;

    ctx.strokeStyle = css("--grid");
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = Math.round((h * i) / 4) + 0.5;
      ctx.beginPath(); ctx.moveTo(6, y); ctx.lineTo(w - 6, y); ctx.stroke();
    }
    seriesList.forEach((series, n) => {
      if (series.length < 2) return;
      const color = colors[n];
      const firstX = path(ctx, series, w, h, max, 3);
      ctx.lineTo(w, h); ctx.lineTo(firstX, h); ctx.closePath();
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, color + "5a");
      grad.addColorStop(1, color + "00");
      ctx.fillStyle = grad;
      ctx.fill();
      path(ctx, series, w, h, max, 3);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.8;
      ctx.lineJoin = "round";
      ctx.stroke();
    });
    ctx.fillStyle = css("--muted");
    ctx.font = "10px -apple-system, sans-serif";
    ctx.fillText(label(max), 8, 14);
  }

  function drawSpark(id, series, color) {
    const canvas = document.getElementById(id);
    if (!canvas || !canvas.clientWidth || series.length < 2) return;
    const { ctx, w, h } = prepare(canvas);
    path(ctx, series, w, h, 100, 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  const text = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };

  function drawAll() {
    const accent = css("--accent"), violet = css("--violet"), pink = css("--pink");
    drawGraph("cpuGraph", [state.cpu], [accent], 100, (m) => `${m.toFixed(0)} %`);
    drawGraph("ramGraph", [state.ram], [violet], 100, (m) => `${m.toFixed(0)} %`);
    drawGraph("netGraph", [state.down, state.up], [accent, pink], null, fmtRate);
    drawSpark("miniCpuSpark", state.cpu, accent);
    drawSpark("miniRamSpark", state.ram, violet);

    text("cpuValue", `${cpu.toFixed(0)} %`);
    text("ramValue", `${ram.toFixed(0)} %`);
    text("ramSub", `${((ram / 100) * RAM_TOTAL).toFixed(1)} GB / ${RAM_TOTAL.toFixed(1)} GB · swap 12 %`);
    text("netValue", `↓ ${fmtRate(down)}`);
    text("netSub", `↑ ${fmtRate(up)}`);
    text("miniCpu", `${cpu.toFixed(0)} %`);
    text("miniRam", `${ram.toFixed(0)} %`);
    text("miniNet", `↓ ${fmtRate(down)}    ↑ ${fmtRate(up)}`);
  }

  for (let i = 0; i < POINTS; i++) step();
  setAccent(store.get("aether-accent") || ACCENTS[0]); // nastaví farbu a prvýkrát vykreslí
  setInterval(() => { if (!document.hidden) { step(); drawAll(); } }, 1000);
  window.addEventListener("resize", drawAll);

  // ---------- jazyk (rovnaké jazyky ako v aplikácii) ----------
  const I18N = window.AETHER_I18N || {};
  const langSelect = document.getElementById("langSelect");
  for (const [code, label] of window.AETHER_LANGS || []) langSelect.add(new Option(label, code));

  // texty zoznamov: [selektor položiek, kľúč prekladu, selektory častí v poradí, či ide o HTML]
  const LISTS = [
    ["#demoTabs .tab", "tabs", null],
    [".feature", "features", [".feature-tag", "h3", "p"]],
    [".facts li", "facts", ["b", "span"]],
    [".faq details", "faq", ["summary", "p"]],
  ];

  function applyLang(lang) {
    const T = I18N[lang];
    if (!T) return;
    root.lang = lang;
    document.title = T.meta_title;
    document.querySelector('meta[name="description"]').setAttribute("content", T.meta_desc);
    for (const el of document.querySelectorAll("[data-i18n]")) el.textContent = T[el.dataset.i18n];
    for (const el of document.querySelectorAll("[data-i18n-aria]")) el.setAttribute("aria-label", T[el.dataset.i18nAria]);
    for (const [selector, key, parts] of LISTS) {
      document.querySelectorAll(selector).forEach((el, i) => {
        const value = T[key][i];
        if (!parts) { el.textContent = value; return; }
        parts.forEach((part, n) => {
          // odpovede v otázkach obsahujú <b>; texty sú naše vlastné z lang.js
          if (key === "faq" && n === 1) el.querySelector(part).innerHTML = value[n];
          else el.querySelector(part).textContent = value[n];
        });
      });
    }
    [...swatchBox.children].forEach((b, i) => b.setAttribute("aria-label", `${T.swatches_aria}: ${T.colors[i]}`));
    langSelect.value = lang;
  }

  const browserLang = (navigator.language || "sk").slice(0, 2).toLowerCase();
  applyLang(I18N[store.get("aether-lang")] ? store.get("aether-lang") : I18N[browserLang] ? browserLang : "sk");
  langSelect.addEventListener("change", () => {
    applyLang(langSelect.value);
    store.set("aether-lang", langSelect.value);
  });

  // ---------- animácia pri scrollovaní ----------
  const items = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) { entry.target.classList.add("is-visible"); io.unobserve(entry.target); }
      }
    }, { threshold: 0.15 });
    items.forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 60}ms`; io.observe(el); });
  } else {
    items.forEach((el) => el.classList.add("is-visible"));
  }
})();
