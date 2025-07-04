/**
 * Found Disc Import Script
 * 
 * This script imports found discs from the legacy Glide app CSV into the DiscFinder Supabase database.
 * 
 * Prerequisites:
 * 1. Install @supabase/supabase-js: npm install @supabase/supabase-js
 * 2. Set up environment variables for Supabase
 * 3. Run the ADD_FOUND_DISC_IMPORT_FIELDS.sql migration in Supabase
 * 4. Ensure sources have been imported with legacy_row_id mapping
 * 
 * Usage:
 * node import-found-discs.js
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
    // Handle formats like "4/26/2024, 4:26:46 PM" or "4/26/2021 16:53:00"
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
 * Extract brand and mold from description
 */
function extractBrandAndMold(description, mold) {
  if (!description) return { brand: '', mold: mold || '' };
  
  // Common brand patterns
  const brandPatterns = [
    /^(Innova)\s+/i,
    /^(Discraft)\s+/i,
    /^(Dynamic\s*Disc?s?)\s+/i,
    /^(Latitude\s*64|Lat64)\s+/i,
    /^(Westside)\s+/i,
    /^(MVP)\s+/i,
    /^(Axiom)\s+/i,
    /^(Prodigy)\s+/i,
    /^(Discmania)\s+/i,
    /^(Gateway)\s+/i,
    /^(Millennium)\s+/i,
    /^(Legacy)\s+/i,
    /^(Vibram)\s+/i
  ];
  
  let brand = '';
  let extractedMold = mold || '';
  
  for (const pattern of brandPatterns) {
    const match = description.match(pattern);
    if (match) {
      brand = match[1];
      // Try to extract mold from remaining text
      const remaining = description.replace(pattern, '').trim();
      const moldMatch = remaining.match(/^([A-Za-z0-9\-\s]+)/);
      if (moldMatch && !extractedMold) {
        extractedMold = moldMatch[1].trim().split(/\s+/)[0]; // Take first word as mold
      }
      break;
    }
  }
  
  // If no brand found, try to extract from description
  if (!brand && description) {
    const words = description.split(/\s+/);
    if (words.length > 0) {
      brand = words[0];
      if (words.length > 1 && !extractedMold) {
        extractedMold = words[1];
      }
    }
  }
  
  return { brand: brand || 'Unknown', mold: extractedMold };
}

/**
 * Extract color from description
 */
function extractColor(description) {
  if (!description) return '';
  
  const colorPatterns = [
    /\b(red|blue|green|yellow|orange|purple|pink|white|black|clear|grey|gray)\b/i,
    /\b(champion|star|dx|pro|gstar|xt|r-pro)\s+(red|blue|green|yellow|orange|purple|pink|white|black|clear|grey|gray)\b/i
  ];
  
  for (const pattern of colorPatterns) {
    const match = description.match(pattern);
    if (match) {
      return match[match.length - 1]; // Return the last captured group (the color)
    }
  }
  
  return '';
}

/**
 * Extract PDGA number from name
 */
function extractPDGANumber(name) {
  if (!name) return null;
  
  const pdgaMatch = name.match(/#?\s*(\d{4,6})/);
  return pdgaMatch ? parseInt(pdgaMatch[1]) : null;
}

/**
 * Determine return status from returned date
 */
function getReturnStatus(returnedDate) {
  return returnedDate ? 'Returned to Owner' : 'Found';
}

/**
 * Map CSV record to found disc data
 */
function mapCSVRecordToFoundDisc(record) {
  const description = record['Description'] || '';
  const mold = record['Mold'] || '';
  const { brand, mold: extractedMold } = extractBrandAndMold(description, mold);
  const color = extractColor(description);
  
  const ownerPDGA = extractPDGANumber(record['Disc Owner Name']);
  const returnedDate = parseDate(record['Returned Date']);
  
  // Build image URLs array
  const imageUrls = [];
  if (record['Image'] && record['Image'].trim()) {
    imageUrls.push(record['Image'].trim());
  }
  if (record['Image2'] && record['Image2'].trim()) {
    imageUrls.push(record['Image2'].trim());
  }
  
  return {
    p_legacy_row_id: record['🔒 Row ID'] || record['ID'],
    p_finder_email: null, // Will be mapped later based on entered_by
    p_brand: brand,
    p_mold: extractedMold,
    p_color: color || 'Unknown',
    p_description: description,
    p_phone_number: record['Disc Owner Phone'] || null,
    p_name_on_disc: record['Disc Owner Name'] || null,
    p_owner_email: null, // Will be extracted from contact info later
    p_owner_pdga_number: ownerPDGA,
    p_location_found: 'Exact location unknown.', // Default, will be updated with source info
    p_source_legacy_id: record['SourceID'] || null,
    p_found_date: parseDate(record['Entry Date']) ? parseDate(record['Entry Date']).split('T')[0] : new Date().toISOString().split('T')[0], // Use entry date as found date
    p_entry_date: parseDate(record['Entry Date']),
    p_entered_by_name: record['Entered By'] || null,
    p_returned_date: returnedDate,
    p_returned_by_name: record['Returned By'] || null,
    p_return_status: getReturnStatus(returnedDate),
    p_returned_notes: null, // Could be derived from contact notes
    p_image_urls: imageUrls.length > 0 ? imageUrls : null,
    p_private_identifier: record['Private Identifier'] || null
  };
}

/**
 * Import a single found disc using the database function
 */
async function importSingleFoundDisc(discData) {
  try {
    const { data, error } = await supabase.rpc('import_legacy_found_disc', discData);

    if (error) {
      console.error('Error importing found disc:', error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data };
  } catch (err) {
    console.error('Exception importing found disc:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Import found discs from CSV file
 */
async function importFoundDiscsFromCSV() {
  console.log('🚀 Starting found disc import from CSV...\n');

  const results = {
    imported: 0,
    failed: 0,
    skipped: 0,
    errors: []
  };

  try {
    // Parse CSV file
    console.log(`📖 Reading CSV file: ${CSV_FILE_PATH}`);
    const records = parseCSV(CSV_FILE_PATH);
    console.log(`Found ${records.length} records to process\n`);

    // Import each found disc
    for (const [index, record] of records.entries()) {
      try {
        // Skip records without required data
        if (!record['🔒 Row ID'] && !record['ID']) {
          results.skipped++;
          console.log(`⚠️  Row ${index + 2}: Skipped record without Row ID`);
          continue;
        }

        const discData = mapCSVRecordToFoundDisc(record);
        const rowId = discData.p_legacy_row_id;

        console.log(`📝 Processing: ${rowId} - ${discData.p_brand} ${discData.p_mold}`);

        const result = await importSingleFoundDisc(discData);

        if (result.success) {
          results.imported++;
          console.log(`✅ Imported: ${rowId}`);
        } else {
          results.failed++;
          results.errors.push(`${rowId}: ${result.error}`);
          console.error(`❌ Failed: ${rowId} - ${result.error}`);
        }

        // Add small delay to avoid overwhelming the database
        if (index % 10 === 0 && index > 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (error) {
        results.failed++;
        const rowId = record['🔒 Row ID'] || record['ID'] || `Row ${index + 2}`;
        results.errors.push(`${rowId}: ${error.message}`);
        console.error(`❌ Exception processing ${rowId}:`, error);
      }
    }

    // Print summary
    console.log('\n📊 Import Summary:');
    console.log(`✅ Successfully imported: ${results.imported}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`⚠️  Skipped: ${results.skipped}`);
    console.log(`📝 Total processed: ${results.imported + results.failed + results.skipped}`);

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
  console.log(`🧪 Testing import with first ${limit} records...\n`);

  try {
    const records = parseCSV(CSV_FILE_PATH);
    const testRecords = records.slice(0, limit);

    console.log('Test records:');
    testRecords.forEach((record, index) => {
      const discData = mapCSVRecordToFoundDisc(record);
      console.log(`${index + 1}. ${discData.p_legacy_row_id}: ${discData.p_brand} ${discData.p_mold} (${discData.p_color})`);
    });

    console.log('\nProceed with test import? (This will actually import these records)');
    console.log('Press Ctrl+C to cancel, or any key to continue...');

    // In a real scenario, you might want to add readline for user confirmation
    // For now, we'll just proceed

    for (const record of testRecords) {
      const discData = mapCSVRecordToFoundDisc(record);
      const result = await importSingleFoundDisc(discData);

      if (result.success) {
        console.log(`✅ Test import successful: ${discData.p_legacy_row_id}`);
      } else {
        console.error(`❌ Test import failed: ${discData.p_legacy_row_id} - ${result.error}`);
      }
    }

  } catch (error) {
    console.error('Test import failed:', error);
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

  if (args.includes('--help')) {
    console.log('Found Disc Import Script');
    console.log('');
    console.log('Usage:');
    console.log('  node import-found-discs.js           # Import all found discs');
    console.log('  node import-found-discs.js --test 5  # Test import with 5 records');
    console.log('  node import-found-discs.js --help    # Show this help');
    return;
  }

  try {
    const results = await importFoundDiscsFromCSV();

    if (results.imported > 0) {
      console.log('\n🎉 Import completed successfully!');
      console.log('\n📋 Next steps:');
      console.log('1. Run image migration to download and upload images to Supabase Storage');
      console.log('2. Import contact attempts data');
      console.log('3. Verify found disc data in your admin dashboard');
      console.log('4. Test search functionality with imported data');
    } else {
      console.log('\n⚠️  No found discs were imported. Check the errors above.');
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
  importFoundDiscsFromCSV,
  mapCSVRecordToFoundDisc,
  parseCSV,
  testImport
};
