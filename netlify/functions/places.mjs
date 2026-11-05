// Google place suggestions for the location boxes, called server-side so the API key stays private.
// Uses the same GOOGLE_PLACES_API_KEY as the reviews function (Places API (New)).
//   GET /.netlify/functions/places?q=salt%20lake&s=<session>   -> suggestions
//   GET /.netlify/functions/places?id=<placeId>&s=<session>    -> { lat, lng, name, address }
// A session token ties the typing and the final pick together, so Google bills it as one lookup.

const KASBA = { latitude: 22.5107522, longitude: 88.3945515 };
const json = (body, status = 200, cache = "no-store") =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": cache } });

export default async (req) => {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return json({ configured: false });
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim().slice(0, 100);
  const id = (url.searchParams.get("id") || "").trim();
  const session = (url.searchParams.get("s") || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64) || undefined;

  try {
    if (id) {
      if (!/^[A-Za-z0-9_-]{10,300}$/.test(id)) return json({ error: "bad id" }, 400);
      const r = await fetch(`https://places.googleapis.com/v1/places/${id}?languageCode=en${session ? "&sessionToken=" + session : ""}`, {
        headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": "location,displayName,formattedAddress" }
      });
      if (!r.ok) throw new Error(`Google responded ${r.status}`);
      const p = await r.json();
      return json({
        lat: p.location?.latitude, lng: p.location?.longitude,
        name: p.displayName?.text || "", address: p.formattedAddress || ""
      }, 200, "public, max-age=86400");
    }

    if (q.length < 3) return json({ configured: true, suggestions: [] });
    const r = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key },
      body: JSON.stringify({
        input: q,
        sessionToken: session,
        languageCode: "en",
        includedRegionCodes: ["in"],
        // Prefer places near our Kasba garage, but still find outstation towns
        locationBias: { circle: { center: KASBA, radius: 50000 } },
        origin: KASBA
      })
    });
    if (!r.ok) throw new Error(`Google responded ${r.status}`);
    const d = await r.json();
    const suggestions = (d.suggestions || []).map((s) => s.placePrediction).filter(Boolean).slice(0, 6).map((p) => ({
      id: p.placeId,
      main: p.structuredFormat?.mainText?.text || p.text?.text || "",
      secondary: p.structuredFormat?.secondaryText?.text || "",
      text: p.text?.text || "",
      km: typeof p.distanceMeters === "number" ? Math.round(p.distanceMeters / 100) / 10 : null
    }));
    return json({ configured: true, suggestions }, 200, "public, max-age=3600");
  } catch (e) {
    return json({ configured: true, error: "unavailable" }, 502);
  }
};
