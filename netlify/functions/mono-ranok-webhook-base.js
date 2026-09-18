// Netlify Function: вебхук від Monobank після оплати БАЗОВОГО курсу (воронка РАНОК)
// POST /.netlify/functions/mono-ranok-webhook-base
//
// Monobank надсилає POST з invoiceId та status.
// Email лежить у reference (його кладе mono-ranok-create.js).

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const MONO_TOKEN = process.env.MONO_TOKEN_RANOK
    || process.env.MONO_TOKEN_KOMPLEKSNYJ
    || "m3w_nXlpEsN3aoDL5eoQGnA";

  // SendPulse endpoint для базового курсу 799
  const SENDPULSE_EVENT_URL =
    "https://events.sendpulse.com/events/id/26811d16d947443db09f182b0ac753c0/9397073";

  let webhookData;
  try {
    webhookData = JSON.parse(event.body);
  } catch {
    console.error("Webhook ranok-base: invalid JSON body");
    return { statusCode: 400, body: "Invalid JSON" };
  }

  const { invoiceId, status, reference } = webhookData;

  console.log(`Webhook ranok-base: invoiceId=${invoiceId}, status=${status}, reference=${reference}`);

  if (status !== "success") {
    console.log(`Webhook ranok-base: status=${status}, skipping SendPulse`);
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
      console.log(`Webhook ranok-base: fetched reference from status: ${email}`);
    } catch (err) {
      console.error("Webhook ranok-base: failed to fetch invoice status:", err.message);
    }
  }

  if (!email) {
    console.error("Webhook ranok-base: no email found, cannot send to SendPulse");
    return { statusCode: 200, body: "OK - no email" };
  }

  try {
    const spPayload = {
      email: email,
      phone: "",
      event_data: {
        product_name: "Базовий курс «Голос на мільйон»",
        invoice_id: invoiceId,
        amount: webhookData.amount ? (webhookData.amount / 100).toFixed(2) : "799.00",
        currency: "UAH",
        status: "success",
        source: "ranok",
      },
    };

    console.log("Webhook ranok-base: sending to SendPulse:", JSON.stringify(spPayload));

    const spRes = await fetch(SENDPULSE_EVENT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(spPayload),
    });

    const spText = await spRes.text();
    console.log(`Webhook ranok-base: SendPulse response: ${spRes.status} ${spText}`);

    if (!spRes.ok) {
      console.error("Webhook ranok-base: SendPulse error:", spText);
    }
  } catch (err) {
    console.error("Webhook ranok-base: SendPulse request failed:", err.message);
  }

  return { statusCode: 200, body: "OK" };
};
