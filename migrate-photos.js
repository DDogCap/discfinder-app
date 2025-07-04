/**
 * Photo Migration Script
 * 
 * This script migrates photos from external URLs to Supabase Storage.
 * It can be used for profile avatars, disc photos, or any other photo migration.
 * 
 * Usage:
 * node migrate-photos.js [type]
 * 
 * Types:
 * - profiles (default): Migrate profile avatars
 * - discs: Migrate disc photos
 * - custom: Use custom configuration (modify script)
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

// Migration configurations
const MIGRATION_CONFIGS = {
  profiles: {
    tableName: 'imported_profiles_staging',
    urlColumn: 'avatar_url',
    idColumn: 'id',
    storageFolder: 'avatars',
    bucketName: 'disc-images',
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  },
  
  discs: {
    tableName: 'found_discs', // Update this when disc import is implemented
    urlColumn: 'photo_url',
    idColumn: 'legacy_row_id',
    storageFolder: 'disc-photos',
    bucketName: 'disc-images',
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp']
  }
};

/**
 * Downloads an image from a URL and returns the blob
 */
async function downloadImage(url, maxSize = 5 * 1024 * 1024) {
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const contentLength = response.headers.get('content-length');
  
  if (contentLength && parseInt(contentLength) > maxSize) {
    throw new Error(`File too large: ${contentLength} bytes (max: ${maxSize})`);
  }
  
  const blob = await response.blob();
  
  if (blob.size > maxSize) {
    throw new Error(`File too large: ${blob.size} bytes (max: ${maxSize})`);
  }
  
  return { blob, contentType };
}

/**
 * Generates a unique filename for the uploaded image
 */
function generateFileName(recordId, originalUrl, contentType) {
  const timestamp = Date.now();
  const extension = contentType.split('/')[1] || 'jpg';
  const urlHash = originalUrl.split('/').pop()?.substring(0, 8) || 'unknown';
  return `${recordId}-${timestamp}-${urlHash}.${extension}`;
}

/**
 * Uploads a blob to Supabase Storage
 */
async function uploadToStorage(blob, fileName, folder, bucket = 'disc-images') {
  const filePath = `${folder}/${fileName}`;
  
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, blob, {
      contentType: blob.type,
      upsert: false
    });
  
  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }
  
  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);
  
  return publicUrl;
}

/**
 * Updates the database record with the new photo URL
 */
async function updateRecord(tableName, idColumn, urlColumn, recordId, newUrl) {
  const { error } = await supabase
    .from(tableName)
    .update({ [urlColumn]: newUrl })
    .eq(idColumn, recordId);
  
  if (error) {
    throw new Error(`Database update failed: ${error.message}`);
  }
}

/**
 * Migrates a single photo from external URL to Supabase Storage
 */
async function migrateSinglePhoto(record, config) {
  const recordId = record[config.idColumn];
  const originalUrl = record[config.urlColumn];
  
  // Skip if no URL or already a Supabase URL
  if (!originalUrl || originalUrl.includes('supabase')) {
    return { status: 'skipped' };
  }
  
  try {
    // Download the image
    const { blob, contentType } = await downloadImage(originalUrl, config.maxFileSize);
    
    // Check if content type is allowed
    if (!config.allowedTypes.includes(contentType)) {
      return { 
        status: 'skipped',
        error: `Unsupported content type: ${contentType}`
      };
    }
    
    // Generate filename and upload
    const fileName = generateFileName(recordId, originalUrl, contentType);
    const newUrl = await uploadToStorage(blob, fileName, config.storageFolder, config.bucketName);
    
    // Update database record
    await updateRecord(config.tableName, config.idColumn, config.urlColumn, recordId, newUrl);
    
    return { status: 'migrated', newUrl };
    
  } catch (error) {
    return {
      status: 'failed',
      error: error.message
    };
  }
}

/**
 * Migrates photos for all records in a table
 */
async function migratePhotos(config) {
  console.log(`🚀 Starting photo migration for ${config.tableName}...`);
  
  const result = {
    success: true,
    processed: 0,
    migrated: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    details: []
  };
  
  try {
    // Fetch all records with photos
    const { data: records, error } = await supabase
      .from(config.tableName)
      .select(`${config.idColumn}, ${config.urlColumn}`)
      .not(config.urlColumn, 'is', null)
      .not(config.urlColumn, 'eq', '');
    
    if (error) {
      throw new Error(`Failed to fetch records: ${error.message}`);
    }
    
    if (!records || records.length === 0) {
      console.log('📭 No records with photos found');
      return result;
    }
    
    console.log(`📊 Found ${records.length} records with photos to process`);
    
    // Process each record
    for (const record of records) {
      const recordId = record[config.idColumn];
      const originalUrl = record[config.urlColumn];
      
      console.log(`📸 Processing ${recordId}: ${originalUrl.substring(0, 60)}...`);
      
      const migrationResult = await migrateSinglePhoto(record, config);
      
      result.processed++;
      result.details.push({
        recordId,
        originalUrl,
        newUrl: migrationResult.newUrl,
        status: migrationResult.status,
        error: migrationResult.error
      });
      
      switch (migrationResult.status) {
        case 'migrated':
          result.migrated++;
          console.log(`✅ Migrated ${recordId}`);
          break;
        case 'failed':
          result.failed++;
          result.errors.push(`${recordId}: ${migrationResult.error}`);
          console.error(`❌ Failed ${recordId}: ${migrationResult.error}`);
          break;
        case 'skipped':
          result.skipped++;
          console.log(`⚠️  Skipped ${recordId}: ${migrationResult.error || 'No URL or already migrated'}`);
          break;
      }
      
      // Add a small delay to avoid overwhelming the servers
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    if (result.failed > 0) {
      result.success = false;
    }
    
    console.log('\n📈 Migration Summary:');
    console.log(`✅ Migrated: ${result.migrated}`);
    console.log(`⚠️  Skipped: ${result.skipped}`);
    console.log(`❌ Failed: ${result.failed}`);
    
    if (result.errors.length > 0) {
      console.log('\n🚨 Errors:');
      result.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }
    
    return result;
    
  } catch (error) {
    result.success = false;
    result.errors.push(error.message);
    console.error('💥 Migration failed:', error);
    return result;
  }
}

/**
 * Validates the setup
 */
async function validateSetup(config) {
  console.log('🔍 Validating setup...');
  
  try {
    // Test Supabase connection
    const { data, error } = await supabase.from(config.tableName).select('count').limit(1);
    if (error) {
      console.error(`❌ Table '${config.tableName}' not accessible:`, error.message);
      return false;
    }
    console.log(`✅ Table '${config.tableName}' accessible`);

    // Test storage bucket
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    if (bucketError || !buckets.find(b => b.name === config.bucketName)) {
      console.error(`❌ Storage bucket '${config.bucketName}' not found`);
      return false;
    }
    console.log(`✅ Storage bucket '${config.bucketName}' accessible`);

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
  const migrationType = process.argv[2] || 'profiles';
  
  console.log('📸 DZDiscFinder Photo Migration Tool');
  console.log('==================================\n');
  
  if (!MIGRATION_CONFIGS[migrationType]) {
    console.error(`❌ Unknown migration type: ${migrationType}`);
    console.log('Available types: profiles, discs');
    process.exit(1);
  }
  
  const config = MIGRATION_CONFIGS[migrationType];
  console.log(`🎯 Migration type: ${migrationType}`);
  console.log(`📁 Table: ${config.tableName}`);
  console.log(`🗂️  Storage folder: ${config.storageFolder}`);
  
  // Validate setup
  const isValid = await validateSetup(config);
  if (!isValid) {
    console.log('\n❌ Setup validation failed. Please fix the issues above and try again.');
    process.exit(1);
  }
  
  try {
    const results = await migratePhotos(config);
    
    if (results.migrated > 0) {
      console.log('\n🎉 Photo migration completed!');
      console.log('\n📋 Next steps:');
      console.log('1. Verify photos are accessible in Supabase Storage');
      console.log('2. Test photo display in the application');
      console.log('3. Consider cleaning up old external URLs if needed');
    } else if (results.skipped > 0) {
      console.log('\n⚠️  No photos were migrated (all skipped).');
    } else {
      console.log('\n📭 No photos found to migrate.');
    }
  } catch (error) {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { migratePhotos, MIGRATION_CONFIGS };
