if (stripeEvent.type === "checkout.session.completed") {
  const session = stripeEvent.data.object;

  const qr_uuid = session.metadata?.qr_uuid; // MUST exist
  if (!qr_uuid) {
    console.warn("checkout.session.completed: missing qr_uuid in metadata", session.id);
    return { statusCode: 200, body: JSON.stringify({ received: true, note: "no qr_uuid" }) };
  }

  const paymentIntentId = session.payment_intent || null;

  // OPTIONAL: get last4
  let paymentMethodLabel = "Card";
  try {
    if (paymentIntentId) {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (pi.payment_method) {
        const pm = await stripe.paymentMethods.retrieve(pi.payment_method);
        const last4 = pm.card?.last4;
        if (last4) paymentMethodLabel = `Card ••${last4}`;
      }
    }
  } catch (e) {
    console.warn("Could not fetch payment method:", e.message);
  }

  // OPTIONAL (recommended): fetch line items so KDS always has items + total
  let items = null;
  let total = null;
  try {
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
    items = lineItems.data.map(li => ({
      name: li.description,
      quantity: li.quantity || 1,
      // amount_total is for the line item total; per-unit is amount_total / quantity
      price: li.quantity ? (li.amount_total / 100) / li.quantity : (li.amount_total / 100),
      modifiers: [],
    }));
    if (typeof session.amount_total === "number") {
      total = session.amount_total / 100;
    }
  } catch (e) {
    console.warn("Could not fetch line items:", e.message);
  }

  // ✅ IMPORTANT: update the existing order created by create-checkout-session
  const updatePayload = {
    paid: true,
    status: "PENDING", // must match how your KDS expects "current"
    payment_intent_id: paymentIntentId,
    payment_method: paymentMethodLabel,
  };

  // only set if we successfully fetched them
  if (items) updatePayload.items = items;   // <— as JSON array (best)
  if (total != null) updatePayload.total = total;

  const { data, error } = await supabase
    .from("orders")
    .update(updatePayload)
    .eq("confirmation_number", qr_uuid)
    .select(); // 👈 lets us see if anything matched

  if (error) {
    console.error("Supabase update error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "DB update failed" }) };
  }

  // 🚨 KEY DEBUG: if data is empty, you updated 0 rows (no match)
  if (!data || data.length === 0) {
    console.error(
      "Supabase update matched 0 rows. Likely confirmation_number mismatch or pre-insert didn't happen.",
      { qr_uuid, session_id: session.id, payment_intent_id: paymentIntentId }
    );
    return { statusCode: 200, body: JSON.stringify({ received: true, note: "0 rows updated", qr_uuid }) };
  }

  console.log("Order marked paid:", data[0].id, "confirmation:", qr_uuid);

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
}
