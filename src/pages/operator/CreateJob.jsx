import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function CreateJob({ onBack, onCreated }) {
  const [properties, setProperties] = useState([])
  const [cleaners, setCleaners] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [form, setForm] = useState({
    property_id: '',
    cleaner_id: '',
    job_date: '',
    checkin_time: '',
  })

  useEffect(() => {
    Promise.all([
      supabase.from('Properties').select('id, name, address'),
      supabase.from('Cleaners').select('id, name'),
    ]).then(([p, c]) => {
      setProperties(p.data || [])
      setCleaners(c.data || [])
      setLoading(false)
    })
  }, [])

  async function createJob() {
    if (!form.property_id || !form.cleaner_id || !form.job_date) {
      alert('Please fill in property, cleaner, and job date.')
      return
    }
    setSaving(true)

    const checkinDateTime = form.checkin_time
      ? `${form.job_date}T${form.checkin_time}:00`
      : null

    const { data, error } = await supabase.from('jobs').insert({
      property_id: form.property_id,
      cleaner_id: form.cleaner_id,
      job_date: form.job_date,
      checkin_time: checkinDateTime,
      status: 'Not started',
      readiness_percent: 0,
      total_tasks: 0,
      completed_tasks: 0,
    }).select().single()

    if (error) {
      alert('Error creating job: ' + error.message)
      setSaving(false)
      return
    }

    setDone(true)
    setSaving(false)
    if (onCreated) onCreated(data)
  }

  if (loading) return <div className="empty-state">Loading...</div>

  if (done) {
    const property = properties.find(p => String(p.id) === String(form.property_id))
    const cleaner = cleaners.find(c => String(c.id) === String(form.cleaner_id))
    return (
      <div>
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
          <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 8 }}>Job created</div>
          <div style={{ fontSize: 14, color: '#888', marginBottom: 6 }}>{property?.name}</div>
          <div style={{ fontSize: 14, color: '#888', marginBottom: 6 }}>Assigned to: {cleaner?.name}</div>
          <div style={{ fontSize: 14, color: '#888', marginBottom: 24 }}>Date: {new Date(form.job_date).toLocaleDateString('en-GB')}</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-secondary" onClick={onBack} style={{ flex: 1 }}>Back to dashboard</button>
            <button className="btn-primary" onClick={() => { setDone(false); setForm({ property_id: '', cleaner_id: '', job_date: '', checkin_time: '' }) }} style={{ flex: 1 }}>
              Create another
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <button onClick={onBack} style={{
        background: 'none', border: '1px solid #e0e0e0', borderRadius: 8,
        padding: '8px 16px', fontSize: 13, cursor: 'pointer', marginBottom: 16, color: '#555'
      }}>← Back to dashboard</button>

      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Create Turnover Job</div>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>
          This is the event trigger — the moment you create a job, the cleaner is assigned and the countdown to check-in begins.
        </div>

        <div className="form-group">
          <label className="label">Property</label>
          <select className="input-field" value={form.property_id}
            onChange={e => setForm({ ...form, property_id: e.target.value })}>
            <option value="">Select property</option>
            {properties.map(p => (
              <option key={p.id} value={p.id}>{p.name} — {p.address}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="label">Cleaner</label>
          <select className="input-field" value={form.cleaner_id}
            onChange={e => setForm({ ...form, cleaner_id: e.target.value })}>
            <option value="">Select cleaner</option>
            {cleaners.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="label">Job date</label>
          <input className="input-field" type="date" value={form.job_date}
            onChange={e => setForm({ ...form, job_date: e.target.value })} />
        </div>

        <div className="form-group">
          <label className="label">Guest check-in time (optional)</label>
          <input className="input-field" type="time" value={form.checkin_time}
            onChange={e => setForm({ ...form, checkin_time: e.target.value })} />
          <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>
            This drives the readiness countdown. The cleaner must complete the job before this time.
          </div>
        </div>

        <button className="btn-primary" onClick={createJob} disabled={saving || !form.property_id || !form.cleaner_id || !form.job_date}>
          {saving ? 'Creating job...' : 'Create job'}
        </button>
      </div>
    </div>
  )
}
