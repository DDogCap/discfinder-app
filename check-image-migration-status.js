const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkImageMigrationStatus() {
  console.log('🔍 Checking image migration status...');
  
  try {
    // Get total count of found discs
    const { count: totalDiscs, error: countError } = await supabase
      .from('found_discs')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('Error getting total disc count:', countError);
      return;
    }
    
    console.log(`📊 Total found discs: ${totalDiscs}`);
    
    // Get discs with images
    const { data: discsWithImages, error: imagesError } = await supabase
      .from('found_discs')
      .select('id, image_urls, legacy_row_id')
      .not('image_urls', 'is', null)
      .neq('image_urls', '{}'); // Not empty array
    
    if (imagesError) {
      console.error('Error getting discs with images:', imagesError);
      return;
    }
    
    console.log(`📸 Discs with images: ${discsWithImages?.length || 0}`);
    
    // Get discs without images
    const { data: discsWithoutImages, error: noImagesError } = await supabase
      .from('found_discs')
      .select('id, legacy_row_id')
      .or('image_urls.is.null,image_urls.eq.{}');
    
    if (noImagesError) {
      console.error('Error getting discs without images:', noImagesError);
      return;
    }
    
    console.log(`🚫 Discs without images: ${discsWithoutImages?.length || 0}`);
    
    // Check if we hit the 1000 record limit warning
    if (discsWithImages && discsWithImages.length === 1000) {
      console.log('\n⚠️  WARNING: Exactly 1000 records returned!');
      console.log('   This suggests the query may have hit a limit.');
      console.log('   Image migration may be incomplete.');
      console.log('   Consider chunking the migration process.');
    }
    
    // Sample some discs with images to check image URL format
    if (discsWithImages && discsWithImages.length > 0) {
      console.log('\n🔗 Sample image URLs:');
      const samples = discsWithImages.slice(0, 3);
      for (const disc of samples) {
        console.log(`   Disc ${disc.legacy_row_id}: ${disc.image_urls?.length || 0} images`);
        if (disc.image_urls && disc.image_urls.length > 0) {
          disc.image_urls.forEach((url, index) => {
            console.log(`     ${index + 1}: ${url.substring(0, 80)}...`);
          });
        }
      }
    }
    
    // Check for potential migration issues
    console.log('\n🔧 Migration Health Check:');
    
    // Check for broken image URLs
    let brokenUrlCount = 0;
    if (discsWithImages) {
      for (const disc of discsWithImages) {
        if (disc.image_urls) {
          for (const url of disc.image_urls) {
            if (!url || !url.startsWith('http')) {
              brokenUrlCount++;
              break; // Count disc once even if multiple broken URLs
            }
          }
        }
      }
    }
    
    console.log(`   ✅ Discs with valid image URLs: ${(discsWithImages?.length || 0) - brokenUrlCount}`);
    console.log(`   ❌ Discs with broken image URLs: ${brokenUrlCount}`);
    
    // Calculate migration percentage
    const migrationPercentage = totalDiscs > 0 ? ((discsWithImages?.length || 0) / totalDiscs * 100).toFixed(1) : 0;
    console.log(`   📈 Migration completion: ${migrationPercentage}%`);
    
    // Recommendations
    console.log('\n💡 Recommendations:');
    if (discsWithImages && discsWithImages.length === 1000) {
      console.log('   - Implement chunked migration to process all records');
      console.log('   - Use pagination with offset/limit or cursor-based pagination');
    }
    
    if (brokenUrlCount > 0) {
      console.log('   - Review and fix broken image URLs');
      console.log('   - Consider re-running migration for affected discs');
    }
    
    if (migrationPercentage < 100) {
      console.log('   - Continue image migration for remaining discs');
      console.log('   - Monitor for rate limiting or API issues');
    }
    
  } catch (error) {
    console.error('Error checking image migration status:', error);
  }
}

// Add command line argument handling
const args = process.argv.slice(2);

if (args.includes('--help')) {
  console.log('Usage: node check-image-migration-status.js [options]');
  console.log('Options:');
  console.log('  --help    Show this help message');
  console.log('');
  console.log('This script checks the status of image migration for found discs.');
  console.log('It will warn if exactly 1000 records are returned (potential limit hit).');
} else {
  checkImageMigrationStatus();
}

module.exports = { checkImageMigrationStatus };
