/* JyotiCab.com — shared site script.
   Content (rates, fleet, contact details, About text) comes from /data/*.json, which the admin panel edits. */
(function () {
  "use strict";

  var FALLBACK = {
    site: { business_name: "JyotiCab.com", phone_primary: "9830079505", phone_landline: "033-40040440", whatsapp: "9830079500", email: "jyoti_travels@yahoo.com", address: "2076, Rajdanga Main Road, Kasba, Kolkata - 700107", hours: "Open 24 hours, 7 days a week", gstin: "19AFUPB9582R2Z4", msme: "UDYAM-WB-10-0024483", map_link: "https://www.google.com/maps/search/?api=1&query=Rajdanga+Main+Road+Kasba+Kolkata", about_points: [] },
    fleet: { cars: [
      { name: "Dzire", category: "Sedan", shape: "sedan", seats: 4, bags: 2, package_price: 2000, extra_km: 20, extra_hour: 200 },
      { name: "Ertiga", category: "MPV", shape: "mpv", seats: 6, bags: 2, package_price: 2500, extra_km: 25, extra_hour: 250 },
      { name: "Innova", category: "MPV", shape: "mpv", seats: 7, bags: 3, package_price: 2500, extra_km: 25, extra_hour: 250 },
      { name: "Innova Crysta", category: "Premium MPV", shape: "mpv", seats: 6, bags: 4, package_price: 3200, extra_km: 32, extra_hour: 320 },
      { name: "Innova Hycross", category: "Luxury MPV", shape: "mpv", seats: 6, bags: 4, package_price: 4800, extra_km: 48, extra_hour: 480 }
    ] },
    reviews: { reviews: [] },
    clients: { clients: [] },
    rates: { package_hours: 10, package_km: 100, night_after_11pm: 300, early_before_6am: 200, outstation_km_per_day: 200, outstation_charge_per_day: 500, driver_lodging_per_night: 1500, office_lat: 22.5133, office_lng: 88.3919, garage_km_buffer: 2, traffic_factor: 2, time_rounding_minutes: 15, terms: [] }
  };

  function getJSON(name) {
    return fetch("data/" + name + ".json", { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .catch(function () { return FALLBACK[name]; });
  }

  /* Admin edits can leave a number as text or blank; this keeps the maths safe. */
  function n(v, d) { var x = parseFloat(String(v == null ? "" : v).replace(/[^0-9.\-]/g, "")); return isFinite(x) ? x : (d || 0); }
  function inr(v) { return "₹" + Math.round(v).toLocaleString("en-IN"); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function digits(p) { return String(p || "").replace(/\D/g, ""); }
  function waLink(site, text) { var d = digits(site.whatsapp); if (d.length === 10) d = "91" + d; return "https://wa.me/" + d + (text ? "?text=" + encodeURIComponent(text) : ""); }
  function reduced() { return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
  function hasGSAP() { return typeof window.gsap !== "undefined" && !reduced(); }
  function hm(mins) { mins = Math.round(mins); var h = Math.floor(mins / 60), m = mins % 60; return (h ? h + " hr" : "") + (h && m ? " " : "") + (m || !h ? m + " min" : ""); }
  function gmaps(p) { return "https://www.google.com/maps?q=" + p.lat.toFixed(5) + "," + p.lng.toFixed(5); }

  /* ---------- Pricing rules (match the quotation terms) ----------
     Duty time = your hours + garage-out and garage-in drive time, rounded UP to the next quarter hour.
     Duty km   = your km + garage-out and garage-in distance, each leg padded by a few km.
     Extra hours or extra km beyond the package are charged, whichever is higher. */
  var Pricing = {
    roundUp: function (mins, step) { step = step || 15; return Math.ceil((mins - 1e-6) / step) * step; },
    garage: function (rates, g) {
      if (!g) return null;
      var buf = n(rates.garage_km_buffer, 2);
      return { km: Math.ceil(g.outKm + g.inKm + 2 * buf), mins: g.outMin + g.inMin, outMin: g.outMin, inMin: g.inMin };
    },
    local: function (car, rates, o) {
      var pkgH = n(rates.package_hours, 10), pkgK = n(rates.package_km, 100), step = n(rates.time_rounding_minutes, 15) || 15;
      var g = Pricing.garage(rates, o.garage);
      var useMins = Math.max(0, n(o.hours)) * 60, useKm = Math.max(0, n(o.km));
      var dutyMins = Pricing.roundUp(useMins + (g ? g.mins : 0), step);
      var dutyKm = Math.ceil(useKm + (g ? g.km : 0));
      var exKm = Math.max(0, dutyKm - pkgK), exMins = Math.max(0, dutyMins - pkgH * 60);
      var kmCost = exKm * n(car.extra_km), hrCost = Math.round(exMins / 60 * n(car.extra_hour));
      var lines = [];
      if (g) lines.push({ info: true, label: "Garage out + in, approx.", value: g.km + " km · " + hm(g.mins) });
      lines.push({ info: true, label: "Duty billed on", value: hm(dutyMins) + " · " + dutyKm + " km" });
      lines.push({ label: "Package (" + pkgH + " hrs / " + pkgK + " km)", amount: n(car.package_price) });
      if (kmCost > 0 || hrCost > 0) {
        if (kmCost >= hrCost) lines.push({ label: "Extra " + exKm + " km × " + inr(n(car.extra_km)), amount: kmCost });
        else lines.push({ label: "Extra " + hm(exMins) + " × " + inr(n(car.extra_hour)) + "/hr", amount: hrCost });
      }
      var start = n(o.start, 9) * 60, garageOut = start - (g ? g.outMin : 0), release = start + useMins + (g ? g.inMin : 0);
      if (garageOut < 6 * 60) lines.push({ label: "Driver charge, before 6 am", amount: n(rates.early_before_6am) });
      if (release > 23 * 60) lines.push({ label: "Driver charge, after 11 pm", amount: n(rates.night_after_11pm) });
      return { total: sum(lines), lines: lines, dutyMins: dutyMins, dutyKm: dutyKm };
    },
    outstation: function (car, rates, o) {
      var pkgH = n(rates.package_hours, 10), pkgK = n(rates.package_km, 100), step = n(rates.time_rounding_minutes, 15) || 15;
      var g = Pricing.garage(rates, o.garage);
      var days = Math.max(1, Math.round(n(o.days, 1))), nights = Math.max(0, Math.round(n(o.nights)));
      var totalKm = Math.ceil(Math.max(0, n(o.km)) + (g ? g.km : 0));
      var kmDay = totalKm / days;
      var dayMins = Pricing.roundUp(Math.max(0, n(o.hoursPerDay, 10)) * 60 + (g ? g.mins / days : 0), step);
      var exKm = Math.max(0, kmDay - pkgK), exMins = Math.max(0, dayMins - pkgH * 60);
      var kmCost = exKm * n(car.extra_km), hrCost = exMins / 60 * n(car.extra_hour);
      var lines = [];
      if (g) lines.push({ info: true, label: "Garage out + in, approx.", value: g.km + " km · " + hm(g.mins) });
      lines.push({ info: true, label: "Trip billed on", value: totalKm + " km over " + days + " day" + (days > 1 ? "s" : "") });
      lines.push({ label: "Package × " + days + " day" + (days > 1 ? "s" : ""), amount: n(car.package_price) * days });
      if (kmCost > 0 || hrCost > 0) {
        if (kmCost >= hrCost) lines.push({ label: "Extra " + Math.round(exKm) + " km/day × " + days, amount: Math.round(kmCost * days) });
        else lines.push({ label: "Extra " + hm(exMins) + "/day × " + days, amount: Math.round(hrCost * days) });
      }
      if (kmDay > n(rates.outstation_km_per_day, 200)) lines.push({ label: "Outstation charge × " + days, amount: n(rates.outstation_charge_per_day) * days });
      if (!o.stayProvided && nights > 0) lines.push({ label: "Driver food & stay × " + nights + " night" + (nights > 1 ? "s" : ""), amount: n(rates.driver_lodging_per_night) * nights });
      return { total: sum(lines), lines: lines, totalKm: totalKm };
    }
  };
  function sum(lines) { return lines.reduce(function (s, l) { return s + (l.amount || 0); }, 0); }

  /* ---------- Routing: road distance/time between pins ----------
     Uses the free OSRM service; if it is unreachable, falls back to straight-line distance × 1.35. */
  function haversine(a, b) {
    var R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(s));
  }
  function route(points, rates) {
    var tf = n(rates.traffic_factor, 2) || 1;
    var fallback = function () {
      var legs = [];
      for (var i = 0; i < points.length - 1; i++) { var km = haversine(points[i], points[i + 1]) * 1.35; legs.push({ km: km, min: km / 22 * 60, approx: true }); }
      return legs;
    };
    var url = "https://router.project-osrm.org/route/v1/driving/" + points.map(function (p) { return p.lng.toFixed(6) + "," + p.lat.toFixed(6); }).join(";") + "?overview=false";
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 8000);
    return fetch(url, ctrl ? { signal: ctrl.signal } : {})
      .then(function (r) { return r.json(); })
      .then(function (d) {
        clearTimeout(timer);
        if (!d.routes || !d.routes[0]) throw new Error("no route");
        return d.routes[0].legs.map(function (l) { return { km: l.distance / 1000, min: l.duration / 60 * tf }; });
      })
      .catch(function () { clearTimeout(timer); return fallback(); });
  }

  /* ---------- Shared pieces ---------- */
  var ICON = {
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>'
  };

  var PAGES = [
    ["index.html", "Home"], ["about.html", "About us"], ["fleet.html", "Fleet & rates"],
    ["corporate.html", "Corporate"], ["estimate.html", "Estimate a trip"], ["contact.html", "Contact & booking"]
  ];

  function carArt(car) {
    if (car.photo) return '<img src="' + esc(car.photo) + '" alt="' + esc(car.name) + '" loading="lazy">';
    var mpv = car.shape === "mpv";
    var body = mpv
      ? "M18 70 C18 58 26 52 40 50 L70 30 C76 26 84 24 94 24 L226 24 C238 24 246 30 252 40 L266 54 C280 56 290 62 290 72 L290 82 L18 82 Z"
      : "M16 72 C16 62 24 56 38 54 L78 36 C88 31 98 29 110 29 L190 29 C202 29 212 33 220 40 L240 54 C266 56 286 62 288 72 L288 82 L16 82 Z";
    var glass = mpv
      ? "M78 48 L96 32 L150 32 L150 48 Z M158 32 L222 32 C232 32 238 36 242 44 L244 48 L158 48 Z"
      : "M88 52 L110 38 L152 38 L152 52 Z M160 38 L190 38 C200 38 206 41 212 46 L218 52 L160 52 Z";
    return '<svg viewBox="0 0 304 104" role="img" aria-label="' + esc(car.category || "Car") + ' illustration">' +
      '<path class="body" d="' + body + '"/><path class="glass" d="' + glass + '"/>' +
      '<rect class="stripe" x="40" y="62" width="230" height="4" rx="2"/>' +
      '<circle class="wheel" cx="74" cy="82" r="18"/><circle class="hub" cx="74" cy="82" r="7"/>' +
      '<circle class="wheel" cx="232" cy="82" r="18"/><circle class="hub" cx="232" cy="82" r="7"/></svg>';
  }

  function header(site) {
    var here = (location.pathname.split("/").pop() || "index.html");
    var links = PAGES.map(function (p) { return '<a href="' + p[0] + '"' + (p[0] === here ? ' aria-current="page"' : "") + ">" + p[1] + "</a>"; }).join("");
    return '<div class="wrap">' +
      '<a class="brand" href="index.html" aria-label="' + esc(site.business_name) + ' home">' +
      '<img class="logo-dark" src="assets/logo.png" alt="' + esc(site.business_name) + '" width="170" height="44">' +
      '<img class="logo-light" src="assets/logo-light.png" alt="" width="170" height="44"></a>' +
      '<button class="menu-btn" type="button" aria-expanded="false" aria-controls="site-nav">Menu</button>' +
      '<nav class="nav" id="site-nav" aria-label="Main">' + links + "</nav>" +
      '<div class="header-call"><a class="btn btn-primary btn-sm" href="tel:' + digits(site.phone_primary) + '">' + ICON.phone + esc(site.phone_primary) + "</a></div></div>";
  }

  function footer(site) {
    return '<div class="wrap">' +
      "<div><h3>" + esc(site.business_name) + "</h3>" + (site.tagline ? '<p class="foot-tag">' + esc(site.tagline) + "</p>" : "") + "<p>" + esc(site.address) + '</p><p style="margin-top:8px">' + esc(site.hours) + "</p></div>" +
      "<div><h3>Talk to us</h3><ul>" +
      '<li><a href="tel:' + digits(site.phone_primary) + '">' + esc(site.phone_primary) + "</a></li>" +
      '<li><a href="tel:' + digits(site.phone_landline) + '">' + esc(site.phone_landline) + "</a></li>" +
      '<li><a href="' + waLink(site) + '" target="_blank" rel="noopener">WhatsApp ' + esc(site.whatsapp) + "</a></li>" +
      '<li><a href="mailto:' + esc(site.email) + '">' + esc(site.email) + "</a></li></ul></div>" +
      "<div><h3>Pages</h3><ul>" + PAGES.map(function (p) { return '<li><a href="' + p[0] + '">' + p[1] + "</a></li>"; }).join("") + "</ul></div>" +
      '<div class="legal"><span>© ' + new Date().getFullYear() + " " + esc(site.business_name) + "</span><span>GSTIN " + esc(site.gstin) + "</span><span>Udyam " + esc(site.msme) + '</span><span>Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors</span></div></div>';
  }

  function bindText(site) {
    document.querySelectorAll("[data-site]").forEach(function (el) {
      var k = el.getAttribute("data-site"), v = site[k];
      if (v == null || v === "") return;
      if (el.tagName === "A") {
        if (k === "whatsapp") el.href = waLink(site, "Hello, I'd like to book a cab.");
        else if (k === "email") el.href = "mailto:" + v;
        else if (k === "map_link") { el.href = v; return; }
        else el.href = "tel:" + digits(v);
      }
      el.textContent = v;
    });
  }

  /* ---------- Motion ---------- */
  function heroIntro() {
    var sw = document.querySelectorAll(".swoosh path");
    sw.forEach(function (p) { var L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = hasGSAP() ? L : 0; });
    if (!hasGSAP()) return;
    var tl = gsap.timeline({ defaults: { ease: "power3.out" } });
    var lines = document.querySelectorAll(".hero h1 .line > span");
    if (lines.length) tl.from(lines, { yPercent: 110, duration: 0.9, stagger: 0.09 });
    var ph = document.querySelector(".page-hero h1");
    if (ph) tl.from(ph, { y: 30, opacity: 0, duration: 0.8 }, 0);
    tl.to(sw, { strokeDashoffset: 0, duration: 1.6, ease: "power2.inOut", stagger: 0.15 }, 0.1);
    var slip = document.querySelector(".slip");
    if (slip) tl.from(slip, { y: 40, rotate: -2, opacity: 0, duration: 0.9 }, 0.35);
    var extra = document.querySelectorAll(".hero .lede, .hero-actions, .hero-facts, .page-hero .lede");
    if (extra.length) tl.from(extra, { y: 16, opacity: 0, duration: 0.6, stagger: 0.08 }, 0.4);
  }

  function dutyLine() {
    var bar = document.querySelector(".duty-line i");
    if (!bar || !hasGSAP() || typeof ScrollTrigger === "undefined") return;
    gsap.registerPlugin(ScrollTrigger);
    var vertical = window.matchMedia("(max-width: 860px)").matches;
    gsap.fromTo(bar, vertical ? { scaleY: 0, scaleX: 1 } : { scaleX: 0 }, { scaleX: 1, scaleY: 1, ease: "none", scrollTrigger: { trigger: ".duty-track", start: "top 75%", end: "bottom 55%", scrub: 0.6 } });
    document.querySelectorAll(".duty-step .dot").forEach(function (d) {
      gsap.fromTo(d, { backgroundColor: "#000478" }, { backgroundColor: "#fe005b", scrollTrigger: { trigger: d, start: "top 62%", toggleActions: "play none none reverse" }, duration: 0.3 });
    });
  }

  function rollTo(el, value) {
    if (!el) return;
    var from = n(el.getAttribute("data-value"), 0);
    el.setAttribute("data-value", value);
    if (!hasGSAP()) { el.textContent = inr(value); return; }
    var o = { v: from };
    gsap.to(o, { v: value, duration: 0.6, ease: "power2.out", overwrite: true, onUpdate: function () { el.textContent = inr(o.v); } });
  }

  /* ---------- Google place suggestions (via /.netlify/functions/places, key stays server-side) ---------- */
  var placesOff = false;
  function newSession() { return (Date.now().toString(36) + Math.random().toString(36).slice(2, 12)).replace(/[^a-z0-9]/g, ""); }
  function PlaceSuggest(input, onPick) {
    if (!input || input.dataset.suggest) return;
    input.dataset.suggest = "1";
    input.setAttribute("autocomplete", "off");
    var host = input.parentNode; host.classList.add("ps-host");
    var listId = (input.id || "ps") + "-suggest";
    var box = document.createElement("div"); box.className = "place-suggest"; box.hidden = true;
    box.innerHTML = '<ul role="listbox" id="' + listId + '"></ul><p class="ps-credit">Suggestions by Google</p>';
    host.appendChild(box);
    var ul = box.querySelector("ul");
    input.setAttribute("role", "combobox"); input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-controls", listId); input.setAttribute("aria-expanded", "false");
    var session = newSession(), timer = 0, ctl = null, items = [], active = -1, lastQ = "";
    function close() { box.hidden = true; input.setAttribute("aria-expanded", "false"); active = -1; input.removeAttribute("aria-activedescendant"); }
    function mark(i) {
      active = i;
      ul.querySelectorAll("li").forEach(function (li, j) { li.setAttribute("aria-selected", j === i ? "true" : "false"); });
      if (i >= 0) { input.setAttribute("aria-activedescendant", listId + "-" + i); var li = ul.children[i]; if (li && li.scrollIntoView) li.scrollIntoView({ block: "nearest" }); }
    }
    function render() {
      if (!items.length) { close(); return; }
      ul.innerHTML = items.map(function (it, i) {
        return '<li role="option" id="' + listId + "-" + i + '" aria-selected="false" data-i="' + i + '"><span class="ps-pin" aria-hidden="true"></span><span class="ps-text"><b>' + esc(it.main) + "</b>" +
          (it.secondary ? "<small>" + esc(it.secondary) + "</small>" : "") + "</span>" + (it.km != null ? '<span class="ps-km">' + (it.km < 10 ? it.km : Math.round(it.km)) + " km</span>" : "") + "</li>";
      }).join("");
      box.hidden = false; input.setAttribute("aria-expanded", "true"); active = -1;
    }
    function lookup(q) {
      if (ctl) ctl.abort();
      ctl = window.AbortController ? new AbortController() : null;
      fetch("/.netlify/functions/places?q=" + encodeURIComponent(q) + "&s=" + session, ctl ? { signal: ctl.signal } : {})
        .then(function (r) { if (!r.ok && r.status !== 502) throw new Error("off"); return r.json(); })
        .then(function (d) {
          if (d.configured === false) { placesOff = true; close(); return; }
          if (q !== lastQ) return;
          items = d.suggestions || []; render();
        })
        .catch(function (e) { if (e && e.name === "AbortError") return; placesOff = true; close(); });
    }
    function pick(i) {
      var it = items[i]; if (!it) return;
      input.value = it.secondary ? it.main + ", " + it.secondary : it.text || it.main;
      close(); items = [];
      var s = session; session = newSession();
      fetch("/.netlify/functions/places?id=" + encodeURIComponent(it.id) + "&s=" + s)
        .then(function (r) { return r.json(); })
        .then(function (d) { if (d && isFinite(d.lat) && isFinite(d.lng)) onPick({ lat: +d.lat, lng: +d.lng, name: it.main, address: d.address || input.value }); })
        .catch(function () {});
    }
    input.addEventListener("input", function () {
      if (placesOff) return;
      var q = input.value.trim(); lastQ = q;
      clearTimeout(timer);
      if (q.length < 3) { items = []; close(); return; }
      timer = setTimeout(function () { lookup(q); }, 220);
    });
    input.addEventListener("keydown", function (e) {
      if (box.hidden || !items.length) return;
      if (e.key === "ArrowDown") { e.preventDefault(); mark((active + 1) % items.length); }
      else if (e.key === "ArrowUp") { e.preventDefault(); mark(active <= 0 ? items.length - 1 : active - 1); }
      else if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); pick(active >= 0 ? active : 0); }
      else if (e.key === "Escape") { close(); }
    });
    ul.addEventListener("mousedown", function (e) { e.preventDefault(); });
    ul.addEventListener("click", function (e) { var li = e.target.closest("li"); if (li) pick(+li.getAttribute("data-i")); });
    input.addEventListener("blur", function () { setTimeout(close, 150); });
    input.addEventListener("focus", function () { if (items.length && input.value.trim() === lastQ) render(); });
  }

  /* ---------- Map (Leaflet + OpenStreetMap) ---------- */
  var QUICK_PLACES = [
    { name: "Kolkata Airport", lat: 22.6547, lng: 88.4467 },
    { name: "Howrah Station", lat: 22.5834, lng: 88.3404 },
    { name: "Sealdah Station", lat: 22.5675, lng: 88.3702 },
    { name: "Salt Lake Sector V", lat: 22.5726, lng: 88.4313 }
  ];
  function MapPicker(el, rates, onChange) {
    var self = this;
    this.el = el;
    this.dropWord = "Drop";
    this.pts = { pickup: null, drop: null };
    this.mode = "pickup";
    this.office = { lat: n(rates.office_lat, 22.5133), lng: n(rates.office_lng, 88.3919) };
    el.innerHTML =
      '<div class="map-tools">' +
        '<div class="seg seg-sm" role="group" aria-label="Which pin to place">' +
          '<button type="button" data-mode="pickup" aria-pressed="true"><i class="pin-dot p"></i>Pickup</button>' +
          '<button type="button" data-mode="drop" aria-pressed="false"><i class="pin-dot d"></i><span class="drop-word">Drop</span></button></div>' +
        '<button type="button" class="btn btn-ghost btn-sm map-locate">Use my location</button></div>' +
      '<form class="map-search" role="search"><label class="sr-only" for="' + el.id + '-q">Search a place</label>' +
        '<input id="' + el.id + '-q" type="search" placeholder="Search an area or landmark, e.g. Salt Lake Sector V" autocomplete="off">' +
        '<button class="btn btn-primary btn-sm" type="submit">Search</button></form>' +
      '<ul class="map-results" hidden></ul>' +
      '<div class="map-quick" role="group" aria-label="Common places"></div>' +
      '<div class="map-canvas" id="' + el.id + '-canvas" role="application" aria-label="Map: tap to drop a pin"></div>' +
      '<p class="map-status" role="status">Tap the map to drop your pickup pin. Drag a pin to adjust it.</p>';
    this.status = el.querySelector(".map-status");
    if (typeof L === "undefined") { this.status.textContent = "The map could not load. You can still type your kilometres below."; return; }
    var map = this.map = L.map(el.querySelector(".map-canvas"), { scrollWheelZoom: false }).setView([this.office.lat, this.office.lng], 12);
    var tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
    var tileWarned = false;
    tiles.on("tileerror", function () {
      if (tileWarned) return; tileWarned = true;
      el.classList.add("no-tiles");
      self.status.textContent = "Street map couldn't load here. You can still tap to drop pins (J marks our garage), or search a place, or type your kilometres below.";
    });
    var icon = function (cls, txt) { return L.divIcon({ className: "", html: '<span class="map-pin ' + cls + '"><b>' + txt + "</b></span>", iconSize: [34, 34], iconAnchor: [17, 34] }); };
    L.marker([this.office.lat, this.office.lng], { icon: icon("o", "J"), keyboard: false, title: "Our garage, Kasba" }).addTo(map);
    this.markers = {};
    function place(kind, latlng) {
      var p = { lat: latlng.lat, lng: latlng.lng };
      self.pts[kind] = p;
      if (self.markers[kind]) self.markers[kind].setLatLng(latlng);
      else {
        self.markers[kind] = L.marker(latlng, { icon: icon(kind === "pickup" ? "p" : "d", kind === "pickup" ? "P" : "D"), draggable: true }).addTo(map);
        self.markers[kind].on("dragend", function (e) { var ll = e.target.getLatLng(); self.pts[kind] = { lat: ll.lat, lng: ll.lng }; onChange(); });
      }
      if (kind === "pickup" && !self.pts.drop) self.setMode("drop");
      onChange();
    }
    this.place = place;
    map.on("click", function (e) { place(self.mode, e.latlng); });
    el.querySelectorAll("[data-mode]").forEach(function (b) { b.addEventListener("click", function () { self.setMode(b.dataset.mode); }); });
    el.querySelector(".map-locate").addEventListener("click", function () {
      if (!navigator.geolocation) { self.status.textContent = "Location isn't available in this browser. Tap the map instead."; return; }
      self.status.textContent = "Finding your location…";
      navigator.geolocation.getCurrentPosition(function (pos) {
        var ll = L.latLng(pos.coords.latitude, pos.coords.longitude); map.setView(ll, 15); self.setMode("pickup"); place("pickup", ll);
      }, function () { self.status.textContent = "Couldn't get your location. Tap the map or search instead."; }, { timeout: 8000 });
    });
    var results = el.querySelector(".map-results");
    /* Kolkata-area matches first, then matches anywhere in India, merged into one list to choose from.
       Local trips favour nearby places; outstation trips (Digha, Puri, Darjeeling) still find the real town. */
    function nominatim(q, box) {
      var url = "https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=in&accept-language=en&q=" + encodeURIComponent(q) + (box ? "&viewbox=" + box + "&bounded=1" : "&viewbox=85.8,27.3,89.9,21.5");
      return fetch(url).then(function (r) { return r.json(); }).catch(function () { return []; });
    }
    function geocode(q) {
      return Promise.all([nominatim(q, "88.05,22.85,88.65,22.35"), nominatim(q, "")]).then(function (r) {
        var local = r[0], wide = r[1], out = [], seen = {};
        var first = self.dropWord === "Destination" && self.mode === "drop" ? wide.concat(local) : local.concat(wide);
        first.forEach(function (p) { var k = (+p.lat).toFixed(3) + "," + (+p.lon).toFixed(3); if (!seen[k] && out.length < 6) { seen[k] = 1; out.push(p); } });
        return out;
      });
    }
    function showResults(list) {
      if (!list.length) { results.hidden = true; self.status.textContent = "No places found. Try a nearby landmark or tap the map."; return; }
      results.innerHTML = list.map(function (p, i) { return '<li><button type="button" data-i="' + i + '">' + esc(p.display_name) + "</button></li>"; }).join("");
      results.hidden = false; self.status.textContent = "Choose a result to set the " + (self.mode === "pickup" ? "pickup" : self.dropWord.toLowerCase()) + " pin.";
      results.onclick = function (ev) {
        var b = ev.target.closest("button"); if (!b) return;
        var p = list[+b.dataset.i], ll = L.latLng(+p.lat, +p.lon);
        results.hidden = true; map.setView(ll, 15); place(self.mode, ll);
      };
    }
    PlaceSuggest(el.querySelector('input[type="search"]'), function (pl) {
      var ll = L.latLng(pl.lat, pl.lng); results.hidden = true; map.setView(ll, 15);
      var kind = self.mode; place(kind, ll);
      self.status.textContent = (kind === "pickup" ? "Pickup" : self.dropWord) + " set: " + pl.name + ". Drag the pin to fine-tune it.";
    });
    el.querySelector(".map-search").addEventListener("submit", function (e) {
      e.preventDefault();
      var q = el.querySelector('input[type="search"]').value.trim(); if (!q) return;
      results.hidden = true; results.innerHTML = "";
      self.status.textContent = "Searching…";
      geocode(q).then(showResults).catch(function () { self.status.textContent = "Search isn't available right now. Tap the map to drop a pin."; });
    });
    var quick = el.querySelector(".map-quick");
    QUICK_PLACES.forEach(function (qp) {
      var b = document.createElement("button"); b.type = "button"; b.textContent = qp.name;
      b.addEventListener("click", function () { var ll = L.latLng(qp.lat, qp.lng); results.hidden = true; map.setView(ll, 15); place(self.mode, ll); });
      quick.appendChild(b);
    });
  }
  MapPicker.prototype.setMode = function (m) {
    this.mode = m;
    this.el.querySelectorAll("[data-mode]").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.mode === m); });
  };
  MapPicker.prototype.setDropWord = function (w) {
    this.dropWord = w;
    var s = this.el.querySelector(".drop-word"); if (s) s.textContent = w;
  };
  MapPicker.prototype.refresh = function () { if (this.map) this.map.invalidateSize(); };

  /* ---------- Estimator (used in the home hero and on the Estimate page) ---------- */
  function Estimator(root, cars, rates, site, opts) {
    var compact = !!opts.compact, id = opts.id;
    var params = new URLSearchParams(location.search);
    var state = { type: params.get("trip") === "outstation" ? "outstation" : "local", car: 0, legs: null, kmEdited: false, tripEdited: false, routing: false };
    if (params.get("car")) { var ci = cars.findIndex(function (c) { return c.name === params.get("car"); }); if (ci >= 0) state.car = ci; }
    var pkgH = n(rates.package_hours, 10), pkgK = n(rates.package_km, 100);

    function dual(key, label, min, max, step, val, hint) {
      return '<div class="field dual"><label for="' + id + key + '">' + label + "</label>" +
        '<div class="dual-row"><input type="range" id="' + id + key + '-r" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '" aria-label="' + label + ' slider">' +
        '<input type="number" id="' + id + key + '" min="0" step="' + step + '" value="' + val + '" inputmode="decimal"></div>' + (hint ? '<span class="hint" id="' + id + key + '-hint">' + hint + "</span>" : "") + "</div>";
    }
    var times = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
    var timeSel = '<div class="field"><label for="' + id + 'start">Reporting time</label><select id="' + id + 'start">' +
      times.map(function (h) { return '<option value="' + h + '"' + (h === 9 ? " selected" : "") + ">" + ((h % 12) || 12) + ":00 " + (h < 12 ? "am" : "pm") + "</option>"; }).join("") + "</select></div>";

    var mapBlock = compact
      ? '<div class="loc-row"><button type="button" class="loc-btn">' + ICON.pin + '<span><strong class="loc-title">Set pickup &amp; drop on map</strong><small class="loc-sub">Adds the drive from and back to our garage</small></span></button></div>'
      : '<div class="map-wrap" id="' + id + 'map"></div>';

    root.innerHTML =
      '<div class="seg" role="group" aria-label="Trip type"><button type="button" data-type="local">Local duty</button><button type="button" data-type="outstation">Outstation</button></div>' +
      '<div class="field"><span class="field-label">Car</span><div class="' + (compact ? "car-pills" : "car-choice") + '" role="group" aria-label="Car">' +
        cars.map(function (c, i) { return '<button type="button" data-car="' + i + '">' + (compact ? esc(c.name) : "<strong>" + esc(c.name) + "</strong><span>" + n(c.seats) + " seats · from " + inr(n(c.package_price)) + "</span>") + "</button>"; }).join("") + "</div></div>" +
      mapBlock +
      '<div class="est-fields" data-for="local">' +
        (compact ? "" : timeSel) +
        dual("hours", "Hours you need the car", 1, 16, 0.25, pkgH, "Your time with the car. Garage travel is added automatically.") +
        dual("km", "Kilometres you'll travel", 0, 400, 1, pkgK, "Pickup to drop, plus any stops on the way.") +
      "</div>" +
      '<div class="est-fields" data-for="outstation">' +
        (compact ? "" : timeSel.replace(/start/g, "ostart").replace("Reporting time", "Start time")) +
        '<div class="form-grid">' +
          '<div class="field"><label for="' + id + 'days">Days</label><input type="number" id="' + id + 'days" min="1" max="30" value="2" inputmode="numeric"></div>' +
          '<div class="field"><label for="' + id + 'nights">Nights away</label><input type="number" id="' + id + 'nights" min="0" max="30" value="1" inputmode="numeric"></div>' +
        "</div>" +
        dual("trip", "Trip kilometres", 0, 2000, 10, 500, "Pickup to destination and back, plus local running.") +
        (compact ? "" : dual("hpd", "Hours a day", 4, 16, 0.25, pkgH, "")) +
        '<label class="check"><input id="' + id + 'stay" type="checkbox"> We\'ll arrange the driver\'s food and stay</label>' +
      "</div>";

    var res = opts.result;
    res.innerHTML = compact
      ? '<div class="slip-total"><div><small>Estimated fare</small><small class="est-sub"></small></div><div class="odometer" aria-live="polite" data-value="0">₹0</div></div>' +
        '<p class="est-fine">Estimate only. The invoice is charged on actual usage.</p>' +
        '<a class="slip-link" href="estimate.html">See the full breakdown</a>'
      : '<h2 class="est-car">Estimate</h2><div class="odometer" aria-live="polite" data-value="0">₹0</div><dl class="est-lines"></dl>' +
        '<p class="fine">This is an estimate, not a booking. Garage distance and time are approximate, from map routes. The invoice is charged on actual usage, as recorded garage-out to garage-in on the signed duty slip. Tolls, parking, interstate taxes and GST are extra.</p>' +
        '<a class="btn btn-primary est-book" href="contact.html">Book this trip</a>' +
        '<a class="btn btn-ghost est-wa" href="#" target="_blank" rel="noopener" style="margin-top:10px">Send to us on WhatsApp</a>';

    function q(s) { return root.querySelector(s); }
    function val(k) { var e = root.querySelector("#" + id + k); return e ? e.value : ""; }

    /* number box and slider stay in step; typing allows values beyond the slider range */
    root.querySelectorAll(".dual").forEach(function (d) {
      var r = d.querySelector('input[type="range"]'), num = d.querySelector('input[type="number"]');
      r.addEventListener("input", function () { num.value = r.value; mark(num.id); });
      num.addEventListener("input", function () { if (num.value !== "") r.value = num.value; mark(num.id); });
    });
    function mark(fid) { if (fid === id + "km") state.kmEdited = true; if (fid === id + "trip") state.tripEdited = true; }
    function setDual(k, v) { var num = q("#" + id + k), r = q("#" + id + k + "-r"); if (num) num.value = v; if (r) r.value = v; }

    /* map */
    var picker = null, dialog = null;
    function onPins() {
      var p = picker.pts.pickup, d = picker.pts.drop, office = picker.office;
      if (!p) return;
      var pts = state.type === "local" ? [office, p, d || p, office] : (d ? [office, p, d] : [office, p]);
      state.routing = true; picker.status.textContent = "Working out road distance…"; update();
      route(pts, rates).then(function (legs) {
        state.routing = false;
        var approx = legs.some(function (l) { return l.approx; });
        if (state.type === "local") {
          state.legs = { out: legs[0], mid: legs[1], back: legs[2] };
          if (d && !state.kmEdited) setDual("km", Math.ceil(legs[1].km));
        } else {
          state.legs = { out: legs[0], mid: legs[1] || null, back: legs[0] };
          if (legs[1] && !state.tripEdited) setDual("trip", Math.ceil(legs[1].km * 2));
        }
        var L0 = state.legs;
        picker.status.textContent = (approx ? "Approximate (straight-line) distances. " : "") +
          "Garage to pickup ≈ " + Math.round(L0.out.km) + " km, " + hm(L0.out.min) +
          (L0.mid && d ? ". Pickup to " + picker.dropWord.toLowerCase() + " ≈ " + Math.round(L0.mid.km) + " km, " + hm(L0.mid.min) : "") + ".";
        update();
      });
    }
    if (compact) {
      dialog = document.createElement("dialog");
      dialog.className = "map-dialog";
      dialog.setAttribute("aria-label", "Set pickup and drop");
      dialog.innerHTML = '<div class="map-dialog-head"><h2>Pickup &amp; drop</h2><button type="button" class="btn btn-primary btn-sm map-done">Done</button></div><div class="map-wrap" id="' + id + 'map"></div>';
      document.body.appendChild(dialog);
      picker = new MapPicker(dialog.querySelector(".map-wrap"), rates, onPins);
      q(".loc-btn").addEventListener("click", function () { dialog.showModal(); picker.refresh(); });
      dialog.querySelector(".map-done").addEventListener("click", function () { dialog.close(); });
      dialog.addEventListener("click", function (e) { if (e.target === dialog) dialog.close(); });
    } else {
      picker = new MapPicker(q("#" + id + "map"), rates, onPins);
    }

    function update() {
      root.querySelectorAll(".seg button[data-type]").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.type === state.type); });
      root.querySelectorAll("[data-car]").forEach(function (b) { b.setAttribute("aria-pressed", +b.dataset.car === state.car); });
      root.querySelectorAll("[data-for]").forEach(function (el) { el.hidden = el.getAttribute("data-for") !== state.type; });
      picker.setDropWord(state.type === "local" ? "Drop" : "Destination");
      var car = cars[state.car], L0 = state.legs, r, garage = null;
      if (L0) garage = { outKm: L0.out.km, outMin: L0.out.min, inKm: L0.back.km, inMin: L0.back.min };
      if (state.type === "local") r = Pricing.local(car, rates, { hours: val("hours"), km: val("km"), start: val("start") || 9, garage: garage });
      else r = Pricing.outstation(car, rates, { days: val("days"), km: val("trip"), hoursPerDay: val("hpd") || pkgH, nights: val("nights"), stayProvided: (q("#" + id + "stay") || {}).checked, garage: garage });

      rollTo(res.querySelector(".odometer"), r.total);
      var p = picker.pts.pickup, d = picker.pts.drop;
      if (compact) {
        res.querySelector(".est-sub").textContent = state.routing ? "Updating route…" : (garage ? "Includes garage travel, approx." : "Set pins on the map to add garage travel");
        q(".loc-title").textContent = p ? (d ? "Pickup and " + picker.dropWord.toLowerCase() + " set" : "Pickup set") : "Set pickup & drop on map";
        q(".loc-sub").textContent = garage ? "Garage travel ≈ " + Math.ceil(garage.outKm + garage.inKm) + " km, " + hm(garage.outMin + garage.inMin) : "Adds the drive from and back to our garage";
        var link = res.querySelector(".slip-link");
        link.href = "estimate.html?trip=" + state.type + "&car=" + encodeURIComponent(car.name);
      } else {
        res.querySelector(".est-car").textContent = car.name + " · " + (state.type === "local" ? "Local duty" : "Outstation");
        res.querySelector(".est-lines").innerHTML = (garage ? "" : '<div class="est-warn"><dt>Pickup not pinned yet</dt><dd>Garage travel not included</dd></div>') +
          r.lines.map(function (l) { return '<div class="' + (l.info ? "info" : "") + '"><dt>' + esc(l.label) + "</dt><dd>" + (l.info ? esc(l.value) : inr(l.amount)) + "</dd></div>"; }).join("");
        var trip = state.type === "local" ? "local duty, " + val("hours") + " hrs / " + val("km") + " km" : "outstation, " + val("days") + " days / " + val("trip") + " km";
        var msg = "Hello JyotiCab.com, I'd like to book: " + car.name + ", " + trip + ". Website estimate " + inr(r.total) + "." +
          (p ? "\nPickup: " + gmaps(p) : "") + (d ? "\n" + picker.dropWord + ": " + gmaps(d) : "");
        res.querySelector(".est-wa").href = waLink(site, msg);
        res.querySelector(".est-book").href = "contact.html?car=" + encodeURIComponent(car.name) + "&trip=" + state.type + (p ? "&pickup=" + p.lat.toFixed(5) + "," + p.lng.toFixed(5) : "") + (d ? "&drop=" + d.lat.toFixed(5) + "," + d.lng.toFixed(5) : "");
      }
    }

    root.addEventListener("click", function (e) {
      var s = e.target.closest("button[data-type]");
      if (s && s.dataset.type !== state.type) { state.type = s.dataset.type; update(); if (picker.pts.pickup) onPins(); return; }
      var c = e.target.closest("button[data-car]"); if (c) { state.car = +c.dataset.car; update(); }
    });
    root.addEventListener("input", update);
    root.addEventListener("change", update);
    update();
  }

  /* ---------- Page modules ---------- */
  function fleetCards(el, cars, limit) {
    el.innerHTML = cars.slice(0, limit || cars.length).map(function (c) {
      return '<article class="car"><div class="car-art">' + carArt(c) + "</div>" +
        "<div><h3>" + esc(c.name) + '</h3><div class="car-cat">' + esc(c.category) + "</div></div>" +
        '<div class="car-specs"><span>' + n(c.seats) + " seats</span><span>" + n(c.bags) + " bags</span><span>AC</span></div>" +
        (c.best_for ? '<p class="car-cat">' + esc(c.best_for) + "</p>" : "") +
        '<div class="car-price"><span>From</span><strong>' + inr(n(c.package_price)) + "</strong></div></article>";
    }).join("");
  }

  function rateTable(el, cars, rates) {
    el.innerHTML = '<thead><tr><th scope="col">Car</th><th scope="col">Seats</th><th scope="col">Package (' + n(rates.package_hours) + " hrs / " + n(rates.package_km) + ' km)</th><th scope="col">Extra km</th><th scope="col">Extra hour</th></tr></thead><tbody>' +
      cars.map(function (c) { return "<tr><td>" + esc(c.name) + "</td><td>" + n(c.seats) + "</td><td>" + inr(n(c.package_price)) + "</td><td>" + inr(n(c.extra_km)) + "</td><td>" + inr(n(c.extra_hour)) + "</td></tr>"; }).join("") + "</tbody>";
  }

  function fleetExtra(sec, extra, data) {
    if (!sec || !extra.length) return;
    sec.hidden = false;
    var h = sec.querySelector("[data-extra-heading]"), p = sec.querySelector("[data-extra-intro]");
    if (h && data.on_request_heading) h.textContent = data.on_request_heading;
    if (p && data.on_request_intro) p.textContent = data.on_request_intro;
    var cats = [];
    extra.forEach(function (c) { var k = c.category || "Other"; if (cats.indexOf(k) < 0) cats.push(k); });
    var grid = sec.querySelector(".more-grid"), fil = sec.querySelector(".more-filters");
    grid.innerHTML = extra.map(function (c) {
      var b = n(c.bags);
      return '<article class="car car-req" data-cat="' + esc(c.category || "Other") + '"><div class="car-art">' + carArt({ name: c.name, category: c.category, shape: c.shape }) + "</div>" +
        "<div><h3>" + esc(c.name) + '</h3><div class="car-cat">' + esc(c.category || "") + "</div></div>" +
        '<div class="car-specs"><span>' + n(c.seats) + " seats</span>" + (b ? "<span>" + b + " bags</span>" : "") + "<span>AC</span></div>" +
        (c.best_for ? '<p class="car-cat">' + esc(c.best_for) + "</p>" : "") +
        '<div class="car-price"><span>Price</span><strong class="on-req">On request</strong></div>' +
        '<a class="req-link" href="contact.html?car=' + encodeURIComponent(c.name) + '#enquiry">Ask for this car <span aria-hidden="true">&rarr;</span></a></article>';
    }).join("");
    if (fil && cats.length > 1) {
      var count = function (k) { return extra.filter(function (c) { return (c.category || "Other") === k; }).length; };
      fil.hidden = false;
      fil.innerHTML = '<button type="button" aria-pressed="true" data-k="">All <span>' + extra.length + "</span></button>" +
        cats.map(function (k) { return '<button type="button" aria-pressed="false" data-k="' + esc(k) + '">' + esc(k) + " <span>" + count(k) + "</span></button>"; }).join("");
      fil.addEventListener("click", function (e) {
        var b = e.target.closest("button"); if (!b) return;
        fil.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        var k = b.getAttribute("data-k"), shown = [];
        grid.querySelectorAll(".car-req").forEach(function (c) { var on = !k || c.getAttribute("data-cat") === k; c.hidden = !on; if (on) shown.push(c); });
        if (hasGSAP() && !reduced()) gsap.fromTo(shown, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, stagger: 0.03, ease: "power2.out", overwrite: true });
      });
    }
  }

  function enquiryForm(cars, site, extra) {
    var form = document.getElementById("enquiry");
    if (!form) return;
    var sel = form.querySelector("#f-car");
    var opt = function (c) { return '<option value="' + esc(c.name) + '">' + esc(c.name) + " (" + n(c.seats) + " seats)</option>"; };
    sel.innerHTML = '<option value="">Not sure yet</option>' + (extra && extra.length
      ? '<optgroup label="Our fleet">' + cars.map(opt).join("") + '</optgroup><optgroup label="On request">' + extra.map(opt).join("") + "</optgroup>"
      : cars.map(opt).join(""));
    var params = new URLSearchParams(location.search);
    if (params.get("car")) sel.value = params.get("car");
    var t = form.querySelector("#f-trip"); if (t && params.get("trip")) t.value = params.get("trip") === "outstation" ? "Outstation" : "Local duty";
    var pu = form.querySelector("#f-pickup-pin"), dr = form.querySelector("#f-drop-pin");
    var gm = function (pl) { return "https://www.google.com/maps?q=" + pl.lat.toFixed(6) + "," + pl.lng.toFixed(6); };
    PlaceSuggest(form.querySelector("#f-pickup"), function (pl) { if (pu && !params.get("pickup")) pu.value = gm(pl); });
    PlaceSuggest(form.querySelector("#f-drop"), function (pl) { if (dr && !params.get("drop")) dr.value = gm(pl); });
    if (pu && params.get("pickup")) pu.value = "https://www.google.com/maps?q=" + params.get("pickup");
    if (dr && params.get("drop")) dr.value = "https://www.google.com/maps?q=" + params.get("drop");
    var pinNote = form.querySelector(".pin-note"); if (pinNote && params.get("pickup")) pinNote.hidden = false;
    var status = form.querySelector(".form-status");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      var btn = form.querySelector("button[type=submit]");
      btn.disabled = true; btn.textContent = "Sending…";
      var body = new URLSearchParams(new FormData(form)).toString();
      var preview = /claude|localhost|127\.0\.0\.1/.test(location.hostname);
      var send = preview ? Promise.resolve({ ok: true, preview: true }) : fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body });
      send.then(function (r) {
        if (!r.ok) throw new Error();
        status.hidden = false; status.className = "form-status ok";
        status.textContent = r.preview ? "Preview only: on the live site this enquiry is emailed to you." : "Enquiry sent. We'll call you back shortly to confirm the car and timing.";
        form.reset();
      }).catch(function () {
        status.hidden = false; status.className = "form-status err";
        status.textContent = "The enquiry didn't go through. Please call " + site.phone_primary + " or WhatsApp " + site.whatsapp + ".";
      }).finally(function () { btn.disabled = false; btn.textContent = "Send enquiry"; });
    });
  }


  /* ---------- Google reviews ----------
     Live reviews come from /.netlify/functions/google-reviews (Places API, cached daily).
     Reviews added in the admin panel (data/reviews.json) are always shown too. */
  function stars(n) {
    var out = "";
    for (var i = 1; i <= 5; i++) out += '<svg viewBox="0 0 20 20" aria-hidden="true" class="' + (i <= Math.round(n) ? "on" : "off") + '"><path d="M10 1.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.6 7.7l5.8-.8z"/></svg>';
    return '<span class="stars" role="img" aria-label="' + n + ' out of 5 stars">' + out + "</span>";
  }
  function reviewsSection(el, cfg) {
    if (cfg.show_section === false) { el.hidden = true; return; }
    var isPreview = /claude|localhost|127\.0\.0\.1/.test(location.hostname);
    var minStars = n(cfg.min_stars, 5) || 5;
    var live = isPreview ? Promise.resolve(null) : fetch("/.netlify/functions/google-reviews").then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    live.then(function (g) {
      var list = [];
      if (g && g.reviews) list = list.concat(g.reviews);
      (cfg.reviews || []).forEach(function (r) { if (r && r.text) list.push({ author: r.author, stars: n(r.stars, 5), text: r.text, when: r.when || "", source: "site" }); });
      var seen = {};
      list = list.filter(function (r) { var k = (r.author || "") + "|" + String(r.text).slice(0, 40); if (seen[k] || n(r.stars) < minStars || !String(r.text).trim()) return false; seen[k] = 1; return true; });
      if (cfg.sample_notice) { var sn = document.createElement("p"); sn.className = "sample-note"; sn.textContent = cfg.sample_notice; el.querySelector(".wrap").insertBefore(sn, el.querySelector(".wrap").firstChild); }
      var rating = (g && g.rating) || n(cfg.rating, 0), count = (g && g.review_count) || n(cfg.review_count, 0);
      var mapsUrl = cfg.google_maps_url || (g && g.maps_url) || "";
      var writeUrl = cfg.write_review_url || "";

      if (!list.length && !mapsUrl) {
        if (!isPreview) { el.hidden = true; return; }
        el.querySelector(".reviews-track").innerHTML = '<div class="review-empty"><h3>Your Google reviews will appear here</h3><p>Once the site is live and connected to your Google listing, five-star reviews show here automatically. You can also add reviews by hand in the admin panel under Reviews.</p></div>';
        el.querySelector(".reviews-nav").hidden = true;
        return;
      }
      el.querySelector(".reviews-summary").innerHTML = rating ? stars(rating) + ' <strong class="num">' + rating.toFixed(1) + "</strong>" + (count ? ' <span>from ' + count.toLocaleString("en-IN") + " Google reviews</span>" : "") : "";
      var track = el.querySelector(".reviews-track");
      track.innerHTML = list.map(function (r, i) {
        var long = String(r.text).length > 220;
        return '<figure class="review"><div class="review-top">' + stars(r.stars) + (r.source === "google" ? '<span class="g-badge" title="Review from Google">G</span>' : "") + "</div>" +
          '<blockquote id="rv' + i + '"' + (long ? ' class="clamp"' : "") + "><p>" + esc(r.text) + "</p></blockquote>" +
          (long ? '<button type="button" class="more" aria-controls="rv' + i + '" aria-expanded="false">Read more</button>' : "") +
          '<figcaption><span class="avatar" aria-hidden="true">' + esc(String(r.author || "?").trim().charAt(0).toUpperCase()) + "</span><span><strong>" +
          (r.author_url ? '<a href="' + esc(r.author_url) + '" target="_blank" rel="noopener">' + esc(r.author) + "</a>" : esc(r.author || "Customer")) +
          "</strong>" + (r.when ? "<small>" + esc(r.when) + "</small>" : "") + "</span></figcaption></figure>";
      }).join("");
      track.addEventListener("click", function (e) {
        var b = e.target.closest(".more"); if (!b) return;
        var q = document.getElementById(b.getAttribute("aria-controls")), open = q.classList.toggle("clamp") === false;
        b.setAttribute("aria-expanded", open); b.textContent = open ? "Show less" : "Read more";
      });
      var nav = el.querySelector(".reviews-nav");
      if (list.length < 2) nav.hidden = true;
      nav.addEventListener("click", function (e) {
        var b = e.target.closest("button"); if (!b) return;
        var card = track.querySelector(".review"); var step = card ? card.getBoundingClientRect().width + 16 : 320;
        track.scrollBy({ left: b.dataset.dir === "next" ? step : -step, behavior: reduced() ? "auto" : "smooth" });
      });
      var actions = el.querySelector(".reviews-actions");
      actions.innerHTML = (mapsUrl ? '<a class="btn btn-ghost" href="' + esc(mapsUrl) + '" target="_blank" rel="noopener">Read all reviews on Google</a>' : "") +
        (writeUrl ? '<a class="btn btn-primary" href="' + esc(writeUrl) + '" target="_blank" rel="noopener">Write a review</a>' : "");
      if (hasGSAP() && typeof ScrollTrigger !== "undefined") {
        gsap.from(track.querySelectorAll(".review"), { x: 60, opacity: 0, duration: 0.7, stagger: 0.08, ease: "power3.out", scrollTrigger: { trigger: track, start: "top 85%", once: true } });
      }
    });
  }



  /* ---------- Client logo marquee: auto-scrolls, pauses on hover/touch, draggable, arrow buttons ---------- */
  function mqItem(c, showLogos) {
    var logo = showLogos && c.logo;
    return '<li class="mq-item' + (logo ? " has-logo" : "") + '" title="' + esc(c.name) + '">' +
      (logo ? '<img src="' + esc(c.logo) + '" alt="' + esc(c.name) + '" draggable="false">' : "<span>" + esc(c.name) + "</span>") + "</li>";
  }
  function Marquee(row, html, dir, speed) {
    row.innerHTML = '<ul class="mq-track">' + html + html + "</ul>";
    var paused = false, timer = null, pos = 0, dragging = false, startX = 0, startPos = 0;
    var half = function () { return row.scrollWidth / 2; };
    var wrap = function () { var h = half(); if (h <= 0) return; if (pos >= h) pos -= h; if (pos < 0) pos += h; row.scrollLeft = pos; };
    var pause = function () { paused = true; clearTimeout(timer); };
    var resume = function (ms) { clearTimeout(timer); timer = setTimeout(function () { pos = row.scrollLeft; paused = false; }, ms || 1500); };
    requestAnimationFrame(function () { pos = dir < 0 ? half() / 2 : 0; row.scrollLeft = pos; });
    if (!reduced()) {
      (function tick() { if (!paused && !dragging && document.visibilityState !== "hidden") { pos += dir * speed; wrap(); } requestAnimationFrame(tick); })();
    }
    row.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") pause(); });
    row.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse" && !dragging) resume(600); });
    row.addEventListener("focusin", pause);
    row.addEventListener("focusout", function () { resume(); });
    row.addEventListener("touchstart", pause, { passive: true });
    row.addEventListener("touchend", function () { resume(2500); }, { passive: true });
    row.addEventListener("wheel", function () { pause(); resume(2000); }, { passive: true });
    row.addEventListener("scroll", function () { if (paused || dragging) { pos = row.scrollLeft; if (pos >= half() || pos <= 0) wrap(); } }, { passive: true });
    row.addEventListener("pointerdown", function (e) { if (e.pointerType !== "mouse") return; dragging = true; startX = e.clientX; startPos = row.scrollLeft; row.classList.add("dragging"); pause(); });
    window.addEventListener("pointermove", function (e) { if (!dragging) return; pos = startPos - (e.clientX - startX); wrap(); });
    window.addEventListener("pointerup", function () { if (!dragging) return; dragging = false; row.classList.remove("dragging"); resume(1200); });
    return {
      nudge: function (px) {
        pause(); var from = row.scrollLeft, target = from + px, t0 = performance.now();
        (function anim(t) { var k = Math.min(1, (t - t0) / 400), e = 1 - Math.pow(1 - k, 3); pos = from + (target - from) * e; wrap(); if (k < 1) requestAnimationFrame(anim); else resume(2500); })(t0);
      }
    };
  }
  function buildMarquee(host, clients, showLogos) {
    var rows = Math.max(1, +host.getAttribute("data-marquee") || 1);
    var ordered = clients.filter(function (c) { return showLogos && c.logo; }).concat(clients.filter(function (c) { return !(showLogos && c.logo); }));
    var groups = [];
    for (var r = 0; r < rows; r++) groups.push([]);
    ordered.forEach(function (c, i) { groups[i % rows].push(c); });
    host.innerHTML = groups.map(function () { return '<div class="mq-row" tabindex="0" aria-label="Client logos, scrolling. Hover or tap to pause."></div>'; }).join("");
    var ctrls = [];
    host.querySelectorAll(".mq-row").forEach(function (row, i) {
      ctrls.push(Marquee(row, groups[i].map(function (c) { return mqItem(c, showLogos); }).join(""), i % 2 ? -1 : 1, 0.45));
    });
    return ctrls;
  }

  /* ---------- Portfolio: highlights, clients, credentials ---------- */
  function initials(name) {
    var w = String(name || "").replace(/\b(pvt|private|ltd|limited|llp|inc|co)\b\.?/gi, "").trim().split(/\s+/).filter(Boolean);
    return ((w[0] || "?").charAt(0) + (w[1] ? w[1].charAt(0) : "")).toUpperCase();
  }
  function clientTile(c, showLogos) {
    var logo = showLogos && c.logo;
    var meta = [c.sector, c.location].filter(Boolean).map(esc).join(" · ");
    return '<li class="client' + (logo ? " has-logo" : "") + '" data-sector="' + esc(c.sector || "") + '">' +
      '<div class="client-mark">' + (logo ? '<img src="' + esc(c.logo) + '" alt="' + esc(c.name) + ' logo" loading="lazy">' : '<span aria-hidden="true">' + esc(initials(c.name)) + "</span>") + "</div>" +
      '<div class="client-body"><h3>' + esc(c.name) + "</h3>" + (meta ? '<p class="client-meta">' + meta + "</p>" : "") +
      (c.services ? '<p class="client-services">' + esc(c.services) + "</p>" : "") + (c.since ? '<p class="client-since">Client since ' + esc(c.since) + "</p>" : "") + "</div></li>";
  }
  function portfolio(site, cars, cl) {
    var isPreview = /claude|localhost|127\.0\.0\.1/.test(location.hostname);
    var clients = (cl.clients || []).filter(function (c) { return c && c.name; });
    var showClients = cl.show_section !== false;

    var since = document.querySelector("[data-since]");
    if (since && site.founded_year) { since.textContent = "Since " + site.founded_year; since.hidden = false; }

    var hl = document.querySelector("[data-highlights]");
    if (hl) {
      var items = [{ value: String(cars.length), label: cars.length > 12 ? "Car types, from hatchbacks to 45-seater coaches" : "Car types, from sedan to luxury MPV" }];
      if (showClients && clients.length) items.push({ value: String(clients.length), label: clients.length === 1 ? "Corporate client" : "Corporate clients served" });
      items = items.concat(site.highlights || []);
      hl.innerHTML = items.filter(function (h) { return h && h.value; }).map(function (h) {
        return '<div><dt><span class="hl-num">' + esc(h.value) + "</span></dt><dd>" + esc(h.label) + "</dd></div>";
      }).join("");
      if (hasGSAP()) hl.querySelectorAll(".hl-num").forEach(function (el) {
        var v = el.textContent; if (!/^\d+$/.test(v)) return;
        var o = { v: 0 }; gsap.to(o, { v: +v, duration: 1.2, delay: 0.5, ease: "power2.out", onUpdate: function () { el.textContent = Math.round(o.v); } });
      });
    }

    var cr = document.querySelector("[data-credentials]");
    if (cr) cr.innerHTML = (site.credentials || []).map(function (c) { return "<div><h3>" + esc(c.title) + "</h3><p>" + esc(c.detail) + "</p></div>"; }).join("");

    var sec = document.querySelector("[data-clients]");
    if (sec) {
      if (cl.heading) sec.querySelector("[data-clients-heading]").textContent = cl.heading;
      if (cl.intro) sec.querySelector("[data-clients-intro]").textContent = cl.intro;
      var wall = sec.querySelector(".client-wall"), filters = sec.querySelector(".client-filters");
      if (cl.sample_notice && clients.length) { var note = document.createElement("p"); note.className = "sample-note"; note.textContent = cl.sample_notice; sec.querySelector(".wrap").insertBefore(note, sec.querySelector(".wrap").firstChild); }
      if (!showClients || (!clients.length && !isPreview)) sec.hidden = true;
      else if (!clients.length) {
        sec.querySelectorAll(".client-marquee, .mq-bar").forEach(function (x) { x.hidden = true; }); if (sec.querySelector(".client-all")) sec.querySelector(".client-all").hidden = false;
        wall.innerHTML = '<li class="client-empty"><h3>Your client list will appear here</h3><p>Add each company in the admin panel under Client list: name, industry, what you do for them and, with their permission, a logo.</p></li>';
      } else {
        var mqHost = sec.querySelector(".client-marquee");
        if (mqHost) {
          var ctrls = buildMarquee(mqHost, clients, cl.show_logos !== false);
          var mnav = sec.querySelector(".mq-nav");
          if (mnav) mnav.addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; ctrls.forEach(function (c, i) { c.nudge((b.dataset.dir === "next" ? 320 : -320) * (i % 2 ? -1 : 1)); }); });
          var tog = sec.querySelector(".client-toggle"), all = sec.querySelector(".client-all");
          if (tog && all) {
            tog.textContent = "See all " + clients.length + " clients by industry";
            tog.addEventListener("click", function () { var open = all.hidden; all.hidden = !open; tog.setAttribute("aria-expanded", open); tog.textContent = open ? "Hide full list" : "See all " + clients.length + " clients by industry"; if (open && hasGSAP()) gsap.from(all.querySelectorAll(".client"), { y: 16, opacity: 0, duration: 0.45, stagger: 0.025, ease: "power2.out" }); });
          }
        }
        wall.innerHTML = clients.map(function (c) { return clientTile(c, cl.show_logos !== false); }).join("");
        var sectors = [];
        clients.forEach(function (c) { if (c.sector && sectors.indexOf(c.sector) < 0) sectors.push(c.sector); });
        if (sectors.length > 1) {
          filters.hidden = false;
          filters.innerHTML = '<button type="button" aria-pressed="true" data-sector="">All <span>' + clients.length + "</span></button>" + sectors.map(function (s) {
            return '<button type="button" aria-pressed="false" data-sector="' + esc(s) + '">' + esc(s) + " <span>" + clients.filter(function (c) { return c.sector === s; }).length + "</span></button>";
          }).join("");
          filters.addEventListener("click", function (e) {
            var b = e.target.closest("button"); if (!b) return;
            var s = b.getAttribute("data-sector");
            filters.querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", x === b); });
            var shown = [];
            wall.querySelectorAll(".client").forEach(function (t) { var on = !s || t.getAttribute("data-sector") === s; t.hidden = !on; if (on) shown.push(t); });
            if (hasGSAP()) gsap.fromTo(shown, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, stagger: 0.03, ease: "power2.out", overwrite: true });
          });
        }
      }
    }

    var strip = document.querySelector("[data-client-strip]");
    if (strip && showClients && clients.length) {
      strip.hidden = false;
      if (cl.sample_notice) { var sn2 = document.createElement("p"); sn2.className = "sample-note"; sn2.textContent = cl.sample_notice; strip.querySelector(".wrap").insertBefore(sn2, strip.querySelector(".wrap").firstChild); }
      var host = strip.querySelector(".client-marquee"); if (host) buildMarquee(host, clients, cl.show_logos !== false);
    }
  }

  /* ---------- Boot ---------- */
  Promise.all([getJSON("site"), getJSON("fleet"), getJSON("rates"), getJSON("reviews"), getJSON("clients")]).then(function (d) {
    var site = Object.assign({}, FALLBACK.site, d[0]);
    var cars = (d[1] && d[1].cars && d[1].cars.length ? d[1].cars : FALLBACK.fleet.cars).filter(function (c) { return c && c.name; });
    var rates = Object.assign({}, FALLBACK.rates, d[2]);
    var extra = (d[1] && Array.isArray(d[1].on_request) ? d[1].on_request : []).filter(function (c) { return c && c.name; });
    var h = document.querySelector(".site-header"); if (h) h.innerHTML = header(site);
    var f = document.querySelector(".site-footer"); if (f) f.innerHTML = footer(site);
    var btn = document.querySelector(".menu-btn"), nav = document.getElementById("site-nav");
    if (btn) btn.addEventListener("click", function () { var o = nav.classList.toggle("open"); btn.setAttribute("aria-expanded", o); });
    var wa = document.querySelector(".wa-float"); if (wa) wa.href = waLink(site, "Hello JyotiCab.com, I'd like to book a cab.");
    bindText(site);

    var fg = document.querySelector("[data-fleet]"); if (fg) fleetCards(fg, cars, n(fg.getAttribute("data-fleet"), 0) || cars.length);
    fleetExtra(document.querySelector("[data-fleet-extra]"), extra, d[1] || {});
    var rt = document.querySelector("table.rates"); if (rt) rateTable(rt, cars, rates);
    var tl = document.querySelector("[data-terms]"); if (tl) tl.innerHTML = (rates.terms || []).map(function (t) { return "<li><span>" + esc(t) + "</span></li>"; }).join("");
    var ap = document.querySelector("[data-about-points]"); if (ap) ap.innerHTML = (site.about_points || []).map(function (p) { return "<div><h3>" + esc(p.title) + "</h3><p>" + esc(p.text) + "</p></div>"; }).join("");
    var ab = document.querySelector("[data-about-body]"); if (ab && site.about_body) ab.innerHTML = String(site.about_body).split(/\n\s*\n/).map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("");
    document.querySelectorAll("[data-rate]").forEach(function (el) { el.textContent = inr(n(rates[el.getAttribute("data-rate")])); });
    document.querySelectorAll("[data-rate-num]").forEach(function (el) { el.textContent = n(rates[el.getAttribute("data-rate-num")]); });

    var hero = document.getElementById("hero-est");
    if (hero) new Estimator(hero, cars, rates, site, { compact: true, id: "h-", result: document.getElementById("hero-est-result") });
    var full = document.getElementById("calc-form");
    if (full) new Estimator(full, cars, rates, site, { compact: false, id: "c-", result: document.getElementById("calc-result") });
    portfolio(site, cars.concat(extra), d[4] || {});
    var rv = document.querySelector("[data-reviews]"); if (rv) reviewsSection(rv, d[3] || {});
    enquiryForm(cars, site, extra);
    heroIntro();
    dutyLine();
  });

  window.JyotiPricing = Pricing;
})();
