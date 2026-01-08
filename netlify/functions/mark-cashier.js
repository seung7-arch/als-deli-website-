const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  const { qr_uuid, items, total, guest_name } = JSON.parse(event.body);

  if (!qr_uuid) {
    return {
      statusCode: 400,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'qr_uuid required' })
    };
  }

  try {
    // Insert order as unpaid
    const { data: order, error: insertError } = await supabase
      .from('orders')
      .insert({
        customer_name: guest_name || 'Walk-In',
        items: JSON.stringify(items),
        total: total,
        status: 'pending',
        order_source: 'Kiosk 1',
        paid: false,
        acknowledged: false,
        pickup_time: 'ASAP',
        order_summary: items.map(item => {
          const modText = item.modifiers && item.modifiers.length > 0 ? ` (${item.modifiers.join(', ')})` : '';
          const qtyText = item.quantity > 1 ? ` x${item.quantity}` : '';
          return `${item.name}${qtyText}${modText}`;
        }).join('\n'),
        notes: '💰 PAY AT CASHIER',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ 
        success: true,
        message: 'Order sent to cashier',
        order_id: order.id
      })
    };

  } catch (error) {
    console.error('Cashier override error:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: error.message })
    };
  }
};
