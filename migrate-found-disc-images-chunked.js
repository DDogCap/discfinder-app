/**
 * Chunked Found Disc Image Migration Script
 * 
 * This script downloads images from Google Storage URLs in the found_discs table
 * and uploads them to Supabase Storage, updating the image_urls field.
 * 
 * IMPROVED VERSION: Uses chunked processing to handle all records, not just first 1000
 * 
 * Prerequisites:
 * 1. Install required packages: npm install axios
 * 2. Set up environment variables for Supabase
 * 3. Found discs must already be imported with Google Storage URLs
 * 4. Supabase Storage bucket 'disc-images' must exist
 * 
 * Usage:
 * node migrate-found-disc-images-chunked.js
 * node migrate-found-disc-images-chunked.js --test 5
 * node migrate-found-disc-images-chunked.js --status
 * node migrate-found-disc-images-chunked.js --resume
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
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

// Configuration
const BUCKET_NAME = 'disc-images';
const BATCH_SIZE = 5; // Process images in batches to avoid overwhelming the server
const CHUNK_SIZE = 100; // Database query chunk size to avoid 1000 record limit
const DOWNLOAD_TIMEOUT = 30000; // 30 seconds timeout for downloads
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB max file size
const PROGRESS_FILE = 'migration-progress.json';

/**
 * Save migration progress to file
 */
function saveProgress(progress) {
  try {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
  } catch (error) {
    console.warn('Could not save progress:', error.message);
  }
}

/**
 * Load migration progress from file
 */
function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    }
  } catch (error) {
    console.warn('Could not load progress:', error.message);
  }
  return null;
}

/**
 * Download image from URL
 */
async function downloadImage(url) {
  try {
    console.log(`📥 Downloading: ${url.substring(0, 80)}...`);
    
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'arraybuffer',
      timeout: DOWNLOAD_TIMEOUT,
      maxContentLength: MAX_FILE_SIZE,
      headers: {
        'User-Agent': 'DiscFinder-Migration/1.0'
      }
    });

    if (response.data.length > MAX_FILE_SIZE) {
      throw new Error(`File too large: ${response.data.length} bytes`);
    }

    return {
      success: true,
      data: response.data,
      contentType: response.headers['content-type'] || 'image/jpeg'
    };

  } catch (error) {
    console.error(`❌ Download failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Upload image to Supabase Storage
 */
async function uploadToSupabase(imageData, fileName, contentType) {
  try {
    console.log(`📤 Uploading: ${fileName}`);
    
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, imageData, {
        contentType: contentType,
        upsert: true
      });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    return {
      success: true,
      url: urlData.publicUrl,
      path: data.path
    };

  } catch (error) {
    console.error(`❌ Upload failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get total count of discs needing migration
 */
async function getTotalDiscsCount() {
  try {
    const { count, error } = await supabase
      .from('found_discs')
      .select('*', { count: 'exact', head: true })
      .not('image_urls', 'is', null)
      .neq('image_urls', '{}');

    if (error) {
      throw new Error(`Failed to count discs: ${error.message}`);
    }

    return count || 0;
  } catch (error) {
    throw new Error(`Database count failed: ${error.message}`);
  }
}

/**
 * Get found discs that need image migration (chunked)
 */
async function getDiscsNeedingMigrationChunked(offset = 0, limit = CHUNK_SIZE) {
  try {
    console.log(`🔍 Querying discs at offset ${offset}, limit ${limit}`);

    const { data, error } = await supabase
      .from('found_discs')
      .select('id, legacy_row_id, brand, mold, image_urls')
      .not('image_urls', 'is', null)
      .neq('image_urls', '{}')
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch found discs: ${error.message}`);
    }

    console.log(`📦 Retrieved ${data.length} discs from database`);

    // Filter discs that have Google Storage URLs that haven't been migrated
    const discsNeedingMigration = data.filter(disc => {
      const hasGoogleUrls = disc.image_urls && disc.image_urls.some(url =>
        url.includes('storage.googleapis.com')
      );
      const hasUnmigratedUrls = disc.image_urls && disc.image_urls.some(url =>
        url.includes('storage.googleapis.com') && !url.includes(supabaseUrl)
      );
      return hasUnmigratedUrls;
    });

    console.log(`🔄 Found ${discsNeedingMigration.length} discs needing migration in this chunk`);

    return discsNeedingMigration;

  } catch (error) {
    throw new Error(`Database query failed: ${error.message}`);
  }
}

/**
 * Migrate images for a single disc
 */
async function migrateDiscImages(disc) {
  const result = {
    discId: disc.id,
    legacyRowId: disc.legacy_row_id,
    success: false,
    originalUrls: disc.image_urls || [],
    newUrls: [],
    errors: []
  };

  try {
    console.log(`\n🔄 Processing disc: ${disc.brand} ${disc.mold || ''} (${disc.legacy_row_id})`);
    
    if (!disc.image_urls || disc.image_urls.length === 0) {
      result.success = true;
      result.newUrls = [];
      return result;
    }

    const newUrls = [];

    for (let i = 0; i < disc.image_urls.length; i++) {
      const originalUrl = disc.image_urls[i];
      
      // Skip if already migrated to Supabase
      if (originalUrl.includes(supabaseUrl)) {
        console.log(`✅ Already migrated: Image ${i + 1}`);
        newUrls.push(originalUrl);
        continue;
      }

      // Generate filename
      const timestamp = Date.now();
      const imageIndex = i + 1;
      const fileName = `found-discs/${disc.legacy_row_id || disc.id}_${imageIndex}_${timestamp}.jpg`;

      // Download image
      const downloadResult = await downloadImage(originalUrl);
      if (!downloadResult.success) {
        result.errors.push(`Image ${imageIndex}: ${downloadResult.error}`);
        newUrls.push(originalUrl); // Keep original URL if download fails
        continue;
      }

      // Upload to Supabase
      const uploadResult = await uploadToSupabase(
        downloadResult.data, 
        fileName, 
        downloadResult.contentType
      );
      
      if (uploadResult.success) {
        console.log(`✅ Migrated: Image ${imageIndex}`);
        newUrls.push(uploadResult.url);
      } else {
        result.errors.push(`Image ${imageIndex}: ${uploadResult.error}`);
        newUrls.push(originalUrl); // Keep original URL if upload fails
      }

      // Small delay between images
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Update database with new URLs
    const { error: updateError } = await supabase
      .from('found_discs')
      .update({ image_urls: newUrls })
      .eq('id', disc.id);

    if (updateError) {
      result.errors.push(`Database update failed: ${updateError.message}`);
    } else {
      result.success = true;
      result.newUrls = newUrls;
      console.log(`✅ Updated database for disc ${disc.legacy_row_id}`);
    }

  } catch (error) {
    result.errors.push(`Migration failed: ${error.message}`);
    console.error(`❌ Failed to migrate disc ${disc.legacy_row_id}:`, error.message);
  }

  return result;
}

/**
 * Main chunked migration function
 */
async function migrateAllImagesChunked(resumeFromProgress = false) {
  console.log('🚀 Starting chunked found disc image migration...\n');

  let stats = {
    totalDiscs: 0,
    processedDiscs: 0,
    successfulDiscs: 0,
    failedDiscs: 0,
    totalImages: 0,
    migratedImages: 0,
    failedImages: 0,
    errors: [],
    startTime: new Date().toISOString(),
    currentOffset: 0
  };

  // Load previous progress if resuming
  if (resumeFromProgress) {
    const savedProgress = loadProgress();
    if (savedProgress) {
      stats = { ...stats, ...savedProgress };
      console.log(`📂 Resuming from offset ${stats.currentOffset}`);
    }
  }

  try {
    // Get total count first
    if (stats.totalDiscs === 0) {
      console.log('📊 Counting total discs...');
      const totalCount = await getTotalDiscsCount();
      console.log(`Found ${totalCount} discs with images in database\n`);
    }

    let hasMoreData = true;
    let offset = stats.currentOffset;

    while (hasMoreData) {
      console.log(`\n📦 Fetching chunk at offset ${offset}...`);

      // Get chunk of ALL discs (not just those needing migration)
      const { data: allDiscsInChunk, error } = await supabase
        .from('found_discs')
        .select('id, legacy_row_id, brand, mold, image_urls')
        .not('image_urls', 'is', null)
        .neq('image_urls', '{}')
        .order('created_at', { ascending: true })
        .range(offset, offset + CHUNK_SIZE - 1);

      if (error) {
        throw new Error(`Failed to fetch chunk: ${error.message}`);
      }

      // If we got no records, we've reached the end
      if (allDiscsInChunk.length === 0) {
        console.log('✅ Reached end of data');
        hasMoreData = false;
        break;
      }

      // Filter for discs that need migration
      const discs = allDiscsInChunk.filter(disc => {
        return disc.image_urls && disc.image_urls.some(url =>
          url.includes('storage.googleapis.com') && !url.includes(supabaseUrl)
        );
      });

      console.log(`📦 Retrieved ${allDiscsInChunk.length} discs, ${discs.length} need migration`);

      // If this chunk has fewer records than requested, we're at the end
      if (allDiscsInChunk.length < CHUNK_SIZE) {
        hasMoreData = false;
      }

      // Process discs in this chunk (only if there are any)
      if (discs.length > 0) {
        console.log(`🔄 Processing ${discs.length} discs needing migration...`);
      } else {
        console.log(`⏭️  No discs need migration in this chunk, continuing...`);
      }

      for (let i = 0; i < discs.length; i += BATCH_SIZE) {
        const batch = discs.slice(i, i + BATCH_SIZE);
        console.log(`\n🔄 Processing batch ${Math.floor(i / BATCH_SIZE) + 1} of chunk (${batch.length} discs)...`);

        for (const disc of batch) {
          stats.processedDiscs++;
          
          try {
            const result = await migrateDiscImages(disc);
            
            if (result.success) {
              stats.successfulDiscs++;
              const migratedCount = result.newUrls.filter((url, index) => 
                url !== result.originalUrls[index] && url.includes(supabaseUrl)
              ).length;
              stats.migratedImages += migratedCount;
            } else {
              stats.failedDiscs++;
              stats.errors.push(`Disc ${disc.legacy_row_id}: ${result.errors.join(', ')}`);
            }

            if (result.errors.length > 0) {
              stats.failedImages += result.errors.length;
            }

          } catch (error) {
            stats.failedDiscs++;
            stats.errors.push(`Disc ${disc.legacy_row_id}: ${error.message}`);
            console.error(`❌ Unexpected error processing disc ${disc.legacy_row_id}:`, error.message);
          }

          // Save progress periodically
          if (stats.processedDiscs % 10 === 0) {
            stats.currentOffset = offset;
            saveProgress(stats);
          }
        }

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Move to next chunk
      offset += CHUNK_SIZE;
      stats.currentOffset = offset;
      saveProgress(stats);
    }

    // Final statistics
    stats.endTime = new Date().toISOString();
    saveProgress(stats);

    console.log('\n🎉 Migration completed!');
    console.log('📊 Final Statistics:');
    console.log(`   Total discs processed: ${stats.processedDiscs}`);
    console.log(`   Successful migrations: ${stats.successfulDiscs}`);
    console.log(`   Failed migrations: ${stats.failedDiscs}`);
    console.log(`   Images migrated: ${stats.migratedImages}`);
    console.log(`   Failed images: ${stats.failedImages}`);
    
    if (stats.errors.length > 0) {
      console.log(`\n❌ Errors (${stats.errors.length}):`);
      stats.errors.slice(0, 10).forEach(error => console.log(`   - ${error}`));
      if (stats.errors.length > 10) {
        console.log(`   ... and ${stats.errors.length - 10} more errors`);
      }
    }

    return stats;

  } catch (error) {
    console.error('💥 Migration failed:', error);
    stats.errors.push(`Migration failed: ${error.message}`);
    saveProgress(stats);
    throw error;
  }
}

/**
 * Test migration with a small number of discs
 */
async function testMigration(limit = 3) {
  console.log(`🧪 Testing migration with ${limit} discs...\n`);

  try {
    // Try different offsets to find discs that need migration
    let discs = [];
    let offset = 0;
    const maxAttempts = 10;
    let attempts = 0;

    while (discs.length === 0 && attempts < maxAttempts) {
      console.log(`🔍 Trying offset ${offset}...`);
      const chunk = await getDiscsNeedingMigrationChunked(offset, CHUNK_SIZE);
      discs = chunk.slice(0, limit);

      if (discs.length === 0) {
        offset += CHUNK_SIZE;
        attempts++;
      }
    }

    console.log(`Found ${discs.length} discs for testing`);

    if (discs.length === 0) {
      console.log('✅ No discs need migration in first 1000 records!');
      console.log('💡 Try running the full migration to process all records.');
      return;
    }

    for (const disc of discs) {
      console.log(`\n🔄 Testing migration for: ${disc.brand} ${disc.mold || ''} (${disc.legacy_row_id})`);
      const result = await migrateDiscImages(disc);
      console.log(`Test result for ${disc.legacy_row_id}:`, result.success ? '✅ Success' : '❌ Failed');
      if (result.errors.length > 0) {
        console.log(`Errors: ${result.errors.join(', ')}`);
      }
    }

  } catch (error) {
    console.error('Test migration failed:', error);
  }
}

/**
 * Show migration status
 */
async function showStatus() {
  try {
    console.log('📊 Migration Status Report\n');

    // Get total discs
    const totalDiscs = await getTotalDiscsCount();
    console.log(`Total discs with images: ${totalDiscs}`);

    // Get discs with migrated images (Supabase URLs)
    const { data: migratedDiscs, error: migratedError } = await supabase
      .from('found_discs')
      .select('id, image_urls')
      .not('image_urls', 'is', null)
      .neq('image_urls', '{}');

    if (migratedError) {
      throw new Error(`Failed to fetch migrated discs: ${migratedError.message}`);
    }

    const fullyMigrated = migratedDiscs.filter(disc =>
      disc.image_urls && disc.image_urls.every(url => url.includes(supabaseUrl))
    );

    const partiallyMigrated = migratedDiscs.filter(disc =>
      disc.image_urls && disc.image_urls.some(url => url.includes(supabaseUrl)) &&
      disc.image_urls.some(url => !url.includes(supabaseUrl))
    );

    const notMigrated = migratedDiscs.filter(disc =>
      disc.image_urls && disc.image_urls.every(url => !url.includes(supabaseUrl))
    );

    console.log(`✅ Fully migrated: ${fullyMigrated.length}`);
    console.log(`🔄 Partially migrated: ${partiallyMigrated.length}`);
    console.log(`❌ Not migrated: ${notMigrated.length}`);
    console.log(`📈 Migration progress: ${((fullyMigrated.length / totalDiscs) * 100).toFixed(1)}%`);

    // Check for saved progress
    const savedProgress = loadProgress();
    if (savedProgress) {
      console.log(`\n📂 Saved progress found:`);
      console.log(`   Last processed: ${savedProgress.processedDiscs} discs`);
      console.log(`   Current offset: ${savedProgress.currentOffset}`);
      console.log(`   Started: ${savedProgress.startTime}`);
      if (savedProgress.endTime) {
        console.log(`   Completed: ${savedProgress.endTime}`);
      }
    }

    if (fullyMigrated.length === totalDiscs) {
      console.log('\n🎉 Migration is complete!');
    } else {
      console.log(`\n⚠️  ${totalDiscs - fullyMigrated.length} discs still need migration`);
    }

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
  } else if (args.includes('--status')) {
    await showStatus();
  } else if (args.includes('--resume')) {
    await migrateAllImagesChunked(true);
  } else if (args.includes('--help')) {
    console.log('Usage: node migrate-found-disc-images-chunked.js [options]');
    console.log('Options:');
    console.log('  --test [N]    Test migration with N discs (default: 3)');
    console.log('  --status      Show current migration status');
    console.log('  --resume      Resume migration from saved progress');
    console.log('  --help        Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  node migrate-found-disc-images-chunked.js --test 5');
    console.log('  node migrate-found-disc-images-chunked.js --status');
    console.log('  node migrate-found-disc-images-chunked.js --resume');
    console.log('  node migrate-found-disc-images-chunked.js  # Full migration');
  } else {
    await migrateAllImagesChunked(false);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
}

module.exports = {
  migrateAllImagesChunked,
  getTotalDiscsCount,
  getDiscsNeedingMigrationChunked,
  testMigration,
  showStatus
};
