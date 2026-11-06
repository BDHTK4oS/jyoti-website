// Hands the Google Maps *browser* key to the page. The key is public by design (Google locks it to
// jyoticab.com), but it lives in a Netlify environment variable so it isn't stored in the website files.
export default async () => {
  const key = process.env.GOOGLE_MAPS_BROWSER_KEY || "";
  return new Response(JSON.stringify({ key }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" }
  });
};
