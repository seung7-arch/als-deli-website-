const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY_LIVE);
const { randomUUID } = require("crypto");

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

    // Generate a stable confirmation id you can show to customer + store in metadata
    const qr_uuid = randomUUID();

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

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      payment_method_types: ["card"],

      // Put EVERYTHING the webhook needs right here (small enough to fit metadata)
      metadata: {
        qr_uuid,
        source: (source || "KIOSK").toUpperCase(),
        guest_name: guest_name || "Walk-In",
        // You generally should NOT store full items JSON in Stripe metadata (limits).
        // We'll fetch session line items inside webhook instead.
      },

      success_url: `${origin}/kiosk-success?order=${qr_uuid}`,
      cancel_url: `${origin}/kiosk-cancel?order=${qr_uuid}`,

      payment_intent_data: {
        application_fee_amount: 50,
        transfer_data: {
          destination: process.env.STRIPE_CONNECTED_ACCOUNT_ID,
        },
        metadata: {
          qr_uuid,
          source: (source || "KIOSK").toUpperCase(),
        },
      },
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        checkout_url: session.url,
        session_id: session.id,  // ✅ IMPORTANT: kiosk polls using this
        qr_uuid,                 // ✅ optional: display as confirmation
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
