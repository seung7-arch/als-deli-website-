const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  const qrUuid = event.queryStringParameters?.qr_uuid;
  if (!qrUuid) {
    return { statusCode: 400, body: JSON.stringify({ error: "qr_uuid required" }) };
  }

  try {
    const { data, error } = await supabase
      .from("orders")
      .select("paid,status,confirmation_number,order_source")
      .eq("confirmation_number", qrUuid)
      .single();

    if (error || !data) {
      return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ status: "pending" }),
      };
    }

    const isPaid =
      data.paid === true || String(data.status || "").toUpperCase() === "PAID";

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        status: isPaid ? "paid" : "pending",
        confirmation_number: data.confirmation_number,
        order_source: data.order_source,
      }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: e.message }),
    };
  }
};
