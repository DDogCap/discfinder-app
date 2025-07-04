/**
 * Phone number utilities for normalizing and formatting phone numbers
 */

import { useState } from 'react';

/**
 * Normalize a phone number to E.164 format
 * @param phone - Raw phone number input
 * @returns Normalized phone number or null if invalid
 */
export function normalizePhoneNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // If empty after cleaning, return null
  if (!digits) return null;
  
  // If it's 10 digits, assume US number and add country code
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  // If it's 11 digits and starts with 1, format as US number
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  // If it's 7 digits, it's missing area code - keep as is for manual review
  if (digits.length === 7) {
    return digits;
  }
  
  // For other lengths, return the digits (may need manual review)
  return digits.length > 0 ? digits : null;
}

/**
 * Format a phone number for display
 * @param phone - Normalized phone number
 * @returns Formatted phone number for display
 */
export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return '';
  
  // If it's a normalized US number (+1XXXXXXXXXX)
  if (phone.startsWith('+1') && phone.length === 12) {
    const digits = phone.slice(2); // Remove +1
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  
  // If it's 10 digits without country code
  if (phone.length === 10 && /^\d{10}$/.test(phone)) {
    return `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`;
  }
  
  // If it's 7 digits (missing area code)
  if (phone.length === 7 && /^\d{7}$/.test(phone)) {
    return `${phone.slice(0, 3)}-${phone.slice(3)}`;
  }
  
  // For other formats, return as-is
  return phone;
}

/**
 * Validate a phone number
 * @param phone - Phone number to validate
 * @returns Object with validation result and error message
 */
export function validatePhoneNumber(phone: string | null | undefined): {
  isValid: boolean;
  error?: string;
  warning?: string;
} {
  if (!phone) {
    return { isValid: true }; // Phone is optional
  }
  
  const digits = phone.replace(/\D/g, '');
  
  if (!digits) {
    return { isValid: false, error: 'Phone number must contain digits' };
  }
  
  if (digits.length < 7) {
    return { isValid: false, error: 'Phone number must be at least 7 digits' };
  }
  
  if (digits.length === 7) {
    return { 
      isValid: true, 
      warning: 'Phone number appears to be missing area code' 
    };
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

/**
 * React hook for phone number input handling
 * @param initialValue - Initial phone number value
 * @returns Object with value, formatted display, validation, and change handler
 */
export function usePhoneNumber(initialValue: string = '') {
  const [value, setValue] = useState(initialValue);
  const [displayValue, setDisplayValue] = useState(formatPhoneNumber(initialValue));
  
  const validation = validatePhoneNumber(value);
  const normalizedValue = normalizePhoneNumber(value);
  
  const handleChange = (newValue: string) => {
    setValue(newValue);
    setDisplayValue(formatPhoneNumber(newValue));
  };
  
  const handleBlur = () => {
    // On blur, normalize and format the value
    const normalized = normalizePhoneNumber(value);
    if (normalized) {
      setValue(normalized);
      setDisplayValue(formatPhoneNumber(normalized));
    }
  };
  
  return {
    value,
    displayValue,
    normalizedValue,
    validation,
    handleChange,
    handleBlur,
    setValue: handleChange
  };
}

// Note: React import would be needed for the hook, but keeping this file as utility functions
// The hook can be implemented in components that need it
