import React, { useState, useRef } from 'react';
import { supabase } from '../lib/supabase';

interface AvatarUploadProps {
  currentAvatarUrl?: string;
  userId: string;
  onAvatarUpdate: (newAvatarUrl: string) => void;
  className?: string;
}

const AvatarUpload: React.FC<AvatarUploadProps> = ({
  currentAvatarUrl,
  userId,
  onAvatarUpdate,
  className = ''
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file');
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image must be smaller than 5MB');
      return;
    }

    await uploadAvatar(file);
  };

  const uploadAvatar = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);

    try {
      // Create a unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('disc-images') // Using existing bucket
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('disc-images')
        .getPublicUrl(filePath);

      // Update the user's profile with the new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);

      if (updateError) {
        throw updateError;
      }

      // Delete the old avatar if it exists and is in our storage
      if (currentAvatarUrl && currentAvatarUrl.includes('supabase')) {
        const oldPath = currentAvatarUrl.split('/').pop();
        if (oldPath) {
          await supabase.storage
            .from('disc-images')
            .remove([`avatars/${oldPath}`]);
        }
      }

      onAvatarUpdate(publicUrl);
    } catch (error) {
      console.error('Error uploading avatar:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to upload avatar');
    } finally {
      setIsUploading(false);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveAvatar = async () => {
    if (!currentAvatarUrl) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      // Update profile to remove avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', userId);

      if (updateError) {
        throw updateError;
      }

      // Delete from storage if it's in our storage
      if (currentAvatarUrl.includes('supabase')) {
        const fileName = currentAvatarUrl.split('/').pop();
        if (fileName) {
          await supabase.storage
            .from('disc-images')
            .remove([`avatars/${fileName}`]);
        }
      }

      onAvatarUpdate('');
    } catch (error) {
      console.error('Error removing avatar:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to remove avatar');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className={`flex flex-col items-center space-y-4 ${className}`}>
      {/* Avatar Display */}
      <div className="relative">
        <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
          {currentAvatarUrl ? (
            <img
              src={currentAvatarUrl}
              alt="Profile avatar"
              className="w-full h-full object-cover"
            />
          ) : (
            <svg
              className="w-12 h-12 text-gray-400"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>
        
        {/* Loading overlay */}
        {isUploading && (
          <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
          </div>
        )}
      </div>

      {/* Upload Controls */}
      <div className="flex space-x-2">
        <button
          onClick={handleButtonClick}
          disabled={isUploading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 py-2 rounded-md text-sm font-medium"
        >
          {isUploading ? 'Uploading...' : currentAvatarUrl ? 'Change Photo' : 'Upload Photo'}
        </button>
        
        {currentAvatarUrl && (
          <button
            onClick={handleRemoveAvatar}
            disabled={isUploading}
            className="bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            Remove
          </button>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Error message */}
      {uploadError && (
        <p className="text-red-600 text-sm text-center">{uploadError}</p>
      )}

      {/* Help text */}
      <p className="text-gray-500 text-xs text-center">
        JPG, PNG, or WebP. Max 5MB.
      </p>
    </div>
  );
};

export default AvatarUpload;
