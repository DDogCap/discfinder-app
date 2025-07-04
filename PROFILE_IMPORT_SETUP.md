# Profile Import Setup Guide

This guide walks you through importing user profiles from your previous Glide app into the DiscFinder application.

## Overview

The profile import system allows you to:
- Import existing user profiles from your Glide app
- Preserve legacy data with mapping IDs
- Automatically link profiles when users sign up
- Support new profile fields (PDGA number, social media, etc.)
- Handle avatar/photo migration

## Prerequisites

1. **Database Migration**: Run the profile import migration
2. **Glide API Access**: Install and configure Glide tables package
3. **Environment Setup**: Configure Supabase credentials

## Step 1: Database Migration

Run the following SQL migration in your Supabase SQL Editor:

```sql
-- Copy and paste the contents of ADD_PROFILE_IMPORT_FIELDS.sql
```

This migration adds:
- New profile fields (pdga_number, facebook_profile, etc.)
- Legacy mapping support (legacy_row_id)
- Import functions and triggers
- Avatar URL support

## Step 2: Install Dependencies

Install the required packages for profile import:

```bash
npm install @glideapps/tables @supabase/supabase-js
```

## Step 3: Environment Configuration

Set up your environment variables:

```bash
# .env.local (for React app)
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key

# For the import script, also add:
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Step 4: Configure Glide API

Update the Glide configuration in `import-glide-profiles.js`:

```javascript
const GLIDE_CONFIG = {
  token: "your-glide-token",
  app: "your-app-id", 
  table: "your-table-id",
  columns: {
    // Your column mappings
  }
};
```

## Step 5: Run the Import

### Option A: Command Line Import (Recommended)

```bash
npm run import-profiles
```

### Option B: Web Interface Import

1. Sign in as an admin user
2. Navigate to the "Import" section
3. Use the Profile Import Manager interface
4. Run sample import or configure real Glide integration

## Import Process Details

### Data Mapping

The import process maps Glide fields to DiscFinder profile fields:

| Glide Field | DiscFinder Field | Notes |
|-------------|------------------|-------|
| name | full_name | User's display name |
| email | email | Primary identifier |
| role | role | Maps to user/admin/rakerdiver/guest |
| defaultSourceRowId | legacy_row_id | For mapping other imports |
| pdga | pdga_number | PDGA membership number |
| facebookProfile | facebook_profile | Facebook URL or username |
| phoneNumberForTextMessages | sms_number, phone_number | Contact info |
| photo | avatar_url | Profile photo URL |

### Role Mapping

- `"admin"` → `admin`
- `"rakerdiver"` → `rakerdiver` 
- `"user"` → `user`
- Empty/other → `guest`

### Profile Linking

When users sign up with email addresses that match imported profiles:
1. The system automatically links the auth account to the imported profile
2. Preserves all imported data (PDGA number, social media, etc.)
3. Updates the profile with the new auth user ID

## Post-Import Tasks

### 1. Verify Import Results

Check the import results in the admin dashboard:
- Review imported profile count
- Check for any failed imports
- Verify role assignments

### 2. Test Profile Linking

Have test users sign up with imported email addresses to verify:
- Profile data is preserved
- Role assignments work correctly
- Avatar URLs are accessible

### 3. Avatar Migration (Optional)

If you need to migrate avatars from external URLs to Supabase Storage:

```javascript
// Example avatar migration script
async function migrateAvatars() {
  const profiles = await getProfilesWithExternalAvatars();
  for (const profile of profiles) {
    await downloadAndUploadAvatar(profile);
  }
}
```

### 4. Clean Up Legacy Data

After successful import and testing:
- Remove test profiles if any
- Update admin email in trigger function
- Consider removing legacy_row_id if no longer needed

## Troubleshooting

### Common Issues

**Import function not found**
- Ensure `ADD_PROFILE_IMPORT_FIELDS.sql` migration was run successfully
- Check Supabase function permissions

**Glide API connection failed**
- Verify Glide token and app/table IDs
- Check @glideapps/tables package installation
- Ensure you have Business plan or above for Glide API access

**Profile linking not working**
- Check trigger function is active
- Verify email addresses match exactly
- Review RLS policies for profiles table

**Avatar URLs not loading**
- Check if external URLs are still accessible
- Consider migrating to Supabase Storage
- Update CORS settings if needed

### Debug Mode

Enable debug logging in the import script:

```javascript
// Add to import-glide-profiles.js
const DEBUG = true;
if (DEBUG) console.log('Debug info:', data);
```

## Security Considerations

1. **Service Role Key**: Keep your Supabase service role key secure
2. **Glide Token**: Protect your Glide API token
3. **Profile Data**: Review what data is being imported
4. **RLS Policies**: Ensure proper row-level security

## Next Steps

After successful profile import:

1. **Test User Flows**: Have users sign up and verify their profiles
2. **Update Documentation**: Document any custom fields or processes
3. **Monitor Usage**: Track profile linking success rates
4. **Plan Migration**: Consider migrating other data (discs, matches, etc.)

## Support

For issues with the import process:
1. Check the browser console for errors
2. Review Supabase logs
3. Verify all migration steps were completed
4. Test with a small subset of data first

---

**Note**: Always backup your database before running imports in production!
