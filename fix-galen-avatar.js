/**
 * Fix Galen's Avatar Script
 * 
 * This script downloads Galen's original photo and updates his profile
 */

// Load environment variables
require('./load-env');

const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Galen's info
const GALEN_EMAIL = 'galen.adams@dropzonepaintball.com';
const GALEN_PHOTO_URL = 'https://lh3.googleusercontent.com/a/AEdFTp5imi73-PajhEvwrOnsk7Vh32IdwT2ooIwZc9Qf6A=s96-c';

async function downloadAndUploadAvatar() {
  try {
    console.log('🔍 Downloading Galen\'s avatar...');
    
    // Download the image
    const response = await fetch(GALEN_PHOTO_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    console.log(`📸 Downloaded image: ${blob.size} bytes, type: ${contentType}`);
    
    // Generate filename
    const timestamp = Date.now();
    const extension = contentType.split('/')[1] || 'jpg';
    const fileName = `galen-adams-${timestamp}.${extension}`;
    const filePath = `avatars/${fileName}`;
    
    // Upload to Supabase Storage
    console.log('📤 Uploading to Supabase Storage...');
    const { error: uploadError } = await supabase.storage
      .from('disc-images')
      .upload(filePath, blob, {
        contentType: blob.type,
        upsert: false
      });
    
    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }
    
    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('disc-images')
      .getPublicUrl(filePath);
    
    console.log(`✅ Uploaded to: ${publicUrl}`);
    
    // Update Galen's profile
    console.log('📝 Updating profile...');
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('email', GALEN_EMAIL);
    
    if (updateError) {
      throw new Error(`Profile update failed: ${updateError.message}`);
    }
    
    console.log('🎉 Successfully updated Galen\'s avatar!');
    return publicUrl;
    
  } catch (error) {
    console.error('❌ Failed to fix avatar:', error);
    throw error;
  }
}

async function main() {
  console.log('🔧 Fixing Galen\'s Avatar');
  console.log('========================\n');
  
  try {
    const avatarUrl = await downloadAndUploadAvatar();
    console.log(`\n✅ Avatar fixed! New URL: ${avatarUrl}`);
    console.log('\n📋 Next steps:');
    console.log('1. Refresh your profile page to see the avatar');
    console.log('2. The avatar should now display correctly');
  } catch (error) {
    console.error('\n💥 Failed to fix avatar:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { downloadAndUploadAvatar };
