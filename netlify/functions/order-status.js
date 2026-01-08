const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  const paymentIntentId = event.queryStringParameters?.payment_intent_id;

  if (!paymentIntentId) {
    return {
      statusCode: 400,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'payment_intent_id required' })
    };
  }

  try {
    const { data, error } = await supabase
      .from('orders')
      .select('paid, status, id')
      .eq('payment_intent_id', paymentIntentId)
      .single();

    if (error || !data) {
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ status: 'pending', paid: false })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ 
        status: data.paid ? 'paid' : 'pending',
        paid: data.paid,
        order_id: data.id
      })
    };

  } catch (error) {
    console.error('Order status error:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: error.message })
    };
  }
};
