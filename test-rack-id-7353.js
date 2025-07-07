import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRackId7353() {
  console.log('🔍 Testing search for rack_id 7353...\n');
  
  try {
    // Test 1: Direct query for rack_id 7353
    console.log('1. Direct query for rack_id = 7353:');
    const { data: directQuery, error: directError } = await supabase
      .from('found_discs')
      .select('id, rack_id, brand, mold, color, status')
      .eq('rack_id', 7353);
    
    if (directError) {
      console.error('❌ Direct query error:', directError);
    } else {
      console.log(`✅ Found ${directQuery.length} discs with rack_id = 7353`);
      directQuery.forEach(disc => {
        console.log(`   - Rack ID: ${disc.rack_id} | ${disc.brand} ${disc.mold} (${disc.color}) | Status: ${disc.status}`);
      });
    }
    
    // Test 2: Check if rack_id 7353 exists in any status
    console.log('\n2. Check rack_id 7353 in any status:');
    const { data: anyStatus, error: anyError } = await supabase
      .from('found_discs')
      .select('id, rack_id, brand, mold, color, status')
      .eq('rack_id', 7353);
    
    if (anyError) {
      console.error('❌ Any status query error:', anyError);
    } else {
      console.log(`✅ Found ${anyStatus.length} discs with rack_id = 7353 (any status)`);
      anyStatus.forEach(disc => {
        console.log(`   - Rack ID: ${disc.rack_id} | ${disc.brand} ${disc.mold} (${disc.color}) | Status: ${disc.status}`);
      });
    }
    
    // Test 3: Check public view
    console.log('\n3. Check public_found_discs view for rack_id 7353:');
    const { data: publicView, error: publicError } = await supabase
      .from('public_found_discs')
      .select('id, rack_id, brand, mold, color')
      .eq('rack_id', 7353);
    
    if (publicError) {
      console.error('❌ Public view query error:', publicError);
    } else {
      console.log(`✅ Found ${publicView.length} discs in public view with rack_id = 7353`);
      publicView.forEach(disc => {
        console.log(`   - Rack ID: ${disc.rack_id} | ${disc.brand} ${disc.mold} (${disc.color})`);
      });
    }
    
    // Test 4: Check nearby rack_ids
    console.log('\n4. Check nearby rack_ids (7350-7360):');
    const { data: nearby, error: nearbyError } = await supabase
      .from('found_discs')
      .select('id, rack_id, brand, mold, color, status')
      .gte('rack_id', 7350)
      .lte('rack_id', 7360)
      .order('rack_id');
    
    if (nearbyError) {
      console.error('❌ Nearby query error:', nearbyError);
    } else {
      console.log(`✅ Found ${nearby.length} discs with rack_id between 7350-7360:`);
      nearby.forEach(disc => {
        console.log(`   - Rack ID: ${disc.rack_id} | ${disc.brand} ${disc.mold} (${disc.color}) | Status: ${disc.status}`);
      });
    }
    
    // Test 5: Check max rack_id
    console.log('\n5. Check maximum rack_id:');
    const { data: maxRack, error: maxError } = await supabase
      .from('found_discs')
      .select('rack_id')
      .not('rack_id', 'is', null)
      .order('rack_id', { ascending: false })
      .limit(5);
    
    if (maxError) {
      console.error('❌ Max rack_id query error:', maxError);
    } else {
      console.log(`✅ Top 5 highest rack_ids:`);
      maxRack.forEach(disc => {
        console.log(`   - Rack ID: ${disc.rack_id}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testRackId7353();
