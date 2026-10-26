/**
 * Vercel Serverless Function for sending SMS via TextMagic
 * This handles the CORS issue by making the API call server-side
 */

module.exports = async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Require a signed-in, non-guest user; fail closed if Supabase isn't configured
    const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !token) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const userResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
    });
    if (!userResp.ok) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const user = await userResp.json();

    const profileResp = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
    );
    const profiles = profileResp.ok ? await profileResp.json() : [];
    const role = profiles[0] && profiles[0].role;
    if (!role || role === 'guest') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const { phoneNumber, message } = req.body;

    // Validate input
    if (!phoneNumber || !message) {
      return res.status(400).json({
        success: false,
        error: 'Phone number and message are required'
      });
    }

    // US numbers only (matches validatePhoneForSMS on the client), bounded length
    if (!/^\+?1\d{10}$/.test(String(phoneNumber)) || String(message).length > 480) {
      return res.status(400).json({ success: false, error: 'Invalid phone number or message' });
    }

    // Get TextMagic credentials from environment variables (configure in Vercel)
    const TEXTMAGIC_USERNAME = process.env.TEXTMAGIC_USERNAME;
    const TEXTMAGIC_API_KEY = process.env.TEXTMAGIC_API_KEY;

    if (!TEXTMAGIC_USERNAME || !TEXTMAGIC_API_KEY) {
      console.error('TextMagic credentials missing:', {
        hasUsername: !!TEXTMAGIC_USERNAME,
        hasApiKey: !!TEXTMAGIC_API_KEY
      });
      return res.status(500).json({ 
        success: false, 
        error: 'SMS service not configured' 
      });
    }

    // Normalize phone number (remove + prefix for TextMagic)
    const normalizedPhone = phoneNumber.replace(/^\+/, '');

    // Prepare the API request
    const apiUrl = 'https://rest.textmagic.com/api/v2/messages';
    const requestBody = {
      text: message,
      phones: normalizedPhone
    };

    console.log('Sending SMS via TextMagic API:', {
      to: normalizedPhone,
      messageLength: message.length
    });

    // Make the API call to TextMagic
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-TM-Username': TEXTMAGIC_USERNAME,
        'X-TM-Key': TEXTMAGIC_API_KEY
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('TextMagic API error:', response.status, errorData);
      return res.status(response.status).json({
        success: false,
        error: `TextMagic API error: ${response.status} - ${errorData.message || 'Unknown error'}`,
        phoneNumber: phoneNumber
      });
    }

    const responseData = await response.json();
    console.log('TextMagic API success:', responseData);

    return res.status(200).json({
      success: true,
      messageId: responseData.id || responseData.messageId || `tm_${Date.now()}`,
      phoneNumber: phoneNumber,
      response: responseData
    });

  } catch (error) {
    console.error('SMS sending failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unknown error occurred'
    });
  }
}
