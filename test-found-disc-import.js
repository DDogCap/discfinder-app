/**
 * Found Disc Import Test Script
 * 
 * This script tests the complete found disc import process with a small subset of data
 * to verify all functionality works correctly before running the full import.
 * 
 * Prerequisites:
 * 1. Database migrations must be applied (ADD_FOUND_DISC_IMPORT_FIELDS.sql)
 * 2. Sources must be imported or created
 * 3. Set up environment variables for Supabase
 * 
 * Usage:
 * node test-found-disc-import.js
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Import our modules
const { testImport: testFoundDiscImport } = require('./import-found-discs');
const { testMigration: testImageMigration } = require('./migrate-found-disc-images');
const { testImport: testContactImport } = require('./import-contact-attempts');
const { runFullValidation } = require('./validate-found-disc-import');

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
 * Test database connection and required tables
 */
async function testDatabaseConnection() {
  console.log('🔌 Testing database connection and schema...\n');

  const tests = [
    { table: 'found_discs', description: 'Found discs table' },
    { table: 'sources', description: 'Sources table' },
    { table: 'contact_attempts', description: 'Contact attempts table' },
    { table: 'profiles', description: 'Profiles table' }
  ];

  const results = {
    passed: 0,
    failed: 0,
    errors: []
  };

  for (const test of tests) {
    try {
      const { data, error } = await supabase
        .from(test.table)
        .select('*')
        .limit(1);

      if (error) {
        throw new Error(error.message);
      }

      console.log(`✅ ${test.description}: OK`);
      results.passed++;
    } catch (error) {
      console.error(`❌ ${test.description}: ${error.message}`);
      results.failed++;
      results.errors.push(`${test.table}: ${error.message}`);
    }
  }

  // Test for required columns
  try {
    const { data, error } = await supabase
      .from('found_discs')
      .select('legacy_row_id, owner_email, owner_pdga_number')
      .limit(1);

    if (error) {
      throw new Error('Missing import fields - run ADD_FOUND_DISC_IMPORT_FIELDS.sql');
    }

    console.log(`✅ Found discs import fields: OK`);
    results.passed++;
  } catch (error) {
    console.error(`❌ Found discs import fields: ${error.message}`);
    results.failed++;
    results.errors.push(`Import fields: ${error.message}`);
  }

  console.log(`\n📊 Database Test Results: ${results.passed} passed, ${results.failed} failed`);
  
  if (results.failed > 0) {
    console.log('\n❌ Database issues found:');
    results.errors.forEach(error => console.log(`  - ${error}`));
    return false;
  }

  return true;
}

/**
 * Test CSV file accessibility and structure
 */
async function testCSVFile() {
  console.log('📄 Testing CSV file...\n');

  const csvPath = path.join(__dirname, 'external_data', 'found_discs.csv');
  
  try {
    if (!fs.existsSync(csvPath)) {
      throw new Error(`CSV file not found: ${csvPath}`);
    }

    const content = fs.readFileSync(csvPath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      throw new Error('CSV file must have at least a header and one data row');
    }

    const header = lines[0];
    const requiredColumns = [
      '🔒 Row ID',
      'Description', 
      'SourceID',
      'Entry Date',
      'Entered By',
      'Contact Notes'
    ];

    const missingColumns = requiredColumns.filter(col => !header.includes(col));
    
    if (missingColumns.length > 0) {
      throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
    }

    console.log(`✅ CSV file found: ${lines.length - 1} data rows`);
    console.log(`✅ Required columns present`);
    
    return true;

  } catch (error) {
    console.error(`❌ CSV file test failed: ${error.message}`);
    return false;
  }
}

/**
 * Test Supabase Storage access
 */
async function testStorageAccess() {
  console.log('☁️  Testing Supabase Storage access...\n');

  try {
    // Test bucket access
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      throw new Error(`Cannot list buckets: ${bucketsError.message}`);
    }

    const discImagesBucket = buckets.find(bucket => bucket.name === 'disc-images');
    
    if (!discImagesBucket) {
      console.log(`⚠️  'disc-images' bucket not found. Creating it...`);
      
      const { error: createError } = await supabase.storage.createBucket('disc-images', {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        fileSizeLimit: 10485760 // 10MB
      });
      
      if (createError) {
        throw new Error(`Cannot create bucket: ${createError.message}`);
      }
      
      console.log(`✅ Created 'disc-images' bucket`);
    } else {
      console.log(`✅ 'disc-images' bucket exists`);
    }

    // Test upload permissions
    const testFile = Buffer.from('test');
    const testPath = 'test/test.txt';
    
    const { error: uploadError } = await supabase.storage
      .from('disc-images')
      .upload(testPath, testFile, { upsert: true });
    
    if (uploadError) {
      throw new Error(`Cannot upload to bucket: ${uploadError.message}`);
    }

    // Clean up test file
    await supabase.storage.from('disc-images').remove([testPath]);
    
    console.log(`✅ Storage upload/delete permissions OK`);
    
    return true;

  } catch (error) {
    console.error(`❌ Storage test failed: ${error.message}`);
    return false;
  }
}

/**
 * Run comprehensive test suite
 */
async function runTestSuite() {
  console.log('🧪 Starting Found Disc Import Test Suite...\n');
  console.log('='.repeat(60));

  const testResults = {
    database: false,
    csvFile: false,
    storage: false,
    validation: false,
    foundDiscImport: false,
    imageImport: false,
    contactImport: false
  };

  try {
    // 1. Test database connection and schema
    console.log('\n1. Database Connection and Schema Test');
    console.log('-'.repeat(40));
    testResults.database = await testDatabaseConnection();

    // 2. Test CSV file
    console.log('\n2. CSV File Test');
    console.log('-'.repeat(40));
    testResults.csvFile = await testCSVFile();

    // 3. Test storage access
    console.log('\n3. Storage Access Test');
    console.log('-'.repeat(40));
    testResults.storage = await testStorageAccess();

    // 4. Run validation
    console.log('\n4. Data Validation Test');
    console.log('-'.repeat(40));
    try {
      await runFullValidation();
      testResults.validation = true;
      console.log('✅ Validation completed successfully');
    } catch (error) {
      console.error(`❌ Validation failed: ${error.message}`);
    }

    // Only proceed with import tests if prerequisites pass
    if (testResults.database && testResults.csvFile) {
      
      // 5. Test found disc import
      console.log('\n5. Found Disc Import Test');
      console.log('-'.repeat(40));
      try {
        await testFoundDiscImport(3);
        testResults.foundDiscImport = true;
        console.log('✅ Found disc import test completed');
      } catch (error) {
        console.error(`❌ Found disc import test failed: ${error.message}`);
      }

      // 6. Test image migration (only if storage works)
      if (testResults.storage) {
        console.log('\n6. Image Migration Test');
        console.log('-'.repeat(40));
        try {
          await testImageMigration(2);
          testResults.imageImport = true;
          console.log('✅ Image migration test completed');
        } catch (error) {
          console.error(`❌ Image migration test failed: ${error.message}`);
        }
      }

      // 7. Test contact attempts import
      console.log('\n7. Contact Attempts Import Test');
      console.log('-'.repeat(40));
      try {
        await testContactImport(3);
        testResults.contactImport = true;
        console.log('✅ Contact attempts import test completed');
      } catch (error) {
        console.error(`❌ Contact attempts import test failed: ${error.message}`);
      }
    }

    // Print final results
    console.log('\n' + '='.repeat(60));
    console.log('🏁 Test Suite Results');
    console.log('='.repeat(60));

    const tests = [
      { name: 'Database Connection', result: testResults.database },
      { name: 'CSV File Access', result: testResults.csvFile },
      { name: 'Storage Access', result: testResults.storage },
      { name: 'Data Validation', result: testResults.validation },
      { name: 'Found Disc Import', result: testResults.foundDiscImport },
      { name: 'Image Migration', result: testResults.imageImport },
      { name: 'Contact Import', result: testResults.contactImport }
    ];

    let passed = 0;
    let total = tests.length;

    tests.forEach(test => {
      const status = test.result ? '✅ PASS' : '❌ FAIL';
      console.log(`${status} ${test.name}`);
      if (test.result) passed++;
    });

    console.log(`\n📊 Overall Results: ${passed}/${total} tests passed`);

    if (passed === total) {
      console.log('\n🎉 All tests passed! Ready for full import.');
      console.log('\n📋 Next steps:');
      console.log('1. Run: node import-found-discs.js');
      console.log('2. Run: node migrate-found-disc-images.js');
      console.log('3. Run: node import-contact-attempts.js');
    } else {
      console.log('\n⚠️  Some tests failed. Please address the issues before proceeding.');
    }

    return testResults;

  } catch (error) {
    console.error('\n💥 Test suite failed:', error);
    throw error;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help')) {
    console.log('Found Disc Import Test Script');
    console.log('');
    console.log('Usage:');
    console.log('  node test-found-disc-import.js        # Run full test suite');
    console.log('  node test-found-disc-import.js --help # Show this help');
    return;
  }

  try {
    await runTestSuite();
  } catch (error) {
    console.error('\n💥 Test failed:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { 
  runTestSuite,
  testDatabaseConnection,
  testCSVFile,
  testStorageAccess
};
