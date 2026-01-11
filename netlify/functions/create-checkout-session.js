const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY_LIVE);
const { randomUUID } = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method Not Allowed" }) };
  }

  try {
    const { guest_name, items, source } = JSON.parse(event.body || "{}");

    if (!Array.isArray(items) || items.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "items required" }) };
    }

    // 1. Calculate Subtotal
    let subtotalCents = 0;
   const line_items = items.map((item) => {
  const unitAmount = Math.round(Number(item.price) * 100);
  subtotalCents += unitAmount * (item.quantity || 1);

  return {
    price_data: {
      currency: "usd",
      product_data: {
        name: String(item.name || "Item"),
        description: item.modifiers?.length ? item.modifiers.join(", ") : undefined,  // ← Keep modifiers here
      },
          unit_amount: unitAmount,
        },
        quantity: item.quantity || 1,
      };
    });

    // 2. Calculate Tax & Final Total
    const taxAmountCents = Math.round(subtotalCents * 0.10);
    const finalTotalCents = subtotalCents + taxAmountCents;
    const finalTotalDollars = finalTotalCents / 100;

    // --- NEW: FORCE $10.00 MINIMUM WITH CUSTOM MESSAGE ---
    if (finalTotalDollars < 10.00) {
      return {
        statusCode: 400,
        headers: { 
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ 
            error: "Order Minimum Not Met",
            message: "The minimum order card payment is $10.00. Please add another item, or click the PAY AT CASHIER button" 
        })
      };
    }
    // -----------------------------------------------------

    // Add Tax line item to the list passed to Stripe
    line_items.push({
      price_data: {
        currency: "usd",
        product_data: { name: "DC Sales Tax (10%)" },
        unit_amount: taxAmountCents,
      },
      quantity: 1,
    });

    const qr_uuid = randomUUID();
    
    // 3. Create Order in DB
    const orderSummary = items.map(i => `${i.name} x${i.quantity}`).join("\n");
    
 

    const origin = event.headers.origin || "https://alscarryout.com";

    // 4. Create Session (Card + Wallets, No Link)
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items,
      payment_method_types: ["card"], 
      payment_method_options: {
        card: {
          request_three_d_secure: 'any',
        },
      },
      metadata: {
        qr_uuid,
        source: (source || "KIOSK").toUpperCase(),
        guest_name: guest_name || "Walk-In",
      },
      success_url: `${origin}/kiosk-success?order=${qr_uuid}`,
      cancel_url: `${origin}/kiosk-cancel?order=${qr_uuid}`,
      payment_intent_data: {
        application_fee_amount: 50,
        statement_descriptor_suffix: "ALS DELI",
        transfer_data: {
          destination: process.env.STRIPE_CONNECTED_ACCOUNT_ID,
        },
        on_behalf_of: process.env.STRIPE_CONNECTED_ACCOUNT_ID,
        metadata: { qr_uuid },
      },
    });

    await supabase.from("orders").update({ payment_intent_id: session.payment_intent }).eq("confirmation_number", qr_uuid);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        checkout_url: session.url,
        session_id: session.id,
        qr_uuid,
        final_total: finalTotalDollars,
      }),
    };
  } catch (e) {
    console.error("Error:", e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
