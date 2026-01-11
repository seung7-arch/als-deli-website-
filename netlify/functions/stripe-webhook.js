const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY_LIVE);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  const sig = event.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(event.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: `Webhook Error: ${err.message}` })
    };
  }

 if (stripeEvent.type === 'checkout.session.completed') {
  const session = stripeEvent.data.object;
  const qr_uuid = session.metadata?.qr_uuid;
  
  if (!qr_uuid) {
    console.warn("Missing qr_uuid in checkout.session.completed");
    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  }

  const paymentIntentId = session.payment_intent;
  let cardLast4 = '';
  
  try {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (pi.payment_method) {
      const pm = await stripe.paymentMethods.retrieve(pi.payment_method);
      cardLast4 = pm.card?.last4 || '';
    }
  } catch (e) {
    console.warn('Could not fetch payment method:', e.message);
  }

  // Fetch line items from Stripe
  let items = [];
  let orderSummary = '';
  try {
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 100 });
    
    // Filter out tax line (it has "DC Sales Tax" in the name)
    const foodItems = lineItems.data.filter(item => !item.description?.includes('DC Sales Tax'));
    
    items = foodItems.map(item => ({
      name: item.description || 'Item',
      price: item.amount_total / 100 / item.quantity, // Unit price
      quantity: item.quantity,
      modifiers: []
    }));
    
    orderSummary = foodItems.map(item => {
      const qty = item.quantity > 1 ? ` x${item.quantity}` : '';
      return `${item.description}${qty}`;
    }).join('\n');
  } catch (e) {
    console.warn('Could not fetch line items:', e.message);
  }

  const { data, error } = await supabase
    .from('orders')
    .insert({
      customer_name: session.metadata?.guest_name || 'Walk-In',
      order_summary: orderSummary,
      items: items,
      total: session.amount_total / 100,
      status: 'pending',
      order_source: session.metadata?.source || 'KIOSK',
      confirmation_number: qr_uuid,
      payment_intent_id: paymentIntentId,
      payment_method: cardLast4 ? `Card ••${cardLast4}` : 'Card',
      paid: true,
      acknowledged: false,
      refunded: false,
      pickup_time: 'ASAP',
      created_at: new Date().toISOString()
    })
    .select();

  if (error) {
    console.error('Supabase insert error:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Insert failed' }) };
  }

  console.log('Kiosk order created:', data[0]?.id);
  return { statusCode: 200, body: JSON.stringify({ received: true }) };
}

    if (!data || data.length === 0) {
      console.error('No rows updated - confirmation_number mismatch:', qr_uuid);
      return { statusCode: 200, body: JSON.stringify({ received: true, note: '0 rows updated' }) };
    }

    console.log('Kiosk order marked paid:', data[0].id);
    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  }

  // Handle payment_intent.succeeded (for web orders - backwards compatibility)
  else if (stripeEvent.type === 'payment_intent.succeeded') {
    const paymentIntent = stripeEvent.data.object;

    try {
      const metadata = paymentIntent.metadata || {};
      const customerName = metadata.guest_name || metadata.customer_name || 'Guest';
      const qr_uuid = metadata.qr_uuid;

// If qr_uuid exists, this is a kiosk order already handled by checkout.session.completed
if (qr_uuid) {
  console.log('Skipping payment_intent.succeeded for kiosk order:', qr_uuid);
  return { statusCode: 200, body: JSON.stringify({ received: true, note: 'kiosk order' }) };
}
      const orderSource = metadata.source || 'WEB';
      
      const orderSummary = metadata.order_summary || '';
      const customerPhone = metadata.customer_phone || '';
      const items = metadata.items || '[]';
      const confirmationNumber = metadata.confirmation_number || `K${Date.now().toString().slice(-6)}`;
      const pickupTime = metadata.pickup_time || 'ASAP';
      const specialInstructions = metadata.special_instructions || '';
      
      const paymentMethodId = paymentIntent.payment_method;
      let cardLast4 = '';
      
      if (paymentMethodId) {
        try {
          const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
          cardLast4 = paymentMethod.card?.last4 || '';
        } catch (err) {
          console.error('Error retrieving payment method:', err);
        }
      }

     // Try to find existing order by payment_intent_id OR qr_uuid

let existingOrder = null;

if (qr_uuid) {
  const result = await supabase
    .from('orders')
    .select('id')
    .eq('confirmation_number', qr_uuid)
    .single();
  existingOrder = result.data;
}

if (!existingOrder) {
  const result = await supabase
    .from('orders')
    .select('id')
    .eq('payment_intent_id', paymentIntent.id)
    .single();
  existingOrder = result.data;
}

      let data, error;

      if (existingOrder) {
        // Update existing order
        const result = await supabase
          .from('orders')
          .update({
            customer_name: customerName,
            customer_phone: customerPhone,
            items: items,
            total: paymentIntent.amount_received / 100,
            order_source: orderSource,
            order_summary: orderSummary,
            paid: true,
            confirmation_number: confirmationNumber,
            payment_method: cardLast4 ? `Card ••${cardLast4}` : 'Card',
            pickup_time: pickupTime,
            special_instructions: specialInstructions
          })
          .eq('id', existingOrder.id)
          .select();
        
        data = result.data;
        error = result.error;
      } else {
        // Insert new order (web orders)
        const result = await supabase
          .from('orders')
          .insert({
            payment_intent_id: paymentIntent.id,
            customer_name: customerName,
            customer_phone: customerPhone,
            items: items,
            total: paymentIntent.amount_received / 100,
            order_source: orderSource,
            order_summary: orderSummary,
            paid: true,
            confirmation_number: confirmationNumber,
            payment_method: cardLast4 ? `Card ••${cardLast4}` : 'Card',
            refunded: false,
            pickup_time: pickupTime,
            special_instructions: specialInstructions,
            created_at: new Date().toISOString()
          })
          .select();
        
        data = result.data;
        error = result.error;
      }

      if (error) {
        console.error('Supabase error:', error);
        return {
          statusCode: 500,
          body: JSON.stringify({ error: 'Failed to process order' })
        };
      }

      console.log('Web order processed successfully:', data[0]?.id);
      return {
        statusCode: 200,
        body: JSON.stringify({ received: true, orderId: data?.[0]?.id })
      };

    } catch (error) {
      console.error('Error processing payment:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message })
      };
    }
  }

  // Return success for other event types
  return {
    statusCode: 200,
    body: JSON.stringify({ received: true })
  };
};
