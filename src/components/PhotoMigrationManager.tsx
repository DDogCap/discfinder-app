import React, { useState } from 'react';
import { migratePhotos, MIGRATION_CONFIGS, PhotoMigrationResult, PhotoMigrationConfig } from '../lib/photoMigration';

interface MigrationStatus {
  isRunning: boolean;
  type: string | null;
  result: PhotoMigrationResult | null;
}

const PhotoMigrationManager: React.FC = () => {
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus>({
    isRunning: false,
    type: null,
    result: null
  });

  const handleMigration = async (type: 'profiles' | 'discs', config: PhotoMigrationConfig) => {
    setMigrationStatus({
      isRunning: true,
      type,
      result: null
    });

    try {
      const result = await migratePhotos(config);
      setMigrationStatus({
        isRunning: false,
        type,
        result
      });
    } catch (error) {
      console.error('Migration failed:', error);
      setMigrationStatus({
        isRunning: false,
        type,
        result: {
          success: false,
          processed: 0,
          migrated: 0,
          failed: 1,
          skipped: 0,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
          details: []
        }
      });
    }
  };

  const handleProfileMigration = () => {
    handleMigration('profiles', MIGRATION_CONFIGS.PROFILE_AVATARS);
  };

  const handleDiscMigration = () => {
    handleMigration('discs', MIGRATION_CONFIGS.DISC_PHOTOS);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Photo Migration Manager</h1>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
        <h2 className="text-lg font-medium text-blue-900 mb-2">About Photo Migration</h2>
        <div className="text-blue-800 text-sm space-y-2">
          <p>This tool downloads photos from external URLs (like Google Photos, Dropbox, etc.) and uploads them to your Supabase Storage.</p>
          <p><strong>Benefits:</strong> Faster loading, better reliability, no broken links if external services change.</p>
          <p><strong>Process:</strong> Downloads → Validates → Uploads to Supabase → Updates database URLs</p>
        </div>
      </div>

      {/* Profile Avatar Migration */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Profile Avatar Migration</h2>
        <p className="text-gray-600 mb-4">
          Migrate profile photos from imported users to Supabase Storage. This will download photos from 
          external URLs (Google Photos, etc.) and store them in your own storage.
        </p>
        
        <div className="flex items-center space-x-4 mb-4">
          <div className="text-sm text-gray-500">
            <p><strong>Source:</strong> imported_profiles_staging.avatar_url</p>
            <p><strong>Destination:</strong> disc-images/avatars/</p>
            <p><strong>Max Size:</strong> 5MB per image</p>
          </div>
        </div>

        <button
          onClick={handleProfileMigration}
          disabled={migrationStatus.isRunning}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 py-2 rounded-md font-medium"
        >
          {migrationStatus.isRunning && migrationStatus.type === 'profiles' 
            ? 'Migrating Profile Photos...' 
            : 'Migrate Profile Photos'
          }
        </button>
      </div>

      {/* Disc Photo Migration */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Disc Photo Migration</h2>
        <p className="text-gray-600 mb-4">
          Migrate disc photos from imported disc records to Supabase Storage. This will be available 
          when you import disc data from your previous app.
        </p>
        
        <div className="flex items-center space-x-4 mb-4">
          <div className="text-sm text-gray-500">
            <p><strong>Source:</strong> found_discs.photo_url (when disc import is implemented)</p>
            <p><strong>Destination:</strong> disc-images/disc-photos/</p>
            <p><strong>Max Size:</strong> 10MB per image</p>
          </div>
        </div>

        <button
          onClick={handleDiscMigration}
          disabled={migrationStatus.isRunning}
          className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white px-4 py-2 rounded-md font-medium"
        >
          {migrationStatus.isRunning && migrationStatus.type === 'discs' 
            ? 'Migrating Disc Photos...' 
            : 'Migrate Disc Photos'
          }
        </button>
      </div>

      {/* Migration Results */}
      {migrationStatus.result && (
        <div className={`p-6 rounded-lg mb-6 ${
          migrationStatus.result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          <h3 className={`font-medium mb-4 ${
            migrationStatus.result.success ? 'text-green-800' : 'text-red-800'
          }`}>
            {migrationStatus.type === 'profiles' ? 'Profile Photo' : 'Disc Photo'} Migration {migrationStatus.result.success ? 'Completed' : 'Failed'}
          </h3>
          
          <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm ${
            migrationStatus.result.success ? 'text-green-700' : 'text-red-700'
          }`}>
            <div>
              <p className="font-medium">Processed</p>
              <p className="text-lg">{migrationStatus.result.processed}</p>
            </div>
            <div>
              <p className="font-medium">Migrated</p>
              <p className="text-lg">{migrationStatus.result.migrated}</p>
            </div>
            <div>
              <p className="font-medium">Skipped</p>
              <p className="text-lg">{migrationStatus.result.skipped}</p>
            </div>
            <div>
              <p className="font-medium">Failed</p>
              <p className="text-lg">{migrationStatus.result.failed}</p>
            </div>
          </div>

          {migrationStatus.result.errors.length > 0 && (
            <div className="mt-4">
              <p className="font-medium mb-2">Errors:</p>
              <div className="bg-white rounded border max-h-40 overflow-y-auto">
                <ul className="text-xs space-y-1 p-3">
                  {migrationStatus.result.errors.map((error, index) => (
                    <li key={index} className="text-red-600">
                      {index + 1}. {error}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {migrationStatus.result.details.length > 0 && (
            <div className="mt-4">
              <p className="font-medium mb-2">Details:</p>
              <div className="bg-white rounded border max-h-60 overflow-y-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left">Record ID</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Original URL</th>
                      <th className="px-3 py-2 text-left">New URL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {migrationStatus.result.details.map((detail, index) => (
                      <tr key={index}>
                        <td className="px-3 py-2 font-mono">{detail.recordId}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            detail.status === 'migrated' ? 'bg-green-100 text-green-800' :
                            detail.status === 'failed' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {detail.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 max-w-xs truncate" title={detail.originalUrl}>
                          {detail.originalUrl}
                        </td>
                        <td className="px-3 py-2 max-w-xs truncate" title={detail.newUrl}>
                          {detail.newUrl || detail.error || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Command Line Usage</h3>
        <div className="text-gray-700 text-sm space-y-2">
          <p>You can also run photo migrations from the command line:</p>
          <div className="bg-gray-800 text-green-400 p-3 rounded font-mono text-xs">
            <p># Migrate profile photos</p>
            <p>npm run migrate-photos</p>
            <p></p>
            <p># Migrate disc photos (when available)</p>
            <p>npm run migrate-disc-photos</p>
          </div>
          <p><strong>Note:</strong> Command line migration may be faster for large batches.</p>
        </div>
      </div>
    </div>
  );
};

export default PhotoMigrationManager;
