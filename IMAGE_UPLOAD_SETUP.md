# Image Upload Setup for DiscFinder

This guide explains how to set up and use the image upload functionality in your DiscFinder app.

## Overview

The image upload feature allows users to upload up to 2 photos of found discs, which are stored in Supabase Storage and displayed in search results to help disc owners identify their discs.

## Setup Instructions

### 1. Run the Storage Setup SQL

In your Supabase dashboard, go to **SQL Editor** and run the contents of `SUPABASE_STORAGE_SETUP.sql`:

```sql
-- This will create the disc-images bucket and set up security policies
```

### 2. Verify Storage Bucket

1. Go to **Storage** in your Supabase dashboard
2. You should see a `disc-images` bucket
3. The bucket should be set to **Public** with a 50MB file size limit

### 3. Test the Functionality

1. Start your React app: `npm start`
2. Navigate to "Report Found Disc"
3. Fill out the form and try uploading 1-2 images
4. Submit the form
5. Go to "Search Lost Discs" to see the images displayed

## Features

### Image Upload Component

- **Drag & Drop**: Users can drag images directly onto the upload area
- **File Selection**: Click to open file browser
- **Preview**: Shows thumbnails of selected images before upload
- **Validation**: 
  - Maximum 2 images per disc
  - 10MB per image limit
  - Supports JPEG, PNG, WebP formats
- **Error Handling**: Clear error messages for invalid files

### Storage Organization

Images are stored with the following structure:
```
disc-images/
  ├── {user-id}/
  │   ├── {timestamp}-0.jpg
  │   ├── {timestamp}-1.png
  │   └── ...
```

### Security

- **Authentication Required**: Only authenticated users can upload images
- **User Isolation**: Users can only access their own uploaded images
- **Public Read**: Images are publicly readable for search results
- **Automatic Cleanup**: Orphaned images are cleaned up after 24 hours

## Technical Implementation

### Components

1. **ImageUpload.tsx**: Reusable image upload component
2. **ImageUpload.css**: Styling for the upload interface

### Services

1. **imageService.uploadImages()**: Handles multiple image uploads
2. **imageService.deleteImages()**: Cleans up images if needed
3. **imageService.validateImageFile()**: Client-side validation

### Database Integration

- Images URLs are stored in the `image_urls` column (TEXT[] array)
- The public view includes image URLs for search results
- Form submission handles both disc data and image uploads

## Usage in Forms

```tsx
import { ImageUpload } from './components/ImageUpload';

// In your component
const [selectedImages, setSelectedImages] = useState<File[]>([]);

// In your JSX
<ImageUpload
  onImagesChange={setSelectedImages}
  maxImages={2}
  maxSizePerImage={10}
  disabled={isSubmitting}
/>
```

## Troubleshooting

### Images Not Uploading
- Check Supabase storage bucket exists and is public
- Verify authentication is working
- Check browser console for errors

### Images Not Displaying
- Verify image URLs are saved in database
- Check if images are accessible via direct URL
- Ensure public read policy is enabled

### Storage Errors
- Check file size limits (50MB bucket, 10MB per file)
- Verify supported file formats (JPEG, PNG, WebP)
- Check user authentication status

## Future Enhancements

- Image compression before upload
- Image transformation (resize, optimize)
- Multiple image galleries
- Image deletion from UI
- Advanced image validation

## File Structure

```
src/
├── components/
│   ├── ImageUpload.tsx
│   └── ImageUpload.css
├── lib/
│   └── supabase.ts (imageService)
└── App.tsx (integration)

SQL Files:
├── SUPABASE_STORAGE_SETUP.sql
└── UPDATE_MODEL_TO_MOLD.sql (includes image_urls in view)
```
