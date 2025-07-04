const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
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

async function updateSourcesMessaging() {
  try {
    console.log('Updating sources with messaging data...\n');

    // Read the CSV file
    const csvPath = path.join(__dirname, 'external_data', 'sources.csv');
    if (!fs.existsSync(csvPath)) {
      console.error(`CSV file not found: ${csvPath}`);
      process.exit(1);
    }

    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const csvData = parseCSV(csvContent);

    console.log(`Parsed ${csvData.length} sources from CSV`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      const legacyRowId = row['🔒 Row ID'];
      const sourceName = row['Source'];
      const initialMessage = row['Text Message - Initial'];
      const reminderMessage = row['Text Message - Reminder'];

      if (!legacyRowId || !sourceName) {
        console.log(`Skipping row ${i + 1}: Missing required data`);
        skipped++;
        continue;
      }

      // Find the source by legacy_row_id
      const { data: existingSource, error: findError } = await supabase
        .from('sources')
        .select('id, name, msg1_found_just_entered, msg2_reminder')
        .eq('legacy_row_id', legacyRowId)
        .single();

      if (findError || !existingSource) {
        console.log(`Source not found for legacy ID ${legacyRowId}: ${sourceName}`);
        skipped++;
        continue;
      }

      // Check if messaging data needs to be updated
      const needsUpdate = 
        (initialMessage && initialMessage.trim() !== '' && existingSource.msg1_found_just_entered !== initialMessage.trim()) ||
        (reminderMessage && reminderMessage.trim() !== '' && existingSource.msg2_reminder !== reminderMessage.trim());

      if (!needsUpdate) {
        console.log(`Skipping "${sourceName}": Messaging data already up to date`);
        skipped++;
        continue;
      }

      // Prepare update data
      const updateData = {};
      if (initialMessage && initialMessage.trim() !== '') {
        updateData.msg1_found_just_entered = initialMessage.trim();
      }
      if (reminderMessage && reminderMessage.trim() !== '') {
        updateData.msg2_reminder = reminderMessage.trim();
      }

      // Update the source
      const { error: updateError } = await supabase
        .from('sources')
        .update(updateData)
        .eq('id', existingSource.id);

      if (updateError) {
        console.error(`Error updating "${sourceName}":`, updateError);
        errors++;
      } else {
        console.log(`✅ Updated "${sourceName}" with messaging data`);
        if (updateData.msg1_found_just_entered) {
          console.log(`   Initial: ${updateData.msg1_found_just_entered.substring(0, 50)}...`);
        }
        if (updateData.msg2_reminder) {
          console.log(`   Reminder: ${updateData.msg2_reminder.substring(0, 50)}...`);
        }
        updated++;
      }
    }

    console.log('\n📊 Update Summary:');
    console.log(`✅ Updated: ${updated}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`📝 Total processed: ${csvData.length}`);

    // Show sources with messaging data
    const { data: sourcesWithMessages, error: queryError } = await supabase
      .from('sources')
      .select('id, name, is_active, msg1_found_just_entered, msg2_reminder')
      .not('msg1_found_just_entered', 'is', null)
      .order('name');

    if (!queryError && sourcesWithMessages) {
      console.log(`\n📨 Sources with initial messages: ${sourcesWithMessages.length}`);
      sourcesWithMessages.forEach(source => {
        const status = source.is_active ? '🟢' : '🔴';
        console.log(`  ${status} ${source.name}`);
      });
    }

  } catch (error) {
    console.error('Update failed:', error);
    process.exit(1);
  }
}

updateSourcesMessaging();
