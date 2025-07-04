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
  console.error('\nPlease add SUPABASE_SERVICE_ROLE_KEY to your .env.local file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log('Running messaging fields migration...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'ADD_MESSAGING_FIELDS_TO_SOURCES.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`Executing ${statements.length} SQL statements...`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`\nExecuting statement ${i + 1}/${statements.length}:`);
      console.log(statement.substring(0, 100) + (statement.length > 100 ? '...' : ''));
      
      const { error } = await supabase.rpc('exec_sql', { sql: statement });
      
      if (error) {
        console.error(`Error in statement ${i + 1}:`, error);
        // Continue with other statements unless it's a critical error
        if (error.message.includes('already exists')) {
          console.log('Column already exists, continuing...');
        } else {
          throw error;
        }
      } else {
        console.log('✅ Statement executed successfully');
      }
    }
    
    console.log('\n✅ Messaging fields migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Run: npm run import-sources-with-messaging');
    console.log('2. Test SMS functionality with a found disc entry');
    
  } catch (error) {
    console.error('Migration failed:', error);
    console.log('\nNote: You may need to run this migration manually in the Supabase SQL editor.');
    console.log('Copy the contents of ADD_MESSAGING_FIELDS_TO_SOURCES.sql and paste it into the SQL editor.');
  }
}

// Run the migration
console.log('Starting messaging fields migration...');
console.log('Supabase URL:', supabaseUrl);

runMigration();
