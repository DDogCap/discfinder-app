const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Try service role key first, fall back to anon key for read operations
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!process.env.REACT_APP_SUPABASE_URL || !supabaseKey) {
  console.error('Missing required environment variables:');
  console.error('REACT_APP_SUPABASE_URL:', !!process.env.REACT_APP_SUPABASE_URL);
  console.error('SUPABASE_SERVICE_ROLE_KEY or REACT_APP_SUPABASE_ANON_KEY:', !!supabaseKey);
  process.exit(1);
}

const supabase = createClient(process.env.REACT_APP_SUPABASE_URL, supabaseKey);

// Check if we're using service role key (needed for updates)
const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!hasServiceKey) {
  console.log('⚠️  Using anon key - investigation only mode (no updates possible)');
}

/**
 * Investigate and fix the mold data issue
 */
async function investigateMoldData() {
  console.log('🔍 Investigating mold data issue...\n');
  
  try {
    // First, let's see how many records have the problematic mold value
    const { data: problematicRecords, error: countError } = await supabase
      .from('found_discs')
      .select('id, legacy_row_id, brand, mold, description')
      .eq('mold', 'Vibram throwing star mini marker')
      .limit(1000); // Get first 1000 to analyze
    
    if (countError) {
      console.error('Error fetching problematic records:', countError);
      return;
    }
    
    console.log(`Found ${problematicRecords.length} records with mold = 'Vibram throwing star mini marker'`);
    
    if (problematicRecords.length === 0) {
      console.log('✅ No problematic records found!');
      return;
    }
    
    // Get total count of all records with this mold
    const { count: totalCount, error: totalCountError } = await supabase
      .from('found_discs')
      .select('*', { count: 'exact', head: true })
      .eq('mold', 'Vibram throwing star mini marker');
    
    if (totalCountError) {
      console.error('Error getting total count:', totalCountError);
    } else {
      console.log(`Total records with this mold: ${totalCount}`);
    }
    
    // Show some sample records to understand the pattern
    console.log('\n📋 Sample records with problematic mold:');
    console.log('=' .repeat(80));
    
    for (let i = 0; i < Math.min(10, problematicRecords.length); i++) {
      const record = problematicRecords[i];
      console.log(`${i + 1}. ID: ${record.id}`);
      console.log(`   Legacy ID: ${record.legacy_row_id}`);
      console.log(`   Brand: ${record.brand}`);
      console.log(`   Mold: ${record.mold}`);
      console.log(`   Description: ${record.description || 'N/A'}`);
      console.log('   ' + '-'.repeat(60));
    }
    
    // Analyze descriptions to see if we can extract actual molds
    console.log('\n🔍 Analyzing descriptions for potential mold extraction...');
    
    let canExtractMold = 0;
    let noDescription = 0;
    let emptyDescription = 0;
    
    const moldExtractionSamples = [];
    
    for (const record of problematicRecords) {
      if (!record.description) {
        noDescription++;
        continue;
      }
      
      if (record.description.trim() === '') {
        emptyDescription++;
        continue;
      }
      
      // Try to extract mold using the same logic as the import script
      const extractedMold = tryExtractMold(record.description, record.brand);
      if (extractedMold && extractedMold !== 'Vibram throwing star mini marker') {
        canExtractMold++;
        moldExtractionSamples.push({
          id: record.id,
          description: record.description,
          currentBrand: record.brand,
          extractedMold: extractedMold
        });
      }
    }
    
    console.log(`\n📊 Analysis Results:`);
    console.log(`   - Records with no description: ${noDescription}`);
    console.log(`   - Records with empty description: ${emptyDescription}`);
    console.log(`   - Records where mold could be extracted: ${canExtractMold}`);
    console.log(`   - Records that would be set to null: ${problematicRecords.length - canExtractMold}`);
    
    if (moldExtractionSamples.length > 0) {
      console.log('\n🎯 Sample mold extractions:');
      for (let i = 0; i < Math.min(5, moldExtractionSamples.length); i++) {
        const sample = moldExtractionSamples[i];
        console.log(`   "${sample.description}" → "${sample.extractedMold}"`);
      }
    }
    
    // Ask for confirmation before proceeding
    console.log('\n❓ Would you like to proceed with the fix?');
    console.log('   This will:');
    console.log('   1. Try to re-extract mold from description where possible');
    console.log('   2. Set mold to null for records where extraction fails');
    console.log('   3. Update all records with mold = "Vibram throwing star mini marker"');
    
    return {
      totalRecords: totalCount || problematicRecords.length,
      canExtract: canExtractMold,
      willSetToNull: problematicRecords.length - canExtractMold,
      samples: moldExtractionSamples
    };
    
  } catch (error) {
    console.error('Investigation failed:', error);
  }
}

/**
 * Try to extract mold from description using improved logic
 */
function tryExtractMold(description, currentBrand) {
  if (!description) return null;

  const desc = description.trim();

  // Common brand patterns (same as import script)
  const brandPatterns = [
    /^(Innova)\s+/i,
    /^(Discraft)\s+/i,
    /^(Dynamic\s*Disc?s?)\s+/i,
    /^(Latitude\s*64|Lat64)\s+/i,
    /^(Westside)\s+/i,
    /^(MVP)\s+/i,
    /^(Axiom)\s+/i,
    /^(Prodigy)\s+/i,
    /^(Discmania)\s+/i,
    /^(Gateway)\s+/i,
    /^(Millennium)\s+/i,
    /^(Legacy)\s+/i,
    /^(Vibram)\s+/i
  ];

  let extractedMold = '';

  // Try brand-specific extraction first
  for (const pattern of brandPatterns) {
    const match = desc.match(pattern);
    if (match) {
      // Try to extract mold from remaining text
      const remaining = desc.replace(pattern, '').trim();
      const moldMatch = remaining.match(/^([A-Za-z0-9\-\s]+)/);
      if (moldMatch) {
        extractedMold = moldMatch[1].trim().split(/\s+/)[0]; // Take first word as mold
        break;
      }
    }
  }

  // If no brand pattern matched, try improved extraction
  if (!extractedMold && desc) {
    const words = desc.split(/\s+/);

    // Skip common plastic types and descriptors to find the actual mold
    const skipWords = ['dx', 'champion', 'star', 'pro', 'gstar', 'xt', 'r-pro', 'esp', 'z', 'ti', 'big', 'z', 'dyed', 'glow', 'light', 'heavy', 'team', 'champs', 'state', 'disc', 'golf', 'club', 'stamp', 'stamped'];

    for (let i = 0; i < words.length; i++) {
      const word = words[i].toLowerCase();

      // Skip common descriptors and plastic types
      if (skipWords.includes(word) || word.length < 3) {
        continue;
      }

      // Skip words that are clearly not molds
      if (word.includes('bag') || word.includes('towel') || word.includes('marker') || word.includes('mini') || word.includes('sack')) {
        continue;
      }

      // This looks like a potential mold name
      extractedMold = words[i];
      break;
    }

    // If still no mold found, try the second word (skip first which might be plastic type)
    if (!extractedMold && words.length > 1) {
      extractedMold = words[1];
    }
  }

  // Clean up the extracted mold
  if (extractedMold) {
    extractedMold = extractedMold.replace(/[^A-Za-z0-9\-]/g, ''); // Remove special characters

    // Don't return the problematic value or other invalid values
    const invalidMolds = ['vibram', 'throwing', 'star', 'mini', 'marker', 'disc', 'golf', 'club', 'stamp', 'bag', 'towel', 'sack'];
    if (invalidMolds.includes(extractedMold.toLowerCase()) || extractedMold.length < 3) {
      return null;
    }
  }

  return extractedMold || null;
}

/**
 * Fix the mold data
 */
async function fixMoldData(dryRun = true) {
  console.log(`🔧 ${dryRun ? 'DRY RUN - ' : ''}Fixing mold data...\n`);

  // Check if we can perform updates
  if (!dryRun && !hasServiceKey) {
    console.error('❌ Cannot perform updates without SUPABASE_SERVICE_ROLE_KEY');
    console.log('   Add SUPABASE_SERVICE_ROLE_KEY to your .env.local file to enable updates');
    return;
  }

  try {
    // Get all records with the problematic mold in chunks
    let offset = 0;
    const chunkSize = 100;
    let totalProcessed = 0;
    let totalUpdated = 0;
    let totalSetToNull = 0;
    
    while (true) {
      const { data: records, error } = await supabase
        .from('found_discs')
        .select('id, legacy_row_id, brand, mold, description')
        .eq('mold', 'Vibram throwing star mini marker')
        .range(offset, offset + chunkSize - 1);
      
      if (error) {
        console.error('Error fetching records:', error);
        break;
      }
      
      if (!records || records.length === 0) {
        break;
      }
      
      console.log(`Processing chunk ${Math.floor(offset / chunkSize) + 1}: ${records.length} records`);
      
      for (const record of records) {
        totalProcessed++;
        
        // Try to extract a better mold value
        const extractedMold = tryExtractMold(record.description, record.brand);
        
        if (!dryRun) {
          // Update the record
          const { error: updateError } = await supabase
            .from('found_discs')
            .update({ mold: extractedMold })
            .eq('id', record.id);
          
          if (updateError) {
            console.error(`Error updating record ${record.id}:`, updateError);
          } else {
            totalUpdated++;
            if (extractedMold === null) {
              totalSetToNull++;
            }
          }
        } else {
          // Dry run - just count what would happen
          totalUpdated++;
          if (extractedMold === null) {
            totalSetToNull++;
          }
          
          if (totalProcessed <= 10) {
            console.log(`   ${record.legacy_row_id}: "${record.mold}" → ${extractedMold || 'NULL'}`);
            if (record.description) {
              console.log(`      Description: "${record.description.substring(0, 60)}..."`);
            }
          }
        }
      }
      
      offset += chunkSize;
      
      // Small delay to avoid rate limiting
      if (!dryRun) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`\n✅ ${dryRun ? 'DRY RUN ' : ''}Completed!`);
    console.log(`📊 Summary:`);
    console.log(`   - Total records processed: ${totalProcessed}`);
    console.log(`   - Records ${dryRun ? 'that would be ' : ''}updated: ${totalUpdated}`);
    console.log(`   - Records ${dryRun ? 'that would be ' : ''}set to null: ${totalSetToNull}`);
    console.log(`   - Records ${dryRun ? 'that would get ' : 'with '}extracted mold: ${totalUpdated - totalSetToNull}`);
    
  } catch (error) {
    console.error('Fix operation failed:', error);
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = !args.includes('--execute');
  const isInvestigateOnly = args.includes('--investigate');
  
  if (isInvestigateOnly) {
    await investigateMoldData();
  } else {
    console.log('🚀 Mold Data Fix Script');
    console.log('=' .repeat(50));
    
    if (isDryRun) {
      console.log('⚠️  DRY RUN MODE - No changes will be made');
      console.log('   Use --execute flag to apply changes');
    } else {
      console.log('🔥 EXECUTE MODE - Changes will be applied!');
    }
    
    console.log('');
    
    // First investigate
    const investigation = await investigateMoldData();
    
    if (investigation && investigation.totalRecords > 0) {
      console.log('\n' + '='.repeat(50));
      await fixMoldData(isDryRun);
    }
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { investigateMoldData, fixMoldData, tryExtractMold };
