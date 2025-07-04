const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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

function parseCSV(csvContent) {
  const lines = csvContent.split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Simple CSV parsing - handles quoted fields
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim()); // Add the last value

    if (values.length >= headers.length) {
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      data.push(row);
    }
  }

  return data;
}

function mapStatusToActive(status) {
  // Map CSV status to boolean is_active
  const activeStatuses = ['Active', 'Enabled'];
  return activeStatuses.includes(status);
}

function mapSortOrder(sort, index) {
  // Use the Sort column if it's a number, otherwise use index
  const sortNum = parseInt(sort);
  return isNaN(sortNum) ? index * 10 : sortNum;
}

async function importSources() {
  try {
    console.log('Starting sources import...\n');

    // Read the CSV file
    const csvPath = path.join(__dirname, 'external_data', 'sources.csv');
    if (!fs.existsSync(csvPath)) {
      console.error(`CSV file not found: ${csvPath}`);
      process.exit(1);
    }

    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const csvData = parseCSV(csvContent);

    console.log(`Parsed ${csvData.length} sources from CSV`);

    // Check if sources table exists and has legacy_row_id column
    const { data: tableInfo, error: tableError } = await supabase
      .from('sources')
      .select('id, legacy_row_id')
      .limit(1);

    if (tableError) {
      console.error('Error accessing sources table:', tableError);
      console.log('Make sure you have run the sources migration first.');
      process.exit(1);
    }

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      const legacyRowId = row['🔒 Row ID'];
      const sourceName = row['Source'];
      const sort = row['Sort'];
      const status = row['Status'];

      if (!legacyRowId || !sourceName) {
        console.log(`Skipping row ${i + 1}: Missing required data`);
        skipped++;
        continue;
      }

      // Check if source already exists
      const { data: existing } = await supabase
        .from('sources')
        .select('id, name')
        .eq('legacy_row_id', legacyRowId)
        .single();

      if (existing) {
        console.log(`Skipping "${sourceName}": Already exists (ID: ${existing.id})`);
        skipped++;
        continue;
      }

      // Prepare source data
      const sourceData = {
        name: sourceName,
        description: `Imported from legacy system`,
        is_active: mapStatusToActive(status),
        sort_order: mapSortOrder(sort, i),
        legacy_row_id: legacyRowId,
        msg1_found_just_entered: row['Text Message - Initial'] || null,
        msg2_reminder: row['Text Message - Reminder'] || null
      };

      // Insert the source
      const { data: newSource, error: insertError } = await supabase
        .from('sources')
        .insert([sourceData])
        .select()
        .single();

      if (insertError) {
        console.error(`Error importing "${sourceName}":`, insertError);
        errors++;
      } else {
        console.log(`✅ Imported "${sourceName}" (${status}) - Sort: ${sourceData.sort_order}`);
        imported++;
      }
    }

    console.log('\n📊 Import Summary:');
    console.log(`✅ Imported: ${imported}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`📝 Total processed: ${csvData.length}`);

    // Show final count
    const { data: allSources, error: countError } = await supabase
      .from('sources')
      .select('id, name, is_active')
      .order('sort_order', { ascending: true });

    if (!countError) {
      const activeSources = allSources.filter(s => s.is_active);
      console.log(`\n📋 Total sources in database: ${allSources.length}`);
      console.log(`🟢 Active sources: ${activeSources.length}`);
      console.log(`🔴 Inactive sources: ${allSources.length - activeSources.length}`);

      console.log('\nActive sources for dropdown:');
      activeSources.forEach(source => {
        console.log(`  - ${source.name}`);
      });
    }

  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
}

async function updateSourcesTable() {
  try {
    console.log('Updating sources table for import...\n');

    // Read and execute the update SQL
    const updateSqlPath = path.join(__dirname, 'UPDATE_SOURCES_FOR_IMPORT.sql');
    if (!fs.existsSync(updateSqlPath)) {
      console.error(`Update SQL file not found: ${updateSqlPath}`);
      process.exit(1);
    }

    const updateSQL = fs.readFileSync(updateSqlPath, 'utf8');
    
    // Split into individual statements
    const statements = updateSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('COMMENT'));

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`Executing: ${statement.substring(0, 50)}...`);
      
      const { error } = await supabase.rpc('exec_sql', { sql: statement });
      
      if (error) {
        if (error.message.includes('already exists') || error.message.includes('column "legacy_row_id" of relation "sources" already exists')) {
          console.log('✓ Already exists, continuing...');
        } else {
          console.error('Error:', error);
          throw error;
        }
      } else {
        console.log('✓ Success');
      }
    }

    console.log('\n✅ Sources table updated successfully!');
    
  } catch (error) {
    console.error('Update failed:', error);
    console.log('\nYou may need to run the UPDATE_SOURCES_FOR_IMPORT.sql manually in Supabase SQL editor.');
  }
}

// Main execution
async function main() {
  console.log('Sources Import Script');
  console.log('====================\n');

  const args = process.argv.slice(2);
  
  if (args.includes('--update-table')) {
    await updateSourcesTable();
    return;
  }

  // First update the table structure
  await updateSourcesTable();
  
  // Then import the sources
  await importSources();
}

main().catch(console.error);
