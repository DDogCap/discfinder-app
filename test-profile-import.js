/**
 * Profile Import Test Script
 * 
 * This script tests the profile import functionality to ensure everything works correctly.
 * 
 * Usage:
 * node test-profile-import.js
 */

// Load environment variables
require('./load-env');

const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Test data
const testProfiles = [
  {
    p_email: 'test.user1@example.com',
    p_full_name: 'Test User One',
    p_role: 'user',
    p_legacy_row_id: 'legacy_001',
    p_pdga_number: 12345,
    p_facebook_profile: 'test.user1',
    p_instagram_handle: 'testuser1',
    p_sms_number: '+1234567890',
    p_phone_number: '+1234567890'
  },
  {
    p_email: 'test.admin@example.com',
    p_full_name: 'Test Admin',
    p_role: 'admin',
    p_legacy_row_id: 'legacy_002',
    p_pdga_number: 67890,
    p_facebook_profile: 'test.admin',
    p_phone_number: '+0987654321'
  },
  {
    p_email: 'test.rakerdiver@example.com',
    p_full_name: 'Test RakerDiver',
    p_role: 'rakerdiver',
    p_legacy_row_id: 'legacy_003',
    p_sms_number: '+1122334455'
  }
];

/**
 * Test database connection and setup
 */
async function testDatabaseConnection() {
  console.log('🔍 Testing database connection...');
  
  try {
    const { data, error } = await supabase.from('profiles').select('count').limit(1);
    if (error) {
      throw error;
    }
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

/**
 * Test import function exists
 */
async function testImportFunction() {
  console.log('🔍 Testing import function...');
  
  try {
    // Try to call the function with minimal data
    const { error } = await supabase.rpc('import_legacy_profile', {
      p_email: 'test.function@example.com',
      p_full_name: 'Function Test',
      p_role: 'user'
    });
    
    if (error && !error.message.includes('duplicate key')) {
      throw error;
    }
    
    console.log('✅ Import function is available');
    return true;
  } catch (error) {
    console.error('❌ Import function test failed:', error.message);
    return false;
  }
}

/**
 * Clean up test data
 */
async function cleanupTestData() {
  console.log('🧹 Cleaning up test data...');
  
  try {
    const testEmails = testProfiles.map(p => p.p_email);
    testEmails.push('test.function@example.com');
    
    const { error } = await supabase
      .from('profiles')
      .delete()
      .in('email', testEmails);
    
    if (error) {
      console.warn('⚠️  Cleanup warning:', error.message);
    } else {
      console.log('✅ Test data cleaned up');
    }
  } catch (error) {
    console.warn('⚠️  Cleanup error:', error.message);
  }
}

/**
 * Test profile import
 */
async function testProfileImport() {
  console.log('🔍 Testing profile import...');
  
  const results = {
    imported: 0,
    failed: 0,
    errors: []
  };
  
  for (const profileData of testProfiles) {
    try {
      const { data, error } = await supabase.rpc('import_legacy_profile', profileData);
      
      if (error) {
        results.failed++;
        results.errors.push(`${profileData.p_email}: ${error.message}`);
        console.error(`❌ Failed to import ${profileData.p_email}:`, error.message);
      } else {
        results.imported++;
        console.log(`✅ Imported ${profileData.p_email} with ID: ${data}`);
      }
    } catch (err) {
      results.failed++;
      results.errors.push(`${profileData.p_email}: ${err.message}`);
      console.error(`❌ Exception importing ${profileData.p_email}:`, err.message);
    }
  }
  
  console.log(`📊 Import results: ${results.imported} imported, ${results.failed} failed`);
  return results;
}

/**
 * Test imported profiles view
 */
async function testImportedProfilesView() {
  console.log('🔍 Testing imported profiles view...');
  
  try {
    const { data, error } = await supabase
      .from('imported_profiles')
      .select('*')
      .eq('needs_signup', true);
    
    if (error) {
      throw error;
    }
    
    console.log(`✅ Found ${data.length} imported profiles needing signup`);
    
    // Display some details
    data.forEach(profile => {
      console.log(`   - ${profile.email} (${profile.role}) - Legacy ID: ${profile.legacy_row_id}`);
    });
    
    return data;
  } catch (error) {
    console.error('❌ Imported profiles view test failed:', error.message);
    return [];
  }
}

/**
 * Test profile data integrity
 */
async function testDataIntegrity() {
  console.log('🔍 Testing data integrity...');
  
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .in('email', testProfiles.map(p => p.p_email));
    
    if (error) {
      throw error;
    }
    
    console.log(`✅ Retrieved ${data.length} test profiles for validation`);
    
    // Validate each profile
    let validationErrors = 0;
    
    for (const profile of data) {
      const originalData = testProfiles.find(p => p.p_email === profile.email);
      if (!originalData) continue;
      
      // Check required fields
      if (profile.email !== originalData.p_email) {
        console.error(`❌ Email mismatch for ${profile.email}`);
        validationErrors++;
      }
      
      if (profile.full_name !== originalData.p_full_name) {
        console.error(`❌ Name mismatch for ${profile.email}`);
        validationErrors++;
      }
      
      if (profile.role !== originalData.p_role) {
        console.error(`❌ Role mismatch for ${profile.email}: expected ${originalData.p_role}, got ${profile.role}`);
        validationErrors++;
      }
      
      if (profile.legacy_row_id !== originalData.p_legacy_row_id) {
        console.error(`❌ Legacy ID mismatch for ${profile.email}`);
        validationErrors++;
      }
      
      // Check optional fields
      if (originalData.p_pdga_number && profile.pdga_number !== originalData.p_pdga_number) {
        console.error(`❌ PDGA number mismatch for ${profile.email}`);
        validationErrors++;
      }
    }
    
    if (validationErrors === 0) {
      console.log('✅ All data integrity checks passed');
    } else {
      console.error(`❌ ${validationErrors} data integrity errors found`);
    }
    
    return validationErrors === 0;
  } catch (error) {
    console.error('❌ Data integrity test failed:', error.message);
    return false;
  }
}

/**
 * Test duplicate handling
 */
async function testDuplicateHandling() {
  console.log('🔍 Testing duplicate handling...');
  
  try {
    // Try to import the same profile twice
    const testProfile = testProfiles[0];
    
    const { data: firstImport, error: firstError } = await supabase.rpc('import_legacy_profile', testProfile);
    const { data: secondImport, error: secondError } = await supabase.rpc('import_legacy_profile', testProfile);
    
    if (firstError || secondError) {
      console.error('❌ Duplicate handling test failed:', firstError || secondError);
      return false;
    }
    
    // Both should return the same ID (update, not create)
    if (firstImport === secondImport) {
      console.log('✅ Duplicate handling works correctly (same ID returned)');
      return true;
    } else {
      console.error('❌ Duplicate handling failed (different IDs returned)');
      return false;
    }
  } catch (error) {
    console.error('❌ Duplicate handling test failed:', error.message);
    return false;
  }
}

/**
 * Main test runner
 */
async function runTests() {
  console.log('🧪 Profile Import Test Suite');
  console.log('============================\n');
  
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };
  
  // Clean up any existing test data first
  await cleanupTestData();
  
  // Run tests
  const tests = [
    { name: 'Database Connection', fn: testDatabaseConnection },
    { name: 'Import Function', fn: testImportFunction },
    { name: 'Profile Import', fn: testProfileImport },
    { name: 'Imported Profiles View', fn: testImportedProfilesView },
    { name: 'Data Integrity', fn: testDataIntegrity },
    { name: 'Duplicate Handling', fn: testDuplicateHandling }
  ];
  
  for (const test of tests) {
    console.log(`\n🧪 Running test: ${test.name}`);
    try {
      const result = await test.fn();
      if (result) {
        results.passed++;
        results.tests.push({ name: test.name, status: 'PASSED' });
        console.log(`✅ ${test.name}: PASSED`);
      } else {
        results.failed++;
        results.tests.push({ name: test.name, status: 'FAILED' });
        console.log(`❌ ${test.name}: FAILED`);
      }
    } catch (error) {
      results.failed++;
      results.tests.push({ name: test.name, status: 'ERROR', error: error.message });
      console.log(`💥 ${test.name}: ERROR - ${error.message}`);
    }
  }
  
  // Clean up test data
  await cleanupTestData();
  
  // Summary
  console.log('\n📊 Test Summary');
  console.log('================');
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📈 Success Rate: ${Math.round((results.passed / (results.passed + results.failed)) * 100)}%`);
  
  if (results.failed > 0) {
    console.log('\n🚨 Failed Tests:');
    results.tests
      .filter(t => t.status !== 'PASSED')
      .forEach(t => console.log(`   - ${t.name}: ${t.status}${t.error ? ` (${t.error})` : ''}`));
  }
  
  return results.failed === 0;
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests()
    .then(success => {
      if (success) {
        console.log('\n🎉 All tests passed!');
        process.exit(0);
      } else {
        console.log('\n💥 Some tests failed!');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n💥 Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { runTests };
