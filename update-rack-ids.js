/**
 * Update existing found_discs records with rack_id values from CSV
 * 
 * This script:
 * 1. Reads the found_discs.csv file
 * 2. Maps the integer ID field to rack_id for existing records
 * 3. Updates the database with the rack_id values
 * 
 * Prerequisites:
 * 1. ADD_RACK_ID.sql must be run first to add the rack_id column
 * 2. found_discs.csv must be in external_data/ directory
 * 3. Found discs must already be imported
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

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

/**
 * Parse CSV line handling quoted fields
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
 * Read and parse CSV file
 */
function readCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    throw new Error('CSV file is empty');
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
 * Update rack_id for a single found disc
 */
async function updateRackId(legacyRowId, rackId) {
  try {
    // First check if this rack_id is already in use
    const { data: existingDisc, error: checkError } = await supabase
      .from('found_discs')
      .select('id, legacy_row_id')
      .eq('rack_id', rackId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw checkError;
    }

    if (existingDisc && existingDisc.legacy_row_id !== legacyRowId) {
      return {
        success: false,
        error: `Rack ID ${rackId} already in use by disc ${existingDisc.legacy_row_id}`
      };
    }

    // Update the disc with the new rack_id
    const { data, error } = await supabase
      .from('found_discs')
      .update({ rack_id: rackId })
      .eq('legacy_row_id', legacyRowId)
      .select('id, rack_id');

    if (error) {
      throw error;
    }

    if (data && data.length > 0) {
      return { success: true, updated: data[0] };
    } else {
      return { success: false, error: 'No record found with that legacy_row_id' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Update rack IDs from CSV
 */
async function updateRackIdsFromCSV() {
  console.log('🚀 Starting rack_id update from CSV...\n');

  const results = {
    updated: 0,
    failed: 0,
    skipped: 0,
    errors: []
  };

  try {
    // Read CSV file
    const csvPath = path.join(__dirname, 'external_data', 'found_discs.csv');
    console.log(`📖 Reading CSV file: ${csvPath}`);
    
    const records = readCSV(csvPath);
    console.log(`Found ${records.length} records in CSV\n`);

    // Process each record
    for (const [index, record] of records.entries()) {
      try {
        const legacyRowId = record['🔒 Row ID'];
        const csvId = record['ID'];

        // Skip records without required data
        if (!legacyRowId) {
          results.skipped++;
          console.log(`⚠️  Row ${index + 2}: Skipped record without legacy Row ID`);
          continue;
        }

        if (!csvId || csvId.trim() === '') {
          results.skipped++;
          console.log(`⚠️  Row ${index + 2}: Skipped record without ID field`);
          continue;
        }

        // Parse ID as integer
        const rackId = parseInt(csvId);
        if (isNaN(rackId)) {
          results.skipped++;
          console.log(`⚠️  Row ${index + 2}: Skipped record with non-numeric ID: ${csvId}`);
          continue;
        }

        console.log(`📝 Processing: ${legacyRowId} -> Rack ID: ${rackId}`);

        const result = await updateRackId(legacyRowId, rackId);

        if (result.success) {
          results.updated++;
          console.log(`✅ Updated: ${legacyRowId} -> Rack ID: ${rackId}`);
        } else {
          results.failed++;
          results.errors.push(`${legacyRowId}: ${result.error}`);
          console.error(`❌ Failed: ${legacyRowId} - ${result.error}`);
        }

        // Add small delay to avoid overwhelming the database
        if (index % 50 === 0 && index > 0) {
          console.log(`   ... processed ${index + 1} records`);
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (error) {
        results.failed++;
        const legacyRowId = record['🔒 Row ID'] || `Row ${index + 2}`;
        results.errors.push(`${legacyRowId}: ${error.message}`);
        console.error(`❌ Exception processing ${legacyRowId}:`, error);
      }
    }

    // Final results
    console.log('\n🎉 Rack ID update completed!');
    console.log('📊 Summary:');
    console.log(`   ✅ Updated: ${results.updated}`);
    console.log(`   ❌ Failed: ${results.failed}`);
    console.log(`   ⚠️  Skipped: ${results.skipped}`);

    if (results.errors.length > 0) {
      console.log('\n❌ Errors:');
      results.errors.slice(0, 10).forEach(error => {
        console.log(`   - ${error}`);
      });
      if (results.errors.length > 10) {
        console.log(`   ... and ${results.errors.length - 10} more errors`);
      }
    }

    return results;

  } catch (error) {
    console.error('💥 Update failed:', error);
    throw error;
  }
}

/**
 * Show current rack_id statistics
 */
async function showRackIdStats() {
  try {
    console.log('\n📊 Current rack_id statistics:');
    
    // Count records with rack_id
    const { data: withRackId, error: withError } = await supabase
      .from('found_discs')
      .select('rack_id')
      .not('rack_id', 'is', null);
    
    if (withError) {
      console.error('Error getting rack_id stats:', withError);
      return;
    }
    
    console.log(`   - Records with rack_id: ${withRackId.length}`);
    
    if (withRackId.length > 0) {
      const rackIds = withRackId.map(r => r.rack_id);
      const maxRackId = Math.max(...rackIds);
      const minRackId = Math.min(...rackIds);
      console.log(`   - Rack ID range: ${minRackId} to ${maxRackId}`);
    }
    
    // Count records without rack_id
    const { data: withoutRackId, error: withoutError } = await supabase
      .from('found_discs')
      .select('id')
      .is('rack_id', null);
    
    if (!withoutError) {
      console.log(`   - Records without rack_id: ${withoutRackId.length}`);
    }
    
  } catch (error) {
    console.error('Error showing rack_id stats:', error);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--stats')) {
    await showRackIdStats();
  } else if (args.includes('--help')) {
    console.log('Usage: node update-rack-ids.js [options]');
    console.log('Options:');
    console.log('  --stats       Show current rack_id statistics');
    console.log('  --help        Show this help message');
    console.log('');
    console.log('This script updates existing found_discs records with rack_id values from CSV.');
    console.log('Make sure to run ADD_RACK_ID.sql first to add the rack_id column.');
  } else {
    try {
      const results = await updateRackIdsFromCSV();
      
      if (results.updated > 0) {
        console.log('\n📋 Next steps:');
        console.log('1. Verify rack_id values in your admin dashboard');
        console.log('2. Test searching by rack_id');
        console.log('3. Update UI to display rack_id for disc management');
      }
      
      await showRackIdStats();
    } catch (error) {
      console.error('\n💥 Update failed:', error);
      process.exit(1);
    }
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  updateRackIdsFromCSV,
  showRackIdStats
};
