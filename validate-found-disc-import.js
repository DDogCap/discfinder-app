/**
 * Found Disc Import Validation Script
 * 
 * This script validates the found disc import data, handles source mapping,
 * and provides data consistency checks before and after import.
 * 
 * Prerequisites:
 * 1. Sources must be imported with legacy_row_id mapping
 * 2. Set up environment variables for Supabase
 * 
 * Usage:
 * node validate-found-disc-import.js
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
 * Parse CSV file (reusing from other scripts)
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
 * Get all sources from database
 */
async function getAllSources() {
  try {
    const { data, error } = await supabase
      .from('sources')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch sources: ${error.message}`);
    }

    return data;
  } catch (error) {
    throw new Error(`Database query failed: ${error.message}`);
  }
}

/**
 * Analyze source mapping from CSV
 */
async function analyzeSourceMapping() {
  console.log('🔍 Analyzing source mapping...\n');

  try {
    // Get CSV data
    const records = parseCSV(CSV_FILE_PATH);
    console.log(`📖 Found ${records.length} records in CSV`);

    // Get database sources
    const sources = await getAllSources();
    console.log(`📊 Found ${sources.length} sources in database`);

    // Create mapping
    const sourceMap = new Map();
    sources.forEach(source => {
      if (source.legacy_row_id) {
        sourceMap.set(source.legacy_row_id, source);
      }
    });

    // Analyze CSV source IDs
    const csvSourceIds = new Set();
    const unmappedSources = new Set();
    const sourceUsage = new Map();

    records.forEach(record => {
      const sourceId = record['SourceID'];
      if (sourceId && sourceId.trim()) {
        csvSourceIds.add(sourceId);
        
        if (sourceMap.has(sourceId)) {
          const source = sourceMap.get(sourceId);
          sourceUsage.set(sourceId, (sourceUsage.get(sourceId) || 0) + 1);
        } else {
          unmappedSources.add(sourceId);
        }
      }
    });

    console.log(`\n📋 Source Analysis:`);
    console.log(`🔗 Unique source IDs in CSV: ${csvSourceIds.size}`);
    console.log(`✅ Mapped sources: ${csvSourceIds.size - unmappedSources.size}`);
    console.log(`❌ Unmapped sources: ${unmappedSources.size}`);

    if (unmappedSources.size > 0) {
      console.log('\n❌ Unmapped Source IDs:');
      Array.from(unmappedSources).slice(0, 10).forEach(sourceId => {
        console.log(`  - ${sourceId}`);
      });
      if (unmappedSources.size > 10) {
        console.log(`  ... and ${unmappedSources.size - 10} more`);
      }
    }

    console.log('\n📊 Source Usage (Top 10):');
    const sortedUsage = Array.from(sourceUsage.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    sortedUsage.forEach(([sourceId, count]) => {
      const source = sourceMap.get(sourceId);
      console.log(`  ${source.name}: ${count} discs (${sourceId})`);
    });

    return {
      totalRecords: records.length,
      totalSources: sources.length,
      csvSourceIds: csvSourceIds.size,
      mappedSources: csvSourceIds.size - unmappedSources.size,
      unmappedSources: Array.from(unmappedSources),
      sourceUsage: Object.fromEntries(sourceUsage)
    };

  } catch (error) {
    console.error('Source mapping analysis failed:', error);
    throw error;
  }
}

/**
 * Validate CSV data quality
 */
async function validateCSVData() {
  console.log('🔍 Validating CSV data quality...\n');

  try {
    const records = parseCSV(CSV_FILE_PATH);
    
    const validation = {
      totalRecords: records.length,
      validRecords: 0,
      issues: {
        missingRowId: 0,
        missingDescription: 0,
        missingSourceId: 0,
        invalidDates: 0,
        missingImages: 0,
        duplicateRowIds: 0
      },
      duplicates: new Set(),
      rowIds: new Set()
    };

    records.forEach((record, index) => {
      const rowId = record['🔒 Row ID'] || record['ID'];
      const description = record['Description'];
      const sourceId = record['SourceID'];
      const entryDate = record['Entry Date'];
      const image1 = record['Image'];
      const image2 = record['Image2'];

      let isValid = true;

      // Check for missing row ID
      if (!rowId || !rowId.trim()) {
        validation.issues.missingRowId++;
        isValid = false;
      } else {
        // Check for duplicate row IDs
        if (validation.rowIds.has(rowId)) {
          validation.issues.duplicateRowIds++;
          validation.duplicates.add(rowId);
          isValid = false;
        } else {
          validation.rowIds.add(rowId);
        }
      }

      // Check for missing description
      if (!description || !description.trim()) {
        validation.issues.missingDescription++;
        isValid = false;
      }

      // Check for missing source ID
      if (!sourceId || !sourceId.trim()) {
        validation.issues.missingSourceId++;
        isValid = false;
      }

      // Check for invalid dates
      if (entryDate && entryDate.trim()) {
        try {
          const date = new Date(entryDate.replace(/"/g, '').trim());
          if (isNaN(date.getTime())) {
            validation.issues.invalidDates++;
            isValid = false;
          }
        } catch (error) {
          validation.issues.invalidDates++;
          isValid = false;
        }
      }

      // Check for missing images
      if ((!image1 || !image1.trim()) && (!image2 || !image2.trim())) {
        validation.issues.missingImages++;
        // Not marking as invalid since images are optional
      }

      if (isValid) {
        validation.validRecords++;
      }
    });

    console.log('📊 Data Quality Report:');
    console.log(`📝 Total records: ${validation.totalRecords}`);
    console.log(`✅ Valid records: ${validation.validRecords}`);
    console.log(`❌ Records with issues: ${validation.totalRecords - validation.validRecords}`);
    console.log('\n🔍 Issue Breakdown:');
    console.log(`  Missing Row ID: ${validation.issues.missingRowId}`);
    console.log(`  Missing Description: ${validation.issues.missingDescription}`);
    console.log(`  Missing Source ID: ${validation.issues.missingSourceId}`);
    console.log(`  Invalid Dates: ${validation.issues.invalidDates}`);
    console.log(`  Missing Images: ${validation.issues.missingImages}`);
    console.log(`  Duplicate Row IDs: ${validation.issues.duplicateRowIds}`);

    if (validation.duplicates.size > 0) {
      console.log('\n🔄 Duplicate Row IDs:');
      Array.from(validation.duplicates).slice(0, 10).forEach(rowId => {
        console.log(`  - ${rowId}`);
      });
      if (validation.duplicates.size > 10) {
        console.log(`  ... and ${validation.duplicates.size - 10} more`);
      }
    }

    return validation;

  } catch (error) {
    console.error('Data validation failed:', error);
    throw error;
  }
}

/**
 * Check import status
 */
async function checkImportStatus() {
  console.log('📊 Checking import status...\n');

  try {
    // Get CSV record count
    const records = parseCSV(CSV_FILE_PATH);
    const csvCount = records.length;

    // Get imported found discs count
    const { data: importedDiscs, error: discsError } = await supabase
      .from('found_discs')
      .select('id, legacy_row_id, brand, mold, created_at')
      .not('legacy_row_id', 'is', null)
      .order('created_at', { ascending: false });

    if (discsError) {
      throw new Error(`Failed to fetch imported discs: ${discsError.message}`);
    }

    // Get contact attempts count
    const { data: contactAttempts, error: attemptsError } = await supabase
      .from('contact_attempts')
      .select('id, found_disc_id')
      .order('created_at', { ascending: false });

    if (attemptsError) {
      throw new Error(`Failed to fetch contact attempts: ${attemptsError.message}`);
    }

    // Count discs with images
    const discsWithImages = importedDiscs.filter(disc => 
      disc.image_urls && disc.image_urls.length > 0
    ).length;

    // Count discs with contact attempts
    const discIdsWithAttempts = new Set(contactAttempts.map(a => a.found_disc_id));
    const discsWithAttempts = importedDiscs.filter(disc => 
      discIdsWithAttempts.has(disc.id)
    ).length;

    console.log('📊 Import Status Summary:');
    console.log(`📝 CSV records: ${csvCount}`);
    console.log(`📀 Imported found discs: ${importedDiscs.length}`);
    console.log(`🖼️  Discs with images: ${discsWithImages}`);
    console.log(`📞 Contact attempts: ${contactAttempts.length}`);
    console.log(`📞 Discs with contact attempts: ${discsWithAttempts}`);
    
    const importProgress = csvCount > 0 ? (importedDiscs.length / csvCount * 100).toFixed(1) : 0;
    console.log(`\n📈 Import Progress: ${importProgress}%`);

    if (importedDiscs.length > 0) {
      const latest = importedDiscs[0];
      console.log(`🕒 Latest import: ${latest.created_at} (${latest.brand} ${latest.mold})`);
    }

    return {
      csvCount,
      importedCount: importedDiscs.length,
      discsWithImages,
      contactAttemptsCount: contactAttempts.length,
      discsWithAttempts,
      importProgress: parseFloat(importProgress)
    };

  } catch (error) {
    console.error('Status check failed:', error);
    throw error;
  }
}

/**
 * Create missing sources
 */
async function createMissingSources(unmappedSourceIds) {
  console.log(`🔧 Creating ${unmappedSourceIds.length} missing sources...\n`);

  const results = {
    created: 0,
    failed: 0,
    errors: []
  };

  for (const sourceId of unmappedSourceIds) {
    try {
      const sourceData = {
        name: `Legacy Source ${sourceId}`,
        description: `Imported from legacy system - Source ID: ${sourceId}`,
        is_active: true,
        sort_order: 900, // Put legacy sources at the end
        legacy_row_id: sourceId
      };

      const { data, error } = await supabase
        .from('sources')
        .insert([sourceData])
        .select()
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      results.created++;
      console.log(`✅ Created source: ${sourceData.name} (${sourceId})`);

    } catch (error) {
      results.failed++;
      results.errors.push(`${sourceId}: ${error.message}`);
      console.error(`❌ Failed to create source ${sourceId}: ${error.message}`);
    }
  }

  console.log(`\n📊 Source Creation Summary:`);
  console.log(`✅ Created: ${results.created}`);
  console.log(`❌ Failed: ${results.failed}`);

  return results;
}

/**
 * Run comprehensive validation
 */
async function runFullValidation() {
  console.log('🔍 Running comprehensive validation...\n');

  try {
    // 1. Validate CSV data quality
    console.log('='.repeat(50));
    console.log('1. CSV Data Quality Validation');
    console.log('='.repeat(50));
    const dataValidation = await validateCSVData();

    // 2. Analyze source mapping
    console.log('\n' + '='.repeat(50));
    console.log('2. Source Mapping Analysis');
    console.log('='.repeat(50));
    const sourceAnalysis = await analyzeSourceMapping();

    // 3. Check import status
    console.log('\n' + '='.repeat(50));
    console.log('3. Import Status Check');
    console.log('='.repeat(50));
    const importStatus = await checkImportStatus();

    // 4. Summary and recommendations
    console.log('\n' + '='.repeat(50));
    console.log('4. Summary and Recommendations');
    console.log('='.repeat(50));

    console.log('\n📋 Validation Summary:');
    console.log(`📝 CSV Quality: ${dataValidation.validRecords}/${dataValidation.totalRecords} valid records`);
    console.log(`🔗 Source Mapping: ${sourceAnalysis.mappedSources}/${sourceAnalysis.csvSourceIds} sources mapped`);
    console.log(`📊 Import Progress: ${importStatus.importProgress}%`);

    console.log('\n💡 Recommendations:');

    if (dataValidation.issues.duplicateRowIds > 0) {
      console.log(`⚠️  Fix ${dataValidation.issues.duplicateRowIds} duplicate row IDs before import`);
    }

    if (sourceAnalysis.unmappedSources.length > 0) {
      console.log(`🔧 Create ${sourceAnalysis.unmappedSources.length} missing sources or run with --create-sources`);
    }

    if (importStatus.importProgress < 100) {
      console.log(`📥 Continue with found disc import (${100 - importStatus.importProgress}% remaining)`);
    }

    if (importStatus.importedCount > 0 && importStatus.discsWithImages === 0) {
      console.log(`🖼️  Run image migration for ${importStatus.importedCount} imported discs`);
    }

    if (importStatus.importedCount > 0 && importStatus.contactAttemptsCount === 0) {
      console.log(`📞 Run contact attempts import for communication history`);
    }

    return {
      dataValidation,
      sourceAnalysis,
      importStatus
    };

  } catch (error) {
    console.error('Full validation failed:', error);
    throw error;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--sources')) {
    await analyzeSourceMapping();
    return;
  }

  if (args.includes('--data')) {
    await validateCSVData();
    return;
  }

  if (args.includes('--status')) {
    await checkImportStatus();
    return;
  }

  if (args.includes('--create-sources')) {
    const sourceAnalysis = await analyzeSourceMapping();
    if (sourceAnalysis.unmappedSources.length > 0) {
      await createMissingSources(sourceAnalysis.unmappedSources);
    } else {
      console.log('✅ All sources are already mapped!');
    }
    return;
  }

  if (args.includes('--help')) {
    console.log('Found Disc Import Validation Script');
    console.log('');
    console.log('Usage:');
    console.log('  node validate-found-disc-import.js              # Run full validation');
    console.log('  node validate-found-disc-import.js --sources    # Analyze source mapping');
    console.log('  node validate-found-disc-import.js --data       # Validate CSV data quality');
    console.log('  node validate-found-disc-import.js --status     # Check import status');
    console.log('  node validate-found-disc-import.js --create-sources # Create missing sources');
    console.log('  node validate-found-disc-import.js --help       # Show this help');
    return;
  }

  try {
    await runFullValidation();
    console.log('\n🎉 Validation completed successfully!');
  } catch (error) {
    console.error('\n💥 Validation failed:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  analyzeSourceMapping,
  validateCSVData,
  checkImportStatus,
  createMissingSources,
  runFullValidation
};
