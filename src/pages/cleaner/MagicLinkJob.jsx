import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function MagicLinkJob() {
  const { token } = useParams()
  const [job, setJob] = useState(null)
  const [property, setProperty] = useState(null)
  const [checklist, setChecklist] = useState([])
  const [restock, setRestock] = useState([])
  const [loading, setLoading] = useState(true)
  const [expired, setExpired] = useState(false)
  const [activeTab, setActiveTab] = useState('job')
  const [completing, setCompleting] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [issueForm, setIssueForm] = useState({ category: 'Maintenance', severity: 'Medium', description: '', photo: null })
  const [submittingIssue, setSubmittingIssue] = useState(false)
  const [issueDone, setIssueDone] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: jobData } = await supabase
        .from('jobs')
        .select('*')
        .eq('magic_link_token', token)
        .single()

      if (!jobData) { setExpired(true); setLoading(false); return }

      if (jobData.magic_link_expires_at && new Date(jobData.magic_link_expires_at) < new Date()) {
        setExpired(true); setLoading(false); return
      }

      setJob(jobData)
      setCompleted(jobData.status === 'Complete')

      const [propRes, checkRes, restockRes] = await Promise.all([
        supabase.from('Properties').select('*').eq('id', jobData.property_id).single(),
        supabase.from('Checklist_items').select('*').eq('job_id', jobData.id),
        supabase.from('restock').select('*').eq('property_id', jobData.property_id),
      ])

      setProperty(propRes.data)
      setChecklist(checkRes.data || [])
      setRestock(restockRes.data || [])
      setLoading(false)
    }
    load()
  }, [token])

  async function toggleChecklistItem(item) {
    const newDone = !item.done
    await supabase.from('Checklist_items').update({ done: newDone }).eq('id', item.id)
    const updated = checklist.map(i => i.id === item.id ? { ...i, done: newDone } : i)
    setChecklist(updated)
    const done = updated.filter(i => i.done).length
    const total = updated.length
    const pct = total > 0 ? Math.round((done / total) * 100) : 0
    await supabase.from('jobs').update({ completed_tasks: done, total_tasks: total, readiness_percent: pct }).eq('id', job.id)
  }

  async function markComplete() {
    setCompleting(true)
    await supabase.from('jobs').update({ status: 'Complete', readiness_percent: 100 }).eq('id', job.id)
    setCompleted(true); setCompleting(false)
  }

  async function submitIssue() {
    setSubmittingIssue(true)
    let photoUrl = null
    if (issueForm.photo) {
      const ext = issueForm.photo.name.split('.').pop()
      const path = `issues/${Date.now()}.${ext}`
      await supabase.storage.from('uploads').upload(path, issueForm.photo)
      const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(path)
      photoUrl = urlData.publicUrl
    }
    await supabase.from('issues').insert({
      property_id: job.property_id, job_id: job.id,
      category: issueForm.category, severity: issueForm.severity,
      description: issueForm.description, status: 'Open', issue_photo_url: photoUrl
    })
    setIssueDone(true); setSubmittingIssue(false)
    setIssueForm({ category: 'Maintenance', severity: 'Medium', description: '', photo: null })
  }

  async function updateRestock(item, qty) {
    const cur = parseInt(qty) || 0
    const needs = cur < item.minimum_quantity
    await supabase.from('restock').update({ current_quantity: cur, needs_restock: needs }).eq('id', item.id)
    setRestock(prev => prev.map(r => r.id === item.id ? { ...r, current_quantity: cur, needs_restock: needs } : r))
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f7f7f7' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: 22, marginBottom: 8 }}>OpsLoom</div>
        <div style={{ color: '#aaa', fontSize: 14 }}>Loading your job...</div>
      </div>
    </div>
  )

  if (expired) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f7f7f7' }}>
      <div style={{ textAlign: 'center', padding: 32 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
        <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 8 }}>Link expired or invalid</div>
        <div style={{ fontSize: 14, color: '#888' }}>Ask your operator to send a new link.</div>
      </div>
    </div>
  )

  const kb = (() => {
    try {
      const r = property?.knowledge_base
      if (!r) return {}
      return typeof r === 'object' ? r : JSON.parse(r)
    } catch { return {} }
  })()

  const completedCount = checklist.filter(i => i.done).length
  const totalCount = checklist.length

  const tabs = [
    { key: 'job', label: 'Job' },
    { key: 'checklist', label: `Checklist${totalCount > 0 ? ` (${completedCount}/${totalCount})` : ''}` },
    { key: 'issue', label: 'Issue' },
    { key: 'restock', label: 'Restock' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#f7f7f7', paddingBottom: 80 }}>
      <div style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 18 }}>OpsLoom</div>
        {completed && <span style={{ fontSize: 12, background: '#dcfce7', color: '#166534', padding: '4px 12px', borderRadius: 20, fontWeight: 600 }}>✓ Complete</span>}
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 2 }}>{property?.name}</div>
        <div style={{ fontSize: 13, color: '#888', marginBottom: 4 }}>{property?.address}</div>
        {job.checkin_time && <div style={{ fontSize: 13, color: '#555' }}>Check-in: <strong>{new Date(job.checkin_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</strong></div>}
      </div>

      <div style={{ display: 'flex', background: '#fff', borderBottom: '1px solid #f0f0f0', marginTop: 12 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{ flex: 1, padding: '12px 8px', fontSize: 13, fontWeight: 500, border: 'none', background: 'none', cursor: 'pointer', color: activeTab === t.key ? '#0a0a0a' : '#888', borderBottom: activeTab === t.key ? '2px solid #0a0a0a' : '2px solid transparent', whiteSpace: 'nowrap' }}>{t.label}</button>
        ))}
      </div>

      <div style={{ padding: 16 }}>
        {activeTab === 'job' && (
          <div>
            {kb.access_code && (
              <div style={{ background: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, border: '1px solid #f0f0f0' }}>
                <div style={{ fontSize: 11, color: '#aaa', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Access code</div>
                <div style={{ fontFamily: 'monospace', fontSize: 32, fontWeight: 700, letterSpacing: 4 }}>{kb.access_code}</div>
              </div>
            )}
            {kb.lockbox_location && <div style={{ background: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, border: '1px solid #f0f0f0' }}><div style={{ fontSize: 11, color: '#aaa', marginBottom: 4 }}>Lockbox</div><div style={{ fontSize: 14 }}>{kb.lockbox_location}</div></div>}
            {kb.wifi && <div style={{ background: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, border: '1px solid #f0f0f0' }}><div style={{ fontSize: 11, color: '#aaa', marginBottom: 4 }}>Wifi</div><div style={{ fontSize: 14 }}>{kb.wifi}</div></div>}
            {kb.linen_location && <div style={{ background: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, border: '1px solid #f0f0f0' }}><div style={{ fontSize: 11, color: '#aaa', marginBottom: 4 }}>Linen</div><div style={{ fontSize: 14 }}>{kb.linen_location}</div></div>}
            {kb.boiler && <div style={{ background: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, border: '1px solid #f0f0f0' }}><div style={{ fontSize: 11, color: '#aaa', marginBottom: 4 }}>Boiler</div><div style={{ fontSize: 14 }}>{kb.boiler}</div></div>}
            {kb.quirks && <div style={{ background: '#fff8ed', borderRadius: 12, padding: 14, marginBottom: 12, border: '1px solid #fed7aa' }}><div style={{ fontSize: 11, color: '#92400e', marginBottom: 4 }}>⚠️ Special instructions</div><div style={{ fontSize: 14, color: '#92400e' }}>{kb.quirks}</div></div>}
            {job.notes && <div style={{ background: '#eff6ff', borderRadius: 12, padding: 14, marginBottom: 12, border: '1px solid #bfdbfe' }}><div style={{ fontSize: 11, color: '#1e40af', marginBottom: 4 }}>Operator note</div><div style={{ fontSize: 14, color: '#1e40af' }}>{job.notes}</div></div>}
            {property?.knowledge_base_url && <a href={property.knowledge_base_url} target="_blank" rel="noreferrer" style={{ display: 'block', textAlign: 'center', padding: 14, background: '#fff', borderRadius: 12, border: '1px solid #f0f0f0', fontSize: 14, color: '#2563eb', fontWeight: 500, marginBottom: 12 }}>📄 View full property guide</a>}
          </div>
        )}

        {activeTab === 'checklist' && (
          <div>
            {checklist.length === 0 && <div style={{ textAlign: 'center', color: '#aaa', fontSize: 14, padding: 40 }}>No checklist items for this job.</div>}
            {totalCount > 0 && (
              <div style={{ background: '#fff', borderRadius: 12, padding: 14, marginBottom: 12, border: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: '#888' }}>{completedCount} of {totalCount} done</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{Math.round((completedCount / totalCount) * 100)}%</span>
                </div>
                <div style={{ height: 6, background: '#f0f0f0', borderRadius: 3 }}>
                  <div style={{ height: 6, borderRadius: 3, background: completedCount === totalCount ? '#16a34a' : '#d97706', width: `${Math.round((completedCount / totalCount) * 100)}%`, transition: 'width 0.3s' }} />
                </div>
              </div>
            )}
            {checklist.map(item => (
              <div key={item.id} onClick={() => toggleChecklistItem(item)} style={{ background: '#fff', borderRadius: 12, padding: '14px 16px', marginBottom: 8, border: `1px solid ${item.done ? '#bbf7d0' : '#f0f0f0'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, border: `2px solid ${item.done ? '#16a34a' : '#e0e0e0'}`, background: item.done ? '#16a34a' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {item.done && <span style={{ color: '#fff', fontSize: 14, fontWeight: 700 }}>✓</span>}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: item.done ? '#888' : '#333', textDecoration: item.done ? 'line-through' : 'none' }}>{item.task}</div>
                  {item.room && <div style={{ fontSize: 12, color: '#aaa' }}>{item.room}</div>}
                </div>
              </div>
            ))}
            {!completed && completedCount === totalCount && totalCount > 0 && (
              <button onClick={markComplete} disabled={completing} style={{ width: '100%', padding: 16, background: '#0a0a0a', color: '#fff', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 600, cursor: 'pointer', marginTop: 8 }}>{completing ? 'Saving...' : '✓ Mark job complete'}</button>
            )}
            {completed && <div style={{ textAlign: 'center', padding: 20, color: '#16a34a', fontWeight: 600, fontSize: 16 }}>✓ Job marked complete</div>}
          </div>
        )}

        {activeTab === 'issue' && (
          <div>
            {issueDone && <div style={{ background: '#dcfce7', borderRadius: 12, padding: 14, marginBottom: 16, color: '#166534', fontWeight: 500, textAlign: 'center' }}>✓ Issue reported</div>}
            <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #f0f0f0' }}>
              <div style={{ fontWeight: 600, marginBottom: 14 }}>Report an issue</div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>Category</label>
                <select value={issueForm.category} onChange={e => setIssueForm({ ...issueForm, category: e.target.value })} style={{ width: '100%', padding: '10px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 14, background: '#fafafa' }}>
                  {['Cleaning', 'Maintenance', 'Laundry', 'Safety', 'Stock', 'Access'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>Severity</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['Low', 'Medium', 'High', 'Critical'].map(s => (
                    <button key={s} onClick={() => setIssueForm({ ...issueForm, severity: s })} style={{ flex: 1, padding: '8px 4px', borderRadius: 8, fontSize: 12, fontWeight: 500, border: 'none', cursor: 'pointer', background: issueForm.severity === s ? '#0a0a0a' : '#f0f0f0', color: issueForm.severity === s ? '#fff' : '#555' }}>{s}</button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>Description</label>
                <textarea value={issueForm.description} onChange={e => setIssueForm({ ...issueForm, description: e.target.value })} rows={4} placeholder="Describe the issue..." style={{ width: '100%', padding: '10px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 14, background: '#fafafa', resize: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>Photo (optional)</label>
                <input type="file" accept="image/*" capture="environment" onChange={e => setIssueForm({ ...issueForm, photo: e.target.files[0] })} style={{ width: '100%', fontSize: 13 }} />
                {issueForm.photo && <div style={{ fontSize: 12, color: '#16a34a', marginTop: 4 }}>✓ {issueForm.photo.name}</div>}
              </div>
              <button onClick={submitIssue} disabled={submittingIssue} style={{ width: '100%', padding: 14, background: '#0a0a0a', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>{submittingIssue ? 'Submitting...' : 'Submit issue'}</button>
            </div>
          </div>
        )}

        {activeTab === 'restock' && (
          <div>
            {restock.length === 0 && <div style={{ textAlign: 'center', color: '#aaa', fontSize: 14, padding: 40 }}>No inventory items.</div>}
            {restock.map(item => (
              <div key={item.id} style={{ background: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, border: `1px solid ${item.needs_restock ? '#fecaca' : '#f0f0f0'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 2 }}>{item.item_name}</div>
                  <div style={{ fontSize: 12, color: '#aaa' }}>Min: {item.minimum_quantity}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="number" min="0" defaultValue={item.current_quantity} onBlur={e => updateRestock(item, e.target.value)} style={{ width: 60, padding: '6px 8px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 16, textAlign: 'center', fontWeight: 600 }} />
                  <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, background: item.needs_restock ? '#fee2e2' : '#dcfce7', color: item.needs_restock ? '#991b1b' : '#166534', fontWeight: 500 }}>{item.needs_restock ? 'Low' : 'OK'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
