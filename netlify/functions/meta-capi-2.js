// Netlify Function: Meta Conversions API (CAPI) — Pixel #2
// POST /.netlify/functions/meta-capi-2
//
// Другий піксель для курсу «Голос на мільйон» базовий

const crypto = require("crypto");

const PIXEL_ID = "1280801630257821";
const ACCESS_TOKEN =
  "EAAI9oZBnhCM4BReliZBGUOEjdhNqJGJJQt8oAr4dNhGJqkG13BEojeQcNzAcJHvmCcForp9cunh1S0pwpvuZAZBjApuRyIoZAZAJwlTxfJ28CGm151ezMQZB8tFzoo2QfHsNNMNw70ogLFd1flm56yJA741lHx5hdtoI8ZAXMQPrgeaq9UCbG4KD96RrgSlcLgZDZD";

function sha256(value) {
  if (!value) return null;
  return crypto
    .createHash("sha256")
    .update(value.trim().toLowerCase())
    .digest("hex");
}

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const {
    event_name,
    event_id,
    email,
    phone,
    value,
    currency,
    source_url,
    user_agent,
    fbc,
    fbp,
  } = body;

  if (!event_name) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "event_name required" }) };
  }

  const user_data = {};
  if (email) user_data.em = [sha256(email)];
  if (phone) user_data.ph = [sha256(phone)];
  if (fbc) user_data.fbc = fbc;
  if (fbp) user_data.fbp = fbp;
  if (user_agent) user_data.client_user_agent = user_agent;

  const clientIp =
    event.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    event.headers["client-ip"] ||
    null;
  if (clientIp) user_data.client_ip_address = clientIp;

  const eventData = {
    event_name: event_name,
    event_time: Math.floor(Date.now() / 1000),
    action_source: "website",
    user_data: user_data,
  };

  if (event_id) eventData.event_id = event_id;
  if (source_url) eventData.event_source_url = source_url;

  if (value || currency) {
    eventData.custom_data = {};
    if (currency) eventData.custom_data.currency = currency;
    if (value) eventData.custom_data.value = String(value);
  }

  const payload = { data: [eventData] };

  console.log("Meta CAPI-2 sending:", JSON.stringify(payload));

  try {
    const url = `https://graph.facebook.com/v21.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await res.json();
    console.log("Meta CAPI-2 response:", JSON.stringify(result));

    return {
      statusCode: res.ok ? 200 : res.status,
      headers,
      body: JSON.stringify(res.ok
        ? { success: true, events_received: result.events_received }
        : { error: "Meta API error", details: result }),
    };
  } catch (err) {
    console.error("Meta CAPI-2 failed:", err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Server error", message: err.message }),
    };
  }
};
