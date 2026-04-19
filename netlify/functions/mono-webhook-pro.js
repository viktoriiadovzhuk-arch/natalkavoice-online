// Netlify Function: вебхук від Monobank після оплати PRO
// POST /.netlify/functions/mono-webhook-pro
//
// Ідентичний до mono-webhook, але відправляє подію purchase_1
// на інший SendPulse endpoint (для PRO-блоку).

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const MONO_TOKEN = process.env.MONO_TOKEN || "mmxgPCuhuk3xWuKoPwJK7OA";

  // SendPulse endpoint для PRO
  const SENDPULSE_EVENT_URL =
    "https://events.sendpulse.com/events/id/1c4fe69cbc1d4154e77a6129f2c389cd/9397073";

  let webhookData;
  try {
    webhookData = JSON.parse(event.body);
  } catch {
    console.error("Webhook PRO: invalid JSON body");
    return { statusCode: 400, body: "Invalid JSON" };
  }

  const { invoiceId, status, reference } = webhookData;

  console.log(`Webhook PRO received: invoiceId=${invoiceId}, status=${status}, reference=${reference}`);

  if (status !== "success") {
    console.log(`Webhook PRO: status=${status}, skipping SendPulse`);
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
      console.log(`Webhook PRO: fetched reference from status: ${email}`);
    } catch (err) {
      console.error("Webhook PRO: failed to fetch invoice status:", err.message);
    }
  }

  if (!email) {
    console.error("Webhook PRO: no email found, cannot send to SendPulse");
    return { statusCode: 200, body: "OK - no email" };
  }

  try {
    const spPayload = {
      email: email,
      phone: "",
      event_data: {
        product_name: "Спеціальна пропозиція PRO",
        invoice_id: invoiceId,
        amount: webhookData.amount ? (webhookData.amount / 100).toFixed(2) : "349.00",
        currency: "UAH",
        status: "success",
      },
    };

    console.log("Webhook PRO: sending to SendPulse:", JSON.stringify(spPayload));

    const spRes = await fetch(SENDPULSE_EVENT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(spPayload),
    });

    const spText = await spRes.text();
    console.log(`Webhook PRO: SendPulse response: ${spRes.status} ${spText}`);
  } catch (err) {
    console.error("Webhook PRO: SendPulse request failed:", err.message);
  }

  return { statusCode: 200, body: "OK" };
};
