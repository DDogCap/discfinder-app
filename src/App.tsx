import React, { useState, useEffect, useRef } from 'react';
import { discService, imageService, Source, supabaseService, DiscCondition, DiscType, supabase } from './lib/supabase';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ImageUpload } from './components/ImageUpload';


import { RakerDiverDashboard } from './components/RakerDiverDashboard';
import { AdminBulkTurnins } from './components/AdminBulkTurnins';
import ProfileImportManager from './components/ProfileImportManager';
import ProfileManager from './components/ProfileManager';
import PhotoMigrationManager from './components/PhotoMigrationManager';
import SourceManager from './components/SourceManager';
import { sendFoundDiscNotification, validatePhoneForSMS } from './lib/smsService';
import OptimizedImage from './components/OptimizedImage';
import ImageModal from './components/ImageModal';


type Page = 'home' | 'report-found' | 'login' | 'admin' | 'rakerdiver' | 'admin-bulk-turnins' | 'profile-import' | 'profile' | 'photo-migration' | 'disc-detail' | 'faq';

// FAQ Component
function FAQ() {
  const [faqs, setFaqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFAQs = async () => {
      setLoading(true);
      const { data, error } = await discService.getFAQs();
      if (data && !error) {
        setFaqs(data);
      } else {
        console.error('Error loading FAQs:', error);
      }
      setLoading(false);
    };

    loadFAQs();
  }, []);

  return (
    <div className="main-container">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">Frequently Asked Questions</h1>

        {loading ? (
          <div className="loading-message text-center py-8">Loading FAQs...</div>
        ) : faqs.length === 0 ? (
          <div className="no-results text-center py-8">No FAQs available at this time.</div>
        ) : (
          <div className="faq-list space-y-6">
            {faqs.map((faq) => (
              <div key={faq.id} className="faq-item bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">{faq.question}</h3>
                <div className="text-gray-700 whitespace-pre-wrap">{faq.answer}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AppContent() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [selectedDiscId, setSelectedDiscId] = useState<string | null>(null);
  const { user, userRole, signOut, loading } = useAuth();

  const handleNavigate = (page: string, discId?: string) => {
    setCurrentPage(page as Page);
    if (discId) {
      setSelectedDiscId(discId);
    }
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <Home onNavigate={handleNavigate} />;
      case 'report-found':
        return <ReportFound onNavigate={setCurrentPage} />;
      case 'disc-detail':
        return selectedDiscId ? <DiscDetail discId={selectedDiscId} onNavigate={handleNavigate} /> : <Home onNavigate={handleNavigate} />;
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
      case 'faq':
        return <FAQ />;
      default:
        return <Home onNavigate={handleNavigate} />;
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
      <nav className="navbar bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="nav-container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="logo text-xl font-bold text-blue-600 cursor-pointer py-2" onClick={() => setCurrentPage('home')}>
            DZDiscFinder
          </div>
          <div className="nav-buttons flex items-center space-x-2 flex-wrap">
            <button className="nav-button px-3 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors" onClick={() => setCurrentPage('report-found')}>
              Report Found Disc
            </button>
            <button className="nav-button px-3 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" onClick={() => setCurrentPage('faq')}>
              FAQ
            </button>
            {user ? (
              <div className="user-menu flex items-center space-x-2 flex-wrap">
                <span className="user-info text-xs text-gray-600 px-2 py-1 bg-gray-100 rounded hidden sm:inline">
                  {user.email} ({userRole})
                </span>
                <button className="nav-button px-3 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" onClick={() => setCurrentPage('profile')}>
                  Profile
                </button>
                {userRole === 'admin' && (
                  <>
                    <button className="nav-button px-3 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" onClick={() => setCurrentPage('admin')}>
                      Admin
                    </button>
                    <button className="nav-button px-3 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors hidden md:inline-block" onClick={() => setCurrentPage('profile-import')}>
                      Import
                    </button>
                    <button className="nav-button px-3 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors hidden md:inline-block" onClick={() => setCurrentPage('photo-migration')}>
                      Photos
                    </button>
                  </>
                )}
                {userRole === 'rakerdiver' && (
                  <button className="nav-button px-3 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" onClick={() => setCurrentPage('rakerdiver')}>
                    RakerDiver
                  </button>
                )}
                <button className="nav-button px-3 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors" onClick={handleSignOut}>
                  Sign Out
                </button>
              </div>
            ) : (
              <button className="nav-button primary px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors" onClick={() => setCurrentPage('login')}>
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

// FAQ Manager Component
function FAQManager({ onClose }: { onClose: () => void }) {
  const [faqs, setFaqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingFaq, setEditingFaq] = useState<any>(null);
  const [newFaq, setNewFaq] = useState({ question: '', answer: '' });

  useEffect(() => {
    loadFAQs();
  }, []);

  const loadFAQs = async () => {
    setLoading(true);
    const { data, error } = await discService.getFAQs();
    if (data && !error) {
      setFaqs(data);
    } else {
      console.error('Error loading FAQs:', error);
    }
    setLoading(false);
  };

  const handleSave = async (faq: any) => {
    try {
      if (faq.id) {
        // Update existing FAQ
        const { error } = await supabase
          .from('t_faq')
          .update({ question: faq.question, answer: faq.answer })
          .eq('id', faq.id);

        if (error) throw error;
      } else {
        // Create new FAQ
        const { error } = await supabase
          .from('t_faq')
          .insert({ question: faq.question, answer: faq.answer });

        if (error) throw error;
      }

      await loadFAQs();
      setEditingFaq(null);
      setNewFaq({ question: '', answer: '' });
    } catch (error) {
      console.error('Error saving FAQ:', error);
      alert('Error saving FAQ. Please try again.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this FAQ?')) return;

    try {
      const { error } = await supabase
        .from('t_faq')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadFAQs();
    } catch (error) {
      console.error('Error deleting FAQ:', error);
      alert('Error deleting FAQ. Please try again.');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Manage FAQs</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Add New FAQ Form */}
          <div className="faq-form">
            <h3>Add New FAQ</h3>
            <input
              type="text"
              placeholder="Question"
              value={newFaq.question}
              onChange={(e) => setNewFaq({ ...newFaq, question: e.target.value })}
              className="form-input"
            />
            <textarea
              placeholder="Answer"
              value={newFaq.answer}
              onChange={(e) => setNewFaq({ ...newFaq, answer: e.target.value })}
              className="form-textarea"
              rows={4}
            />
            <button
              onClick={() => handleSave(newFaq)}
              disabled={!newFaq.question.trim() || !newFaq.answer.trim()}
              className="button primary"
            >
              Add FAQ
            </button>
          </div>

          {/* Existing FAQs */}
          <div className="faq-list">
            <h3>Existing FAQs</h3>
            {loading ? (
              <div className="loading-message">Loading FAQs...</div>
            ) : faqs.length === 0 ? (
              <div className="no-results">No FAQs found.</div>
            ) : (
              faqs.map((faq) => (
                <div key={faq.id} className="faq-item">
                  {editingFaq?.id === faq.id ? (
                    <div className="faq-edit-form">
                      <input
                        type="text"
                        value={editingFaq.question}
                        onChange={(e) => setEditingFaq({ ...editingFaq, question: e.target.value })}
                        className="form-input"
                      />
                      <textarea
                        value={editingFaq.answer}
                        onChange={(e) => setEditingFaq({ ...editingFaq, answer: e.target.value })}
                        className="form-textarea"
                        rows={4}
                      />
                      <div className="faq-actions">
                        <button onClick={() => handleSave(editingFaq)} className="button primary">Save</button>
                        <button onClick={() => setEditingFaq(null)} className="button secondary">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h4>{faq.question}</h4>
                      <p className="faq-answer">{faq.answer}</p>
                      <div className="faq-actions">
                        <button onClick={() => setEditingFaq(faq)} className="button secondary">Edit</button>
                        <button onClick={() => handleDelete(faq.id)} className="button danger">Delete</button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminDashboard({ onNavigate }: PageProps) {
  const { userRole } = useAuth();
  const [showSourceManager, setShowSourceManager] = useState(false);
  const [showFAQManager, setShowFAQManager] = useState(false);

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
        <button
          className="hero-button secondary"
          onClick={() => setShowFAQManager(true)}
        >
          Manage FAQs
        </button>
      </div>





      {/* Source Manager Modal */}
      {showSourceManager && (
        <SourceManager onClose={() => setShowSourceManager(false)} />
      )}

      {/* FAQ Manager Modal */}
      {showFAQManager && (
        <FAQManager onClose={() => setShowFAQManager(false)} />
      )}
    </div>
  );
}

interface DiscDetailProps {
  discId: string;
  onNavigate: (page: string) => void;
}

function DiscDetail({ discId, onNavigate }: DiscDetailProps) {
  const [disc, setDisc] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDisc = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await discService.getFoundDiscById(discId);
        if (result.error) {
          setError(typeof result.error === 'string' ? result.error : 'Failed to load disc');
          setDisc(null);
        } else {
          setDisc(result.data);
        }
      } catch (error) {
        console.error('Failed to load disc:', error);
        setError('Failed to load disc details');
        setDisc(null);
      } finally {
        setIsLoading(false);
      }
    };

    if (discId) {
      loadDisc();
    }
  }, [discId]);

  if (isLoading) {
    return (
      <div className="main-container">
        <div className="loading-message">Loading disc details...</div>
      </div>
    );
  }

  if (error || !disc) {
    return (
      <div className="main-container">
        <div className="error-message">
          <p>{error || 'Disc not found'}</p>
          <button className="button secondary" onClick={() => onNavigate('home')}>
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="main-container">
      <div className="disc-detail-header">
        <button className="button secondary" onClick={() => onNavigate('home')}>
          ← Back to Search
        </button>
        <h1>
          {disc.rack_id && `#${disc.rack_id} `}
          {disc.brand && disc.brand.toLowerCase() !== 'not specified' ? `${disc.brand} ` : ''}
          {disc.mold || 'Unknown Mold'}
        </h1>
      </div>

      <div className="disc-detail-content">
        {/* Images */}
        {disc.image_urls && disc.image_urls.length > 0 && (
          <div className="disc-detail-images">
            {disc.image_urls.map((url: string, index: number) => (
              <img
                key={index}
                src={url}
                alt={`${disc.brand} ${disc.mold || 'disc'} ${index + 1}`}
                className="disc-detail-image"
                loading="lazy"
              />
            ))}
          </div>
        )}

        {/* Disc Information */}
        <div className="disc-detail-info">
          <h3>Disc Information</h3>
          <div className="detail-grid">
            {disc.name_on_disc && (
              <div className="detail-item">
                <span className="detail-label">Name on disc:</span>
                <span className="detail-value">{disc.name_on_disc}</span>
              </div>
            )}
            {disc.phone_number && (
              <div className="detail-item">
                <span className="detail-label">Phone on disc:</span>
                <span className="detail-value">{disc.phone_number}</span>
              </div>
            )}
            {disc.color && (
              <div className="detail-item">
                <span className="detail-label">Color:</span>
                <span className="detail-value">{disc.color}</span>
              </div>
            )}
            {disc.weight && (
              <div className="detail-item">
                <span className="detail-label">Weight:</span>
                <span className="detail-value">{disc.weight}g</span>
              </div>
            )}
            {disc.condition && disc.condition.toLowerCase() !== 'unknown' && disc.condition.toLowerCase() !== 'not specified' && (
              <div className="detail-item">
                <span className="detail-label">Condition:</span>
                <span className="detail-value">{disc.condition}</span>
              </div>
            )}
            {disc.plastic_type && (
              <div className="detail-item">
                <span className="detail-label">Plastic:</span>
                <span className="detail-value">{disc.plastic_type}</span>
              </div>
            )}
            {disc.stamp_text && (
              <div className="detail-item">
                <span className="detail-label">Stamp:</span>
                <span className="detail-value">{disc.stamp_text}</span>
              </div>
            )}
            {disc.source_name && (
              <div className="detail-item">
                <span className="detail-label">Source:</span>
                <span className="detail-value">{disc.source_name}</span>
              </div>
            )}
            {disc.location_found && disc.location_found.toLowerCase() !== 'exact location unknown.' && disc.location_found.toLowerCase() !== 'unknown' && (
              <div className="detail-item">
                <span className="detail-label">Specific Location:</span>
                <span className="detail-value">{disc.location_found}</span>
              </div>
            )}
            <div className="detail-item">
              <span className="detail-label">Found on:</span>
              <span className="detail-value">{new Date(disc.found_date).toLocaleDateString()}</span>
            </div>
            {disc.description && (
              <div className="detail-item full-width">
                <span className="detail-label">Description:</span>
                <span className="detail-value">{disc.description}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface HomeProps {
  onNavigate: (page: string, discId?: string) => void;
}

function Home({ onNavigate }: HomeProps) {
  const { userRole } = useAuth();
  const [recentDiscs, setRecentDiscs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const handleNavigateToDetail = (discId: string) => {
    onNavigate('disc-detail', discId);
  };

  // Search functionality state
  const [searchQuery, setSearchQuery] = useState('');
  const [foundDiscs, setFoundDiscs] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [resultsPerPage, setResultsPerPage] = useState(50);
  const [showAllResults, setShowAllResults] = useState(false);



  // Image modal state
  const [imageModal, setImageModal] = useState<{
    isOpen: boolean;
    imageUrl: string;
    alt: string;
    images: string[];
    currentIndex: number;
  }>({
    isOpen: false,
    imageUrl: '',
    alt: '',
    images: [],
    currentIndex: 0
  });

  // Debounce timer ref
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const loadRecentDiscs = async () => {
      setIsLoading(true);
      try {
        // Fetch 24 most recent found discs with status 'Found'
        const result = await discService.getFoundDiscs({
          limit: 24,
          offset: 0,
          fetchAll: false,
          sortBy: 'newest'
        });

        if (result.error) {
          console.error('Error loading recent discs:', result.error);
          setRecentDiscs([]);
        } else {
          setRecentDiscs(result.data || []);
        }
      } catch (error) {
        console.error('Failed to load recent discs:', error);
        setRecentDiscs([]);
      } finally {
        setIsLoading(false);
      }
    };

    // Only load recent discs if no search is active
    if (!hasSearched) {
      loadRecentDiscs();
    }
  }, [hasSearched]);

  const handleReturnStatusUpdate = async (discId: string, newStatus: string) => {
    try {
      // Update the database first
      const { success, error } = await discService.updateReturnStatus(discId, newStatus as any);

      if (!success) {
        console.error('Failed to update return status:', error);
        return;
      }

      // Update both recent discs and search results
      setRecentDiscs(prevDiscs =>
        prevDiscs.map(disc =>
          disc.id === discId
            ? { ...disc, return_status: newStatus }
            : disc
        ).filter(disc => disc.return_status === 'Found') // Remove discs that are no longer 'Found'
      );

      setFoundDiscs(prevDiscs =>
        prevDiscs.map(disc =>
          disc.id === discId
            ? { ...disc, return_status: newStatus, returned_at: new Date().toISOString() }
            : disc
        )
      );
    } catch (error) {
      console.error('Error updating return status:', error);
    }
  };

  // Image modal functions
  const closeImageModal = () => {
    setImageModal(prev => ({ ...prev, isOpen: false }));
  };

  const navigateImage = (direction: 'prev' | 'next') => {
    setImageModal(prev => {
      const newIndex = direction === 'prev'
        ? Math.max(0, prev.currentIndex - 1)
        : Math.min(prev.images.length - 1, prev.currentIndex + 1);

      return {
        ...prev,
        currentIndex: newIndex,
        imageUrl: prev.images[newIndex]
      };
    });
  };

  // Search functionality
  const performSearch = async (query: string, page: number = 1) => {
    setIsSearching(true);
    setHasSearched(true);
    setCurrentPage(page);

    try {
      const offset = (page - 1) * resultsPerPage;
      const options = showAllResults
        ? { fetchAll: true }
        : { limit: resultsPerPage, offset, fetchAll: false };

      const searchOptions = options;

      const result = await discService.searchFoundDiscsWithQuery(query, searchOptions);

      if (result.error) {
        console.error('Search error:', result.error);
        setFoundDiscs([]);
        setTotalCount(0);
        setHasMore(false);
      } else {
        console.log('Search results:', result.data);
        setFoundDiscs(result.data || []);

        if (showAllResults) {
          setTotalCount(result.data?.length || 0);
          setHasMore(false);
        } else {
          setTotalCount('count' in result ? result.count || 0 : 0);
          setHasMore('hasMore' in result ? result.hasMore || false : false);
        }
      }
    } catch (error) {
      console.error('Search failed:', error);
      setFoundDiscs([]);
      setTotalCount(0);
      setHasMore(false);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search function
  const debouncedSearch = (query: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (query.trim()) {
        performSearch(query.trim());
      } else {
        // Clear search results and show recent discs
        setFoundDiscs([]);
        setHasSearched(false);
        setTotalCount(0);
        setHasMore(false);
        setCurrentPage(1);
      }
    }, 400); // 400ms debounce delay
  };

  // Handle search input change
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    debouncedSearch(query);
  };

  // Clear search
  const clearSearch = () => {
    setSearchQuery('');
    setFoundDiscs([]);
    setHasSearched(false);
    setTotalCount(0);
    setHasMore(false);
    setCurrentPage(1);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  };

  // Pagination functions
  const handlePageChange = (newPage: number) => {
    if (searchQuery.trim()) {
      performSearch(searchQuery.trim(), newPage);
    }
  };

  const toggleShowAllResults = () => {
    setShowAllResults(!showAllResults);
    setCurrentPage(1);
    // Re-run the current search with new setting
    if (searchQuery.trim()) {
      performSearch(searchQuery.trim(), 1);
    }
  };

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <div>
      {/* Search Bar */}
      <div className="hero">
        <div className="hero-search">
          <div className="search-input-container">
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchInputChange}
              placeholder="Search by brand, mold, color, rack ID, location, or any other details (e.g., 'Innova Blue Trespass', 'Hole 7', '417', '#417')"
              className="hero-search-input"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="clear-search-button"
                type="button"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>



        </div>
      </div>

      {/* Conditional Content: Search Results or Recent Discs */}
      {hasSearched ? (
        /* Search Results Section */
        <div className="search-results">
          <div className="search-results-header">
            <h3>
              {isSearching ? (
                'Searching...'
              ) : foundDiscs.length > 0 ? (
                showAllResults
                  ? `Found ${foundDiscs.length} disc${foundDiscs.length === 1 ? '' : 's'} (showing all)`
                  : `Found ${foundDiscs.length} disc${foundDiscs.length === 1 ? '' : 's'} (page ${currentPage}${totalCount > 0 ? ` of ${Math.ceil(totalCount / resultsPerPage)}` : ''})`
              ) : (
                'No discs found matching your criteria'
              )}
            </h3>

            {foundDiscs.length > 0 && (
              <div className="search-options">
                <div className="pagination-options">
                  <label>
                    <input
                      type="checkbox"
                      checked={showAllResults}
                      onChange={toggleShowAllResults}
                      disabled={isSearching}
                    />
                    Show all results (may be slow for large datasets)
                  </label>

                  {!showAllResults && (
                    <select
                      value={resultsPerPage}
                      onChange={(e) => {
                        setResultsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                        if (searchQuery.trim()) {
                          performSearch(searchQuery.trim(), 1);
                        }
                      }}
                      disabled={isSearching}
                    >
                      <option value={25}>25 per page</option>
                      <option value={50}>50 per page</option>
                      <option value={100}>100 per page</option>
                    </select>
                  )}
                </div>

                {totalCount > 0 && !showAllResults && (
                  <div className="results-info">
                    Showing {((currentPage - 1) * resultsPerPage) + 1}-{Math.min(currentPage * resultsPerPage, totalCount)} of {totalCount} total results
                  </div>
                )}
              </div>
            )}
          </div>

          {foundDiscs.length > 0 && (
            <div className="disc-grid">
              {foundDiscs.map((disc) => (
                <div key={disc.id} className="disc-card">
                  <div className="disc-header">
                    <h4 onClick={() => handleNavigateToDetail(disc.id)}>
                      {disc.rack_id && `#${disc.rack_id} `}
                      {disc.brand && disc.brand.toLowerCase() !== 'not specified' ? `${disc.brand} ` : ''}
                      {disc.mold || 'Unknown Mold'}
                    </h4>
                  </div>

                  <div className="disc-subheader">
                    {disc.name_on_disc || ''}
                  </div>

                  {disc.image_urls && disc.image_urls.length > 0 && (
                    <div className="disc-images" style={{ position: 'relative' }}>
                      <OptimizedImage
                        src={disc.image_urls[0]}
                        alt={`${disc.brand} ${disc.mold || 'disc'}`}
                        className="disc-image"
                        thumbnail={true}
                        onClick={() => handleNavigateToDetail(disc.id)}
                      />
                      {/* 3-dot menu for return status - admin only */}
                      {userRole === 'admin' && (
                        <div className="image-menu">
                          <button className="image-menu-button">⋯</button>
                          <div className="image-menu-dropdown">
                            <div className="image-menu-item" onClick={() => handleReturnStatusUpdate(disc.id, 'Returned to Owner')}>
                              Return to Owner
                            </div>
                            <div className="image-menu-item" onClick={() => handleReturnStatusUpdate(disc.id, 'Found')}>
                              Mark as Found
                            </div>
                            <div className="image-menu-item" onClick={() => handleReturnStatusUpdate(disc.id, 'Donated')}>
                              Donated
                            </div>
                            <div className="image-menu-item" onClick={() => handleReturnStatusUpdate(disc.id, 'Sold')}>
                              Sold
                            </div>
                            <div className="image-menu-item" onClick={() => handleReturnStatusUpdate(disc.id, 'For Sale Used')}>
                              For Sale Used
                            </div>
                            <div className="image-menu-item" onClick={() => handleReturnStatusUpdate(disc.id, 'Trashed')}>
                              Trashed
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination Controls */}
          {foundDiscs.length > 0 && !showAllResults && totalCount > resultsPerPage && (
            <div className="pagination-controls">
              <button
                className="button secondary"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1 || isSearching}
              >
                ← Previous
              </button>

              <div className="page-numbers">
                {(() => {
                  const totalPages = Math.ceil(totalCount / resultsPerPage);
                  const pages = [];
                  const maxVisiblePages = 5;

                  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
                  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

                  // Adjust start if we're near the end
                  if (endPage - startPage + 1 < maxVisiblePages) {
                    startPage = Math.max(1, endPage - maxVisiblePages + 1);
                  }

                  // Add first page and ellipsis if needed
                  if (startPage > 1) {
                    pages.push(
                      <button
                        key={1}
                        className={`page-button ${1 === currentPage ? 'active' : ''}`}
                        onClick={() => handlePageChange(1)}
                        disabled={isSearching}
                      >
                        1
                      </button>
                    );
                    if (startPage > 2) {
                      pages.push(<span key="ellipsis1" className="page-ellipsis">...</span>);
                    }
                  }

                  // Add visible page numbers
                  for (let i = startPage; i <= endPage; i++) {
                    pages.push(
                      <button
                        key={i}
                        className={`page-button ${i === currentPage ? 'active' : ''}`}
                        onClick={() => handlePageChange(i)}
                        disabled={isSearching}
                      >
                        {i}
                      </button>
                    );
                  }

                  // Add last page and ellipsis if needed
                  if (endPage < totalPages) {
                    if (endPage < totalPages - 1) {
                      pages.push(<span key="ellipsis2" className="page-ellipsis">...</span>);
                    }
                    pages.push(
                      <button
                        key={totalPages}
                        className={`page-button ${totalPages === currentPage ? 'active' : ''}`}
                        onClick={() => handlePageChange(totalPages)}
                        disabled={isSearching}
                      >
                        {totalPages}
                      </button>
                    );
                  }

                  return pages;
                })()}
              </div>

              <button
                className="button secondary"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={!hasMore || isSearching}
              >
                Next →
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Recent Found Discs Section */
        <div className="recent-discs-section">

          {isLoading ? (
            <div className="loading-message">Loading recent discs...</div>
          ) : recentDiscs.length === 0 ? (
            <div className="no-results">No found discs available at this time.</div>
          ) : (
            <div className="disc-grid">
              {recentDiscs.map((disc) => (
                <div key={disc.id} className="disc-card">
                  <div className="disc-header">
                    <h4 onClick={() => handleNavigateToDetail(disc.id)}>
                      {disc.rack_id && `#${disc.rack_id} `}
                      {disc.brand && disc.brand.toLowerCase() !== 'not specified' ? `${disc.brand} ` : ''}
                      {disc.mold || 'Unknown Mold'}
                    </h4>
                  </div>

                  <div className="disc-subheader">
                    {disc.name_on_disc || ''}
                  </div>

                  {/* Images */}
                  {disc.image_urls && disc.image_urls.length > 0 && (
                    <div className="disc-images" style={{ position: 'relative' }}>
                      <img
                        src={disc.image_urls[0]}
                        alt={`${disc.brand} ${disc.mold || 'disc'}`}
                        className="disc-image"
                        loading="lazy"
                        onClick={() => handleNavigateToDetail(disc.id)}
                      />
                      {/* 3-dot menu for return status - admin only */}
                      {userRole === 'admin' && (
                        <div className="image-menu">
                          <button className="image-menu-button">⋯</button>
                          <div className="image-menu-dropdown">
                            <div className="image-menu-item" onClick={() => handleReturnStatusUpdate(disc.id, 'Returned to Owner')}>
                              Return to Owner
                            </div>
                            <div className="image-menu-item" onClick={() => handleReturnStatusUpdate(disc.id, 'Found')}>
                              Mark as Found
                            </div>
                            <div className="image-menu-item" onClick={() => handleReturnStatusUpdate(disc.id, 'Donated')}>
                              Donated
                            </div>
                            <div className="image-menu-item" onClick={() => handleReturnStatusUpdate(disc.id, 'Sold')}>
                              Sold
                            </div>
                            <div className="image-menu-item" onClick={() => handleReturnStatusUpdate(disc.id, 'For Sale Used')}>
                              For Sale Used
                            </div>
                            <div className="image-menu-item" onClick={() => handleReturnStatusUpdate(disc.id, 'Trashed')}>
                              Trashed
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Image Modal */}
      <ImageModal
        isOpen={imageModal.isOpen}
        onClose={closeImageModal}
        imageUrl={imageModal.imageUrl}
        alt={imageModal.alt}
        images={imageModal.images}
        currentIndex={imageModal.currentIndex}
        onNavigate={navigateImage}
      />
    </div>
  );
}

function ReportFound({ onNavigate }: PageProps) {
  const { user, isGuest, userRole } = useAuth();

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
  const [showAdditionalDetails, setShowAdditionalDetails] = useState(false);

  // Auto-focus the mold field when the page loads
  useEffect(() => {
    const moldField = document.getElementById('mold');
    if (moldField) {
      moldField.focus();
    }
  }, []);

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
      console.log('User role:', userRole);
      console.log('Selected images:', selectedImages.length);

      // Check if user is admin
      if (userRole !== 'admin') {
        setSubmitMessage('Error: Only administrators can report found discs. Please sign in as an admin.');
        return;
      }

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
        disc_type: (formData.discType as DiscType) || undefined,
        color: formData.color || 'not specified',
        weight: formData.weight ? parseInt(formData.weight) : undefined,
        condition: (formData.condition as DiscCondition) || undefined,
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
                  formData.sourceId,
                  data.rack_id
                );

                if (smsResult.success) {
                  console.log('SMS sent successfully:', smsResult.messageId);

                  // Log the SMS in contact attempts
                  try {
                    // Create the final message with rack_id for logging
                    let finalMessageForLog = selectedSource.msg1_found_just_entered;
                    if (data.rack_id) {
                      finalMessageForLog += ` #${data.rack_id}`;
                    }

                    const contactAttempt = {
                      found_disc_id: data.id,
                      attempted_at: new Date().toISOString(),
                      contact_method: 'SMS',
                      message_content: finalMessageForLog,
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
        {userRole !== 'admin' && (
          <div className="admin-notice" style={{
            backgroundColor: '#fff3cd',
            border: '1px solid #ffeaa7',
            borderRadius: '4px',
            padding: '12px',
            margin: '16px 0',
            color: '#856404'
          }}>
            <strong>⚠️ Admin Access Required:</strong> Only administrators can report found discs. Please sign in as an admin to access this feature.
          </div>
        )}
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
        {/* Critical Information Section */}
        <div className="form-section critical-section">
          <h3>Critical Information</h3>
          <p className="form-section-description">
            Start with these essential details to quickly report the found disc.
          </p>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="mold">Mold / Disc *</label>
              <input
                type="text"
                id="mold"
                name="mold"
                value={formData.mold}
                onChange={handleInputChange}
                required
                placeholder="e.g., Destroyer, Buzzz, Judge, or any disc name"
                autoFocus
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
          </div>
        </div>

        {/* Disc Images Section */}
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

        {/* SMS Preview */}
        {formData.phoneNumber &&
         formData.sourceId &&
         validatePhoneForSMS(formData.phoneNumber).isValid &&
         userRole === 'admin' && (
          <div className="sms-preview" style={{
            backgroundColor: '#f8f9fa',
            border: '1px solid #dee2e6',
            borderRadius: '8px',
            padding: '16px',
            margin: '16px 0',
            fontSize: '14px'
          }}>
            <div style={{
              fontWeight: 'bold',
              marginBottom: '8px',
              color: '#495057',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              📱 Text Message Preview
            </div>
            <div style={{
              backgroundColor: '#ffffff',
              border: '1px solid #e9ecef',
              borderRadius: '4px',
              padding: '12px',
              fontFamily: 'monospace',
              fontSize: '13px',
              lineHeight: '1.4',
              color: '#212529'
            }}>
              {(() => {
                const selectedSource = sources.find(s => s.id === formData.sourceId);
                if (!selectedSource?.msg1_found_just_entered) {
                  return <em style={{ color: '#6c757d' }}>No message template available for this source</em>;
                }

                // Show the message with a placeholder rack ID since we don't have the actual one yet
                const messageTemplate = selectedSource.msg1_found_just_entered.trim();
                const previewMessage = `${messageTemplate} #XXXX`;

                return previewMessage;
              })()}
            </div>
            <div style={{
              fontSize: '12px',
              color: '#6c757d',
              marginTop: '8px',
              fontStyle: 'italic'
            }}>
              * The actual rack number (#XXXX) will be assigned when the disc is saved
            </div>
          </div>
        )}

        {/* Quick Report Button */}
        <div className="form-actions quick-report">
          <button
            type="submit"
            className="button primary large"
            disabled={isSubmitting || userRole !== 'admin'}
          >
            {isSubmitting
              ? 'Submitting...'
              : userRole !== 'admin'
                ? 'Admin Access Required'
                : formData.phoneNumber && validatePhoneForSMS(formData.phoneNumber).isValid
                  ? 'Report Found Disc and Send Text Message'
                  : 'Report Found Disc'
            }
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={() => setShowAdditionalDetails(!showAdditionalDetails)}
            disabled={isSubmitting}
          >
            {showAdditionalDetails ? 'Hide Additional Details' : 'Add Additional Details'}
          </button>
        </div>

        {/* Additional Details Section - Collapsible */}
        {showAdditionalDetails && (
          <>
            <div className="form-section">
              <h3>Additional Disc Information</h3>
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
                  <label htmlFor="discType">Disc Type</label>
                  <select
                    id="discType"
                    name="discType"
                    value={formData.discType}
                    onChange={handleInputChange}
                    className="form-select"
                  >
                    <option value="">Select disc type...</option>
                    <option value="putter">Putter</option>
                    <option value="approach">Approach</option>
                    <option value="midrange">Midrange</option>
                    <option value="fairway_driver">Fairway Driver</option>
                    <option value="distance_driver">Distance Driver</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
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
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="condition">Condition</label>
                  <select
                    id="condition"
                    name="condition"
                    value={formData.condition}
                    onChange={handleInputChange}
                    className="form-select"
                  >
                    <option value="">Select condition...</option>
                    <option value="excellent">Excellent</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                  </select>
                </div>
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
              </div>

              <div className="form-row">
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
            </div>

            <div className="form-section">
              <h3>Location & Date Details</h3>
              <div className="form-row">
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
          </>
        )}





        {/* Final Form Actions - Only show when additional details are expanded */}
        {showAdditionalDetails && (
          <>
            {/* SMS Preview for expanded form */}
            {formData.phoneNumber &&
             formData.sourceId &&
             validatePhoneForSMS(formData.phoneNumber).isValid &&
             userRole === 'admin' && (
              <div className="sms-preview" style={{
                backgroundColor: '#f8f9fa',
                border: '1px solid #dee2e6',
                borderRadius: '8px',
                padding: '16px',
                margin: '16px 0',
                fontSize: '14px'
              }}>
                <div style={{
                  fontWeight: 'bold',
                  marginBottom: '8px',
                  color: '#495057',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  📱 Text Message Preview
                </div>
                <div style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e9ecef',
                  borderRadius: '4px',
                  padding: '12px',
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  lineHeight: '1.4',
                  color: '#212529'
                }}>
                  {(() => {
                    const selectedSource = sources.find(s => s.id === formData.sourceId);
                    if (!selectedSource?.msg1_found_just_entered) {
                      return <em style={{ color: '#6c757d' }}>No message template available for this source</em>;
                    }

                    // Show the message with a placeholder rack ID since we don't have the actual one yet
                    const messageTemplate = selectedSource.msg1_found_just_entered.trim();
                    const previewMessage = `${messageTemplate} #XXXX`;

                    return previewMessage;
                  })()}
                </div>
                <div style={{
                  fontSize: '12px',
                  color: '#6c757d',
                  marginTop: '8px',
                  fontStyle: 'italic'
                }}>
                  * The actual rack number (#XXXX) will be assigned when the disc is saved
                </div>
              </div>
            )}

            <div className="form-actions final-actions">
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
                disabled={isSubmitting || userRole !== 'admin'}
              >
                {isSubmitting
                  ? 'Submitting...'
                  : userRole !== 'admin'
                    ? 'Admin Access Required'
                    : formData.phoneNumber && validatePhoneForSMS(formData.phoneNumber).isValid
                      ? 'Report Found Disc and Send Text Message'
                      : 'Report Found Disc'
                }
              </button>
            </div>
          </>
        )}
      </form>
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
