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

// ── JOB TAB ──────────────────────────────────────────────────────────
function JobTab({ cleanerRecord, onJobSelect }) {
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!cleanerRecord) return
    const today = new Date().toISOString().split('T')[0]
    supabase.from('jobs')
      .select('*, Properties(name, address, access_code, appliance_notes, linen_location)')
      .eq('cleaner_id', cleanerRecord.id)
      .gte('job_date', today)
      .order('job_date', { ascending: true })
      .limit(1)
      .then(({ data }) => {
        setJob(data?.[0] || null)
        setLoading(false)
        if (data?.[0]) onJobSelect(data[0])
      })
  }, [cleanerRecord])

  async function checkIn() {
    const { data } = await supabase.from('jobs')
      .update({ checkin_time: new Date().toISOString(), status: 'In progress' })
      .eq('id', job.id).select().single()
    setJob(data)
    onJobSelect(data)
  }

  if (!cleanerRecord) return <div className="empty-state">Loading your profile...</div>
  if (loading) return <div className="empty-state">Loading your job...</div>
  if (!job) return (
    <div className="empty-state">
      <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
      <div>No job assigned for today.</div>
      <div style={{ fontSize: 13, color: '#aaa', marginTop: 4 }}>Check back later.</div>
    </div>
  )

  return (
    <div style={{ padding: 16, maxWidth: 500, margin: '0 auto' }}>
      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 6 }}>{job.Properties?.name}</div>
        <div style={{ fontSize: 14, color: '#888', marginBottom: 16 }}>{job.Properties?.address}</div>

        <div style={{ background: '#f7f7f7', borderRadius: 10, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Access code</div>
          <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'monospace', color: '#0a0a0a' }}>{job.Properties?.access_code || 'See operator'}</div>
        </div>

        {job.Properties?.linen_location && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: '#aaa', marginBottom: 2 }}>Linen location</div>
            <div style={{ fontSize: 14 }}>{job.Properties.linen_location}</div>
          </div>
        )}
        {job.Properties?.appliance_notes && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: '#aaa', marginBottom: 2 }}>Appliance notes</div>
            <div style={{ fontSize: 14 }}>{job.Properties.appliance_notes}</div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderTop: '1px solid #f0f0f0', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 12, color: '#aaa', marginBottom: 2 }}>Job date</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{new Date(job.job_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          </div>
          {job.checkin_time && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 12, color: '#aaa', marginBottom: 2 }}>Checked in</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#16a34a' }}>{new Date(job.checkin_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          )}
        </div>

        {!job.checkin_time ? (
          <button className="btn-primary" onClick={checkIn}>Check in</button>
        ) : (
          <div style={{ textAlign: 'center', padding: '12px 0', fontSize: 14, color: '#16a34a', fontWeight: 500 }}>
            ✓ Checked in — start your checklist
          </div>
        )}
      </div>
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
      setLoading(false)
    })
  }, [job])

  async function toggleDone(item) {
    const { data } = await supabase.from('Checklist_items').update({ done: !item.done }).eq('id', item.id).select().single()
    setItems(items.map(i => i.id === item.id ? data : i))
  }

  async function uploadPhoto(item, file) {
    setUploading({ ...uploading, [item.id]: true })
    const path = `checklist/${job.id}/${item.id}-${Date.now()}`
    const { data: uploadData } = await supabase.storage.from('photos').upload(path, file)
    if (uploadData) {
      const { data: urlData } = supabase.storage.from('photos').getPublicUrl(path)
      const { data } = await supabase.from('Checklist_items').update({ photo_url: urlData.publicUrl, done: true }).eq('id', item.id).select().single()
      setItems(items.map(i => i.id === item.id ? data : i))
    }
    setUploading({ ...uploading, [item.id]: false })
  }

  async function markComplete() {
    setSubmitting(true)
    const completedCount = items.filter(i => i.done).length
    await supabase.from('jobs').update({
      status: 'Complete',
      readiness_percent: 100,
      completed_tasks: completedCount,
      total_tasks: items.length,
    }).eq('id', job.id)
    setSubmitted(true)
    setSubmitting(false)
  }

  const allDone = items.length > 0 && items.every(i => i.done && i.photo_url)
  const rooms = [...new Set(items.map(i => i.room))]

  if (!job) return <div className="empty-state">Check in to your job first.</div>
  if (loading) return <div className="empty-state">Loading checklist...</div>
  if (submitted) return (
    <div style={{ padding: 16 }}>
      <div className="card" style={{ textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Job complete</div>
        <div style={{ fontSize: 14, color: '#888' }}>All tasks done. Great work.</div>
      </div>
    </div>
  )
  if (!items.length) return (
    <div className="empty-state">
      <div>No checklist items for this job.</div>
      <div style={{ fontSize: 13, color: '#aaa', marginTop: 4 }}>The operator will add them before the job starts.</div>
    </div>
  )

  const completed = items.filter(i => i.done && i.photo_url).length
  const percent = Math.round((completed / items.length) * 100)

  return (
    <div style={{ padding: 16, maxWidth: 500, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: '#888' }}>Progress</span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{completed}/{items.length} done</span>
        </div>
        <div style={{ height: 8, background: '#f0f0f0', borderRadius: 4 }}>
          <div style={{ height: 8, borderRadius: 4, background: percent === 100 ? '#16a34a' : '#d97706', width: `${percent}%`, transition: 'width 0.3s' }} />
        </div>
      </div>

      {rooms.map(room => (
        <div key={room} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 8 }}>{room}</div>
          {items.filter(i => i.room === room).map(item => (
            <div key={item.id} className="card" style={{ padding: '12px 14px', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div onClick={() => toggleDone(item)} style={{
                  width: 24, height: 24, borderRadius: 6, flexShrink: 0, cursor: 'pointer',
                  border: `2px solid ${item.done ? '#16a34a' : '#ccc'}`,
                  background: item.done ? '#16a34a' : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {item.done && <span style={{ color: '#fff', fontSize: 13 }}>✓</span>}
                </div>
                <span style={{ flex: 1, fontSize: 14, color: item.done ? '#888' : '#0a0a0a' }}>{item.task}</span>
                <label style={{ cursor: 'pointer', flexShrink: 0 }}>
                  <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
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
      ))}

      {allDone ? (
        <button className="btn-primary" onClick={markComplete} disabled={submitting}>
          {submitting ? 'Submitting...' : 'Mark job complete'}
        </button>
      ) : (
        <div style={{ textAlign: 'center', fontSize: 13, color: '#aaa', padding: '16px 0' }}>
          Upload a photo for every item to complete the job
        </div>
      )}
    </div>
  )
}

// ── ISSUE TAB ─────────────────────────────────────────────────────────
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

  if (!job) return <div style={{ padding: 16 }}><div className="empty-state">Check in to your job first.</div></div>

  if (done) return (
    <div style={{ padding: 16, maxWidth: 500, margin: '0 auto' }}>
      <div className="card" style={{ textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Issue reported</div>
        <div style={{ fontSize: 14, color: '#888', marginBottom: 20 }}>The operator has been notified.</div>
        <button className="btn-secondary" onClick={() => { setDone(false); setForm({ category: 'Maintenance', severity: 'Medium', description: '' }) }}>
          Report another
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ padding: 16, maxWidth: 500, margin: '0 auto' }}>
      <div className="card">
        <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 16 }}>Report an issue</div>
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
            <textarea className="input-field" rows={4} placeholder="Describe the issue clearly..."
              value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required />
          </div>
          <button className="btn-primary" type="submit" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit issue'}
          </button>
        </form>
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
    supabase.from('restock').select('*').eq('property_id', job.property_id).then(({ data }) => {
      setItems(data || [])
      setLoading(false)
    })
  }, [job])

  async function toggleRestock(item) {
    const { data } = await supabase.from('restock').update({ needs_restock: !item.needs_restock }).eq('id', item.id).select().single()
    setItems(items.map(i => i.id === item.id ? data : i))
  }

  async function updateQty(item, qty) {
    const val = parseInt(qty) || 0
    const needsRestock = val < item.minimum_quantity
    const { data } = await supabase.from('restock').update({ current_quantity: val, needs_restock: needsRestock }).eq('id', item.id).select().single()
    setItems(items.map(i => i.id === item.id ? data : i))
  }

  if (!job) return <div style={{ padding: 16 }}><div className="empty-state">Check in to your job first.</div></div>
  if (loading) return <div className="empty-state">Loading inventory...</div>

  return (
    <div style={{ padding: 16, maxWidth: 500, margin: '0 auto' }}>
      {!items.length && <div className="empty-state">No inventory items set up for this property.</div>}
      <div style={{ display: 'grid', gap: 8 }}>
        {items.map(item => (
          <div key={item.id} className="card" style={{ padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>{item.item_name}</div>
                <div style={{ fontSize: 12, color: '#aaa' }}>Min: {item.minimum_quantity}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#888' }}>Qty:</span>
                <input type="number" min="0" style={{
                  width: 60, padding: '6px 8px', border: '1.5px solid #e0e0e0',
                  borderRadius: 6, fontSize: 14, textAlign: 'center', fontFamily: 'inherit'
                }} value={item.current_quantity || 0} onChange={e => updateQty(item, e.target.value)} />
              </div>
              <span className={`badge ${item.needs_restock ? 'badge-notready' : 'badge-ready'}`}>
                {item.needs_restock ? 'Low' : 'OK'}
              </span>
            </div>
          </div>
        ))}
      </div>
      {items.length > 0 && (
        <div style={{ marginTop: 16, padding: '12px 16px', background: '#f7f7f7', borderRadius: 10, fontSize: 13, color: '#888' }}>
          {items.filter(i => i.needs_restock).length > 0
            ? `${items.filter(i => i.needs_restock).length} item${items.filter(i => i.needs_restock).length !== 1 ? 's' : ''} flagged for restock — operator has been notified.`
            : 'All items stocked. Good work.'}
        </div>
      )}
    </div>
  )
}

// ── SAFETY TAB ────────────────────────────────────────────────────────
function SafetyTab({ job }) {
  const [checks, setChecks] = useState({ smoke: false, co: false, fire_exit: false })
  const [done, setDone] = useState(false)

  async function submit() {
    if (!job) return alert('Check in to your job first.')
    if (!checks.smoke || !checks.co || !checks.fire_exit) return alert('Complete all three checks first.')
    setDone(true)
  }

  if (!job) return <div style={{ padding: 16 }}><div className="empty-state">Check in to your job first.</div></div>

  if (done) return (
    <div style={{ padding: 16, maxWidth: 500, margin: '0 auto' }}>
      <div className="card" style={{ textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
        <div style={{ fontWeight: 600 }}>Safety checks complete</div>
        <div style={{ fontSize: 14, color: '#888', marginTop: 8 }}>All checks logged.</div>
      </div>
    </div>
  )

  return (
    <div style={{ padding: 16, maxWidth: 500, margin: '0 auto' }}>
      <div className="card">
        <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Safety checks</div>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>Run these on every turnover.</div>
        <div style={{ display: 'grid', gap: 10, marginBottom: 20 }}>
          {[
            { key: 'smoke', label: 'Smoke alarm tested', icon: '🔴' },
            { key: 'co', label: 'CO alarm tested', icon: '⚪' },
            { key: 'fire_exit', label: 'Fire exit clear', icon: '🚪' },
          ].map(check => (
            <div key={check.key} className="card" style={{ padding: '14px 16px', cursor: 'pointer' }}
              onClick={() => setChecks({ ...checks, [check.key]: !checks[check.key] })}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                  border: `2px solid ${checks[check.key] ? '#16a34a' : '#ccc'}`,
                  background: checks[check.key] ? '#16a34a' : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {checks[check.key] && <span style={{ color: '#fff', fontSize: 14 }}>✓</span>}
                </div>
                <span style={{ fontSize: 15 }}>{check.icon}</span>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{check.label}</span>
              </div>
            </div>
          ))}
        </div>
        <button className="btn-primary" onClick={submit}
          disabled={!checks.smoke || !checks.co || !checks.fire_exit}>
          Submit safety checks
        </button>
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
    supabase.from('jobs').select('*, Properties(name)')
      .eq('cleaner_id', cleanerRecord.id)
      .order('job_date', { ascending: false })
      .then(({ data }) => {
        setJobHistory(data || [])
        setLoading(false)
      })
  }, [cleanerRecord])

  if (!cleanerRecord) return <div className="empty-state">Loading profile...</div>

  const completedJobs = jobHistory.filter(j => j.status === 'Complete').length

  return (
    <div style={{ padding: 16, maxWidth: 500, margin: '0 auto' }}>
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#0a0a0a',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 20 }}>
              {cleanerRecord.name?.charAt(0) || 'C'}
            </span>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{cleanerRecord.name}</div>
            <div style={{ fontSize: 13, color: '#888' }}>Cleaner</div>
          </div>
        </div>
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#aaa', width: 80 }}>Phone</span>
            <span style={{ fontSize: 14 }}>{cleanerRecord.phone || 'Not set'}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#aaa', width: 80 }}>Email</span>
            <span style={{ fontSize: 14 }}>{cleanerRecord.email || 'Not set'}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#aaa', width: 80 }}>Agency</span>
            <span style={{ fontSize: 14 }}>{cleanerRecord.agency_name && cleanerRecord.agency_name !== 'No agency' ? cleanerRecord.agency_name : 'No agency'}</span>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 13, color: '#888' }}>Total jobs</div>
          <div style={{ fontWeight: 700, fontSize: 22 }}>{jobHistory.length}</div>
        </div>
        <div style={{ height: 1, background: '#f0f0f0', margin: '10px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 13, color: '#888' }}>Completed</div>
          <div style={{ fontWeight: 700, fontSize: 22, color: '#16a34a' }}>{completedJobs}</div>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showHistory ? 12 : 0 }}>
          <div style={{ fontWeight: 600 }}>Job history</div>
          <button onClick={() => setShowHistory(!showHistory)} style={{
            fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500
          }}>{showHistory ? 'Hide ▲' : 'View all ▼'}</button>
        </div>
        {loading && <div style={{ fontSize: 13, color: '#aaa', marginTop: 8 }}>Loading...</div>}
        {showHistory && !loading && (
          <div>
            {!jobHistory.length && <div style={{ fontSize: 13, color: '#aaa' }}>No jobs yet.</div>}
            {jobHistory.map(job => (
              <div key={job.id} style={{ padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{job.Properties?.name || '—'}</div>
                  <span className={`badge ${job.status === 'Complete' ? 'badge-ready' : job.status === 'In progress' ? 'badge-atrisk' : 'badge-notready'}`}>{job.status}</span>
                </div>
                <div style={{ fontSize: 12, color: '#888' }}>
                  {new Date(job.job_date).toLocaleDateString('en-GB')} · {job.readiness_percent || 0}% complete
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── MAIN CLEANER DASHBOARD ────────────────────────────────────────────
export default function CleanerDashboard() {
  const [tab, setTab] = useState('job')
  const [currentJob, setCurrentJob] = useState(null)
  const [cleanerRecord, setCleanerRecord] = useState(null)

  useEffect(() => {
    async function loadCleaner() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('Cleaners')
        .select('*')
        .eq('auth_user_id', user.id)
        .single()
      if (data) setCleanerRecord(data)
    }
    loadCleaner()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
  }

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
      <div style={{
        background: '#fff', borderBottom: '1px solid #f0f0f0',
        padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.5px' }}>OpsLoom</span>
        <button onClick={handleLogout} style={{
          background: 'none', border: '1px solid #e0e0e0', borderRadius: 8,
          padding: '6px 14px', fontSize: 13, cursor: 'pointer', color: '#555'
        }}>Sign out</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 80 }}>
        {tab === 'job'      && <JobTab cleanerRecord={cleanerRecord} onJobSelect={setCurrentJob} />}
        {tab === 'checklist'&& <ChecklistTab job={currentJob} />}
        {tab === 'issue'    && <IssueTab job={currentJob} />}
        {tab === 'restock'  && <RestockTab job={currentJob} />}
        {tab === 'safety'   && <SafetyTab job={currentJob} />}
        {tab === 'profile'  && <ProfileTab cleanerRecord={cleanerRecord} />}
      </div>

      <div style={{
        background: '#fff', borderTop: '1px solid #f0f0f0',
        padding: '6px 8px', display: 'flex', gap: 2,
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 600, zIndex: 10,
      }}>
        {tabs.map(t => <NavTab key={t.key} label={t.label} active={tab === t.key} onClick={() => setTab(t.key)} />)}
      </div>
    </div>
  )
}
