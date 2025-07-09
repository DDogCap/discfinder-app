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
 * In production, this will be handled by the API route
 */
export function isSMSConfigured(): boolean {
  // In development, check local environment variables
  if (process.env.NODE_ENV === 'development') {
    const isConfigured = !!(TEXTMAGIC_USERNAME && TEXTMAGIC_API_KEY);
    console.log('SMS Configuration Check (dev):', {
      hasUsername: !!TEXTMAGIC_USERNAME,
      hasApiKey: !!TEXTMAGIC_API_KEY,
      isConfigured,
      environment: process.env.NODE_ENV
    });
    return isConfigured;
  }

  // In production, assume SMS is available (API route will handle validation)
  return true;
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
 * Send SMS message via TextMagic through our API route
 * This avoids CORS issues by using a serverless function
 */
export async function sendSMS(smsMessage: SMSMessage): Promise<SMSResult> {
  try {
    // Validate phone number
    const phoneValidation = validatePhoneForSMS(smsMessage.to);
    if (!phoneValidation.isValid) {
      return {
        success: false,
        error: phoneValidation.error,
        phoneNumber: smsMessage.to
      };
    }

    console.log('Sending SMS via API route:', {
      to: phoneValidation.normalizedPhone,
      message: smsMessage.message
    });

    // Call our API route instead of TextMagic directly
    const response = await fetch('/api/send-sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phoneNumber: phoneValidation.normalizedPhone,
        message: smsMessage.message
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('SMS API error:', response.status, errorData);
      return {
        success: false,
        error: `SMS API error: ${response.status} - ${errorData.error || 'Unknown error'}`,
        phoneNumber: phoneValidation.normalizedPhone
      };
    }

    const responseData = await response.json();
    console.log('SMS API response:', responseData);

    return {
      success: responseData.success,
      messageId: responseData.messageId,
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
