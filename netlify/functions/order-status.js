const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  // CORS (safe even if same-origin)
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  const qrUuid = event.queryStringParameters?.qr_uuid;
  if (!qrUuid) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "qr_uuid required" }) };
  }

  try {
    const { data, error } = await supabase
  .from('orders')
  .select('paid, status')
  .eq('payment_intent_id', qrUuid)
  .single();

if (error || !data) {
  return {
    statusCode: 200,
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ status: 'pending' })
  };
}

return {
  statusCode: 200,
  headers: { 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify({ 
    status: data.paid ? 'paid' : 'pending',
    qr_uuid: qrUuid
  })
};

    // Not found -> pending
    if (error || !data) {
      return { statusCode: 200, headers, body: JSON.stringify({ status: "pending" }) };
    }

    // Normalize status so kiosk comparisons are reliable
    const status = String(data.status || "pending").toLowerCase();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status,                         // "pending" | "paid" | "cashier" | etc (lowercase)
        order_number: data.order_number || null,
        source: data.source || null,
      }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
