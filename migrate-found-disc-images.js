/**
 * Found Disc Image Migration Script
 * 
 * This script downloads images from Google Storage URLs in the found_discs table
 * and uploads them to Supabase Storage, updating the image_urls field.
 * 
 * Prerequisites:
 * 1. Install required packages: npm install axios
 * 2. Set up environment variables for Supabase
 * 3. Found discs must already be imported with Google Storage URLs
 * 4. Supabase Storage bucket 'disc-images' must exist
 * 
 * Usage:
 * node migrate-found-disc-images.js
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
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

// Configuration
const BUCKET_NAME = 'disc-images';
const BATCH_SIZE = 5; // Process images in batches to avoid overwhelming the server
const DOWNLOAD_TIMEOUT = 30000; // 30 seconds timeout for downloads
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB max file size

/**
 * Download image from URL
 */
async function downloadImage(url) {
  try {
    console.log(`📥 Downloading: ${url}`);
    
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'arraybuffer',
      timeout: DOWNLOAD_TIMEOUT,
      maxContentLength: MAX_FILE_SIZE,
      headers: {
        'User-Agent': 'DZDiscFinder-ImageMigration/1.0'
      }
    });

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Get content type from response headers
    const contentType = response.headers['content-type'] || 'image/jpeg';
    
    // Validate it's an image
    if (!contentType.startsWith('image/')) {
      throw new Error(`Invalid content type: ${contentType}`);
    }

    return {
      buffer: Buffer.from(response.data),
      contentType: contentType,
      size: response.data.byteLength
    };

  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      throw new Error('Download timeout');
    } else if (error.response) {
      throw new Error(`HTTP ${error.response.status}: ${error.response.statusText}`);
    } else {
      throw new Error(error.message);
    }
  }
}

/**
 * Generate unique filename for Supabase Storage
 */
function generateFilename(originalUrl, discId, imageIndex) {
  // Extract file extension from URL or content type
  const urlParts = originalUrl.split('.');
  const extension = urlParts.length > 1 ? urlParts[urlParts.length - 1].split('?')[0] : 'jpg';
  
  // Create filename: found-discs/{discId}/image-{index}.{ext}
  return `found-discs/${discId}/image-${imageIndex + 1}.${extension}`;
}

/**
 * Upload image to Supabase Storage
 */
async function uploadImageToSupabase(imageData, filename) {
  try {
    console.log(`📤 Uploading to Supabase: ${filename}`);
    
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filename, imageData.buffer, {
        contentType: imageData.contentType,
        upsert: true // Overwrite if exists
      });

    if (error) {
      throw new Error(`Supabase upload error: ${error.message}`);
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filename);

    return publicUrlData.publicUrl;

  } catch (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }
}

/**
 * Migrate images for a single found disc
 */
async function migrateDiscImages(disc) {
  const results = {
    success: false,
    originalUrls: disc.image_urls || [],
    newUrls: [],
    errors: []
  };

  if (!disc.image_urls || disc.image_urls.length === 0) {
    results.success = true; // No images to migrate
    return results;
  }

  console.log(`\n🔄 Migrating images for disc ${disc.legacy_row_id} (${disc.brand} ${disc.mold})`);
  console.log(`Found ${disc.image_urls.length} image(s) to migrate`);

  for (let i = 0; i < disc.image_urls.length; i++) {
    const originalUrl = disc.image_urls[i];
    
    try {
      // Skip if URL is already a Supabase URL
      if (originalUrl.includes(supabaseUrl)) {
        console.log(`⏭️  Skipping already migrated image: ${originalUrl}`);
        results.newUrls.push(originalUrl);
        continue;
      }

      // Download image
      const imageData = await downloadImage(originalUrl);
      console.log(`✅ Downloaded ${imageData.size} bytes (${imageData.contentType})`);

      // Generate filename
      const filename = generateFilename(originalUrl, disc.id, i);

      // Upload to Supabase
      const newUrl = await uploadImageToSupabase(imageData, filename);
      console.log(`✅ Uploaded to: ${newUrl}`);

      results.newUrls.push(newUrl);

    } catch (error) {
      console.error(`❌ Failed to migrate image ${i + 1}: ${error.message}`);
      results.errors.push(`Image ${i + 1}: ${error.message}`);
      
      // Keep original URL if migration fails
      results.newUrls.push(originalUrl);
    }
  }

  // Update database with new URLs
  try {
    const { error } = await supabase
      .from('found_discs')
      .update({ image_urls: results.newUrls })
      .eq('id', disc.id);

    if (error) {
      throw new Error(`Database update failed: ${error.message}`);
    }

    console.log(`✅ Updated database with new image URLs`);
    results.success = true;

  } catch (error) {
    console.error(`❌ Failed to update database: ${error.message}`);
    results.errors.push(`Database update: ${error.message}`);
  }

  return results;
}

/**
 * Get found discs that need image migration
 */
async function getDiscsNeedingMigration() {
  try {
    const { data, error } = await supabase
      .from('found_discs')
      .select('id, legacy_row_id, brand, mold, image_urls')
      .not('image_urls', 'is', null)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch found discs: ${error.message}`);
    }

    // Filter discs that have Google Storage URLs
    const discsNeedingMigration = data.filter(disc => {
      return disc.image_urls && disc.image_urls.some(url => 
        url.includes('storage.googleapis.com') && !url.includes(supabaseUrl)
      );
    });

    return discsNeedingMigration;

  } catch (error) {
    throw new Error(`Database query failed: ${error.message}`);
  }
}

/**
 * Main migration function
 */
async function migrateAllImages() {
  console.log('🚀 Starting found disc image migration...\n');

  const stats = {
    totalDiscs: 0,
    processedDiscs: 0,
    successfulDiscs: 0,
    failedDiscs: 0,
    totalImages: 0,
    migratedImages: 0,
    failedImages: 0,
    errors: []
  };

  try {
    // Get discs needing migration
    console.log('📋 Finding discs with images to migrate...');
    const discs = await getDiscsNeedingMigration();
    
    stats.totalDiscs = discs.length;
    stats.totalImages = discs.reduce((sum, disc) => sum + (disc.image_urls?.length || 0), 0);
    
    console.log(`Found ${stats.totalDiscs} discs with ${stats.totalImages} images to migrate\n`);

    if (stats.totalDiscs === 0) {
      console.log('✅ No images need migration!');
      return stats;
    }

    // Process discs in batches
    for (let i = 0; i < discs.length; i += BATCH_SIZE) {
      const batch = discs.slice(i, i + BATCH_SIZE);
      console.log(`\n📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} discs)...`);

      for (const disc of batch) {
        stats.processedDiscs++;
        
        try {
          const result = await migrateDiscImages(disc);
          
          if (result.success) {
            stats.successfulDiscs++;
            stats.migratedImages += result.newUrls.filter((url, index) => 
              url !== result.originalUrls[index]
            ).length;
          } else {
            stats.failedDiscs++;
            stats.errors.push(`Disc ${disc.legacy_row_id}: ${result.errors.join(', ')}`);
          }
          
          stats.failedImages += result.errors.length;

        } catch (error) {
          stats.failedDiscs++;
          stats.errors.push(`Disc ${disc.legacy_row_id}: ${error.message}`);
          console.error(`❌ Failed to process disc ${disc.legacy_row_id}: ${error.message}`);
        }
      }

      // Small delay between batches
      if (i + BATCH_SIZE < discs.length) {
        console.log('⏳ Waiting before next batch...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Print summary
    console.log('\n📊 Migration Summary:');
    console.log(`📀 Total discs: ${stats.totalDiscs}`);
    console.log(`✅ Successfully processed: ${stats.successfulDiscs}`);
    console.log(`❌ Failed: ${stats.failedDiscs}`);
    console.log(`🖼️  Total images: ${stats.totalImages}`);
    console.log(`✅ Successfully migrated: ${stats.migratedImages}`);
    console.log(`❌ Failed images: ${stats.failedImages}`);

    if (stats.errors.length > 0) {
      console.log('\n❌ Errors:');
      stats.errors.slice(0, 10).forEach(error => console.log(`  - ${error}`));
      if (stats.errors.length > 10) {
        console.log(`  ... and ${stats.errors.length - 10} more errors`);
      }
    }

    return stats;

  } catch (error) {
    console.error('💥 Migration failed:', error);
    throw error;
  }
}

/**
 * Test migration with a small subset
 */
async function testMigration(limit = 3) {
  console.log(`🧪 Testing image migration with first ${limit} discs...\n`);

  try {
    const discs = await getDiscsNeedingMigration();
    const testDiscs = discs.slice(0, limit);

    console.log('Test discs:');
    testDiscs.forEach((disc, index) => {
      console.log(`${index + 1}. ${disc.legacy_row_id}: ${disc.brand} ${disc.mold} (${disc.image_urls?.length || 0} images)`);
    });

    console.log('\nProceed with test migration? (This will actually migrate these images)');
    console.log('Press Ctrl+C to cancel, or any key to continue...');

    for (const disc of testDiscs) {
      const result = await migrateDiscImages(disc);

      if (result.success) {
        console.log(`✅ Test migration successful: ${disc.legacy_row_id}`);
      } else {
        console.error(`❌ Test migration failed: ${disc.legacy_row_id} - ${result.errors.join(', ')}`);
      }
    }

  } catch (error) {
    console.error('Test migration failed:', error);
  }
}

/**
 * Check migration status
 */
async function checkMigrationStatus() {
  try {
    console.log('📊 Checking image migration status...\n');

    const { data: allDiscs, error } = await supabase
      .from('found_discs')
      .select('id, legacy_row_id, brand, mold, image_urls')
      .not('image_urls', 'is', null);

    if (error) {
      throw new Error(`Failed to fetch found discs: ${error.message}`);
    }

    let totalImages = 0;
    let googleImages = 0;
    let supabaseImages = 0;
    let mixedDiscs = 0;

    allDiscs.forEach(disc => {
      if (disc.image_urls) {
        const google = disc.image_urls.filter(url => url.includes('storage.googleapis.com')).length;
        const supabase = disc.image_urls.filter(url => url.includes(supabaseUrl)).length;

        totalImages += disc.image_urls.length;
        googleImages += google;
        supabaseImages += supabase;

        if (google > 0 && supabase > 0) {
          mixedDiscs++;
        }
      }
    });

    console.log(`📀 Total discs with images: ${allDiscs.length}`);
    console.log(`🖼️  Total images: ${totalImages}`);
    console.log(`🔗 Google Storage images: ${googleImages}`);
    console.log(`☁️  Supabase Storage images: ${supabaseImages}`);
    console.log(`🔄 Discs with mixed storage: ${mixedDiscs}`);

    const migrationComplete = googleImages === 0;
    console.log(`\n${migrationComplete ? '✅' : '⚠️'} Migration status: ${migrationComplete ? 'Complete' : 'In Progress'}`);

  } catch (error) {
    console.error('Status check failed:', error);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--test')) {
    const limit = parseInt(args[args.indexOf('--test') + 1]) || 3;
    await testMigration(limit);
    return;
  }

  if (args.includes('--status')) {
    await checkMigrationStatus();
    return;
  }

  if (args.includes('--help')) {
    console.log('Found Disc Image Migration Script');
    console.log('');
    console.log('Usage:');
    console.log('  node migrate-found-disc-images.js           # Migrate all images');
    console.log('  node migrate-found-disc-images.js --test 3  # Test migration with 3 discs');
    console.log('  node migrate-found-disc-images.js --status  # Check migration status');
    console.log('  node migrate-found-disc-images.js --help    # Show this help');
    return;
  }

  try {
    const stats = await migrateAllImages();

    if (stats.successfulDiscs > 0) {
      console.log('\n🎉 Image migration completed!');
      console.log('\n📋 Next steps:');
      console.log('1. Verify images are accessible in your app');
      console.log('2. Check Supabase Storage usage');
      console.log('3. Consider cleaning up failed migrations');
    } else {
      console.log('\n⚠️  No images were migrated. Check the errors above.');
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

module.exports = {
  migrateAllImages,
  migrateDiscImages,
  testMigration,
  checkMigrationStatus
};
