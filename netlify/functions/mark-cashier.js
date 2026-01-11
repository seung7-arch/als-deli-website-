
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY  // ← CORRECT
);

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const { qr_uuid, items, total, guest_name } = JSON.parse(event.body);

    if (!qr_uuid || !items || !total) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Missing required fields" })
      };
    }

    // Calculate tax
    const subtotal = Number(total);
    const tax = Math.round(subtotal * 0.10 * 100) / 100;
    const totalWithTax = subtotal + tax;

    // Create order in Supabase with cashier payment method
   const { data: order, error } = await supabase
  .from('orders')
  .insert([{
    customer_name: guest_name || 'Walk-In',
    items: items,
    total: totalWithTax,
    status: 'pending',
    payment_method: 'cashier',
    order_source: 'kiosk'
  }])
  .select()
  .single();

    if (error) {
      console.error('Supabase error:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to create order' })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true,
        confirmation_number: order.confirmation_number 
      })
    };

  } catch (err) {
    console.error('mark-cashier error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
