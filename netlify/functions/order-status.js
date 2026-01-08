const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY_LIVE);
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  try {
    const qs = event.queryStringParameters || {};
    const sessionId = qs.session_id;
    const qrUuid = qs.qr_uuid;

    // 1) NEW KIOSK FLOW: Check Stripe Checkout Session by session_id
    // This works even if NO Supabase row exists yet.
    if (sessionId) {
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      // payment_status: 'paid' | 'unpaid' | 'no_payment_required'
      const paid = session.payment_status === "paid";

      return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({
          status: paid ? "paid" : "pending",
          paid,
          session_id: sessionId,
          payment_status: session.payment_status,
          // helpful for your UI/debugging:
          amount_total: session.amount_total ? session.amount_total / 100 : null,
          currency: session.currency || "usd",
        }),
      };
    }

    // 2) BACKWARDS COMPAT: Old flow checks Supabase by qr_uuid (confirmation_number)
    if (!qrUuid) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "session_id or qr_uuid required" }),
      };
    }

    const { data, error } = await supabase
      .from("orders")
      .select("paid,status,confirmation_number,order_source")
      .eq("confirmation_number", qrUuid)
      .single();

    if (error || !data) {
      return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ status: "pending", paid: false }),
      };
    }

    const isPaid =
      data.paid === true || String(data.status || "").toUpperCase() === "PAID";

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        status: isPaid ? "paid" : "pending",
        paid: isPaid,
        confirmation_number: data.confirmation_number,
        order_source: data.order_source,
      }),
    };
  } catch (e) {
    console.error("order-status error:", e);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: e.message }),
    };
  }
};
