import React, { useState, useEffect } from 'react';
import { discService, imageService, ReturnStatus, Source, supabaseService } from './lib/supabase';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ImageUpload } from './components/ImageUpload';
import { ReturnStatusManager } from './components/ReturnStatusManager';

import { RakerDiverDashboard } from './components/RakerDiverDashboard';
import { AdminBulkTurnins } from './components/AdminBulkTurnins';
import ProfileImportManager from './components/ProfileImportManager';
import ProfileManager from './components/ProfileManager';
import PhotoMigrationManager from './components/PhotoMigrationManager';
import SourceManager from './components/SourceManager';
import { sendFoundDiscNotification, validatePhoneForSMS } from './lib/smsService';


type Page = 'home' | 'report-found' | 'search-lost' | 'login' | 'admin' | 'rakerdiver' | 'admin-bulk-turnins' | 'profile-import' | 'profile' | 'photo-migration';

function AppContent() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const { user, userRole, signOut, loading } = useAuth();

  const handleNavigate = (page: string) => {
    setCurrentPage(page as Page);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <Home onNavigate={setCurrentPage} />;
      case 'report-found':
        return <ReportFound onNavigate={setCurrentPage} />;
      case 'search-lost':
        return <SearchLost onNavigate={setCurrentPage} />;
      case 'login':
        return <Login onNavigate={setCurrentPage} />;
      case 'admin':
        return <AdminDashboard onNavigate={setCurrentPage} />;
      case 'rakerdiver':
        return <RakerDiverDashboard onNavigate={handleNavigate} />;
      case 'admin-bulk-turnins':
        return <AdminBulkTurnins onNavigate={handleNavigate} />;
      case 'profile-import':
        return <ProfileImportManager />;
      case 'photo-migration':
        return <PhotoMigrationManager />;
      case 'profile':
        return user ? <ProfileManager userId={user.id} /> : <Login onNavigate={setCurrentPage} />;
      default:
        return <Home onNavigate={setCurrentPage} />;
    }
  };

  const handleSignOut = async () => {
    await signOut();
    setCurrentPage('home');
  };

  if (loading) {
    return (
      <div className="app">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p className="text-gray-600">Loading...</p>
          <p className="text-xs text-gray-500 mt-4">
            If this takes too long, check the browser console for errors
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <nav className="navbar">
        <div className="nav-container">
          <div className="logo" onClick={() => setCurrentPage('home')}>
            DZDiscFinder
          </div>
          <div className="nav-buttons">
            <button className="nav-button" onClick={() => setCurrentPage('report-found')}>
              Report Found
            </button>
            <button className="nav-button" onClick={() => setCurrentPage('search-lost')}>
              Search Found
            </button>

            {user ? (
              <div className="user-menu">
                <span className="user-info">
                  {user.email} ({userRole})
                </span>
                <button className="nav-button" onClick={() => setCurrentPage('profile')}>
                  Profile
                </button>
                {userRole === 'admin' && (
                  <>
                    <button className="nav-button" onClick={() => setCurrentPage('admin')}>
                      Admin
                    </button>
                    <button className="nav-button" onClick={() => setCurrentPage('profile-import')}>
                      Import
                    </button>
                    <button className="nav-button" onClick={() => setCurrentPage('photo-migration')}>
                      Photos
                    </button>
                  </>
                )}
                {userRole === 'rakerdiver' && (
                  <button className="nav-button" onClick={() => setCurrentPage('rakerdiver')}>
                    RakerDiver
                  </button>
                )}
                <button className="nav-button" onClick={handleSignOut}>
                  Sign Out
                </button>
              </div>
            ) : (
              <button className="nav-button primary" onClick={() => setCurrentPage('login')}>
                Sign In
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="main-container">
        {renderPage()}
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

interface PageProps {
  onNavigate: (page: Page) => void;
}

function AdminDashboard({ onNavigate }: PageProps) {
  const { userRole } = useAuth();
  const [showSourceManager, setShowSourceManager] = useState(false);

  // Redirect if not admin
  if (userRole !== 'admin') {
    return (
      <div className="form-container">
        <div className="form-header">
          <button className="back-button" onClick={() => onNavigate('home')}>
            ← Back to Home
          </button>
          <h1>Access Denied</h1>
          <p>You need admin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="form-container">
      <div className="form-header">
        <button className="back-button" onClick={() => onNavigate('home')}>
          ← Back to Home
        </button>
        <h1>Admin Dashboard</h1>
        <p>Administrative tools and management functions.</p>
      </div>

      {/* Admin Actions */}
      <div className="hero-buttons">
        <button
          className="hero-button primary"
          onClick={() => onNavigate('admin-bulk-turnins')}
        >
          Manage Bulk Turn-Ins
        </button>
        <button
          className="hero-button secondary"
          onClick={() => setShowSourceManager(true)}
        >
          Manage Sources
        </button>
      </div>





      {/* Source Manager Modal */}
      {showSourceManager && (
        <SourceManager onClose={() => setShowSourceManager(false)} />
      )}
    </div>
  );
}

function Home({ onNavigate }: PageProps) {
  return (
    <div>
      <div className="hero">
        <h1 className="text-4xl lg:text-6xl font-bold text-gray-900 mb-6">
          Lost Your Disc?
        </h1>
        <p>
          The DZDiscFinder helps disc golf players reunite with their lost discs, report found discs, or search for your lost discs in our database.
        </p>

        <div className="hero-buttons">
          <button className="hero-button secondary" onClick={() => onNavigate('search-lost')}>
            Search Found Discs
          </button>
          <button className="hero-button primary" onClick={() => onNavigate('report-found')}>
            Report Found Disc
          </button>
        </div>
      </div>

    </div>
  );
}

function ReportFound({ onNavigate }: PageProps) {
  const { user, isGuest } = useAuth();

  // Get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const [formData, setFormData] = useState({
    brand: '',
    mold: '',
    discType: '',
    color: '',
    weight: '',
    condition: '',
    plasticType: '',
    stampText: '',
    phoneNumber: '',
    nameOnDisc: '',
    sourceId: '',
    locationFound: 'Exact location unknown.',
    foundDate: getTodayDate(),
    description: '',
  });
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [sources, setSources] = useState<Source[]>([]);

  // Load active sources for the dropdown and user's default source
  useEffect(() => {
    const loadSourcesAndDefaults = async () => {
      try {
        const activeSources = await supabaseService.getActiveSources();
        setSources(activeSources);

        // If user is authenticated, load their default source
        if (user?.id) {
          const defaultSource = await supabaseService.getUserDefaultSource(user.id);
          if (defaultSource) {
            setFormData(prev => ({
              ...prev,
              sourceId: defaultSource.id
            }));
          }
        }
      } catch (error) {
        console.error('Error loading sources:', error);
      }
    };

    loadSourcesAndDefaults();
  }, [user?.id]);

  // Require authentication to report found discs
  if (isGuest) {
    return (
      <div className="page-container">
        <div className="page-header">
          <button className="back-button" onClick={() => onNavigate('home')}>
            ← Back to Home
          </button>
          <h1>Report a Found Disc</h1>
          <p>You must be signed in to report found discs.</p>
        </div>
        <div className="auth-required">
          <h2>Authentication Required</h2>
          <p>Please sign in or create an account to report found discs. This helps us maintain data quality and allows disc owners to contact you.</p>
          <button className="button primary" onClick={() => onNavigate('login')}>
            Sign In / Sign Up
          </button>
        </div>
      </div>
    );
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitMessage('');

    try {
      console.log('Form submission started');
      console.log('User:', user);
      console.log('Selected images:', selectedImages.length);

      // Check if user is authenticated for image upload
      if (selectedImages.length > 0 && !user) {
        setSubmitMessage('Error: You must be signed in to upload images');
        return;
      }

      // Test connection first
      const { connected } = await discService.testConnection();
      console.log('Supabase connection test:', connected);

      if (!connected) {
        setSubmitMessage('Demo Mode: Form data logged to console (Supabase not configured)');
        console.log('Form data:', formData, 'Images:', selectedImages.length);
        setTimeout(() => {
          onNavigate('home');
        }, 2000);
        return;
      }

      let imageUrls: string[] = [];

      // Upload images if any are selected
      if (selectedImages.length > 0) {
        console.log('Starting image upload for user:', user!.id);
        setSubmitMessage('Uploading images...');
        const { urls, error: imageError } = await imageService.uploadImages(selectedImages, user!.id);

        console.log('Image upload result:', { urls, error: imageError });

        if (imageError) {
          console.error('Image upload error:', imageError);
          setSubmitMessage(`Error uploading images: ${imageError.message || JSON.stringify(imageError)}`);
          return;
        }

        imageUrls = urls;
        console.log('Images uploaded successfully:', imageUrls);
      }

      // Prepare data for Supabase
      const discData = {
        finder_id: user!.id, // Use authenticated user's ID
        brand: formData.brand || 'not specified',
        mold: formData.mold || undefined,
        disc_type: formData.discType || undefined,
        color: formData.color || 'not specified',
        weight: formData.weight ? parseInt(formData.weight) : undefined,
        condition: formData.condition || undefined,
        plastic_type: formData.plasticType || undefined,
        stamp_text: formData.stampText || undefined,
        phone_number: formData.phoneNumber || undefined,
        name_on_disc: formData.nameOnDisc || undefined,
        source_id: formData.sourceId || undefined,
        location_found: formData.locationFound,
        found_date: formData.foundDate,
        description: formData.description || undefined,
        image_urls: imageUrls.length > 0 ? imageUrls : undefined,
      };

      setSubmitMessage('Saving disc information...');
      const { data, error } = await discService.createFoundDisc(discData);

      if (error) {
        // If disc creation failed but images were uploaded, clean up the images
        if (imageUrls.length > 0) {
          await imageService.deleteImages(imageUrls);
        }
        setSubmitMessage(`Error: ${(error as any)?.message || 'Unknown error occurred'}`);
      } else {
        setSubmitMessage('Found disc reported successfully!');
        console.log('Saved disc:', data);

        // Send SMS notification if phone number is valid and source has message template
        if (formData.phoneNumber && formData.sourceId) {
          try {
            // Validate phone number for SMS
            const phoneValidation = validatePhoneForSMS(formData.phoneNumber);

            if (phoneValidation.isValid && phoneValidation.normalizedPhone) {
              // Find the source to get the message template
              const selectedSource = sources.find(s => s.id === formData.sourceId);

              if (selectedSource?.msg1_found_just_entered) {
                console.log('Sending SMS notification to:', phoneValidation.normalizedPhone);
                setSubmitMessage('Found disc reported successfully! Sending text message...');

                // Send SMS notification
                const smsResult = await sendFoundDiscNotification(
                  phoneValidation.normalizedPhone,
                  selectedSource.msg1_found_just_entered,
                  data.id,
                  formData.sourceId
                );

                if (smsResult.success) {
                  console.log('SMS sent successfully:', smsResult.messageId);

                  // Log the SMS in contact attempts
                  try {
                    const contactAttempt = {
                      found_disc_id: data.id,
                      attempted_at: new Date().toISOString(),
                      contact_method: 'SMS',
                      message_content: selectedSource.msg1_found_just_entered,
                      attempted_by_profile_id: user!.id,
                      attempted_by_name: user!.email || 'System',
                      response_received: false,
                      notes: `Automatic SMS sent on disc entry. Message ID: ${smsResult.messageId}`
                    };

                    await supabaseService.addContactAttempt(contactAttempt);
                    console.log('SMS logged in contact attempts');
                  } catch (logError) {
                    console.error('Failed to log SMS in contact attempts:', logError);
                  }

                  setSubmitMessage('Found disc reported and owner notified by text!');
                } else {
                  console.error('SMS sending failed:', smsResult.error);
                  setSubmitMessage('Found disc reported successfully! (Text message failed to send)');
                }
              } else {
                console.log('No SMS template available for source:', selectedSource?.name);
              }
            } else {
              console.log('Phone number not valid for SMS:', phoneValidation.error);
            }
          } catch (smsError) {
            console.error('SMS notification error:', smsError);
            // Don't fail the whole operation if SMS fails
          }
        }

        setTimeout(() => {
          onNavigate('home');
        }, 2000);
      }
    } catch (error) {
      setSubmitMessage('Demo Mode: Form data logged to console (Supabase not configured)');
      console.log('Form data:', formData, 'Images:', selectedImages.length);
      setTimeout(() => {
        onNavigate('home');
      }, 2000);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="form-container">
      <div className="form-header">
        <button className="back-button" onClick={() => onNavigate('home')}>
          ← Back to Home
        </button>
        <h1>Report a Found Disc</h1>
        <p>Help reunite a disc with its owner by providing details about the disc you found.</p>
      </div>

      {!user && (
        <div className="auth-notice">
          <p>
            <strong>Sign in required:</strong> You need to be signed in to report found discs and upload images.
          </p>
          <button
            className="button primary"
            onClick={() => onNavigate('login')}
          >
            Sign In
          </button>
        </div>
      )}

      {submitMessage && (
        <div className={`status-message ${submitMessage.includes('Error') ? 'error' : 'success'}`}>
          {submitMessage}
        </div>
      )}

      <form className="disc-form" onSubmit={handleSubmit} style={{ opacity: !user ? 0.6 : 1 }}>
        <div className="form-section">
          <h3>Disc Information</h3>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="brand">Brand</label>
              <input
                type="text"
                id="brand"
                name="brand"
                value={formData.brand}
                onChange={handleInputChange}
                placeholder="e.g., Innova, Discraft, Dynamic Discs"
              />
            </div>
            <div className="form-group">
              <label htmlFor="mold">Mold *</label>
              <input
                type="text"
                id="mold"
                name="mold"
                value={formData.mold}
                onChange={handleInputChange}
                required
                placeholder="e.g., Destroyer, Buzzz, Judge"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="discType">Disc Type</label>
              <input
                type="text"
                id="discType"
                name="discType"
                value={formData.discType}
                onChange={handleInputChange}
                placeholder="e.g., Putter, Midrange, Fairway Driver, Distance Driver"
              />
            </div>
            <div className="form-group">
              <label htmlFor="color">Color</label>
              <input
                type="text"
                id="color"
                name="color"
                value={formData.color}
                onChange={handleInputChange}
                placeholder="e.g., Blue, Red, Orange"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="weight">Weight (grams)</label>
              <input
                type="number"
                id="weight"
                name="weight"
                value={formData.weight}
                onChange={handleInputChange}
                placeholder="e.g., 175"
                min="100"
                max="200"
              />
            </div>
            <div className="form-group">
              <label htmlFor="condition">Condition</label>
              <input
                type="text"
                id="condition"
                name="condition"
                value={formData.condition}
                onChange={handleInputChange}
                placeholder="e.g., New, Excellent, Good, Fair, Poor"
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3>Additional Details</h3>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="plasticType">Plastic Type</label>
              <input
                type="text"
                id="plasticType"
                name="plasticType"
                value={formData.plasticType}
                onChange={handleInputChange}
                placeholder="e.g., Champion, ESP, Lucid"
              />
            </div>
            <div className="form-group">
              <label htmlFor="stampText">Stamp/Text</label>
              <input
                type="text"
                id="stampText"
                name="stampText"
                value={formData.stampText}
                onChange={handleInputChange}
                placeholder="Any text or stamps on the disc"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="phoneNumber">Phone Number on Disc</label>
              <input
                type="tel"
                id="phoneNumber"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleInputChange}
                placeholder="Phone number written on disc"
              />
            </div>
            <div className="form-group">
              <label htmlFor="nameOnDisc">Name on Disc</label>
              <input
                type="text"
                id="nameOnDisc"
                name="nameOnDisc"
                value={formData.nameOnDisc}
                onChange={handleInputChange}
                placeholder="Name written on disc"
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3>Location & Date</h3>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="sourceId">Source *</label>
              <select
                id="sourceId"
                name="sourceId"
                value={formData.sourceId}
                onChange={handleInputChange}
                required
                className="form-select"
              >
                <option value="">Select where disc was found...</option>
                {sources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
              <small className="form-help">Choose the general location or event where the disc was found</small>
            </div>
            <div className="form-group">
              <label htmlFor="foundDate">Date Found *</label>
              <input
                type="date"
                id="foundDate"
                name="foundDate"
                value={formData.foundDate}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="locationFound">Specific Location *</label>
              <input
                type="text"
                id="locationFound"
                name="locationFound"
                value={formData.locationFound}
                onChange={handleInputChange}
                required
                placeholder="e.g., East Pond, Hole 7, Near the basket (or leave default)"
              />
              <small className="form-help">Provide specific details about where within the source location. Defaults to "Exact location unknown." if not changed.</small>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="description">Additional Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={4}
              placeholder="Any additional details about where or how you found the disc..."
            />
          </div>
        </div>

        <div className="form-section">
          <h3>Disc Images</h3>
          <p className="form-section-description">
            Adding photos helps disc owners identify their disc more easily. You can upload up to 2 images.
          </p>
          <ImageUpload
            onImagesChange={setSelectedImages}
            maxImages={2}
            maxSizePerImage={10}
            disabled={isSubmitting}
          />
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="button secondary"
            onClick={() => onNavigate('home')}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="button primary"
            disabled={isSubmitting || !user}
          >
            {isSubmitting ? 'Submitting...' : !user ? 'Sign In Required' : 'Report Found Disc'}
          </button>
        </div>
      </form>
    </div>
  );
}

function SearchLost({ onNavigate }: PageProps) {
  const { userRole } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [foundDiscs, setFoundDiscs] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleReturnStatusUpdate = (discId: string, newStatus: ReturnStatus) => {
    // Update the disc in the local state
    setFoundDiscs(prev => prev.map(disc =>
      disc.id === discId
        ? { ...disc, return_status: newStatus, returned_at: new Date().toISOString() }
        : disc
    ));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSearching(true);
    setHasSearched(true);

    try {
      const { data, error } = await discService.searchFoundDiscsWithQuery(searchQuery);

      if (error) {
        console.error('Search error:', error);
        setFoundDiscs([]);
      } else {
        console.log('Search results:', data);
        setFoundDiscs(data || []);
      }
    } catch (error) {
      console.error('Search failed:', error);
      setFoundDiscs([]);
    } finally {
      setIsSearching(false);
    }
  };

  const loadAllDiscs = async () => {
    setIsSearching(true);
    setHasSearched(true);

    try {
      const { data, error } = await discService.getFoundDiscs();

      if (error) {
        console.error('Load error:', error);
        setFoundDiscs([]);
      } else {
        console.log('Load all results:', data);
        setFoundDiscs(data || []);
      }
    } catch (error) {
      console.error('Load failed:', error);
      setFoundDiscs([]);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <button className="back-button" onClick={() => onNavigate('home')}>
          ← Back to Home
        </button>
        <h1>Search Found Discs</h1>
        <p>Search through reported found discs to see if someone has found your lost disc.</p>
      </div>

      <div className="search-container">
        <form className="search-form" onSubmit={handleSearch}>
          <div className="search-section">
            <h3>Search Found Discs</h3>
            <div className="form-group">
              <label htmlFor="search-query">Search</label>
              <input
                type="text"
                id="search-query"
                name="searchQuery"
                value={searchQuery}
                onChange={handleInputChange}
                placeholder="Search by brand, mold, color, rack ID, location, or any other details (e.g., 'Innova Blue Trespass', 'Hole 7', '417')"
                style={{ width: '100%', padding: '12px', fontSize: '16px' }}
              />
              <p style={{ fontSize: '14px', color: '#666', marginTop: '8px' }}>
                Enter multiple search terms separated by spaces. Each term will be searched across all disc fields.
              </p>
            </div>
          </div>

          <div className="search-actions">
            <button
              type="button"
              className="button secondary"
              onClick={loadAllDiscs}
              disabled={isSearching}
            >
              {isSearching ? 'Loading...' : 'Show All Found Discs'}
            </button>
            <button
              type="submit"
              className="button primary"
              disabled={isSearching}
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>

        {hasSearched && (
          <div className="search-results">
            <h3>
              {foundDiscs.length > 0
                ? `Found ${foundDiscs.length} disc${foundDiscs.length === 1 ? '' : 's'}`
                : 'No discs found matching your criteria'
              }
            </h3>

            {foundDiscs.length > 0 && (
              <div className="disc-grid">
                {foundDiscs.map((disc) => (
                  <div key={disc.id} className="disc-card">
                    <div className="disc-header">
                      <h4>{disc.brand} {disc.mold || 'Unknown Mold'}</h4>
                      <div className="disc-meta">
                        <span className="disc-type">{disc.disc_type || 'Unknown Type'}</span>
                        {disc.rack_id && <span className="rack-id">Rack #{disc.rack_id}</span>}
                      </div>
                    </div>

                    {/* Return Status - only show for admin or if not 'Found' */}
                    {(userRole === 'admin' || (disc.return_status && disc.return_status !== 'Found')) && (
                      <ReturnStatusManager
                        discId={disc.id}
                        currentStatus={disc.return_status || 'Found'}
                        onStatusUpdated={(newStatus) => handleReturnStatusUpdate(disc.id, newStatus)}
                        disabled={userRole !== 'admin'}
                      />
                    )}

                    {disc.image_urls && disc.image_urls.length > 0 && (
                      <div className="disc-images">
                        {disc.image_urls.slice(0, 2).map((imageUrl: string, index: number) => (
                          <img
                            key={index}
                            src={imageUrl}
                            alt={`${disc.brand} ${disc.mold || 'disc'} ${index + 1}`}
                            className="disc-image"
                            onError={(e) => {
                              // Hide broken images
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ))}
                      </div>
                    )}

                    <div className="disc-details">
                      <div className="detail-row">
                        <span className="label">Color:</span>
                        <span className="value">{disc.color}</span>
                      </div>

                      {disc.weight && (
                        <div className="detail-row">
                          <span className="label">Weight:</span>
                          <span className="value">{disc.weight}g</span>
                        </div>
                      )}

                      <div className="detail-row">
                        <span className="label">Condition:</span>
                        <span className="value">{disc.condition || 'Unknown'}</span>
                      </div>

                      {disc.source_name && (
                        <div className="detail-row">
                          <span className="label">Source:</span>
                          <span className="value">{disc.source_name}</span>
                        </div>
                      )}

                      <div className="detail-row">
                        <span className="label">Specific Location:</span>
                        <span className="value">{disc.location_found}</span>
                      </div>

                      <div className="detail-row">
                        <span className="label">Found on:</span>
                        <span className="value">{new Date(disc.found_date).toLocaleDateString()}</span>
                      </div>

                      {disc.phone_number && (
                        <div className="detail-row">
                          <span className="label">Phone on disc:</span>
                          <span className="value">{disc.phone_number}</span>
                        </div>
                      )}

                      {disc.name_on_disc && (
                        <div className="detail-row">
                          <span className="label">Name on disc:</span>
                          <span className="value">{disc.name_on_disc}</span>
                        </div>
                      )}

                      {disc.description && (
                        <div className="detail-row">
                          <span className="label">Description:</span>
                          <span className="value">{disc.description}</span>
                        </div>
                      )}
                    </div>

                    <div className="disc-actions">
                      <button className="button primary small">
                        Contact Finder
                      </button>
                      <button className="button secondary small">
                        Report as Mine
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Login({ onNavigate }: PageProps) {
  const { signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      if (isLogin) {
        const { error } = await signIn(formData.email, formData.password);
        if (error) {
          setMessage(error.message);
        } else {
          setMessage('Signed in successfully!');
          setTimeout(() => onNavigate('home'), 1000);
        }
      } else {
        if (formData.password !== formData.confirmPassword) {
          setMessage('Passwords do not match');
          setLoading(false);
          return;
        }
        if (formData.password.length < 6) {
          setMessage('Password must be at least 6 characters');
          setLoading(false);
          return;
        }

        const { error } = await signUp(formData.email, formData.password, formData.fullName);
        if (error) {
          setMessage(error.message);
        } else {
          setMessage('Account created! Please check your email to verify your account.');
        }
      }
    } catch (error) {
      setMessage('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <button className="back-button" onClick={() => onNavigate('home')}>
          ← Back to Home
        </button>
        <h1>{isLogin ? 'Sign In' : 'Create Account'}</h1>
        <p>{isLogin ? 'Sign in to your account' : 'Create an account to report and search for discs'}</p>
      </div>

      <div className="auth-container">
        <div className="auth-tabs">
          <button
            className={`auth-tab ${isLogin ? 'active' : ''}`}
            onClick={() => setIsLogin(true)}
          >
            Sign In
          </button>
          <button
            className={`auth-tab ${!isLogin ? 'active' : ''}`}
            onClick={() => setIsLogin(false)}
          >
            Sign Up
          </button>
        </div>

        {message && (
          <div className={`status-message ${message.includes('error') || message.includes('Error') ? 'error' : 'success'}`}>
            {message}
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="form-group">
              <label htmlFor="fullName">Full Name</label>
              <input
                type="text"
                id="fullName"
                name="fullName"
                value={formData.fullName}
                onChange={handleInputChange}
                required={!isLogin}
                placeholder="Your full name"
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              required
              placeholder="your@email.com"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              required
              placeholder={isLogin ? "Your password" : "At least 6 characters"}
            />
          </div>

          {!isLogin && (
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                required={!isLogin}
                placeholder="Confirm your password"
              />
            </div>
          )}

          <button
            type="submit"
            className="button primary full-width"
            disabled={loading}
          >
            {loading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;
