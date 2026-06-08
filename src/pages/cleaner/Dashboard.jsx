import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

function NavTab({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{ flex: 1, padding: '12px 6px', fontSize: 12, fontWeight: 500, background: active ? '#0a0a0a' : 'transparent', color: active ? '#fff' : '#888', border: 'none', cursor: 'pointer', borderRadius: 8 }}>
      {label}
    </button>
  )
}

function parseKB(raw) {
  if (!raw) return {}
  try { return typeof raw === 'object' ? raw : JSON.parse(raw) } catch { return {} }
}

function InfoCard({ label, value, warn }) {
  return (
    <div style={{ background: warn ? '#fff8ed' : '#fff', borderRadius: 10, padding: '12px 14px', marginBottom: 8, border: `1px solid ${warn ? '#fed7aa' : '#f0f0f0'}` }}>
      <div style={{ fontSize: 11, color: warn ? '#92400e' : '#aaa', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, color: warn ? '#92400e' : '#333' }}>{value}</div>
    </div>
  )
}

// ── JOB TAB ──────────────────────────────────────────────────────────
function JobTab({ cleanerRecord, onJobSelect }) {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedJobId, setSelectedJobId] = useState(null)
  const [checkingIn, setCheckingIn] = useState(false)

  useEffect(() => {
    if (!cleanerRecord) return
    const today = new Date().toISOString().split('T')[0]
    supabase.from('jobs').select('*, Properties(id, name, address, access_code, linen_location, appliance_notes, knowledge_base, knowledge_base_url)').eq('cleaner_id', cleanerRecord.id).gte('job_date', today).order('job_date', { ascending: true }).limit(10)
      .then(({ data }) => {
        setJobs(data || [])
        if (data?.[0]) { onJobSelect(data[0]); setSelectedJobId(data[0].id) }
        setLoading(false)
      })
  }, [cleanerRecord])

  async function checkIn(job) {
    setCheckingIn(true)
    const { data } = await supabase.from('jobs').update({ status: 'In progress' }).eq('id', job.id).select('*, Properties(*)').single()
    setJobs(prev => prev.map(j => j.id === job.id ? data : j))
    onJobSelect(data)
    setCheckingIn(false)
  }

  if (!cleanerRecord) return <div className="empty-state">Loading your profile...</div>
  if (loading) return <div className="empty-state">Loading your jobs...</div>
  if (!jobs.length) return <div className="empty-state"><div style={{ fontSize: 32, marginBottom: 12 }}>📋</div><div>No upcoming jobs assigned.</div><div style={{ fontSize: 13, color: '#aaa', marginTop: 4 }}>Check back later or contact your operator.</div></div>

  const job = jobs.find(j => j.id === selectedJobId) || jobs[0]
  const kb = parseKB(job.Properties?.knowledge_base)
  const isToday = job.job_date === new Date().toISOString().split('T')[0]

  return (
    <div style={{ padding: 16, maxWidth: 500, margin: '0 auto' }}>
      {jobs.length > 1 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>Your upcoming jobs</div>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
            {jobs.map(j => (
              <button key={j.id} onClick={() => { setSelectedJobId(j.id); onJobSelect(j) }} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', background: j.id === selectedJobId ? '#0a0a0a' : '#f0f0f0', color: j.id === selectedJobId ? '#fff' : '#555' }}>
                {j.Properties?.name} · {new Date(j.job_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div><div style={{ fontWeight: 700, fontSize: 20, marginBottom: 4 }}>{job.Properties?.name}</div><div style={{ fontSize: 13, color: '#888' }}>{job.Properties?.address}</div></div>
          <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 500, background: job.status === 'Complete' ? '#dcfce7' : job.status === 'In progress' ? '#fef9c3' : '#f0f0f0', color: job.status === 'Complete' ? '#166534' : job.status === 'In progress' ? '#854d0e' : '#555' }}>{job.status || 'Not started'}</span>
        </div>
        <div style={{ fontSize: 13, color: '#555', marginBottom: 12 }}>
          {isToday ? <strong>Today</strong> : new Date(job.job_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          {job.checkin_time && <span style={{ color: '#16a34a', marginLeft: 8 }}>· Checked in {new Date(job.checkin_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>}
        </div>
        {job.notes && <div style={{ background: '#eff6ff', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 13, color: '#1e40af' }}>📝 {job.notes}</div>}
        {job.status !== 'In progress' && job.status !== 'Complete' && <button onClick={() => checkIn(job)} disabled={checkingIn} className="btn-primary">{checkingIn ? 'Checking in...' : 'Check in'}</button>}
        {job.status === 'In progress' && <div style={{ textAlign: 'center', padding: '10px 0', fontSize: 14, color: '#16a34a', fontWeight: 500 }}>✓ Checked in — work through your checklist</div>}
        {job.status === 'Complete' && <div style={{ textAlign: 'center', padding: '10px 0', fontSize: 14, color: '#16a34a', fontWeight: 600 }}>✓ Job complete</div>}
      </div>

      {(kb.access_code || job.Properties?.access_code) && (
        <div style={{ background: '#0a0a0a', borderRadius: 12, padding: 20, marginBottom: 12, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Access code</div>
          <div style={{ fontFamily: 'monospace', fontSize: 36, fontWeight: 700, color: '#fff', letterSpacing: 6 }}>{kb.access_code || job.Properties?.access_code}</div>
        </div>
      )}
      {kb.lockbox_location && <InfoCard label="Lockbox" value={kb.lockbox_location} />}
      {kb.wifi && <InfoCard label="Wifi" value={kb.wifi} />}
      {kb.wifi_router_location && <InfoCard label="Router location" value={kb.wifi_router_location} />}
      {(kb.linen_location || job.Properties?.linen_location) && <InfoCard label="Linen location" value={kb.linen_location || job.Properties?.linen_location} />}
      {kb.linen_rooms && <InfoCard label="What linen goes where" value={kb.linen_rooms} />}
      {(kb.boiler || job.Properties?.appliance_notes) && <InfoCard label="Boiler" value={kb.boiler || job.Properties?.appliance_notes} />}
      {kb.washing_machine && <InfoCard label="Washing machine" value={kb.washing_machine} />}
      {kb.cleaning_products && <InfoCard label="Cleaning products" value={kb.cleaning_products} />}
      {kb.bins && <InfoCard label="Bins" value={kb.bins} />}
      {kb.quirks && <InfoCard label="⚠️ Special instructions" value={kb.quirks} warn />}
      {kb.do_not && <InfoCard label="🚫 Do not" value={kb.do_not} warn />}
      {job.Properties?.knowledge_base_url && <a href={job.Properties.knowledge_base_url} target="_blank" rel="noreferrer" style={{ display: 'block', textAlign: 'center', padding: 14, background: '#fff', borderRadius: 12, border: '1px solid #e0e0e0', fontSize: 14, color: '#2563eb', fontWeight: 500, marginTop: 8 }}>📄 Full property guide</a>}
    </div>
  )
}

// ── CHECKLIST TAB ─────────────────────────────────────────────────────
function ChecklistTab({ job }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!job) { setLoading(false); return }
    supabase.from('Checklist_items').select('*').eq('job_id', job.id).then(({ data }) => {
      setItems(data || [])
      setSubmitted(job.status === 'Complete')
      setLoading(false)
    })
  }, [job])

  async function toggleDone(item) {
    const newDone = !item.done
    await supabase.from('Checklist_items').update({ done: newDone }).eq('id', item.id)
    const updated = items.map(i => i.id === item.id ? { ...i, done: newDone } : i)
    setItems(updated)
    const done = updated.filter(i => i.done).length
    await supabase.from('jobs').update({ completed_tasks: done, total_tasks: updated.length, readiness_percent: Math.round((done / updated.length) * 100) }).eq('id', job.id)
  }

  async function uploadPhoto(item, file) {
    setUploading(prev => ({ ...prev, [item.id]: true }))
    const ext = file.name.split('.').pop()
    const path = `checklist/${job.id}/${item.id}-${Date.now()}.${ext}`
    await supabase.storage.from('uploads').upload(path, file)
    const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(path)
    const { data } = await supabase.from('Checklist_items').update({ photo_url: urlData.publicUrl, done: true }).eq('id', item.id).select().single()
    setItems(prev => prev.map(i => i.id === item.id ? data : i))
    setUploading(prev => ({ ...prev, [item.id]: false }))
  }

  async function markComplete() {
    setSubmitting(true)
    const done = items.filter(i => i.done).length
    await supabase.from('jobs').update({ status: 'Complete', readiness_percent: 100, completed_tasks: done, total_tasks: items.length }).eq('id', job.id)
    setSubmitted(true); setSubmitting(false)
  }

  const rooms = [...new Set(items.map(i => i.room).filter(Boolean))]
  const noRoomItems = items.filter(i => !i.room)
  const completedCount = items.filter(i => i.done).length
  const allTicked = items.length > 0 && items.every(i => i.done)
  const percent = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0

  if (!job) return <div style={{ padding: 16 }}><div className="empty-state">Check in to your job first.</div></div>
  if (loading) return <div className="empty-state">Loading checklist...</div>
  if (submitted) return <div style={{ padding: 16 }}><div className="card" style={{ textAlign: 'center', padding: 32 }}><div style={{ fontSize: 40, marginBottom: 12 }}>✓</div><div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Job complete</div><div style={{ fontSize: 14, color: '#888' }}>All tasks done. Great work.</div></div></div>
  if (!items.length) return <div className="empty-state"><div>No checklist items for this job.</div><div style={{ fontSize: 13, color: '#aaa', marginTop: 4 }}>The operator will add them before the job starts.</div></div>

  return (
    <div style={{ padding: 16, maxWidth: 500, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ fontSize: 13, color: '#888' }}>Progress</span><span style={{ fontSize: 13, fontWeight: 600 }}>{completedCount}/{items.length}</span></div>
        <div style={{ height: 8, background: '#f0f0f0', borderRadius: 4 }}><div style={{ height: 8, borderRadius: 4, background: percent === 100 ? '#16a34a' : '#d97706', width: `${percent}%`, transition: 'width 0.3s' }} /></div>
      </div>
      {rooms.map(room => (
        <div key={room} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#666', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{room}</div>
          {items.filter(i => i.room === room).map(item => (
            <div key={item.id} className="card" style={{ padding: '12px 14px', marginBottom: 8, border: `1px solid ${item.done ? '#bbf7d0' : '#f0f0f0'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div onClick={() => toggleDone(item)} style={{ width: 26, height: 26, borderRadius: 6, flexShrink: 0, cursor: 'pointer', border: `2px solid ${item.done ? '#16a34a' : '#ccc'}`, background: item.done ? '#16a34a' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {item.done && <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>✓</span>}
                </div>
                <span style={{ flex: 1, fontSize: 14, color: item.done ? '#888' : '#0a0a0a', textDecoration: item.done ? 'line-through' : 'none' }}>{item.task}</span>
                <label style={{ cursor: 'pointer', flexShrink: 0 }}>
                  <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => e.target.files[0] && uploadPhoto(item, e.target.files[0])} />
                  <div style={{ padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500, background: item.photo_url ? '#dcfce7' : '#f0f0f0', color: item.photo_url ? '#15803d' : '#666' }}>{uploading[item.id] ? '...' : item.photo_url ? '✓ Photo' : '+ Photo'}</div>
                </label>
              </div>
            </div>
          ))}
        </div>
      ))}
      {noRoomItems.map(item => (
        <div key={item.id} className="card" style={{ padding: '12px 14px', marginBottom: 8, border: `1px solid ${item.done ? '#bbf7d0' : '#f0f0f0'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div onClick={() => toggleDone(item)} style={{ width: 26, height: 26, borderRadius: 6, flexShrink: 0, cursor: 'pointer', border: `2px solid ${item.done ? '#16a34a' : '#ccc'}`, background: item.done ? '#16a34a' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {item.done && <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>✓</span>}
            </div>
            <span style={{ flex: 1, fontSize: 14, color: item.done ? '#888' : '#0a0a0a', textDecoration: item.done ? 'line-through' : 'none' }}>{item.task}</span>
            <label style={{ cursor: 'pointer', flexShrink: 0 }}>
              <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => e.target.files[0] && uploadPhoto(item, e.target.files[0])} />
              <div style={{ padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500, background: item.photo_url ? '#dcfce7' : '#f0f0f0', color: item.photo_url ? '#15803d' : '#666' }}>{uploading[item.id] ? '...' : item.photo_url ? '✓ Photo' : '+ Photo'}</div>
            </label>
          </div>
        </div>
      ))}
      {allTicked ? (
        <button className="btn-primary" onClick={markComplete} disabled={submitting}>{submitting ? 'Saving...' : '✓ Mark job complete'}</button>
      ) : (
        <div style={{ textAlign: 'center', fontSize: 13, color: '#aaa', padding: '12px 0' }}>Tick all items to complete the job</div>
      )}
    </div>
  )
}

// ── ISSUE TAB ─────────────────────────────────────────────────────────
function IssueTab({ job }) {
  const [form, setForm] = useState({ category: 'Maintenance', severity: 'Medium', description: '', photo: null })
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function submit() {
    if (!job) return alert('Check in to your job first.')
    if (!form.description.trim()) return alert('Please describe the issue.')
    setSubmitting(true)
    let photoUrl = null
    if (form.photo) {
      const ext = form.photo.name.split('.').pop()
      const path = `issues/${Date.now()}.${ext}`
      await supabase.storage.from('uploads').upload(path, form.photo)
      const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(path)
      photoUrl = urlData.publicUrl
    }
    await supabase.from('issues').insert({ property_id: job.property_id, job_id: job.id, category: form.category, severity: form.severity, description: form.description, status: 'Open', issue_photo_url: photoUrl })
    setDone(true); setSubmitting(false)
  }

  if (!job) return <div style={{ padding: 16 }}><div className="empty-state">Check in to your job first.</div></div>
  if (done) return (
    <div style={{ padding: 16, maxWidth: 500, margin: '0 auto' }}>
      <div className="card" style={{ textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Issue reported</div>
        <div style={{ fontSize: 14, color: '#888', marginBottom: 20 }}>The operator has been notified.</div>
        <button className="btn-secondary" onClick={() => { setDone(false); setForm({ category: 'Maintenance', severity: 'Medium', description: '', photo: null }) }}>Report another</button>
      </div>
    </div>
  )

  return (
    <div style={{ padding: 16, maxWidth: 500, margin: '0 auto' }}>
      <div className="card">
        <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 16 }}>Report an issue</div>
        <div className="form-group"><label className="label">Category</label><select className="input-field" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{['Cleaning', 'Maintenance', 'Laundry', 'Safety', 'Stock', 'Access'].map(c => <option key={c}>{c}</option>)}</select></div>
        <div className="form-group">
          <label className="label">Severity</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {['Low', 'Medium', 'High', 'Critical'].map(s => (
              <button key={s} onClick={() => setForm({ ...form, severity: s })} style={{ flex: 1, padding: '9px 4px', borderRadius: 8, fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer', background: form.severity === s ? '#0a0a0a' : '#f0f0f0', color: form.severity === s ? '#fff' : '#555' }}>{s}</button>
            ))}
          </div>
        </div>
        <div className="form-group"><label className="label">Description *</label><textarea className="input-field" rows={4} placeholder="Describe the issue clearly..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
        <div className="form-group">
          <label className="label">Photo (optional)</label>
          <input type="file" accept="image/*" capture="environment" className="input-field" style={{ padding: 8 }} onChange={e => setForm({ ...form, photo: e.target.files[0] })} />
          {form.photo && <div style={{ fontSize: 12, color: '#16a34a', marginTop: 4 }}>✓ {form.photo.name}</div>}
        </div>
        <button className="btn-primary" onClick={submit} disabled={submitting}>{submitting ? 'Submitting...' : 'Submit issue'}</button>
      </div>
    </div>
  )
}

// ── RESTOCK TAB ───────────────────────────────────────────────────────
function RestockTab({ job }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!job) { setLoading(false); return }
    supabase.from('restock').select('*').eq('property_id', job.property_id).then(({ data }) => { setItems(data || []); setLoading(false) })
  }, [job])

  async function updateQty(item, qty) {
    const val = parseInt(qty) || 0
    const needs = val < item.minimum_quantity
    const { data } = await supabase.from('restock').update({ current_quantity: val, needs_restock: needs }).eq('id', item.id).select().single()
    setItems(prev => prev.map(i => i.id === item.id ? data : i))
  }

  if (!job) return <div style={{ padding: 16 }}><div className="empty-state">Check in to your job first.</div></div>
  if (loading) return <div className="empty-state">Loading inventory...</div>

  const lowCount = items.filter(i => i.needs_restock).length

  return (
    <div style={{ padding: 16, maxWidth: 500, margin: '0 auto' }}>
      {lowCount > 0 && <div style={{ background: '#fff8ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#92400e' }}>⚠️ {lowCount} item{lowCount !== 1 ? 's' : ''} need restocking</div>}
      {!items.length && <div className="empty-state">No inventory items for this property.</div>}
      <div style={{ display: 'grid', gap: 8 }}>
        {items.map(item => (
          <div key={item.id} className="card" style={{ padding: '12px 14px', border: `1px solid ${item.needs_restock ? '#fecaca' : '#f0f0f0'}`, background: item.needs_restock ? '#fff8f8' : '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{item.item_name}</div><div style={{ fontSize: 12, color: '#aaa' }}>Min: {item.minimum_quantity}</div></div>
              <input type="number" min="0" style={{ width: 64, padding: '8px', border: '1.5px solid #e0e0e0', borderRadius: 8, fontSize: 16, textAlign: 'center', fontWeight: 600 }} defaultValue={item.current_quantity || 0} onBlur={e => updateQty(item, e.target.value)} />
              <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, fontWeight: 500, background: item.needs_restock ? '#fee2e2' : '#dcfce7', color: item.needs_restock ? '#991b1b' : '#166534', whiteSpace: 'nowrap' }}>{item.needs_restock ? 'Low' : 'OK'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── SAFETY TAB ────────────────────────────────────────────────────────
function SafetyTab({ job }) {
  const [checks, setChecks] = useState({ smoke: false, co: false, fire_exit: false })
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function submit() {
    if (!job) return alert('Check in to your job first.')
    setSubmitting(true)
    await supabase.from('issues').insert({ property_id: job.property_id, job_id: job.id, category: 'Safety', severity: 'Low', description: 'Safety checks completed: smoke alarm ✓, CO alarm ✓, fire exit ✓', status: 'Closed' })
    setDone(true); setSubmitting(false)
  }

  if (!job) return <div style={{ padding: 16 }}><div className="empty-state">Check in to your job first.</div></div>
  if (done) return <div style={{ padding: 16 }}><div className="card" style={{ textAlign: 'center', padding: 32 }}><div style={{ fontSize: 40, marginBottom: 12 }}>✓</div><div style={{ fontWeight: 600, marginBottom: 4 }}>Safety checks complete</div><div style={{ fontSize: 14, color: '#888' }}>All checks logged and recorded.</div></div></div>

  return (
    <div style={{ padding: 16, maxWidth: 500, margin: '0 auto' }}>
      <div className="card">
        <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Safety checks</div>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>Tap each item to confirm you have checked it.</div>
        <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
          {[
            { key: 'smoke', label: 'Smoke alarm tested and working', icon: '🔴', desc: 'Press test button, confirm it beeps' },
            { key: 'co', label: 'CO alarm tested and working', icon: '⚪', desc: 'Press test button, confirm it beeps' },
            { key: 'fire_exit', label: 'Fire exit is clear and accessible', icon: '🚪', desc: 'Door opens freely, nothing blocking it' },
          ].map(check => (
            <div key={check.key} onClick={() => setChecks(prev => ({ ...prev, [check.key]: !prev[check.key] }))} style={{ padding: '14px 16px', borderRadius: 10, border: `1.5px solid ${checks[check.key] ? '#16a34a' : '#e0e0e0'}`, background: checks[check.key] ? '#f0fdf4' : '#fff', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: 6, flexShrink: 0, border: `2px solid ${checks[check.key] ? '#16a34a' : '#ccc'}`, background: checks[check.key] ? '#16a34a' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {checks[check.key] && <span style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>✓</span>}
                </div>
                <span style={{ fontSize: 18 }}>{check.icon}</span>
                <div><div style={{ fontSize: 14, fontWeight: 500 }}>{check.label}</div><div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{check.desc}</div></div>
              </div>
            </div>
          ))}
        </div>
        <button className="btn-primary" onClick={submit} disabled={submitting || !checks.smoke || !checks.co || !checks.fire_exit}>{submitting ? 'Saving...' : 'Submit safety checks'}</button>
      </div>
    </div>
  )
}

// ── PROFILE TAB ───────────────────────────────────────────────────────
function ProfileTab({ cleanerRecord }) {
  const [jobHistory, setJobHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    if (!cleanerRecord) return
    supabase.from('jobs').select('*, Properties(name)').eq('cleaner_id', cleanerRecord.id).order('job_date', { ascending: false })
      .then(({ data }) => { setJobHistory(data || []); setLoading(false) })
  }, [cleanerRecord])

  if (!cleanerRecord) return <div className="empty-state">Loading profile...</div>

  const completedJobs = jobHistory.filter(j => j.status === 'Complete').length

  return (
    <div style={{ padding: 16, maxWidth: 500, margin: '0 auto' }}>
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 20 }}>{cleanerRecord.name?.charAt(0) || 'C'}</span>
          </div>
          <div><div style={{ fontWeight: 700, fontSize: 18 }}>{cleanerRecord.name}</div><div style={{ fontSize: 13, color: '#888' }}>{cleanerRecord.agency_name && cleanerRecord.agency_name !== 'No agency' ? cleanerRecord.agency_name : 'Independent'}</div></div>
        </div>
        {[['Phone', cleanerRecord.phone], ['Email', cleanerRecord.email]].map(([label, val]) => (
          <div key={label} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: '#aaa', width: 60 }}>{label}</span>
            <span style={{ fontSize: 14 }}>{val || 'Not set'}</span>
          </div>
        ))}
      </div>
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center', padding: '8px 0' }}>
          <div><div style={{ fontWeight: 700, fontSize: 28 }}>{jobHistory.length}</div><div style={{ fontSize: 12, color: '#888' }}>Total jobs</div></div>
          <div style={{ width: 1, background: '#f0f0f0' }} />
          <div><div style={{ fontWeight: 700, fontSize: 28, color: '#16a34a' }}>{completedJobs}</div><div style={{ fontSize: 12, color: '#888' }}>Completed</div></div>
          <div style={{ width: 1, background: '#f0f0f0' }} />
          <div><div style={{ fontWeight: 700, fontSize: 28, color: '#d97706' }}>{jobHistory.length - completedJobs}</div><div style={{ fontSize: 12, color: '#888' }}>Pending</div></div>
        </div>
      </div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showHistory ? 12 : 0 }}>
          <div style={{ fontWeight: 600 }}>Job history</div>
          <button onClick={() => setShowHistory(!showHistory)} style={{ fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }}>{showHistory ? 'Hide ▲' : 'View all ▼'}</button>
        </div>
        {showHistory && !loading && (
          <div>
            {!jobHistory.length && <div style={{ fontSize: 13, color: '#aaa' }}>No jobs yet.</div>}
            {jobHistory.map(j => (
              <div key={j.id} style={{ padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{j.Properties?.name || '—'}</div>
                  <span className={`badge ${j.status === 'Complete' ? 'badge-ready' : j.status === 'In progress' ? 'badge-atrisk' : 'badge-notready'}`}>{j.status}</span>
                </div>
                <div style={{ fontSize: 12, color: '#888' }}>{new Date(j.job_date).toLocaleDateString('en-GB')} · {j.readiness_percent || 0}% complete</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── MAIN ──────────────────────────────────────────────────────────────
export default function CleanerDashboard() {
  const [tab, setTab] = useState('job')
  const [currentJob, setCurrentJob] = useState(null)
  const [cleanerRecord, setCleanerRecord] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('Cleaners').select('*').eq('auth_user_id', user.id).single()
        .then(({ data }) => { if (data) setCleanerRecord(data) })
    })
  }, [])

  const tabs = [
    { key: 'job', label: 'Job' },
    { key: 'checklist', label: 'Checklist' },
    { key: 'issue', label: 'Issue' },
    { key: 'restock', label: 'Restock' },
    { key: 'safety', label: 'Safety' },
    { key: 'profile', label: 'Profile' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#f7f7f7', display: 'flex', flexDirection: 'column', maxWidth: 600, margin: '0 auto' }}>
      <div style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 18 }}>OpsLoom</span>
        <button onClick={() => supabase.auth.signOut()} style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 8, padding: '6px 14px', fontSize: 13, cursor: 'pointer', color: '#555' }}>Sign out</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 80 }}>
        {tab === 'job'       && <JobTab cleanerRecord={cleanerRecord} onJobSelect={setCurrentJob} />}
        {tab === 'checklist' && <ChecklistTab job={currentJob} />}
        {tab === 'issue'     && <IssueTab job={currentJob} />}
        {tab === 'restock'   && <RestockTab job={currentJob} />}
        {tab === 'safety'    && <SafetyTab job={currentJob} />}
        {tab === 'profile'   && <ProfileTab cleanerRecord={cleanerRecord} />}
      </div>
      <div style={{ background: '#fff', borderTop: '1px solid #f0f0f0', padding: '6px 8px', display: 'flex', gap: 2, position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 600, zIndex: 10 }}>
        {tabs.map(t => <NavTab key={t.key} label={t.label} active={tab === t.key} onClick={() => setTab(t.key)} />)}
      </div>
    </div>
  )
}
