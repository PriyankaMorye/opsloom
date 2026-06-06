import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

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
function PropertyProfileTab() {
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showPaused, setShowPaused] = useState(false)
  const [selected, setSelected] = useState(null)
  const [detailData, setDetailData] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showCompForm, setShowCompForm] = useState(false)
  const [showJobHistory, setShowJobHistory] = useState(false)
  const [showIssueHistory, setShowIssueHistory] = useState(false)
  const [editSection, setEditSection] = useState(null) // 'details' | 'inventory' | 'knowledge' | null
  const [editForm, setEditForm] = useState({})
  const [editInventory, setEditInventory] = useState([])
  const [saving, setSaving] = useState(false)
  const [savingComp, setSavingComp] = useState(false)
  const [errors, setErrors] = useState({})
  const [confirmAction, setConfirmAction] = useState(null) // { type: 'pause'|'delete', reason: '' }
  const [form, setForm] = useState({ name: '', house_no: '', address_line1: '', address_line2: '', postcode: '', city: '', country: 'United Kingdom', bedroom: '', bathrooms: '', next_checkin: '', access_code: '', linen_location: '', appliance_notes: '', knowledge_base_file: null })
  const [compForm, setCompForm] = useState({ document_type: '', issue_date: '', expiry_date: '', file: null })
  const docTypes = ['Gas Safety Record (CP12)', 'EICR', 'EPC', 'Public Liability Insurance', 'Fire Risk Assessment']

  useEffect(() => {
    supabase.from('Properties').select('*').then(({ data }) => { setProperties(data || []); setLoading(false) })
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

  function validateForm() {
    const e = {}
    if (!required(form.name)) e.name = 'Property name is required'
    if (!required(form.house_no)) e.house_no = 'House or flat number is required'
    if (!required(form.address_line1)) e.address_line1 = 'Street address is required'
    if (!required(form.postcode)) e.postcode = 'Postcode is required'
    if (!required(form.city)) e.city = 'City is required'
    if (!required(form.bedroom) || isNaN(form.bedroom) || parseInt(form.bedroom) < 1) e.bedroom = 'Enter a valid number of bedrooms'
    setErrors(e); return Object.keys(e).length === 0
  }

  async function saveProperty() {
    if (!validateForm()) return
    setSaving(true)
    const parts = [form.house_no.trim(), form.address_line1.trim()]
    if (form.address_line2.trim()) parts.push(form.address_line2.trim())
    parts.push(form.city.trim(), form.postcode.trim().toUpperCase(), form.country)
    const fullAddress = parts.join(', ')
    let kbUrl = null
    if (form.knowledge_base_file) kbUrl = await uploadFile(form.knowledge_base_file, 'knowledge-base')
    const { data } = await supabase.from('Properties').insert({ name: form.name.trim(), address: fullAddress, bedroom: parseInt(form.bedroom), bathrooms: form.bathrooms ? parseInt(form.bathrooms) : null, next_checkin: form.next_checkin || null, access_code: form.access_code.trim() || null, linen_location: form.linen_location.trim() || null, appliance_notes: form.appliance_notes.trim() || null, readiness_status: 'Not Ready', knowledge_base_url: kbUrl, property_status: 'active' }).select()
    setProperties(prev => [...prev, ...(data || [])])
    setForm({ name: '', house_no: '', address_line1: '', address_line2: '', postcode: '', city: '', country: 'United Kingdom', bedroom: '', bathrooms: '', next_checkin: '', access_code: '', linen_location: '', appliance_notes: '', knowledge_base_file: null })
    setShowAddForm(false); setErrors({}); setSaving(false)
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
    const { data } = await supabase.from('Properties').update({ name: editForm.name, address: editForm.address, bedroom: parseInt(editForm.bedroom) || selected.bedroom, bathrooms: editForm.bathrooms ? parseInt(editForm.bathrooms) : null, next_checkin: editForm.next_checkin || null, access_code: editForm.access_code || null, linen_location: editForm.linen_location || null, appliance_notes: editForm.appliance_notes || null, knowledge_base_url: kbUrl }).eq('id', selected.id).select().single()
    setSelected(data)
    setProperties(prev => prev.map(p => p.id === selected.id ? data : p))
    setEditSection(null); setSaving(false)
  }

  async function saveInventoryEdits() {
    setSaving(true)
    await Promise.all(editInventory.map(item => { const cur = parseInt(item.current_quantity) || 0; const min = parseInt(item.minimum_quantity) || 0; return supabase.from('restock').update({ current_quantity: cur, minimum_quantity: min, needs_restock: cur < min }).eq('id', item.id) }))
    const { data } = await supabase.from('restock').select('*').eq('property_id', selected.id)
    setDetailData(prev => ({ ...prev, restock: data || [] }))
    setEditSection(null); setSaving(false)
  }

  async function applyAction() {
    if (!confirmAction) return
    setSaving(true)
    const update = confirmAction.type === 'pause'
      ? { property_status: 'paused', pause_reason: confirmAction.reason }
      : { property_status: 'deleted', delete_reason: confirmAction.reason }
    await supabase.from('Properties').update(update).eq('id', selected.id)
    setProperties(prev => prev.map(p => p.id === selected.id ? { ...p, ...update } : p))
    setSelected(null); setDetailData(null); setConfirmAction(null); setSaving(false)
  }

  async function restoreProperty(p) {
    await supabase.from('Properties').update({ property_status: 'active', pause_reason: null }).eq('id', p.id)
    setProperties(prev => prev.map(prop => prop.id === p.id ? { ...prop, property_status: 'active', pause_reason: null } : prop))
  }

  const activeProps = properties.filter(p => (!p.property_status || p.property_status === 'active') && (p.name?.toLowerCase().includes(search.toLowerCase()) || p.address?.toLowerCase().includes(search.toLowerCase())))
  const inactiveProps = properties.filter(p => p.property_status === 'paused' || p.property_status === 'deleted')

  if (confirmAction) return (
    <div>
      <div className="card" style={{ maxWidth: 500 }}>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>{confirmAction.type === 'pause' ? 'Pause property?' : 'Delete property?'}</div>
        <div style={{ fontSize: 14, color: '#888', marginBottom: 16 }}>{confirmAction.type === 'pause' ? 'This property will be hidden from active operations until restored.' : 'This property will be marked as deleted. You can still view it but it will not appear in active operations.'}</div>
        <div className="form-group">
          <label className="label">Reason *</label>
          <textarea className="input-field" rows={3} placeholder={`Reason for ${confirmAction.type}...`} value={confirmAction.reason} onChange={e => setConfirmAction({ ...confirmAction, reason: e.target.value })} />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setConfirmAction(null)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
          <button onClick={applyAction} disabled={!required(confirmAction.reason) || saving} style={{ flex: 1, padding: 12, borderRadius: 8, fontWeight: 500, fontSize: 14, cursor: 'pointer', background: confirmAction.type === 'pause' ? '#fef3c7' : '#fee2e2', color: confirmAction.type === 'pause' ? '#92400e' : '#991b1b', border: 'none' }}>{saving ? 'Applying...' : confirmAction.type === 'pause' ? 'Pause property' : 'Delete property'}</button>
        </div>
      </div>
    </div>
  )

  if (selected) {
    if (detailLoading) return <div><button onClick={() => setSelected(null)} style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', marginBottom: 16, color: '#555' }}>← Back</button><div className="empty-state">Loading...</div></div>
    const { issues, restock, comp, jobs, calculatedStatus } = detailData
    const openIssues = issues.filter(i => i.status !== 'Closed' && i.status !== 'Fixed')
    const lastJob = jobs[0]
    const enrichedComp = comp.map(d => ({ ...d, computed_status: computeDocStatus(d) }))
    const expiredDocs = enrichedComp.filter(d => d.computed_status === 'Expired')
    const dueSoonDocs = enrichedComp.filter(d => d.computed_status === 'Due Soon')

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <button onClick={() => { setSelected(null); setDetailData(null); setEditSection(null) }} style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', color: '#555' }}>← Back</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setConfirmAction({ type: 'pause', reason: '' })} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', background: '#fef3c7', color: '#92400e', border: 'none' }}>Pause</button>
            <button onClick={() => setConfirmAction({ type: 'delete', reason: '' })} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', background: '#fee2e2', color: '#991b1b', border: 'none' }}>Delete</button>
          </div>
        </div>

        {enrichedComp.length === 0 && <div style={{ background: '#fff8ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '12px 16px', marginBottom: 12, display: 'flex', alignItems: 'flex-start', gap: 10 }}><span style={{ fontSize: 18 }}>⚠️</span><div><div style={{ fontWeight: 600, fontSize: 14, color: '#92400e', marginBottom: 2 }}>No compliance documents added</div><div style={{ fontSize: 13, color: '#b45309' }}>Gas Safety, EICR, EPC, Insurance, or Fire Risk Assessment are missing. Scroll down to add them.</div></div></div>}

        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div><div style={{ fontWeight: 700, fontSize: 20, marginBottom: 4 }}>{selected.name}</div><div style={{ fontSize: 14, color: '#888', marginBottom: 8 }}>{selected.address}</div><div style={{ fontSize: 13, color: '#aaa' }}>{selected.bedroom} bed{selected.bathrooms ? ` · ${selected.bathrooms} bath` : ''} · Check-in: {selected.next_checkin ? new Date(selected.next_checkin).toLocaleDateString('en-GB') : 'Not set'}</div></div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}><StatusBadge status={calculatedStatus} /><span style={{ fontSize: 11, color: '#aaa' }}>Auto-calculated</span></div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 12 }}>Readiness Breakdown</div>
          {[{ label: 'Cleaning', badge: !lastJob ? 'badge-notready' : lastJob.status === 'Complete' ? 'badge-ready' : 'badge-atrisk', text: !lastJob ? 'No job recorded' : lastJob.status }, { label: 'Open issues', badge: openIssues.some(i => i.severity === 'Critical') ? 'badge-notready' : openIssues.some(i => i.severity === 'High') ? 'badge-atrisk' : openIssues.length > 0 ? 'badge-duesoon' : 'badge-ready', text: openIssues.length > 0 ? `${openIssues.length} open` : 'All clear' }, { label: 'Inventory', badge: restock.some(r => r.needs_restock) ? 'badge-atrisk' : 'badge-ready', text: restock.some(r => r.needs_restock) ? `${restock.filter(r => r.needs_restock).length} need restock` : 'All stocked' }, { label: 'Compliance', badge: expiredDocs.length > 0 ? 'badge-notready' : dueSoonDocs.length > 0 ? 'badge-atrisk' : 'badge-ready', text: expiredDocs.length > 0 ? `${expiredDocs.length} expired` : dueSoonDocs.length > 0 ? `${dueSoonDocs.length} due soon` : 'All valid' }].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}><span style={{ fontSize: 13 }}>{row.label}</span><span className={`badge ${row.badge}`}>{row.text}</span></div>
          ))}
        </div>

        {/* Knowledge Base - editable */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 600 }}>Knowledge Base</div>
            <button onClick={() => { setEditSection(editSection === 'knowledge' ? null : 'knowledge'); setEditForm({ access_code: selected.access_code || '', linen_location: selected.linen_location || '', appliance_notes: selected.appliance_notes || '', knowledge_base_file: null }) }} style={{ fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>{editSection === 'knowledge' ? 'Cancel' : 'Edit'}</button>
          </div>
          {editSection === 'knowledge' ? (
            <div>
              <div className="form-group"><label className="label">Access code</label><input className="input-field" value={editForm.access_code} onChange={e => setEditForm({ ...editForm, access_code: e.target.value })} /></div>
              <div className="form-group"><label className="label">Linen location</label><input className="input-field" value={editForm.linen_location} onChange={e => setEditForm({ ...editForm, linen_location: e.target.value })} /></div>
              <div className="form-group"><label className="label">Appliance notes</label><textarea className="input-field" rows={3} value={editForm.appliance_notes} onChange={e => setEditForm({ ...editForm, appliance_notes: e.target.value })} /></div>
              <div className="form-group"><label className="label">Upload new knowledge base PDF</label><input type="file" accept=".pdf" className="input-field" style={{ padding: 8 }} onChange={e => setEditForm({ ...editForm, knowledge_base_file: e.target.files[0] })} /></div>
              <button className="btn-primary" onClick={savePropertyEdits} disabled={saving}>{saving ? 'Saving...' : 'Save knowledge base'}</button>
            </div>
          ) : (
            <div>
              {[['Access code', selected.access_code, 'monospace', 18, 700], ['Linen location', selected.linen_location, null, 14, 400], ['Appliance notes', selected.appliance_notes, null, 14, 400]].map(([label, val, font, size, weight]) => (
                <div key={label} style={{ marginBottom: 8 }}><div style={{ fontSize: 11, color: '#aaa', marginBottom: 2 }}>{label}</div><div style={{ fontSize: size, fontWeight: weight, fontFamily: font || 'inherit' }}>{val || 'Not set'}</div></div>
              ))}
              {selected.knowledge_base_url && <a href={selected.knowledge_base_url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#2563eb', fontWeight: 500 }}>📄 View knowledge base PDF →</a>}
            </div>
          )}
        </div>

        {/* Property Details - editable */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontWeight: 600 }}>Property Details</div>
            <button onClick={() => { setEditSection(editSection === 'details' ? null : 'details'); setEditForm({ name: selected.name, address: selected.address, bedroom: selected.bedroom, bathrooms: selected.bathrooms || '', next_checkin: selected.next_checkin ? selected.next_checkin.slice(0, 16) : '' }) }} style={{ fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>{editSection === 'details' ? 'Cancel' : 'Edit'}</button>
          </div>
          {editSection === 'details' ? (
            <div>
              <div className="form-group"><label className="label">Property name</label><input className="input-field" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} /></div>
              <div className="form-group"><label className="label">Address</label><input className="input-field" value={editForm.address} onChange={e => setEditForm({ ...editForm, address: e.target.value })} /></div>
              <div style={{ display: 'flex', gap: 10 }}>
                <div className="form-group" style={{ flex: 1 }}><label className="label">Bedrooms</label><input className="input-field" type="number" min="1" value={editForm.bedroom} onChange={e => setEditForm({ ...editForm, bedroom: e.target.value })} /></div>
                <div className="form-group" style={{ flex: 1 }}><label className="label">Bathrooms</label><input className="input-field" type="number" min="1" value={editForm.bathrooms} onChange={e => setEditForm({ ...editForm, bathrooms: e.target.value })} /></div>
              </div>
              <div className="form-group"><label className="label">Next check-in</label><input className="input-field" type="datetime-local" value={editForm.next_checkin} onChange={e => setEditForm({ ...editForm, next_checkin: e.target.value })} /></div>
              <button className="btn-primary" onClick={savePropertyEdits} disabled={saving}>{saving ? 'Saving...' : 'Save details'}</button>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: '#666' }}>
              <div>{selected.bedroom} bedroom{selected.bedroom !== 1 ? 's' : ''}{selected.bathrooms ? `, ${selected.bathrooms} bathroom${selected.bathrooms !== 1 ? 's' : ''}` : ''}</div>
              <div style={{ marginTop: 4 }}>Next check-in: {selected.next_checkin ? new Date(selected.next_checkin).toLocaleString('en-GB') : 'Not set'}</div>
            </div>
          )}
        </div>

        {/* Cleaning History */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontWeight: 600 }}>Cleaning History ({jobs.length})</div>
            <button onClick={() => setShowJobHistory(!showJobHistory)} style={{ fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>{showJobHistory ? 'Hide ▲' : 'View all ▼'}</button>
          </div>
          {lastJob ? <div><div style={{ fontSize: 12, color: '#aaa', marginBottom: 4 }}>Latest</div><div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span className={`badge ${lastJob.status === 'Complete' ? 'badge-ready' : lastJob.status === 'In progress' ? 'badge-atrisk' : 'badge-notready'}`}>{lastJob.status}</span><span style={{ fontSize: 13, color: '#888' }}>{new Date(lastJob.job_date).toLocaleDateString('en-GB')} · {lastJob.readiness_percent || 0}%</span></div></div> : <div style={{ fontSize: 13, color: '#aaa' }}>No jobs yet.</div>}
          {showJobHistory && jobs.map(job => <div key={job.id} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0', marginTop: 8 }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontSize: 13 }}>{new Date(job.job_date).toLocaleDateString('en-GB')}</span><span className={`badge ${job.status === 'Complete' ? 'badge-ready' : 'badge-atrisk'}`}>{job.status}</span></div></div>)}
        </div>

        {/* Issues */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontWeight: 600 }}>Issues ({issues.length})</div>
            <button onClick={() => setShowIssueHistory(!showIssueHistory)} style={{ fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>{showIssueHistory ? 'Hide ▲' : 'View all ▼'}</button>
          </div>
          {openIssues.length === 0 && <div style={{ fontSize: 13, color: '#16a34a' }}>No open issues.</div>}
          {openIssues.map(issue => <div key={issue.id} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}><div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}><SeverityBadge s={issue.severity} /><span style={{ fontSize: 13, fontWeight: 500 }}>{issue.category}</span></div><div style={{ fontSize: 13, color: '#555' }}>{issue.description}</div></div>)}
          {showIssueHistory && issues.filter(i => i.status === 'Closed' || i.status === 'Fixed').map(issue => <div key={issue.id} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><div style={{ display: 'flex', gap: 6 }}><SeverityBadge s={issue.severity} /><span style={{ fontSize: 13 }}>{issue.category}</span></div><span className="badge badge-ready">{issue.status}</span></div><div style={{ fontSize: 13, color: '#888' }}>{issue.description}</div></div>)}
        </div>

        {/* Inventory - editable */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontWeight: 600 }}>Inventory</div>
            <button onClick={() => { if (editSection === 'inventory') { setEditSection(null) } else { setEditSection('inventory'); setEditInventory(restock.map(i => ({ ...i }))) } }} style={{ fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>{editSection === 'inventory' ? 'Cancel' : 'Edit'}</button>
          </div>
          {restock.length === 0 && <div style={{ fontSize: 13, color: '#aaa' }}>No inventory items.</div>}
          {editSection === 'inventory' ? (
            <div>
              {editInventory.map((item, idx) => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
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
          ) : restock.map(item => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
              <span style={{ fontSize: 13 }}>{item.item_name}</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span style={{ fontSize: 13, color: item.needs_restock ? '#dc2626' : '#16a34a' }}>{item.current_quantity}/{item.minimum_quantity}</span><span className={`badge ${item.needs_restock ? 'badge-notready' : 'badge-ready'}`}>{item.needs_restock ? 'Restock' : 'OK'}</span></div>
            </div>
          ))}
        </div>

        {/* Compliance - editable */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 600 }}>Compliance ({enrichedComp.length})</div>
            <button onClick={() => setShowCompForm(!showCompForm)} style={{ background: '#0a0a0a', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>{showCompForm ? 'Cancel' : '+ Add'}</button>
          </div>
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
        </div>
      </div>
    )
  }

  if (loading) return <div className="empty-state">Loading...</div>

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <input className="input-field" placeholder="Search properties..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1 }} />
        <button onClick={() => setShowPaused(!showPaused)} className="btn-secondary" style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}>{showPaused ? 'Active ▲' : 'Paused / Deleted'}</button>
        <button onClick={() => setShowAddForm(!showAddForm)} className="btn-primary" style={{ width: 'auto', padding: '8px 16px', whiteSpace: 'nowrap' }}>{showAddForm ? 'Cancel' : '+ Add property'}</button>
      </div>

      {showPaused && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 14 }}>Paused and deleted properties ({inactiveProps.length})</div>
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
      )}

      {showAddForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 16 }}>Add new property</div>
          <div className="form-group"><label className="label">Property name *</label><input className="input-field" placeholder="e.g. The Mill House" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /><FieldError msg={errors.name} /></div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#444', margin: '4px 0 10px' }}>Address</div>
          <div className="form-group"><label className="label">House / flat number *</label><input className="input-field" placeholder="e.g. 12 or Flat 4B" value={form.house_no} onChange={e => setForm({ ...form, house_no: e.target.value })} /><FieldError msg={errors.house_no} /></div>
          <div className="form-group"><label className="label">Street (Address line 1) *</label><input className="input-field" placeholder="e.g. Mill Lane" value={form.address_line1} onChange={e => setForm({ ...form, address_line1: e.target.value })} /><FieldError msg={errors.address_line1} /></div>
          <div className="form-group"><label className="label">Address line 2 (optional)</label><input className="input-field" placeholder="e.g. Headingley" value={form.address_line2} onChange={e => setForm({ ...form, address_line2: e.target.value })} /></div>
          <div className="form-group"><label className="label">City *</label><input className="input-field" placeholder="e.g. Leeds" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /><FieldError msg={errors.city} /></div>
          <div className="form-group"><label className="label">Postcode *</label><input className="input-field" placeholder="e.g. LS1 5DQ" value={form.postcode} onChange={e => setForm({ ...form, postcode: e.target.value })} style={{ textTransform: 'uppercase' }} /><FieldError msg={errors.postcode} /></div>
          <div className="form-group"><label className="label">Country</label><input className="input-field" value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} /></div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#444', margin: '4px 0 10px' }}>Property details</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="form-group" style={{ flex: 1 }}><label className="label">Bedrooms *</label><input className="input-field" type="number" min="1" placeholder="e.g. 2" value={form.bedroom} onChange={e => setForm({ ...form, bedroom: e.target.value })} /><FieldError msg={errors.bedroom} /></div>
            <div className="form-group" style={{ flex: 1 }}><label className="label">Bathrooms</label><input className="input-field" type="number" min="1" placeholder="e.g. 1" value={form.bathrooms} onChange={e => setForm({ ...form, bathrooms: e.target.value })} /></div>
          </div>
          <div className="form-group"><label className="label">Next check-in date and time</label><input className="input-field" type="datetime-local" value={form.next_checkin} onChange={e => setForm({ ...form, next_checkin: e.target.value })} /></div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#444', margin: '4px 0 10px' }}>Knowledge base</div>
          <div className="form-group"><label className="label">Access code</label><input className="input-field" placeholder="e.g. 4521#" value={form.access_code} onChange={e => setForm({ ...form, access_code: e.target.value })} /></div>
          <div className="form-group"><label className="label">Linen location</label><input className="input-field" placeholder="e.g. Airing cupboard on landing" value={form.linen_location} onChange={e => setForm({ ...form, linen_location: e.target.value })} /></div>
          <div className="form-group"><label className="label">Appliance notes</label><textarea className="input-field" rows={3} placeholder="Boiler location, special instructions..." value={form.appliance_notes} onChange={e => setForm({ ...form, appliance_notes: e.target.value })} /></div>
          <div className="form-group"><label className="label">Upload knowledge base (PDF, optional)</label><input type="file" accept=".pdf" className="input-field" style={{ padding: '8px' }} onChange={e => setForm({ ...form, knowledge_base_file: e.target.files[0] })} />{form.knowledge_base_file && <div style={{ fontSize: 12, color: '#16a34a', marginTop: 4 }}>✓ {form.knowledge_base_file.name}</div>}</div>
          <button className="btn-primary" onClick={saveProperty} disabled={saving}>{saving ? 'Saving...' : 'Save property'}</button>
        </div>
      )}

      {!activeProps.length && <div className="empty-state">No properties found.</div>}
      <div style={{ display: 'grid', gap: 12 }}>
        {activeProps.map(p => (
          <div key={p.id} className="card" style={{ cursor: 'pointer' }} onClick={() => openProperty(p)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div><div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{p.name}</div><div style={{ fontSize: 13, color: '#888', marginBottom: 6 }}>{p.address}</div><div style={{ fontSize: 12, color: '#aaa' }}>{p.bedroom} bed{p.bathrooms ? ` · ${p.bathrooms} bath` : ''} · Check-in: {p.next_checkin ? new Date(p.next_checkin).toLocaleDateString('en-GB') : 'Not set'}</div></div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}><StatusBadge status={p.readiness_status} /><span style={{ fontSize: 12, color: '#aaa' }}>Tap to view →</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── VENDOR DIRECTORY ─────────────────────────────────────────────────
function VendorDirectoryTab() {
  const [vendors, setVendors] = useState([])
  const [cleaners, setCleaners] = useState([])
  const [agencies, setAgencies] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('vendors')
  const [selected, setSelected] = useState(null)
  const [selectedType, setSelectedType] = useState(null)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [tradeFilter, setTradeFilter] = useState('all')
  const [vendorForm, setVendorForm] = useState({ name: '', phone: '', email: '', trade: 'Handyman', other_trade: '', agency_id: '' })
  const [cleanerForm, setCleanerForm] = useState({ name: '', phone: '', email: '', agency_name: 'No agency' })
  const [agencyForm, setAgencyForm] = useState({ name: '', contact_no: '', email: '', address: '', trade: '', website: '', details: '' })
  const tradeOptions = ['Plumber', 'Electrician', 'Handyman', 'Laundry', 'Cleaner', 'Other']
  const agencyTradeOptions = ['Cleaning', 'Maintenance', 'Multi-trade', 'Laundry', 'Property Management', 'Other']
  const tradeColors = { Plumber: '#dbeafe', Electrician: '#fef9c3', Handyman: '#dcfce7', Laundry: '#f3e8ff', Cleaner: '#e0f2fe', Other: '#f3f4f6' }
  const tradeText = { Plumber: '#1e40af', Electrician: '#854d0e', Handyman: '#166534', Laundry: '#6b21a8', Cleaner: '#0369a1', Other: '#374151' }

  useEffect(() => {
    Promise.all([supabase.from('Vendors').select('*'), supabase.from('Cleaners').select('*'), supabase.from('agencies').select('*')]).then(([v, c, a]) => {
      setVendors(v.data || []); setCleaners(c.data || []); setAgencies(a.data || []); setLoading(false)
    })
  }, [])

  async function openVendor(v) { setSelected(v); setSelectedType('vendor'); setHistoryLoading(true); const { data } = await supabase.from('issues').select('*').eq('vendor_id', v.id).order('created_at', { ascending: false }); setHistory(data || []); setHistoryLoading(false) }
  async function openCleaner(c) { setSelected(c); setSelectedType('cleaner'); setHistoryLoading(true); const { data } = await supabase.from('jobs').select('*').eq('cleaner_id', c.id).order('created_at', { ascending: false }); setHistory(data || []); setHistoryLoading(false) }

  function validateVendor() { const e = {}; if (!required(vendorForm.name)) e.name = 'Name is required'; if (!required(vendorForm.phone)) e.phone = 'Phone is required'; else if (!validatePhone(vendorForm.phone)) e.phone = 'Invalid phone'; if (!required(vendorForm.email)) e.email = 'Email is required'; else if (!validateEmail(vendorForm.email)) e.email = 'Invalid email'; if (vendorForm.trade === 'Other' && !required(vendorForm.other_trade)) e.other_trade = 'Please specify trade'; setErrors(e); return Object.keys(e).length === 0 }
  function validateCleaner() { const e = {}; if (!required(cleanerForm.name)) e.name = 'Name is required'; if (!required(cleanerForm.phone)) e.phone = 'Phone is required'; else if (!validatePhone(cleanerForm.phone)) e.phone = 'Invalid phone'; if (cleanerForm.email && !validateEmail(cleanerForm.email)) e.email = 'Invalid email'; setErrors(e); return Object.keys(e).length === 0 }
  function validateAgency() { const e = {}; if (!required(agencyForm.name)) e.name = 'Agency name is required'; if (agencyForm.email && !validateEmail(agencyForm.email)) e.email = 'Invalid email'; setErrors(e); return Object.keys(e).length === 0 }

  async function saveVendor() {
    if (!validateVendor()) return; setSaving(true)
    const finalTrade = vendorForm.trade === 'Other' ? vendorForm.other_trade : vendorForm.trade
    const agencyName = vendorForm.agency_id ? agencies.find(a => String(a.id) === String(vendorForm.agency_id))?.name || 'No agency' : 'No agency'
    const { data } = await supabase.from('Vendors').insert({ name: vendorForm.name, phone: vendorForm.phone, email: vendorForm.email, trade: finalTrade, agency_name: agencyName }).select()
    setVendors(prev => [...prev, ...(data || [])]); setVendorForm({ name: '', phone: '', email: '', trade: 'Handyman', other_trade: '', agency_id: '' }); setShowForm(false); setErrors({}); setSaving(false)
  }
  async function saveCleaner() { if (!validateCleaner()) return; setSaving(true); const { data } = await supabase.from('Cleaners').insert({ ...cleanerForm }).select(); setCleaners(prev => [...prev, ...(data || [])]); setCleanerForm({ name: '', phone: '', email: '', agency_name: 'No agency' }); setShowForm(false); setErrors({}); setSaving(false) }
  async function saveAgency() { if (!validateAgency()) return; setSaving(true); const { data } = await supabase.from('agencies').insert({ name: agencyForm.name, contact_no: agencyForm.contact_no, email: agencyForm.email, address: agencyForm.address, trade: agencyForm.trade || null, website: agencyForm.website || null, details: agencyForm.details || null }).select(); setAgencies(prev => [...prev, ...(data || [])]); setAgencyForm({ name: '', contact_no: '', email: '', address: '', trade: '', website: '', details: '' }); setShowForm(false); setErrors({}); setSaving(false) }

  const allTrades = [...new Set(vendors.map(v => v.trade).filter(Boolean))]
  const filteredVendors = tradeFilter === 'all' ? vendors : vendors.filter(v => v.trade === tradeFilter)

  if (loading) return <div className="empty-state">Loading...</div>

  if (selected && selectedType === 'vendor') return (
    <div>
      <button onClick={() => { setSelected(null); setSelectedType(null) }} style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', marginBottom: 16, color: '#555' }}>← Back</button>
      <div className="card" style={{ marginBottom: 16 }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><div><div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{selected.name}</div><div style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>{selected.phone}</div><div style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>{selected.email}</div><div style={{ fontSize: 13, color: '#aaa' }}>{selected.agency_name !== 'No agency' ? `Agency: ${selected.agency_name}` : 'No agency'}</div></div><span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: tradeColors[selected.trade] || tradeColors.Other, color: tradeText[selected.trade] || tradeText.Other }}>{selected.trade}</span></div></div>
      <div style={{ fontWeight: 600, marginBottom: 12 }}>Issue history ({history.length})</div>
      {historyLoading && <div className="empty-state">Loading...</div>}
      {!historyLoading && !history.length && <div className="empty-state">No issues assigned yet.</div>}
      {!historyLoading && history.map(issue => <div key={issue.id} className="card" style={{ marginBottom: 8 }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><div style={{ fontWeight: 600 }}>{issue.category}</div><span className={`badge ${issue.status === 'Fixed' || issue.status === 'Closed' ? 'badge-ready' : 'badge-atrisk'}`}>{issue.status}</span></div><div style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>{issue.description}</div><div style={{ display: 'flex', gap: 8 }}><SeverityBadge s={issue.severity} /><span style={{ fontSize: 12, color: '#aaa' }}>{new Date(issue.created_at).toLocaleDateString('en-GB')}</span></div></div>)}
    </div>
  )

  if (selected && selectedType === 'cleaner') return (
    <div>
      <button onClick={() => { setSelected(null); setSelectedType(null) }} style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', marginBottom: 16, color: '#555' }}>← Back</button>
      <div className="card" style={{ marginBottom: 16 }}><div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{selected.name}</div><div style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>{selected.phone}</div><div style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>{selected.email}</div><div style={{ fontSize: 13, color: '#aaa' }}>{selected.agency_name !== 'No agency' ? `Agency: ${selected.agency_name}` : 'No agency'}</div></div>
      <div style={{ fontWeight: 600, marginBottom: 12 }}>Job history ({history.length})</div>
      {historyLoading && <div className="empty-state">Loading...</div>}
      {!historyLoading && !history.length && <div className="empty-state">No jobs yet.</div>}
      {!historyLoading && history.map(job => <div key={job.id} className="card" style={{ marginBottom: 8 }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><div style={{ fontWeight: 600 }}>{new Date(job.job_date).toLocaleDateString('en-GB')}</div><span className={`badge ${job.status === 'Complete' ? 'badge-ready' : 'badge-atrisk'}`}>{job.status}</span></div><span style={{ fontSize: 13, color: '#888' }}>{job.readiness_percent || 0}% · {job.completed_tasks || 0}/{job.total_tasks || 0} tasks</span></div>)}
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['vendors', 'cleaners', 'agencies'].map(t => <button key={t} onClick={() => { setTab(t); setShowForm(false); setErrors({}); setTradeFilter('all') }} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer', background: tab === t ? '#0a0a0a' : '#f0f0f0', color: tab === t ? '#fff' : '#555', border: 'none' }}>{t.charAt(0).toUpperCase() + t.slice(1)} ({(t === 'vendors' ? vendors : t === 'cleaners' ? cleaners : agencies).length})</button>)}
        </div>
        <button onClick={() => { setShowForm(!showForm); setErrors({}) }} className="btn-primary" style={{ width: 'auto', padding: '8px 14px', fontSize: 13 }}>{showForm ? 'Cancel' : `+ Add ${tab === 'vendors' ? 'vendor' : tab === 'cleaners' ? 'cleaner' : 'agency'}`}</button>
      </div>

      {tab === 'vendors' && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          <button onClick={() => setTradeFilter('all')} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: tradeFilter === 'all' ? '#0a0a0a' : '#f0f0f0', color: tradeFilter === 'all' ? '#fff' : '#555', border: 'none' }}>All trades</button>
          {allTrades.map(t => <button key={t} onClick={() => setTradeFilter(t)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: tradeFilter === t ? (tradeColors[t] || '#f0f0f0') : '#f0f0f0', color: tradeFilter === t ? (tradeText[t] || '#555') : '#555', border: 'none' }}>{t}</button>)}
        </div>
      )}

      {showForm && tab === 'vendors' && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 16 }}>Add vendor</div>
          <div className="form-group"><label className="label">Name *</label><input className="input-field" placeholder="Full name" value={vendorForm.name} onChange={e => setVendorForm({ ...vendorForm, name: e.target.value })} /><FieldError msg={errors.name} /></div>
          <div className="form-group"><label className="label">Phone *</label><input className="input-field" placeholder="07xxx xxxxxx" value={vendorForm.phone} onChange={e => setVendorForm({ ...vendorForm, phone: e.target.value })} /><FieldError msg={errors.phone} /></div>
          <div className="form-group"><label className="label">Email *</label><input className="input-field" type="email" placeholder="email@example.com" value={vendorForm.email} onChange={e => setVendorForm({ ...vendorForm, email: e.target.value })} /><FieldError msg={errors.email} /></div>
          <div className="form-group"><label className="label">Trade *</label><select className="input-field" value={vendorForm.trade} onChange={e => setVendorForm({ ...vendorForm, trade: e.target.value })}>{tradeOptions.map(t => <option key={t}>{t}</option>)}</select></div>
          {vendorForm.trade === 'Other' && <div className="form-group"><label className="label">Specify trade *</label><input className="input-field" placeholder="e.g. Glazier, Locksmith..." value={vendorForm.other_trade} onChange={e => setVendorForm({ ...vendorForm, other_trade: e.target.value })} /><FieldError msg={errors.other_trade} /></div>}
          <div className="form-group">
            <label className="label">Agency</label>
            <select className="input-field" value={vendorForm.agency_id} onChange={e => setVendorForm({ ...vendorForm, agency_id: e.target.value })}>
              <option value="">No agency</option>
              {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <button className="btn-primary" onClick={saveVendor} disabled={saving}>{saving ? 'Saving...' : 'Save vendor'}</button>
        </div>
      )}
      {showForm && tab === 'cleaners' && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 16 }}>Add cleaner</div>
          <div className="form-group"><label className="label">Name *</label><input className="input-field" placeholder="Full name" value={cleanerForm.name} onChange={e => setCleanerForm({ ...cleanerForm, name: e.target.value })} /><FieldError msg={errors.name} /></div>
          <div className="form-group"><label className="label">Phone *</label><input className="input-field" placeholder="07xxx xxxxxx" value={cleanerForm.phone} onChange={e => setCleanerForm({ ...cleanerForm, phone: e.target.value })} /><FieldError msg={errors.phone} /></div>
          <div className="form-group"><label className="label">Email</label><input className="input-field" type="email" placeholder="email@example.com" value={cleanerForm.email} onChange={e => setCleanerForm({ ...cleanerForm, email: e.target.value })} /><FieldError msg={errors.email} /></div>
          <div className="form-group"><label className="label">Agency</label><select className="input-field" value={cleanerForm.agency_name} onChange={e => setCleanerForm({ ...cleanerForm, agency_name: e.target.value })}><option value="No agency">No agency</option>{agencies.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}</select></div>
          <button className="btn-primary" onClick={saveCleaner} disabled={saving}>{saving ? 'Saving...' : 'Save cleaner'}</button>
        </div>
      )}
      {showForm && tab === 'agencies' && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 16 }}>Add agency</div>
          <div className="form-group"><label className="label">Agency name *</label><input className="input-field" placeholder="Agency name" value={agencyForm.name} onChange={e => setAgencyForm({ ...agencyForm, name: e.target.value })} /><FieldError msg={errors.name} /></div>
          <div className="form-group"><label className="label">Trade / type</label><select className="input-field" value={agencyForm.trade} onChange={e => setAgencyForm({ ...agencyForm, trade: e.target.value })}><option value="">Select trade</option>{agencyTradeOptions.map(t => <option key={t}>{t}</option>)}</select></div>
          <div className="form-group"><label className="label">Contact number</label><input className="input-field" placeholder="07xxx xxxxxx" value={agencyForm.contact_no} onChange={e => setAgencyForm({ ...agencyForm, contact_no: e.target.value })} /></div>
          <div className="form-group"><label className="label">Email</label><input className="input-field" type="email" placeholder="email@example.com" value={agencyForm.email} onChange={e => setAgencyForm({ ...agencyForm, email: e.target.value })} /><FieldError msg={errors.email} /></div>
          <div className="form-group"><label className="label">Address</label><input className="input-field" placeholder="Full address" value={agencyForm.address} onChange={e => setAgencyForm({ ...agencyForm, address: e.target.value })} /></div>
          <div className="form-group"><label className="label">Website (optional)</label><input className="input-field" placeholder="https://example.com" value={agencyForm.website} onChange={e => setAgencyForm({ ...agencyForm, website: e.target.value })} /></div>
          <div className="form-group"><label className="label">Details (optional)</label><textarea className="input-field" rows={3} placeholder="Additional notes about this agency..." value={agencyForm.details} onChange={e => setAgencyForm({ ...agencyForm, details: e.target.value })} /></div>
          <button className="btn-primary" onClick={saveAgency} disabled={saving}>{saving ? 'Saving...' : 'Save agency'}</button>
        </div>
      )}

      {tab === 'vendors' && <div style={{ display: 'grid', gap: 10 }}>{!filteredVendors.length && <div className="empty-state">No vendors found.</div>}{filteredVendors.map(v => <div key={v.id} className="card" style={{ padding: '14px 16px', cursor: 'pointer' }} onClick={() => openVendor(v)}><div style={{ display: 'flex', justifyContent: 'space-between' }}><div><div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{v.name}</div><div style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>{v.phone}</div><div style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>{v.email}</div><div style={{ fontSize: 13, color: '#aaa' }}>{v.agency_name !== 'No agency' ? `Agency: ${v.agency_name}` : 'No agency'}</div></div><div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}><span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: tradeColors[v.trade] || tradeColors.Other, color: tradeText[v.trade] || tradeText.Other }}>{v.trade}</span><span style={{ fontSize: 12, color: '#aaa' }}>History →</span></div></div></div>)}</div>}
      {tab === 'cleaners' && <div style={{ display: 'grid', gap: 10 }}>{!cleaners.length && <div className="empty-state">No cleaners yet.</div>}{cleaners.map(c => <div key={c.id} className="card" style={{ padding: '14px 16px', cursor: 'pointer' }} onClick={() => openCleaner(c)}><div style={{ display: 'flex', justifyContent: 'space-between' }}><div><div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{c.name}</div><div style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>{c.phone}</div><div style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>{c.email}</div><div style={{ fontSize: 13, color: '#aaa' }}>{c.agency_name !== 'No agency' ? `Agency: ${c.agency_name}` : 'No agency'}</div></div><span style={{ fontSize: 12, color: '#aaa' }}>History →</span></div></div>)}</div>}
      {tab === 'agencies' && <div style={{ display: 'grid', gap: 10 }}>{!agencies.length && <div className="empty-state">No agencies yet.</div>}{agencies.map(a => <div key={a.id} className="card" style={{ padding: '14px 16px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}><div><div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{a.name}</div><div style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>{a.contact_no}</div><div style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>{a.email}</div><div style={{ fontSize: 13, color: '#aaa', marginBottom: 2 }}>{a.address}</div>{a.website && <a href={a.website} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#2563eb' }}>{a.website}</a>}{a.details && <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>{a.details}</div>}</div>{a.trade && <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: '#f0f0f0', color: '#444' }}>{a.trade}</span>}</div></div>)}</div>}
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
function InventoryTab() {
  const [items, setItems] = useState([])
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPropertyId, setSelectedPropertyId] = useState('all')
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

  const filtered = selectedPropertyId === 'all' ? items : items.filter(item => String(item.property_id) === String(selectedPropertyId))
  const needsRestockCount = filtered.filter(i => i.needs_restock).length
  if (loading) return <div className="empty-state">Loading inventory...</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <select className="input-field" style={{ maxWidth: 260, padding: '8px 12px' }} value={selectedPropertyId} onChange={e => setSelectedPropertyId(e.target.value)}><option value="all">All properties</option>{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        {needsRestockCount > 0 && <span className="badge badge-notready">{needsRestockCount} need restock</span>}
        {needsRestockCount === 0 && filtered.length > 0 && <span className="badge badge-ready">All stocked</span>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {editMode ? <><button onClick={() => setEditMode(false)} className="btn-secondary" style={{ padding: '8px 14px', fontSize: 13 }}>Cancel</button><button onClick={saveEdits} className="btn-primary" style={{ width: 'auto', padding: '8px 14px', fontSize: 13 }} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button></> : <button onClick={enterEditMode} className="btn-secondary" style={{ padding: '8px 14px', fontSize: 13 }}>Edit inventory</button>}
        </div>
      </div>
      {!filtered.length && <div className="empty-state">{selectedPropertyId === 'all' ? 'No inventory items yet.' : 'No inventory items for this property.'}</div>}
      {filtered.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead><tr style={{ background: '#f4f4f4' }}>{(selectedPropertyId === 'all' ? ['Property', 'Item', 'Min', 'Current', 'Status'] : ['Item', 'Min', 'Current', 'Status']).map(h => <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: 13, color: '#444', borderBottom: '1px solid #e0e0e0' }}>{h}</th>)}</tr></thead>
            <tbody>
              {filtered.map((item, i) => (
                <tr key={item.id} style={{ background: item.needs_restock ? '#fff8f8' : i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  {selectedPropertyId === 'all' && <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0', color: '#555' }}>{properties.find(p => String(p.id) === String(item.property_id))?.name || '—'}</td>}
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0', fontWeight: 500 }}>{item.item_name}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0', textAlign: 'center' }}>{editMode ? <input type="number" min="0" style={{ width: 52, padding: '4px 6px', border: '1px solid #e0e0e0', borderRadius: 6, fontSize: 13, textAlign: 'center' }} value={editValues[item.id]?.minimum_quantity ?? item.minimum_quantity} onChange={e => setEditValues(prev => ({ ...prev, [item.id]: { ...prev[item.id], minimum_quantity: e.target.value } }))} /> : <span style={{ color: '#888' }}>{item.minimum_quantity}</span>}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0', textAlign: 'center' }}>{editMode ? <input type="number" min="0" style={{ width: 52, padding: '4px 6px', border: '1px solid #e0e0e0', borderRadius: 6, fontSize: 13, textAlign: 'center' }} value={editValues[item.id]?.current_quantity ?? item.current_quantity} onChange={e => setEditValues(prev => ({ ...prev, [item.id]: { ...prev[item.id], current_quantity: e.target.value } }))} /> : <span style={{ color: item.needs_restock ? '#dc2626' : '#16a34a', fontWeight: 600 }}>{item.current_quantity}</span>}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0' }}><span className={`badge ${item.needs_restock ? 'badge-notready' : 'badge-ready'}`}>{item.needs_restock ? 'Needs restock' : 'Enough'}</span></td>
                </tr>
              ))}
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

  useEffect(() => {
    Promise.all([supabase.from('jobs').select('*').order('job_date', { ascending: false }), supabase.from('Properties').select('id, name'), supabase.from('Cleaners').select('id, name')]).then(([j, p, c]) => { setJobs(j.data || []); setProperties(p.data || []); setCleaners(c.data || []); setLoading(false) })
  }, [])

  const filtered = jobs.filter(j => (statusFilter === 'all' || j.status === statusFilter) && (propertyFilter === 'all' || String(j.property_id) === String(propertyFilter)))
  if (loading) return <div className="empty-state">Loading jobs...</div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['all', 'Not started', 'In progress', 'Complete'].map(f => <button key={f} onClick={() => setStatusFilter(f)} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer', background: statusFilter === f ? '#0a0a0a' : '#f0f0f0', color: statusFilter === f ? '#fff' : '#555', border: 'none' }}>{f === 'all' ? 'All statuses' : f}</button>)}
          </div>
          <select className="input-field" style={{ maxWidth: 260, padding: '7px 12px', fontSize: 13 }} value={propertyFilter} onChange={e => setPropertyFilter(e.target.value)}><option value="all">All properties</option>{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        </div>
        <button onClick={onCreateJob} className="btn-primary" style={{ width: 'auto', padding: '8px 14px', fontSize: 13 }}>+ Create job</button>
      </div>
      {!filtered.length && <div className="empty-state">No jobs found.</div>}
      <div style={{ display: 'grid', gap: 10 }}>
        {filtered.map(job => <div key={job.id} className="card"><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}><div><div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{properties.find(p => String(p.id) === String(job.property_id))?.name || '—'}</div><div style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>Cleaner: {cleaners.find(c => String(c.id) === String(job.cleaner_id))?.name || '—'}</div><div style={{ fontSize: 13, color: '#888' }}>Date: {job.job_date ? new Date(job.job_date).toLocaleDateString('en-GB') : '—'}{job.checkin_time && ` · Check-in: ${new Date(job.checkin_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}</div>{job.notes && <div style={{ fontSize: 13, color: '#aaa', marginTop: 4 }}>Note: {job.notes}</div>}</div><span className={`badge ${job.status === 'Complete' ? 'badge-ready' : job.status === 'In progress' ? 'badge-atrisk' : 'badge-notready'}`}>{job.status || 'Not started'}</span></div><div style={{ height: 6, background: '#f0f0f0', borderRadius: 3 }}><div style={{ height: 6, borderRadius: 3, width: `${job.readiness_percent || 0}%`, background: job.readiness_percent === 100 ? '#16a34a' : '#d97706' }} /></div><div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{job.readiness_percent || 0}% · {job.completed_tasks || 0}/{job.total_tasks || 0} tasks</div></div>)}
      </div>
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
