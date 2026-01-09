if (stripeEvent.type === "checkout.session.completed") {
  const session = stripeEvent.data.object;

  const qr_uuid = session.metadata?.qr_uuid; // <- MUST exist
  if (!qr_uuid) {
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

  // IMPORTANT: update the existing order created by create-checkout-session
  const { error } = await supabase
    .from("orders")
    .update({
      paid: true,
      status: "PENDING",            // or "NEW"
      payment_intent_id: paymentIntentId,
      payment_method: paymentMethodLabel,
    })
    .eq("confirmation_number", qr_uuid); // <- this is what order-status polls

  if (error) {
    console.error("Supabase update error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "DB update failed" }) };
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
}
