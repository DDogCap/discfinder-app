/**
 * SMS Service for sending text messages via Twilio
 * Handles automatic SMS notifications when found discs are entered
 */

import { normalizePhoneNumber, validatePhoneNumber } from '../utils/phoneUtils';

// Twilio configuration from environment variables
const TWILIO_ACCOUNT_SID = process.env.REACT_APP_TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.REACT_APP_TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.REACT_APP_TWILIO_PHONE_NUMBER;

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
  return !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER);
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
 * Send SMS message via Twilio
 * This is a client-side function that would typically call a backend API
 * For now, it simulates the SMS sending process
 */
export async function sendSMS(smsMessage: SMSMessage): Promise<SMSResult> {
  try {
    // Validate SMS configuration
    if (!isSMSConfigured()) {
      console.warn('SMS not configured - Twilio credentials missing');
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

    // In a real implementation, this would call a backend API that uses Twilio
    // For now, we'll simulate the API call
    console.log('SMS would be sent:', {
      to: phoneValidation.normalizedPhone,
      message: smsMessage.message,
      from: TWILIO_PHONE_NUMBER
    });

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // For development, always return success
    // In production, this would make an actual API call
    return {
      success: true,
      messageId: `sim_${Date.now()}`,
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
