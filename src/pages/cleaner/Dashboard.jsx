import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

function parseKB(raw) {
  if (!raw) return {}
  try { return typeof raw === 'object' ? raw : JSON.parse(raw) } catch { return {} }
}

const GENERIC_CHECKLIST = [
  { room: 'Entrance & Hallway', task: 'Sweep or hoover floor', requires_photo: true },
  { room: 'Entrance & Hallway', task: 'Wipe surfaces and skirting boards', requires_photo: true },
  { room: 'Entrance & Hallway', task: 'Clean mirrors', requires_photo: true },
  { room: 'Entrance & Hallway', task: 'Check for forgotten items', requires_photo: true },
  { room: 'Living Room', task: 'Hoover carpet or mop floor', requires_photo: true },
  { room: 'Living Room', task: 'Dust all surfaces', requires_photo: true },
  { room: 'Living Room', task: 'Wipe windows and mirrors', requires_photo: true },
  { room: 'Living Room', task: 'Empty bins', requires_photo: true },
  { room: 'Living Room', task: 'Arrange cushions and throws neatly', requires_photo: true },
  { room: 'Kitchen', task: 'Clean hob and oven exterior', requires_photo: true },
  { room: 'Kitchen', task: 'Wipe all countertops and surfaces', requires_photo: true },
  { room: 'Kitchen', task: 'Clean sink and taps', requires_photo: true },
  { room: 'Kitchen', task: 'Empty bins and replace bin bags', requires_photo: true },
  { room: 'Kitchen', task: 'Check dishwasher is empty and clean', requires_photo: true },
  { room: 'Kitchen', task: 'Wipe microwave, kettle and toaster', requires_photo: true },
  { room: 'Kitchen', task: 'Mop kitchen floor', requires_photo: true },
  { room: 'Bathroom', task: 'Clean toilet inside and outside', requires_photo: true },
  { room: 'Bathroom', task: 'Clean sink and taps', requires_photo: true },
  { room: 'Bathroom', task: 'Clean shower or bath', requires_photo: true },
  { room: 'Bathroom', task: 'Wipe mirrors', requires_photo: true },
  { room: 'Bathroom', task: 'Replace towels with fresh set', requires_photo: true },
  { room: 'Bathroom', task: 'Mop bathroom floor', requires_photo: true },
  { room: 'Bathroom', task: 'Restock toiletries', requires_photo: true },
  { room: 'Bedrooms', task: 'Change all bed linen', requires_photo: true },
  { room: 'Bedrooms', task: 'Hoover or mop bedroom floors', requires_photo: true },
  { room: 'Bedrooms', task: 'Dust all surfaces and furniture', requires_photo: true },
  { room: 'Bedrooms', task: 'Empty bins', requires_photo: true },
  { room: 'Bedrooms', task: 'Check under beds and in wardrobes', requires_photo: true },
  { room: 'Final Checks', task: 'Check all lights are working', requires_photo: true },
  { room: 'Final Checks', task: 'Close all windows', requires_photo: true },
  { room: 'Final Checks', task: 'Set heating to correct temperature', requires_photo: true },
  { room: 'Final Checks', task: 'Property is locked and secure', requires_photo: true },
  { room: 'Inventory', task: 'Update stock levels for all items', requires_photo: false },
]

const KB_SECTIONS = [
  { key: 'access', label: 'Access & entry', fields: [
    { key: 'access_code', label: 'Access code' },
    { key: 'lockbox_location', label: 'Lockbox location' },
    { key: 'key_instructions', label: 'Key instructions' },
    { key: 'parking_instructions', label: 'Parking' },
  ]},
  { key: 'layout', label: 'Property layout', fields: [
    { key: 'room_layout', label: 'Room layout' },
    { key: 'fire_exits', label: 'Fire exits' },
    { key: 'garden_access', label: 'Garden access' },
  ]},
  { key: 'linen', label: 'Linen & laundry', fields: [
    { key: 'linen_location', label: 'Linen location' },
    { key: 'linen_rooms', label: 'What goes where' },
    { key: 'washing_machine', label: 'Washing machine' },
  ]},
  { key: 'appliances', label: 'Appliances', fields: [
    { key: 'boiler', label: 'Boiler' },
    { key: 'dishwasher', label: 'Dishwasher' },
    { key: 'tv_remote', label: 'TV & remote' },
    { key: 'other_appliances', label: 'Other appliances' },
  ]},
  { key: 'utilities', label: 'Utilities', fields: [
    { key: 'wifi', label: 'Wifi' },
    { key: 'wifi_router_location', label: 'Router location' },
    { key: 'fuse_box', label: 'Fuse box' },
    { key: 'stopcock', label: 'Stopcock' },
    { key: 'heating', label: 'Heating controls' },
  ]},
  { key: 'stocks', label: 'Stocks & supplies', fields: [
    { key: 'cleaning_products', label: 'Cleaning products' },
    { key: 'toiletries', label: 'Guest toiletries' },
    { key: 'kitchen_supplies', label: 'Kitchen supplies' },
    { key: 'towels', label: 'Towels location' },
  ]},
  { key: 'bins', label: 'Bins & waste', fields: [
    { key: 'bins', label: 'Bin locations' },
    { key: 'bin_collection', label: 'Collection day' },
    { key: 'recycling', label: 'Recycling' },
  ]},
  { key: 'safety', label: 'Safety', fields: [
    { key: 'smoke_alarms', label: 'Smoke alarms' },
    { key: 'co_alarm', label: 'CO alarm' },
    { key: 'fire_extinguisher', label: 'Fire extinguisher' },
    { key: 'first_aid', label: 'First aid kit' },
  ]},
  { key: 'special', label: 'Special instructions', fields: [
    { key: 'quirks', label: 'Quirks to know' },
    { key: 'do_not', label: 'Do not' },
    { key: 'owner_preferences', label: 'Owner preferences' },
  ]},
]

function KBSection({ section, kb }) {
  const [open, setOpen] = useState(false)
  const hasData = section.fields.some(f => kb[f.key])
  if (!hasData) return null
  return (
    <div style={{ border: '0.5px solid #e0e0e0', borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
      <div onClick={() => setOpen(!open)} style={{ padding: '11px 14px', background: '#f7f7f7', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{section.label}</span>
        <span style={{ fontSize: 12, color: '#aaa' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ padding: 14 }}>
          {section.fields.filter(f => kb[f.key]).map(field => (
            <div key={field.key} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: '#aaa', marginBottom: 3 }}>{field.label}</div>
              <div style={{ fontSize: 14, color: '#333' }}>{kb[field.key]}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function IssueModal({ job, task, onClose, onSubmit }) {
  const [form, setForm] = useState({ category: 'Maintenance', severity: 'Medium', description: '', photo: null })
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    setSubmitting(true)
    let photoUrl = null
    if (form.photo) {
      const ext = form.photo.name.split('.').pop()
      const path = `issues/${Date.now()}.${ext}`
      await supabase.storage.from('uploads').upload(path, form.photo)
      const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(path)
      photoUrl = urlData.publicUrl
    }
    await supabase.from('issues').insert({
      property_id: job.property_id, job_id: job.id,
      category: form.category, severity: form.severity,
      description: `[Task: ${task}] ${form.description}`,
      status: 'Open', issue_photo_url: photoUrl,
    })
    onSubmit()
    onClose()
    setSubmitting(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}>
      <div style={{ background: '#fff', borderRadius: '16px 16px 0 0', padding: 20, width: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontWeight: 600, fontSize: 16 }}>Report issue</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#aaa' }}>×</button>
        </div>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 14, background: '#f7f7f7', padding: '8px 12px', borderRadius: 8 }}>Task: {task}</div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>Category</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['Cleaning', 'Maintenance', 'Laundry', 'Safety', 'Stock', 'Access'].map(c => (
              <button key={c} onClick={() => setForm({ ...form, category: c })} style={{ padding: '6px 12px', borderRadius: 20, fontSize: 12, border: 'none', cursor: 'pointer', background: form.category === c ? '#0a0a0a' : '#f0f0f0', color: form.category === c ? '#fff' : '#555' }}>{c}</button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>Severity</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['Low', 'Medium', 'High', 'Critical'].map(s => (
              <button key={s} onClick={() => setForm({ ...form, severity: s })} style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 12, border: 'none', cursor: 'pointer', background: form.severity === s ? '#0a0a0a' : '#f0f0f0', color: form.severity === s ? '#fff' : '#555' }}>{s}</button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>Description *</div>
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Describe the issue..." style={{ width: '100%', padding: '10px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 14, resize: 'none', boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>Photo proof</div>
          <input type="file" accept="image/*" capture="environment" onChange={e => setForm({ ...form, photo: e.target.files[0] })} style={{ fontSize: 13 }} />
          {form.photo && <div style={{ fontSize: 12, color: '#16a34a', marginTop: 4 }}>✓ {form.photo.name}</div>}
        </div>
        <button onClick={submit} disabled={submitting || !form.description.trim()} style={{ width: '100%', padding: 14, background: '#dc2626', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{submitting ? 'Reporting...' : 'Report issue'}</button>
      </div>
    </div>
  )
}

function generateReport(job, property, cleanerRecord, items, restockItems) {
  const started = job.started_at ? new Date(job.started_at).toLocaleString('en-GB') : 'N/A'
  const completed = job.completed_at ? new Date(job.completed_at).toLocaleString('en-GB') : new Date().toLocaleString('en-GB')
  const doneTasks = items.filter(i => i.done)
  const agency = cleanerRecord.agency_name && cleanerRecord.agency_name !== 'No agency' ? cleanerRecord.agency_name : null

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Job Report — ${property?.name}</title>
<style>
body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:20px;color:#333}
h1{font-size:24px;margin-bottom:4px}
.subtitle{color:#888;font-size:14px;margin-bottom:30px}
.section{margin-bottom:24px}
.section-title{font-size:16px;font-weight:bold;border-bottom:2px solid #0a0a0a;padding-bottom:6px;margin-bottom:12px}
.row{display:flex;gap:20px;margin-bottom:8px}
.label{color:#888;font-size:13px;width:140px;flex-shrink:0}
.value{font-size:13px;color:#333}
.task{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f0f0f0}
.tick{width:18px;height:18px;border-radius:4px;background:#16a34a;color:#fff;font-size:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.room-header{font-weight:bold;font-size:13px;background:#f7f7f7;padding:6px 10px;margin-top:12px;border-radius:4px}
.badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:bold;background:#dcfce7;color:#166534}
@media print{button{display:none}}
</style>
</head>
<body>
<h1>Job Completion Report</h1>
<div class="subtitle">Generated ${new Date().toLocaleString('en-GB')}</div>

<div class="section">
<div class="section-title">Property</div>
<div class="row"><div class="label">Property name</div><div class="value">${property?.name || '—'}</div></div>
<div class="row"><div class="label">Address</div><div class="value">${property?.address || '—'}</div></div>
<div class="row"><div class="label">Job date</div><div class="value">${job.job_date ? new Date(job.job_date).toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' }) : '—'}</div></div>
</div>

<div class="section">
<div class="section-title">Assignee</div>
<div class="row"><div class="label">Cleaner</div><div class="value">${cleanerRecord.name}</div></div>
${agency ? `<div class="row"><div class="label">Agency</div><div class="value">${agency}</div></div>` : ''}
<div class="row"><div class="label">Phone</div><div class="value">${cleanerRecord.phone || '—'}</div></div>
<div class="row"><div class="label">Email</div><div class="value">${cleanerRecord.email || '—'}</div></div>
</div>

<div class="section">
<div class="section-title">Timeline</div>
<div class="row"><div class="label">Job started</div><div class="value">${started}</div></div>
<div class="row"><div class="label">Job completed</div><div class="value">${completed}</div></div>
<div class="row"><div class="label">Status</div><div class="value"><span class="badge">Complete</span></div></div>
<div class="row"><div class="label">Tasks completed</div><div class="value">${doneTasks.length} / ${items.length}</div></div>
</div>

<div class="section">
<div class="section-title">Checklist</div>
${[...new Set(items.map(i => i.room))].map(room => `
<div class="room-header">${room}</div>
${items.filter(i => i.room === room).map(item => `
<div class="task">
<div class="tick">${item.done ? '✓' : '—'}</div>
<div style="flex:1;font-size:13px">${item.task}</div>
${item.photo_url ? '<div style="font-size:12px;color:#16a34a">📷 Photo</div>' : ''}
</div>`).join('')}`).join('')}
</div>

${restockItems && restockItems.length > 0 ? `
<div class="section">
<div class="section-title">Inventory update</div>
${restockItems.map(r => `<div class="row"><div class="label">${r.item_name}</div><div class="value">${r.current_quantity} (min: ${r.minimum_quantity}) ${r.needs_restock ? '⚠️ Low' : '✓'}</div></div>`).join('')}
</div>` : ''}

<button onclick="window.print()" style="padding:12px 24px;background:#0a0a0a;color:#fff;border:none;border-radius:8px;font-size:14px;cursor:pointer;margin-top:20px">Print / Save as PDF</button>
</body>
</html>`

  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `job-report-${property?.name?.replace(/\s+/g, '-')}-${job.job_date}.html`
  a.click()
  URL.revokeObjectURL(url)
}

// ── ASSIGNED JOBS TAB ─────────────────────────────────────────────────
function AssignedJobsTab({ cleanerRecord, onJobOpen }) {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!cleanerRecord) return
    async function load() {
      const today = new Date().toISOString().split('T')[0]
      const { data: jobData } = await supabase.from('jobs').select('*').eq('cleaner_id', cleanerRecord.id).not('status', 'eq', 'Complete').gte('job_date', today).order('job_date', { ascending: true })
      if (!jobData?.length) { setLoading(false); return }
      const propIds = [...new Set(jobData.map(j => j.property_id))]
      const { data: propData } = await supabase.from('Properties').select('id, name, address').in('id', propIds)
      const propMap = {}
      if (propData) propData.forEach(p => { propMap[p.id] = p })
      setJobs(jobData.map(j => ({ ...j, property: propMap[j.property_id] })))
      setLoading(false)
    }
    load()
  }, [cleanerRecord])

  if (!cleanerRecord || loading) return <div style={{ padding: 60, textAlign: 'center', color: '#aaa' }}>Loading...</div>

  if (!jobs.length) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
      <div style={{ fontWeight: 500, fontSize: 16, marginBottom: 6 }}>No jobs assigned</div>
      <div style={{ fontSize: 13, color: '#aaa' }}>Your operator will assign jobs here.</div>
    </div>
  )

  const today = new Date().toISOString().split('T')[0]
  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 14 }}>{jobs.length} upcoming job{jobs.length !== 1 ? 's' : ''}</div>
      {jobs.map(job => {
        const isToday = job.job_date === today
        const isTomorrow = job.job_date === new Date(Date.now() + 86400000).toISOString().split('T')[0]
        const dateLabel = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : new Date(job.job_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
        return (
          <div key={job.id} onClick={() => onJobOpen(job)} style={{ background: '#fff', borderRadius: 14, border: `1.5px solid ${isToday ? '#0a0a0a' : '#e0e0e0'}`, padding: 16, marginBottom: 10, cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 16 }}>{job.property?.name || '—'}</div>
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 500, background: isToday ? '#0a0a0a' : '#f0f0f0', color: isToday ? '#fff' : '#555' }}>{dateLabel}</span>
            </div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>{job.property?.address}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: job.status === 'In progress' ? '#fef9c3' : '#f0f0f0', color: job.status === 'In progress' ? '#854d0e' : '#555', fontWeight: 500 }}>{job.status || 'Not started'}</span>
              {job.checkin_time && <span style={{ fontSize: 12, color: '#888' }}>Check-in {new Date(job.checkin_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>}
            </div>
            {job.notes && <div style={{ fontSize: 12, color: '#2563eb', marginTop: 8, background: '#eff6ff', padding: '6px 10px', borderRadius: 6 }}>📝 {job.notes}</div>}
          </div>
        )
      })}
    </div>
  )
}

// ── COMPLETED JOBS TAB ────────────────────────────────────────────────
function CompletedJobsTab({ cleanerRecord, onJobOpen }) {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!cleanerRecord) return
    async function load() {
      const { data: jobData } = await supabase.from('jobs').select('*').eq('cleaner_id', cleanerRecord.id).eq('status', 'Complete').order('job_date', { ascending: false })
      if (!jobData?.length) { setLoading(false); return }
      const propIds = [...new Set(jobData.map(j => j.property_id))]
      const { data: propData } = await supabase.from('Properties').select('id, name, address').in('id', propIds)
      const propMap = {}
      if (propData) propData.forEach(p => { propMap[p.id] = p })
      setJobs(jobData.map(j => ({ ...j, property: propMap[j.property_id] })))
      setLoading(false)
    }
    load()
  }, [cleanerRecord])

  if (!cleanerRecord || loading) return <div style={{ padding: 60, textAlign: 'center', color: '#aaa' }}>Loading...</div>

  if (!jobs.length) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
      <div style={{ fontWeight: 500, fontSize: 16, marginBottom: 6 }}>No completed jobs yet</div>
    </div>
  )

  return (
    <div style={{ padding: 16 }}>
      {jobs.map(job => (
        <div key={job.id} onClick={() => onJobOpen(job)} style={{ background: '#fff', borderRadius: 14, border: '0.5px solid #e0e0e0', padding: 16, marginBottom: 10, cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{job.property?.name || '—'}</div>
            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#dcfce7', color: '#166534', fontWeight: 500 }}>Complete</span>
          </div>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 6 }}>{job.property?.address}</div>
          <div style={{ fontSize: 12, color: '#aaa' }}>{new Date(job.job_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</div>
        </div>
      ))}
    </div>
  )
}

// ── JOB DETAIL VIEW ───────────────────────────────────────────────────
function JobDetailView({ job, cleanerRecord, onBack, onJobStarted, onJobCompleted }) {
  const [property, setProperty] = useState(null)
  const [items, setItems] = useState([])
  const [restockItems, setRestockItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [uploading, setUploading] = useState({})
  const [issueModal, setIssueModal] = useState(null)
  const [issueReported, setIssueReported] = useState({})
  const [view, setView] = useState(job.status === 'In progress' || job.status === 'Complete' ? 'checklist' : 'details')

  useEffect(() => {
    async function load() {
      const { data: prop } = await supabase.from('Properties').select('*').eq('id', job.property_id).single()
      setProperty(prop)
      const { data: checkItems } = await supabase.from('Checklist_items').select('*').eq('job_id', job.id).order('id', { ascending: true })
      setItems(checkItems || [])
      const { data: restock } = await supabase.from('restock').select('*').eq('property_id', job.property_id)
      setRestockItems(restock || [])
      setLoading(false)
    }
    load()
  }, [job.id])

  async function startJob() {
    setStarting(true)
    // Create checklist items if none exist
    const { data: existing } = await supabase.from('Checklist_items').select('id').eq('job_id', job.id).limit(1)
    if (!existing?.length) {
      const toInsert = GENERIC_CHECKLIST.map(item => ({ job_id: job.id, room: item.room, task: item.task, done: false, photo_url: null }))
      await supabase.from('Checklist_items').insert(toInsert)
    }
    await supabase.from('jobs').update({ status: 'In progress', started_at: new Date().toISOString() }).eq('id', job.id)
    // Reload items
    const { data: newItems } = await supabase.from('Checklist_items').select('*').eq('job_id', job.id).order('id', { ascending: true })
    setItems(newItems || [])
    setView('checklist')
    setStarting(false)
    onJobStarted && onJobStarted()
  }

  async function uploadPhoto(item, file) {
    setUploading(prev => ({ ...prev, [item.id]: true }))
    const ext = file.name.split('.').pop()
    const path = `checklist/${job.id}/${item.id}-${Date.now()}.${ext}`
    await supabase.storage.from('uploads').upload(path, file)
    const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(path)
    const { data } = await supabase.from('Checklist_items').update({ photo_url: urlData.publicUrl, done: true }).eq('id', item.id).select().single()
    const updated = items.map(i => i.id === item.id ? data : i)
    setItems(updated)
    const done = updated.filter(i => i.room !== 'Inventory' ? i.done && i.photo_url : i.done).length
    const total = updated.length
    await supabase.from('jobs').update({ completed_tasks: done, total_tasks: total, readiness_percent: Math.round((done / total) * 100) }).eq('id', job.id)
    setUploading(prev => ({ ...prev, [item.id]: false }))
  }

  async function toggleInventoryItem(item) {
    const newDone = !item.done
    await supabase.from('Checklist_items').update({ done: newDone }).eq('id', item.id)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, done: newDone } : i))
  }

  async function updateRestock(item, qty) {
    const val = parseInt(qty) || 0
    const needs = val < item.minimum_quantity
    const { data } = await supabase.from('restock').update({ current_quantity: val, needs_restock: needs }).eq('id', item.id).select().single()
    setRestockItems(prev => prev.map(r => r.id === item.id ? data : r))
  }

  async function completeJob() {
    setCompleting(true)
    await supabase.from('jobs').update({ status: 'Complete', readiness_percent: 100, completed_tasks: items.length, total_tasks: items.length, completed_at: new Date().toISOString() }).eq('id', job.id)
    setCompleting(false)
    onJobCompleted && onJobCompleted()
  }

  function downloadReport() {
    generateReport({ ...job }, property, cleanerRecord, items, restockItems)
  }

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: '#aaa' }}>Loading...</div>

  const kb = parseKB(property?.knowledge_base)
  const nonInvItems = items.filter(i => i.room !== 'Inventory')
  const invItems = items.filter(i => i.room === 'Inventory')
  const allNonInvDone = nonInvItems.length > 0 && nonInvItems.every(i => i.done && i.photo_url)
  const rooms = [...new Set(items.map(i => i.room))]
  const completedCount = nonInvItems.filter(i => i.done && i.photo_url).length
  const percent = nonInvItems.length > 0 ? Math.round((completedCount / nonInvItems.length) * 100) : 0
  const isComplete = job.status === 'Complete'

  return (
    <div style={{ paddingBottom: 20 }}>
      {/* Header */}
      <div style={{ background: '#0a0a0a', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={onBack} style={{ background: 'none', border: '1px solid #444', borderRadius: 8, padding: '6px 14px', fontSize: 13, cursor: 'pointer', color: '#fff' }}>← Back</button>
        <div style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>{property?.name}</div>
        <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 500, background: isComplete ? '#dcfce7' : job.status === 'In progress' ? '#fef9c3' : '#333', color: isComplete ? '#166534' : job.status === 'In progress' ? '#854d0e' : '#aaa' }}>{job.status || 'Not started'}</span>
      </div>

      {/* View switcher for in progress / complete */}
      {(job.status === 'In progress' || isComplete) && (
        <div style={{ display: 'flex', background: '#f7f7f7', borderBottom: '1px solid #e0e0e0' }}>
          <button onClick={() => setView('details')} style={{ flex: 1, padding: '10px', fontSize: 13, fontWeight: 500, border: 'none', background: view === 'details' ? '#fff' : 'transparent', cursor: 'pointer', color: view === 'details' ? '#0a0a0a' : '#888', borderBottom: view === 'details' ? '2px solid #0a0a0a' : '2px solid transparent' }}>Property info</button>
          <button onClick={() => setView('checklist')} style={{ flex: 1, padding: '10px', fontSize: 13, fontWeight: 500, border: 'none', background: view === 'checklist' ? '#fff' : 'transparent', cursor: 'pointer', color: view === 'checklist' ? '#0a0a0a' : '#888', borderBottom: view === 'checklist' ? '2px solid #0a0a0a' : '2px solid transparent' }}>Checklist {nonInvItems.length > 0 && `(${completedCount}/${nonInvItems.length})`}</button>
        </div>
      )}

      <div style={{ padding: 16 }}>
        {/* DETAILS VIEW */}
        {view === 'details' && (
          <div>
            <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e0e0e0', padding: 16, marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{property?.name}</div>
              <div style={{ fontSize: 13, color: '#888', marginBottom: 10 }}>{property?.address}</div>
              <div style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>{property?.bedroom} bed{property?.bathrooms ? ` · ${property.bathrooms} bath` : ''}</div>
              {job.job_date && <div style={{ fontSize: 13, color: '#555' }}>Job date: <strong>{new Date(job.job_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</strong></div>}
              {job.checkin_time && <div style={{ fontSize: 13, color: '#dc2626', marginTop: 4, fontWeight: 500 }}>⏰ Guest check-in: {new Date(job.checkin_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>}
              {job.notes && <div style={{ fontSize: 13, color: '#1e40af', marginTop: 8, background: '#eff6ff', padding: '8px 12px', borderRadius: 8 }}>📝 {job.notes}</div>}
            </div>

            {/* Access code */}
            {(kb.access_code || property?.access_code) && (
              <div style={{ background: '#0a0a0a', borderRadius: 12, padding: 20, marginBottom: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Access code</div>
                <div style={{ fontFamily: 'monospace', fontSize: 36, fontWeight: 700, color: '#fff', letterSpacing: 8 }}>{kb.access_code || property?.access_code}</div>
              </div>
            )}

            {/* Knowledge base */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Knowledge base</div>
              {KB_SECTIONS.map(section => <KBSection key={section.key} section={section} kb={kb} />)}
              {property?.knowledge_base_url && <a href={property.knowledge_base_url} target="_blank" rel="noreferrer" style={{ display: 'block', textAlign: 'center', padding: 14, background: '#fff', borderRadius: 12, border: '1px solid #e0e0e0', fontSize: 14, color: '#2563eb', fontWeight: 500 }}>📄 Full property guide</a>}
            </div>

            {job.status !== 'In progress' && job.status !== 'Complete' && (
              <button onClick={startJob} disabled={starting} style={{ width: '100%', padding: 16, background: '#0a0a0a', color: '#fff', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>{starting ? 'Starting...' : '▶ Start Job'}</button>
            )}
          </div>
        )}

        {/* CHECKLIST VIEW */}
        {view === 'checklist' && (
          <div>
            {/* Progress */}
            {!isComplete && nonInvItems.length > 0 && (
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e0e0e0', padding: 14, marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: '#888' }}>Progress</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{completedCount}/{nonInvItems.length} tasks · {percent}%</span>
                </div>
                <div style={{ height: 8, background: '#f0f0f0', borderRadius: 4 }}>
                  <div style={{ height: 8, borderRadius: 4, background: percent === 100 ? '#16a34a' : '#d97706', width: `${percent}%`, transition: 'width 0.3s' }} />
                </div>
              </div>
            )}

            {/* Tasks by room */}
            {rooms.filter(r => r !== 'Inventory').map(room => (
              <div key={room} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{room}</div>
                {items.filter(i => i.room === room).map(item => (
                  <div key={item.id} style={{ background: '#fff', borderRadius: 10, border: `1px solid ${item.done && item.photo_url ? '#bbf7d0' : '#e0e0e0'}`, padding: '12px 14px', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: item.done && item.photo_url ? 0 : 8 }}>
                      <div style={{ width: 24, height: 24, borderRadius: 6, border: `2px solid ${item.done && item.photo_url ? '#16a34a' : '#ccc'}`, background: item.done && item.photo_url ? '#16a34a' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {item.done && item.photo_url && <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>✓</span>}
                      </div>
                      <span style={{ flex: 1, fontSize: 14, color: item.done && item.photo_url ? '#888' : '#0a0a0a', textDecoration: item.done && item.photo_url ? 'line-through' : 'none' }}>{item.task}</span>
                      {issueReported[item.id] && <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 500 }}>⚠️ Reported</span>}
                    </div>
                    {!(item.done && item.photo_url) && !isComplete && (
                      <div style={{ display: 'flex', gap: 8, paddingLeft: 34 }}>
                        <label style={{ flex: 1, cursor: 'pointer' }}>
                          <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => e.target.files[0] && uploadPhoto(item, e.target.files[0])} />
                          <div style={{ padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500, background: '#0a0a0a', color: '#fff', textAlign: 'center', cursor: 'pointer' }}>
                            {uploading[item.id] ? 'Uploading...' : '📷 Take photo'}
                          </div>
                        </label>
                        <button onClick={() => setIssueModal(item)} style={{ padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500, background: '#fee2e2', color: '#dc2626', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>⚠️ Issue</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}

            {/* Inventory section */}
            {invItems.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Inventory update</div>
                {restockItems.map(item => (
                  <div key={item.id} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e0e0e0', padding: '12px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div><div style={{ fontSize: 14, fontWeight: 500 }}>{item.item_name}</div><div style={{ fontSize: 12, color: '#aaa' }}>Min: {item.minimum_quantity}</div></div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {!isComplete ? <input type="number" min="0" defaultValue={item.current_quantity || 0} onBlur={e => updateRestock(item, e.target.value)} style={{ width: 60, padding: '7px', border: '1.5px solid #e0e0e0', borderRadius: 8, fontSize: 16, textAlign: 'center', fontWeight: 600 }} /> : <span style={{ fontSize: 14, fontWeight: 600 }}>{item.current_quantity}</span>}
                      <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, background: item.needs_restock ? '#fee2e2' : '#dcfce7', color: item.needs_restock ? '#991b1b' : '#166534', fontWeight: 500 }}>{item.needs_restock ? 'Low' : 'OK'}</span>
                    </div>
                  </div>
                ))}
                {invItems.map(item => (
                  <div key={item.id} onClick={() => !isComplete && toggleInventoryItem(item)} style={{ background: '#fff', borderRadius: 10, border: `1px solid ${item.done ? '#bbf7d0' : '#e0e0e0'}`, padding: '12px 14px', marginBottom: 8, cursor: isComplete ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 6, border: `2px solid ${item.done ? '#16a34a' : '#ccc'}`, background: item.done ? '#16a34a' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {item.done && <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>✓</span>}
                    </div>
                    <span style={{ fontSize: 14, color: item.done ? '#888' : '#0a0a0a' }}>{item.task}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Action buttons */}
            {!isComplete && (
              <div style={{ marginTop: 8 }}>
                {allNonInvDone ? (
                  <div>
                    <button onClick={downloadReport} style={{ width: '100%', padding: 14, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 10 }}>📄 Download report</button>
                    <button onClick={completeJob} disabled={completing} style={{ width: '100%', padding: 14, background: '#16a34a', color: '#fff', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>{completing ? 'Completing...' : '✓ Complete job'}</button>
                  </div>
                ) : (
                  <button disabled style={{ width: '100%', padding: 14, background: '#f0f0f0', color: '#aaa', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'not-allowed' }}>Complete photos for all tasks first</button>
                )}
              </div>
            )}

            {isComplete && (
              <button onClick={downloadReport} style={{ width: '100%', padding: 14, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 8 }}>📄 Download report</button>
            )}
          </div>
        )}
      </div>

      {/* Issue modal */}
      {issueModal && (
        <IssueModal job={job} task={issueModal.task} onClose={() => setIssueModal(null)} onSubmit={() => setIssueReported(prev => ({ ...prev, [issueModal.id]: true }))} />
      )}
    </div>
  )
}

// ── PROFILE TAB ───────────────────────────────────────────────────────
function ProfileTab({ cleanerRecord }) {
  const [stats, setStats] = useState({ total: 0, completed: 0 })
  const [history, setHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    if (!cleanerRecord) return
    supabase.from('jobs').select('*, Properties(name)').eq('cleaner_id', cleanerRecord.id).order('job_date', { ascending: false })
      .then(({ data }) => {
        const jobs = data || []
        setHistory(jobs)
        setStats({ total: jobs.length, completed: jobs.filter(j => j.status === 'Complete').length })
      })
  }, [cleanerRecord])

  if (!cleanerRecord) return null

  return (
    <div style={{ padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, border: '0.5px solid #e0e0e0', padding: 16, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 20 }}>{cleanerRecord.name?.charAt(0) || 'C'}</span>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 18 }}>{cleanerRecord.name}</div>
            <div style={{ fontSize: 13, color: '#888' }}>{cleanerRecord.agency_name && cleanerRecord.agency_name !== 'No agency' ? cleanerRecord.agency_name : 'Independent'}</div>
          </div>
        </div>
        {[['Phone', cleanerRecord.phone], ['Email', cleanerRecord.email]].map(([l, v]) => (
          <div key={l} style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: '#aaa', width: 60 }}>{l}</span>
            <span style={{ fontSize: 13 }}>{v || 'Not set'}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div style={{ background: '#f7f7f7', borderRadius: 12, padding: 14, textAlign: 'center' }}>
          <div style={{ fontWeight: 600, fontSize: 28 }}>{stats.total}</div>
          <div style={{ fontSize: 12, color: '#888' }}>Total jobs</div>
        </div>
        <div style={{ background: '#f0fdf4', borderRadius: 12, padding: 14, textAlign: 'center' }}>
          <div style={{ fontWeight: 600, fontSize: 28, color: '#16a34a' }}>{stats.completed}</div>
          <div style={{ fontSize: 12, color: '#16a34a' }}>Completed</div>
        </div>
      </div>

      <div style={{ background: '#fff', borderRadius: 14, border: '0.5px solid #e0e0e0', padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showHistory ? 12 : 0 }}>
          <div style={{ fontWeight: 600 }}>Job history</div>
          <button onClick={() => setShowHistory(!showHistory)} style={{ fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}>{showHistory ? 'Hide ▲' : 'View all ▼'}</button>
        </div>
        {showHistory && history.map(j => (
          <div key={j.id} style={{ padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{j.Properties?.name || '—'}</span>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: j.status === 'Complete' ? '#dcfce7' : '#f0f0f0', color: j.status === 'Complete' ? '#166534' : '#555', fontWeight: 500 }}>{j.status}</span>
            </div>
            <div style={{ fontSize: 12, color: '#aaa' }}>{new Date(j.job_date).toLocaleDateString('en-GB')}</div>
          </div>
        ))}
      </div>

      <button onClick={() => supabase.auth.signOut()} style={{ width: '100%', padding: 14, background: '#fff', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 12, fontSize: 14, fontWeight: 500, cursor: 'pointer', marginTop: 14 }}>Sign out</button>
    </div>
  )
}

// ── MAIN ──────────────────────────────────────────────────────────────
export default function CleanerDashboard() {
  const [tab, setTab] = useState('assigned')
  const [cleanerRecord, setCleanerRecord] = useState(null)
  const [openJob, setOpenJob] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('Cleaners').select('*').eq('auth_user_id', user.id).single()
        .then(({ data }) => { if (data) setCleanerRecord(data) })
    })
  }, [])

  function handleJobCompleted() {
    setOpenJob(null)
    setTab('completed')
    setRefreshKey(k => k + 1)
  }

  const tabs = [
    { key: 'assigned', label: 'Assigned' },
    { key: 'completed', label: 'Completed' },
    { key: 'profile', label: 'Profile' },
  ]

  if (openJob) return (
    <div style={{ minHeight: '100vh', background: '#f7f7f7', maxWidth: 600, margin: '0 auto', overflowY: 'auto' }}>
      <JobDetailView
        job={openJob}
        cleanerRecord={cleanerRecord}
        onBack={() => setOpenJob(null)}
        onJobStarted={() => setRefreshKey(k => k + 1)}
        onJobCompleted={handleJobCompleted}
      />
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f7f7f7', display: 'flex', flexDirection: 'column', maxWidth: 600, margin: '0 auto' }}>
      <div style={{ background: '#0a0a0a', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 18, color: '#fff' }}>OpsLoom</span>
        {cleanerRecord && <span style={{ fontSize: 13, color: '#888' }}>{cleanerRecord.name}</span>}
      </div>

      <div style={{ display: 'flex', background: '#fff', borderBottom: '1px solid #e0e0e0' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ flex: 1, padding: '12px 8px', fontSize: 13, fontWeight: 500, border: 'none', background: 'none', cursor: 'pointer', color: tab === t.key ? '#0a0a0a' : '#888', borderBottom: tab === t.key ? '2px solid #0a0a0a' : '2px solid transparent' }}>{t.label}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'assigned' && <AssignedJobsTab key={`assigned-${refreshKey}`} cleanerRecord={cleanerRecord} onJobOpen={setOpenJob} />}
        {tab === 'completed' && <CompletedJobsTab key={`completed-${refreshKey}`} cleanerRecord={cleanerRecord} onJobOpen={setOpenJob} />}
        {tab === 'profile' && <ProfileTab cleanerRecord={cleanerRecord} />}
      </div>
    </div>
  )
}
