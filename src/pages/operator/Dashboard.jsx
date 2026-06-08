// OpsLoom Operator Dashboard — updated
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { createClient } from '@supabase/supabase-js'

// Admin client for creating auth users — lazy so missing env var doesn't crash
function getAdminClient() {
  const key = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient('https://oxhcbmvoipifwtxypzmb.supabase.co', key)
}

// ── SHARED HELPERS ────────────────────────────────────────────────────
function NavTab({ label, active, onClick }) {
  return <button onClick={onClick} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 14, fontWeight: 500, background: active ? '#0a0a0a' : 'transparent', color: active ? '#fff' : '#666', border: 'none', cursor: 'pointer' }}>{label}</button>
}
function StatusBadge({ status }) {
  const map = { 'Ready': 'badge-ready', 'At Risk': 'badge-atrisk', 'Not Ready': 'badge-notready' }
  return <span className={`badge ${map[status] || 'badge-notready'}`}>{status || 'Not Ready'}</span>
}
function SeverityBadge({ s }) {
  const map = { 'Critical': 'badge-critical', 'High': 'badge-high', 'Medium': 'badge-medium', 'Low': 'badge-low' }
  return <span className={`badge ${map[s] || 'badge-low'}`}>{s}</span>
}
function CompBadge({ status }) {
  const map = { 'Valid': 'badge-valid', 'Due Soon': 'badge-duesoon', 'Expired': 'badge-expired', 'Missing': 'badge-notready' }
  return <span className={`badge ${map[status] || 'badge-duesoon'}`}>{status}</span>
}
function FieldError({ msg }) { return msg ? <div style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>{msg}</div> : null }
function computeDocStatus(doc) {
  const days = doc.expiry_date ? Math.ceil((new Date(doc.expiry_date) - new Date()) / 86400000) : null
  if (days === null) return 'Missing'
  if (days < 0) return 'Expired'
  if (days <= 30) return 'Due Soon'
  return 'Valid'
}
function calculateReadiness(issues, restockItems, compDocs, jobs) {
  const openIssues = issues.filter(i => i.status !== 'Closed' && i.status !== 'Fixed')
  if (openIssues.some(i => i.severity === 'Critical') || compDocs.some(d => computeDocStatus(d) === 'Expired')) return 'Not Ready'
  if (restockItems.some(r => r.needs_restock) || compDocs.some(d => computeDocStatus(d) === 'Due Soon') || openIssues.some(i => i.severity === 'High') || (jobs[0] && jobs[0].status !== 'Complete')) return 'At Risk'
  return 'Ready'
}
function validateEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) }
function validatePhone(p) { return /^[\d\s\+\-\(\)]{7,15}$/.test(p) }
function required(val) { return val && val.toString().trim().length > 0 }
async function uploadFile(file, folder) {
  const ext = file.name.split('.').pop()
  const path = `${folder}/${Date.now()}.${ext}`
  const { data, error } = await supabase.storage.from('uploads').upload(path, file)
  if (error) return null
  const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(path)
  return urlData.publicUrl
}

// ── PROPERTY PROFILE ─────────────────────────────────────────────────
const AMENITY_OPTIONS = [
  { key: 'Parking', icon: 'ti-car' }, { key: 'Garden', icon: 'ti-tree' },
  { key: 'Conservatory', icon: 'ti-building' }, { key: 'Garage', icon: 'ti-home-2' },
  { key: 'Hot tub', icon: 'ti-pool' }, { key: 'Fire exit', icon: 'ti-door' },
  { key: 'Wifi', icon: 'ti-wifi' }, { key: 'Smart TV', icon: 'ti-device-tv' },
  { key: 'Washer', icon: 'ti-wash-machine' }, { key: 'Dishwasher', icon: 'ti-tool' },
  { key: 'Tumble dryer', icon: 'ti-snowflake' }, { key: 'Log fire', icon: 'ti-flame' },
  { key: 'Air conditioning', icon: 'ti-air-conditioning' }, { key: 'Parking (street)', icon: 'ti-road' },
]

const KB_SECTIONS = [
  { key: 'access', label: 'Access & entry', icon: 'ti-key', fields: [
    { key: 'access_code', label: 'Front door access code' },
    { key: 'lockbox_location', label: 'Lockbox location' },
    { key: 'key_instructions', label: 'Key instructions' },
    { key: 'parking_instructions', label: 'Parking instructions' },
  ]},
  { key: 'layout', label: 'Property layout', icon: 'ti-layout-2', fields: [
    { key: 'room_layout', label: 'Room layout', multiline: true },
    { key: 'fire_exits', label: 'Fire exits' },
    { key: 'garden_access', label: 'Garden / outdoor access' },
  ]},
  { key: 'linen', label: 'Linen & laundry', icon: 'ti-shirt', fields: [
    { key: 'linen_location', label: 'Linen cupboard location' },
    { key: 'linen_rooms', label: 'What linen goes where', multiline: true },
    { key: 'washing_machine', label: 'Washing machine instructions' },
  ]},
  { key: 'appliances', label: 'Appliances', icon: 'ti-plug', fields: [
    { key: 'boiler', label: 'Boiler location and instructions', multiline: true },
    { key: 'dishwasher', label: 'Dishwasher instructions' },
    { key: 'tv_remote', label: 'TV and remote' },
    { key: 'other_appliances', label: 'Other appliance notes', multiline: true },
  ]},
  { key: 'utilities', label: 'Utilities', icon: 'ti-wifi', fields: [
    { key: 'wifi', label: 'Wifi name and password' },
    { key: 'wifi_router_location', label: 'Wifi router location' },
    { key: 'fuse_box', label: 'Fuse box location' },
    { key: 'stopcock', label: 'Water stopcock location' },
    { key: 'heating', label: 'Heating controls' },
  ]},
  { key: 'stocks', label: 'Stocks & supplies', icon: 'ti-box', fields: [
    { key: 'cleaning_products', label: 'Cleaning products location' },
    { key: 'toiletries', label: 'Guest toiletries location' },
    { key: 'kitchen_supplies', label: 'Kitchen supplies', multiline: true },
    { key: 'towels', label: 'Spare towels location' },
  ]},
  { key: 'bins', label: 'Bins & waste', icon: 'ti-trash', fields: [
    { key: 'bins', label: 'Bin location' },
    { key: 'bin_collection', label: 'Collection day' },
    { key: 'recycling', label: 'Recycling rules' },
  ]},
  { key: 'safety', label: 'Safety', icon: 'ti-shield', fields: [
    { key: 'smoke_alarms', label: 'Smoke alarm locations' },
    { key: 'co_alarm', label: 'CO alarm location' },
    { key: 'fire_extinguisher', label: 'Fire extinguisher location' },
    { key: 'first_aid', label: 'First aid kit' },
  ]},
  { key: 'special', label: 'Special instructions', icon: 'ti-notes', fields: [
    { key: 'quirks', label: 'Quirks to know about', multiline: true },
    { key: 'do_not', label: 'Things not to do', multiline: true },
    { key: 'owner_preferences', label: 'Owner preferences', multiline: true },
  ]},
]

function KBSection({ section, data, editMode, onChange }) {
  const [open, setOpen] = useState(false)
  const hasData = section.fields.some(f => data?.[f.key])
  return (
    <div style={{ border: '0.5px solid var(--color-border-tertiary, #e0e0e0)', borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
      <div onClick={() => setOpen(!open)} style={{ padding: '12px 14px', background: 'var(--color-background-secondary, #f7f7f7)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className={`ti ${section.icon}`} style={{ fontSize: 15 }} aria-hidden="true" />
          <span style={{ fontSize: 14, fontWeight: 500 }}>{section.label}</span>
          {hasData && !editMode && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', flexShrink: 0 }} />}
        </div>
        <i className={`ti ${open ? 'ti-chevron-up' : 'ti-chevron-down'}`} style={{ fontSize: 14 }} aria-hidden="true" />
      </div>
      {open && (
        <div style={{ padding: 14 }}>
          {section.fields.map(field => (
            <div key={field.key} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#aaa', marginBottom: 4 }}>{field.label}</div>
              {editMode ? (
                field.multiline
                  ? <textarea className="input-field" rows={3} value={data?.[field.key] || ''} onChange={e => onChange(field.key, e.target.value)} placeholder={`Enter ${field.label.toLowerCase()}...`} />
                  : <input className="input-field" value={data?.[field.key] || ''} onChange={e => onChange(field.key, e.target.value)} placeholder={`Enter ${field.label.toLowerCase()}...`} />
              ) : (
                <div style={{ fontSize: 14, color: data?.[field.key] ? '#333' : '#aaa' }}>{data?.[field.key] || 'Not set'}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AddPropertyStepper({ onSave, onCancel, agencies }) {
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [selectedAmenities, setSelectedAmenities] = useState([])
  const [kbData, setKbData] = useState({})
  const [compFiles, setCompFiles] = useState({})
  const [form, setForm] = useState({ name: '', house_no: '', address_line1: '', address_line2: '', city: '', postcode: '', country: 'United Kingdom', bedroom: '', bathrooms: '', separate_wc: '', max_guests: '', next_checkin: '', knowledge_base_file: null })
  const [errors, setErrors] = useState({})

  const compDocs = [
    { key: 'gas', label: 'Gas Safety Record (CP12)', sub: 'Annual · Gas Safe engineer' },
    { key: 'eicr', label: 'EICR — electrical safety', sub: 'Every 5 years' },
    { key: 'epc', label: 'EPC — energy rating', sub: 'Valid up to 10 years' },
    { key: 'insurance', label: 'Public liability insurance', sub: 'Annual · short-let cover' },
    { key: 'fra', label: 'Fire Risk Assessment', sub: 'Annual or on layout change' },
  ]

  function toggleAmenity(key) {
    setSelectedAmenities(prev => prev.includes(key) ? prev.filter(a => a !== key) : [...prev, key])
  }

  function validateStep1() {
    const e = {}
    if (!required(form.name)) e.name = 'Property name is required'
    if (!required(form.house_no)) e.house_no = 'Required'
    if (!required(form.address_line1)) e.address_line1 = 'Required'
    if (!required(form.city)) e.city = 'Required'
    if (!required(form.postcode)) e.postcode = 'Required'
    setErrors(e); return Object.keys(e).length === 0
  }
  function validateStep2() {
    const e = {}
    if (!required(form.bedroom) || isNaN(form.bedroom) || parseInt(form.bedroom) < 1) e.bedroom = 'Enter number of bedrooms'
    setErrors(e); return Object.keys(e).length === 0
  }

  function nextStep() {
    if (step === 1 && !validateStep1()) return
    if (step === 2 && !validateStep2()) return
    setStep(s => s + 1)
  }

  async function handleSave() {
    setSaving(true)
    const parts = [form.house_no.trim(), form.address_line1.trim()]
    if (form.address_line2?.trim()) parts.push(form.address_line2.trim())
    parts.push(form.city.trim(), form.postcode.trim().toUpperCase(), form.country)
    const fullAddress = parts.join(', ')
    let kbUrl = null
    if (form.knowledge_base_file) kbUrl = await uploadFile(form.knowledge_base_file, 'knowledge-base')
    const { data } = await supabase.from('Properties').insert({
      name: form.name.trim(), address: fullAddress,
      bedroom: parseInt(form.bedroom),
      bathrooms: form.bathrooms ? parseInt(form.bathrooms) : null,
      separate_wc: form.separate_wc ? parseInt(form.separate_wc) : null,
      max_guests: form.max_guests ? parseInt(form.max_guests) : null,
      next_checkin: form.next_checkin || null,
      access_code: kbData.access_code || null,
      linen_location: kbData.linen_location || null,
      appliance_notes: kbData.boiler || null,
      readiness_status: 'Not Ready',
      property_status: 'active',
      knowledge_base_url: kbUrl,
      amenities: JSON.stringify(selectedAmenities),
      knowledge_base: JSON.stringify(kbData),
    }).select()

    if (data?.[0]) {
      const pid = data[0].id
      for (const [key, file] of Object.entries(compFiles)) {
        if (!file) continue
        const docMap = { gas: 'Gas Safety Record (CP12)', eicr: 'EICR', epc: 'EPC', insurance: 'Public Liability Insurance', fra: 'Fire Risk Assessment' }
        const fileUrl = await uploadFile(file, 'compliance')
        await supabase.from('compliance_documents').insert({ document_type: docMap[key], property_id: pid, document_url: fileUrl })
      }
    }
    setSaving(false)
    onSave(data?.[0])
  }

  const stepLabels = ['Details', 'Features', 'Knowledge base', 'Compliance', 'Review']

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 16 }}>Add new property</div>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#aaa' }}>×</button>
      </div>

      {/* Step bar */}
      <div style={{ display: 'flex', marginBottom: 16, border: '0.5px solid #e0e0e0', borderRadius: 8, overflow: 'hidden' }}>
        {stepLabels.map((label, i) => (
          <div key={i} onClick={() => i + 1 < step && setStep(i + 1)} style={{
            flex: 1, padding: '8px 4px', textAlign: 'center', fontSize: 11, fontWeight: 500,
            background: step === i + 1 ? '#0a0a0a' : i + 1 < step ? '#dcfce7' : '#f7f7f7',
            color: step === i + 1 ? '#fff' : i + 1 < step ? '#166534' : '#aaa',
            borderRight: i < 4 ? '0.5px solid #e0e0e0' : 'none',
            cursor: i + 1 < step ? 'pointer' : 'default',
          }}>{i + 1 < step ? '✓ ' : `${i + 1}. `}{label}</div>
        ))}
      </div>

      {/* Progress */}
      <div style={{ height: 3, background: '#f0f0f0', borderRadius: 2, marginBottom: 20 }}>
        <div style={{ height: 3, background: '#0a0a0a', borderRadius: 2, width: `${step * 20}%`, transition: 'width 0.3s' }} />
      </div>

      {/* STEP 1 — Details */}
      {step === 1 && (
        <div>
          <div className="form-group"><label className="label">Property name *</label><input className="input-field" placeholder="e.g. The Mill House" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /><FieldError msg={errors.name} /></div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#888', margin: '4px 0 10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Address</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="form-group" style={{ flex: 1 }}><label className="label">House / flat no. *</label><input className="input-field" placeholder="e.g. 12" value={form.house_no} onChange={e => setForm({ ...form, house_no: e.target.value })} /><FieldError msg={errors.house_no} /></div>
            <div className="form-group" style={{ flex: 2 }}><label className="label">Street *</label><input className="input-field" placeholder="e.g. Mill Lane" value={form.address_line1} onChange={e => setForm({ ...form, address_line1: e.target.value })} /><FieldError msg={errors.address_line1} /></div>
          </div>
          <div className="form-group"><label className="label">Address line 2 (optional)</label><input className="input-field" placeholder="e.g. Headingley" value={form.address_line2} onChange={e => setForm({ ...form, address_line2: e.target.value })} /></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="form-group" style={{ flex: 1 }}><label className="label">City *</label><input className="input-field" placeholder="e.g. Leeds" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /><FieldError msg={errors.city} /></div>
            <div className="form-group" style={{ flex: 1 }}><label className="label">Postcode *</label><input className="input-field" placeholder="e.g. LS1 5DQ" value={form.postcode} onChange={e => setForm({ ...form, postcode: e.target.value })} style={{ textTransform: 'uppercase' }} /><FieldError msg={errors.postcode} /></div>
          </div>
          <div className="form-group"><label className="label">Country</label><input className="input-field" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} /></div>
        </div>
      )}

      {/* STEP 2 — Features */}
      {step === 2 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rooms</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="form-group" style={{ flex: 1 }}><label className="label">Bedrooms *</label><input className="input-field" type="number" min="1" value={form.bedroom} onChange={e => setForm({ ...form, bedroom: e.target.value })} /><FieldError msg={errors.bedroom} /></div>
            <div className="form-group" style={{ flex: 1 }}><label className="label">Bathrooms</label><input className="input-field" type="number" min="0" value={form.bathrooms} onChange={e => setForm({ ...form, bathrooms: e.target.value })} /></div>
            <div className="form-group" style={{ flex: 1 }}><label className="label">Separate WC</label><input className="input-field" type="number" min="0" value={form.separate_wc} onChange={e => setForm({ ...form, separate_wc: e.target.value })} /></div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="form-group" style={{ flex: 1 }}><label className="label">Max guests</label><input className="input-field" type="number" min="1" placeholder="e.g. 6" value={form.max_guests} onChange={e => setForm({ ...form, max_guests: e.target.value })} /></div>
            <div className="form-group" style={{ flex: 1 }}><label className="label">Next check-in</label><input className="input-field" type="datetime-local" value={form.next_checkin} onChange={e => setForm({ ...form, next_checkin: e.target.value })} /></div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Amenities (tap to select)</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
            {AMENITY_OPTIONS.map(a => (
              <div key={a.key} onClick={() => toggleAmenity(a.key)} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: '10px 6px', borderRadius: 8, cursor: 'pointer', textAlign: 'center',
                border: selectedAmenities.includes(a.key) ? '1.5px solid #0a0a0a' : '0.5px solid #e0e0e0',
                background: selectedAmenities.includes(a.key) ? '#f0f0f0' : '#fafafa',
                fontSize: 11, color: selectedAmenities.includes(a.key) ? '#0a0a0a' : '#888',
              }}>
                <i className={`ti ${a.icon}`} style={{ fontSize: 18 }} aria-hidden="true" />
                {a.key}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STEP 3 — Knowledge base */}
      {step === 3 && (
        <div>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 14 }}>Fill in what cleaners and maintenance staff need to know. All fields are optional.</div>
          {KB_SECTIONS.map(section => (
            <KBSection key={section.key} section={section} data={kbData} editMode={true} onChange={(key, val) => setKbData(prev => ({ ...prev, [key]: val }))} />
          ))}
          <div className="form-group" style={{ marginTop: 12 }}>
            <label className="label">Upload knowledge base (PDF, Word or image, optional)</label>
            <input type="file" accept=".pdf,.doc,.docx,image/*" className="input-field" style={{ padding: 8 }} onChange={e => setForm({ ...form, knowledge_base_file: e.target.files[0] })} />
            {form.knowledge_base_file && <div style={{ fontSize: 12, color: '#16a34a', marginTop: 4 }}>✓ {form.knowledge_base_file.name}</div>}
          </div>
        </div>
      )}

      {/* STEP 4 — Compliance */}
      {step === 4 && (
        <div>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 14 }}>Upload documents now or skip and add later. Expired documents block readiness.</div>
          {compDocs.map(doc => (
            <div key={doc.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', border: '0.5px solid #e0e0e0', borderRadius: 10, marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{doc.label}</div>
                <div style={{ fontSize: 12, color: '#aaa' }}>{doc.sub}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {compFiles[doc.key] ? (
                  <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#dcfce7', color: '#166534', fontWeight: 500 }}>✓ Uploaded</span>
                ) : (
                  <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#f0f0f0', color: '#888' }}>Not uploaded</span>
                )}
                <label style={{ cursor: 'pointer', fontSize: 12, color: '#2563eb' }}>
                  Upload <input type="file" accept=".pdf,image/*" style={{ display: 'none' }} onChange={e => e.target.files[0] && setCompFiles(prev => ({ ...prev, [doc.key]: e.target.files[0] }))} />
                </label>
              </div>
            </div>
          ))}
          <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, background: '#f7f7f7', fontSize: 13, color: '#888' }}>
            You can skip this step and add documents later from the property profile.
          </div>
        </div>
      )}

      {/* STEP 5 — Review */}
      {step === 5 && (
        <div>
          <div style={{ background: '#f7f7f7', borderRadius: 10, padding: 14, marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Property details</div>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 2 }}>{form.name}</div>
            <div style={{ fontSize: 13, color: '#888' }}>{[form.house_no, form.address_line1, form.address_line2, form.city, form.postcode].filter(Boolean).join(', ')}</div>
          </div>
          <div style={{ background: '#f7f7f7', borderRadius: 10, padding: 14, marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Features</div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>{form.bedroom} bed{form.bathrooms ? ` · ${form.bathrooms} bath` : ''}{form.max_guests ? ` · ${form.max_guests} guests max` : ''}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {selectedAmenities.map(a => <span key={a} style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, background: '#fff', border: '0.5px solid #e0e0e0', color: '#555' }}>{a}</span>)}
              {selectedAmenities.length === 0 && <span style={{ fontSize: 13, color: '#aaa' }}>No amenities selected</span>}
            </div>
          </div>
          <div style={{ background: '#f7f7f7', borderRadius: 10, padding: 14, marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Knowledge base</div>
            {Object.keys(kbData).length > 0 ? (
              <div style={{ fontSize: 13, color: '#555' }}>{Object.keys(kbData).length} fields filled in</div>
            ) : <div style={{ fontSize: 13, color: '#aaa' }}>No knowledge base data added</div>}
          </div>
          <div style={{ background: '#f7f7f7', borderRadius: 10, padding: 14, marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Compliance</div>
            {Object.keys(compFiles).length > 0 ? (
              Object.entries(compFiles).map(([k, f]) => <div key={k} style={{ fontSize: 13, color: '#16a34a' }}>✓ {f.name}</div>)
            ) : <div style={{ fontSize: 13, color: '#aaa' }}>No documents uploaded — add after saving</div>}
          </div>
          {Object.keys(compFiles).length === 0 && (
            <div style={{ padding: '10px 14px', borderRadius: 8, border: '0.5px solid #fed7aa', background: '#fff8ed', fontSize: 13, color: '#92400e', marginBottom: 12 }}>
              ⚠️ No compliance documents uploaded. Property will show as Not Ready until added.
            </div>
          )}
        </div>
      )}

      {/* Navigation buttons */}
      <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
        {step > 1 && <button onClick={() => setStep(s => s - 1)} className="btn-secondary" style={{ flex: 1 }}>← Back</button>}
        {step < 5 && <button onClick={nextStep} className="btn-primary" style={{ flex: 1 }}>Continue →</button>}
        {step === 5 && <button onClick={handleSave} className="btn-primary" style={{ flex: 1 }} disabled={saving}>{saving ? 'Saving...' : 'Save property'}</button>}
      </div>
    </div>
  )
}

function PropertyProfileTab() {
  const [properties, setProperties] = useState([])
  const [agencies, setAgencies] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(''
  )
  const [showPaused, setShowPaused] = useState(false)
  const [selected, setSelected] = useState(null)
  const [detailData, setDetailData] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showCompForm, setShowCompForm] = useState(false)
  const [showJobHistory, setShowJobHistory] = useState(false)
  const [showIssueHistory, setShowIssueHistory] = useState(false)
  const [editSection, setEditSection] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [editInventory, setEditInventory] = useState([])
  const [editAmenities, setEditAmenities] = useState([])
  const [showKB, setShowKB] = useState(true)
  const [showInv, setShowInv] = useState(false)
  const [showCompSection, setShowCompSection] = useState(false)
  const [invSort, setInvSort] = useState('default')
  const [editKB, setEditKB] = useState({})
  const [saving, setSaving] = useState(false)
  const [savingComp, setSavingComp] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null)
  const [compForm, setCompForm] = useState({ document_type: '', issue_date: '', expiry_date: '', file: null })
  const docTypes = ['Gas Safety Record (CP12)', 'EICR', 'EPC', 'Public Liability Insurance', 'Fire Risk Assessment']

  useEffect(() => {
    Promise.all([supabase.from('Properties').select('*'), supabase.from('agencies').select('*')]).then(([p, a]) => {
      setProperties(p.data || []); setAgencies(a.data || []); setLoading(false)
    })
  }, [])

  async function openProperty(p) {
    setSelected(p); setShowJobHistory(false); setShowIssueHistory(false); setEditSection(null); setDetailLoading(true)
    const [issRes, restRes, compRes, jobRes] = await Promise.all([
      supabase.from('issues').select('*').eq('property_id', p.id),
      supabase.from('restock').select('*').eq('property_id', p.id),
      supabase.from('compliance_documents').select('*').eq('property_id', p.id),
      supabase.from('jobs').select('*').eq('property_id', p.id).order('created_at', { ascending: false }).limit(10),
    ])
    const issues = issRes.data || [], restock = restRes.data || [], comp = compRes.data || [], jobs = jobRes.data || []
    setDetailData({ issues, restock, comp, jobs, calculatedStatus: calculateReadiness(issues, restock, comp, jobs) })
    setDetailLoading(false)
  }

  async function saveCompDocument() {
    if (!required(compForm.document_type)) return alert('Please select a document type.')
    setSavingComp(true)
    let fileUrl = null
    if (compForm.file) fileUrl = await uploadFile(compForm.file, 'compliance')
    await supabase.from('compliance_documents').insert({ document_type: compForm.document_type, property_id: selected.id, issue_date: compForm.issue_date || null, expiry_date: compForm.expiry_date || null, document_url: fileUrl })
    const { data } = await supabase.from('compliance_documents').select('*').eq('property_id', selected.id)
    setDetailData(prev => ({ ...prev, comp: data || [] }))
    setCompForm({ document_type: '', issue_date: '', expiry_date: '', file: null }); setShowCompForm(false); setSavingComp(false)
  }

  async function savePropertyEdits() {
    setSaving(true)
    let kbUrl = selected.knowledge_base_url
    if (editForm.knowledge_base_file) kbUrl = await uploadFile(editForm.knowledge_base_file, 'knowledge-base')
    const { data } = await supabase.from('Properties').update({ name: editForm.name, address: editForm.address, bedroom: parseInt(editForm.bedroom) || selected.bedroom, bathrooms: editForm.bathrooms ? parseInt(editForm.bathrooms) : null, next_checkin: editForm.next_checkin || null, knowledge_base_url: kbUrl }).eq('id', selected.id).select().single()
    setSelected(data); setProperties(prev => prev.map(p => p.id === selected.id ? data : p)); setEditSection(null); setSaving(false)
  }

  async function saveAmenities() {
    setSaving(true)
    const { data } = await supabase.from('Properties').update({ amenities: JSON.stringify(editAmenities) }).eq('id', selected.id).select().single()
    setSelected(data); setProperties(prev => prev.map(p => p.id === selected.id ? data : p)); setEditSection(null); setSaving(false)
  }

  async function saveKBEdits() {
    setSaving(true)
    const { data } = await supabase.from('Properties').update({ knowledge_base: JSON.stringify(editKB) }).eq('id', selected.id).select().single()
    setSelected(data); setProperties(prev => prev.map(p => p.id === selected.id ? data : p)); setEditSection(null); setSaving(false)
  }

  async function saveInventoryEdits() {
    setSaving(true)
    await Promise.all(editInventory.map(item => { const cur = parseInt(item.current_quantity) || 0; const min = parseInt(item.minimum_quantity) || 0; return supabase.from('restock').update({ current_quantity: cur, minimum_quantity: min, needs_restock: cur < min }).eq('id', item.id) }))
    const { data } = await supabase.from('restock').select('*').eq('property_id', selected.id)
    setDetailData(prev => ({ ...prev, restock: data || [] })); setEditSection(null); setSaving(false)
  }

  async function applyAction() {
    if (!confirmAction) return; setSaving(true)
    const update = confirmAction.type === 'pause' ? { property_status: 'paused', pause_reason: confirmAction.reason } : { property_status: 'deleted', delete_reason: confirmAction.reason }
    await supabase.from('Properties').update(update).eq('id', selected.id)
    setProperties(prev => prev.map(p => p.id === selected.id ? { ...p, ...update } : p))
    setSelected(null); setDetailData(null); setConfirmAction(null); setSaving(false)
  }

  async function restoreProperty(p) {
    await supabase.from('Properties').update({ property_status: 'active', pause_reason: null }).eq('id', p.id)
    setProperties(prev => prev.map(prop => prop.id === p.id ? { ...prop, property_status: 'active', pause_reason: null } : prop))
  }

  function handleNewProperty(newProp) {
    if (newProp) setProperties(prev => [...prev, newProp])
    setShowAddForm(false)
  }

  const activeProps = properties.filter(p => (!p.property_status || p.property_status === 'active') && (p.name?.toLowerCase().includes(search.toLowerCase()) || p.address?.toLowerCase().includes(search.toLowerCase())))
  const inactiveProps = properties.filter(p => p.property_status === 'paused' || p.property_status === 'deleted')



  if (selected) {
    if (detailLoading) return <div><button onClick={() => setSelected(null)} style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', marginBottom: 16, color: '#555' }}>← Back</button><div className="empty-state">Loading...</div></div>
    const { issues, restock, comp, jobs, calculatedStatus } = detailData
    const openIssues = issues.filter(i => i.status !== 'Closed' && i.status !== 'Fixed')
    const lastJob = jobs[0]
    const enrichedComp = comp.map(d => ({ ...d, computed_status: computeDocStatus(d) }))
    const expiredDocs = enrichedComp.filter(d => d.computed_status === 'Expired')
    const dueSoonDocs = enrichedComp.filter(d => d.computed_status === 'Due Soon')
    const amenities = (() => { try { const raw = selected.amenities; if (!raw) return []; if (Array.isArray(raw)) return raw; return JSON.parse(raw) } catch { return [] } })()
    const kb = (() => { try { const raw = selected.knowledge_base; if (!raw) return {}; if (typeof raw === 'object') return raw; return JSON.parse(raw) } catch { return {} } })()

    return (
      <div>
        <button onClick={() => { setSelected(null); setDetailData(null); setEditSection(null) }} style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', color: '#555', marginBottom: 16 }}>← Back to properties</button>

        {enrichedComp.length === 0 && <div style={{ background: '#fff8ed', border: '0.5px solid #fed7aa', borderRadius: 10, padding: '12px 16px', marginBottom: 12, display: 'flex', alignItems: 'flex-start', gap: 10 }}><span style={{ fontSize: 18 }}>⚠️</span><div><div style={{ fontWeight: 600, fontSize: 14, color: '#92400e', marginBottom: 2 }}>No compliance documents added</div><div style={{ fontSize: 13, color: '#b45309' }}>Gas Safety, EICR, EPC, Insurance, or Fire Risk Assessment are missing.</div></div></div>}

        {/* Header */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 4 }}>{selected.name}</div>
              <div style={{ fontSize: 14, color: '#888', marginBottom: 8 }}>{selected.address}</div>
              <div style={{ fontSize: 13, color: '#aaa' }}>{selected.bedroom} bed{selected.bathrooms ? ` · ${selected.bathrooms} bath` : ''}{selected.max_guests ? ` · ${selected.max_guests} guests max` : ''}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}><StatusBadge status={calculatedStatus} /><span style={{ fontSize: 11, color: '#aaa' }}>Auto-calculated</span></div>
          </div>
        </div>

        {/* Readiness breakdown */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 12 }}>Readiness Breakdown</div>
          {[{ label: 'Cleaning', badge: !lastJob ? 'badge-notready' : lastJob.status === 'Complete' ? 'badge-ready' : 'badge-atrisk', text: !lastJob ? 'No job recorded' : lastJob.status }, { label: 'Open issues', badge: openIssues.some(i => i.severity === 'Critical') ? 'badge-notready' : openIssues.some(i => i.severity === 'High') ? 'badge-atrisk' : openIssues.length > 0 ? 'badge-duesoon' : 'badge-ready', text: openIssues.length > 0 ? `${openIssues.length} open` : 'All clear' }, { label: 'Inventory', badge: restock.some(r => r.needs_restock) ? 'badge-atrisk' : 'badge-ready', text: restock.some(r => r.needs_restock) ? `${restock.filter(r => r.needs_restock).length} need restock` : 'All stocked' }, { label: 'Compliance', badge: expiredDocs.length > 0 ? 'badge-notready' : dueSoonDocs.length > 0 ? 'badge-atrisk' : 'badge-ready', text: expiredDocs.length > 0 ? `${expiredDocs.length} expired` : dueSoonDocs.length > 0 ? `${dueSoonDocs.length} due soon` : 'All valid' }].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}><span style={{ fontSize: 13 }}>{row.label}</span><span className={`badge ${row.badge}`}>{row.text}</span></div>
          ))}
        </div>

                {/* Property details & features */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 600 }}>Property details & features</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { if (editSection === 'details') { setEditSection(null) } else { setEditSection('details'); setEditForm({ name: selected.name, address: selected.address, bedroom: selected.bedroom, bathrooms: selected.bathrooms || '', next_checkin: selected.next_checkin ? selected.next_checkin.slice(0, 16) : '' }) } }} style={{ fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>{editSection === 'details' ? 'Done' : 'Edit details'}</button>
              <button onClick={() => { if (editSection === 'amenities') { setEditSection(null) } else { setEditSection('amenities'); setEditAmenities([...amenities]) } }} style={{ fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>{editSection === 'amenities' ? 'Done' : 'Edit features'}</button>
            </div>
          </div>

          {editSection === 'details' ? (
            <div style={{ marginBottom: 16 }}>
              <div className="form-group"><label className="label">Property name</label><input className="input-field" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /></div>
              <div className="form-group"><label className="label">Address</label><input className="input-field" value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} /></div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div className="form-group" style={{ flex: 1 }}><label className="label">Bedrooms</label><input className="input-field" type="number" min="1" value={editForm.bedroom} onChange={e => setEditForm({ ...editForm, bedroom: e.target.value })} /></div>
                <div className="form-group" style={{ flex: 1 }}><label className="label">Bathrooms</label><input className="input-field" type="number" min="0" value={editForm.bathrooms} onChange={e => setEditForm({ ...editForm, bathrooms: e.target.value })} /></div>
              </div>
              <div className="form-group"><label className="label">Next check-in</label><input className="input-field" type="datetime-local" value={editForm.next_checkin} onChange={e => setEditForm({ ...editForm, next_checkin: e.target.value })} /></div>
              <button className="btn-primary" onClick={savePropertyEdits} disabled={saving}>{saving ? 'Saving...' : 'Save details'}</button>
            </div>
          ) : (
            <div style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid #f0f0f0' }}>
              <div style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>
                {selected.bedroom} bedroom{selected.bedroom !== 1 ? 's' : ''}{selected.bathrooms ? ` · ${selected.bathrooms} bathroom${selected.bathrooms !== 1 ? 's' : ''}` : ''}{selected.max_guests ? ` · ${selected.max_guests} guests max` : ''}
              </div>
              <div style={{ fontSize: 13, color: '#888' }}>Check-in: {selected.next_checkin ? new Date(selected.next_checkin).toLocaleString('en-GB') : 'Not set'}</div>
            </div>
          )}

          {editSection === 'amenities' ? (
            <div>
              <div style={{ fontSize: 13, color: '#888', marginBottom: 10 }}>Tap to select or deselect</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
                {AMENITY_OPTIONS.map(a => (
                  <div key={a.key} onClick={() => setEditAmenities(prev => prev.includes(a.key) ? prev.filter(x => x !== a.key) : [...prev, a.key])} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 6px', borderRadius: 8, cursor: 'pointer', textAlign: 'center', border: editAmenities.includes(a.key) ? '1.5px solid #0a0a0a' : '0.5px solid #e0e0e0', background: editAmenities.includes(a.key) ? '#f0f0f0' : '#fafafa', fontSize: 11, color: editAmenities.includes(a.key) ? '#0a0a0a' : '#888' }}>
                    <i className={`ti ${a.icon}`} style={{ fontSize: 18 }} aria-hidden="true" />
                    {a.key}
                  </div>
                ))}
              </div>
              <button className="btn-primary" onClick={saveAmenities} disabled={saving}>{saving ? 'Saving...' : 'Save features'}</button>
            </div>
          ) : amenities.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {AMENITY_OPTIONS.filter(a => amenities.includes(a.key)).map(a => (
                <div key={a.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 6px', borderRadius: 8, textAlign: 'center', border: '1px solid #e0e0e0', background: '#f7f7f7', fontSize: 11, color: '#444', fontWeight: 500 }}>
                  <i className={`ti ${a.icon}`} style={{ fontSize: 18 }} aria-hidden="true" />
                  {a.key}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: '#aaa' }}>No features added. Click Edit features to add.</div>
          )}
        </div>

{/* Knowledge base */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showKB ? 12 : 0 }}>
            <div onClick={() => setShowKB(!showKB)} style={{ fontWeight: 600, cursor: 'pointer' }}>Knowledge Base</div>
            {!showKB && <span onClick={() => setShowKB(true)} style={{ fontSize: 12, color: '#aaa', cursor: 'pointer' }}>▼</span>}
            {showKB && <button onClick={() => { if (editSection === 'kb') { setEditSection(null) } else { setEditSection('kb'); setEditKB({ ...kb }) } }} style={{ fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>{editSection === 'kb' ? 'Cancel' : 'Edit'}</button>}
          </div>
          {!showKB && null}
          {showKB && <div>
          {editSection === 'kb' ? (
            <div>
              {KB_SECTIONS.map(section => <KBSection key={section.key} section={section} data={editKB} editMode={true} onChange={(key, val) => setEditKB(prev => ({ ...prev, [key]: val }))} />)}
              <button className="btn-primary" onClick={saveKBEdits} disabled={saving} style={{ marginTop: 12 }}>{saving ? 'Saving...' : 'Save knowledge base'}</button>
            </div>
          ) : (
            <div>
              {KB_SECTIONS.map(section => <KBSection key={section.key} section={section} data={kb} editMode={false} onChange={() => {}} />)}
              {selected.knowledge_base_url && <div style={{ marginTop: 10 }}><a href={selected.knowledge_base_url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#2563eb', fontWeight: 500 }}>📄 View knowledge base PDF →</a></div>}
            </div>
          )}
          </div>}
        </div>

        {/* Cleaning history */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div onClick={() => setShowJobHistory(!showJobHistory)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
            <div style={{ fontWeight: 600 }}>Cleaning History ({jobs.length})</div>
            <span style={{ fontSize: 12, color: '#aaa' }}>{showJobHistory ? '▲' : '▼'}</span>
          </div>
          {showJobHistory && <div style={{ marginTop: 12 }}>
            {lastJob ? <div><div style={{ fontSize: 12, color: '#aaa', marginBottom: 4 }}>Latest</div><div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span className={`badge ${lastJob.status === 'Complete' ? 'badge-ready' : lastJob.status === 'In progress' ? 'badge-atrisk' : 'badge-notready'}`}>{lastJob.status}</span><span style={{ fontSize: 13, color: '#888' }}>{new Date(lastJob.job_date).toLocaleDateString('en-GB')} · {lastJob.readiness_percent || 0}%</span></div></div> : <div style={{ fontSize: 13, color: '#aaa' }}>No jobs yet.</div>}
            {jobs.length > 1 && jobs.map(job => <div key={job.id} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0', marginTop: 8 }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 13 }}>{new Date(job.job_date).toLocaleDateString('en-GB')}</span><span className={`badge ${job.status === 'Complete' ? 'badge-ready' : 'badge-atrisk'}`}>{job.status}</span></div></div>)}
          </div>}
        </div>

        {/* Issues */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div onClick={() => setShowIssueHistory(!showIssueHistory)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
            <div style={{ fontWeight: 600 }}>Issues ({issues.length} total · {openIssues.length} open)</div>
            <span style={{ fontSize: 12, color: '#aaa' }}>{showIssueHistory ? '▲' : '▼'}</span>
          </div>
          {showIssueHistory && <div style={{ marginTop: 12 }}>
            {openIssues.length === 0 && <div style={{ fontSize: 13, color: '#16a34a', marginBottom: 8 }}>No open issues.</div>}
            {openIssues.map(issue => <div key={issue.id} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}><div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}><SeverityBadge s={issue.severity} /><span style={{ fontSize: 13, fontWeight: 500 }}>{issue.category}</span></div><div style={{ fontSize: 13, color: '#555' }}>{issue.description}</div></div>)}
            {issues.filter(i => i.status === 'Closed' || i.status === 'Fixed').length > 0 && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #f0f0f0' }}>
                <div style={{ fontSize: 12, color: '#aaa', marginBottom: 6 }}>Closed issues</div>
                {issues.filter(i => i.status === 'Closed' || i.status === 'Fixed').map(issue => <div key={issue.id} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><div style={{ display: 'flex', gap: 6 }}><SeverityBadge s={issue.severity} /><span style={{ fontSize: 13 }}>{issue.category}</span></div><span className="badge badge-ready">{issue.status}</span></div><div style={{ fontSize: 13, color: '#888' }}>{issue.description}</div></div>)}
              </div>
            )}
          </div>}
        </div>

                {/* Inventory */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div onClick={() => { setShowInv(!showInv); if (editSection === 'inventory') setEditSection(null) }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
            <div style={{ fontWeight: 600 }}>Inventory ({restock.length})</div>
            <span style={{ fontSize: 13, color: '#aaa' }}>{showInv ? '▲' : '▼'}</span>
          </div>
          {showInv && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[{ k: 'default', l: 'Default' }, { k: 'restock_first', l: 'Restock' }, { k: 'enough_first', l: 'Enough' }, { k: 'extra_first', l: 'Extra' }].map(s => (
                    <button key={s.k} onClick={() => setInvSort(s.k)} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500, cursor: 'pointer', border: '0.5px solid #e0e0e0', background: invSort === s.k ? '#0a0a0a' : '#f7f7f7', color: invSort === s.k ? '#fff' : '#666' }}>{s.l}</button>
                  ))}
                </div>
                <button onClick={() => { if (editSection === 'inventory') { setEditSection(null) } else { setEditSection('inventory'); setEditInventory(restock.map(i => ({ ...i }))) } }} style={{ fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>{editSection === 'inventory' ? 'Cancel' : 'Edit'}</button>
              </div>
              {restock.length === 0 && <div style={{ fontSize: 13, color: '#aaa' }}>No inventory items.</div>}
              {editSection === 'inventory' ? (
                <div>
                  {editInventory.map((item, idx) => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                      <span style={{ flex: 1, fontSize: 13 }}>{item.item_name}</span>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: '#aaa' }}>Min</span>
                        <input type="number" min="0" style={{ width: 52, padding: '4px 6px', border: '1px solid #e0e0e0', borderRadius: 6, fontSize: 13, textAlign: 'center' }} value={item.minimum_quantity} onChange={e => setEditInventory(prev => prev.map((it, i) => i === idx ? { ...it, minimum_quantity: e.target.value } : it))} />
                        <span style={{ fontSize: 12, color: '#aaa' }}>Cur</span>
                        <input type="number" min="0" style={{ width: 52, padding: '4px 6px', border: '1px solid #e0e0e0', borderRadius: 6, fontSize: 13, textAlign: 'center' }} value={item.current_quantity} onChange={e => setEditInventory(prev => prev.map((it, i) => i === idx ? { ...it, current_quantity: e.target.value } : it))} />
                      </div>
                    </div>
                  ))}
                  <button className="btn-primary" onClick={saveInventoryEdits} disabled={saving} style={{ marginTop: 12 }}>{saving ? 'Saving...' : 'Save inventory'}</button>
                </div>
              ) : (
                restock.filter(item => {
                  const isExtra = !item.needs_restock && item.current_quantity > item.minimum_quantity
                  if (invSort === 'restock_first') return item.needs_restock
                  if (invSort === 'enough_first') return !item.needs_restock && !isExtra
                  if (invSort === 'extra_first') return isExtra
                  return true
                }).map(item => {
                  const isExtra = !item.needs_restock && item.current_quantity > item.minimum_quantity
                  const status = item.needs_restock ? 'restock' : isExtra ? 'extra' : 'enough'
                  return (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0', background: status === 'restock' ? '#fff8f8' : status === 'extra' ? '#fffbf0' : 'transparent' }}>
                      <span style={{ fontSize: 13 }}>{item.item_name}</span>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: status === 'restock' ? '#dc2626' : status === 'extra' ? '#d97706' : '#16a34a' }}>
                          {item.current_quantity}<span style={{ color: '#aaa', fontWeight: 400 }}>/{item.minimum_quantity}</span>
                        </span>
                        <span className={`badge ${status === 'restock' ? 'badge-notready' : status === 'extra' ? 'badge-atrisk' : 'badge-ready'}`}>
                          {status === 'restock' ? 'Needs restock' : status === 'extra' ? 'Extra' : 'Enough'}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>

        {/* Compliance */}
        <div className="card">
          <div onClick={() => setShowCompSection(!showCompSection)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
            <div style={{ fontWeight: 600 }}>Compliance ({enrichedComp.length})</div>
            <span style={{ fontSize: 12, color: '#aaa' }}>{showCompSection ? '▲' : '▼'}</span>
          </div>
          {showCompSection && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, marginBottom: 12 }}>
              <button onClick={e => { e.stopPropagation(); setShowCompForm(!showCompForm) }} style={{ background: '#0a0a0a', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>{showCompForm ? 'Cancel' : '+ Add document'}</button>
            </div>
          )}
          {showCompSection && <div>
          {showCompForm && (
            <div style={{ background: '#f7f7f7', borderRadius: 8, padding: 14, marginBottom: 14 }}>
              <div className="form-group"><label className="label">Document type *</label><select className="input-field" value={compForm.document_type} onChange={e => setCompForm({ ...compForm, document_type: e.target.value })}><option value="">Select</option>{docTypes.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
              <div className="form-group"><label className="label">Issue date</label><input className="input-field" type="date" value={compForm.issue_date} onChange={e => setCompForm({ ...compForm, issue_date: e.target.value })} /></div>
              <div className="form-group"><label className="label">Expiry date</label><input className="input-field" type="date" value={compForm.expiry_date} onChange={e => setCompForm({ ...compForm, expiry_date: e.target.value })} /></div>
              <div className="form-group"><label className="label">Upload document (PDF or image)</label><input type="file" accept=".pdf,image/*" className="input-field" style={{ padding: '8px' }} onChange={e => setCompForm({ ...compForm, file: e.target.files[0] })} />{compForm.file && <div style={{ fontSize: 12, color: '#16a34a', marginTop: 4 }}>✓ {compForm.file.name}</div>}</div>
              <button className="btn-primary" onClick={saveCompDocument} disabled={savingComp || !compForm.document_type}>{savingComp ? 'Saving...' : 'Save document'}</button>
            </div>
          )}
          {enrichedComp.length === 0 && <div style={{ fontSize: 13, color: '#aaa' }}>No documents yet.</div>}
          {['Expired', 'Due Soon', 'Valid'].map(status => {
            const docs = enrichedComp.filter(d => d.computed_status === status)
            if (!docs.length) return null
            return <div key={status} style={{ marginBottom: 12 }}><div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}><CompBadge status={status} /><span style={{ fontSize: 12, color: '#888' }}>{docs.length}</span></div>{docs.map(doc => <div key={doc.id} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 13, fontWeight: 500 }}>{doc.document_type}</span><span style={{ fontSize: 12, color: '#888' }}>{doc.expiry_date ? new Date(doc.expiry_date).toLocaleDateString('en-GB') : 'No date'}</span></div>{doc.document_url && <a href={doc.document_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#2563eb' }}>View →</a>}</div>)}</div>
          })}
          </div>}
        </div>
      </div>
    )
  }

  if (loading) return <div className="empty-state">Loading...</div>

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <input className="input-field" placeholder="Search properties..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1 }} />
        <button onClick={() => setShowAddForm(!showAddForm)} className="btn-primary" style={{ width: 'auto', padding: '8px 16px', whiteSpace: 'nowrap' }}>{showAddForm ? 'Cancel' : '+ Add property'}</button>
      </div>

      {showPaused ? (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 14 }}>Paused and deleted ({inactiveProps.length})</div>
          {!inactiveProps.length && <div className="empty-state">None.</div>}
          {inactiveProps.map(p => (
            <div key={p.id} className="card" style={{ marginBottom: 8, opacity: 0.8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div><div style={{ fontWeight: 600, marginBottom: 4 }}>{p.name}</div><div style={{ fontSize: 13, color: '#888', marginBottom: 4 }}>{p.address}</div><div style={{ fontSize: 12, color: '#aaa' }}>{p.property_status === 'paused' ? `Paused: ${p.pause_reason}` : `Deleted: ${p.delete_reason}`}</div></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                  <span className={`badge ${p.property_status === 'paused' ? 'badge-atrisk' : 'badge-notready'}`}>{p.property_status}</span>
                  {p.property_status === 'paused' && <button onClick={() => restoreProperty(p)} style={{ fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}>Restore</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {showAddForm && <AddPropertyStepper onSave={handleNewProperty} onCancel={() => setShowAddForm(false)} agencies={agencies} />}
          {!activeProps.length && <div className="empty-state">No properties found.</div>}
          <div style={{ display: 'grid', gap: 12 }}>
            {activeProps.map(p => (
              <div key={p.id} className="card" style={{ cursor: 'pointer' }} onClick={() => openProperty(p)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{p.name}</div>
                    <div style={{ fontSize: 13, color: '#888', marginBottom: 6 }}>{p.address}</div>
                    <div style={{ fontSize: 12, color: '#aaa' }}>{p.bedroom} bed{p.bathrooms ? ` · ${p.bathrooms} bath` : ''}{p.max_guests ? ` · ${p.max_guests} guests` : ''} · Check-in: {p.next_checkin ? new Date(p.next_checkin).toLocaleDateString('en-GB') : 'Not set'}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}><StatusBadge status={p.readiness_status} /><span style={{ fontSize: 12, color: '#aaa' }}>Tap to view →</span></div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── VENDOR DIRECTORY ─────────────────────────────────────────────────
const ALL_TRADES = ['Plumber', 'Electrician', 'Handyman', 'Laundry', 'Cleaner', 'Painter', 'Gardener', 'Locksmith', 'Glazier', 'Other']

function parseTrades(val) {
  if (!val) return []
  let arr = []
  if (Array.isArray(val)) arr = val
  else { try { arr = JSON.parse(val) } catch { arr = val ? [val] : [] } }
  return [...new Set(arr.filter(Boolean))]
}

function VendorDirectoryTab() {
  const [vendors, setVendors] = useState([])
  const [cleaners, setCleaners] = useState([])
  const [agencies, setAgencies] = useState([])
  const [loading, setLoading] = useState(true)
  const [tradeFilter, setTradeFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [selectedType, setSelectedType] = useState(null)
  const [history, setHistory] = useState([])
  const [agencyPeople, setAgencyPeople] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [showPersonForm, setShowPersonForm] = useState(false)
  const [showAgencyForm, setShowAgencyForm] = useState(false)
  const [showBlocked, setShowBlocked] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [personForm, setPersonForm] = useState({ name: '', phone: '', email: '', role: 'vendor', trades: [], agency_id: '' })
  const [agencyForm, setAgencyForm] = useState({ name: '', contact_no: '', email: '', address: '', trades: [], website: '', details: '' })

  const tradeColors = { Plumber: '#dbeafe', Electrician: '#fef9c3', Handyman: '#dcfce7', Laundry: '#f3e8ff', Cleaner: '#e0f2fe', Other: '#f3f4f6', Painter: '#fce7f3', Gardener: '#d1fae5', Locksmith: '#e0e7ff', Glazier: '#fff7ed' }
  const tradeText = { Plumber: '#1e40af', Electrician: '#854d0e', Handyman: '#166534', Laundry: '#6b21a8', Cleaner: '#0369a1', Other: '#374151', Painter: '#9d174d', Gardener: '#065f46', Locksmith: '#3730a3', Glazier: '#92400e' }

  useEffect(() => {
    Promise.all([
      supabase.from('Vendors').select('*'),
      supabase.from('Cleaners').select('*'),
      supabase.from('agencies').select('*'),
    ]).then(([v, c, a]) => {
      setVendors(v.data || [])
      setCleaners(c.data || [])
      setAgencies(a.data || [])
      setLoading(false)
    })
  }, [])

  function personMatchesTrade(p) {
    if (tradeFilter === 'all') return true
    const pt = parseTrades(p.trades)
    if (p.trade && !pt.includes(p.trade)) pt.push(p.trade)
    return pt.includes(tradeFilter)
  }

  function agencyMatchesTrade(a) {
    if (tradeFilter === 'all') return true
    const at = parseTrades(a.trades)
    const agVendors = vendors.filter(v => v.agency_name === a.name)
    const agCleaners = cleaners.filter(c => c.agency_name === a.name)
    const allTrades = [...at, ...agVendors.flatMap(v => [...parseTrades(v.trades), v.trade].filter(Boolean)), ...agCleaners.flatMap(c => parseTrades(c.trades))]
    return allTrades.includes(tradeFilter)
  }

  async function openVendor(v) {
    setSelected(v); setSelectedType('vendor'); setEditMode(false); setHistoryLoading(true)
    const { data } = await supabase.from('issues').select('*').eq('vendor_id', v.id).order('created_at', { ascending: false })
    setHistory(data || []); setHistoryLoading(false)
  }

  async function openCleaner(c) {
    setSelected(c); setSelectedType('cleaner'); setEditMode(false); setHistoryLoading(true)
    const { data } = await supabase.from('jobs').select('*').eq('cleaner_id', c.id).order('created_at', { ascending: false })
    setHistory(data || []); setHistoryLoading(false)
  }

  async function openAgency(a) {
    setSelected(a); setSelectedType('agency'); setHistoryLoading(true)
    const agVendors = vendors.filter(v => v.agency_name === a.name)
    const agCleaners = cleaners.filter(c => c.agency_name === a.name)
    const vResults = await Promise.all(agVendors.map(async v => {
      const { data } = await supabase.from('issues').select('id').eq('vendor_id', v.id).limit(1)
      return { ...v, type: 'vendor', hasHistory: (data||[]).length > 0 }
    }))
    const cResults = await Promise.all(agCleaners.map(async c => {
      const { data } = await supabase.from('jobs').select('id').eq('cleaner_id', c.id).limit(1)
      return { ...c, type: 'cleaner', hasHistory: (data||[]).length > 0 }
    }))
    setAgencyPeople([...vResults, ...cResults].filter(p => p.hasHistory))
    setHistoryLoading(false)
  }

  async function toggleBlock(person, type) {
    const table = type === 'vendor' ? 'Vendors' : 'Cleaners'
    const newVal = !person.is_blocked
    await supabase.from(table).update({ is_blocked: newVal }).eq('id', person.id)
    const update = { ...person, is_blocked: newVal }
    setSelected(update)
    if (type === 'vendor') setVendors(prev => prev.map(v => v.id === person.id ? update : v))
    else setCleaners(prev => prev.map(c => c.id === person.id ? update : c))
  }

  async function saveEdit() {
    if (!selected || !selectedType) return
    setSaving(true)
    const table = selectedType === 'vendor' ? 'Vendors' : 'Cleaners'
    const pt = editForm.trades || []
    const baseUpdate = {
      name: editForm.name || selected.name,
      phone: editForm.phone || selected.phone,
      email: editForm.email || selected.email,
      trades: pt,
      agency_name: editForm.agency_name || 'No agency'
    }
    // Vendors table has 'trade' column, Cleaners does not
    const updateData = table === 'Vendors' ? { ...baseUpdate, trade: pt[0] || '' } : baseUpdate
    const { data, error } = await supabase.from(table).update(updateData).eq('id', selected.id).select().single()
    if (error) {
      alert('Save failed: ' + error.message)
      setSaving(false)
      return
    }
    setSelected(data)
    if (selectedType === 'vendor') setVendors(prev => prev.map(v => v.id === selected.id ? data : v))
    else setCleaners(prev => prev.map(c => c.id === selected.id ? data : c))
    setEditMode(false)
    setSaving(false)
  }

  function validatePerson() {
    const e = {}
    if (!required(personForm.name)) e.name = 'Name is required'
    if (!required(personForm.phone)) e.phone = 'Phone is required'
    else if (!validatePhone(personForm.phone)) e.phone = 'Invalid phone'
    if (personForm.email && !validateEmail(personForm.email)) e.email = 'Invalid email'
    if (!personForm.trades.length) e.trades = 'Select at least one trade'
    setErrors(e); return Object.keys(e).length === 0
  }

  function validateAgency() {
    const e = {}
    if (!required(agencyForm.name)) e.name = 'Agency name is required'
    if (agencyForm.email && !validateEmail(agencyForm.email)) e.email = 'Invalid email'
    setErrors(e); return Object.keys(e).length === 0
  }

  async function savePerson() {
    if (!validatePerson()) return; setSaving(true)
    const agencyName = personForm.agency_id ? agencies.find(a => String(a.id) === String(personForm.agency_id))?.name || 'No agency' : 'No agency'
    const isCleaner = personForm.trades.includes('Cleaner')
    if (isCleaner) {
      const { data } = await supabase.from('Cleaners').insert({ name: personForm.name, phone: personForm.phone, email: personForm.email, agency_name: agencyName, trades: personForm.trades }).select()
      setCleaners(prev => [...prev, ...(data || [])])
    } else {
      const { data } = await supabase.from('Vendors').insert({ name: personForm.name, phone: personForm.phone, email: personForm.email, trade: personForm.trades[0] || '', trades: personForm.trades, agency_name: agencyName }).select()
      setVendors(prev => [...prev, ...(data || [])])
    }
    setPersonForm({ name: '', phone: '', email: '', role: 'vendor', trades: [], agency_id: '' })
    setShowPersonForm(false); setErrors({}); setSaving(false)
  }

  async function saveAgency() {
    if (!validateAgency()) return; setSaving(true)
    const { data } = await supabase.from('agencies').insert({ name: agencyForm.name, contact_no: agencyForm.contact_no, email: agencyForm.email, address: agencyForm.address, trades: agencyForm.trades, website: agencyForm.website || null, details: agencyForm.details || null }).select()
    setAgencies(prev => [...prev, ...(data || [])])
    setAgencyForm({ name: '', contact_no: '', email: '', address: '', trades: [], website: '', details: '' })
    setShowAgencyForm(false); setErrors({}); setSaving(false)
  }

  if (loading) return <div className="empty-state">Loading...</div>

  // ── DETAIL: VENDOR / CLEANER ──────────────────────────────────────
  if (selected && (selectedType === 'vendor' || selectedType === 'cleaner')) {
    const pt = parseTrades(selected.trades)
    if (selected.trade && !pt.includes(selected.trade)) pt.push(selected.trade)
    return (
      <div>
        <button onClick={() => { setSelected(null); setSelectedType(null); setEditMode(false) }} style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', marginBottom: 16, color: '#555' }}>← Back</button>
        <div className="card" style={{ marginBottom: 16 }}>
          {selected.is_blocked && <span className="badge badge-notready" style={{ marginBottom: 8, display: 'inline-block' }}>Blocked</span>}
          {editMode ? (
            <div>
              <div className="form-group"><label className="label">Name</label><input className="input-field" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /></div>
              <div className="form-group"><label className="label">Phone</label><input className="input-field" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} /></div>
              <div className="form-group"><label className="label">Email</label><input className="input-field" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} /></div>
              <div className="form-group">
                <label className="label">Trades</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  {ALL_TRADES.map(t => (
                    <label key={t} style={{ display: 'flex', alignItems: 'center', padding: '6px 12px', borderRadius: 20, border: `0.5px solid ${(editForm.trades||[]).includes(t) ? '#0a0a0a' : '#e0e0e0'}`, background: (editForm.trades||[]).includes(t) ? '#f0f0f0' : '#fafafa', cursor: 'pointer', fontSize: 12, fontWeight: 500, userSelect: 'none' }}>
                      <input type="checkbox" checked={(editForm.trades||[]).includes(t)} onChange={() => setEditForm(prev => ({ ...prev, trades: (prev.trades||[]).includes(t) ? prev.trades.filter(x => x !== t) : [...(prev.trades||[]), t] }))} style={{ display: 'none' }} />
                      {(editForm.trades||[]).includes(t) ? '✓ ' : ''}{t}
                    </label>
                  ))}
                </div>
              </div>
              <div className="form-group"><label className="label">Agency</label><select className="input-field" value={editForm.agency_name} onChange={e => setEditForm({ ...editForm, agency_name: e.target.value })}><option value="No agency">No agency</option>{agencies.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}</select></div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setEditMode(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button onClick={saveEdit} className="btn-primary" disabled={saving} style={{ flex: 1 }}>{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{selected.name}</div>
                <span style={{ fontSize: 11, background: selectedType === 'cleaner' ? '#e0f2fe' : '#f0f0f0', color: selectedType === 'cleaner' ? '#0369a1' : '#555', padding: '3px 10px', borderRadius: 20, fontWeight: 500 }}>{selectedType === 'cleaner' ? 'Cleaner' : 'Vendor'}</span>
              </div>
              {pt.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>{pt.map(t => <span key={t} style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: tradeColors[t] || tradeColors.Other, color: tradeText[t] || tradeText.Other }}>{t}</span>)}</div>}
              <div style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>{selected.phone}</div>
              <div style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>{selected.email}</div>
              <div style={{ fontSize: 13, color: '#aaa', marginBottom: 14 }}>{selected.agency_name && selected.agency_name !== 'No agency' ? `Agency: ${selected.agency_name}` : 'No agency'}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setEditMode(true); setEditForm({ name: selected.name, phone: selected.phone, email: selected.email, trades: pt, agency_name: selected.agency_name || 'No agency' }) }} className="btn-secondary" style={{ flex: 1 }}>Edit</button>
                <button onClick={() => toggleBlock(selected, selectedType)} style={{ flex: 1, padding: '10px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', background: selected.is_blocked ? '#dcfce7' : '#fee2e2', color: selected.is_blocked ? '#166534' : '#991b1b', border: 'none' }}>{selected.is_blocked ? 'Unblock' : 'Block'}</button>
              </div>
            </div>
          )}
        </div>
        {/* Access section — only for cleaners */}
        {selectedType === 'cleaner' && (
          <CleanerAccessSection cleaner={selected} onUpdate={updatedCleaner => {
            setSelected(updatedCleaner)
            setCleaners(prev => prev.map(c => c.id === updatedCleaner.id ? updatedCleaner : c))
          }} />
        )}

        <div style={{ fontWeight: 600, marginBottom: 12 }}>{selectedType === 'vendor' ? 'Issue history' : 'Job history'} ({history.length})</div>
        {historyLoading && <div className="empty-state">Loading...</div>}
        {!historyLoading && !history.length && <div className="empty-state">No history yet.</div>}
        {!historyLoading && selectedType === 'vendor' && history.map(issue => (
          <div key={issue.id} className="card" style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><div style={{ fontWeight: 600 }}>{issue.category}</div><span className={`badge ${issue.status === 'Closed' ? 'badge-ready' : 'badge-atrisk'}`}>{issue.status}</span></div>
            <div style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>{issue.description}</div>
            <div style={{ display: 'flex', gap: 8 }}><SeverityBadge s={issue.severity} /><span style={{ fontSize: 12, color: '#aaa' }}>{new Date(issue.created_at).toLocaleDateString('en-GB')}</span></div>
          </div>
        ))}
        {!historyLoading && selectedType === 'cleaner' && history.map(job => (
          <div key={job.id} className="card" style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><div style={{ fontWeight: 600 }}>{new Date(job.job_date).toLocaleDateString('en-GB')}</div><span className={`badge ${job.status === 'Complete' ? 'badge-ready' : 'badge-atrisk'}`}>{job.status}</span></div>
            <span style={{ fontSize: 13, color: '#888' }}>{job.readiness_percent || 0}% · {job.completed_tasks || 0}/{job.total_tasks || 0} tasks</span>
          </div>
        ))}
      </div>
    )
  }

  // ── DETAIL: AGENCY ────────────────────────────────────────────────
  if (selected && selectedType === 'agency') {
    const at = parseTrades(selected.trades)
    return (
      <div>
        <button onClick={() => { setSelected(null); setSelectedType(null); setEditMode(false) }} style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', marginBottom: 16, color: '#555' }}>← Back</button>
        <div className="card" style={{ marginBottom: 16 }}>
          {editMode ? (
            <div>
              <div style={{ fontWeight: 600, marginBottom: 14 }}>Edit agency</div>
              <div className="form-group"><label className="label">Agency name</label><input className="input-field" value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /></div>
              <div className="form-group">
                <label className="label">Trades</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  {ALL_TRADES.map(t => (
                    <label key={t} style={{ display: 'flex', alignItems: 'center', padding: '6px 12px', borderRadius: 20, border: `0.5px solid ${(editForm.trades||[]).includes(t) ? '#0a0a0a' : '#e0e0e0'}`, background: (editForm.trades||[]).includes(t) ? '#0a0a0a' : '#fafafa', cursor: 'pointer', fontSize: 12, fontWeight: 500, userSelect: 'none', color: (editForm.trades||[]).includes(t) ? '#fff' : '#555' }}>
                      <input type="checkbox" checked={(editForm.trades||[]).includes(t)} onChange={() => setEditForm(prev => ({ ...prev, trades: (prev.trades||[]).includes(t) ? prev.trades.filter(x => x !== t) : [...(prev.trades||[]), t] }))} style={{ display: 'none' }} />
                      {t}
                    </label>
                  ))}
                </div>
              </div>
              <div className="form-group"><label className="label">Contact number</label><input className="input-field" value={editForm.contact_no || ''} onChange={e => setEditForm({ ...editForm, contact_no: e.target.value })} /></div>
              <div className="form-group"><label className="label">Email</label><input className="input-field" value={editForm.email || ''} onChange={e => setEditForm({ ...editForm, email: e.target.value })} /></div>
              <div className="form-group"><label className="label">Address</label><input className="input-field" value={editForm.address || ''} onChange={e => setEditForm({ ...editForm, address: e.target.value })} /></div>
              <div className="form-group"><label className="label">Website</label><input className="input-field" value={editForm.website || ''} onChange={e => setEditForm({ ...editForm, website: e.target.value })} /></div>
              <div className="form-group"><label className="label">Details</label><textarea className="input-field" rows={3} value={editForm.details || ''} onChange={e => setEditForm({ ...editForm, details: e.target.value })} /></div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setEditMode(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button onClick={async () => { setSaving(true); const { data } = await supabase.from('agencies').update({ name: editForm.name, contact_no: editForm.contact_no, email: editForm.email, address: editForm.address, trades: JSON.stringify(editForm.trades || []), website: editForm.website || null, details: editForm.details || null }).eq('id', selected.id).select().single(); setSelected(data); setAgencies(prev => prev.map(a => a.id === selected.id ? data : a)); setEditMode(false); setSaving(false) }} className="btn-primary" disabled={saving} style={{ flex: 1 }}>{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{selected.name}</div>
                <button onClick={() => { setEditMode(true); setEditForm({ name: selected.name, contact_no: selected.contact_no, email: selected.email, address: selected.address, trades: at, website: selected.website || '', details: selected.details || '' }) }} style={{ fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>Edit</button>
              </div>
              {at.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>{at.map(t => <span key={t} style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: tradeColors[t] || '#f0f0f0', color: tradeText[t] || '#444' }}>{t}</span>)}</div>}
              <div style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>{selected.contact_no}</div>
              <div style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>{selected.email}</div>
              <div style={{ fontSize: 13, color: '#aaa', marginBottom: 2 }}>{selected.address}</div>
              {selected.website && <a href={selected.website} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#2563eb' }}>{selected.website}</a>}
              {selected.details && <div style={{ fontSize: 12, color: '#aaa', marginTop: 6 }}>{selected.details}</div>}
            </div>
          )}
        </div>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>People who have worked from this agency ({agencyPeople.length})</div>
        {historyLoading && <div className="empty-state">Loading...</div>}
        {!historyLoading && !agencyPeople.length && <div className="empty-state">No one from this agency has worked yet.</div>}
        {!historyLoading && agencyPeople.map(person => {
          const pt = parseTrades(person.trades)
          if (person.trade && !pt.includes(person.trade)) pt.push(person.trade)
          return (
            <div key={`${person.type}-${person.id}`} className="card" style={{ marginBottom: 8, cursor: 'pointer' }} onClick={() => person.type === 'vendor' ? openVendor(person) : openCleaner(person)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{person.name}</div>
                  <div style={{ fontSize: 13, color: '#888', marginBottom: 4 }}>{person.phone}</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{pt.map(t => <span key={t} style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: tradeColors[t] || '#f0f0f0', color: tradeText[t] || '#444' }}>{t}</span>)}</div>
                </div>
                <span style={{ fontSize: 11, background: person.type === 'cleaner' ? '#e0f2fe' : '#f0f0f0', color: person.type === 'cleaner' ? '#0369a1' : '#555', padding: '2px 8px', borderRadius: 20, fontWeight: 500 }}>{person.type}</span>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ── LIST VIEW ─────────────────────────────────────────────────────
  const soloVendors = vendors.filter(v => (!v.agency_name || v.agency_name === 'No agency') && (showBlocked ? v.is_blocked : !v.is_blocked) && personMatchesTrade(v))
  const soloCleaners = cleaners.filter(c => (!c.agency_name || c.agency_name === 'No agency') && (showBlocked ? c.is_blocked : !c.is_blocked))
  const filteredAgencies = showBlocked ? [] : agencies.filter(a => agencyMatchesTrade(a))

  return (
    <div>
      {/* Top controls */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <select className="input-field" style={{ maxWidth: 200, padding: '8px 12px', fontSize: 13 }} value={tradeFilter} onChange={e => setTradeFilter(e.target.value)}>
          <option value="all">All trades</option>
          {ALL_TRADES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <button onClick={() => setShowBlocked(!showBlocked)} style={{ padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', background: showBlocked ? '#fee2e2' : '#f0f0f0', color: showBlocked ? '#991b1b' : '#555', border: 'none' }}>{showBlocked ? 'Show active' : 'Blocked'}</button>
          <button onClick={() => { setShowAgencyForm(!showAgencyForm); setShowPersonForm(false); setErrors({}) }} className="btn-secondary" style={{ padding: '8px 14px', fontSize: 13 }}>{showAgencyForm ? 'Cancel' : '+ Add agency'}</button>
          <button onClick={() => { setShowPersonForm(!showPersonForm); setShowAgencyForm(false); setErrors({}) }} className="btn-primary" style={{ width: 'auto', padding: '8px 14px', fontSize: 13 }}>{showPersonForm ? 'Cancel' : '+ Add vendor'}</button>
        </div>
      </div>

      {/* Add vendor/cleaner form */}
      {showPersonForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 16 }}>Add vendor / cleaner</div>

          <div className="form-group"><label className="label">Full name *</label><input className="input-field" placeholder="e.g. Dave Smith" value={personForm.name} onChange={e => setPersonForm({ ...personForm, name: e.target.value })} /><FieldError msg={errors.name} /></div>
          <div className="form-group"><label className="label">Phone *</label><input className="input-field" placeholder="07xxx xxxxxx" value={personForm.phone} onChange={e => setPersonForm({ ...personForm, phone: e.target.value })} /><FieldError msg={errors.phone} /></div>
          <div className="form-group"><label className="label">Email</label><input className="input-field" type="email" placeholder="email@example.com" value={personForm.email} onChange={e => setPersonForm({ ...personForm, email: e.target.value })} /><FieldError msg={errors.email} /></div>
          <div className="form-group">
            <label className="label">Occupation / trades * <span style={{ fontSize: 11, color: '#aaa', fontWeight: 400 }}>Select all that apply</span></label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {ALL_TRADES.map(t => (
                <label key={t} style={{ display: 'flex', alignItems: 'center', padding: '7px 14px', borderRadius: 20, border: `0.5px solid ${personForm.trades.includes(t) ? '#0a0a0a' : '#e0e0e0'}`, background: personForm.trades.includes(t) ? '#0a0a0a' : '#fafafa', cursor: 'pointer', fontSize: 12, fontWeight: 500, userSelect: 'none', color: personForm.trades.includes(t) ? '#fff' : '#555' }}>
                  <input type="checkbox" checked={personForm.trades.includes(t)} onChange={() => setPersonForm(prev => ({ ...prev, trades: prev.trades.includes(t) ? prev.trades.filter(x => x !== t) : [...prev.trades, t] }))} style={{ display: 'none' }} />
                  {t}
                </label>
              ))}
            </div>
            <FieldError msg={errors.trades} />
          </div>
          <div className="form-group"><label className="label">Agency (if any)</label><select className="input-field" value={personForm.agency_id} onChange={e => setPersonForm({ ...personForm, agency_id: e.target.value })}><option value="">No agency</option>{agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
          <button className="btn-primary" onClick={savePerson} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        </div>
      )}

      {/* Add agency form */}
      {showAgencyForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 16 }}>Add agency</div>
          <div className="form-group"><label className="label">Agency name *</label><input className="input-field" placeholder="Agency name" value={agencyForm.name} onChange={e => setAgencyForm({ ...agencyForm, name: e.target.value })} /><FieldError msg={errors.name} /></div>
          <div className="form-group">
            <label className="label">Trades <span style={{ fontSize: 11, color: '#aaa', fontWeight: 400 }}>Select all that apply</span></label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {ALL_TRADES.map(t => (
                <label key={t} style={{ display: 'flex', alignItems: 'center', padding: '7px 14px', borderRadius: 20, border: `0.5px solid ${agencyForm.trades.includes(t) ? '#0a0a0a' : '#e0e0e0'}`, background: agencyForm.trades.includes(t) ? '#0a0a0a' : '#fafafa', cursor: 'pointer', fontSize: 12, fontWeight: 500, userSelect: 'none', color: agencyForm.trades.includes(t) ? '#fff' : '#555' }}>
                  <input type="checkbox" checked={agencyForm.trades.includes(t)} onChange={() => setAgencyForm(prev => ({ ...prev, trades: prev.trades.includes(t) ? prev.trades.filter(x => x !== t) : [...prev.trades, t] }))} style={{ display: 'none' }} />
                  {t}
                </label>
              ))}
            </div>
          </div>
          <div className="form-group"><label className="label">Contact number</label><input className="input-field" placeholder="07xxx xxxxxx" value={agencyForm.contact_no} onChange={e => setAgencyForm({ ...agencyForm, contact_no: e.target.value })} /></div>
          <div className="form-group"><label className="label">Email</label><input className="input-field" type="email" placeholder="email@example.com" value={agencyForm.email} onChange={e => setAgencyForm({ ...agencyForm, email: e.target.value })} /><FieldError msg={errors.email} /></div>
          <div className="form-group"><label className="label">Address</label><input className="input-field" placeholder="Full address" value={agencyForm.address} onChange={e => setAgencyForm({ ...agencyForm, address: e.target.value })} /></div>
          <div className="form-group"><label className="label">Website (optional)</label><input className="input-field" placeholder="https://example.com" value={agencyForm.website} onChange={e => setAgencyForm({ ...agencyForm, website: e.target.value })} /></div>
          <div className="form-group"><label className="label">Details (optional)</label><textarea className="input-field" rows={3} value={agencyForm.details} onChange={e => setAgencyForm({ ...agencyForm, details: e.target.value })} /></div>
          <button className="btn-primary" onClick={saveAgency} disabled={saving}>{saving ? 'Saving...' : 'Save agency'}</button>
        </div>
      )}

      {/* List */}
      <div style={{ display: 'grid', gap: 10 }}>
        {showBlocked ? (
          <>
            {[...vendors.filter(v => v.is_blocked), ...cleaners.filter(c => c.is_blocked)].map(p => {
              const isC = !p.trade && !p.trades ? false : cleaners.find(c => c.id === p.id) !== undefined
              const pt = parseTrades(p.trades); if (p.trade && !pt.includes(p.trade)) pt.push(p.trade)
              return (
                <div key={p.id} className="card" style={{ padding: '14px 16px', cursor: 'pointer', opacity: 0.7 }} onClick={() => isC ? openCleaner(p) : openVendor(p)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div><div style={{ fontWeight: 600, marginBottom: 4 }}>{p.name} <span className="badge badge-notready" style={{ fontSize: 11 }}>Blocked</span></div><div style={{ fontSize: 13, color: '#888' }}>{p.phone}</div></div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 140, justifyContent: 'flex-end' }}>{pt.map(t => <span key={t} style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, background: tradeColors[t] || '#f0f0f0', color: tradeText[t] || '#444' }}>{t}</span>)}</div>
                  </div>
                </div>
              )
            })}
            {!vendors.filter(v => v.is_blocked).length && !cleaners.filter(c => c.is_blocked).length && <div className="empty-state">No blocked people.</div>}
          </>
        ) : (
          <>
            {filteredAgencies.map(agency => {
              const at = [...new Set(parseTrades(agency.trades))]
              const activePersons = vendors.filter(v => v.agency_name === agency.name && !v.is_blocked).length + cleaners.filter(c => c.agency_name === agency.name && !c.is_blocked).length
              return (
                <div key={`ag-${agency.id}`} className="card" style={{ padding: '14px 16px', cursor: 'pointer' }} onClick={() => openAgency(agency)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <div style={{ fontWeight: 600, fontSize: 15 }}>{agency.name}</div>
                        <span style={{ fontSize: 11, background: '#f0f0f0', color: '#555', padding: '2px 8px', borderRadius: 20, fontWeight: 500 }}>Agency</span>
                      </div>
                      <div style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>{agency.contact_no}</div>
                      <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>{agency.email}</div>
                      {at.length > 0 && <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>{at.map(t => <span key={t} style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: tradeColors[t] || '#f0f0f0', color: tradeText[t] || '#444' }}>{t}</span>)}</div>}
                      <div style={{ fontSize: 12, color: '#aaa' }}>{activePersons} active person{activePersons !== 1 ? 's' : ''}</div>
                    </div>
                    <span style={{ fontSize: 12, color: '#aaa', marginLeft: 10 }}>→</span>
                  </div>
                </div>
              )
            })}
            {soloVendors.map(v => {
              const pt = [...new Set([...parseTrades(v.trades), v.trade].filter(Boolean))]
              return (
                <div key={`v-${v.id}`} className="card" style={{ padding: '14px 16px', cursor: 'pointer' }} onClick={() => openVendor(v)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{v.name}</div>
                      <div style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>{v.phone}</div>
                      <div style={{ fontSize: 13, color: '#888' }}>{v.email}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, marginLeft: 10 }}>
                      {pt.map(t => <span key={t} style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: tradeColors[t] || '#f0f0f0', color: tradeText[t] || '#444', whiteSpace: 'nowrap' }}>{t}</span>)}
                    </div>
                  </div>
                </div>
              )
            })}
            {soloCleaners.map(c => {
              const ct = [...new Set([...parseTrades(c.trades), c.trade].filter(Boolean))]
              return (
                <div key={`c-${c.id}`} className="card" style={{ padding: '14px 16px', cursor: 'pointer' }} onClick={() => openCleaner(c)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{c.name}</div>
                      <div style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>{c.phone}</div>
                      <div style={{ fontSize: 13, color: '#888' }}>{c.email}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, marginLeft: 10 }}>
                      {ct.length > 0 ? ct.map(t => <span key={t} style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: tradeColors[t] || '#e0f2fe', color: tradeText[t] || '#0369a1', whiteSpace: 'nowrap' }}>{t}</span>) : <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: '#e0f2fe', color: '#0369a1' }}>Cleaner</span>}
                    </div>
                  </div>
                </div>
              )
            })}
            {!filteredAgencies.length && !soloVendors.length && !soloCleaners.length && (
              <div className="empty-state">{tradeFilter !== 'all' ? `No results for "${tradeFilter}".` : 'No vendors, cleaners or agencies yet.'}</div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── ISSUES ───────────────────────────────────────────────────────────
function IssuesTab() {
  const [issues, setIssues] = useState([])
  const [vendors, setVendors] = useState([])
  const [cleaners, setCleaners] = useState([])
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [closeComment, setCloseComment] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [closedIssues, setClosedIssues] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [showReportForm, setShowReportForm] = useState(false)
  const [reportForm, setReportForm] = useState({ property_id: '', category: 'Maintenance', severity: 'Medium', description: '', photo: null })
  const [reporting, setReporting] = useState(false)
  const [reportErrors, setReportErrors] = useState({})
  const [filterPriority, setFilterPriority] = useState('all')
  const [filterProperty, setFilterProperty] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  useEffect(() => {
    Promise.all([supabase.from('issues').select('*').neq('status', 'Closed'), supabase.from('Vendors').select('*'), supabase.from('Cleaners').select('*'), supabase.from('Properties').select('id, name')]).then(([i, v, c, p]) => {
      setIssues(i.data || []); setVendors(v.data || []); setCleaners(c.data || []); setProperties(p.data || []); setLoading(false)
    })
  }, [])

  function getAssignee(issue) {
    if (!issue.vendor_id) return null
    return vendors.find(v => v.id === issue.vendor_id) || cleaners.find(c => c.id === issue.vendor_id) || null
  }
  function getPropertyName(id) { return properties.find(p => String(p.id) === String(id))?.name || '—' }

  async function loadHistory() { setHistoryLoading(true); const { data } = await supabase.from('issues').select('*').eq('status', 'Closed').order('created_at', { ascending: false }); setClosedIssues(data || []); setHistoryLoading(false); setShowHistory(true) }

  async function assignIssue(issueId, assigneeId) {
    setAssigning(true)
    const status = assigneeId ? 'Assigned' : 'Open'
    await supabase.from('issues').update({ vendor_id: assigneeId || null, status }).eq('id', issueId)
    setIssues(issues.map(i => i.id === issueId ? { ...i, vendor_id: assigneeId || null, status } : i))
    if (selected?.id === issueId) setSelected(prev => ({ ...prev, vendor_id: assigneeId || null, status }))
    setAssigning(false)
  }

  async function closeIssue(issueId) {
    await supabase.from('issues').update({ status: 'Closed' }).eq('id', issueId)
    setIssues(issues.filter(i => i.id !== issueId)); setSelected(null); setCloseComment('')
  }

  async function submitReport() {
    const e = {}
    if (!required(reportForm.property_id)) e.property_id = 'Please select a property'
    setReportErrors(e)
    if (Object.keys(e).length > 0) return
    setReporting(true)
    let photoUrl = null
    if (reportForm.photo) photoUrl = await uploadFile(reportForm.photo, 'issues')
    await supabase.from('issues').insert({ property_id: reportForm.property_id, category: reportForm.category, severity: reportForm.severity, description: reportForm.description.trim(), status: 'Open', issue_photo_url: photoUrl })
    const { data } = await supabase.from('issues').select('*').neq('status', 'Closed')
    setIssues(data || [])
    setReportForm({ property_id: '', category: 'Maintenance', severity: 'Medium', description: '', photo: null })
    setShowReportForm(false); setReportErrors({}); setReporting(false)
  }

  const filtered = issues.filter(i => {
    const priorityMatch = filterPriority === 'all' || i.severity === filterPriority
    const propertyMatch = filterProperty === 'all' || String(i.property_id) === String(filterProperty)
    const statusMatch = filterStatus === 'all' || i.status === filterStatus
    return priorityMatch && propertyMatch && statusMatch
  })

  if (showHistory) return (
    <div>
      <button onClick={() => setShowHistory(false)} style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', marginBottom: 16, color: '#555' }}>← Back</button>
      <div style={{ fontWeight: 600, marginBottom: 12 }}>Closed issues ({closedIssues.length})</div>
      {historyLoading && <div className="empty-state">Loading...</div>}
      {!historyLoading && !closedIssues.length && <div className="empty-state">No closed issues.</div>}
      {!historyLoading && closedIssues.map(issue => <div key={issue.id} className="card" style={{ marginBottom: 8 }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><div style={{ fontWeight: 600 }}>{issue.category}</div><span className="badge badge-ready">Closed</span></div><div style={{ fontSize: 13, color: '#555', marginBottom: 6 }}>{issue.description}</div><div style={{ display: 'flex', gap: 8, marginBottom: 6 }}><SeverityBadge s={issue.severity} /><span style={{ fontSize: 12, color: '#aaa' }}>{new Date(issue.created_at).toLocaleDateString('en-GB')}</span></div>{issue.issue_photo_url && <div style={{ marginBottom: 8 }}><div style={{ fontSize: 11, color: '#aaa', marginBottom: 4 }}>Issue photo</div><img src={issue.issue_photo_url} alt="Issue" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 8 }} /></div>}{issue.fix_photo_url && <div><div style={{ fontSize: 11, color: '#aaa', marginBottom: 4 }}>Fix photo</div><img src={issue.fix_photo_url} alt="Fix" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 8 }} /></div>}</div>)}
    </div>
  )

  if (selected) {
    const assignee = getAssignee(selected)
    const allAssignees = [{ id: '', name: 'Not assigned' }, ...vendors.map(v => ({ id: v.id, name: `${v.name} (Vendor)` })), ...cleaners.map(c => ({ id: c.id, name: `${c.name} (Cleaner)` }))]
    return (
      <div>
        <button onClick={() => setSelected(null)} style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', marginBottom: 16, color: '#555' }}>← Back</button>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div><div style={{ fontWeight: 700, fontSize: 18, marginBottom: 6 }}>{selected.category}</div><SeverityBadge s={selected.severity} /></div>
            <span className={`badge ${selected.status === 'Assigned' ? 'badge-valid' : selected.status === 'In Progress' ? 'badge-atrisk' : selected.status === 'Closed' ? 'badge-ready' : 'badge-open'}`}>{selected.status || 'Open'}</span>
          </div>
          <div style={{ marginBottom: 12 }}><div style={{ fontSize: 12, color: '#aaa', marginBottom: 4 }}>Property</div><div style={{ fontSize: 14, fontWeight: 500 }}>{getPropertyName(selected.property_id)}</div></div>
          {selected.description && <div style={{ marginBottom: 16 }}><div style={{ fontSize: 12, color: '#aaa', marginBottom: 4 }}>Description</div><div style={{ fontSize: 14 }}>{selected.description}</div></div>}
          {assignee && <div style={{ marginBottom: 16, padding: '10px 14px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}><div style={{ fontSize: 12, color: '#aaa', marginBottom: 2 }}>Assigned to</div><div style={{ fontSize: 14, fontWeight: 600, color: '#166534' }}>{assignee.name}</div></div>}
          {selected.issue_photo_url && <div style={{ marginBottom: 16 }}><div style={{ fontSize: 12, color: '#aaa', marginBottom: 6 }}>Before photo</div><img src={selected.issue_photo_url} alt="Issue" style={{ width: '100%', borderRadius: 8, maxHeight: 220, objectFit: 'cover' }} /></div>}
          {selected.fix_photo_url && <div style={{ marginBottom: 16 }}><div style={{ fontSize: 12, color: '#aaa', marginBottom: 6 }}>After photo</div><img src={selected.fix_photo_url} alt="Fix" style={{ width: '100%', borderRadius: 8, maxHeight: 220, objectFit: 'cover' }} /></div>}
          <div className="divider" />
          <div style={{ marginBottom: 16 }}><label className="label">Assign to</label><select className="input-field" value={selected.vendor_id || ''} onChange={e => assignIssue(selected.id, e.target.value)}>{allAssignees.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div>
          <button className="btn-primary" onClick={() => assignIssue(selected.id, selected.vendor_id)} disabled={assigning} style={{ marginBottom: 12 }}>{assigning ? 'Assigning...' : 'Confirm assignment'}</button>
          <div className="divider" />
          <div style={{ marginBottom: 12 }}><label className="label">Close with comment</label><textarea className="input-field" rows={3} placeholder="Add a closing comment..." value={closeComment} onChange={e => setCloseComment(e.target.value)} /></div>
          <button onClick={() => closeIssue(selected.id)} style={{ width: '100%', padding: 12, borderRadius: 8, fontSize: 15, fontWeight: 500, background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', cursor: 'pointer' }}>Close issue</button>
        </div>
      </div>
    )
  }

  if (loading) return <div className="empty-state">Loading...</div>

  const grouped = ['Critical', 'High', 'Medium', 'Low'].map(sev => ({ severity: sev, items: filtered.filter(i => i.severity === sev) })).filter(g => g.items.length > 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 14, color: '#888' }}>{filtered.length} issue{filtered.length !== 1 ? 's' : ''}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowReportForm(!showReportForm)} className="btn-primary" style={{ width: 'auto', padding: '8px 14px', fontSize: 13 }}>{showReportForm ? 'Cancel' : '+ Report issue'}</button>
          <button onClick={loadHistory} style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: '#555' }}>Closed</button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <select className="input-field" style={{ maxWidth: 180, padding: '7px 10px', fontSize: 13 }} value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
          <option value="all">All priorities</option>
          {['Critical', 'High', 'Medium', 'Low'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input-field" style={{ maxWidth: 200, padding: '7px 10px', fontSize: 13 }} value={filterProperty} onChange={e => setFilterProperty(e.target.value)}>
          <option value="all">All properties</option>
          {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select className="input-field" style={{ maxWidth: 160, padding: '7px 10px', fontSize: 13 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All statuses</option>
          {['Open', 'Assigned', 'In Progress'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {showReportForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 16 }}>Report an issue</div>
          <div className="form-group"><label className="label">Property *</label><select className="input-field" value={reportForm.property_id} onChange={e => setReportForm({ ...reportForm, property_id: e.target.value })}><option value="">Select property</option>{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><FieldError msg={reportErrors.property_id} /></div>
          <div className="form-group"><label className="label">Category</label><select className="input-field" value={reportForm.category} onChange={e => setReportForm({ ...reportForm, category: e.target.value })}>{['Cleaning', 'Maintenance', 'Laundry', 'Safety', 'Stock', 'Access'].map(c => <option key={c}>{c}</option>)}</select></div>
          <div className="form-group"><label className="label">Severity</label><select className="input-field" value={reportForm.severity} onChange={e => setReportForm({ ...reportForm, severity: e.target.value })}>{['Critical', 'High', 'Medium', 'Low'].map(s => <option key={s}>{s}</option>)}</select></div>
          <div className="form-group"><label className="label">Description (optional)</label><textarea className="input-field" rows={4} placeholder="Describe the issue..." value={reportForm.description} onChange={e => setReportForm({ ...reportForm, description: e.target.value })} /></div>
          <div className="form-group"><label className="label">Photo (optional)</label><input type="file" accept="image/*" className="input-field" style={{ padding: '8px' }} onChange={e => setReportForm({ ...reportForm, photo: e.target.files[0] })} />{reportForm.photo && <div style={{ fontSize: 12, color: '#16a34a', marginTop: 4 }}>✓ {reportForm.photo.name}</div>}</div>
          <button className="btn-primary" onClick={submitReport} disabled={reporting}>{reporting ? 'Submitting...' : 'Submit issue'}</button>
        </div>
      )}

      {!filtered.length && !showReportForm && <div className="empty-state">No issues found.</div>}
      <div style={{ display: 'grid', gap: 20 }}>
        {grouped.map(group => (
          <div key={group.severity}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}><SeverityBadge s={group.severity} /><span style={{ fontSize: 13, color: '#888' }}>{group.items.length}</span></div>
            <div style={{ display: 'grid', gap: 8 }}>
              {group.items.map(issue => {
                const assignee = getAssignee(issue)
                return (
                  <div key={issue.id} className="card" style={{ cursor: 'pointer' }} onClick={() => setSelected(issue)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ fontWeight: 600 }}>{issue.category}</div>
                      <span className={`badge ${issue.status === 'Assigned' ? 'badge-valid' : issue.status === 'In Progress' ? 'badge-atrisk' : 'badge-open'}`}>{issue.status || 'Open'}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>{getPropertyName(issue.property_id)}</div>
                    {issue.description && <div style={{ fontSize: 13, color: '#555', marginBottom: 6 }}>{issue.description}</div>}
                    <div style={{ fontSize: 12, color: assignee ? '#16a34a' : '#aaa', fontWeight: assignee ? 500 : 400 }}>{assignee ? `Assigned to: ${assignee.name}` : 'Not assigned'}</div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── INVENTORY ────────────────────────────────────────────────────────
function getInvStatus(item) {
  if (item.needs_restock) return 'restock'
  if (item.current_quantity > item.minimum_quantity) return 'extra'
  return 'enough'
}

function InventoryTab() {
  const [items, setItems] = useState([])
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPropertyId, setSelectedPropertyId] = useState('all')
  const [sortMode, setSortMode] = useState('default')
  const [editMode, setEditMode] = useState(false)
  const [editValues, setEditValues] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([supabase.from('restock').select('*'), supabase.from('Properties').select('id, name')]).then(([r, p]) => { setItems(r.data || []); setProperties(p.data || []); setLoading(false) })
  }, [])

  function enterEditMode() { const vals = {}; items.forEach(item => { vals[item.id] = { current_quantity: item.current_quantity || 0, minimum_quantity: item.minimum_quantity || 0 } }); setEditValues(vals); setEditMode(true) }

  async function saveEdits() {
    setSaving(true)
    await Promise.all(Object.entries(editValues).map(([id, vals]) => { const cur = parseInt(vals.current_quantity) || 0; const min = parseInt(vals.minimum_quantity) || 0; return supabase.from('restock').update({ current_quantity: cur, minimum_quantity: min, needs_restock: cur < min }).eq('id', id) }))
    const { data } = await supabase.from('restock').select('*')
    setItems(data || []); setEditMode(false); setSaving(false)
  }

  const baseFiltered = selectedPropertyId === 'all' ? items : items.filter(item => String(item.property_id) === String(selectedPropertyId))

  const filtered = baseFiltered.filter(item => {
    if (sortMode === 'restock_first') return getInvStatus(item) === 'restock'
    if (sortMode === 'enough_first') return getInvStatus(item) === 'enough'
    if (sortMode === 'extra_first') return getInvStatus(item) === 'extra'
    return true
  })

  const needsRestockCount = baseFiltered.filter(i => i.needs_restock).length
  const extraCount = baseFiltered.filter(i => getInvStatus(i) === 'extra').length

  if (loading) return <div className="empty-state">Loading inventory...</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <select className="input-field" style={{ maxWidth: 260, padding: '8px 12px' }} value={selectedPropertyId} onChange={e => setSelectedPropertyId(e.target.value)}>
          <option value="all">All properties</option>
          {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {needsRestockCount > 0 && <span className="badge badge-notready">{needsRestockCount} need restock</span>}
        {extraCount > 0 && <span className="badge badge-atrisk">{extraCount} extra</span>}
        {needsRestockCount === 0 && filtered.length > 0 && <span className="badge badge-ready">All stocked</span>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {editMode
            ? <><button onClick={() => setEditMode(false)} className="btn-secondary" style={{ padding: '8px 14px', fontSize: 13 }}>Cancel</button><button onClick={saveEdits} className="btn-primary" style={{ width: 'auto', padding: '8px 14px', fontSize: 13 }} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button></>
            : <button onClick={enterEditMode} className="btn-secondary" style={{ padding: '8px 14px', fontSize: 13 }}>Edit inventory</button>
          }
        </div>
      </div>

      {/* Sort filters */}
      {!editMode && filtered.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {[{ key: 'default', label: 'Default' }, { key: 'restock_first', label: 'Needs restock' }, { key: 'enough_first', label: 'Enough' }, { key: 'extra_first', label: 'Extra' }].map(s => (
            <button key={s.key} onClick={() => setSortMode(s.key)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: '0.5px solid #e0e0e0', background: sortMode === s.key ? '#0a0a0a' : '#f7f7f7', color: sortMode === s.key ? '#fff' : '#555' }}>{s.label}</button>
          ))}
        </div>
      )}

      {!filtered.length && <div className="empty-state">{selectedPropertyId === 'all' ? 'No inventory items yet.' : 'No inventory items for this property.'}</div>}
      {filtered.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f4f4f4' }}>
                {(selectedPropertyId === 'all' ? ['Property', 'Item', 'Min', 'Current', 'Status'] : ['Item', 'Min', 'Current', 'Status']).map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: 13, color: '#444', borderBottom: '1px solid #e0e0e0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, i) => {
                const status = getInvStatus(item)
                return (
                  <tr key={item.id} style={{ background: status === 'restock' ? '#fff8f8' : status === 'extra' ? '#fffbf0' : i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    {selectedPropertyId === 'all' && <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0', color: '#555' }}>{properties.find(p => String(p.id) === String(item.property_id))?.name || '—'}</td>}
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0', fontWeight: 500 }}>{item.item_name}</td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0', textAlign: 'center' }}>
                      {editMode ? <input type="number" min="0" style={{ width: 52, padding: '4px 6px', border: '1px solid #e0e0e0', borderRadius: 6, fontSize: 13, textAlign: 'center' }} value={editValues[item.id]?.minimum_quantity ?? item.minimum_quantity} onChange={e => setEditValues(prev => ({ ...prev, [item.id]: { ...prev[item.id], minimum_quantity: e.target.value } }))} /> : <span style={{ color: '#888' }}>{item.minimum_quantity}</span>}
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0', textAlign: 'center' }}>
                      {editMode ? <input type="number" min="0" style={{ width: 52, padding: '4px 6px', border: '1px solid #e0e0e0', borderRadius: 6, fontSize: 13, textAlign: 'center' }} value={editValues[item.id]?.current_quantity ?? item.current_quantity} onChange={e => setEditValues(prev => ({ ...prev, [item.id]: { ...prev[item.id], current_quantity: e.target.value } }))} /> : <span style={{ color: status === 'restock' ? '#dc2626' : status === 'extra' ? '#d97706' : '#16a34a', fontWeight: 600 }}>{item.current_quantity}</span>}
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0' }}>
                      <span className={`badge ${status === 'restock' ? 'badge-notready' : status === 'extra' ? 'badge-atrisk' : 'badge-ready'}`}>
                        {status === 'restock' ? 'Needs restock' : status === 'extra' ? 'Extra' : 'Enough'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── COMPLIANCE ───────────────────────────────────────────────────────
function ComplianceTab() {
  const [docs, setDocs] = useState([])
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ document_type: '', property_id: '', issue_date: '', expiry_date: '', file: null })
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const docTypes = ['Gas Safety Record (CP12)', 'EICR', 'EPC', 'Public Liability Insurance', 'Fire Risk Assessment']

  async function loadDocs() { const { data } = await supabase.from('compliance_documents').select('*'); setDocs((data || []).map(doc => ({ ...doc, computed_status: computeDocStatus(doc) }))) }

  useEffect(() => {
    Promise.all([supabase.from('compliance_documents').select('*'), supabase.from('Properties').select('id, name')]).then(([d, p]) => {
      setDocs((d.data || []).map(doc => ({ ...doc, computed_status: computeDocStatus(doc) }))); setProperties(p.data || []); setLoading(false)
    })
  }, [])

  function validate() { const e = {}; if (!required(form.document_type)) e.document_type = 'Please select a document type'; if (!required(form.property_id)) e.property_id = 'Please select a property'; setErrors(e); return Object.keys(e).length === 0 }

  async function saveDocument() {
    if (!validate()) return; setSaving(true)
    let fileUrl = null
    if (form.file) fileUrl = await uploadFile(form.file, 'compliance')
    await supabase.from('compliance_documents').insert({ document_type: form.document_type, property_id: form.property_id || null, issue_date: form.issue_date || null, expiry_date: form.expiry_date || null, document_url: fileUrl })
    await loadDocs(); setForm({ document_type: '', property_id: '', issue_date: '', expiry_date: '', file: null }); setShowForm(false); setErrors({}); setSaving(false)
  }

  if (loading) return <div className="empty-state">Loading...</div>
  const grouped = ['Expired', 'Due Soon', 'Valid'].map(s => ({ status: s, items: docs.filter(d => d.computed_status === s) })).filter(g => g.items.length > 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 14, color: '#888' }}>{docs.length} document{docs.length !== 1 ? 's' : ''}</div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary" style={{ width: 'auto', padding: '8px 16px' }}>{showForm ? 'Cancel' : '+ Add document'}</button>
      </div>
      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 16 }}>Add compliance document</div>
          <div className="form-group"><label className="label">Document type *</label><select className="input-field" value={form.document_type} onChange={e => setForm({ ...form, document_type: e.target.value })}><option value="">Select document</option>{docTypes.map(t => <option key={t} value={t}>{t}</option>)}</select><FieldError msg={errors.document_type} /></div>
          <div className="form-group"><label className="label">Property *</label><select className="input-field" value={form.property_id} onChange={e => setForm({ ...form, property_id: e.target.value })}><option value="">Select property</option>{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select><FieldError msg={errors.property_id} /></div>
          <div className="form-group"><label className="label">Issue date</label><input className="input-field" type="date" value={form.issue_date} onChange={e => setForm({ ...form, issue_date: e.target.value })} /></div>
          <div className="form-group"><label className="label">Expiry date</label><input className="input-field" type="date" value={form.expiry_date} onChange={e => setForm({ ...form, expiry_date: e.target.value })} /></div>
          <div className="form-group"><label className="label">Upload document (PDF or image)</label><input type="file" accept=".pdf,image/*" className="input-field" style={{ padding: '8px' }} onChange={e => setForm({ ...form, file: e.target.files[0] })} />{form.file && <div style={{ fontSize: 12, color: '#16a34a', marginTop: 4 }}>✓ {form.file.name}</div>}</div>
          <button className="btn-primary" onClick={saveDocument} disabled={saving}>{saving ? 'Saving...' : 'Save document'}</button>
        </div>
      )}
      {!docs.length && <div className="empty-state">No compliance documents yet.</div>}
      {grouped.map(group => (
        <div key={group.status} style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}><CompBadge status={group.status} /><span style={{ fontSize: 13, color: '#888' }}>{group.items.length}</span></div>
          <div style={{ display: 'grid', gap: 8 }}>
            {group.items.map(doc => <div key={doc.id} className="card" style={{ padding: '14px 16px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div><div style={{ fontWeight: 600, marginBottom: 4 }}>{doc.document_type}</div><div style={{ fontSize: 13, color: '#888' }}>{properties.find(p => String(p.id) === String(doc.property_id))?.name || '—'}</div>{doc.document_url && <a href={doc.document_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#2563eb' }}>View →</a>}</div><div style={{ textAlign: 'right' }}><CompBadge status={doc.computed_status} /><div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>{doc.expiry_date ? `Expires ${new Date(doc.expiry_date).toLocaleDateString('en-GB')}` : 'No date'}</div></div></div></div>)}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── JOBS ─────────────────────────────────────────────────────────────
function JobsTab({ onCreateJob }) {
  const [jobs, setJobs] = useState([])
  const [properties, setProperties] = useState([])
  const [cleaners, setCleaners] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [propertyFilter, setPropertyFilter] = useState('all')
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    Promise.all([
      supabase.from('jobs').select('*').order('job_date', { ascending: false }),
      supabase.from('Properties').select('id, name'),
      supabase.from('Cleaners').select('id, name'),
    ]).then(([j, p, c]) => { setJobs(j.data || []); setProperties(p.data || []); setCleaners(c.data || []); setLoading(false) })
  }, [])

  async function closeJob(job) {
    if (!window.confirm('Mark this job as complete?')) return
    const { data } = await supabase.from('jobs').update({ status: 'Complete', readiness_percent: 100 }).eq('id', job.id).select().single()
    setJobs(prev => prev.map(j => j.id === job.id ? data : j))
    if (selected?.id === job.id) setSelected(data)
  }

  async function deleteJob(job) {
    if (!window.confirm('Delete this job? This cannot be undone.')) return
    await supabase.from('jobs').delete().eq('id', job.id)
    setJobs(prev => prev.filter(j => j.id !== job.id))
    if (selected?.id === job.id) setSelected(null)
  }

  const filtered = jobs.filter(j => (statusFilter === 'all' || j.status === statusFilter) && (propertyFilter === 'all' || String(j.property_id) === String(propertyFilter)))
  if (loading) return <div className="empty-state">Loading jobs...</div>

  if (selected) {
    const prop = properties.find(p => String(p.id) === String(selected.property_id))
    const cleaner = cleaners.find(c => String(c.id) === String(selected.cleaner_id))
    return (
      <div>
        <button onClick={() => setSelected(null)} style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', marginBottom: 16, color: '#555' }}>← Back to jobs</button>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 6 }}>{prop?.name || '—'}</div>
              <span className={`badge ${selected.status === 'Complete' ? 'badge-ready' : selected.status === 'In progress' ? 'badge-atrisk' : 'badge-notready'}`}>{selected.status || 'Not started'}</span>
            </div>
          </div>
          <div style={{ display: 'grid', gap: 10, marginBottom: 14 }}>
            {[['Cleaner', cleaner?.name || '—'], ['Date', selected.job_date ? new Date(selected.job_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) : '—'], ['Check-in', selected.checkin_time ? new Date(selected.checkin_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : 'Not set']].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', gap: 10 }}>
                <span style={{ fontSize: 13, color: '#aaa', width: 80, flexShrink: 0 }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{val}</span>
              </div>
            ))}
            {selected.notes && <div style={{ display: 'flex', gap: 10 }}><span style={{ fontSize: 13, color: '#aaa', width: 80 }}>Notes</span><span style={{ fontSize: 13 }}>{selected.notes}</span></div>}
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: '#888' }}>Progress</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{selected.completed_tasks || 0}/{selected.total_tasks || 0} tasks · {selected.readiness_percent || 0}%</span>
            </div>
            <div style={{ height: 8, background: '#f0f0f0', borderRadius: 4 }}>
              <div style={{ height: 8, borderRadius: 4, width: `${selected.readiness_percent || 0}%`, background: selected.readiness_percent === 100 ? '#16a34a' : '#d97706', transition: 'width 0.3s' }} />
            </div>
          </div>
          <JobMagicLink job={selected} onUpdate={updated => { setSelected(updated); setJobs(prev => prev.map(j => j.id === updated.id ? updated : j)) }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            {selected.status !== 'Complete' && <button onClick={() => closeJob(selected)} style={{ flex: 1, padding: 12, borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', background: '#dcfce7', color: '#166534', border: 'none' }}>✓ Mark complete</button>}
            <button onClick={() => deleteJob(selected)} style={{ flex: 1, padding: 12, borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', background: '#fee2e2', color: '#991b1b', border: 'none' }}>Delete job</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['all', 'Not started', 'In progress', 'Complete'].map(f => <button key={f} onClick={() => setStatusFilter(f)} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: statusFilter === f ? '#0a0a0a' : '#f0f0f0', color: statusFilter === f ? '#fff' : '#555', border: 'none' }}>{f === 'all' ? 'All statuses' : f}</button>)}
          </div>
          <select className="input-field" style={{ maxWidth: 260, padding: '7px 12px', fontSize: 13 }} value={propertyFilter} onChange={e => setPropertyFilter(e.target.value)}>
            <option value="all">All properties</option>
            {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <button onClick={onCreateJob} className="btn-primary" style={{ width: 'auto', padding: '8px 14px', fontSize: 13 }}>+ Create job</button>
      </div>
      {!filtered.length && <div className="empty-state">No jobs found.</div>}
      <div style={{ display: 'grid', gap: 10 }}>
        {filtered.map(job => (
          <div key={job.id} className="card" style={{ cursor: 'pointer' }} onClick={() => setSelected(job)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{properties.find(p => String(p.id) === String(job.property_id))?.name || '—'}</div>
                <div style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>Cleaner: {cleaners.find(c => String(c.id) === String(job.cleaner_id))?.name || '—'}</div>
                <div style={{ fontSize: 13, color: '#888' }}>{job.job_date ? new Date(job.job_date).toLocaleDateString('en-GB') : '—'}</div>
                {job.notes && <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>{job.notes}</div>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <span className={`badge ${job.status === 'Complete' ? 'badge-ready' : job.status === 'In progress' ? 'badge-atrisk' : 'badge-notready'}`}>{job.status || 'Not started'}</span>
                <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                  {job.status !== 'Complete' && <button onClick={() => closeJob(job)} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: 'pointer', background: '#dcfce7', color: '#166534', border: 'none' }}>Close</button>}
                  <button onClick={() => deleteJob(job)} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: 'pointer', background: '#fee2e2', color: '#991b1b', border: 'none' }}>Delete</button>
                </div>
              </div>
            </div>
            <div style={{ height: 6, background: '#f0f0f0', borderRadius: 3 }}><div style={{ height: 6, borderRadius: 3, width: `${job.readiness_percent || 0}%`, background: job.readiness_percent === 100 ? '#16a34a' : '#d97706' }} /></div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{job.readiness_percent || 0}% · {job.completed_tasks || 0}/{job.total_tasks || 0} tasks</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── CLEANER ACCESS SECTION ───────────────────────────────────────────
function CleanerAccessSection({ cleaner, onUpdate }) {
  const [showCreateLogin, setShowCreateLogin] = useState(false)
  const [loginForm, setLoginForm] = useState({ email: cleaner.email || '', password: '' })
  const [creating, setCreating] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [loginSuccess, setLoginSuccess] = useState(false)
  const [generatingLink, setGeneratingLink] = useState(false)
  const [magicLink, setMagicLink] = useState('')
  const [copied, setCopied] = useState(false)

  async function createLogin() {
    if (!loginForm.email || !loginForm.password) { setLoginError('Email and password are required'); return }
    if (loginForm.password.length < 6) { setLoginError('Password must be at least 6 characters'); return }
    setCreating(true); setLoginError('')
    try {
      const adminClient = getAdminClient()
      if (!adminClient) { setLoginError('Service role key not configured. Add VITE_SUPABASE_SERVICE_ROLE_KEY to Vercel environment variables.'); setCreating(false); return }
      const { data, error } = await adminClient.auth.admin.createUser({
        email: loginForm.email,
        password: loginForm.password,
        user_metadata: { role: 'cleaner' },
        email_confirm: true,
      })
      if (error) { setLoginError(error.message); setCreating(false); return }
      const { data: updated } = await supabase.from('Cleaners').update({ auth_user_id: data.user.id, email: loginForm.email }).eq('id', cleaner.id).select().single()
      setLoginSuccess(true); setShowCreateLogin(false); setCreating(false)
      if (onUpdate && updated) onUpdate(updated)
    } catch (err) { setLoginError(err.message); setCreating(false) }
  }

  async function generateMagicLink() {
    setGeneratingLink(true)
    // Find most recent upcoming job for this cleaner
    const { data: jobs } = await supabase.from('jobs').select('*').eq('cleaner_id', cleaner.id).order('job_date', { ascending: false }).limit(1)
    if (!jobs || !jobs.length) {
      alert('No jobs found for this cleaner. Create a job first.'); setGeneratingLink(false); return
    }
    const job = jobs[0]
    const token = crypto.randomUUID()
    const expires = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    await supabase.from('jobs').update({ magic_link_token: token, magic_link_expires_at: expires }).eq('id', job.id)
    const link = `${window.location.origin}/job/${token}`
    setMagicLink(link); setGeneratingLink(false)
  }

  async function copyLink() {
    await navigator.clipboard.writeText(magicLink)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const hasLogin = !!cleaner.auth_user_id

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 600, marginBottom: 12 }}>Access</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        {hasLogin
          ? <span style={{ fontSize: 12, background: '#dcfce7', color: '#166534', padding: '4px 12px', borderRadius: 20, fontWeight: 500 }}>✓ Has login account</span>
          : <span style={{ fontSize: 12, background: '#f0f0f0', color: '#888', padding: '4px 12px', borderRadius: 20 }}>No login yet</span>
        }
      </div>

      {loginSuccess && <div style={{ background: '#dcfce7', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#166534' }}>✓ Login created. Share credentials with the cleaner.</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: showCreateLogin ? 12 : 0 }}>
        {!hasLogin && (
          <button onClick={() => setShowCreateLogin(!showCreateLogin)} style={{ flex: 1, padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: '1px solid #e0e0e0', background: showCreateLogin ? '#f0f0f0' : '#fff', color: '#0a0a0a' }}>
            {showCreateLogin ? 'Cancel' : '+ Create login'}
          </button>
        )}
        <button onClick={generateMagicLink} disabled={generatingLink} style={{ flex: 1, padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', background: '#0a0a0a', color: '#fff', border: 'none' }}>
          {generatingLink ? 'Generating...' : '🔗 Magic link'}
        </button>
      </div>

      {showCreateLogin && (
        <div style={{ background: '#f7f7f7', borderRadius: 8, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 10 }}>Create a login for this cleaner. Share these credentials with them.</div>
          {loginError && <div style={{ background: '#fee2e2', borderRadius: 6, padding: '8px 12px', marginBottom: 10, fontSize: 12, color: '#dc2626' }}>{loginError}</div>}
          <div className="form-group"><label className="label">Email</label><input className="input-field" type="email" value={loginForm.email} onChange={e => setLoginForm({ ...loginForm, email: e.target.value })} placeholder="cleaner@email.com" /></div>
          <div className="form-group"><label className="label">Temporary password</label><input className="input-field" type="password" value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })} placeholder="Min 6 characters" /></div>
          <button onClick={createLogin} disabled={creating} className="btn-primary">{creating ? 'Creating...' : 'Create login'}</button>
        </div>
      )}

      {magicLink && (
        <div style={{ background: '#f0f9ff', borderRadius: 8, padding: 14, marginTop: 12, border: '1px solid #bae6fd' }}>
          <div style={{ fontSize: 12, color: '#0369a1', marginBottom: 6, fontWeight: 500 }}>Magic link ready — expires in 48 hours</div>
          <div style={{ fontSize: 12, color: '#555', wordBreak: 'break-all', marginBottom: 10, background: '#fff', padding: '8px 10px', borderRadius: 6, border: '1px solid #e0e0e0' }}>{magicLink}</div>
          <button onClick={copyLink} style={{ width: '100%', padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', background: copied ? '#dcfce7' : '#0a0a0a', color: copied ? '#166534' : '#fff', border: 'none' }}>
            {copied ? '✓ Copied!' : 'Copy link'}
          </button>
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 8, textAlign: 'center' }}>Send via WhatsApp or SMS to the cleaner</div>
        </div>
      )}
    </div>
  )
}

// ── JOB MAGIC LINK ────────────────────────────────────────────────────
function JobMagicLink({ job, onUpdate }) {
  const [generating, setGenerating] = useState(false)
  const [link, setLink] = useState(job.magic_link_token ? `${window.location.origin}/job/${job.magic_link_token}` : '')
  const [copied, setCopied] = useState(false)
  const [showLink, setShowLink] = useState(false)

  async function generate() {
    setGenerating(true)
    const token = crypto.randomUUID()
    const expires = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase.from('jobs').update({ magic_link_token: token, magic_link_expires_at: expires }).eq('id', job.id).select().single()
    const url = `${window.location.origin}/job/${token}`
    setLink(url); setShowLink(true); setGenerating(false)
    if (onUpdate && data) onUpdate(data)
  }

  async function copy() {
    await navigator.clipboard.writeText(link)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ marginTop: 10 }}>
      {!showLink && (
        <button onClick={generate} disabled={generating} style={{ fontSize: 12, color: '#2563eb', background: 'none', border: '1px solid #bfdbfe', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontWeight: 500 }}>
          {generating ? 'Generating...' : '🔗 Generate cleaner link'}
        </button>
      )}
      {link && showLink && (
        <div style={{ background: '#f0f9ff', borderRadius: 8, padding: 10, border: '1px solid #bae6fd', marginTop: 4 }}>
          <div style={{ fontSize: 11, color: '#0369a1', marginBottom: 4 }}>Send this link to the cleaner</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <div style={{ fontSize: 11, color: '#555', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{link}</div>
            <button onClick={copy} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: 'pointer', background: copied ? '#dcfce7' : '#0a0a0a', color: copied ? '#166534' : '#fff', border: 'none', whiteSpace: 'nowrap' }}>{copied ? '✓ Copied' : 'Copy'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── MAIN ─────────────────────────────────────────────────────────────
export default function OperatorDashboard({ onCreateJob }) {
  const [tab, setTab] = useState('property-profile')
  async function handleLogout() { await supabase.auth.signOut() }
  const tabs = [{ key: 'property-profile', label: 'Property Profile' }, { key: 'vendor-directory', label: 'Vendor Directory' }, { key: 'issues', label: 'Issues' }, { key: 'inventory', label: 'Inventory' }, { key: 'compliance', label: 'Compliance' }, { key: 'jobs', label: 'Jobs' }]
  return (
    <div style={{ minHeight: '100vh', background: '#f7f7f7' }}>
      <div className="page-header" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.5px' }}>OpsLoom</span>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{tabs.map(t => <NavTab key={t.key} label={t.label} active={tab === t.key} onClick={() => setTab(t.key)} />)}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-primary" onClick={onCreateJob} style={{ width: 'auto', padding: '8px 16px' }}>+ Create job</button>
          <button className="btn-secondary" onClick={handleLogout} style={{ padding: '8px 16px' }}>Sign out</button>
        </div>
      </div>
      <div className="page-body">
        {tab === 'property-profile' && <PropertyProfileTab />}
        {tab === 'vendor-directory' && <VendorDirectoryTab />}
        {tab === 'issues' && <IssuesTab />}
        {tab === 'inventory' && <InventoryTab />}
        {tab === 'compliance' && <ComplianceTab />}
        {tab === 'jobs' && <JobsTab onCreateJob={onCreateJob} />}
      </div>
    </div>
  )
}
