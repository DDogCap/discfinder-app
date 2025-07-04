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

async function testSourcesImport() {
  try {
    console.log('Testing Sources Import Implementation...\n');
    
    // Test 1: Check if sources table has legacy_row_id column
    console.log('1. Testing sources table structure...');
    const { data: sources, error: sourcesError } = await supabase
      .from('sources')
      .select('id, name, legacy_row_id, is_active, sort_order')
      .limit(5);
    
    if (sourcesError) {
      console.error('❌ Error accessing sources table:', sourcesError);
      return;
    }
    
    console.log(`✅ Sources table accessible with legacy_row_id column`);
    console.log(`Found ${sources.length} sources (showing first 5)`);
    
    // Test 2: Check for imported sources with legacy_row_id
    console.log('\n2. Testing imported sources...');
    const { data: importedSources, error: importError } = await supabase
      .from('sources')
      .select('*')
      .not('legacy_row_id', 'is', null)
      .order('sort_order', { ascending: true });
    
    if (importError) {
      console.error('❌ Error getting imported sources:', importError);
      return;
    }
    
    console.log(`✅ Found ${importedSources.length} imported sources with legacy_row_id`);
    
    if (importedSources.length > 0) {
      console.log('\nImported sources:');
      importedSources.forEach(source => {
        console.log(`  - ${source.name} (${source.is_active ? 'Active' : 'Inactive'}) - Legacy ID: ${source.legacy_row_id}`);
      });
    }
    
    // Test 3: Check active sources for dropdown
    console.log('\n3. Testing active sources for dropdown...');
    const { data: activeSources, error: activeError } = await supabase
      .from('sources')
      .select('id, name, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    
    if (activeError) {
      console.error('❌ Error getting active sources:', activeError);
      return;
    }
    
    console.log(`✅ Found ${activeSources.length} active sources for dropdown`);
    console.log('\nActive sources (as they would appear in dropdown):');
    activeSources.forEach((source, index) => {
      console.log(`  ${index + 1}. ${source.name}`);
    });
    
    // Test 4: Check found_discs table default
    console.log('\n4. Testing found_discs location_found default...');
    
    // Try to get table info (this might not work with anon key, but we'll try)
    const { data: discs, error: discsError } = await supabase
      .from('found_discs')
      .select('id, location_found, source_id')
      .limit(1);
    
    if (discsError) {
      console.log('⚠️  Cannot test found_discs table (may require authentication)');
    } else {
      console.log('✅ found_discs table accessible');
    }
    
    // Test 5: Check views include source information
    console.log('\n5. Testing public view with source information...');
    const { data: publicDiscs, error: publicError } = await supabase
      .from('public_found_discs')
      .select('id, source_name, location_found')
      .limit(3);
    
    if (publicError) {
      console.log('⚠️  Cannot test public view (may require authentication)');
    } else {
      console.log('✅ Public view includes source information');
      if (publicDiscs.length > 0) {
        console.log('Sample disc data:');
        publicDiscs.forEach(disc => {
          console.log(`  - Source: ${disc.source_name || 'None'}, Location: ${disc.location_found}`);
        });
      }
    }
    
    console.log('\n🎉 Sources import testing completed!');
    
    // Summary
    console.log('\n📊 Summary:');
    console.log(`Total sources: ${sources.length}`);
    console.log(`Imported sources: ${importedSources.length}`);
    console.log(`Active sources: ${activeSources.length}`);
    
    if (importedSources.length === 0) {
      console.log('\n💡 To import sources from CSV, run:');
      console.log('   npm run import-sources');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

async function showSourcesStatus() {
  try {
    console.log('Sources Status Report');
    console.log('====================\n');
    
    // Get all sources
    const { data: allSources, error } = await supabase
      .from('sources')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    
    if (error) {
      console.error('Error getting sources:', error);
      return;
    }
    
    const activeSources = allSources.filter(s => s.is_active);
    const inactiveSources = allSources.filter(s => !s.is_active);
    const importedSources = allSources.filter(s => s.legacy_row_id);
    
    console.log(`📊 Total Sources: ${allSources.length}`);
    console.log(`🟢 Active: ${activeSources.length}`);
    console.log(`🔴 Inactive: ${inactiveSources.length}`);
    console.log(`📥 Imported (with legacy_row_id): ${importedSources.length}`);
    
    if (activeSources.length > 0) {
      console.log('\n🟢 Active Sources (for dropdown):');
      activeSources.forEach((source, index) => {
        const legacyIndicator = source.legacy_row_id ? ' [IMPORTED]' : '';
        console.log(`  ${index + 1}. ${source.name} (Order: ${source.sort_order})${legacyIndicator}`);
      });
    }
    
    if (inactiveSources.length > 0) {
      console.log('\n🔴 Inactive Sources:');
      inactiveSources.forEach((source, index) => {
        const legacyIndicator = source.legacy_row_id ? ' [IMPORTED]' : '';
        console.log(`  ${index + 1}. ${source.name} (Order: ${source.sort_order})${legacyIndicator}`);
      });
    }
    
    if (importedSources.length > 0) {
      console.log('\n📥 Sources with Legacy Row IDs:');
      importedSources.forEach(source => {
        console.log(`  - ${source.name}: ${source.legacy_row_id}`);
      });
    }
    
  } catch (error) {
    console.error('Error getting sources status:', error);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--status')) {
    await showSourcesStatus();
  } else {
    await testSourcesImport();
  }
}

main().catch(console.error);
