import React, { useEffect, useState } from 'react';
import { discService, supabaseService, FoundDisc, ReturnStatus, Source } from '../lib/supabase';

interface DiscEditFormProps {
  discId: string;
  onSaved: () => void;
  onCancel: () => void;
}

const DISC_TYPE_OPTIONS = ['not specified', 'putter', 'approach', 'midrange', 'fairway_driver', 'distance_driver', 'driver'];
const CONDITION_OPTIONS = ['not specified', 'new', 'excellent', 'good', 'fair', 'poor'];
const RETURN_STATUS_OPTIONS: ReturnStatus[] = ['Found', 'Returned to Owner', 'For Sale Used', 'Sold', 'Donated', 'Trashed'];

type FormState = Record<
  | 'rack_id' | 'brand' | 'mold' | 'disc_type' | 'color' | 'weight' | 'condition' | 'plastic_type'
  | 'stamp_text' | 'name_on_disc' | 'phone_number' | 'owner_email' | 'owner_pdga_number'
  | 'source_id' | 'location_found' | 'found_date' | 'description' | 'return_status' | 'returned_notes',
  string
>;

function toFormState(disc: FoundDisc): FormState {
  const str = (v: unknown) => (v === null || v === undefined ? '' : String(v));
  return {
    rack_id: str(disc.rack_id),
    brand: str(disc.brand),
    mold: str(disc.mold),
    disc_type: str(disc.disc_type),
    color: str(disc.color),
    weight: str(disc.weight),
    condition: str(disc.condition),
    plastic_type: str(disc.plastic_type),
    stamp_text: str(disc.stamp_text),
    name_on_disc: str(disc.name_on_disc),
    phone_number: str(disc.phone_number),
    owner_email: str(disc.owner_email),
    owner_pdga_number: str(disc.owner_pdga_number),
    source_id: str(disc.source_id),
    location_found: str(disc.location_found),
    found_date: str(disc.found_date).slice(0, 10),
    description: str(disc.description),
    return_status: str(disc.return_status) || 'Found',
    returned_notes: str(disc.returned_notes),
  };
}

// Empty string -> null; otherwise a whole number, or NaN if invalid
function parseOptionalInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^\d+$/.test(trimmed) ? parseInt(trimmed, 10) : NaN;
}

export function DiscEditForm({ discId, onSaved, onCancel }: DiscEditFormProps) {
  const [original, setOriginal] = useState<FoundDisc | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [discResult, activeSources] = await Promise.all([
        discService.getFoundDiscForEdit(discId),
        supabaseService.getActiveSources().catch(() => [] as Source[]),
      ]);
      if (cancelled) return;
      if (discResult.error || !discResult.data) {
        setLoadError('Failed to load disc for editing');
        return;
      }
      setOriginal(discResult.data);
      setForm(toFormState(discResult.data));
      setSources(activeSources);
    })();
    return () => { cancelled = true; };
  }, [discId]);

  if (loadError) return <div className="status-message error">{loadError}</div>;
  if (!form || !original) return <div className="loading-message">Loading editor...</div>;

  const set = (field: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => (prev ? { ...prev, [field]: e.target.value } : prev));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);

    const rackId = parseOptionalInt(form.rack_id);
    const weight = parseOptionalInt(form.weight);
    const pdga = parseOptionalInt(form.owner_pdga_number);
    if (Number.isNaN(rackId)) return setSaveError('Rack ID must be a whole number');
    if (Number.isNaN(weight)) return setSaveError('Weight must be a whole number of grams');
    if (Number.isNaN(pdga)) return setSaveError('PDGA number must be a whole number');
    if (!form.brand.trim()) return setSaveError('Brand is required');
    if (!form.found_date) return setSaveError('Found date is required');

    const text = (v: string) => (v.trim() ? v.trim() : null);
    const updates: Record<string, unknown> = {
      rack_id: rackId,
      brand: form.brand.trim(),
      mold: text(form.mold),
      disc_type: text(form.disc_type),
      color: text(form.color),
      weight,
      condition: text(form.condition),
      plastic_type: text(form.plastic_type),
      stamp_text: text(form.stamp_text),
      name_on_disc: text(form.name_on_disc),
      phone_number: text(form.phone_number),
      owner_email: text(form.owner_email),
      owner_pdga_number: pdga,
      source_id: text(form.source_id),
      location_found: form.location_found.trim() || 'Exact location unknown.',
      found_date: form.found_date,
      description: text(form.description),
      return_status: form.return_status,
      returned_notes: text(form.returned_notes),
    };

    // Mirror update_disc_return_status: returned_at tracks when the status left 'Found'
    if (form.return_status !== (original.return_status || 'Found')) {
      updates.returned_at = form.return_status === 'Found' ? null : new Date().toISOString();
    }

    setIsSaving(true);
    const { success, error } = await discService.updateFoundDisc(discId, updates);
    setIsSaving(false);
    if (!success) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save changes');
      return;
    }
    onSaved();
  };

  // Keep an inactive/unknown current source selectable
  const sourceOptions = sources.some(s => s.id === form.source_id) || !form.source_id
    ? sources
    : [{ id: form.source_id, name: '(current source)' } as Source, ...sources];

  const textField = (field: keyof FormState, label: string, type = 'text') => (
    <div className="form-group">
      <label htmlFor={`edit-${field}`}>{label}</label>
      <input id={`edit-${field}`} type={type} value={form[field]} onChange={set(field)} />
    </div>
  );

  const selectField = (field: keyof FormState, label: string, options: { value: string; label: string }[]) => (
    <div className="form-group">
      <label htmlFor={`edit-${field}`}>{label}</label>
      <select id={`edit-${field}`} value={form[field]} onChange={set(field)}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );

  const enumOptions = (values: string[], current: string) => {
    const all = current && !values.includes(current) ? [current, ...values] : values;
    return [{ value: '', label: '—' }, ...all.map(v => ({ value: v, label: v.replace(/_/g, ' ') }))];
  };

  return (
    <form className="disc-form" onSubmit={handleSubmit}>
      <div className="form-section">
        <h3>Disc</h3>
        <div className="form-row">
          {textField('rack_id', 'Rack ID')}
          {textField('brand', 'Brand *')}
        </div>
        <div className="form-row">
          {textField('mold', 'Mold')}
          {selectField('disc_type', 'Disc type', enumOptions(DISC_TYPE_OPTIONS, form.disc_type))}
        </div>
        <div className="form-row">
          {textField('color', 'Color')}
          {textField('weight', 'Weight (g)')}
        </div>
        <div className="form-row">
          {selectField('condition', 'Condition', enumOptions(CONDITION_OPTIONS, form.condition))}
          {textField('plastic_type', 'Plastic')}
        </div>
        <div className="form-row">
          {textField('stamp_text', 'Stamp')}
        </div>
      </div>

      <div className="form-section">
        <h3>Owner</h3>
        <div className="form-row">
          {textField('name_on_disc', 'Name on disc')}
          {textField('phone_number', 'Phone on disc', 'tel')}
        </div>
        <div className="form-row">
          {textField('owner_email', 'Owner email', 'email')}
          {textField('owner_pdga_number', 'Owner PDGA #')}
        </div>
      </div>

      <div className="form-section">
        <h3>Where & when</h3>
        <div className="form-row">
          {selectField('source_id', 'Source', [
            { value: '', label: '—' },
            ...sourceOptions.map(s => ({ value: s.id, label: s.name })),
          ])}
          {textField('found_date', 'Found on *', 'date')}
        </div>
        <div className="form-row">
          {textField('location_found', 'Specific location')}
        </div>
        <div className="form-group">
          <label htmlFor="edit-description">Description</label>
          <textarea id="edit-description" value={form.description} onChange={set('description')} />
        </div>
      </div>

      <div className="form-section">
        <h3>Status</h3>
        <div className="form-row">
          {selectField('return_status', 'Return status', RETURN_STATUS_OPTIONS.map(s => ({ value: s, label: s })))}
          {textField('returned_notes', 'Status notes')}
        </div>
      </div>

      {saveError && <div className="status-message error">{saveError}</div>}

      <div className="form-actions">
        <button type="button" className="button secondary" onClick={onCancel} disabled={isSaving}>
          Cancel
        </button>
        <button type="submit" className="button primary" disabled={isSaving}>
          {isSaving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
