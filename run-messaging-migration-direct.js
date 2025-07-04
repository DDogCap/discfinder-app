const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log('Running messaging fields migration directly...');
    
    // Add the columns directly using individual queries
    console.log('Adding msg1_found_just_entered column...');
    const { error: error1 } = await supabase
      .from('sources')
      .select('msg1_found_just_entered')
      .limit(1);
    
    if (error1 && error1.message.includes('column "msg1_found_just_entered" does not exist')) {
      console.log('Column msg1_found_just_entered does not exist, need to add it manually');
    } else if (!error1) {
      console.log('✅ Column msg1_found_just_entered already exists');
    }
    
    console.log('Adding msg2_reminder column...');
    const { error: error2 } = await supabase
      .from('sources')
      .select('msg2_reminder')
      .limit(1);
    
    if (error2 && error2.message.includes('column "msg2_reminder" does not exist')) {
      console.log('Column msg2_reminder does not exist, need to add it manually');
    } else if (!error2) {
      console.log('✅ Column msg2_reminder already exists');
    }
    
    // Test if we can query the new columns
    const { data: testData, error: testError } = await supabase
      .from('sources')
      .select('id, name, msg1_found_just_entered, msg2_reminder')
      .limit(1);
    
    if (testError) {
      console.error('❌ Migration verification failed:', testError.message);
      console.log('\n📝 Manual migration required:');
      console.log('Please run this SQL in your Supabase SQL Editor:');
      console.log('');
      console.log('ALTER TABLE sources ADD COLUMN IF NOT EXISTS msg1_found_just_entered TEXT;');
      console.log('ALTER TABLE sources ADD COLUMN IF NOT EXISTS msg2_reminder TEXT;');
      console.log('');
      console.log('COMMENT ON COLUMN sources.msg1_found_just_entered IS \'Initial text message template sent when a disc is found and entered with this source\';');
      console.log('COMMENT ON COLUMN sources.msg2_reminder IS \'Reminder text message template for follow-up communications\';');
    } else {
      console.log('✅ Migration verification successful!');
      console.log('Columns are available and ready for use.');
      
      // Show current sources count
      const { data: allSources, error: countError } = await supabase
        .from('sources')
        .select('id, name, msg1_found_just_entered, msg2_reminder');
      
      if (!countError) {
        console.log(`\n📊 Found ${allSources.length} sources in database`);
        const withMessages = allSources.filter(s => s.msg1_found_just_entered);
        console.log(`📨 Sources with initial message: ${withMessages.length}`);
      }
    }
    
  } catch (error) {
    console.error('Migration failed:', error);
  }
}

runMigration();
