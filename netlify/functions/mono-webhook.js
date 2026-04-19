// Netlify Function: вебхук від Monobank після оплати
// POST /.netlify/functions/mono-webhook
//
// Monobank надсилає POST з invoiceId та status.
// Ми перевіряємо статус, дістаємо email з reference,
// і відправляємо подію purchase в SendPulse.

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const MONO_TOKEN = process.env.MONO_TOKEN || "mmxgPCuhuk3xWuKoPwJK7OA";

  // SendPulse endpoints
  const SENDPULSE_EVENT_URL =
    "https://events.sendpulse.com/events/id/26811d16d947443db09f182b0ac753c0/9397073";

  let webhookData;
  try {
    webhookData = JSON.parse(event.body);
  } catch {
    console.error("Webhook: invalid JSON body");
    return { statusCode: 400, body: "Invalid JSON" };
  }

  const { invoiceId, status, reference } = webhookData;

  console.log(`Webhook received: invoiceId=${invoiceId}, status=${status}, reference=${reference}`);

  // Обробляємо тільки успішні платежі
  if (status !== "success") {
    console.log(`Webhook: status=${status}, skipping SendPulse`);
    return { statusCode: 200, body: "OK" };
  }

  // Email зберігається в reference (ми його туди записали при створенні рахунку)
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
      console.log(`Webhook: fetched reference from status: ${email}`);
    } catch (err) {
      console.error("Webhook: failed to fetch invoice status:", err.message);
    }
  }

  if (!email) {
    console.error("Webhook: no email found, cannot send to SendPulse");
    return { statusCode: 200, body: "OK - no email" };
  }

  // Відправляємо подію в SendPulse
  try {
    const spPayload = {
      email: email,
      phone: "",
      event_data: {
        product_name: "Голос на мільйон",
        invoice_id: invoiceId,
        amount: webhookData.amount ? (webhookData.amount / 100).toFixed(2) : "799.00",
        currency: "UAH",
        status: "success",
      },
    };

    console.log("Webhook: sending to SendPulse:", JSON.stringify(spPayload));

    const spRes = await fetch(SENDPULSE_EVENT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(spPayload),
    });

    const spText = await spRes.text();
    console.log(`Webhook: SendPulse response: ${spRes.status} ${spText}`);

    if (!spRes.ok) {
      console.error("Webhook: SendPulse error:", spText);
    }
  } catch (err) {
    console.error("Webhook: SendPulse request failed:", err.message);
  }

  // Завжди відповідаємо 200 для Monobank
  return { statusCode: 200, body: "OK" };
};
