/**
 * Reusable Photo Migration System
 * 
 * This module provides functionality to download photos from external URLs
 * and upload them to Supabase Storage, with support for different folders
 * and table types (profiles, discs, etc.)
 */

import { supabase } from './supabase';

export interface PhotoMigrationConfig {
  tableName: string;           // e.g., 'profiles', 'found_discs'
  urlColumn: string;           // e.g., 'avatar_url', 'photo_url'
  idColumn: string;            // e.g., 'id', 'legacy_row_id'
  storageFolder: string;       // e.g., 'avatars', 'disc-photos'
  bucketName?: string;         // defaults to 'disc-images'
  maxFileSize?: number;        // defaults to 5MB
  allowedTypes?: string[];     // defaults to ['image/jpeg', 'image/png', 'image/webp']
}

export interface PhotoMigrationResult {
  success: boolean;
  processed: number;
  migrated: number;
  failed: number;
  skipped: number;
  errors: string[];
  details: {
    recordId: string;
    originalUrl: string;
    newUrl?: string;
    status: 'migrated' | 'failed' | 'skipped';
    error?: string;
  }[];
}

/**
 * Downloads an image from a URL and returns the blob
 */
async function downloadImage(url: string, maxSize: number = 5 * 1024 * 1024): Promise<{ blob: Blob; contentType: string }> {
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const contentLength = response.headers.get('content-length');
  
  if (contentLength && parseInt(contentLength) > maxSize) {
    throw new Error(`File too large: ${contentLength} bytes (max: ${maxSize})`);
  }
  
  const blob = await response.blob();
  
  if (blob.size > maxSize) {
    throw new Error(`File too large: ${blob.size} bytes (max: ${maxSize})`);
  }
  
  return { blob, contentType };
}

/**
 * Generates a unique filename for the uploaded image
 */
function generateFileName(recordId: string, originalUrl: string, contentType: string): string {
  const timestamp = Date.now();
  const extension = contentType.split('/')[1] || 'jpg';
  const urlHash = originalUrl.split('/').pop()?.substring(0, 8) || 'unknown';
  return `${recordId}-${timestamp}-${urlHash}.${extension}`;
}

/**
 * Uploads a blob to Supabase Storage
 */
async function uploadToStorage(
  blob: Blob,
  fileName: string,
  folder: string,
  bucket: string = 'disc-images'
): Promise<string> {
  const filePath = `${folder}/${fileName}`;
  
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, blob, {
      contentType: blob.type,
      upsert: false
    });
  
  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }
  
  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);
  
  return publicUrl;
}

/**
 * Updates the database record with the new photo URL
 */
async function updateRecord(
  tableName: string,
  idColumn: string,
  urlColumn: string,
  recordId: string,
  newUrl: string
): Promise<void> {
  const { error } = await supabase
    .from(tableName)
    .update({ [urlColumn]: newUrl })
    .eq(idColumn, recordId);
  
  if (error) {
    throw new Error(`Database update failed: ${error.message}`);
  }
}

/**
 * Migrates a single photo from external URL to Supabase Storage
 */
async function migrateSinglePhoto(
  record: Record<string, any>,
  config: PhotoMigrationConfig
): Promise<{ status: 'migrated' | 'failed' | 'skipped'; newUrl?: string; error?: string }> {
  const recordId = record[config.idColumn] as string;
  const originalUrl = record[config.urlColumn] as string;
  
  // Skip if no URL or already a Supabase URL
  if (!originalUrl || originalUrl.includes('supabase')) {
    return { status: 'skipped' };
  }
  
  try {
    // Download the image
    const { blob, contentType } = await downloadImage(
      originalUrl,
      config.maxFileSize || 5 * 1024 * 1024
    );
    
    // Check if content type is allowed
    const allowedTypes = config.allowedTypes || ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(contentType)) {
      return { 
        status: 'skipped',
        error: `Unsupported content type: ${contentType}`
      };
    }
    
    // Generate filename and upload
    const fileName = generateFileName(recordId, originalUrl, contentType);
    const newUrl = await uploadToStorage(
      blob,
      fileName,
      config.storageFolder,
      config.bucketName
    );
    
    // Update database record
    await updateRecord(
      config.tableName,
      config.idColumn,
      config.urlColumn,
      recordId,
      newUrl
    );
    
    return { status: 'migrated', newUrl };
    
  } catch (error) {
    return {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Migrates photos for all records in a table
 */
export async function migratePhotos(config: PhotoMigrationConfig): Promise<PhotoMigrationResult> {
  console.log(`🚀 Starting photo migration for ${config.tableName}...`);
  
  const result: PhotoMigrationResult = {
    success: true,
    processed: 0,
    migrated: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    details: []
  };
  
  try {
    // Fetch all records with photos
    const { data: records, error } = await supabase
      .from(config.tableName)
      .select(`${config.idColumn}, ${config.urlColumn}`)
      .not(config.urlColumn, 'is', null)
      .not(config.urlColumn, 'eq', '');

    if (error) {
      throw new Error(`Failed to fetch records: ${error.message}`);
    }

    if (!records || records.length === 0) {
      console.log('📭 No records with photos found');
      return result;
    }

    console.log(`📊 Found ${records.length} records with photos to process`);

    // Process each record
    for (const record of records) {
      const recordData = record as Record<string, any>;
      const recordId = recordData[config.idColumn] as string;
      const originalUrl = recordData[config.urlColumn] as string;
      
      console.log(`📸 Processing ${recordId}: ${originalUrl}`);

      const migrationResult = await migrateSinglePhoto(recordData, config);
      
      result.processed++;
      result.details.push({
        recordId,
        originalUrl,
        newUrl: migrationResult.newUrl,
        status: migrationResult.status,
        error: migrationResult.error
      });
      
      switch (migrationResult.status) {
        case 'migrated':
          result.migrated++;
          console.log(`✅ Migrated ${recordId}: ${migrationResult.newUrl}`);
          break;
        case 'failed':
          result.failed++;
          result.errors.push(`${recordId}: ${migrationResult.error}`);
          console.error(`❌ Failed ${recordId}: ${migrationResult.error}`);
          break;
        case 'skipped':
          result.skipped++;
          console.log(`⚠️  Skipped ${recordId}: ${migrationResult.error || 'No URL or already migrated'}`);
          break;
      }
      
      // Add a small delay to avoid overwhelming the servers
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (result.failed > 0) {
      result.success = false;
    }
    
    console.log('\n📈 Migration Summary:');
    console.log(`✅ Migrated: ${result.migrated}`);
    console.log(`⚠️  Skipped: ${result.skipped}`);
    console.log(`❌ Failed: ${result.failed}`);
    
    return result;
    
  } catch (error) {
    result.success = false;
    result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    console.error('💥 Migration failed:', error);
    return result;
  }
}

/**
 * Predefined configurations for common use cases
 */
export const MIGRATION_CONFIGS = {
  PROFILE_AVATARS: {
    tableName: 'imported_profiles_staging',
    urlColumn: 'avatar_url',
    idColumn: 'id',
    storageFolder: 'avatars',
    bucketName: 'disc-images',
    maxFileSize: 5 * 1024 * 1024, // 5MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  } as PhotoMigrationConfig,
  
  DISC_PHOTOS: {
    tableName: 'found_discs', // Will be updated when disc import is implemented
    urlColumn: 'photo_url',
    idColumn: 'legacy_row_id',
    storageFolder: 'disc-photos',
    bucketName: 'disc-images',
    maxFileSize: 10 * 1024 * 1024, // 10MB for disc photos
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp']
  } as PhotoMigrationConfig
};

/**
 * Convenience function to migrate profile avatars
 */
export async function migrateProfileAvatars(): Promise<PhotoMigrationResult> {
  return migratePhotos(MIGRATION_CONFIGS.PROFILE_AVATARS);
}

/**
 * Convenience function to migrate disc photos
 */
export async function migrateDiscPhotos(config?: Partial<PhotoMigrationConfig>): Promise<PhotoMigrationResult> {
  const finalConfig = { ...MIGRATION_CONFIGS.DISC_PHOTOS, ...config };
  return migratePhotos(finalConfig);
}
