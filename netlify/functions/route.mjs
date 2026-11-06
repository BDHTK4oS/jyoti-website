// Road distance and driving time between pins, using Google's Routes API (server-side, key stays private).
//   GET /.netlify/functions/route?pts=lat,lng|lat,lng|lat,lng
//   -> { legs: [ { m: metres, s: seconds }, ... ] }
// Uses the same GOOGLE_PLACES_API_KEY (Routes API enabled on it). Not cached, per Google's terms.

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export default async (req) => {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return json({ configured: false }, 503);
  const raw = (new URL(req.url).searchParams.get("pts") || "").split("|");
  const pts = raw.map((t) => t.split(",").map(Number)).filter((a) => a.length === 2 && a.every(Number.isFinite)
    && Math.abs(a[0]) <= 90 && Math.abs(a[1]) <= 180);
  if (pts.length < 2 || pts.length > 6 || pts.length !== raw.length) return json({ error: "bad points" }, 400);
  const wp = ([lat, lng]) => ({ location: { latLng: { latitude: lat, longitude: lng } } });
  try {
    const r = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "routes.legs.distanceMeters,routes.legs.duration" },
      body: JSON.stringify({
        origin: wp(pts[0]), destination: wp(pts[pts.length - 1]),
        intermediates: pts.slice(1, -1).map(wp),
        travelMode: "DRIVE", routingPreference: "TRAFFIC_UNAWARE", regionCode: "IN", units: "METRIC"
      })
    });
    if (!r.ok) throw new Error(`Google responded ${r.status}`);
    const d = await r.json();
    const legs = (d.routes?.[0]?.legs || []).map((l) => ({ m: l.distanceMeters || 0, s: parseInt(l.duration || "0", 10) }));
    if (legs.length !== pts.length - 1) return json({ error: "no route" }, 404);
    return json({ legs });
  } catch (e) {
    return json({ error: "unavailable" }, 502);
  }
};
