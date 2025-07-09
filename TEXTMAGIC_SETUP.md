# TextMagic SMS Integration Setup

This document provides instructions for setting up TextMagic SMS integration in the DZDiscFinder application.

## Overview

The application has been updated to use TextMagic instead of Twilio for SMS notifications when found discs are reported. TextMagic provides a reliable SMS gateway with competitive pricing and global coverage.

## Prerequisites

1. **TextMagic Account**: You need an active TextMagic account with sufficient credits
2. **API Credentials**: Username and API key from your TextMagic dashboard

## Setup Instructions

### 1. Get TextMagic API Credentials

1. Log in to your TextMagic account at [https://app.textmagic.com/login](https://app.textmagic.com/login)
2. Navigate to **Settings** → **API** → **REST API Keys**
3. Click **Add new API key**
4. Enter a name for your key (e.g., "DZDiscFinder App")
5. Click **Generate new key**
6. Copy your **Username** and **API Key**

### 2. Update Environment Variables

Edit your `.env.local` file and replace the Twilio configuration with TextMagic credentials:

```bash
# TextMagic Configuration
REACT_APP_TEXTMAGIC_USERNAME=your_textmagic_username_here
REACT_APP_TEXTMAGIC_API_KEY=your_textmagic_api_key_here
```

**Important**: Replace `your_textmagic_username_here` and `your_textmagic_api_key_here` with your actual TextMagic credentials.

### 3. Test the Integration

Run the test script to verify your setup:

```bash
node test-textmagic-integration.js
```

This will:
- Check if your credentials are properly configured
- Validate phone number formatting
- Provide instructions for testing actual SMS sending

### 4. Test SMS Functionality

Run the existing SMS functionality test:

```bash
node test-sms-functionality.js
```

## API Details

### TextMagic REST API

- **Endpoint**: `https://rest.textmagic.com/api/v2/messages`
- **Method**: POST
- **Authentication**: HTTP Headers
  - `X-TM-Username`: Your TextMagic username
  - `X-TM-Key`: Your TextMagic API key
- **Content-Type**: `application/json`

### Request Format

```json
{
  "text": "Your message text here",
  "phones": "1234567890"
}
```

**Note**: Phone numbers should be in international format without the `+` prefix (e.g., `1234567890` for US numbers).

### Response Format

```json
{
  "id": "message_id",
  "href": "/api/v2/messages/message_id",
  "type": "message",
  "sessionId": "session_id",
  "messageId": "message_id"
}
```

## Features

### Automatic SMS Notifications

When a found disc is reported with a phone number, the system will:

1. Validate the phone number format
2. Check if the source has a message template configured
3. Send an SMS notification using TextMagic
4. Display success/error messages to the user

### Phone Number Validation

The system validates phone numbers to ensure they are:
- In a valid format (US phone numbers supported)
- Properly normalized to E.164 format
- Compatible with SMS sending

### Error Handling

The integration includes comprehensive error handling for:
- Missing or invalid credentials
- Invalid phone numbers
- API errors from TextMagic
- Network connectivity issues

## Troubleshooting

### Common Issues

1. **"SMS service not configured" error**
   - Check that both `REACT_APP_TEXTMAGIC_USERNAME` and `REACT_APP_TEXTMAGIC_API_KEY` are set in `.env.local`
   - Restart your development server after updating environment variables

2. **"TextMagic API error: 401" - Authentication failed**
   - Verify your username and API key are correct
   - Ensure there are no extra spaces in your credentials

3. **"TextMagic API error: 402" - Insufficient credits**
   - Check your TextMagic account balance
   - Add credits to your account if needed

4. **Phone number validation errors**
   - Ensure phone numbers are in valid US format
   - The system expects 10-digit US numbers (with or without country code)

### Testing Without Sending SMS

For development and testing, you can modify the `sendSMS` function to simulate sending without making actual API calls. Look for the console.log statements that show what would be sent.

## Migration from Twilio

The following changes were made during the migration:

1. **Environment Variables**: Replaced Twilio credentials with TextMagic credentials
2. **API Integration**: Updated SMS service to use TextMagic REST API
3. **Authentication**: Changed from Twilio's account SID/token to TextMagic's username/API key
4. **Phone Number Format**: Adjusted for TextMagic's expected format (no + prefix)
5. **Error Handling**: Updated error messages and handling for TextMagic responses

### Removed Files/References

- Twilio environment variables in `.env.local`
- Twilio-specific error messages and logging

### Updated Files

- `src/lib/smsService.ts` - Main SMS service implementation
- `test-sms-functionality.js` - Test script
- `.env.local` - Environment configuration

## Support

For TextMagic-specific issues:
- **Documentation**: [https://docs.textmagic.com](https://docs.textmagic.com)
- **Support**: [https://support.textmagic.com](https://support.textmagic.com)

For application-specific issues, refer to the main project documentation.
