-- Supabase Storage Setup for DiscFinder Images
-- Run this in your Supabase SQL Editor after setting up the main database schema

-- Step 1: Create storage bucket for disc images
-- Note: You can also create this through the Supabase Dashboard > Storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'disc-images',
  'disc-images',
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Step 2: Create storage policies
-- Note: RLS is already enabled on storage.objects by default in Supabase

-- Policy: Allow authenticated users to upload images to their own folder
CREATE POLICY "Users can upload disc images to own folder" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'disc-images'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Allow public read access to disc images
CREATE POLICY "Public read access for disc images" ON storage.objects
FOR SELECT USING (bucket_id = 'disc-images');

-- Policy: Allow users to update their own images
CREATE POLICY "Users can update own disc images" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'disc-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Allow users to delete their own images
CREATE POLICY "Users can delete own disc images" ON storage.objects
FOR DELETE USING (
  bucket_id = 'disc-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Step 3: Create helper function for image cleanup (optional)
-- This function can be called manually or via a scheduled job
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_disc_images()
RETURNS TABLE(deleted_count bigint) AS $$
DECLARE
  deleted_files bigint := 0;
BEGIN
  -- This is a simplified version that doesn't directly delete from storage.objects
  -- Instead, it returns information about orphaned images
  -- You would need to implement the actual cleanup via the Supabase client

  SELECT COUNT(*) INTO deleted_files
  FROM storage.objects so
  WHERE so.bucket_id = 'disc-images'
  AND so.created_at < NOW() - INTERVAL '24 hours'
  AND NOT EXISTS (
    SELECT 1 FROM found_discs fd
    WHERE fd.image_urls @> ARRAY[so.name]
  );

  RETURN QUERY SELECT deleted_files;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.cleanup_orphaned_disc_images() TO authenticated;
