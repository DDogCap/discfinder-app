/**
 * Contact Attempts Import Script
 * 
 * This script imports contact attempt data from the found_discs CSV into the contact_attempts table.
 * It extracts contact information from CSV fields like Contact Notes, Initial Text Message Sent, 
 * Last Text Sent, etc. and creates proper contact attempt records.
 * 
 * Prerequisites:
 * 1. Found discs must already be imported with legacy_row_id mapping
 * 2. Contact attempts table must exist (ADD_CONTACT_ATTEMPTS.sql)
 * 3. Set up environment variables for Supabase
 * 
 * Usage:
 * node import-contact-attempts.js
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Environment variables
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:');
  console.error('- REACT_APP_SUPABASE_URL');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// CSV file path
const CSV_FILE_PATH = path.join(__dirname, 'external_data', 'found_discs.csv');

/**
 * Parse CSV file (reusing from import-found-discs.js)
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
  const header = lines[0].split(',').map(col => col.replace(/"/g, '').trim());
  
  // Parse data rows
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length !== header.length) {
      console.warn(`Row ${i + 1}: Column count mismatch (expected ${header.length}, got ${values.length})`);
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
 * Parse a single CSV line handling quoted values and commas
 */
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  values.push(current.trim());
  return values;
}

/**
 * Parse date string from various formats
 */
function parseDate(dateStr) {
  if (!dateStr || dateStr.trim() === '') return null;
  
  try {
    const cleanDate = dateStr.replace(/"/g, '').trim();
    const date = new Date(cleanDate);
    
    if (isNaN(date.getTime())) {
      console.warn(`Invalid date format: ${dateStr}`);
      return null;
    }
    
    return date.toISOString();
  } catch (error) {
    console.warn(`Error parsing date: ${dateStr}`, error);
    return null;
  }
}

/**
 * Extract contact attempts from CSV record
 */
function extractContactAttempts(record, foundDiscId) {
  const attempts = [];
  const legacyRowId = record['🔒 Row ID'] || record['ID'];
  const entryDate = parseDate(record['Entry Date']);
  
  // 1. Contact Notes (general contact attempt)
  const contactNotes = record['Contact Notes'];
  if (contactNotes && contactNotes.trim() && contactNotes.trim() !== '') {
    attempts.push({
      found_disc_id: foundDiscId,
      attempted_at: entryDate || new Date().toISOString(),
      contact_method: 'Notes',
      message_content: contactNotes.trim(),
      attempted_by_name: record['Entered By'] || 'Unknown',
      response_received: false,
      notes: `Legacy contact notes from disc ${legacyRowId}`
    });
  }
  
  // 2. Initial Text Message Sent
  const initialText = record['Initial Text Message Sent'];
  const initialTextDate = parseDate(record['Initial Text Message Sent Date']) || entryDate;
  if (initialText && initialText.trim() && initialText.trim() !== '') {
    attempts.push({
      found_disc_id: foundDiscId,
      attempted_at: initialTextDate || new Date().toISOString(),
      contact_method: 'SMS',
      message_content: initialText.trim(),
      attempted_by_name: record['Entered By'] || 'Unknown',
      response_received: false,
      notes: `Initial text message from disc ${legacyRowId}`
    });
  }
  
  // 3. Last Text Sent
  const lastText = record['Last Text Sent'];
  const lastTextDate = parseDate(record['Last Text Sent Date']);
  if (lastText && lastText.trim() && lastText.trim() !== '' && lastTextDate) {
    attempts.push({
      found_disc_id: foundDiscId,
      attempted_at: lastTextDate,
      contact_method: 'SMS',
      message_content: lastText.trim(),
      attempted_by_name: record['Entered By'] || 'Unknown',
      response_received: false,
      notes: `Last text message from disc ${legacyRowId}`
    });
  }
  
  // 4. If there's a claimed proof, that indicates a response
  const claimedProof = record['Claimed Proof'];
  const claimedDate = parseDate(record['Claimed Date']);
  if (claimedProof && claimedProof.trim() && claimedDate) {
    attempts.push({
      found_disc_id: foundDiscId,
      attempted_at: claimedDate,
      contact_method: 'Response',
      message_content: 'Disc owner provided claim proof',
      attempted_by_name: 'Disc Owner',
      response_received: true,
      response_content: claimedProof.trim(),
      notes: `Owner response/claim proof from disc ${legacyRowId}`
    });
  }
  
  return attempts;
}

/**
 * Get found disc ID by legacy row ID
 */
async function getFoundDiscId(legacyRowId) {
  try {
    const { data, error } = await supabase
      .from('found_discs')
      .select('id')
      .eq('legacy_row_id', legacyRowId)
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return data?.id || null;
  } catch (error) {
    console.warn(`Could not find found disc for legacy row ID ${legacyRowId}: ${error.message}`);
    return null;
  }
}

/**
 * Import a single contact attempt
 */
async function importContactAttempt(attempt) {
  try {
    const { data, error } = await supabase
      .from('contact_attempts')
      .insert([attempt])
      .select()
      .single();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return { success: true, id: data.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Import contact attempts from CSV
 */
async function importContactAttemptsFromCSV() {
  console.log('🚀 Starting contact attempts import from CSV...\n');

  const results = {
    processedRecords: 0,
    foundDiscs: 0,
    contactAttempts: 0,
    importedAttempts: 0,
    failedAttempts: 0,
    skippedRecords: 0,
    errors: []
  };

  try {
    // Parse CSV file
    console.log(`📖 Reading CSV file: ${CSV_FILE_PATH}`);
    const records = parseCSV(CSV_FILE_PATH);
    console.log(`Found ${records.length} records to process\n`);

    // Process each record
    for (const [index, record] of records.entries()) {
      results.processedRecords++;
      
      try {
        const legacyRowId = record['🔒 Row ID'] || record['ID'];
        
        if (!legacyRowId) {
          results.skippedRecords++;
          console.log(`⚠️  Row ${index + 2}: Skipped record without Row ID`);
          continue;
        }

        // Get found disc ID
        const foundDiscId = await getFoundDiscId(legacyRowId);
        if (!foundDiscId) {
          results.skippedRecords++;
          console.log(`⚠️  Row ${index + 2}: Could not find found disc for ${legacyRowId}`);
          continue;
        }

        results.foundDiscs++;

        // Extract contact attempts
        const attempts = extractContactAttempts(record, foundDiscId);
        results.contactAttempts += attempts.length;

        if (attempts.length === 0) {
          console.log(`📝 ${legacyRowId}: No contact attempts found`);
          continue;
        }

        console.log(`📝 ${legacyRowId}: Found ${attempts.length} contact attempt(s)`);

        // Import each contact attempt
        for (const attempt of attempts) {
          const result = await importContactAttempt(attempt);
          
          if (result.success) {
            results.importedAttempts++;
            console.log(`  ✅ Imported ${attempt.contact_method}: ${attempt.message_content.substring(0, 50)}...`);
          } else {
            results.failedAttempts++;
            results.errors.push(`${legacyRowId} (${attempt.contact_method}): ${result.error}`);
            console.error(`  ❌ Failed ${attempt.contact_method}: ${result.error}`);
          }
        }

        // Add small delay every 10 records
        if (index % 10 === 0 && index > 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (error) {
        results.failedAttempts++;
        const rowId = record['🔒 Row ID'] || record['ID'] || `Row ${index + 2}`;
        results.errors.push(`${rowId}: ${error.message}`);
        console.error(`❌ Exception processing ${rowId}:`, error);
      }
    }

    // Print summary
    console.log('\n📊 Import Summary:');
    console.log(`📝 Records processed: ${results.processedRecords}`);
    console.log(`📀 Found discs matched: ${results.foundDiscs}`);
    console.log(`📞 Contact attempts found: ${results.contactAttempts}`);
    console.log(`✅ Successfully imported: ${results.importedAttempts}`);
    console.log(`❌ Failed: ${results.failedAttempts}`);
    console.log(`⚠️  Skipped records: ${results.skippedRecords}`);

    if (results.errors.length > 0) {
      console.log('\n❌ Errors:');
      results.errors.slice(0, 10).forEach(error => console.log(`  - ${error}`));
      if (results.errors.length > 10) {
        console.log(`  ... and ${results.errors.length - 10} more errors`);
      }
    }

    return results;

  } catch (error) {
    console.error('💥 Import failed:', error);
    throw error;
  }
}

/**
 * Test import with a small subset of data
 */
async function testImport(limit = 5) {
  console.log(`🧪 Testing contact attempts import with first ${limit} records...\n`);

  try {
    const records = parseCSV(CSV_FILE_PATH);
    const testRecords = records.slice(0, limit);

    console.log('Test records:');
    for (const [index, record] of testRecords.entries()) {
      const legacyRowId = record['🔒 Row ID'] || record['ID'];
      const foundDiscId = await getFoundDiscId(legacyRowId);
      const attempts = extractContactAttempts(record, foundDiscId || 'test-id');

      console.log(`${index + 1}. ${legacyRowId}: ${attempts.length} contact attempt(s)`);
      attempts.forEach((attempt, i) => {
        console.log(`   ${i + 1}. ${attempt.contact_method}: ${attempt.message_content.substring(0, 50)}...`);
      });
    }

    console.log('\nProceed with test import? (This will actually import these contact attempts)');
    console.log('Press Ctrl+C to cancel, or any key to continue...');

    // Process test records
    let imported = 0;
    let failed = 0;

    for (const record of testRecords) {
      const legacyRowId = record['🔒 Row ID'] || record['ID'];
      const foundDiscId = await getFoundDiscId(legacyRowId);

      if (!foundDiscId) {
        console.log(`⚠️  Skipping ${legacyRowId}: Found disc not found`);
        continue;
      }

      const attempts = extractContactAttempts(record, foundDiscId);

      for (const attempt of attempts) {
        const result = await importContactAttempt(attempt);

        if (result.success) {
          imported++;
          console.log(`✅ Imported: ${legacyRowId} - ${attempt.contact_method}`);
        } else {
          failed++;
          console.error(`❌ Failed: ${legacyRowId} - ${attempt.contact_method}: ${result.error}`);
        }
      }
    }

    console.log(`\n📊 Test Results: ${imported} imported, ${failed} failed`);

  } catch (error) {
    console.error('Test import failed:', error);
  }
}

/**
 * Check contact attempts status
 */
async function checkContactAttemptsStatus() {
  try {
    console.log('📊 Checking contact attempts status...\n');

    // Get total contact attempts
    const { data: attempts, error: attemptsError } = await supabase
      .from('contact_attempts')
      .select('id, contact_method, attempted_at, found_disc_id')
      .order('attempted_at', { ascending: false });

    if (attemptsError) {
      throw new Error(`Failed to fetch contact attempts: ${attemptsError.message}`);
    }

    // Get found discs with legacy data
    const { data: discs, error: discsError } = await supabase
      .from('found_discs')
      .select('id, legacy_row_id')
      .not('legacy_row_id', 'is', null);

    if (discsError) {
      throw new Error(`Failed to fetch found discs: ${discsError.message}`);
    }

    // Count by method
    const methodCounts = {};
    attempts.forEach(attempt => {
      methodCounts[attempt.contact_method] = (methodCounts[attempt.contact_method] || 0) + 1;
    });

    // Count discs with contact attempts
    const discsWithAttempts = new Set(attempts.map(a => a.found_disc_id)).size;

    console.log(`📞 Total contact attempts: ${attempts.length}`);
    console.log(`📀 Found discs with contact attempts: ${discsWithAttempts} / ${discs.length}`);
    console.log('\n📊 Contact attempts by method:');
    Object.entries(methodCounts).forEach(([method, count]) => {
      console.log(`  ${method}: ${count}`);
    });

    if (attempts.length > 0) {
      const latest = attempts[0];
      console.log(`\n🕒 Latest contact attempt: ${latest.attempted_at} (${latest.contact_method})`);
    }

  } catch (error) {
    console.error('Status check failed:', error);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--test')) {
    const limit = parseInt(args[args.indexOf('--test') + 1]) || 5;
    await testImport(limit);
    return;
  }

  if (args.includes('--status')) {
    await checkContactAttemptsStatus();
    return;
  }

  if (args.includes('--help')) {
    console.log('Contact Attempts Import Script');
    console.log('');
    console.log('Usage:');
    console.log('  node import-contact-attempts.js           # Import all contact attempts');
    console.log('  node import-contact-attempts.js --test 5  # Test import with 5 records');
    console.log('  node import-contact-attempts.js --status  # Check contact attempts status');
    console.log('  node import-contact-attempts.js --help    # Show this help');
    return;
  }

  try {
    const results = await importContactAttemptsFromCSV();

    if (results.importedAttempts > 0) {
      console.log('\n🎉 Contact attempts import completed!');
      console.log('\n📋 Next steps:');
      console.log('1. Verify contact attempts in your admin dashboard');
      console.log('2. Test contact tracking functionality');
      console.log('3. Review any failed imports and address issues');
    } else {
      console.log('\n⚠️  No contact attempts were imported. Check the errors above.');
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

module.exports = {
  importContactAttemptsFromCSV,
  extractContactAttempts,
  testImport,
  checkContactAttemptsStatus
};
