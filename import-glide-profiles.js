/**
 * Glide Profile Import Script
 * 
 * This script imports profiles from your Glide app into the DZDiscFinder Supabase database.
 * 
 * Prerequisites:
 * 1. Install @glideapps/tables: npm install @glideapps/tables
 * 2. Install @supabase/supabase-js: npm install @supabase/supabase-js
 * 3. Set up environment variables for Supabase
 * 4. Run the ADD_PROFILE_IMPORT_FIELDS.sql migration in Supabase
 * 
 * Usage:
 * node import-glide-profiles.js
 */

// Load environment variables
require('./load-env');

const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role key for admin operations

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Glide configuration - using your provided values
const GLIDE_CONFIG = {
  token: "57a0c23e-1215-451b-aa43-c3ef6a4bfeed",
  app: "ruvULEC0fwdPVN39ErX6",
  table: "native-table-qQtBfW3I3zbQYJd4b3oF",
  columns: {
    name: { type: "string", name: "Name" },
    email: { type: "email-address", name: "Email" },
    photo: { type: "image-uri", name: "Photo" },
    role: { type: "string", name: "Role" },
    defaultSourceRowId: { type: "string", name: "tGL3F" },
    created: { type: "date-time", name: "k655R" },
    phoneNumberForTextMessages: { type: "phone-number", name: "OhhU3" },
    pdga: { type: "number", name: "Dscqd" },
    facebookProfile: { type: "string", name: "n1NEI" }
  }
};

/**
 * Maps a Glide admin record to our profile import format
 */
function mapGlideAdminToProfile(admin) {
  // Map role - blank roles become 'guest'
  let role = 'guest';
  if (admin.role) {
    const lowerRole = admin.role.toLowerCase();
    if (lowerRole === 'admin') {
      role = 'admin';
    } else if (lowerRole === 'rakerdiver') {
      role = 'rakerdiver';
    } else if (lowerRole === 'user') {
      role = 'user';
    }
    // If role doesn't match known values, defaults to 'guest'
  }

  return {
    p_email: admin.email,
    p_full_name: admin.name || '',
    p_role: role,
    p_legacy_row_id: admin.defaultSourceRowId,
    p_pdga_number: admin.pdga,
    p_facebook_profile: admin.facebookProfile,
    p_instagram_handle: null, // Not in original data
    p_sms_number: admin.phoneNumberForTextMessages,
    p_phone_number: admin.phoneNumberForTextMessages, // Using same field for both
    p_avatar_url: admin.photo, // We'll handle photo migration separately
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
 * Fetches profiles from Glide and imports them
 */
async function importProfilesFromGlide() {
  try {
    console.log('🚀 Starting Glide profile import...');
    
    // Import Glide tables (you may need to install this package)
    let glide;
    try {
      glide = require('@glideapps/tables');
    } catch (err) {
      console.error('❌ @glideapps/tables package not found. Please install it:');
      console.error('   npm install @glideapps/tables');
      process.exit(1);
    }

    // Set up Glide table connection
    const adminsTable = glide.table(GLIDE_CONFIG);

    console.log('📡 Fetching profiles from Glide...');
    const admins = await adminsTable.get();
    
    console.log(`📊 Found ${admins.length} profiles to import`);

    const results = {
      imported: 0,
      failed: 0,
      errors: []
    };

    // Import each profile
    for (const admin of admins) {
      try {
        // Skip records without email
        if (!admin.email) {
          results.failed++;
          results.errors.push('Skipped record without email');
          console.log('⚠️  Skipped record without email');
          continue;
        }

        const profileData = mapGlideAdminToProfile(admin);
        const result = await importSingleProfile(profileData);

        if (result.success) {
          results.imported++;
          console.log(`✅ Imported profile for ${admin.email}`);
        } else {
          results.failed++;
          results.errors.push(`Failed to import ${admin.email}: ${result.error}`);
          console.error(`❌ Failed to import ${admin.email}:`, result.error);
        }
      } catch (err) {
        results.failed++;
        const errorMsg = err.message || 'Unknown error';
        results.errors.push(`Exception importing ${admin.email}: ${errorMsg}`);
        console.error(`❌ Exception importing ${admin.email}:`, err);
      }
    }

    console.log('\n📈 Import Summary:');
    console.log(`✅ Successfully imported: ${results.imported}`);
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
 * Validates the environment and database setup
 */
async function validateSetup() {
  console.log('🔍 Validating setup...');
  
  try {
    // Test Supabase connection
    const { data, error } = await supabase.from('profiles').select('count').limit(1);
    if (error) {
      console.error('❌ Supabase connection failed:', error.message);
      return false;
    }
    console.log('✅ Supabase connection successful');

    // Check if import function exists
    const { data: funcData, error: funcError } = await supabase.rpc('import_legacy_profile', {
      p_email: 'test@example.com',
      p_full_name: 'Test User',
      p_role: 'user'
    });
    
    if (funcError && !funcError.message.includes('duplicate key')) {
      console.error('❌ import_legacy_profile function not found. Please run ADD_PROFILE_IMPORT_FIELDS.sql migration.');
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
  console.log('🎯 DiscFinder Profile Import Tool');
  console.log('==================================\n');

  // Validate setup
  const isValid = await validateSetup();
  if (!isValid) {
    console.log('\n❌ Setup validation failed. Please fix the issues above and try again.');
    process.exit(1);
  }

  // Confirm before proceeding
  console.log('\n⚠️  This will import profiles from your Glide app.');
  console.log('   Make sure you have backed up your database before proceeding.');
  
  // In a real script, you might want to add a confirmation prompt here
  // For now, we'll proceed automatically
  
  try {
    const results = await importProfilesFromGlide();
    
    if (results.imported > 0) {
      console.log('\n🎉 Import completed successfully!');
      console.log('\n📋 Next steps:');
      console.log('1. Review the imported profiles in your admin dashboard');
      console.log('2. Test user signup with imported email addresses');
      console.log('3. Migrate user avatars if needed');
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

module.exports = {
  importProfilesFromGlide,
  mapGlideAdminToProfile,
  importSingleProfile
};
