const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Your admin user ID - replace with your actual user ID
const ADMIN_USER_ID = '00000000-0000-0000-0000-000000000001'; // Demo user ID, update this

async function normalizePhoneNumber(phone) {
  if (!phone) return null;
  
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // If it's 10 digits, assume US number and add country code
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  
  // If it's 11 digits and starts with 1, format as US number
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  // If it's 7 digits, it's missing area code - return as is with note
  if (digits.length === 7) {
    return digits; // Keep as is, may need manual review
  }
  
  // For other lengths, return the digits
  return digits || null;
}

function cleanDescription(description, color) {
  if (!description || !color) return description;
  
  const colorLower = color.toLowerCase().trim();
  const descLower = description.toLowerCase();
  
  // Remove color from description if it appears
  const colorWords = colorLower.split(/\s+/);
  let cleanedDesc = description;
  
  for (const colorWord of colorWords) {
    if (colorWord.length > 2) { // Only remove meaningful color words
      const regex = new RegExp(`\\b${colorWord}\\b`, 'gi');
      cleanedDesc = cleanedDesc.replace(regex, '').trim();
    }
  }
  
  // Clean up extra spaces
  cleanedDesc = cleanedDesc.replace(/\s+/g, ' ').trim();
  
  return cleanedDesc || description; // Return original if cleaning resulted in empty string
}

async function getAdminUserId() {
  try {
    // Try to find the actual admin user
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, email, role')
      .eq('role', 'admin')
      .limit(1);
    
    if (error) {
      console.error('Error finding admin user:', error);
      return ADMIN_USER_ID; // Fallback to demo user
    }
    
    if (profiles && profiles.length > 0) {
      console.log(`Found admin user: ${profiles[0].email} (${profiles[0].id})`);
      return profiles[0].id;
    }
    
    console.log('No admin user found, using demo user ID');
    return ADMIN_USER_ID;
  } catch (error) {
    console.error('Error getting admin user:', error);
    return ADMIN_USER_ID;
  }
}

async function cleanupFoundDiscs() {
  console.log('🧹 Starting found discs cleanup...');
  
  try {
    // Get admin user ID
    const adminUserId = await getAdminUserId();
    console.log(`Using admin user ID: ${adminUserId}`);
    
    // Get all found discs that need cleanup
    const { data: foundDiscs, error: fetchError } = await supabase
      .from('found_discs')
      .select('id, finder_id, brand, condition, description, color, phone_number')
      .order('created_at', { ascending: true });
    
    if (fetchError) {
      console.error('Error fetching found discs:', fetchError);
      return;
    }
    
    console.log(`Found ${foundDiscs.length} discs to process`);
    
    let updatedCount = 0;
    let phoneUpdatedCount = 0;
    let descriptionUpdatedCount = 0;
    
    // Process in batches of 100
    const batchSize = 100;
    for (let i = 0; i < foundDiscs.length; i += batchSize) {
      const batch = foundDiscs.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(foundDiscs.length / batchSize)} (${batch.length} discs)`);
      
      for (const disc of batch) {
        const updates = {};
        let needsUpdate = false;
        
        // 1. Set finder_id to admin if null
        if (!disc.finder_id) {
          updates.finder_id = adminUserId;
          needsUpdate = true;
        }
        
        // 2. Set condition to 'good' if null or empty (valid enum values: new, excellent, good, fair, poor)
        if (!disc.condition || disc.condition.trim() === '') {
          updates.condition = 'good';
          needsUpdate = true;
        }
        
        // 3. Set brand to 'not specified' if null or empty
        if (!disc.brand || disc.brand.trim() === '') {
          updates.brand = 'not specified';
          needsUpdate = true;
        }
        
        // 4. Clean description by removing color information
        if (disc.description && disc.color) {
          const cleanedDescription = cleanDescription(disc.description, disc.color);
          if (cleanedDescription !== disc.description) {
            updates.description = cleanedDescription;
            needsUpdate = true;
            descriptionUpdatedCount++;
          }
        }
        
        // 5. Normalize phone number
        if (disc.phone_number) {
          const normalizedPhone = normalizePhoneNumber(disc.phone_number);
          if (normalizedPhone !== disc.phone_number) {
            updates.phone_number = normalizedPhone;
            needsUpdate = true;
            phoneUpdatedCount++;
          }
        }
        
        // Update the disc if needed
        if (needsUpdate) {
          const { error: updateError } = await supabase
            .from('found_discs')
            .update(updates)
            .eq('id', disc.id);
          
          if (updateError) {
            console.error(`Error updating disc ${disc.id}:`, updateError);
          } else {
            updatedCount++;
          }
        }
      }
      
      // Small delay between batches to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n✅ Cleanup completed!');
    console.log(`📊 Summary:`);
    console.log(`   - Total discs processed: ${foundDiscs.length}`);
    console.log(`   - Discs updated: ${updatedCount}`);
    console.log(`   - Phone numbers normalized: ${phoneUpdatedCount}`);
    console.log(`   - Descriptions cleaned: ${descriptionUpdatedCount}`);
    
    // Show some statistics
    await showCleanupStats();
    
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

async function showCleanupStats() {
  try {
    console.log('\n📈 Post-cleanup statistics:');
    
    // Count discs by brand
    const { data: brandStats } = await supabase
      .from('found_discs')
      .select('brand')
      .eq('brand', 'not specified');
    
    console.log(`   - Discs with brand "not specified": ${brandStats?.length || 0}`);
    
    // Count discs by condition
    const { data: conditionStats } = await supabase
      .from('found_discs')
      .select('condition')
      .eq('condition', 'good');

    console.log(`   - Discs with condition "good" (default): ${conditionStats?.length || 0}`);
    
    // Count discs with null finder_id
    const { data: nullFinderStats } = await supabase
      .from('found_discs')
      .select('id')
      .is('finder_id', null);
    
    console.log(`   - Discs with null finder_id: ${nullFinderStats?.length || 0}`);
    
    // Count phone numbers by format
    const { data: phoneStats } = await supabase
      .from('found_discs')
      .select('phone_number')
      .not('phone_number', 'is', null);
    
    const normalizedPhones = phoneStats?.filter(p => p.phone_number?.startsWith('+')) || [];
    const unnormalizedPhones = phoneStats?.filter(p => p.phone_number && !p.phone_number.startsWith('+')) || [];
    
    console.log(`   - Normalized phone numbers (+1...): ${normalizedPhones.length}`);
    console.log(`   - Unnormalized phone numbers: ${unnormalizedPhones.length}`);
    
  } catch (error) {
    console.error('Error getting cleanup stats:', error);
  }
}

// Add command line argument handling
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const showStats = args.includes('--stats');

if (showStats) {
  showCleanupStats();
} else if (isDryRun) {
  console.log('🔍 DRY RUN MODE - No changes will be made');
  // You could add dry run logic here
} else {
  cleanupFoundDiscs();
}

module.exports = { cleanupFoundDiscs, normalizePhoneNumber, cleanDescription };
