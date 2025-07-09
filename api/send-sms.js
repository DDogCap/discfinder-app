/**
 * Vercel Serverless Function for sending SMS via TextMagic
 * This handles the CORS issue by making the API call server-side
 */

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { phoneNumber, message } = req.body;

    // Validate input
    if (!phoneNumber || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Phone number and message are required' 
      });
    }

    // Get TextMagic credentials (hardcoded for security in serverless function)
    const TEXTMAGIC_USERNAME = 'galenadams';
    const TEXTMAGIC_API_KEY = '78DbgMurW9DP0VFnFUTk3nlYrIC42L';

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
