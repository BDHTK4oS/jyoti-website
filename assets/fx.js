/* =========================================================
   JyotiCab.com — futuristic motion layer (fx.js)
   Light-weight: no libraries beyond what the site already loads.
   Canvases pause when off-screen or when the tab is hidden.
   Nothing runs for visitors who ask for reduced motion.
   ========================================================= */
(function () {
  "use strict";
  var RM = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var FINE = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var DPR = Math.min(window.devicePixelRatio || 1, 1.5);
  var path = location.pathname.toLowerCase();
  var PAGE = /about/.test(path) ? "about" : /fleet/.test(path) ? "fleet" : /corporate/.test(path) ? "corporate"
    : /estimate/.test(path) ? "estimate" : /contact/.test(path) ? "contact" : "home";
  document.documentElement.setAttribute("data-fx-page", PAGE);

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; }

  /* Run a draw loop only while its element is on screen and the tab is visible */
  function loop(target, draw) {
    var on = false, vis = !document.hidden, raf = 0, last = 0;
    function tick(t) { raf = 0; if (!on || !vis) return; var dt = Math.min(48, t - (last || t)); last = t; draw(dt, t); raf = requestAnimationFrame(tick); }
    function kick() { if (on && vis && !raf) { last = 0; raf = requestAnimationFrame(tick); } }
    if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { on = es[0].isIntersecting; kick(); }, { rootMargin: "60px" }).observe(target);
    else { on = true; }
    document.addEventListener("visibilitychange", function () { vis = !document.hidden; kick(); });
    kick();
  }
  function sizeCanvas(c) {
    var r = c.getBoundingClientRect(), w = Math.max(1, r.width), h = Math.max(1, r.height);
    c.width = Math.round(w * DPR); c.height = Math.round(h * DPR);
    var ctx = c.getContext("2d"); ctx.setTransform(DPR, 0, 0, DPR, 0, 0); return { w: w, h: h, ctx: ctx };
  }

  /* ---------- HUD label + scramble-decode text ---------- */
  var HUD = {
    home: "Dispatch online · 24×7 · Kasba HQ",
    about: "Kasba HQ · 22.51°N 88.39°E",
    fleet: "Fleet status · Ready for duty",
    corporate: "Corporate desk · Contract billing",
    estimate: "Fare engine · Live calculation",
    contact: "Dispatch channel open · 24×7"
  };
  var GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%/<>*";
  function scramble(node, text, dur) {
    if (RM) { node.textContent = text; return; }
    var start = performance.now(); dur = dur || 900;
    (function step(t) {
      var p = Math.min(1, (t - start) / dur), n = Math.floor(p * text.length), out = text.slice(0, n);
      for (var i = n; i < text.length; i++) out += text[i] === " " ? " " : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      node.textContent = out;
      if (p < 1) requestAnimationFrame(step);
    })(start);
  }
  function addHud(hero) {
    var h1 = $("h1", hero); if (!h1) return;
    var host = h1.parentNode, since = $(".since", host);
    var h = el("div", "fx-hud", "<i></i><span></span>"); h.setAttribute("aria-hidden", "true");
    host.insertBefore(h, since && since.parentNode === host && !since.hidden ? since : h1);
    setTimeout(function () { scramble($("span", h), HUD[PAGE], 1100); }, 250);
  }

  /* ---------- Hero layer: beams, road grid, horizon + per-page canvas ---------- */
  function heroLayer(hero) {
    var L = el("div", "fx-hero-layer"); L.setAttribute("aria-hidden", "true");
    L.innerHTML = '<div class="fx-grid"></div><div class="fx-horizon"></div><div class="fx-beam"></div><div class="fx-beam b2"></div>';
    hero.insertBefore(L, hero.firstChild);
    var unique = { home: speedLines, about: embers, fleet: scanField, corporate: network, estimate: dial, contact: sonar }[PAGE];
    if (unique) unique(L, hero);
    swooshPulse(hero);
  }
  function swooshPulse(hero) {
    var p = $(".swoosh path", hero); if (!p || RM) return;
    var len = p.getTotalLength ? p.getTotalLength() : 1400;
    var c = p.cloneNode(false); c.setAttribute("class", "fx-pulse"); c.setAttribute("stroke-width", "4");
    c.style.strokeDasharray = "90 " + len; c.style.setProperty("--fx-l0", String(90)); c.style.setProperty("--fx-l1", String(-len));
    p.parentNode.appendChild(c);
  }

  /* Home: night-highway light streaks */
  function speedLines(L) {
    if (RM) return;
    var c = el("canvas", "fx-canvas"); L.appendChild(c);
    var S = sizeCanvas(c), streaks = [], n = innerWidth < 700 ? 18 : 38;
    function spawn(s, init) {
      s.y = S.h * (0.25 + Math.random() * 0.75); s.x = init ? Math.random() * S.w : -Math.random() * 300;
      s.len = 60 + Math.random() * 180; s.v = 0.35 + Math.random() * 1.1; s.w = Math.random() < 0.25 ? 2 : 1;
      s.red = Math.random() < 0.35; return s;
    }
    for (var i = 0; i < n; i++) streaks.push(spawn({}, true));
    addEventListener("resize", function () { S = sizeCanvas(c); });
    loop(c, function (dt) {
      var ctx = S.ctx; ctx.clearRect(0, 0, S.w, S.h);
      streaks.forEach(function (s) {
        s.x += s.v * dt * 0.9; if (s.x - s.len > S.w) spawn(s);
        var g = ctx.createLinearGradient(s.x - s.len, 0, s.x, 0);
        g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(1, s.red ? "rgba(254,0,91,.85)" : "rgba(200,206,255,.7)");
        ctx.strokeStyle = g; ctx.lineWidth = s.w; ctx.beginPath(); ctx.moveTo(s.x - s.len, s.y); ctx.lineTo(s.x, s.y); ctx.stroke();
      });
    });
  }
  /* About: slow rising light particles */
  function embers(L) {
    if (RM) return;
    var c = el("canvas", "fx-canvas"); L.appendChild(c);
    var S = sizeCanvas(c), ps = [], n = innerWidth < 700 ? 26 : 60;
    function spawn(p, init) { p.x = Math.random() * S.w; p.y = init ? Math.random() * S.h : S.h + 10; p.r = 0.6 + Math.random() * 1.8; p.v = 0.08 + Math.random() * 0.3; p.d = Math.random() * 6.28; p.red = Math.random() < 0.3; return p; }
    for (var i = 0; i < n; i++) ps.push(spawn({}, true));
    addEventListener("resize", function () { S = sizeCanvas(c); });
    loop(c, function (dt, t) {
      var ctx = S.ctx; ctx.clearRect(0, 0, S.w, S.h);
      ps.forEach(function (p) {
        p.y -= p.v * dt * 0.6; p.x += Math.sin(t / 1400 + p.d) * 0.15; if (p.y < -10) spawn(p);
        var a = Math.min(1, p.y / S.h + 0.2);
        ctx.fillStyle = p.red ? "rgba(254,0,91," + (a * 0.9) + ")" : "rgba(210,214,255," + (a * 0.75) + ")";
        ctx.shadowColor = p.red ? "#fe005b" : "#aab1ff"; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
      });
      ctx.shadowBlur = 0;
    });
  }
  /* Fleet: a laser plane sweeping the hero, with a dot matrix lighting up */
  function scanField(L) {
    if (RM) return;
    var c = el("canvas", "fx-canvas"); L.appendChild(c);
    var S = sizeCanvas(c), gap = 26;
    addEventListener("resize", function () { S = sizeCanvas(c); });
    loop(c, function (dt, t) {
      var ctx = S.ctx; ctx.clearRect(0, 0, S.w, S.h);
      var sx = ((t / 3200) % 1.3 - 0.15) * S.w;
      for (var x = gap / 2; x < S.w; x += gap) for (var y = gap / 2; y < S.h; y += gap) {
        var d = Math.abs(x - sx), a = Math.max(0.06, 1 - d / 140);
        ctx.fillStyle = d < 140 ? "rgba(254,0,91," + (a * 0.8) + ")" : "rgba(255,255,255,.07)";
        ctx.fillRect(x, y, a > 0.5 ? 2 : 1.4, a > 0.5 ? 2 : 1.4);
      }
      var g = ctx.createLinearGradient(sx - 60, 0, sx + 4, 0);
      g.addColorStop(0, "rgba(127,140,255,0)"); g.addColorStop(1, "rgba(255,120,170,.55)");
      ctx.fillStyle = g; ctx.fillRect(sx - 60, 0, 64, S.h);
    });
  }
  /* Corporate: a network of client sites linked to the Kasba hub, with data packets */
  function network(L) {
    if (RM) return;
    var c = el("canvas", "fx-canvas"); L.appendChild(c);
    var S = sizeCanvas(c), nodes = [], links = [], packets = [], N = innerWidth < 700 ? 12 : 22, hub;
    function build() {
      nodes = []; links = [];
      hub = { x: S.w * (innerWidth < 700 ? 0.8 : 0.74), y: S.h * 0.5, r: 5, hub: true };
      for (var i = 0; i < N; i++) {
        var ang = Math.random() * 6.283, rad = (0.18 + Math.random() * 0.62) * Math.max(S.w * 0.45, S.h);
        nodes.push({ x: hub.x + Math.cos(ang) * rad, y: hub.y + Math.sin(ang) * rad * 0.55, r: 1.6 + Math.random() * 1.8, ph: Math.random() * 6.28 });
      }
      nodes.forEach(function (n, i) { links.push([hub, n]); if (i % 3 === 0 && nodes[i + 1]) links.push([n, nodes[i + 1]]); });
    }
    build();
    addEventListener("resize", function () { S = sizeCanvas(c); build(); });
    var acc = 0;
    loop(c, function (dt, t) {
      var ctx = S.ctx; ctx.clearRect(0, 0, S.w, S.h);
      ctx.lineWidth = 1;
      links.forEach(function (l) { ctx.strokeStyle = "rgba(170,178,255,.14)"; ctx.beginPath(); ctx.moveTo(l[0].x, l[0].y); ctx.lineTo(l[1].x, l[1].y); ctx.stroke(); });
      acc += dt; if (acc > 260) { acc = 0; var l = links[(Math.random() * links.length) | 0]; packets.push({ l: l, p: 0, back: Math.random() < 0.5 }); }
      packets = packets.filter(function (k) {
        k.p += dt / 1400; if (k.p >= 1) return false;
        var a = k.back ? k.l[1] : k.l[0], b = k.back ? k.l[0] : k.l[1], x = a.x + (b.x - a.x) * k.p, y = a.y + (b.y - a.y) * k.p;
        ctx.fillStyle = "#fe005b"; ctx.shadowColor = "#fe005b"; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(x, y, 2.2, 0, 6.283); ctx.fill(); ctx.shadowBlur = 0;
        return true;
      });
      nodes.forEach(function (n) { var a = 0.45 + 0.4 * Math.sin(t / 700 + n.ph); ctx.fillStyle = "rgba(220,224,255," + a + ")"; ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, 6.283); ctx.fill(); });
      var pr = 6 + 4 * Math.sin(t / 400);
      ctx.strokeStyle = "rgba(254,0,91,.6)"; ctx.beginPath(); ctx.arc(hub.x, hub.y, 9 + pr, 0, 6.283); ctx.stroke();
      ctx.fillStyle = "#fe005b"; ctx.shadowColor = "#fe005b"; ctx.shadowBlur = 16; ctx.beginPath(); ctx.arc(hub.x, hub.y, hub.r, 0, 6.283); ctx.fill(); ctx.shadowBlur = 0;
    });
  }
  /* Estimate: a rotating meter dial */
  function dial(L) {
    var d = el("div", "fx-dial"), ticks = "";
    for (var i = 0; i < 60; i++) { var a = i * 6, long = i % 5 === 0; ticks += '<line x1="100" y1="' + (long ? 8 : 12) + '" x2="100" y2="18" transform="rotate(' + a + ' 100 100)" stroke="' + (long ? "#fe005b" : "rgba(255,255,255,.45)") + '" stroke-width="' + (long ? 2 : 1) + '"/>'; }
    d.innerHTML = '<svg viewBox="0 0 200 200"><defs><linearGradient id="fxsw" x1="0" x2="1"><stop offset="0" stop-color="#fe005b" stop-opacity="0"/><stop offset="1" stop-color="#fe005b" stop-opacity=".55"/></linearGradient></defs>' +
      '<g class="r1">' + ticks + '</g>' +
      '<circle class="r2" cx="100" cy="100" r="66" fill="none" stroke="rgba(170,178,255,.45)" stroke-width="1.5" stroke-dasharray="3 9 24 9"/>' +
      '<circle cx="100" cy="100" r="44" fill="none" stroke="rgba(255,255,255,.18)" stroke-width="1"/>' +
      '<path class="sweep" d="M100 100 L100 22 A78 78 0 0 1 167.5 61 Z" fill="url(#fxsw)"/>' +
      '<circle cx="100" cy="100" r="4" fill="#fe005b"/></svg>';
    L.appendChild(d);
  }
  /* Contact: sonar pings from the dispatch desk */
  function sonar(L) { L.appendChild(el("div", "fx-sonar", "<i></i><i></i><i></i><b></b>")); }

  /* ---------- Route line under the header ---------- */
  function road() {
    var r = el("div", "fx-road", '<div class="fx-road-fill"></div><div class="fx-road-car"><svg viewBox="0 0 26 16"><path d="M3 11 L4 7 Q5 5 8 5 L15 5 Q18 5 20 8 L23 9 Q25 10 25 11.5 L25 12 L3 12 Z" fill="#fe005b"/><path d="M9 6 L14 6 Q16.5 6 18 8 L9 8 Z" fill="#fff" opacity=".85"/><circle cx="8" cy="12.5" r="2.2" fill="#000478" stroke="#fff" stroke-width="1"/><circle cx="20" cy="12.5" r="2.2" fill="#000478" stroke="#fff" stroke-width="1"/></svg></div>');
    r.setAttribute("aria-hidden", "true"); document.body.appendChild(r);
    var fill = $(".fx-road-fill", r), car = $(".fx-road-car", r), ticking = false;
    function place() { var h = $(".site-header"); r.style.top = (h ? h.getBoundingClientRect().bottom : 0) - 1 + "px"; }
    function update() {
      ticking = false;
      var max = document.documentElement.scrollHeight - innerHeight, p = max > 0 ? Math.min(1, scrollY / max) : 0;
      fill.style.transform = "scaleX(" + p + ")";
      car.style.transform = "translateX(" + (p * (innerWidth - 26)) + "px)";
      place();
    }
    addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    addEventListener("resize", update);
    setTimeout(update, 60); setTimeout(update, 800);
  }

  /* ---------- Scroll reveals (also catches content rendered later) ---------- */
  var REVEAL = [".section-head", ".section h2:not(.section-head h2)", ".section-tight h2", ".points > div", ".contact-list > div",
    ".credentials > div", ".highlights > div", ".form", ".receipt", ".car", ".trust .wrap > div", ".band .wrap > *",
    ".prose > *", ".find-map", ".client-strip-band .client-marquee", ".split > aside"];
  var io = ("IntersectionObserver" in window) ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (!e.isIntersecting) return; io.unobserve(e.target); var t = e.target;
      requestAnimationFrame(function () { t.classList.add("fx-in"); t.classList.remove("fx-pre"); });
      if (t.classList.contains("car")) carReadout(t);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }) : null;
  function prime(root) {
    if (!io || RM) return;
    REVEAL.forEach(function (sel) {
      $$(sel, root).forEach(function (n, i) {
        if (n.dataset.fx || n.closest(".hero, .page-hero, .site-header, .site-footer")) return;
        var r = n.getBoundingClientRect(); n.dataset.fx = "1";
        if (r.top < innerHeight * 0.92 && r.bottom > 0) { if (n.classList.contains("car")) carReadout(n, true); return; }
        if (/^H2$/.test(n.tagName)) n.classList.add("fx-wipe");
        n.classList.add("fx-pre");
        var sib = n.parentElement ? Array.prototype.indexOf.call(n.parentElement.children, n) : i;
        n.style.setProperty("--fx-d", Math.min(sib, 6) * 0.08 + "s");
        io.observe(n);
      });
    });
  }

  /* Fleet: scan beam over the photo, price counts up like a readout */
  function carReadout(card, instant) {
    $$(".car-specs span", card).forEach(function (s, i) { s.style.setProperty("--i", i); });
    var art = $(".car-art", card);
    if (art && !instant && !RM) { var s = el("div", "fx-scan"); art.appendChild(s); requestAnimationFrame(function () { s.classList.add("go"); }); setTimeout(function () { s.remove(); }, 1700); }
    var st = $(".car-price strong", card); if (!st || RM) return;
    var target = +(st.textContent.replace(/[^\d]/g, "")) || 0; if (!target) return;
    var start = performance.now(), dur = instant ? 900 : 1300;
    (function step(t) { var p = Math.min(1, (t - start) / dur), e = 1 - Math.pow(1 - p, 3);
      st.textContent = "₹" + Math.round(target * e).toLocaleString("en-IN"); if (p < 1) requestAnimationFrame(step); })(start);
  }

  /* ---------- Holographic tilt cards ---------- */
  function holo(root) {
    if (!FINE || RM) return;
    $$(".car, .review, .client, .slip", root).forEach(function (c) {
      if (c.dataset.holo) return; c.dataset.holo = "1"; c.classList.add("fx-holo");
      var raf = 0, mx = 0, my = 0, flat = c.classList.contains("slip");
      c.addEventListener("pointermove", function (e) {
        var r = c.getBoundingClientRect(); mx = (e.clientX - r.left) / r.width; my = (e.clientY - r.top) / r.height;
        if (raf) return; raf = requestAnimationFrame(function () {
          raf = 0; var k = flat ? 3 : 9;
          c.style.transform = "perspective(800px) rotateX(" + ((0.5 - my) * k) + "deg) rotateY(" + ((mx - 0.5) * k) + "deg) translateY(-4px)";
          c.style.setProperty("--px", mx * 100 + "%"); c.style.setProperty("--py", my * 100 + "%"); c.style.setProperty("--hx", mx * 100 + "%");
        });
      });
      c.addEventListener("pointerenter", function () { c.classList.add("fx-hover"); c.style.transition = "transform .12s ease-out"; });
      c.addEventListener("pointerleave", function () { c.classList.remove("fx-hover"); c.style.transition = "transform .6s cubic-bezier(.2,.8,.2,1)"; c.style.transform = ""; });
    });
  }

  /* ---------- Cursor follower + magnetic, rippling buttons ---------- */
  function cursor() {
    if (!FINE || RM) return;
    var ring = el("div", "fx-cursor"), dot = el("div", "fx-dot"); ring.setAttribute("aria-hidden", "true"); dot.setAttribute("aria-hidden", "true");
    document.body.appendChild(ring); document.body.appendChild(dot);
    var x = -100, y = -100, rx = -100, ry = -100, raf = 0;
    function tick() { rx += (x - rx) * 0.2; ry += (y - ry) * 0.2; ring.style.transform = "translate3d(" + rx + "px," + ry + "px,0)";
      raf = (Math.abs(x - rx) + Math.abs(y - ry) > 0.3) ? requestAnimationFrame(tick) : 0; }
    addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse") return; x = e.clientX; y = e.clientY;
      dot.style.transform = "translate3d(" + x + "px," + y + "px,0)"; ring.classList.add("on"); dot.classList.add("on");
      var hot = e.target.closest && e.target.closest("a, button, input, select, textarea, label, .car, .mq-row, [role=button]");
      ring.classList.toggle("big", !!hot);
      if (!raf) raf = requestAnimationFrame(tick);
    }, { passive: true });
    document.addEventListener("mouseleave", function () { ring.classList.remove("on"); dot.classList.remove("on"); });
    addEventListener("pointerdown", function () { ring.classList.add("down"); });
    addEventListener("pointerup", function () { ring.classList.remove("down"); });
    // Leaflet maps want their own cursor
    document.addEventListener("pointerover", function (e) { var m = e.target.closest && e.target.closest(".leaflet-container"); ring.style.opacity = m ? "0" : ""; dot.style.opacity = m ? "0" : ""; });
  }
  function buttons() {
    if (RM) return;
    document.addEventListener("pointerdown", function (e) {
      var b = e.target.closest && e.target.closest(".btn"); if (!b) return;
      var r = b.getBoundingClientRect(), s = Math.max(r.width, r.height) * 2.2, rp = el("span", "fx-ripple");
      rp.style.width = rp.style.height = s + "px"; rp.style.left = (e.clientX - r.left - s / 2) + "px"; rp.style.top = (e.clientY - r.top - s / 2) + "px";
      b.appendChild(rp); setTimeout(function () { rp.remove(); }, 700);
    });
    if (!FINE) return;
    document.addEventListener("pointermove", function (e) {
      var b = e.target.closest && e.target.closest(".btn");
      $$(".btn[data-mag]").forEach(function (o) { if (o !== b) { o.style.removeProperty("--mx"); o.style.removeProperty("--my"); delete o.dataset.mag; } });
      if (!b || b.closest(".site-header")) return;
      var r = b.getBoundingClientRect(); b.dataset.mag = "1";
      b.style.setProperty("--mx", ((e.clientX - r.left - r.width / 2) * 0.25).toFixed(1) + "px");
      b.style.setProperty("--my", ((e.clientY - r.top - r.height / 2) * 0.35).toFixed(1) + "px");
    }, { passive: true });
  }

  /* ---------- Page extras ---------- */
  function homeExtras() {
    var slip = $(".slip"); if (slip && !RM) slip.appendChild(el("div", "fx-scan"));
  }
  function estimateExtras() {
    var rc = $(".receipt"); if (!rc) return;
    ["tl", "tr", "bl", "br"].forEach(function (k) { var c = el("span", "fx-corner " + k); c.setAttribute("aria-hidden", "true"); rc.appendChild(c); });
    if (RM || !("MutationObserver" in window)) return;
    var last = "";
    new MutationObserver(function () {
      var o = $(".odometer", rc); if (!o) return; var v = o.getAttribute("data-value") || "";
      if (v === last) return; last = v; o.classList.remove("fx-flash"); void o.offsetWidth; o.classList.add("fx-flash");
    }).observe(rc, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-value"] });
  }
  function aboutExtras() {
    if (RM) return;
    var hl = $(".highlights"); if (!hl || !("MutationObserver" in window)) return;
    // glow each big figure as it finishes counting
    setTimeout(function () {
      $$(".highlights dt").forEach(function (d, i) {
        if (!d.animate) return;
        d.animate([{ textShadow: "0 0 0 rgba(254,0,91,0)" }, { textShadow: "0 0 22px rgba(254,0,91,.9)" }, { textShadow: "0 0 0 rgba(254,0,91,0)" }], { duration: 1200, delay: 1500 + i * 150, easing: "ease-out" });
      });
    }, 300);
  }

  /* ---------- Boot ---------- */
  function boot() {
    $$(".hero, .page-hero").forEach(function (h) { heroLayer(h); addHud(h); });
    if (!RM) road();
    cursor(); buttons();
    if (PAGE === "home") homeExtras();
    if (PAGE === "estimate") estimateExtras();
    if (PAGE === "about") aboutExtras();
    prime(document); holo(document);
    // site.js fills in fleet, clients, reviews and the header after loading data
    if ("MutationObserver" in window) {
      var main = $("main") || document.body, pend = 0;
      new MutationObserver(function () { if (pend) return; pend = setTimeout(function () { pend = 0; prime(main); holo(main); }, 80); })
        .observe(main, { childList: true, subtree: true });
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
