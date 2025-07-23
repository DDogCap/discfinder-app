import React, { useState, useEffect } from 'react';
import { supabase, Profile, Source, supabaseService } from '../lib/supabase';
import AvatarUpload from './AvatarUpload';

interface ProfileManagerProps {
  userId: string;
  onProfileUpdate?: (profile: Profile) => void;
}

const ProfileManager: React.FC<ProfileManagerProps> = ({ userId, onProfileUpdate }) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    pdga_number: '',
    facebook_profile: '',
    instagram_handle: '',
    sms_number: '',
    phone_number: '',
    default_source_id: '',
  });

  useEffect(() => {
    loadProfile();
    loadSources();
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      console.log('ProfileManager: Loading profile for user:', userId);

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('ProfileManager: Error loading profile:', error);
        throw error;
      }

      console.log('ProfileManager: Profile loaded successfully:', data);
      setProfile(data);
      setFormData({
        full_name: data.full_name || '',
        phone: data.phone || '',
        pdga_number: data.pdga_number?.toString() || '',
        facebook_profile: data.facebook_profile || '',
        instagram_handle: data.instagram_handle || '',
        sms_number: data.sms_number || '',
        phone_number: data.phone_number || '',
        default_source_id: data.default_source_id || '',
      });
    } catch (err) {
      console.error('Error loading profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSources = async () => {
    try {
      setLoadingSources(true);
      const activeSources = await supabaseService.getActiveSources();
      setSources(activeSources);
    } catch (err) {
      console.error('Error loading sources:', err);
      // Don't set error state for sources loading failure, just log it
    } finally {
      setLoadingSources(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const updateData = {
        full_name: formData.full_name,
        phone: formData.phone,
        pdga_number: formData.pdga_number ? parseInt(formData.pdga_number) : null,
        facebook_profile: formData.facebook_profile,
        instagram_handle: formData.instagram_handle,
        sms_number: formData.sms_number,
        phone_number: formData.phone_number,
        default_source_id: formData.default_source_id || null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      setProfile(data);
      setSuccessMessage('Profile updated successfully!');
      onProfileUpdate?.(data);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpdate = (newAvatarUrl: string) => {
    if (profile) {
      const updatedProfile = { ...profile, avatar_url: newAvatarUrl };
      setProfile(updatedProfile);
      onProfileUpdate?.(updatedProfile);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center p-8">
        <p className="text-red-600">Failed to load profile</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Profile Settings</h2>

      {/* Avatar Section */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Profile Photo</h3>
        <AvatarUpload
          currentAvatarUrl={profile.avatar_url}
          userId={userId}
          onAvatarUpdate={handleAvatarUpdate}
        />
      </div>

      {/* Profile Form */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Profile Information</h3>
        
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
            <p className="text-green-600 text-sm">{successMessage}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                id="full_name"
                name="full_name"
                value={formData.full_name}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="pdga_number" className="block text-sm font-medium text-gray-700 mb-1">
                PDGA Number
              </label>
              <input
                type="number"
                id="pdga_number"
                name="pdga_number"
                value={formData.pdga_number}
                onChange={handleInputChange}
                placeholder="12345"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Contact Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="phone_number" className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                id="phone_number"
                name="phone_number"
                value={formData.phone_number}
                onChange={handleInputChange}
                placeholder="+1 (555) 123-4567"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="sms_number" className="block text-sm font-medium text-gray-700 mb-1">
                SMS Number
              </label>
              <input
                type="tel"
                id="sms_number"
                name="sms_number"
                value={formData.sms_number}
                onChange={handleInputChange}
                placeholder="+1 (555) 123-4567"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Legacy phone field (for backward compatibility) */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              Phone (Legacy)
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Social Media */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="facebook_profile" className="block text-sm font-medium text-gray-700 mb-1">
                Facebook Profile
              </label>
              <input
                type="text"
                id="facebook_profile"
                name="facebook_profile"
                value={formData.facebook_profile}
                onChange={handleInputChange}
                placeholder="facebook.com/username or username"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="instagram_handle" className="block text-sm font-medium text-gray-700 mb-1">
                Instagram Handle
              </label>
              <input
                type="text"
                id="instagram_handle"
                name="instagram_handle"
                value={formData.instagram_handle}
                onChange={handleInputChange}
                placeholder="username (without @)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Default Source */}
          <div>
            <label htmlFor="default_source_id" className="block text-sm font-medium text-gray-700 mb-1">
              Default Source for Found Discs
            </label>
            <select
              id="default_source_id"
              name="default_source_id"
              value={formData.default_source_id}
              onChange={handleInputChange}
              disabled={loadingSources}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No default source (choose each time)</option>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
            <p className="text-sm text-gray-500 mt-1">
              When you report found discs, this source will be automatically selected by default.
            </p>
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-2 px-4 rounded-md font-medium"
            >
              {isSaving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>

        {/* Profile Info */}
        {profile.legacy_row_id && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Import Information</h4>
            <p className="text-sm text-gray-500">
              Legacy ID: {profile.legacy_row_id}
            </p>
            <p className="text-sm text-gray-500">
              Role: {profile.role}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileManager;
