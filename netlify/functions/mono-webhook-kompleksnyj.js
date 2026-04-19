// Netlify Function: вебхук від Monobank після оплати КОМПЛЕКСНОГО курсу
// POST /.netlify/functions/mono-webhook-kompleksnyj
//
// Monobank надсилає POST з invoiceId та status.
// Ми перевіряємо статус, дістаємо email з reference,
// і відправляємо подію в SendPulse (нова подія для комплексного курсу).

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // Токен для комплексного курсу (інший мерчант)
  const MONO_TOKEN = process.env.MONO_TOKEN_KOMPLEKSNYJ || "m3w_nXlpEsN3aoDL5eoQGnA";

  // SendPulse endpoint для комплексного курсу
  const SENDPULSE_EVENT_URL =
    "https://events.sendpulse.com/events/id/42947ebe7ab94459d6e44e93ba9b032e/9397073";

  let webhookData;
  try {
    webhookData = JSON.parse(event.body);
  } catch {
    console.error("Webhook kompleksnyj: invalid JSON body");
    return { statusCode: 400, body: "Invalid JSON" };
  }

  const { invoiceId, status, reference } = webhookData;

  console.log(`Webhook kompleksnyj: invoiceId=${invoiceId}, status=${status}, reference=${reference}`);

  // Обробляємо тільки успішні платежі
  if (status !== "success") {
    console.log(`Webhook kompleksnyj: status=${status}, skipping SendPulse`);
    return { statusCode: 200, body: "OK" };
  }

  // Email зберігається в reference
  let email = reference;

  // Якщо reference порожній — спробуємо дістати зі статусу рахунку
  if (!email) {
    try {
      const statusRes = await fetch(
        `https://api.monobank.ua/api/merchant/invoice/status?invoiceId=${encodeURIComponent(invoiceId)}`,
        { headers: { "X-Token": MONO_TOKEN } }
      );
      const statusData = await statusRes.json();
      email = statusData.reference;
      console.log(`Webhook kompleksnyj: fetched reference from status: ${email}`);
    } catch (err) {
      console.error("Webhook kompleksnyj: failed to fetch invoice status:", err.message);
    }
  }

  if (!email) {
    console.error("Webhook kompleksnyj: no email found, cannot send to SendPulse");
    return { statusCode: 200, body: "OK - no email" };
  }

  // Відправляємо подію в SendPulse
  try {
    const spPayload = {
      email: email,
      phone: "",
      event_data: {
        product_name: "Комплексний курс «Голос на мільйон»",
        invoice_id: invoiceId,
        amount: webhookData.amount ? (webhookData.amount / 100).toFixed(2) : "1999.00",
        currency: "UAH",
        status: "success",
      },
    };

    console.log("Webhook kompleksnyj: sending to SendPulse:", JSON.stringify(spPayload));

    const spRes = await fetch(SENDPULSE_EVENT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(spPayload),
    });

    const spText = await spRes.text();
    console.log(`Webhook kompleksnyj: SendPulse response: ${spRes.status} ${spText}`);

    if (!spRes.ok) {
      console.error("Webhook kompleksnyj: SendPulse error:", spText);
    }
  } catch (err) {
    console.error("Webhook kompleksnyj: SendPulse request failed:", err.message);
  }

  // Завжди відповідаємо 200 для Monobank
  return { statusCode: 200, body: "OK" };
};
