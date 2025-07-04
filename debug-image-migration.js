const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugImageMigration() {
  console.log('🔍 Debugging image migration data...\n');
  
  try {
    // Get sample discs with images
    const { data: allDiscs, error } = await supabase
      .from('found_discs')
      .select('id, legacy_row_id, brand, mold, image_urls')
      .not('image_urls', 'is', null)
      .neq('image_urls', '{}')
      .limit(10);
    
    if (error) {
      console.error('Error fetching discs:', error);
      return;
    }
    
    console.log(`Found ${allDiscs.length} sample discs with images:`);
    
    for (const disc of allDiscs) {
      console.log(`\nDisc: ${disc.brand} ${disc.mold || ''} (${disc.legacy_row_id})`);
      console.log(`  ID: ${disc.id}`);
      console.log(`  Image URLs (${disc.image_urls?.length || 0}):`);
      
      if (disc.image_urls) {
        disc.image_urls.forEach((url, index) => {
          const isGoogleStorage = url.includes('storage.googleapis.com');
          const isSupabase = url.includes(process.env.REACT_APP_SUPABASE_URL);
          console.log(`    ${index + 1}: ${url.substring(0, 80)}...`);
          console.log(`       Google Storage: ${isGoogleStorage}, Supabase: ${isSupabase}`);
        });
      }
      
      // Check if this disc needs migration
      const needsMigration = disc.image_urls && disc.image_urls.some(url => 
        url.includes('storage.googleapis.com') && !url.includes(process.env.REACT_APP_SUPABASE_URL)
      );
      
      console.log(`  Needs migration: ${needsMigration}`);
    }
    
    // Count different types
    console.log('\n📊 Summary:');
    
    const googleStorageDiscs = allDiscs.filter(disc => 
      disc.image_urls && disc.image_urls.some(url => url.includes('storage.googleapis.com'))
    );
    
    const supabaseDiscs = allDiscs.filter(disc => 
      disc.image_urls && disc.image_urls.some(url => url.includes(process.env.REACT_APP_SUPABASE_URL))
    );
    
    const needsMigrationDiscs = allDiscs.filter(disc => 
      disc.image_urls && disc.image_urls.some(url => 
        url.includes('storage.googleapis.com') && !url.includes(process.env.REACT_APP_SUPABASE_URL)
      )
    );
    
    console.log(`  Discs with Google Storage URLs: ${googleStorageDiscs.length}`);
    console.log(`  Discs with Supabase URLs: ${supabaseDiscs.length}`);
    console.log(`  Discs needing migration: ${needsMigrationDiscs.length}`);
    
    // Check the first few that need migration
    if (needsMigrationDiscs.length > 0) {
      console.log('\n🔄 First few discs needing migration:');
      needsMigrationDiscs.slice(0, 3).forEach(disc => {
        console.log(`  - ${disc.brand} ${disc.mold || ''} (${disc.legacy_row_id})`);
      });
    }
    
  } catch (error) {
    console.error('Debug failed:', error);
  }
}

if (require.main === module) {
  debugImageMigration();
}

module.exports = { debugImageMigration };
