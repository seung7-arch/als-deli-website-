const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY_LIVE);
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
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
    // Verify webhook signature
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      webhookSecret
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: `Webhook Error: ${err.message}` })
    };
  }

  // Handle the event
  if (stripeEvent.type === 'payment_intent.succeeded') {
    const paymentIntent = stripeEvent.data.object;

    try {
      // Extract metadata
      const metadata = paymentIntent.metadata || {};
const customerName = metadata.guest_name || metadata.customer_name || 'Guest';
const orderSource = metadata.source || 'WEB';
const orderSummary = metadata.order_summary || '';
      const customerPhone = metadata.customer_phone || '';
      const items = metadata.items || '[]';
      const confirmationNumber = metadata.confirmation_number || '';
      const pickupTime = metadata.pickup_time || 'ASAP';
      const specialInstructions = metadata.special_instructions || '';
      
      // Get payment method details
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

// Try to find existing order by payment_intent_id
const { data: existingOrder } = await supabase
  .from('orders')
  .select('id')
  .eq('payment_intent_id', paymentIntent.id)
  .single();

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
  // Insert new order (for web orders that don't pre-create)
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
        console.error('Supabase insert error:', error);
        return {
          statusCode: 500,
          body: JSON.stringify({ error: 'Failed to insert order to database' })
        };
      }

      console.log('Order inserted successfully:', data);

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
