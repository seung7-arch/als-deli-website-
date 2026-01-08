const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY_LIVE);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const { guest_name, items, total, source } = JSON.parse(event.body);

    // Validate required fields
    if (!items || !total) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'Missing required fields: items, total' })
      };
    }

    // Generate unique QR UUID for this order
    const { randomUUID } = require('crypto');
    const qr_uuid = randomUUID();

    // Create line items for Stripe
    const line_items = items.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: item.name,
          description: item.modifiers && item.modifiers.length > 0 
            ? item.modifiers.join(', ') 
            : undefined
        },
        unit_amount: Math.round(Number(item.price) * 100) // Convert to cents
      },
      quantity: item.quantity || 1
    }));

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      payment_method_types: ['card'],
      payment_intent_data: {
        application_fee_amount: 50, // $0.50 fee
        transfer_data: {
          destination: process.env.STRIPE_CONNECTED_ACCOUNT_ID
        }
      },
      metadata: {
        qr_uuid,
        guest_name: guest_name || 'Walk-In',
        source: source || 'kiosk'
      },
      success_url: `${event.headers.origin || 'https://alscarryout.com'}/success?order_id=${qr_uuid}`,
      cancel_url: `${event.headers.origin || 'https://alscarryout.com'}/cancelled?order_id=${qr_uuid}`
    });

    // Store pending order in Supabase
   const { error: dbError } = await supabase
  .from('orders')
  .insert({
    customer_name: guest_name || 'Walk-In',
    items: JSON.stringify(items),
    total: total.toFixed(2),
    status: 'pending',
    order_source: 'Kiosk 1',
    payment_intent_id: session.payment_intent,
    paid: false,
    acknowledged: false,
    pickup_time: 'ASAP',
    order_summary: items.map(item => {
      const modText = item.modifiers && item.modifiers.length > 0 ? ` (${item.modifiers.join(', ')})` : '';
      const qtyText = item.quantity > 1 ? ` x${item.quantity}` : '';
      return `${item.name}${qtyText}${modText}`;
    }).join('\n'),
    created_at: new Date().toISOString()
  });

    if (dbError) {
      console.error('Database error:', dbError);
      // Continue anyway - webhook will handle it
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        checkout_url: session.url,
        qr_uuid: qr_uuid
      })
    };

  } catch (error) {
    console.error('Checkout session error:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ 
        error: 'Failed to create checkout session',
        message: error.message 
      })
    };
  }
};
