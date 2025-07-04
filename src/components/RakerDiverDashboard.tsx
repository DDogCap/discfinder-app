import React, { useState, useEffect } from 'react';
import { discService, BulkTurnin, BulkTurninPayment } from '../lib/supabase';

interface RakerDiverDashboardProps {
  onNavigate: (page: string) => void;
}

interface TurninFormData {
  location_collected: string;
  collection_date: string;
  collection_time: string;
  disc_count: string;
  turnin_location: string;
  turnin_date: string;
  turnin_time: string;
  notes: string;
}

export function RakerDiverDashboard({ onNavigate }: RakerDiverDashboardProps) {
  const [turnins, setTurnins] = useState<BulkTurnin[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<TurninFormData>({
    location_collected: '',
    collection_date: '',
    collection_time: '',
    disc_count: '',
    turnin_location: '',
    turnin_date: '',
    turnin_time: '',
    notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTurnin, setSelectedTurnin] = useState<BulkTurnin | null>(null);
  const [payments, setPayments] = useState<BulkTurninPayment[]>([]);

  const loadTurnins = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await discService.getRakerdiverTurnins();
      if (error) {
        console.error('Error loading turn-ins:', error);
      } else {
        setTurnins(data || []);
      }
    } catch (error) {
      console.error('Error loading turn-ins:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPayments = async (turninId: string) => {
    try {
      const { data, error } = await discService.getBulkTurninPayments(turninId);
      if (error) {
        console.error('Error loading payments:', error);
      } else {
        setPayments(data || []);
      }
    } catch (error) {
      console.error('Error loading payments:', error);
    }
  };

  useEffect(() => {
    loadTurnins();
  }, []);

  useEffect(() => {
    if (selectedTurnin) {
      loadPayments(selectedTurnin.id);
    }
  }, [selectedTurnin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await discService.createBulkTurnin({
        location_collected: formData.location_collected,
        collection_date: formData.collection_date,
        collection_time: formData.collection_time || undefined,
        disc_count: parseInt(formData.disc_count),
        turnin_location: formData.turnin_location,
        turnin_date: formData.turnin_date,
        turnin_time: formData.turnin_time || undefined,
        notes: formData.notes || undefined
      });

      if (error) {
        console.error('Error creating turn-in:', error);
        alert('Error creating turn-in record. Please try again.');
      } else {
        alert('Turn-in record created successfully!');
        setFormData({
          location_collected: '',
          collection_date: '',
          collection_time: '',
          disc_count: '',
          turnin_location: '',
          turnin_date: '',
          turnin_time: '',
          notes: ''
        });
        setShowForm(false);
        loadTurnins();
      }
    } catch (error) {
      console.error('Error creating turn-in:', error);
      alert('Error creating turn-in record. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmPayment = async (paymentId: string) => {
    try {
      const { error } = await discService.confirmPaymentReceipt(paymentId);
      if (error) {
        console.error('Error confirming payment:', error);
        alert('Error confirming payment. Please try again.');
      } else {
        alert('Payment confirmed successfully!');
        if (selectedTurnin) {
          loadPayments(selectedTurnin.id);
        }
        loadTurnins();
      }
    } catch (error) {
      console.error('Error confirming payment:', error);
      alert('Error confirming payment. Please try again.');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatTime = (timeString?: string) => {
    if (!timeString) return '';
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="form-container">
      <div className="form-header">
        <button className="back-button" onClick={() => onNavigate('home')}>
          ← Back to Home
        </button>
        <h1>RakerDiver Dashboard</h1>
        <p>Manage your bulk disc turn-in records and payments</p>
      </div>

      {/* Action Buttons */}
      <div className="dashboard-actions">
        <button
          className="button primary"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancel' : 'Record New Turn-In'}
        </button>
      </div>

      {/* New Turn-In Form */}
      {showForm && (
        <div className="form-section">
          <h2>Record New Bulk Turn-In</h2>
          <form onSubmit={handleSubmit} className="disc-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="location_collected">Collection Location *</label>
                <input
                  type="text"
                  id="location_collected"
                  value={formData.location_collected}
                  onChange={(e) => setFormData({...formData, location_collected: e.target.value})}
                  placeholder="e.g., Jones East North Pond"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="disc_count">Number of Discs *</label>
                <input
                  type="number"
                  id="disc_count"
                  value={formData.disc_count}
                  onChange={(e) => setFormData({...formData, disc_count: e.target.value})}
                  min="1"
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="collection_date">Collection Date *</label>
                <input
                  type="date"
                  id="collection_date"
                  value={formData.collection_date}
                  onChange={(e) => setFormData({...formData, collection_date: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="collection_time">Collection Time</label>
                <input
                  type="time"
                  id="collection_time"
                  value={formData.collection_time}
                  onChange={(e) => setFormData({...formData, collection_time: e.target.value})}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="turnin_location">Turn-In Location *</label>
                <input
                  type="text"
                  id="turnin_location"
                  value={formData.turnin_location}
                  onChange={(e) => setFormData({...formData, turnin_location: e.target.value})}
                  placeholder="e.g., L&F Booth in Emporia"
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="turnin_date">Turn-In Date *</label>
                <input
                  type="date"
                  id="turnin_date"
                  value={formData.turnin_date}
                  onChange={(e) => setFormData({...formData, turnin_date: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="turnin_time">Turn-In Time</label>
                <input
                  type="time"
                  id="turnin_time"
                  value={formData.turnin_time}
                  onChange={(e) => setFormData({...formData, turnin_time: e.target.value})}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="notes">Notes</label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="Additional notes about the collection or turn-in..."
                rows={3}
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="button primary" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Turn-In Record'}
              </button>
              <button type="button" className="button secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Turn-In Records */}
      <div className="dashboard-section">
        <h2>Your Turn-In Records</h2>
        {isLoading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading turn-ins...</p>
          </div>
        ) : turnins.length === 0 ? (
          <p>No turn-in records found. Create your first record above!</p>
        ) : (
          <div className="turnin-grid">
            {turnins.map((turnin) => (
              <div key={turnin.id} className="turnin-card">
                <div className="turnin-header">
                  <h4>{turnin.location_collected}</h4>
                  <span className={`status-badge ${turnin.admin_verified ? 'verified' : 'pending'}`}>
                    {turnin.admin_verified ? 'Verified' : 'Pending Verification'}
                  </span>
                </div>
                
                <div className="turnin-details">
                  <div className="detail-row">
                    <span className="label">Discs:</span>
                    <span className="value">{turnin.disc_count}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Collected:</span>
                    <span className="value">{formatDate(turnin.collection_date)} {formatTime(turnin.collection_time)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Turned In:</span>
                    <span className="value">{formatDate(turnin.turnin_date)} {formatTime(turnin.turnin_time)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Location:</span>
                    <span className="value">{turnin.turnin_location}</span>
                  </div>

                  {turnin.notes && (
                    <div className="detail-row">
                      <span className="label">Notes:</span>
                      <span className="value">{turnin.notes}</span>
                    </div>
                  )}

                  {turnin.admin_verified && turnin.verified_at && (
                    <div className="detail-row">
                      <span className="label">Verified:</span>
                      <span className="value">{formatDate(turnin.verified_at)}</span>
                    </div>
                  )}

                  <div className="payment-summary">
                    <div className="detail-row">
                      <span className="label">Total Payments:</span>
                      <span className="value">{formatCurrency(turnin.total_payments || 0)}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Confirmed:</span>
                      <span className="value">{formatCurrency(turnin.confirmed_payments || 0)}</span>
                    </div>
                  </div>
                </div>
                
                <button
                  className="button secondary"
                  onClick={() => setSelectedTurnin(selectedTurnin?.id === turnin.id ? null : turnin)}
                >
                  {selectedTurnin?.id === turnin.id ? 'Hide Payments' : 'View Payments'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment Details Modal */}
      {selectedTurnin && (
        <div className="modal-overlay" onClick={() => setSelectedTurnin(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Payments for {selectedTurnin.location_collected}</h3>
              <button className="close-button" onClick={() => setSelectedTurnin(null)}>×</button>
            </div>
            
            <div className="modal-body">
              {payments.length === 0 ? (
                <p>No payments recorded yet.</p>
              ) : (
                <div className="payments-list">
                  {payments.map((payment) => (
                    <div key={payment.id} className="payment-item">
                      <div className="payment-details">
                        <div className="detail-row">
                          <span className="label">Amount:</span>
                          <span className="value">{formatCurrency(payment.amount)}</span>
                        </div>
                        {payment.payment_method && (
                          <div className="detail-row">
                            <span className="label">Method:</span>
                            <span className="value">{payment.payment_method}</span>
                          </div>
                        )}
                        {payment.payment_date && (
                          <div className="detail-row">
                            <span className="label">Date:</span>
                            <span className="value">{formatDate(payment.payment_date)}</span>
                          </div>
                        )}
                        {payment.payment_notes && (
                          <div className="detail-row">
                            <span className="label">Notes:</span>
                            <span className="value">{payment.payment_notes}</span>
                          </div>
                        )}
                        <div className="detail-row">
                          <span className="label">Created:</span>
                          <span className="value">{formatDate(payment.created_at)}</span>
                        </div>
                      </div>
                      
                      <div className="payment-actions">
                        {payment.rakerdiver_confirmed ? (
                          <span className="status-badge verified">Confirmed</span>
                        ) : (
                          <button
                            className="button primary"
                            onClick={() => handleConfirmPayment(payment.id)}
                          >
                            Confirm Receipt
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
