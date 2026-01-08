const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const { qr_uuid } = JSON.parse(event.body || "{}");
  if (!qr_uuid) {
    return { statusCode: 400, body: JSON.stringify({ error: "qr_uuid required" }) };
  }

  try {
    const { error } = await supabase
      .from("orders")
      .update({
        status: "CASHIER",
        paid: false,
      })
      .eq("confirmation_number", qr_uuid);

    if (error) throw error;

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: true }),
    };
  } catch (e) {
    console.error("mark-cashier error:", e);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: e.message }),
    };
  }
};
