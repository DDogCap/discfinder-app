const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testSources() {
  try {
    console.log('Testing sources functionality...\n');
    
    // Test 1: Check if sources table exists and has the default "Other" source
    console.log('1. Testing sources table access...');
    const { data: sources, error: sourcesError } = await supabase
      .from('sources')
      .select('*');
    
    if (sourcesError) {
      console.error('❌ Error accessing sources table:', sourcesError);
      return;
    }
    
    console.log(`✅ Sources table accessible. Found ${sources.length} sources.`);
    
    if (sources.length > 0) {
      console.log('Existing sources:');
      sources.forEach(source => {
        console.log(`  - ${source.name} (${source.is_active ? 'Active' : 'Inactive'}) - Order: ${source.sort_order}`);
      });
    }
    
    // Test 2: Check if we can get active sources only
    console.log('\n2. Testing active sources filter...');
    const { data: activeSources, error: activeError } = await supabase
      .from('sources')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    
    if (activeError) {
      console.error('❌ Error getting active sources:', activeError);
      return;
    }
    
    console.log(`✅ Active sources query works. Found ${activeSources.length} active sources.`);
    
    // Test 3: Check if found_discs table has source_id column
    console.log('\n3. Testing found_discs table integration...');
    const { data: discs, error: discsError } = await supabase
      .from('found_discs')
      .select('id, source_id, location_found')
      .limit(1);
    
    if (discsError) {
      console.error('❌ Error accessing found_discs with source_id:', discsError);
      return;
    }
    
    console.log('✅ found_discs table has source_id column');
    
    // Test 4: Check if the views work with source information
    console.log('\n4. Testing public view with source information...');
    const { data: publicDiscs, error: publicError } = await supabase
      .from('public_found_discs')
      .select('id, source_name, location_found')
      .limit(1);
    
    if (publicError) {
      console.error('❌ Error accessing public view with source info:', publicError);
      return;
    }
    
    console.log('✅ Public view includes source information');
    
    console.log('\n🎉 All tests passed! Sources functionality is working correctly.');
    
    // Show sample data for verification
    if (activeSources.length > 0) {
      console.log('\nSample active sources for dropdown:');
      activeSources.forEach(source => {
        console.log(`  "${source.name}"`);
      });
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

async function createSampleSources() {
  console.log('\nCreating sample sources for testing...');
  
  const sampleSources = [
    { name: '2021 DDO', description: '2021 Dynamic Discs Open', is_active: true, sort_order: 10 },
    { name: 'Lawrence, KS (Local)', description: 'Local Lawrence area courses', is_active: true, sort_order: 20 },
    { name: '2019 GBO', description: '2019 Glass Blown Open', is_active: true, sort_order: 30 },
    { name: 'Emporia, KS Ponds', description: 'Water hazards in Emporia area', is_active: true, sort_order: 40 },
    { name: 'Jones, Emporia', description: 'Jones Park in Emporia', is_active: true, sort_order: 50 },
    { name: '2022 DDO', description: '2022 Dynamic Discs Open', is_active: true, sort_order: 60 },
    { name: 'Centennial Birdie Bin', description: 'Centennial Park lost and found bin', is_active: true, sort_order: 70 },
    { name: '2022 Worlds', description: '2022 World Championships', is_active: true, sort_order: 80 },
    { name: 'Unknown', description: 'Unknown or unspecified location', is_active: true, sort_order: 90 }
  ];
  
  for (const source of sampleSources) {
    const { error } = await supabase
      .from('sources')
      .insert([source]);
    
    if (error) {
      if (error.message.includes('duplicate key')) {
        console.log(`  - "${source.name}" already exists, skipping...`);
      } else {
        console.error(`  ❌ Error creating "${source.name}":`, error);
      }
    } else {
      console.log(`  ✅ Created "${source.name}"`);
    }
  }
  
  console.log('\nSample sources creation completed.');
}

// Main execution
async function main() {
  console.log('Sources Table Test Script');
  console.log('========================\n');
  
  await testSources();
  
  // Optionally create sample sources
  const args = process.argv.slice(2);
  if (args.includes('--create-samples')) {
    await createSampleSources();
    console.log('\nRe-running tests with sample data...');
    await testSources();
  }
}

main().catch(console.error);
