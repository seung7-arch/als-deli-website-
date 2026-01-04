const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY_LIVE);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const { amount, customerName, items, customerPhone, pickupTime, specialInstructions } = JSON.parse(event.body);

    // Generate confirmation number
    const confirmationNumber = `${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: 'usd',
      application_fee_amount: 50, // $0.50 fee to Volo Systems
      transfer_data: {
        destination: process.env.STRIPE_CONNECTED_ACCOUNT_ID,
      },
      metadata: {
        customer_name: customerName || 'Guest',
        customer_phone: customerPhone || '',
        items: JSON.stringify(items),
        confirmation_number: confirmationNumber,
        pickup_time: pickupTime || 'ASAP',
        special_instructions: specialInstructions || '',
        order_source: 'WEB'
      }
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        clientSecret: paymentIntent.client_secret,
        confirmationNumber: confirmationNumber,
        paymentIntentId: paymentIntent.id
      })
    };
  } catch (error) {
    console.error('Payment Intent Error:', error);
    
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message })
    };
  }
};
