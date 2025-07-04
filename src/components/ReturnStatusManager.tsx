import React, { useState } from 'react';
import { ReturnStatus, discService } from '../lib/supabase';
import './ReturnStatusManager.css';

interface ReturnStatusManagerProps {
  discId: string;
  currentStatus: ReturnStatus;
  onStatusUpdated: (newStatus: ReturnStatus) => void;
  disabled?: boolean;
}

export const ReturnStatusManager: React.FC<ReturnStatusManagerProps> = ({
  discId,
  currentStatus,
  onStatusUpdated,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<ReturnStatus>(currentStatus);
  const [notes, setNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState('');

  const statusOptions: ReturnStatus[] = [
    'Found',
    'Returned to Owner',
    'Donated',
    'Sold',
    'Trashed'
  ];

  const getStatusColor = (status: ReturnStatus): string => {
    switch (status) {
      case 'Found': return '#10b981'; // green
      case 'Returned to Owner': return '#3b82f6'; // blue
      case 'Donated': return '#8b5cf6'; // purple
      case 'Sold': return '#f59e0b'; // amber
      case 'Trashed': return '#ef4444'; // red
      default: return '#6b7280'; // gray
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    setError('');

    try {
      const { success, error: updateError } = await discService.updateReturnStatus(
        discId,
        selectedStatus,
        notes.trim() || undefined
      );

      if (!success) {
        setError((updateError as any)?.message || 'Failed to update status');
        return;
      }

      onStatusUpdated(selectedStatus);
      setIsOpen(false);
      setNotes('');
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancel = () => {
    setSelectedStatus(currentStatus);
    setNotes('');
    setError('');
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <div className="return-status-display">
        <span 
          className="status-badge"
          style={{ backgroundColor: getStatusColor(currentStatus) }}
        >
          {currentStatus}
        </span>
        {!disabled && (
          <button
            className="edit-status-btn"
            onClick={() => setIsOpen(true)}
            title="Update return status"
          >
            ✏️
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="return-status-manager">
      <form onSubmit={handleSubmit} className="status-form">
        <div className="form-header">
          <h4>Update Return Status</h4>
          <button
            type="button"
            className="close-btn"
            onClick={handleCancel}
          >
            ×
          </button>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="status-select">Return Status:</label>
          <select
            id="status-select"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as ReturnStatus)}
            disabled={isUpdating}
            required
          >
            {statusOptions.map(status => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="notes-input">Notes (optional):</label>
          <textarea
            id="notes-input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any notes about the return..."
            rows={3}
            disabled={isUpdating}
          />
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="btn-cancel"
            onClick={handleCancel}
            disabled={isUpdating}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-save"
            disabled={isUpdating}
          >
            {isUpdating ? 'Updating...' : 'Update Status'}
          </button>
        </div>
      </form>
    </div>
  );
};
