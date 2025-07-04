import React, { useState, useEffect } from 'react';
import { supabaseService, ContactAttempt } from '../lib/supabase';
import { formatDistanceToNow } from 'date-fns';

interface ContactAttemptsProps {
  discId: string;
  onContactAdded?: () => void;
}

export const ContactAttempts: React.FC<ContactAttemptsProps> = ({ discId, onContactAdded }) => {
  const [contactAttempts, setContactAttempts] = useState<ContactAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadContactAttempts();
  }, [discId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadContactAttempts = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await supabaseService.getContactAttempts(discId);
      if (result.success) {
        setContactAttempts(result.data || []);
      } else {
        setError('Failed to load contact attempts');
      }
    } catch (err) {
      setError('Failed to load contact attempts');
    } finally {
      setLoading(false);
    }
  };

  const handleContactAdded = () => {
    loadContactAttempts();
    setShowAddForm(false);
    onContactAdded?.();
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Contact History</h3>
        </div>
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 mt-2">Loading contact history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Contact History ({contactAttempts.length})
        </h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-blue-600 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-700 transition-colors"
        >
          {showAddForm ? 'Cancel' : 'Add Contact'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {showAddForm && (
        <AddContactAttemptForm
          discId={discId}
          onContactAdded={handleContactAdded}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {contactAttempts.length === 0 ? (
        <div className="text-center py-6 text-gray-500">
          <p>No contact attempts recorded yet.</p>
          <p className="text-sm mt-1">Click "Add Contact" to record communication with the disc owner.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {contactAttempts.map((attempt) => (
            <ContactAttemptCard key={attempt.id} attempt={attempt} />
          ))}
        </div>
      )}
    </div>
  );
};

interface ContactAttemptCardProps {
  attempt: ContactAttempt;
}

const ContactAttemptCard: React.FC<ContactAttemptCardProps> = ({ attempt }) => {
  const getMethodIcon = (method: string) => {
    switch (method.toLowerCase()) {
      case 'sms':
      case 'text':
        return '📱';
      case 'email':
        return '📧';
      case 'phone':
      case 'call':
        return '📞';
      case 'facebook':
        return '📘';
      case 'instagram':
        return '📷';
      default:
        return '💬';
    }
  };

  const getMethodColor = (method: string) => {
    switch (method.toLowerCase()) {
      case 'sms':
      case 'text':
        return 'bg-green-100 text-green-800';
      case 'email':
        return 'bg-blue-100 text-blue-800';
      case 'phone':
      case 'call':
        return 'bg-purple-100 text-purple-800';
      case 'facebook':
        return 'bg-indigo-100 text-indigo-800';
      case 'instagram':
        return 'bg-pink-100 text-pink-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center space-x-2">
          <span className="text-lg">{getMethodIcon(attempt.contact_method)}</span>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getMethodColor(attempt.contact_method)}`}>
            {attempt.contact_method}
          </span>
          {attempt.response_received && (
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              ✓ Response Received
            </span>
          )}
        </div>
        <div className="text-right text-sm text-gray-500">
          <div>{new Date(attempt.attempted_at).toLocaleDateString()}</div>
          <div>{formatDistanceToNow(new Date(attempt.attempted_at), { addSuffix: true })}</div>
        </div>
      </div>

      {attempt.attempted_by_name && (
        <div className="text-sm text-gray-600 mb-2">
          By: {attempt.attempted_by_name}
        </div>
      )}

      {attempt.message_content && (
        <div className="mb-2">
          <div className="text-sm font-medium text-gray-700 mb-1">Message:</div>
          <div className="text-sm text-gray-900 bg-white p-2 rounded border">
            {attempt.message_content}
          </div>
        </div>
      )}

      {attempt.response_content && (
        <div className="mb-2">
          <div className="text-sm font-medium text-gray-700 mb-1">Response:</div>
          <div className="text-sm text-gray-900 bg-green-50 p-2 rounded border border-green-200">
            {attempt.response_content}
          </div>
        </div>
      )}

      {attempt.notes && (
        <div>
          <div className="text-sm font-medium text-gray-700 mb-1">Notes:</div>
          <div className="text-sm text-gray-600 italic">
            {attempt.notes}
          </div>
        </div>
      )}
    </div>
  );
};

interface AddContactAttemptFormProps {
  discId: string;
  onContactAdded: () => void;
  onCancel: () => void;
}

const AddContactAttemptForm: React.FC<AddContactAttemptFormProps> = ({
  discId,
  onContactAdded,
  onCancel
}) => {
  const [formData, setFormData] = useState({
    contact_method: 'SMS',
    message_content: '',
    response_received: false,
    response_content: '',
    notes: '',
    attempted_at: new Date().toISOString().slice(0, 16) // Format for datetime-local input
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const contactAttempt = {
        found_disc_id: discId,
        attempted_at: new Date(formData.attempted_at).toISOString(),
        contact_method: formData.contact_method,
        message_content: formData.message_content,
        response_received: formData.response_received,
        response_content: formData.response_content || undefined,
        notes: formData.notes || undefined,
        attempted_by_profile_id: undefined, // Will be set by RLS if user is authenticated
        attempted_by_name: 'Admin' // Default for now
      };

      const result = await supabaseService.addContactAttempt(contactAttempt);
      
      if (result.success) {
        onContactAdded();
      } else {
        setError('Failed to add contact attempt');
      }
    } catch (err) {
      setError('Failed to add contact attempt');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <h4 className="text-lg font-medium text-gray-900 mb-4">Add Contact Attempt</h4>
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contact Method *
            </label>
            <select
              value={formData.contact_method}
              onChange={(e) => setFormData({ ...formData, contact_method: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="SMS">SMS/Text</option>
              <option value="Email">Email</option>
              <option value="Phone">Phone Call</option>
              <option value="Facebook">Facebook</option>
              <option value="Instagram">Instagram</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date & Time *
            </label>
            <input
              type="datetime-local"
              value={formData.attempted_at}
              onChange={(e) => setFormData({ ...formData, attempted_at: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Message Content
          </label>
          <textarea
            value={formData.message_content}
            onChange={(e) => setFormData({ ...formData, message_content: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="What message was sent to the disc owner?"
          />
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="response_received"
            checked={formData.response_received}
            onChange={(e) => setFormData({ ...formData, response_received: e.target.checked })}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="response_received" className="ml-2 block text-sm text-gray-700">
            Response received from disc owner
          </label>
        </div>

        {formData.response_received && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Response Content
            </label>
            <textarea
              value={formData.response_content}
              onChange={(e) => setFormData({ ...formData, response_content: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="What did the disc owner respond?"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Any additional notes about this contact attempt..."
          />
        </div>

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Adding...' : 'Add Contact Attempt'}
          </button>
        </div>
      </form>
    </div>
  );
};
