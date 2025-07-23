import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const MobileDebugInfo: React.FC = () => {
  const { user, userRole, loading, profile } = useAuth();

  // Only show on mobile or when explicitly enabled
  const isMobile = window.innerWidth <= 768;
  const showDebug = isMobile || localStorage.getItem('showDebug') === 'true';

  // Add global function to enable debug mode
  React.useEffect(() => {
    (window as any).enableMobileDebug = () => {
      localStorage.setItem('showDebug', 'true');
      window.location.reload();
    };
  }, []);

  if (!showDebug) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '10px',
      left: '10px',
      right: '10px',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      fontSize: '12px',
      zIndex: 9999,
      maxHeight: '200px',
      overflow: 'auto'
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>Debug Info:</div>
      <div>Loading: {loading ? 'Yes' : 'No'}</div>
      <div>User: {user ? user.email : 'None'}</div>
      <div>User ID: {user ? user.id : 'None'}</div>
      <div>Role: {userRole}</div>
      <div>Profile: {profile ? 'Loaded' : 'None'}</div>
      <div>Screen Width: {window.innerWidth}px</div>
      <div>User Agent: {navigator.userAgent.substring(0, 50)}...</div>
      <div>
        <button 
          onClick={() => localStorage.setItem('showDebug', 'false')}
          style={{
            backgroundColor: 'red',
            color: 'white',
            border: 'none',
            padding: '2px 6px',
            borderRadius: '3px',
            fontSize: '10px',
            marginTop: '5px'
          }}
        >
          Hide
        </button>
      </div>
    </div>
  );
};

export default MobileDebugInfo;
