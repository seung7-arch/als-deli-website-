const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { qr_uuid } = JSON.parse(event.body);

  if (!qr_uuid) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'qr_uuid required' })
    };
  }

  try {
    // Get the ticket data first
    const { data: ticket, error: fetchError } = await supabase
      .from('tickets')
      .select('*')
      .eq('qr_uuid', qr_uuid)
      .single();

    if (fetchError || !ticket) {
      throw new Error('Ticket not found');
    }

    // Update ticket to mark as "pay at counter"
    const { error: updateError } = await supabase
      .from('tickets')
      .update({
        status: 'cashier_pending',
        updated_at: new Date().toISOString()
      })
      .eq('qr_uuid', qr_uuid);

    if (updateError) throw updateError;

    // Send to KDS as UNPAID order
    const makeWebhookUrl = 'https://hook.us2.make.com/xaqgz1i35i8al312nkm76to5actknvkc';
    
    await fetch(makeWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        qr_uuid: qr_uuid,
        customer_name: ticket.guest_name || 'Walk-In',
        items: ticket.items || [],
        total: ticket.total || 0,
        source: 'kiosk',
        payment_status: 'cashier_pending',
        order_summary: generateOrderSummary(ticket.items || [])
      })
    });

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ 
        success: true,
        message: 'Order sent to cashier'
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

function generateOrderSummary(items) {
  return items.map(item => {
    const modText = item.modifiers && item.modifiers.length > 0 
      ? ` (${item.modifiers.join(', ')})` 
      : '';
    const qtyText = item.quantity > 1 ? ` x${item.quantity}` : '';
    return `- ${item.name}${qtyText}${modText} ($${(item.price * item.quantity).toFixed(2)})`;
  }).join('\n');
}
