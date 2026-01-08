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
    const session = await stripe.checkout.sessions.create({
  mode: 'payment',
  line_items,
  payment_method_types: ['card'],
  payment_intent_data: {
    application_fee_amount: 50,
    transfer_data: {
      destination: process.env.STRIPE_CONNECTED_ACCOUNT_ID
    }
  },
  metadata: {
    guest_name: guest_name || 'Walk-In',
    source: 'Kiosk 1'
  },
  success_url: `${event.headers.origin || 'https://alscarryout.com'}/success`,
  cancel_url: `${event.headers.origin || 'https://alscarryout.com'}/cancelled`
});

// Store order in Supabase BEFORE payment
const orderSummary = items.map(item => {
  const modText = item.modifiers && item.modifiers.length > 0 ? ` (${item.modifiers.join(', ')})` : '';
  const qtyText = item.quantity > 1 ? ` x${item.quantity}` : '';
  return `${item.name}${qtyText}${modText}`;
}).join('\n');

const { data: orderData, error: dbError } = await supabase
  .from('orders')
  .insert({
    customer_name: guest_name || 'Walk-In',
    items: JSON.stringify(items),
    total: total.toFixed(2),
    status: 'pending',
    order_source: 'Kiosk 1',
    order_summary: orderSummary,
    payment_intent_id: session.payment_intent,
    paid: false,
    acknowledged: false,
    pickup_time: 'ASAP',
    created_at: new Date().toISOString()
  })
  .select()
  .single();

if (dbError) {
  console.error('Database error:', dbError);
}

return {
  statusCode: 200,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  },
  body: JSON.stringify({
    checkout_url: session.url,
    qr_uuid: session.payment_intent
  })
};

  metadata: {
    guest_name: guest_name || 'Walk-In',
    source: 'Kiosk 1',
    items: JSON.stringify(items),
    total: total.toFixed(2),
    order_summary: items.map(item => {
      const modText = item.modifiers && item.modifiers.length > 0 ? ` (${item.modifiers.join(', ')})` : '';
      const qtyText = item.quantity > 1 ? ` x${item.quantity}` : '';
      return `${item.name}${qtyText}${modText}`;
    }).join('\n')
  },
  payment_intent_data: {
    application_fee_amount: 50,
    transfer_data: {
      destination: process.env.STRIPE_CONNECTED_ACCOUNT_ID
    },
    metadata: {
      guest_name: guest_name || 'Walk-In',
      source: 'Kiosk 1',
      items: JSON.stringify(items),
      order_summary: items.map(item => {
        const modText = item.modifiers && item.modifiers.length > 0 ? ` (${item.modifiers.join(', ')})` : '';
        const qtyText = item.quantity > 1 ? ` x${item.quantity}` : '';
        return `${item.name}${qtyText}${modText}`;
      }).join('\n')
    }
  },
      success_url: `${event.headers.origin || 'https://alscarryout.com'}/success?order_id=${qr_uuid}`,
      cancel_url: `${event.headers.origin || 'https://alscarryout.com'}/cancelled?order_id=${qr_uuid}`
    });

  

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
