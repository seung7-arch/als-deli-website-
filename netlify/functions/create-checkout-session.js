const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY_LIVE);
const { randomUUID } = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function calculateStripeFee(amountInCents) {
  return Math.round(amountInCents * 0.029 + 30);
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const { guest_name, items, total, source } = JSON.parse(event.body || "{}");

    if (!Array.isArray(items) || items.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "items required" }) };
    }

    const totalNum = Number(total);
    if (!Number.isFinite(totalNum) || totalNum <= 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "total must be > 0" }) };
    }

    const qr_uuid = randomUUID();

    const orderSummary = items.map((item) => {
      const modText = item.modifiers?.length ? ` (${item.modifiers.join(", ")})` : "";
      const qtyText = item.quantity > 1 ? ` x${item.quantity}` : "";
      return `${item.name}${qtyText}${modText}`;
    }).join("\n");

    // Pre-create Supabase row
    const { error: dbErr } = await supabase.from("orders").insert({
      customer_name: guest_name || "Walk-In",
      items,
      total: totalNum,
      status: "AWAITING_PAYMENT",
      order_source: (source || "KIOSK").toUpperCase(),
      order_summary: orderSummary,
      confirmation_number: qr_uuid,
      paid: false,
      acknowledged: false,
      refunded: false,
      pickup_time: "ASAP",
      created_at: new Date().toISOString(),
    });

    if (dbErr) {
      console.error("Supabase insert error:", dbErr);
      return { statusCode: 500, body: JSON.stringify({ error: "DB insert failed" }) };
    }

    const line_items = items.map((item) => ({
      price_data: {
        currency: "usd",
        product_data: {
          name: String(item.name || "Item"),
          description: item.modifiers?.length ? item.modifiers.join(", ") : undefined,
        },
        unit_amount: Math.round(Number(item.price) * 100),
      },
      quantity: item.quantity || 1,
    }));

    const origin = event.headers.origin || "https://alscarryout.com";
    const totalInCents = Math.round(totalNum * 100);
    const platformFee = 50;
    const stripeFee = calculateStripeFee(totalInCents);
    const transferAmount = totalInCents - platformFee - stripeFee;

   const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      automatic_payment_methods: { enabled: true }, // <--- ADD THIS BLOCK
      metadata: {
        qr_uuid,
        source: (source || "KIOSK").toUpperCase(),
        guest_name: guest_name || "Walk-In",
      },
      success_url: `${origin}/kiosk-success?order=${qr_uuid}`,
      cancel_url: `${origin}/kiosk-cancel?order=${qr_uuid}`,
    payment_intent_data: {
        application_fee_amount: platformFee,
        transfer_data: {
          destination: process.env.STRIPE_CONNECTED_ACCOUNT_ID,
          amount: transferAmount, // <--- ADD THIS LINE
        },
        metadata: {
          qr_uuid,
          source: (source || "KIOSK").toUpperCase(),
        },
      },
    });

    // Store payment_intent_id
    await supabase
      .from("orders")
      .update({ payment_intent_id: session.payment_intent || null })
      .eq("confirmation_number", qr_uuid);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        checkout_url: session.url,
        session_id: session.id,
        qr_uuid,
      }),
    };
  } catch (e) {
    console.error("create-checkout-session error:", e);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Failed to create checkout session", message: e.message }),
    };
  }
};
