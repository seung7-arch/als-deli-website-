const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY_LIVE);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  // Add CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, error: 'Method Not Allowed' })
    };
  }

  try {
    // Parse request body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body || '{}');
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Invalid JSON in request body' 
        })
      };
    }

    const { paymentIntentId, amount, orderId } = requestBody;

    // Validate inputs
    if (!paymentIntentId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false, 
          error: 'Missing payment intent ID' 
        })
      };
    }

    console.log('Processing refund:', { paymentIntentId, amount, orderId });

    // Create refund in Stripe
   // Create refund in Stripe
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amount ? Math.round(amount) : undefined, // in cents
      reason: 'requested_by_customer',
      reverse_transfer: true, // <--- ADD THIS LINE
    });

    console.log('Stripe refund created:', refund.id);

    // Update order in Supabase
    if (orderId) {
      const { data, error } = await supabase
        .from('orders')
        .update({ 
          refunded: true,
          refund_id: refund.id,
          refund_date: new Date().toISOString()
        })
        .eq('id', orderId)
        .select();

      if (error) {
        console.error('Supabase update error:', error);
        // Don't fail the whole request if DB update fails - refund already processed
      } else {
        console.log('Supabase updated:', data);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        refund: {
          id: refund.id,
          amount: refund.amount,
          status: refund.status
        }
      })
    };
  } catch (error) {
    console.error('Refund error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'Unknown error occurred'
      })
    };
  }
};
