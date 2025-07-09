/**
 * SMS Service for sending text messages via TextMagic
 * Handles automatic SMS notifications when found discs are entered
 */

import { normalizePhoneNumber, validatePhoneNumber } from '../utils/phoneUtils';

// TextMagic configuration from environment variables
const TEXTMAGIC_USERNAME = process.env.REACT_APP_TEXTMAGIC_USERNAME;
const TEXTMAGIC_API_KEY = process.env.REACT_APP_TEXTMAGIC_API_KEY;

export interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
  phoneNumber?: string;
}

export interface SMSMessage {
  to: string;
  message: string;
  foundDiscId?: string;
  sourceId?: string;
}

/**
 * Check if SMS is configured and available
 */
export function isSMSConfigured(): boolean {
  const isConfigured = !!(TEXTMAGIC_USERNAME && TEXTMAGIC_API_KEY);
  console.log('SMS Configuration Check:', {
    hasUsername: !!TEXTMAGIC_USERNAME,
    hasApiKey: !!TEXTMAGIC_API_KEY,
    isConfigured,
    environment: process.env.NODE_ENV
  });
  return isConfigured;
}

/**
 * Validate a phone number for SMS sending
 * Only accepts 10-digit US phone numbers as per requirements
 */
export function validatePhoneForSMS(phone: string | null | undefined): {
  isValid: boolean;
  normalizedPhone?: string;
  error?: string;
} {
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

  // Check if it's a valid 10-digit US number
  if (!normalized.startsWith('+1') || normalized.length !== 12) {
    return { isValid: false, error: 'Only 10-digit US phone numbers are supported for SMS' };
  }

  return { isValid: true, normalizedPhone: normalized };
}

/**
 * Send SMS message via TextMagic
 * This function makes an actual API call to TextMagic REST API
 */
export async function sendSMS(smsMessage: SMSMessage): Promise<SMSResult> {
  try {
    // Validate SMS configuration
    if (!isSMSConfigured()) {
      console.warn('SMS not configured - TextMagic credentials missing');
      console.warn('Environment variables:', {
        TEXTMAGIC_USERNAME: TEXTMAGIC_USERNAME ? 'SET' : 'MISSING',
        TEXTMAGIC_API_KEY: TEXTMAGIC_API_KEY ? 'SET' : 'MISSING',
        NODE_ENV: process.env.NODE_ENV
      });
      return {
        success: false,
        error: 'SMS service not configured'
      };
    }

    // Validate phone number
    const phoneValidation = validatePhoneForSMS(smsMessage.to);
    if (!phoneValidation.isValid) {
      return {
        success: false,
        error: phoneValidation.error,
        phoneNumber: smsMessage.to
      };
    }

    // Prepare phone number for TextMagic (remove + prefix for international format)
    const textMagicPhone = phoneValidation.normalizedPhone?.replace('+', '') || '';

    // Prepare the API request
    const apiUrl = 'https://rest.textmagic.com/api/v2/messages';
    const requestBody = {
      text: smsMessage.message,
      phones: textMagicPhone
    };

    console.log('Sending SMS via TextMagic:', {
      to: textMagicPhone,
      message: smsMessage.message
    });

    // Make the API call to TextMagic
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-TM-Username': TEXTMAGIC_USERNAME!,
        'X-TM-Key': TEXTMAGIC_API_KEY!
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('TextMagic API error:', response.status, errorData);
      return {
        success: false,
        error: `TextMagic API error: ${response.status} - ${errorData.message || 'Unknown error'}`,
        phoneNumber: phoneValidation.normalizedPhone
      };
    }

    const responseData = await response.json();
    console.log('TextMagic API response:', responseData);

    return {
      success: true,
      messageId: responseData.id || responseData.messageId || `tm_${Date.now()}`,
      phoneNumber: phoneValidation.normalizedPhone
    };

  } catch (error) {
    console.error('SMS sending failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

/**
 * Send found disc notification SMS
 * Uses the source's message template if available
 */
export async function sendFoundDiscNotification(
  phoneNumber: string,
  messageTemplate: string | null | undefined,
  foundDiscId: string,
  sourceId: string
): Promise<SMSResult> {
  // Don't send if no message template
  if (!messageTemplate || messageTemplate.trim() === '') {
    return {
      success: false,
      error: 'No message template available for this source'
    };
  }

  const smsMessage: SMSMessage = {
    to: phoneNumber,
    message: messageTemplate.trim(),
    foundDiscId,
    sourceId
  };

  return await sendSMS(smsMessage);
}

/**
 * Format SMS message with disc details (future enhancement)
 * This could be used to personalize messages with disc information
 */
export function formatSMSMessage(template: string, discDetails?: any): string {
  // For now, just return the template as-is
  // Future enhancement could replace placeholders like {{brand}}, {{mold}}, etc.
  return template;
}
