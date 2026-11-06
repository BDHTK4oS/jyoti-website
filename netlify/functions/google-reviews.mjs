// Live Google reviews for the website, fetched server-side so the API key stays private.
// Needs two environment variables in Netlify (Site configuration > Environment variables):
//   GOOGLE_PLACES_API_KEY  – a Places API (New) key from Google Cloud
//   GOOGLE_PLACE_ID        – the Place ID of the Jyoti Cab Rental Google listing
// Not cached: Google's terms don't allow storing Places content. The page only asks when the reviews section scrolls into view.

export default async () => {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;
  const headers = { "Content-Type": "application/json" };
  if (!key || !placeId) {
    return new Response(JSON.stringify({ configured: false }), { status: 200, headers: { ...headers, "Cache-Control": "no-store" } });
  }
  try {
    const r = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      headers: {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "rating,userRatingCount,googleMapsUri,reviews"
      }
    });
    if (!r.ok) throw new Error(`Google responded ${r.status}`);
    const p = await r.json();
    const reviews = (p.reviews || []).map((v) => ({
      author: v.authorAttribution?.displayName || "Google user",
      author_url: v.authorAttribution?.uri || "",
      photo: v.authorAttribution?.photoUri || "",
      stars: v.rating || 0,
      text: v.originalText?.text || v.text?.text || "",
      when: v.relativePublishTimeDescription || "",
      source: "google"
    }));
    return new Response(JSON.stringify({
      configured: true,
      rating: p.rating || null,
      review_count: p.userRatingCount || null,
      maps_url: p.googleMapsUri || "",
      reviews
    }), {
      status: 200,
      headers: { ...headers, "Cache-Control": "no-store" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ configured: true, error: String(e.message || e) }), { status: 502, headers: { ...headers, "Cache-Control": "no-store" } });
  }
};
