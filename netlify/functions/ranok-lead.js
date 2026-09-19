// Netlify Function: лід зі сторінки РАНОК (лід-магніт «Ранкова руханка»)
// POST /.netlify/functions/ranok-lead
//
// Викликається зі сторінки /ranok, коли людина ввела пошту
// і натиснула «Відкрити руханку».
//
// Тіло запиту: { email, promo, expires_at, source }
//
// ВАЖЛИВО ПРО SENDPULSE:
// Змінні події передаються ПЛАСКИМИ полями верхнього рівня.
// Вкладений об'єкт (event_data) SendPulse ігнорує — доходять лише email і phone.
// Тому нижче все кладеться і пласко, і у event_data (про всяк випадок).

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

  if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(email)) {
    console.error("ranok-lead: bad email:", email);
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Потрібна коректна пошта" }) };
  }

  // ── Час згорання промокоду ──────────────────────────────
  // Сторінка шле ISO. Якщо не прислала — рахуємо 24 години від зараз.
  let expires = data.expires_at ? new Date(data.expires_at) : null;
  if (!expires || isNaN(expires.getTime())) {
    expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  }

  // Формати для листів і бота — київський час
  const TZ = "Europe/Kyiv";
  let expiresTime = "";
  let expiresDate = "";
  let expiresLabel = "";

  try {
    expiresTime = new Intl.DateTimeFormat("uk-UA", {
      timeZone: TZ, hour: "2-digit", minute: "2-digit",
    }).format(expires);

    expiresDate = new Intl.DateTimeFormat("uk-UA", {
      timeZone: TZ, day: "numeric", month: "long",
    }).format(expires);

    expiresLabel = `${expiresTime}, ${expiresDate}`;
  } catch (err) {
    console.error("ranok-lead: date format failed:", err.message);
    expiresLabel = expires.toISOString();
  }

  console.log(
    `ranok-lead: email=${email} promo=${promo} expires=${expires.toISOString()} label=${expiresLabel}`
  );

  // ── Відправка в SendPulse ───────────────────────────────
  const spPayload = {
    // те, що SendPulse читає напряму
    email: email,
    phone: "",
    promo: promo,
    expires_at: expires.toISOString(),
    expires_time: expiresTime,      // "21:30"
    expires_date: expiresDate,      // "20 вересня"
    expires_label: expiresLabel,    // "21:30, 20 вересня"
    product_name: "Ранкова руханка для голосу",
    source: data.source || "ranok",

    // дубль на випадок, якщо подія налаштована під вкладений об'єкт
    event_data: {
      promo: promo,
      expires_at: expires.toISOString(),
      expires_time: expiresTime,
      expires_date: expiresDate,
      expires_label: expiresLabel,
      product_name: "Ранкова руханка для голосу",
      source: data.source || "ranok",
    },
  };

  try {
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

  // Сторінка не чекає на SendPulse — відео відкривається в будь-якому разі.
  return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
};
