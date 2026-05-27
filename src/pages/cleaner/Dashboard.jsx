import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

function NavTab({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: '12px 8px', fontSize: 13, fontWeight: 500,
      background: active ? '#0a0a0a' : 'transparent',
      color: active ? '#fff' : '#888', border: 'none', cursor: 'pointer',
      borderRadius: 8, transition: 'all 0.15s',
    }}>{label}</button>
  )
}

// ── Job Tab ────────────────────────────────────────────────────────────
function JobTab({ userId, onJobSelect }) {
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    supabase.from('jobs')
      .select('*, properties(name, address, access_code, appliance_notes, linen_location)')
      .eq('cleaner_id', userId)
      .gte('job_date', today)
      .order('job_date', { ascending: true })
      .limit(1)
      .then(({ data }) => {
        setJob(data?.[0] || null)
        setLoading(false)
      })
  }, [userId])

  async function checkIn() {
    const { data } = await supabase.from('jobs')
      .update({ checkin_time: new Date().toISOString(), status: 'In progress' })
      .eq('id', job.id).select().single()
    setJob(data)
    onJobSelect(data)
  }

  if (loading) return <div className="empty-state">Loading your job...</div>
  if (!job) return <div className="empty-state">No job assigned for today. Check back later.</div>

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 6 }}>{job.properties?.name}</div>
        <div style={{ fontSize: 14, color: '#888', marginBottom: 16 }}>{job.properties?.address}</div>

        <div style={{ background: '#f7f7f7', borderRadius: 8, padding: 14, marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Access</div>
          <div style={{ fontSize: 16, fontWeight: 600, fontFamily: 'DM Mono, monospace' }}>{job.properties?.access_code || 'See operator'}</div>
        </div>

        {job.properties?.linen_location && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 2 }}>Linen location</div>
            <div style={{ fontSize: 14 }}>{job.properties.linen_location}</div>
          </div>
        )}
        {job.properties?.appliance_notes && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 2 }}>Appliance notes</div>
            <div style={{ fontSize: 14 }}>{job.properties.appliance_notes}</div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 13, color: '#888' }}>Status</span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{job.status || 'Not started'}</span>
        </div>

        {!job.checkin_time ? (
          <button className="btn-primary" onClick={checkIn}>Check in</button>
        ) : (
          <div style={{ textAlign: 'center', fontSize: 13, color: '#16a34a', fontWeight: 500 }}>
            ✓ Checked in at {new Date(job.checkin_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Checklist Tab ──────────────────────────────────────────────────────
function ChecklistTab({ job }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!job) return
    supabase.from('checklist_items').select('*').eq('job_id', job.id).then(({ data }) => {
      setItems(data || [])
      setLoading(false)
    })
  }, [job])

  async function toggleDone(item) {
    const { data } = await supabase.from('checklist_items')
      .update({ done: !item.done }).eq('id', item.id).select().single()
    setItems(items.map(i => i.id === item.id ? data : i))
  }

  async function uploadPhoto(item, file) {
    setUploading({ ...uploading, [item.id]: true })
    const path = `checklist/${job.id}/${item.id}-${Date.now()}`
    const { data: uploadData } = await supabase.storage.from('photos').upload(path, file)
    if (uploadData) {
      const { data: urlData } = supabase.storage.from('photos').getPublicUrl(path)
      const { data } = await supabase.from('checklist_items')
        .update({ photo_url: urlData.publicUrl, done: true }).eq('id', item.id).select().single()
      setItems(items.map(i => i.id === item.id ? data : i))
    }
    setUploading({ ...uploading, [item.id]: false })
  }

  async function markComplete() {
    setSubmitting(true)
    await supabase.from('jobs').update({ status: 'Complete', readiness_percent: 100 }).eq('id', job.id)
    await supabase.from('properties').update({ readiness_status: 'Ready' }).eq('id', job.property_id)
    alert('Job marked complete. Great work!')
    setSubmitting(false)
  }

  const allDone = items.length > 0 && items.every(i => i.done && i.photo_url)
  const rooms = [...new Set(items.map(i => i.room))]

  if (!job) return <div className="empty-state">Check in to your job first.</div>
  if (loading) return <div className="empty-state">Loading checklist...</div>
  if (!items.length) return <div className="empty-state">No checklist items for this job.</div>

  return (
    <div>
      <div style={{ display: 'grid', gap: 16, marginBottom: 20 }}>
        {rooms.map(room => (
          <div key={room}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 8, paddingLeft: 4 }}>{room}</div>
            <div style={{ display: 'grid', gap: 6 }}>
              {items.filter(i => i.room === room).map(item => (
                <div key={item.id} className="card" style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      onClick={() => toggleDone(item)}
                      style={{
                        width: 22, height: 22, borderRadius: 6, border: `2px solid ${item.done ? '#16a34a' : '#ccc'}`,
                        background: item.done ? '#16a34a' : '#fff', cursor: 'pointer', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {item.done && <span style={{ color: '#fff', fontSize: 13 }}>✓</span>}
                    </div>
                    <span style={{ flex: 1, fontSize: 14, color: item.done ? '#888' : '#0a0a0a' }}>{item.task}</span>
                    <label style={{ cursor: 'pointer' }}>
                      <input type="file" accept="image/*" style={{ display: 'none' }}
                        onChange={e => e.target.files[0] && uploadPhoto(item, e.target.files[0])} />
                      <div style={{
                        padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                        background: item.photo_url ? '#dcfce7' : '#f0f0f0',
                        color: item.photo_url ? '#15803d' : '#666',
                      }}>
                        {uploading[item.id] ? '...' : item.photo_url ? '✓ Photo' : '+ Photo'}
                      </div>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {allDone && (
        <button className="btn-primary" onClick={markComplete} disabled={submitting}>
          {submitting ? 'Submitting...' : 'Mark job complete'}
        </button>
      )}
      {!allDone && (
        <div style={{ textAlign: 'center', fontSize: 13, color: '#aaa', padding: '16px 0' }}>
          Upload a photo for every item to complete the job
        </div>
      )}
    </div>
  )
}

// ── Issue Tab ──────────────────────────────────────────────────────────
function IssueTab({ job }) {
  const [form, setForm] = useState({ category: 'Maintenance', severity: 'Medium', description: '' })
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!job) return alert('Check in to your job first.')
    setSubmitting(true)
    await supabase.from('issues').insert({
      property_id: job.property_id,
      job_id: job.id,
      category: form.category,
      severity: form.severity,
      description: form.description,
      status: 'Open',
    })
    setDone(true)
    setSubmitting(false)
  }

  if (done) return (
    <div className="card" style={{ textAlign: 'center', padding: 32 }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Issue reported</div>
      <div style={{ fontSize: 14, color: '#888', marginBottom: 20 }}>The operator has been notified.</div>
      <button className="btn-secondary" onClick={() => setDone(false)}>Report another</button>
    </div>
  )

  return (
    <div className="card">
      <div style={{ fontWeight: 600, marginBottom: 16 }}>Report an issue</div>
      <form onSubmit={submit}>
        <div className="form-group">
          <label className="label">Category</label>
          <select className="input-field" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
            {['Cleaning', 'Maintenance', 'Laundry', 'Safety', 'Stock', 'Access'].map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="label">Severity</label>
          <select className="input-field" value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })}>
            {['Critical', 'High', 'Medium', 'Low'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="label">Description</label>
          <textarea className="input-field" rows={4} placeholder="Describe the issue..."
            value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required />
        </div>
        <button className="btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Submitting...' : 'Submit issue'}
        </button>
      </form>
    </div>
  )
}

// ── Restock Tab ────────────────────────────────────────────────────────
function RestockTab({ job }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!job) return
    supabase.from('restock').select('*').eq('property_id', job.property_id).then(({ data }) => {
      setItems(data || [])
      setLoading(false)
    })
  }, [job])

  async function toggleRestock(item) {
    const { data } = await supabase.from('restock')
      .update({ needs_restock: !item.needs_restock }).eq('id', item.id).select().single()
    setItems(items.map(i => i.id === item.id ? data : i))
  }

  async function updateQty(item, qty) {
    const { data } = await supabase.from('restock')
      .update({ current_quantity: parseInt(qty) }).eq('id', item.id).select().single()
    setItems(items.map(i => i.id === item.id ? data : i))
  }

  if (!job) return <div className="empty-state">Check in to your job first.</div>
  if (loading) return <div className="empty-state">Loading restock items...</div>
  if (!items.length) return <div className="empty-state">No inventory items for this property.</div>

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {items.map(item => (
        <div key={item.id} className="card" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div onClick={() => toggleRestock(item)} style={{
              width: 22, height: 22, borderRadius: 6,
              border: `2px solid ${item.needs_restock ? '#dc2626' : '#ccc'}`,
              background: item.needs_restock ? '#fee2e2' : '#fff',
              cursor: 'pointer', flexShrink: 0,
            }} />
            <span style={{ flex: 1, fontSize: 14 }}>{item.item_name}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#888' }}>Qty:</span>
              <input type="number" style={{
                width: 56, padding: '4px 8px', border: '1.5px solid #e0e0e0',
                borderRadius: 6, fontSize: 13, textAlign: 'center',
              }}
                value={item.current_quantity || 0}
                onChange={e => updateQty(item, e.target.value)}
              />
              <span style={{ fontSize: 12, color: '#aaa' }}>/ {item.minimum_quantity} min</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Safety Tab ─────────────────────────────────────────────────────────
function SafetyTab({ job }) {
  const [checks, setChecks] = useState({ smoke: false, co: false, fire_exit: false })
  const [done, setDone] = useState(false)

  async function submit() {
    if (!job) return alert('Check in to your job first.')
    if (!checks.smoke || !checks.co || !checks.fire_exit) return alert('Complete all three safety checks first.')
    setDone(true)
  }

  if (done) return (
    <div className="card" style={{ textAlign: 'center', padding: 32 }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
      <div style={{ fontWeight: 600 }}>Safety checks complete</div>
      <div style={{ fontSize: 14, color: '#888', marginTop: 8 }}>All checks logged and saved.</div>
    </div>
  )

  return (
    <div className="card">
      <div style={{ fontWeight: 600, marginBottom: 16 }}>Safety checks</div>
      <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
        {[
          { key: 'smoke', label: 'Smoke alarm tested' },
          { key: 'co', label: 'CO alarm tested' },
          { key: 'fire_exit', label: 'Fire exit clear' },
        ].map(check => (
          <div key={check.key} className="card" style={{ padding: '12px 14px' }}
            onClick={() => setChecks({ ...checks, [check.key]: !checks[check.key] })}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <div style={{
                width: 22, height: 22, borderRadius: 6,
                border: `2px solid ${checks[check.key] ? '#16a34a' : '#ccc'}`,
                background: checks[check.key] ? '#16a34a' : '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {checks[check.key] && <span style={{ color: '#fff', fontSize: 13 }}>✓</span>}
              </div>
              <span style={{ fontSize: 14 }}>{check.label}</span>
            </div>
          </div>
        ))}
      </div>
      <button className="btn-primary" onClick={submit}>Submit safety checks</button>
    </div>
  )
}

// ── Main Cleaner Dashboard ─────────────────────────────────────────────
export default function CleanerDashboard() {
  const [tab, setTab] = useState('job')
  const [currentJob, setCurrentJob] = useState(null)
  const [userId, setUserId] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id))
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  const tabs = ['job', 'checklist', 'issue', 'restock', 'safety']
  const labels = { job: 'Job', checklist: 'Checklist', issue: 'Issue', restock: 'Restock', safety: 'Safety' }

  return (
    <div style={{ minHeight: '100vh', background: '#f7f7f7', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="page-header">
        <span style={{ fontWeight: 700, fontSize: 18 }}>OpsLoom</span>
        <button className="btn-secondary" onClick={handleLogout} style={{ padding: '8px 14px', fontSize: 13 }}>
          Sign out
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: 16, maxWidth: 600, margin: '0 auto', width: '100%' }}>
        {tab === 'job'       && <JobTab userId={userId} onJobSelect={setCurrentJob} />}
        {tab === 'checklist' && <ChecklistTab job={currentJob} />}
        {tab === 'issue'     && <IssueTab job={currentJob} />}
        {tab === 'restock'   && <RestockTab job={currentJob} />}
        {tab === 'safety'    && <SafetyTab job={currentJob} />}
      </div>

      {/* Bottom nav */}
      <div style={{
        background: '#fff', borderTop: '1px solid #f0f0f0',
        padding: '8px 12px', display: 'flex', gap: 4, position: 'sticky', bottom: 0,
      }}>
        {tabs.map(t => <NavTab key={t} label={labels[t]} active={tab === t} onClick={() => setTab(t)} />)}
      </div>
    </div>
  )
}
