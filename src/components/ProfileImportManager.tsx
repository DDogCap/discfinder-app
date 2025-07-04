import React, { useState } from 'react';
import { importSampleProfiles, getImportedProfilesNeedingSignup } from '../lib/profileImport';

interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: string[];
}

interface ImportedProfile {
  id: string;
  email: string;
  full_name?: string;
  role?: string;
  legacy_row_id?: string;
  pdga_number?: number;
  needs_signup: boolean;
}

const ProfileImportManager: React.FC = () => {
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importedProfiles, setImportedProfiles] = useState<ImportedProfile[]>([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);

  const handleImportSample = async () => {
    setIsImporting(true);
    setImportResult(null);
    
    try {
      const result = await importSampleProfiles();
      setImportResult(result);
      
      // Refresh the imported profiles list
      if (result.success) {
        await loadImportedProfiles();
      }
    } catch (error) {
      console.error('Import failed:', error);
      setImportResult({
        success: false,
        imported: 0,
        failed: 1,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      });
    } finally {
      setIsImporting(false);
    }
  };

  const loadImportedProfiles = async () => {
    setIsLoadingProfiles(true);
    try {
      const result = await getImportedProfilesNeedingSignup();
      if (result.success) {
        setImportedProfiles(result.profiles);
      } else {
        console.error('Failed to load imported profiles:', result.error);
      }
    } catch (error) {
      console.error('Error loading imported profiles:', error);
    } finally {
      setIsLoadingProfiles(false);
    }
  };

  React.useEffect(() => {
    loadImportedProfiles();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Profile Import Manager</h1>
      
      {/* Import Section */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Import Profiles</h2>
        <p className="text-gray-600 mb-4">
          Import user profiles from your previous Glide app. This will create profile records
          that can be linked when users sign up with matching email addresses.
        </p>
        
        <button
          onClick={handleImportSample}
          disabled={isImporting}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 py-2 rounded-md font-medium"
        >
          {isImporting ? 'Importing...' : 'Import Sample Profiles'}
        </button>
        
        {/* Import Results */}
        {importResult && (
          <div className={`mt-4 p-4 rounded-md ${
            importResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            <h3 className={`font-medium ${
              importResult.success ? 'text-green-800' : 'text-red-800'
            }`}>
              Import {importResult.success ? 'Completed' : 'Failed'}
            </h3>
            <div className={`mt-2 text-sm ${
              importResult.success ? 'text-green-700' : 'text-red-700'
            }`}>
              <p>Imported: {importResult.imported}</p>
              <p>Failed: {importResult.failed}</p>
              {importResult.errors.length > 0 && (
                <div className="mt-2">
                  <p className="font-medium">Errors:</p>
                  <ul className="list-disc list-inside">
                    {importResult.errors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Imported Profiles Section */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Imported Profiles</h2>
          <button
            onClick={loadImportedProfiles}
            disabled={isLoadingProfiles}
            className="bg-gray-600 hover:bg-gray-700 disabled:bg-gray-300 text-white px-3 py-1 rounded-md text-sm"
          >
            {isLoadingProfiles ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        
        <p className="text-gray-600 mb-4">
          These profiles have been imported but the users haven't signed up yet. 
          When they sign up with matching email addresses, their profiles will be automatically linked.
        </p>

        {importedProfiles.length === 0 ? (
          <p className="text-gray-500 italic">No imported profiles found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    PDGA #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {importedProfiles.map((profile) => (
                  <tr key={profile.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {profile.full_name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {profile.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        profile.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                        profile.role === 'rakerdiver' ? 'bg-blue-100 text-blue-800' :
                        profile.role === 'user' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {profile.role || 'guest'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {profile.pdga_number || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        profile.needs_signup ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {profile.needs_signup ? 'Needs Signup' : 'Linked'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-6">
        <h3 className="text-lg font-medium text-blue-900 mb-2">Next Steps</h3>
        <div className="text-blue-800 text-sm space-y-2">
          <p>1. <strong>Run the database migration:</strong> Execute the <code>ADD_PROFILE_IMPORT_FIELDS.sql</code> file in your Supabase SQL Editor.</p>
          <p>2. <strong>Import your data:</strong> Replace the sample import with your actual Glide API integration.</p>
          <p>3. <strong>Test the process:</strong> Have users sign up with imported email addresses to verify profile linking works.</p>
          <p>4. <strong>Handle avatars:</strong> Implement avatar migration from your previous app's photo URLs.</p>
        </div>
      </div>
    </div>
  );
};

export default ProfileImportManager;
