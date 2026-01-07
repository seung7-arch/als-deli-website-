const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

exports.handler = async (event) => {
  const qrUuid = event.queryStringParameters?.qr_uuid;

  if (!qrUuid) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'qr_uuid required' })
    };
  }

  try {
    const { data, error } = await supabase
      .from('tickets')
      .select('status')
      .eq('qr_uuid', qrUuid)
      .single();

    if (error) {
      return {
        statusCode: 404,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ status: 'pending' })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ status: data.status })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: error.message })
    };
  }
};
