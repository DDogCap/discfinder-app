// Admin Role Manager
// Run this script to check and update admin roles

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // You'll need this for admin operations

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials. Make sure you have:');
  console.error('- REACT_APP_SUPABASE_URL in your .env file');
  console.error('- SUPABASE_SERVICE_ROLE_KEY in your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAllUsers() {
  console.log('📋 Checking all users and their roles...\n');
  
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, created_at, updated_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching profiles:', error);
    return;
  }

  console.log('Current users:');
  console.table(profiles);
  
  const adminUsers = profiles.filter(p => p.role === 'admin');
  console.log(`\n👑 Admin users: ${adminUsers.length}`);
  adminUsers.forEach(admin => {
    console.log(`  - ${admin.email} (${admin.full_name || 'No name'})`);
  });
}

async function makeUserAdmin(email) {
  console.log(`\n🔧 Making ${email} an admin...`);
  
  // First check if user exists
  const { data: existingUser, error: fetchError } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('email', email)
    .single();

  if (fetchError) {
    console.error(`❌ User ${email} not found:`, fetchError);
    return false;
  }

  console.log(`Found user: ${existingUser.full_name || 'No name'} (${existingUser.email})`);
  console.log(`Current role: ${existingUser.role || 'user'}`);

  if (existingUser.role === 'admin') {
    console.log('✅ User is already an admin!');
    return true;
  }

  // Update to admin
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ 
      role: 'admin',
      updated_at: new Date().toISOString()
    })
    .eq('email', email);

  if (updateError) {
    console.error('❌ Error updating user role:', updateError);
    return false;
  }

  console.log('✅ Successfully updated user to admin!');
  return true;
}

async function removeAdminRole(email) {
  console.log(`\n🔧 Removing admin role from ${email}...`);
  
  const { error } = await supabase
    .from('profiles')
    .update({ 
      role: 'user',
      updated_at: new Date().toISOString()
    })
    .eq('email', email);

  if (error) {
    console.error('❌ Error removing admin role:', error);
    return false;
  }

  console.log('✅ Successfully removed admin role!');
  return true;
}

async function main() {
  console.log('🚀 Admin Role Manager\n');
  
  // Check all users first
  await checkAllUsers();
  
  // Get command line arguments
  const args = process.argv.slice(2);
  const command = args[0];
  const email = args[1];

  if (command === 'make-admin' && email) {
    await makeUserAdmin(email);
    console.log('\n📋 Updated user list:');
    await checkAllUsers();
  } else if (command === 'remove-admin' && email) {
    await removeAdminRole(email);
    console.log('\n📋 Updated user list:');
    await checkAllUsers();
  } else if (command === 'list') {
    // Already showed the list above
  } else {
    console.log('\n📖 Usage:');
    console.log('  node admin-role-manager.js list                    # Show all users');
    console.log('  node admin-role-manager.js make-admin <email>      # Make user admin');
    console.log('  node admin-role-manager.js remove-admin <email>    # Remove admin role');
    console.log('\nExamples:');
    console.log('  node admin-role-manager.js make-admin john@example.com');
    console.log('  node admin-role-manager.js remove-admin john@example.com');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { checkAllUsers, makeUserAdmin, removeAdminRole };
