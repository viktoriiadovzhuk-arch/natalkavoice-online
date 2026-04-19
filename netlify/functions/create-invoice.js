// Netlify Function: створення платежу Monobank
// POST /.netlify/functions/create-invoice

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  const MONO_TOKEN = process.env.MONO_TOKEN || "mmxgPCuhuk3xWuKoPwJK7OA";

  // Визначаємо базовий URL сайту для вебхуку
  const siteUrl = process.env.URL || "https://golosnamillion.netlify.app";

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { amount, description, redirectUrl, email, product } = body;

  if (!amount || !redirectUrl) {
    return { statusCode: 400, body: JSON.stringify({ error: "amount and redirectUrl required" }) };
  }

  if (!email) {
    return { statusCode: 400, body: JSON.stringify({ error: "email is required" }) };
  }

  // Вибираємо вебхук залежно від продукту
  const webhookFunction = product === "pro"
    ? "mono-webhook-pro"
    : "mono-webhook";

  try {
    const response = await fetch("https://api.monobank.ua/api/merchant/invoice/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Token": MONO_TOKEN,
      },
      body: JSON.stringify({
        amount: amount,
        ccy: 980,
        merchantPaymInfo: {
          // Зберігаємо email в reference — повернеться у вебхуку
          reference: email,
          destination: description || "Оплата курсу «Голос на мільйон»",
        },
        redirectUrl: redirectUrl,
        // Monobank надішле POST на відповідний вебхук
        webHookUrl: `${siteUrl}/.netlify/functions/${webhookFunction}`,
        validity: 3600,
        paymentType: "debit",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Monobank error:", JSON.stringify(data));
      return {
        statusCode: response.status,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Monobank API error", details: data }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoiceId: data.invoiceId,
        pageUrl: data.pageUrl,
      }),
    };
  } catch (err) {
    console.error("Server error:", err.message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Server error", message: err.message }),
    };
  }
};
