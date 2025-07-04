# Storage Setup via Supabase Dashboard (Recommended)

If you're getting permission errors with the SQL approach, use this dashboard method instead.

## Method 1: Dashboard Setup (Easiest)

### Step 1: Create Storage Bucket

1. Go to your Supabase Dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **"New bucket"**
4. Fill in the details:
   - **Name**: `disc-images`
   - **Public bucket**: ✅ **Enabled** (checked)
   - **File size limit**: `50 MB`
   - **Allowed MIME types**: `image/jpeg, image/jpg, image/png, image/webp`
5. Click **"Save"**

### Step 2: Set Up Storage Policies

1. Still in **Storage**, click on your `disc-images` bucket
2. Go to the **"Policies"** tab
3. Click **"New Policy"**

#### Policy 1: Upload Policy
- **Policy name**: `Users can upload disc images`
- **Allowed operation**: `INSERT`
- **Target roles**: `authenticated`
- **Policy definition**:
```sql
(bucket_id = 'disc-images'::text) AND (auth.role() = 'authenticated'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)
```

#### Policy 2: Read Policy
- **Policy name**: `Public read access`
- **Allowed operation**: `SELECT`
- **Target roles**: `public`
- **Policy definition**:
```sql
bucket_id = 'disc-images'::text
```

#### Policy 3: Update Policy
- **Policy name**: `Users can update own images`
- **Allowed operation**: `UPDATE`
- **Target roles**: `authenticated`
- **Policy definition**:
```sql
(bucket_id = 'disc-images'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])
```

#### Policy 4: Delete Policy
- **Policy name**: `Users can delete own images`
- **Allowed operation**: `DELETE`
- **Target roles**: `authenticated`
- **Policy definition**:
```sql
(bucket_id = 'disc-images'::text) AND ((auth.uid())::text = (storage.foldername(name))[1])
```

## Method 2: Simplified SQL (If Dashboard doesn't work)

If you prefer SQL, try this simplified version in the **SQL Editor**:

```sql
-- Create bucket (or create via dashboard)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'disc-images',
  'disc-images', 
  true,
  52428800,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;
```

Then create the policies one by one:

```sql
-- Policy 1: Upload
CREATE POLICY "Users can upload disc images" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'disc-images' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy 2: Read
CREATE POLICY "Public read access" ON storage.objects
FOR SELECT USING (bucket_id = 'disc-images');

-- Policy 3: Update
CREATE POLICY "Users can update own images" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'disc-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy 4: Delete
CREATE POLICY "Users can delete own images" ON storage.objects
FOR DELETE USING (
  bucket_id = 'disc-images' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

## Verification

After setup, verify everything works:

1. **Check bucket exists**: Go to Storage > disc-images bucket should be visible
2. **Check policies**: In the bucket's Policies tab, you should see 4 policies
3. **Test upload**: Try uploading an image through your app

## Troubleshooting

### If you get "Policy violation" errors:
- Make sure the bucket is set to **Public**
- Verify all 4 policies are created and enabled
- Check that users are properly authenticated

### If images don't upload:
- Check browser console for errors
- Verify the bucket name matches exactly: `disc-images`
- Ensure file types are allowed (JPEG, PNG, WebP)

### If images don't display:
- Verify the public read policy is enabled
- Check that image URLs are being saved to the database
- Test direct image URLs in browser

## Alternative: Manual Bucket Creation

If all else fails, you can create a simple public bucket:

1. Create bucket named `disc-images`
2. Set it to **Public**
3. Don't worry about policies initially - just test if upload works
4. Add policies later for security

The app should work with just a public bucket, though it won't have user-specific security.
