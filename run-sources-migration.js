const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // You'll need to add this to .env.local

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
    console.log('Running sources table migration...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'ADD_SOURCES_TABLE.sql');
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
          console.log('Object already exists, continuing...');
        } else {
          throw error;
        }
      } else {
        console.log('✓ Success');
      }
    }
    
    console.log('\n✅ Migration completed successfully!');
    
    // Test the sources table
    console.log('\nTesting sources table...');
    const { data: sources, error: testError } = await supabase
      .from('sources')
      .select('*')
      .limit(5);
    
    if (testError) {
      console.error('Error testing sources table:', testError);
    } else {
      console.log(`✓ Sources table working. Found ${sources.length} sources.`);
      if (sources.length > 0) {
        console.log('Sample sources:', sources.map(s => s.name));
      }
    }
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Alternative method using direct SQL execution if rpc doesn't work
async function runMigrationDirect() {
  try {
    console.log('Running sources table migration (direct method)...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'ADD_SOURCES_TABLE.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Executing migration SQL...');
    
    // Try to execute the entire migration as one block
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
    
    if (error) {
      console.error('Migration error:', error);
      throw error;
    }
    
    console.log('✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    console.log('\nNote: You may need to run this migration manually in the Supabase SQL editor.');
    console.log('Copy the contents of ADD_SOURCES_TABLE.sql and paste it into the SQL editor.');
  }
}

// Run the migration
console.log('Starting sources table migration...');
console.log('Supabase URL:', supabaseUrl);

runMigration().catch(() => {
  console.log('\nTrying alternative migration method...');
  runMigrationDirect();
});
