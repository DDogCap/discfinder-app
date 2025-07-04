import { supabase } from './supabase';

// Interface for the Glide app admin data structure
interface GlideAdmin {
  name: string;
  email: string;
  photo?: string;
  role?: string;
  defaultSourceRowId?: string;
  created?: string;
  phoneNumberForTextMessages?: string;
  pdga?: number;
  facebookProfile?: string;
}

// Interface for our profile import data
interface ImportProfileData {
  email: string;
  full_name: string;
  role: 'guest' | 'user' | 'admin' | 'rakerdiver';
  legacy_row_id?: string;
  pdga_number?: number;
  facebook_profile?: string;
  instagram_handle?: string;
  sms_number?: string;
  phone_number?: string;
  avatar_url?: string;
}

/**
 * Maps a Glide admin record to our profile import format
 */
function mapGlideAdminToProfile(admin: GlideAdmin): ImportProfileData {
  // Map role - blank roles become 'guest'
  let role: 'guest' | 'user' | 'admin' | 'rakerdiver' = 'guest';
  if (admin.role) {
    const lowerRole = admin.role.toLowerCase();
    if (lowerRole === 'admin') {
      role = 'admin';
    } else if (lowerRole === 'rakerdiver') {
      role = 'rakerdiver';
    } else if (lowerRole === 'user') {
      role = 'user';
    }
    // If role doesn't match known values, defaults to 'guest'
  }

  return {
    email: admin.email,
    full_name: admin.name || '',
    role,
    legacy_row_id: admin.defaultSourceRowId,
    pdga_number: admin.pdga,
    facebook_profile: admin.facebookProfile,
    sms_number: admin.phoneNumberForTextMessages,
    phone_number: admin.phoneNumberForTextMessages, // Using same field for both
    avatar_url: admin.photo, // We'll handle photo migration separately
  };
}

/**
 * Imports a single profile using the database function
 */
async function importSingleProfile(profileData: ImportProfileData): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('import_legacy_profile', {
      p_email: profileData.email,
      p_full_name: profileData.full_name,
      p_role: profileData.role,
      p_legacy_row_id: profileData.legacy_row_id,
      p_pdga_number: profileData.pdga_number,
      p_facebook_profile: profileData.facebook_profile,
      p_instagram_handle: profileData.instagram_handle,
      p_sms_number: profileData.sms_number,
      p_phone_number: profileData.phone_number,
      p_avatar_url: profileData.avatar_url,
    });

    if (error) {
      console.error('Error importing profile:', error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data };
  } catch (err) {
    console.error('Exception importing profile:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Imports multiple profiles from Glide admin data
 */
export async function importProfilesFromGlide(admins: GlideAdmin[]): Promise<{
  success: boolean;
  imported: number;
  failed: number;
  errors: string[];
}> {
  const results = {
    success: true,
    imported: 0,
    failed: 0,
    errors: [] as string[],
  };

  console.log(`Starting import of ${admins.length} profiles...`);

  for (const admin of admins) {
    try {
      // Skip records without email
      if (!admin.email) {
        results.failed++;
        results.errors.push('Skipped record without email');
        continue;
      }

      const profileData = mapGlideAdminToProfile(admin);
      const result = await importSingleProfile(profileData);

      if (result.success) {
        results.imported++;
        console.log(`✓ Imported profile for ${admin.email}`);
      } else {
        results.failed++;
        results.errors.push(`Failed to import ${admin.email}: ${result.error}`);
        console.error(`✗ Failed to import ${admin.email}:`, result.error);
      }
    } catch (err) {
      results.failed++;
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      results.errors.push(`Exception importing ${admin.email}: ${errorMsg}`);
      console.error(`✗ Exception importing ${admin.email}:`, err);
    }
  }

  if (results.failed > 0) {
    results.success = false;
  }

  console.log(`Import complete: ${results.imported} imported, ${results.failed} failed`);
  return results;
}

/**
 * Fetches profiles from Glide using the provided API code
 * Note: This requires the Glide API token and configuration
 */
export async function fetchProfilesFromGlide(): Promise<GlideAdmin[]> {
  // This is a placeholder - you'll need to implement the actual Glide API call
  // based on your provided code structure
  
  // Example implementation (you'll need to adapt this):
  /*
  import * as glide from "@glideapps/tables";

  const adminsTable = glide.table({
    token: "57a0c23e-1215-451b-aa43-c3ef6a4bfeed",
    app: "ruvULEC0fwdPVN39ErX6",
    table: "native-table-qQtBfW3I3zbQYJd4b3oF",
    columns: {
      name: { type: "string", name: "Name" },
      email: { type: "email-address", name: "Email" },
      photo: { type: "image-uri", name: "Photo" },
      role: { type: "string", name: "Role" },
      defaultSourceRowId: { type: "string", name: "tGL3F" },
      created: { type: "date-time", name: "k655R" },
      phoneNumberForTextMessages: { type: "phone-number", name: "OhhU3" },
      pdga: { type: "number", name: "Dscqd" },
      facebookProfile: { type: "string", name: "n1NEI" }
    }
  });

  const admins = await adminsTable.get();
  return admins;
  */
  
  throw new Error('fetchProfilesFromGlide not implemented - please implement based on your Glide API setup');
}

/**
 * Gets imported profiles that haven't signed up yet
 */
export async function getImportedProfilesNeedingSignup() {
  const { data, error } = await supabase
    .from('imported_profiles')
    .select('*')
    .eq('needs_signup', true);

  if (error) {
    console.error('Error fetching imported profiles:', error);
    return { success: false, error: error.message, profiles: [] };
  }

  return { success: true, profiles: data || [] };
}

/**
 * Manual import function for testing with sample data
 */
export async function importSampleProfiles(): Promise<{
  success: boolean;
  imported: number;
  failed: number;
  errors: string[];
}> {
  const sampleAdmins: GlideAdmin[] = [
    {
      name: "John Doe",
      email: "john.doe@example.com",
      role: "user",
      pdga: 12345,
      facebookProfile: "john.doe.profile",
      phoneNumberForTextMessages: "+1234567890"
    },
    {
      name: "Jane Admin",
      email: "jane.admin@example.com", 
      role: "admin",
      pdga: 67890,
      phoneNumberForTextMessages: "+0987654321"
    },
    {
      name: "Bob Diver",
      email: "bob.diver@example.com",
      role: "rakerdiver",
      phoneNumberForTextMessages: "+1122334455"
    }
  ];

  return await importProfilesFromGlide(sampleAdmins);
}
