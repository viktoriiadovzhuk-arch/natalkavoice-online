// Netlify Function: вебхук від Monobank після оплати АПГРЕЙДУ (воронка РАНОК)
// POST /.netlify/functions/mono-ranok-webhook-upgrade
//
// Email лежить у reference (його кладе mono-ranok-create-upgrade.js).
//
// ВАЖЛИВО: SendPulse читає змінні ПЛАСКИМИ полями верхнього рівня.
// Вкладений об'єкт він ігнорує — доходять лише email і phone.

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const MONO_TOKEN = process.env.MONO_TOKEN_RANOK
    || process.env.MONO_TOKEN_KOMPLEKSNYJ
    || "m3w_nXlpEsN3aoDL5eoQGnA";

  // SendPulse endpoint для апгрейду
  const SENDPULSE_EVENT_URL =
    "https://events.sendpulse.com/events/id/1c4fe69cbc1d4154e77a6129f2c389cd/9397073";

  let webhookData;
  try {
    webhookData = JSON.parse(event.body);
  } catch {
    console.error("Webhook ranok-upgrade: invalid JSON body");
    return { statusCode: 400, body: "Invalid JSON" };
  }

  const { invoiceId, status, reference } = webhookData;

  console.log(`Webhook ranok-upgrade: invoiceId=${invoiceId}, status=${status}, reference=${reference}`);

  if (status !== "success") {
    console.log(`Webhook ranok-upgrade: status=${status}, skipping SendPulse`);
    return { statusCode: 200, body: "OK" };
  }

  let email = reference;

  if (!email) {
    try {
      const statusRes = await fetch(
        `https://api.monobank.ua/api/merchant/invoice/status?invoiceId=${encodeURIComponent(invoiceId)}`,
        { headers: { "X-Token": MONO_TOKEN } }
      );
      const statusData = await statusRes.json();
      email = statusData.reference;
      console.log(`Webhook ranok-upgrade: fetched reference from status: ${email}`);
    } catch (err) {
      console.error("Webhook ranok-upgrade: failed to fetch invoice status:", err.message);
    }
  }

  if (!email) {
    console.error("Webhook ranok-upgrade: no email found, cannot send to SendPulse");
    return { statusCode: 200, body: "OK - no email" };
  }

  // ── Дата замовлення у київському часі ──
  let orderDate = "";
  try {
    orderDate = new Intl.DateTimeFormat("uk-UA", {
      timeZone: "Europe/Kyiv",
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    }).format(new Date());
  } catch (err) {
    orderDate = new Date().toISOString();
  }

  const productPrice = webhookData.amount
    ? (webhookData.amount / 100).toFixed(2)
    : "599.00";

  try {
    const spPayload = {
      email: String(email).trim().toLowerCase(),
      phone: "",
      product_name: "Апгрейд до повної версії «Голос на мільйон»",
      product_price: productPrice,
      order_date: orderDate,

      // дубль на випадок, якщо подія налаштована під вкладений об'єкт
      event_data: {
        product_name: "Апгрейд до повної версії «Голос на мільйон»",
        product_price: productPrice,
        order_date: orderDate,
        invoice_id: invoiceId,
        currency: "UAH",
        status: "success",
        source: "ranok",
      },
    };

    console.log("Webhook ranok-upgrade: sending to SendPulse:", JSON.stringify(spPayload));

    const spRes = await fetch(SENDPULSE_EVENT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(spPayload),
    });

    const spText = await spRes.text();
    console.log(`Webhook ranok-upgrade: SendPulse response: ${spRes.status} ${spText}`);

    if (!spRes.ok) {
      console.error("Webhook ranok-upgrade: SendPulse error:", spText);
    }
  } catch (err) {
    console.error("Webhook ranok-upgrade: SendPulse request failed:", err.message);
  }

  return { statusCode: 200, body: "OK" };
};
