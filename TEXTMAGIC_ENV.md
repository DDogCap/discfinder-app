# Configure TextMagic credentials in Vercel

To enable the serverless SMS function (api/send-sms.js), add these Environment Variables in your Vercel project settings:

- TEXTMAGIC_USERNAME = your TextMagic username
- TEXTMAGIC_API_KEY = your TextMagic API key

Recommended: set them for both Production and Preview environments.

After saving, redeploy the project so the variables are available to the function.

Security: Do not commit credentials to source control. They must only live in Vercel env vars.

