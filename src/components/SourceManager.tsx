import React, { useState, useEffect } from 'react';
import { supabaseService, Source } from '../lib/supabase';

interface SourceManagerProps {
  onClose: () => void;
}

const SourceManager: React.FC<SourceManagerProps> = ({ onClose }) => {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingSource, setEditingSource] = useState<Source | null>(null);
  const [newSource, setNewSource] = useState({
    name: '',
    description: '',
    is_active: true,
    sort_order: 0,
    legacy_row_id: ''
  });
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    loadSources();
  }, []);

  const loadSources = async () => {
    try {
      setLoading(true);
      const data = await supabaseService.getSources();
      setSources(data);
    } catch (err) {
      setError('Failed to load sources');
      console.error('Error loading sources:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSource = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await supabaseService.createSource(newSource);
      setNewSource({ name: '', description: '', is_active: true, sort_order: 0, legacy_row_id: '' });
      setShowAddForm(false);
      await loadSources();
    } catch (err) {
      setError('Failed to create source');
      console.error('Error creating source:', err);
    }
  };

  const handleUpdateSource = async (source: Source) => {
    try {
      await supabaseService.updateSource(source.id, {
        name: source.name,
        description: source.description,
        is_active: source.is_active,
        sort_order: source.sort_order
      });
      setEditingSource(null);
      await loadSources();
    } catch (err) {
      setError('Failed to update source');
      console.error('Error updating source:', err);
    }
  };

  const handleToggleActive = async (source: Source) => {
    try {
      await supabaseService.updateSource(source.id, {
        is_active: !source.is_active
      });
      await loadSources();
    } catch (err) {
      setError('Failed to update source status');
      console.error('Error updating source status:', err);
    }
  };

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <div className="text-center">Loading sources...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content large-modal">
        <div className="modal-header">
          <h3>Manage Sources</h3>
          <button
            onClick={onClose}
            className="close-button"
          >
            ×
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="status-message error">
              {error}
            </div>
          )}

          <div className="form-actions" style={{ justifyContent: 'flex-start', marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="button primary"
            >
              {showAddForm ? 'Cancel' : 'Add New Source'}
            </button>
          </div>

          {showAddForm && (
            <div className="form-section">
              <h3>Add New Source</h3>
              <form onSubmit={handleCreateSource} className="disc-form">
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="new-name">Name *</label>
                    <input
                      type="text"
                      id="new-name"
                      value={newSource.name}
                      onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                      required
                      placeholder="e.g., Jones Park, Emporia"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="new-sort">Sort Order</label>
                    <input
                      type="number"
                      id="new-sort"
                      value={newSource.sort_order}
                      onChange={(e) => setNewSource({ ...newSource, sort_order: parseInt(e.target.value) || 0 })}
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="new-legacy">Legacy Row ID</label>
                  <input
                    type="text"
                    id="new-legacy"
                    value={newSource.legacy_row_id}
                    onChange={(e) => setNewSource({ ...newSource, legacy_row_id: e.target.value })}
                    placeholder="Optional - for import mapping"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="new-description">Description</label>
                  <textarea
                    id="new-description"
                    value={newSource.description}
                    onChange={(e) => setNewSource({ ...newSource, description: e.target.value })}
                    rows={2}
                    placeholder="Optional description or additional context"
                  />
                </div>
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={newSource.is_active}
                      onChange={(e) => setNewSource({ ...newSource, is_active: e.target.checked })}
                    />
                    Active (visible in dropdown)
                  </label>
                </div>
                <div className="form-actions">
                  <button type="submit" className="button primary">
                    Create Source
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="button secondary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="form-section">
            <h3>Existing Sources</h3>
            {sources.length === 0 ? (
              <p className="coming-soon">No sources found.</p>
            ) : (
              <div className="turnin-grid">
                {sources.map((source) => (
                  <div
                    key={source.id}
                    className={`turnin-card ${source.is_active ? '' : 'opacity-75'}`}
                  >
                    {editingSource?.id === source.id ? (
                      <EditSourceForm
                        source={editingSource}
                        onSave={handleUpdateSource}
                        onCancel={() => setEditingSource(null)}
                        onChange={setEditingSource}
                      />
                    ) : (
                      <>
                        <div className="turnin-header">
                          <h4>{source.name}</h4>
                          <span className={`status-badge ${source.is_active ? 'verified' : 'pending'}`}>
                            {source.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div className="detail-row">
                          <span className="label">Sort Order:</span>
                          <span className="value">{source.sort_order}</span>
                        </div>
                        {source.legacy_row_id && (
                          <div className="detail-row">
                            <span className="label">Legacy ID:</span>
                            <span className="value" style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}>
                              {source.legacy_row_id.substring(0, 12)}...
                            </span>
                          </div>
                        )}
                        {source.description && (
                          <div className="detail-row">
                            <span className="label">Description:</span>
                            <span className="value">{source.description}</span>
                          </div>
                        )}
                        <div className="turnin-actions" style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                          <button
                            onClick={() => setEditingSource(source)}
                            className="button secondary small"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleToggleActive(source)}
                            className={`button small ${source.is_active ? 'secondary' : 'primary'}`}
                          >
                            {source.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface EditSourceFormProps {
  source: Source;
  onSave: (source: Source) => void;
  onCancel: () => void;
  onChange: (source: Source) => void;
}

const EditSourceForm: React.FC<EditSourceFormProps> = ({ source, onSave, onCancel, onChange }) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(source);
  };

  return (
    <form onSubmit={handleSubmit} className="disc-form" style={{ margin: 0 }}>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor={`edit-name-${source.id}`}>Name *</label>
          <input
            type="text"
            id={`edit-name-${source.id}`}
            value={source.name}
            onChange={(e) => onChange({ ...source, name: e.target.value })}
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor={`edit-sort-${source.id}`}>Sort Order</label>
          <input
            type="number"
            id={`edit-sort-${source.id}`}
            value={source.sort_order}
            onChange={(e) => onChange({ ...source, sort_order: parseInt(e.target.value) || 0 })}
          />
        </div>
      </div>
      <div className="form-group">
        <label htmlFor={`edit-legacy-${source.id}`}>Legacy Row ID</label>
        <input
          type="text"
          id={`edit-legacy-${source.id}`}
          value={source.legacy_row_id || ''}
          onChange={(e) => onChange({ ...source, legacy_row_id: e.target.value })}
          placeholder="Optional - for import mapping"
        />
      </div>
      <div className="form-group">
        <label htmlFor={`edit-description-${source.id}`}>Description</label>
        <textarea
          id={`edit-description-${source.id}`}
          value={source.description || ''}
          onChange={(e) => onChange({ ...source, description: e.target.value })}
          rows={2}
        />
      </div>
      <div className="form-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={source.is_active}
            onChange={(e) => onChange({ ...source, is_active: e.target.checked })}
          />
          Active (visible in dropdown)
        </label>
      </div>
      <div className="form-actions">
        <button type="submit" className="button primary">
          Save Changes
        </button>
        <button type="button" onClick={onCancel} className="button secondary">
          Cancel
        </button>
      </div>
    </form>
  );
};

export default SourceManager;
