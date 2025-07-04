const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:');
  console.error('REACT_APP_SUPABASE_URL:', !!supabaseUrl);
  console.error('SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyAllSources() {
  try {
    console.log('Complete Sources Verification (Service Role)');
    console.log('===========================================\n');
    
    // Get ALL sources using service role (bypasses RLS)
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
    const nonImportedSources = allSources.filter(s => !s.legacy_row_id);
    
    console.log(`📊 TOTAL SOURCES: ${allSources.length}`);
    console.log(`🟢 Active: ${activeSources.length}`);
    console.log(`🔴 Inactive: ${inactiveSources.length}`);
    console.log(`📥 With Legacy Row ID: ${importedSources.length}`);
    console.log(`🆕 Without Legacy Row ID: ${nonImportedSources.length}`);
    
    console.log('\n🟢 ACTIVE SOURCES (for dropdown):');
    activeSources.forEach((source, index) => {
      const legacyIndicator = source.legacy_row_id ? ` [${source.legacy_row_id.substring(0,8)}...]` : ' [MANUAL]';
      console.log(`  ${index + 1}. ${source.name} (Order: ${source.sort_order})${legacyIndicator}`);
    });
    
    if (inactiveSources.length > 0) {
      console.log('\n🔴 INACTIVE SOURCES:');
      inactiveSources.forEach((source, index) => {
        const legacyIndicator = source.legacy_row_id ? ` [${source.legacy_row_id.substring(0,8)}...]` : ' [MANUAL]';
        console.log(`  ${index + 1}. ${source.name} (Order: ${source.sort_order})${legacyIndicator}`);
      });
    }
    
    console.log('\n📥 ALL IMPORTED SOURCES (with Legacy Row IDs):');
    importedSources.forEach((source, index) => {
      const statusIcon = source.is_active ? '🟢' : '🔴';
      console.log(`  ${index + 1}. ${statusIcon} ${source.name}`);
      console.log(`      Legacy ID: ${source.legacy_row_id}`);
      console.log(`      Status: ${source.is_active ? 'Active' : 'Inactive'}`);
      console.log(`      Sort Order: ${source.sort_order}`);
      console.log('');
    });
    
    // Expected legacy IDs from CSV
    const expectedLegacyIds = [
      '4J75CI3tRoKSN8fA8hRtFA', // 2021 DDO
      'a-PvxEsKESUmRqek7FNq.lg', // Lawrence, KS (Local)
      'iTKLRVgtSJqXotqAZ8wSwA', // 2019 GBO
      'YF7rvxKSQTGQYSDFTtZrjg', // Unknown
      'nFmfZuaCR6m-h-mJ5aADUw', // Emporia, KS Ponds
      'YxgQXLOMT2WmXa.W2F2zyQ', // Jones, Emporia
      'BGR2Q9mUQ4CXz3UU5LrXtA', // 2022 DDO
      'loZL7q5cR4yQ5-KDp9dgcw', // Centennial Birdie Bin
      'EN7vfiotQGytBX7buFlzvg', // 2022 DDO-b
      '1ZVLv8QNR22G3l8hxsTiTQ', // 2022 Worlds
      'BiYioBKySFGDs1rDUJcJ9Q', // 2022 Worlds-b
      'xrqOavbgQuudHWBYXQ5zEg', // 2023 GBO
      'R0afFU-fR-iz9EWHa4hqNQ', // 2023 DDO
      'D1q2RPJrSNiXi6cagksD.g', // 2023 Winter Putting League
      'v0l0YSvUQ1eSHV52rFaQKA', // Jones - West
      'He7Sn5YdQHOYz5LyabPj0Q', // Jones - East
      'pxPXq0Q9QKWS-86rBQUdQg', // Jones - North
      'i.6gFix7Sqi2GhFx34Ytig', // Peter Pan
      'YWWT6L6jRcy7YeFqMML6LQ', // Emporia Community Club
      '34yhRbpARyCFk8MTgdMGDA', // Paid Out to Raker/Diver
      '6u3NZ0hlSPmG2RuvyknpFA', // 2024 DDO-Ent
      'C98vhlg7TTydN8VfJcTFjg', // 2024 DDO-Pan
      '0y69vxfETl6R..nX05dEfg', // 2024 DDO-CL
      '9dtBwST5TYOY9ayd5tBlfg', // 2024 Masters Worlds
      'j-yqJZJ5Rby9-ZdMzRKf9g'  // 2025 GBO
    ];
    
    const importedLegacyIds = importedSources.map(s => s.legacy_row_id);
    const missingIds = expectedLegacyIds.filter(id => !importedLegacyIds.includes(id));
    const foundIds = expectedLegacyIds.filter(id => importedLegacyIds.includes(id));
    
    console.log('\n🔍 VERIFICATION AGAINST CSV:');
    console.log(`✅ Found: ${foundIds.length}/${expectedLegacyIds.length} legacy IDs`);
    
    if (missingIds.length === 0) {
      console.log('🎉 ALL CSV LEGACY IDs IMPORTED SUCCESSFULLY!');
    } else {
      console.log(`❌ Missing ${missingIds.length} legacy IDs:`);
      missingIds.forEach(id => console.log(`  - ${id}`));
    }
    
    console.log(`\n📈 IMPORT SUCCESS RATE: ${foundIds.length}/${expectedLegacyIds.length} (${Math.round(foundIds.length/expectedLegacyIds.length*100)}%)`);
    
    // Show summary for future imports
    console.log('\n📋 SUMMARY FOR FUTURE IMPORTS:');
    console.log(`Total sources available: ${allSources.length}`);
    console.log(`Sources with legacy mapping: ${importedSources.length}`);
    console.log(`Active sources for users: ${activeSources.length}`);
    console.log(`Inactive sources (archived): ${inactiveSources.length}`);
    
  } catch (error) {
    console.error('Error verifying sources:', error);
  }
}

verifyAllSources().catch(console.error);
