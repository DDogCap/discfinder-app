import React, { useState, useEffect } from 'react';
import { discService, AdminBulkTurnin, BulkTurninPayment } from '../lib/supabase';

interface AdminBulkTurninsProps {
  onNavigate: (page: string) => void;
}

interface PaymentFormData {
  amount: string;
  payment_method: string;
  payment_date: string;
  payment_notes: string;
}

export function AdminBulkTurnins({ onNavigate }: AdminBulkTurninsProps) {
  const [turnins, setTurnins] = useState<AdminBulkTurnin[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'verified'>('all');
  const [selectedTurnin, setSelectedTurnin] = useState<AdminBulkTurnin | null>(null);
  const [payments, setPayments] = useState<BulkTurninPayment[]>([]);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentFormData, setPaymentFormData] = useState<PaymentFormData>({
    amount: '',
    payment_method: '',
    payment_date: '',
    payment_notes: ''
  });
  const [verificationNotes, setVerificationNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadTurnins = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await discService.getAdminBulkTurnins();
      if (error) {
        console.error('Error loading bulk turn-ins:', error);
      } else {
        setTurnins(data || []);
      }
    } catch (error) {
      console.error('Error loading bulk turn-ins:', error);
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

  const handleVerifyTurnin = async (turninId: string) => {
    setIsSubmitting(true);
    try {
      const { error } = await discService.verifyBulkTurnin(turninId, verificationNotes || undefined);
      if (error) {
        console.error('Error verifying turn-in:', error);
        alert('Error verifying turn-in. Please try again.');
      } else {
        alert('Turn-in verified successfully!');
        setVerificationNotes('');
        loadTurnins();
        if (selectedTurnin?.id === turninId) {
          setSelectedTurnin(prev => prev ? { ...prev, admin_verified: true } : null);
        }
      }
    } catch (error) {
      console.error('Error verifying turn-in:', error);
      alert('Error verifying turn-in. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTurnin) return;

    setIsSubmitting(true);
    try {
      const { error } = await discService.createBulkTurninPayment({
        bulk_turnin_id: selectedTurnin.id,
        amount: parseFloat(paymentFormData.amount),
        payment_method: paymentFormData.payment_method || undefined,
        payment_date: paymentFormData.payment_date || undefined,
        payment_notes: paymentFormData.payment_notes || undefined
      });

      if (error) {
        console.error('Error creating payment:', error);
        alert('Error creating payment. Please try again.');
      } else {
        alert('Payment record created successfully!');
        setPaymentFormData({
          amount: '',
          payment_method: '',
          payment_date: '',
          payment_notes: ''
        });
        setShowPaymentForm(false);
        loadPayments(selectedTurnin.id);
        loadTurnins();
      }
    } catch (error) {
      console.error('Error creating payment:', error);
      alert('Error creating payment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTurnins = turnins.filter(turnin => {
    if (filter === 'pending') return !turnin.admin_verified;
    if (filter === 'verified') return turnin.admin_verified;
    return true;
  });

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
        <button className="back-button" onClick={() => onNavigate('admin')}>
          ← Back to Admin Dashboard
        </button>
        <h1>Bulk Turn-In Management</h1>
        <p>Verify turn-ins and manage payments for RakerDivers</p>
      </div>

      {/* Filter Controls */}
      <div className="filter-controls">
        <label htmlFor="status-filter">Filter by status:</label>
        <select
          id="status-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value as 'all' | 'pending' | 'verified')}
        >
          <option value="all">All Turn-Ins</option>
          <option value="pending">Pending Verification</option>
          <option value="verified">Verified</option>
        </select>
      </div>

      {/* Turn-In Records */}
      {isLoading ? (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading turn-ins...</p>
        </div>
      ) : filteredTurnins.length === 0 ? (
        <p>No turn-in records found for the selected filter.</p>
      ) : (
        <div className="admin-turnin-grid">
          {filteredTurnins.map((turnin) => (
            <div key={turnin.id} className="admin-turnin-card">
              <div className="turnin-header">
                <h4>{turnin.location_collected}</h4>
                <span className={`status-badge ${turnin.admin_verified ? 'verified' : 'pending'}`}>
                  {turnin.admin_verified ? 'Verified' : 'Pending'}
                </span>
              </div>
              
              <div className="disc-details">
                <div className="detail-row">
                  <span className="label">RakerDiver:</span>
                  <span className="value">{turnin.rakerdiver_name || turnin.rakerdiver_email}</span>
                </div>
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
                  <>
                    <div className="detail-row">
                      <span className="label">Verified:</span>
                      <span className="value">{formatDate(turnin.verified_at)}</span>
                    </div>
                    {turnin.verified_by_name && (
                      <div className="detail-row">
                        <span className="label">Verified By:</span>
                        <span className="value">{turnin.verified_by_name}</span>
                      </div>
                    )}
                    {turnin.verification_notes && (
                      <div className="detail-row">
                        <span className="label">Verification Notes:</span>
                        <span className="value">{turnin.verification_notes}</span>
                      </div>
                    )}
                  </>
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
                  <div className="detail-row">
                    <span className="label">Payment Records:</span>
                    <span className="value">{turnin.payment_count || 0}</span>
                  </div>
                </div>
              </div>
              
              <div className="turnin-actions">
                {!turnin.admin_verified && (
                  <div className="verification-section">
                    <textarea
                      placeholder="Verification notes (optional)"
                      value={verificationNotes}
                      onChange={(e) => setVerificationNotes(e.target.value)}
                      rows={2}
                    />
                    <button
                      className="button primary"
                      onClick={() => handleVerifyTurnin(turnin.id)}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Verifying...' : 'Verify Turn-In'}
                    </button>
                  </div>
                )}
                
                <button
                  className="button secondary"
                  onClick={() => setSelectedTurnin(selectedTurnin?.id === turnin.id ? null : turnin)}
                >
                  {selectedTurnin?.id === turnin.id ? 'Hide Details' : 'Manage Payments'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Payment Management Modal */}
      {selectedTurnin && (
        <div className="modal-overlay" onClick={() => setSelectedTurnin(null)}>
          <div className="modal-content large-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Manage Payments - {selectedTurnin.location_collected}</h3>
              <button className="close-button" onClick={() => setSelectedTurnin(null)}>×</button>
            </div>
            
            <div className="modal-body">
              {/* Add Payment Button */}
              <div className="payment-actions">
                <button
                  className="button primary"
                  onClick={() => setShowPaymentForm(!showPaymentForm)}
                >
                  {showPaymentForm ? 'Cancel' : 'Add Payment'}
                </button>
              </div>

              {/* Payment Form */}
              {showPaymentForm && (
                <form onSubmit={handleCreatePayment} className="payment-form">
                  <h4>Create Payment Record</h4>
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="amount">Amount *</label>
                      <input
                        type="number"
                        id="amount"
                        step="0.01"
                        min="0"
                        value={paymentFormData.amount}
                        onChange={(e) => setPaymentFormData({...paymentFormData, amount: e.target.value})}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="payment_method">Payment Method</label>
                      <select
                        id="payment_method"
                        value={paymentFormData.payment_method}
                        onChange={(e) => setPaymentFormData({...paymentFormData, payment_method: e.target.value})}
                      >
                        <option value="">Select method</option>
                        <option value="cash">Cash</option>
                        <option value="venmo">Venmo</option>
                        <option value="paypal">PayPal</option>
                        <option value="check">Check</option>
                        <option value="bank_transfer">Bank Transfer</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="payment_date">Payment Date</label>
                    <input
                      type="date"
                      id="payment_date"
                      value={paymentFormData.payment_date}
                      onChange={(e) => setPaymentFormData({...paymentFormData, payment_date: e.target.value})}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="payment_notes">Payment Notes</label>
                    <textarea
                      id="payment_notes"
                      value={paymentFormData.payment_notes}
                      onChange={(e) => setPaymentFormData({...paymentFormData, payment_notes: e.target.value})}
                      placeholder="Additional notes about the payment..."
                      rows={3}
                    />
                  </div>
                  
                  <div className="form-actions">
                    <button type="submit" className="button primary" disabled={isSubmitting}>
                      {isSubmitting ? 'Creating...' : 'Create Payment'}
                    </button>
                    <button type="button" className="button secondary" onClick={() => setShowPaymentForm(false)}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {/* Existing Payments */}
              <div className="payments-section">
                <h4>Payment History</h4>
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
                        
                        <div className="payment-status">
                          {payment.rakerdiver_confirmed ? (
                            <div>
                              <span className="status-badge verified">Confirmed by RakerDiver</span>
                              {payment.confirmed_at && (
                                <p><small>Confirmed: {formatDate(payment.confirmed_at)}</small></p>
                              )}
                            </div>
                          ) : (
                            <span className="status-badge pending">Awaiting Confirmation</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
