// Runs automatically on every verified Netlify Forms submission (spam is filtered out first)
// and emails the enquiry to the office inbox through FormSubmit (formsubmit.co).
// The very first email is an activation request: click "Activate Form" in that inbox once.

const TO = process.env.ENQUIRY_EMAIL || "jyoti_travels@yahoo.com";
const SITE = "https://jyoticab.com/";

const LABELS = {
  enquiry_type: "Enquiry type", name: "Name", phone: "Phone", email: "Email", company: "Company",
  trip: "Trip type", car: "Car", date: "Date", time: "Reporting time",
  pickup: "Pickup address", drop: "Drop address", pickup_pin: "Pickup on map", drop_pin: "Drop on map",
  volume: "Cars per month", message: "Notes"
};
const SKIP = new Set(["form-name", "company_website", "ip", "user_agent", "referrer"]);

export const handler = async (event) => {
  try {
    const p = JSON.parse(event.body || "{}").payload || {};
    const d = p.data || {};
    const isCorp = p.form_name === "corporate";
    const fields = {};
    for (const [k, label] of Object.entries(LABELS)) if (d[k]) fields[label] = String(d[k]).slice(0, 1500);
    for (const [k, v] of Object.entries(d)) if (!LABELS[k] && !SKIP.has(k) && v) fields[k] = String(v).slice(0, 1500);
    fields["Received"] = new Date(p.created_at || Date.now()).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

    const who = [d.name, d.phone].filter(Boolean).join(", ");
    const body = {
      ...fields,
      _subject: (isCorp ? "Corporate quote request" : "New booking enquiry") + (who ? " – " + who : "") + " | JyotiCab.com",
      _template: "table",
      _captcha: "false",
      ...(d.email ? { _replyto: d.email } : {})
    };
    const r = await fetch("https://formsubmit.co/ajax/" + encodeURIComponent(TO), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Origin: SITE.slice(0, -1), Referer: SITE },
      body: JSON.stringify(body)
    });
    const text = await r.text();
    console.log("FormSubmit", r.status, text.slice(0, 300));
  } catch (e) {
    console.log("Enquiry email failed:", e.message);
  }
  // Never block the submission itself
  return { statusCode: 200, body: "ok" };
};
