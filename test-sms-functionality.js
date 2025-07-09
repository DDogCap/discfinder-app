// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Mock the SMS service functions for testing
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
  if (!phone) return { isValid: true };
  const digits = phone.replace(/\D/g, '');
  if (!digits) return { isValid: false, error: 'Phone number must contain digits' };
  if (digits.length < 7) return { isValid: false, error: 'Phone number must be at least 7 digits' };
  if (digits.length === 10) return { isValid: true };
  if (digits.length === 11 && digits.startsWith('1')) return { isValid: true };
  return { isValid: false, error: 'Invalid phone number format' };
}

function validatePhoneForSMS(phone) {
  if (!phone) return { isValid: false, error: 'Phone number is required' };
  const validation = validatePhoneNumber(phone);
  if (!validation.isValid) return { isValid: false, error: validation.error };
  const normalized = normalizePhoneNumber(phone);
  if (!normalized) return { isValid: false, error: 'Unable to normalize phone number' };
  if (!normalized.startsWith('+1') || normalized.length !== 12) {
    return { isValid: false, error: 'Only 10-digit US phone numbers are supported for SMS' };
  }
  return { isValid: true, normalizedPhone: normalized };
}

function isSMSConfigured() {
  const TEXTMAGIC_USERNAME = process.env.REACT_APP_TEXTMAGIC_USERNAME;
  const TEXTMAGIC_API_KEY = process.env.REACT_APP_TEXTMAGIC_API_KEY;
  return !!(TEXTMAGIC_USERNAME && TEXTMAGIC_API_KEY);
}

async function sendFoundDiscNotification(phoneNumber, messageTemplate, foundDiscId, sourceId) {
  if (!messageTemplate || messageTemplate.trim() === '') {
    return { success: false, error: 'No message template available for this source' };
  }
  const phoneValidation = validatePhoneForSMS(phoneNumber);
  if (!phoneValidation.isValid) {
    return { success: false, error: phoneValidation.error, phoneNumber };
  }
  // Simulate successful SMS
  return {
    success: true,
    messageId: `sim_${Date.now()}`,
    phoneNumber: phoneValidation.normalizedPhone
  };
}

async function testSMSFunctionality() {
  console.log('Testing SMS Functionality');
  console.log('========================\n');

  // Test 1: Check SMS configuration
  console.log('1. Checking SMS Configuration:');
  const isConfigured = isSMSConfigured();
  console.log(`   SMS Configured: ${isConfigured ? '✅ Yes' : '❌ No'}`);
  
  if (!isConfigured) {
    console.log('   Note: Add TextMagic credentials to .env.local to enable SMS');
  }
  console.log('');

  // Test 2: Phone number validation
  console.log('2. Testing Phone Number Validation:');
  const testPhones = [
    '(555) 123-4567',
    '555-123-4567',
    '5551234567',
    '+15551234567',
    '123-456-7890',
    '555-123-456', // Invalid - too short
    '+44 20 7946 0958', // Invalid - not US
    ''
  ];

  testPhones.forEach(phone => {
    const validation = validatePhoneForSMS(phone);
    const status = validation.isValid ? '✅' : '❌';
    console.log(`   ${status} "${phone}" -> ${validation.isValid ? validation.normalizedPhone : validation.error}`);
  });
  console.log('');

  // Test 3: SMS sending simulation
  console.log('3. Testing SMS Sending:');
  const testMessage = "A disc of yours has been found and is now at the DZDiscs store in Lawrence, KS. You can pick it up or we can ship it to you by itself or along with an order. Follow the link to see the disc.";
  const testPhone = '(555) 123-4567';
  
  try {
    const result = await sendFoundDiscNotification(
      testPhone,
      testMessage,
      'test-disc-id',
      'test-source-id'
    );
    
    if (result.success) {
      console.log(`   ✅ SMS would be sent successfully`);
      console.log(`   📱 To: ${result.phoneNumber}`);
      console.log(`   📨 Message ID: ${result.messageId}`);
      console.log(`   💬 Message: ${testMessage.substring(0, 100)}...`);
    } else {
      console.log(`   ❌ SMS sending failed: ${result.error}`);
    }
  } catch (error) {
    console.log(`   ❌ SMS test error: ${error.message}`);
  }
  console.log('');

  // Test 4: Empty message template
  console.log('4. Testing Empty Message Template:');
  try {
    const result = await sendFoundDiscNotification(
      testPhone,
      '', // Empty message
      'test-disc-id',
      'test-source-id'
    );
    
    if (!result.success) {
      console.log(`   ✅ Correctly rejected empty message: ${result.error}`);
    } else {
      console.log(`   ❌ Should have rejected empty message`);
    }
  } catch (error) {
    console.log(`   ❌ Test error: ${error.message}`);
  }
  console.log('');

  console.log('SMS Functionality Test Complete!');
  console.log('\nNext Steps:');
  console.log('1. Run the SQL migration in Supabase SQL Editor:');
  console.log('   ALTER TABLE sources ADD COLUMN IF NOT EXISTS msg1_found_just_entered TEXT;');
  console.log('   ALTER TABLE sources ADD COLUMN IF NOT EXISTS msg2_reminder TEXT;');
  console.log('');
  console.log('2. Update sources with messaging data:');
  console.log('   node update-sources-by-name.js');
  console.log('');
  console.log('3. Add Twilio credentials to .env.local for live SMS');
  console.log('');
  console.log('4. Test by entering a found disc with a valid phone number');
}

testSMSFunctionality().catch(console.error);
