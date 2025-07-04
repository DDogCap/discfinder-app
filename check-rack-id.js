const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkForRackId() {
  console.log('🔍 Checking found_discs table structure...');
  
  try {
    // Check if rack_id field exists by trying to select it
    console.log('Checking for rack_id or display_id field...');

    let hasRackId = false;
    let hasDisplayId = false;

    try {
      await supabase.from('found_discs').select('rack_id').limit(1);
      hasRackId = true;
      console.log('✅ rack_id field exists');
    } catch (e) {
      console.log('❌ rack_id field does not exist');
    }

    try {
      await supabase.from('found_discs').select('display_id').limit(1);
      hasDisplayId = true;
      console.log('✅ display_id field exists');
    } catch (e) {
      console.log('❌ display_id field does not exist');
    }
    
    if (!hasRackId && !hasDisplayId) {
      console.log('\n❌ No user-friendly integer ID field found!');
      console.log('💡 Need to add a rack_id field for disc management.');
    }
    
    // Check a few sample records to see legacy_row_id values
    const { data: samples, error: sampleError } = await supabase
      .from('found_discs')
      .select('id, legacy_row_id, brand, mold')
      .limit(5);
    
    if (sampleError) {
      console.error('Sample error:', sampleError);
      return;
    }
    
    console.log('\n📝 Sample records:');
    samples.forEach(record => {
      console.log(`  - UUID: ${record.id.substring(0, 8)}... | Legacy ID: ${record.legacy_row_id} | ${record.brand} ${record.mold || ''}`);
    });
    
    // Check if legacy_row_id contains integer values
    const { data: legacyIds, error: legacyError } = await supabase
      .from('found_discs')
      .select('legacy_row_id')
      .not('legacy_row_id', 'is', null)
      .limit(10);
    
    if (!legacyError && legacyIds.length > 0) {
      console.log('\n🔍 Legacy Row ID analysis:');
      const integerLegacyIds = legacyIds.filter(record => 
        record.legacy_row_id && /^\d+$/.test(record.legacy_row_id)
      );
      console.log(`  - Total legacy IDs checked: ${legacyIds.length}`);
      console.log(`  - Integer legacy IDs: ${integerLegacyIds.length}`);
      
      if (integerLegacyIds.length > 0) {
        const maxLegacyId = Math.max(...integerLegacyIds.map(r => parseInt(r.legacy_row_id)));
        console.log(`  - Highest integer legacy ID: ${maxLegacyId}`);
      }
    }
    
    // Get total count of found discs
    const { count, error: countError } = await supabase
      .from('found_discs')
      .select('*', { count: 'exact', head: true });
    
    if (!countError) {
      console.log(`\n📊 Total found discs: ${count}`);
    }
    
  } catch (error) {
    console.error('Error checking rack ID:', error);
  }
}

if (require.main === module) {
  checkForRackId();
}

module.exports = { checkForRackId };
