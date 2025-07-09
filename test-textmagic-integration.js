/**
 * TextMagic Integration Test Script
 * 
 * This script tests the TextMagic SMS integration to ensure it works correctly
 * with the disc found notification system.
 * 
 * Prerequisites:
 * 1. Set up TextMagic credentials in .env.local
 * 2. Have a valid TextMagic account with credits
 * 
 * Usage:
 * node test-textmagic-integration.js
 */

require('dotenv').config({ path: '.env.local' });

// TextMagic configuration
const TEXTMAGIC_USERNAME = process.env.REACT_APP_TEXTMAGIC_USERNAME;
const TEXTMAGIC_API_KEY = process.env.REACT_APP_TEXTMAGIC_API_KEY;

// Phone validation functions (copied from phoneUtils.ts)
function normalizePhoneNumber(phone) {
  if (!phone) return null;
  
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  return null;
}

function validatePhoneNumber(phone) {
  if (!phone) {
    return { isValid: true };
  }
  
  const digits = phone.replace(/\D/g, '');
  
  if (!digits) {
    return { isValid: false, error: 'Phone number must contain digits' };
  }
  
  if (digits.length < 7) {
    return { isValid: false, error: 'Phone number must be at least 7 digits' };
  }
  
  if (digits.length === 10) {
    return { isValid: true };
  }
  
  if (digits.length === 11 && digits.startsWith('1')) {
    return { isValid: true };
  }
  
  if (digits.length > 15) {
    return { isValid: false, error: 'Phone number is too long' };
  }
  
  return { 
    isValid: true, 
    warning: 'Phone number format may need review' 
  };
}

function validatePhoneForSMS(phone) {
  if (!phone) {
    return { isValid: false, error: 'Phone number is required' };
  }

  const validation = validatePhoneNumber(phone);
  if (!validation.isValid) {
    return { isValid: false, error: validation.error };
  }

  const normalized = normalizePhoneNumber(phone);
  if (!normalized) {
    return { isValid: false, error: 'Unable to normalize phone number' };
  }

  return { isValid: true, normalizedPhone: normalized };
}

// SMS configuration check
function isSMSConfigured() {
  return !!(TEXTMAGIC_USERNAME && TEXTMAGIC_API_KEY);
}

// TextMagic SMS sending function
async function sendTextMagicSMS(phoneNumber, message) {
  try {
    if (!isSMSConfigured()) {
      return {
        success: false,
        error: 'TextMagic credentials not configured'
      };
    }

    const phoneValidation = validatePhoneForSMS(phoneNumber);
    if (!phoneValidation.isValid) {
      return {
        success: false,
        error: phoneValidation.error,
        phoneNumber: phoneNumber
      };
    }

    // Prepare phone number for TextMagic (remove + prefix)
    const textMagicPhone = phoneValidation.normalizedPhone.replace('+', '');

    const apiUrl = 'https://rest.textmagic.com/api/v2/messages';
    const requestBody = {
      text: message,
      phones: textMagicPhone
    };

    console.log('Sending SMS via TextMagic API...');
    console.log(`To: ${textMagicPhone}`);
    console.log(`Message: ${message}`);

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
      return {
        success: false,
        error: `TextMagic API error: ${response.status} - ${errorData.message || 'Unknown error'}`,
        phoneNumber: phoneValidation.normalizedPhone
      };
    }

    const responseData = await response.json();
    return {
      success: true,
      messageId: responseData.id || responseData.messageId || `tm_${Date.now()}`,
      phoneNumber: phoneValidation.normalizedPhone,
      response: responseData
    };

  } catch (error) {
    return {
      success: false,
      error: error.message || 'Unknown error occurred'
    };
  }
}

// Test function
async function testTextMagicIntegration() {
  console.log('TextMagic Integration Test');
  console.log('==========================\n');

  // Test 1: Check configuration
  console.log('1. Checking TextMagic Configuration:');
  const isConfigured = isSMSConfigured();
  console.log(`   SMS Configured: ${isConfigured ? '✅ Yes' : '❌ No'}`);
  
  if (!isConfigured) {
    console.log('   ❌ Error: TextMagic credentials not found in .env.local');
    console.log('   Please add REACT_APP_TEXTMAGIC_USERNAME and REACT_APP_TEXTMAGIC_API_KEY');
    return;
  }
  
  console.log(`   Username: ${TEXTMAGIC_USERNAME}`);
  console.log(`   API Key: ${TEXTMAGIC_API_KEY ? '***' + TEXTMAGIC_API_KEY.slice(-4) : 'Not set'}`);
  console.log('');

  // Test 2: Phone number validation
  console.log('2. Testing Phone Number Validation:');
  const testPhones = [
    '(555) 123-4567',
    '555-123-4567', 
    '5551234567',
    '+15551234567'
  ];

  testPhones.forEach(phone => {
    const validation = validatePhoneForSMS(phone);
    console.log(`   ${phone}: ${validation.isValid ? '✅' : '❌'} ${validation.normalizedPhone || validation.error}`);
  });
  console.log('');

  // Test 3: Send test SMS
  console.log('3. SMS Sending Test:');
  console.log('   Testing actual SMS sending to debug any issues...');
  console.log('');

  const testPhone = '7855548144'; // Your phone number
  const testMessage = 'Test message from DZDiscFinder - TextMagic integration test!';

  console.log('   Sending test SMS...');
  const result = await sendTextMagicSMS(testPhone, testMessage);

  if (result.success) {
    console.log('   ✅ SMS sent successfully!');
    console.log(`   📱 To: ${result.phoneNumber}`);
    console.log(`   📨 Message ID: ${result.messageId}`);
    console.log(`   📋 Response:`, result.response);
  } else {
    console.log('   ❌ SMS sending failed:', result.error);
    if (result.phoneNumber) {
      console.log(`   📱 Phone: ${result.phoneNumber}`);
    }
  }

  console.log('✅ TextMagic integration test completed!');
  console.log('\nNext steps:');
  console.log('1. Add your TextMagic credentials to .env.local');
  console.log('2. Test the integration by reporting a found disc');
  console.log('3. Verify SMS notifications are sent correctly');
}

// Run the test
testTextMagicIntegration().catch(console.error);
