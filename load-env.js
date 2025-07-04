/**
 * Environment loader for Node.js scripts
 * Loads environment variables from .env.local
 */

const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '.env.local');
  
  if (!fs.existsSync(envPath)) {
    console.warn('⚠️  .env.local file not found');
    return;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const lines = envContent.split('\n');
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip empty lines and comments
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }
    
    // Parse key=value pairs
    const equalIndex = trimmedLine.indexOf('=');
    if (equalIndex === -1) {
      continue;
    }
    
    const key = trimmedLine.substring(0, equalIndex).trim();
    const value = trimmedLine.substring(equalIndex + 1).trim();
    
    // Set environment variable if not already set
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

// Load environment variables
loadEnv();

// Export for use in other scripts
module.exports = { loadEnv };
