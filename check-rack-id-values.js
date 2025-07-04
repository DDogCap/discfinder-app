const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkRackIdValues() {
  console.log('🔍 Checking rack_id and display_id values...');
  
  try {
    // Check sample records with rack_id and display_id
    const { data: samples, error: sampleError } = await supabase
      .from('found_discs')
      .select('id, legacy_row_id, rack_id, display_id, brand, mold')
      .limit(10);
    
    if (sampleError) {
      console.error('Sample error:', sampleError);
      return;
    }
    
    console.log('\n📝 Sample records with rack_id and display_id:');
    samples.forEach(record => {
      console.log(`  - Legacy: ${record.legacy_row_id} | Rack ID: ${record.rack_id} | Display ID: ${record.display_id} | ${record.brand} ${record.mold || ''}`);
    });
    
    // Count non-null rack_id values
    const { data: rackIdStats, error: rackError } = await supabase
      .from('found_discs')
      .select('rack_id')
      .not('rack_id', 'is', null);
    
    if (!rackError) {
      console.log(`\n📊 Records with non-null rack_id: ${rackIdStats.length}`);
      if (rackIdStats.length > 0) {
        const rackIds = rackIdStats.map(r => r.rack_id).filter(id => id !== null);
        const maxRackId = Math.max(...rackIds);
        const minRackId = Math.min(...rackIds);
        console.log(`   - Range: ${minRackId} to ${maxRackId}`);
      }
    }
    
    // Count non-null display_id values
    const { data: displayIdStats, error: displayError } = await supabase
      .from('found_discs')
      .select('display_id')
      .not('display_id', 'is', null);
    
    if (!displayError) {
      console.log(`📊 Records with non-null display_id: ${displayIdStats.length}`);
      if (displayIdStats.length > 0) {
        const displayIds = displayIdStats.map(r => r.display_id).filter(id => id !== null);
        const maxDisplayId = Math.max(...displayIds);
        const minDisplayId = Math.min(...displayIds);
        console.log(`   - Range: ${minDisplayId} to ${maxDisplayId}`);
      }
    }
    
    // Check if legacy_row_id contains integer values that could be used
    const { data: legacyIds, error: legacyError } = await supabase
      .from('found_discs')
      .select('legacy_row_id')
      .not('legacy_row_id', 'is', null)
      .limit(100);
    
    if (!legacyError && legacyIds.length > 0) {
      console.log('\n🔍 Legacy Row ID analysis (first 100 records):');
      const integerLegacyIds = legacyIds.filter(record => 
        record.legacy_row_id && /^\d+$/.test(record.legacy_row_id)
      );
      console.log(`  - Total legacy IDs checked: ${legacyIds.length}`);
      console.log(`  - Integer legacy IDs: ${integerLegacyIds.length}`);
      
      if (integerLegacyIds.length > 0) {
        const integerIds = integerLegacyIds.map(r => parseInt(r.legacy_row_id));
        const maxLegacyId = Math.max(...integerIds);
        const minLegacyId = Math.min(...integerIds);
        console.log(`  - Integer range: ${minLegacyId} to ${maxLegacyId}`);
        console.log(`  - Sample integer legacy IDs: ${integerIds.slice(0, 5).join(', ')}`);
      }
      
      // Show some sample legacy IDs
      console.log(`  - Sample legacy IDs: ${legacyIds.slice(0, 5).map(r => r.legacy_row_id).join(', ')}`);
    }
    
    // Get total count
    const { count, error: countError } = await supabase
      .from('found_discs')
      .select('*', { count: 'exact', head: true });
    
    if (!countError) {
      console.log(`\n📊 Total found discs: ${count}`);
    }
    
  } catch (error) {
    console.error('Error checking rack ID values:', error);
  }
}

if (require.main === module) {
  checkRackIdValues();
}

module.exports = { checkRackIdValues };
