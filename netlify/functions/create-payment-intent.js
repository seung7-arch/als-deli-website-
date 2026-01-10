const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY_LIVE);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    // Assuming 'amount' passed in here is the FOOD SUBTOTAL
    const { amount, customerName, items, customerPhone, pickupTime, specialInstructions } = JSON.parse(event.body);

    // 1. Calculate Tax (10% of the subtotal)
    const taxRate = 0.10;
    const taxAmount = amount * taxRate;

    // 2. Calculate Final Total (Subtotal + Tax)
    // Note: If you want to include the Volo fee on top, verify if 'amount' already includes it.
    // This assumes 'amount' is just the food cost.
    const finalTotal = amount + taxAmount; 

    // Generate confirmation number
    const confirmationNumber = `${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      // Stripe expects the amount in CENTS (integers only)
      amount: Math.round(finalTotal * 100), 
      
      currency: 'usd',
      
      // Volo keeps exactly $0.50
      application_fee_amount: 50, 
      
      transfer_data: {
        destination: process.env.STRIPE_CONNECTED_ACCOUNT_ID,
      },

      // Al's Carryout is the Merchant of Record (Responsible for paying the tax to DC)
      on_behalf_of: process.env.STRIPE_CONNECTED_ACCOUNT_ID, 

      metadata: {
        customer_name: customerName || 'Guest',
        customer_phone: customerPhone || '',
        items: JSON.stringify(items),
        confirmation_number: confirmationNumber,
        pickup_time: pickupTime || 'ASAP',
        special_instructions: specialInstructions || '',
        order_source: 'WEB',
        // Good idea to record the tax split here for reporting
        tax_amount: taxAmount.toFixed(2),
        subtotal_amount: amount.toFixed(2)
      }
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        clientSecret: paymentIntent.client_secret,
        confirmationNumber: confirmationNumber,
        paymentIntentId: paymentIntent.id,
        // Optional: Return the calculated totals so the frontend can display them
        totals: {
            subtotal: amount,
            tax: taxAmount,
            final: finalTotal
        }
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
