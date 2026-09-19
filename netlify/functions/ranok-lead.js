// Netlify Function: лід зі сторінки РАНОК (лід-магніт «Ранкова руханка»)
// POST /.netlify/functions/ranok-lead
//
// Викликається зі сторінки /ranok у момент, коли людина ввела пошту
// і натиснула «Відкрити руханку».
//
// Тіло запиту: { email, promo, expires_at, source }
// Відправляє подію в SendPulse — звідти стартує бот з відео і прогрівом.

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  // SendPulse endpoint для ліда з ранкової руханки
  const SENDPULSE_EVENT_URL =
    "https://events.sendpulse.com/events/id/626b9e27f31a4df5d6a9e3ccd5ea9498/9397073";

  let data;
  try {
    data = JSON.parse(event.body || "{}");
  } catch {
    console.error("ranok-lead: invalid JSON body");
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const email = String(data.email || "").trim().toLowerCase();
  const promo = String(data.promo || "").trim();
  const expiresAt = data.expires_at || "";

  if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(email)) {
    console.error("ranok-lead: bad email:", email);
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Потрібна коректна пошта" }) };
  }

  console.log(`ranok-lead: email=${email} promo=${promo} expires=${expiresAt}`);

  try {
    const spPayload = {
      email: email,
      phone: "",
      event_data: {
        product_name: "Ранкова руханка для голосу",
        promo: promo,
        expires_at: expiresAt,
        source: data.source || "ranok",
      },
    };

    console.log("ranok-lead: sending to SendPulse:", JSON.stringify(spPayload));

    const spRes = await fetch(SENDPULSE_EVENT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(spPayload),
    });

    const spText = await spRes.text();
    console.log(`ranok-lead: SendPulse response: ${spRes.status} ${spText}`);

    if (!spRes.ok) {
      console.error("ranok-lead: SendPulse error:", spText);
    }
  } catch (err) {
    console.error("ranok-lead: SendPulse request failed:", err.message);
  }

  // Сторінка не має чекати на SendPulse — відео відкривається в будь-якому разі.
  return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
};
