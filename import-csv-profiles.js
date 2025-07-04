/**
 * CSV Profile Import Script
 * 
 * This script imports profiles from the exported CSV file into the DiscFinder Supabase database.
 * 
 * Usage:
 * node import-csv-profiles.js
 */

// Load environment variables
require('./load-env');

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// CSV file path
const CSV_FILE_PATH = path.join(__dirname, 'external_data', 'admins.csv');

/**
 * Parse CSV file
 */
function parseCSV(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').map(line => line.trim()).filter(line => line);
  
  if (lines.length < 2) {
    throw new Error('CSV file must have at least a header and one data row');
  }

  // Parse header
  const header = lines[0].split(',').map(col => col.trim());
  console.log('📋 CSV Headers:', header);

  // Parse data rows
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length !== header.length) {
      console.warn(`⚠️  Row ${i + 1} has ${values.length} columns, expected ${header.length}. Skipping.`);
      continue;
    }

    const record = {};
    header.forEach((col, index) => {
      record[col] = values[index] || '';
    });
    records.push(record);
  }

  return records;
}

/**
 * Parse a single CSV line, handling commas within quoted fields
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

/**
 * Maps a CSV record to our profile import format
 */
function mapCSVRecordToProfile(record) {
  // Map role - blank roles become 'guest'
  let role = 'guest';
  if (record.Role) {
    const lowerRole = record.Role.toLowerCase();
    if (lowerRole === 'admin') {
      role = 'admin';
    } else if (lowerRole === 'rakerdiver') {
      role = 'rakerdiver';
    } else if (lowerRole === 'user') {
      role = 'user';
    }
  }

  // Parse PDGA number
  let pdgaNumber = null;
  if (record['PDGA #'] && record['PDGA #'].trim()) {
    const parsed = parseInt(record['PDGA #'].trim());
    if (!isNaN(parsed)) {
      pdgaNumber = parsed;
    }
  }

  return {
    p_email: record.Email?.trim(),
    p_full_name: record.Name?.trim() || '',
    p_role: role,
    p_legacy_row_id: record['DefaultSourceRowID']?.trim() || record['🔒 Row ID']?.trim(),
    p_pdga_number: pdgaNumber,
    p_facebook_profile: record['Facebook Profile']?.trim(),
    p_instagram_handle: null, // Not in CSV
    p_sms_number: record['Phone Number for Text Messages']?.trim(),
    p_phone_number: record['Phone Number for Text Messages']?.trim(),
    p_avatar_url: record.Photo?.trim(),
  };
}

/**
 * Imports a single profile using the database function
 */
async function importSingleProfile(profileData) {
  try {
    const { data, error } = await supabase.rpc('import_legacy_profile', profileData);

    if (error) {
      console.error('Error importing profile:', error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data };
  } catch (err) {
    console.error('Exception importing profile:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Main import function
 */
async function importProfilesFromCSV() {
  try {
    console.log('🚀 Starting CSV profile import...');
    console.log(`📁 Reading from: ${CSV_FILE_PATH}`);
    
    // Parse CSV
    const records = parseCSV(CSV_FILE_PATH);
    console.log(`📊 Found ${records.length} records to process`);

    const results = {
      imported: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };

    // Import each profile
    for (const [index, record] of records.entries()) {
      try {
        // Skip records without email
        if (!record.Email || !record.Email.trim()) {
          results.skipped++;
          console.log(`⚠️  Row ${index + 2}: Skipped record without email`);
          continue;
        }

        const profileData = mapCSVRecordToProfile(record);
        console.log(`📝 Processing: ${profileData.p_email} (${profileData.p_role})`);
        
        const result = await importSingleProfile(profileData);

        if (result.success) {
          results.imported++;
          console.log(`✅ Imported: ${profileData.p_email}`);
        } else {
          results.failed++;
          results.errors.push(`${profileData.p_email}: ${result.error}`);
          console.error(`❌ Failed: ${profileData.p_email} - ${result.error}`);
        }
      } catch (err) {
        results.failed++;
        const email = record.Email || `Row ${index + 2}`;
        const errorMsg = err.message || 'Unknown error';
        results.errors.push(`${email}: ${errorMsg}`);
        console.error(`❌ Exception processing ${email}:`, err);
      }
    }

    console.log('\n📈 Import Summary:');
    console.log(`✅ Successfully imported: ${results.imported}`);
    console.log(`⚠️  Skipped (no email): ${results.skipped}`);
    console.log(`❌ Failed: ${results.failed}`);
    
    if (results.errors.length > 0) {
      console.log('\n🚨 Errors:');
      results.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }

    return results;
  } catch (error) {
    console.error('❌ Fatal error during import:', error);
    throw error;
  }
}

/**
 * Validates the setup
 */
async function validateSetup() {
  console.log('🔍 Validating setup...');
  
  try {
    // Test CSV file exists
    if (!fs.existsSync(CSV_FILE_PATH)) {
      console.error(`❌ CSV file not found: ${CSV_FILE_PATH}`);
      return false;
    }
    console.log('✅ CSV file found');

    // Test Supabase connection
    const { data, error } = await supabase.from('imported_profiles_staging').select('count').limit(1);
    if (error) {
      console.error('❌ Supabase connection failed:', error.message);
      return false;
    }
    console.log('✅ Supabase connection successful');

    // Check if import function exists
    const { error: funcError } = await supabase.rpc('import_legacy_profile', {
      p_email: 'test@example.com',
      p_full_name: 'Test User',
      p_role: 'user'
    });
    
    if (funcError && !funcError.message.includes('duplicate key')) {
      console.error('❌ import_legacy_profile function not found. Please run the migration.');
      return false;
    }
    console.log('✅ Database functions available');

    return true;
  } catch (error) {
    console.error('❌ Setup validation failed:', error);
    return false;
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('🎯 DiscFinder CSV Profile Import Tool');
  console.log('====================================\n');

  // Validate setup
  const isValid = await validateSetup();
  if (!isValid) {
    console.log('\n❌ Setup validation failed. Please fix the issues above and try again.');
    process.exit(1);
  }

  try {
    const results = await importProfilesFromCSV();
    
    if (results.imported > 0) {
      console.log('\n🎉 Import completed successfully!');
      console.log('\n📋 Next steps:');
      console.log('1. Check the imported profiles in your admin dashboard');
      console.log('2. Test user signup with imported email addresses');
      console.log('3. Verify profile data and roles are correct');
    } else {
      console.log('\n⚠️  No profiles were imported. Check the errors above.');
    }
  } catch (error) {
    console.error('\n💥 Import failed:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { importProfilesFromCSV, mapCSVRecordToProfile };
