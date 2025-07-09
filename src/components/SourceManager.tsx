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
    legacy_row_id: '',
    msg1_found_just_entered: ''
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
      setNewSource({ name: '', description: '', is_active: true, sort_order: 0, legacy_row_id: '', msg1_found_just_entered: '' });
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
        sort_order: source.sort_order,
        msg1_found_just_entered: source.msg1_found_just_entered
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
                  <label htmlFor="new-message">SMS Message Template</label>
                  <textarea
                    id="new-message"
                    value={newSource.msg1_found_just_entered}
                    onChange={(e) => setNewSource({ ...newSource, msg1_found_just_entered: e.target.value })}
                    rows={3}
                    placeholder="Message sent when a disc is found at this location (e.g., 'Your disc has been found at Jones Park and is available for pickup at DZDiscs store.')"
                  />
                  <small style={{ color: '#666', fontSize: '0.875rem', marginTop: '4px', display: 'block' }}>
                    This message will be sent via SMS when someone reports finding a disc at this location.
                  </small>
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
            <h3>Sources ({sources.length})</h3>
            {sources.length === 0 ? (
              <div className="empty-state">
                <p>No sources found. Add your first source to get started.</p>
              </div>
            ) : (
              <div className="sources-table">
                <div className="sources-header">
                  <div className="source-col-name">Source Name</div>
                  <div className="source-col-status">Status</div>
                  <div className="source-col-order">Order</div>
                  <div className="source-col-message">SMS Message</div>
                  <div className="source-col-actions">Actions</div>
                </div>
                {sources.map((source) => (
                  <div key={source.id} className="source-row">
                    {editingSource?.id === source.id ? (
                      <div className="source-edit-form">
                        <EditSourceForm
                          source={editingSource}
                          onSave={handleUpdateSource}
                          onCancel={() => setEditingSource(null)}
                          onChange={setEditingSource}
                        />
                      </div>
                    ) : (
                      <>
                        <div className="source-col-name">
                          <div className="source-name">{source.name}</div>
                          {source.description && (
                            <div className="source-description">{source.description}</div>
                          )}
                        </div>
                        <div className="source-col-status">
                          <span className={`status-badge ${source.is_active ? 'active' : 'inactive'}`}>
                            {source.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div className="source-col-order">
                          <span className="order-number">{source.sort_order}</span>
                        </div>
                        <div className="source-col-message">
                          {source.msg1_found_just_entered ? (
                            <div className="message-preview">
                              <span className="message-text">
                                {source.msg1_found_just_entered.length > 50
                                  ? `${source.msg1_found_just_entered.substring(0, 50)}...`
                                  : source.msg1_found_just_entered
                                }
                              </span>
                              <span className="message-indicator">✓ SMS Configured</span>
                            </div>
                          ) : (
                            <span className="no-message">No SMS message</span>
                          )}
                        </div>
                        <div className="source-col-actions">
                          <button
                            onClick={() => setEditingSource(source)}
                            className="button secondary small"
                            title="Edit source"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleToggleActive(source)}
                            className={`button small ${source.is_active ? 'secondary' : 'primary'}`}
                            title={source.is_active ? 'Deactivate source' : 'Activate source'}
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
          placeholder="Optional description for this source"
        />
      </div>
      <div className="form-group">
        <label htmlFor={`edit-message-${source.id}`}>SMS Message Template</label>
        <textarea
          id={`edit-message-${source.id}`}
          value={source.msg1_found_just_entered || ''}
          onChange={(e) => onChange({ ...source, msg1_found_just_entered: e.target.value })}
          rows={3}
          placeholder="Message sent when a disc is found at this location (e.g., 'Your disc has been found at Jones Park and is available for pickup at DZDiscs store.')"
        />
        <small style={{ color: '#666', fontSize: '0.875rem', marginTop: '4px', display: 'block' }}>
          This message will be sent via SMS when someone reports finding a disc at this location.
        </small>
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
