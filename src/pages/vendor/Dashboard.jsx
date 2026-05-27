import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

function SeverityBadge({ severity }) {
  const map = { Critical: 'badge-critical', High: 'badge-high', Medium: 'badge-medium', Low: 'badge-low' }
  return <span className={`badge ${map[severity] || 'badge-low'}`}>{severity}</span>
}

export default function VendorDashboard({ publicMode }) {
  const [issues, setIssues] = useState([])
  const [selected, setSelected] = useState(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      setUserId(user?.id)
      const { data } = await supabase.from('issues')
        .select('*, properties(name, address)')
        .eq('vendor_id', user?.id)
        .eq('status', 'Assigned')
      setIssues(data || [])
      setLoading(false)
    }
    load()
  }, [])

  async function resolveIssue() {
    setSubmitting(true)
    await supabase.from('issues').update({ status: 'Fixed', fix_photo_url: notes }).eq('id', selected.id)
    setIssues(issues.filter(i => i.id !== selected.id))
    setSelected(null)
    setDone(true)
    setSubmitting(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  if (selected) return (
    <div style={{ minHeight: '100vh', background: '#f7f7f7' }}>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setSelected(null)} style={{
            background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#666'
          }}>←</button>
          <span style={{ fontWeight: 600 }}>Issue detail</span>
        </div>
        <SeverityBadge severity={selected.severity} />
      </div>

      <div style={{ padding: 20, maxWidth: 600, margin: '0 auto' }}>
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 6 }}>{selected.category}</div>
          <div style={{ fontSize: 14, color: '#888', marginBottom: 10 }}>
            {selected.properties?.name} · {selected.properties?.address}
          </div>
          <div style={{ fontSize: 15, color: '#333', marginBottom: 16 }}>{selected.description}</div>
          {selected.issue_photo_url && (
            <img src={selected.issue_photo_url} alt="Issue" style={{ width: '100%', borderRadius: 8, marginBottom: 8 }} />
          )}
        </div>

        {!done ? (
          <div className="card">
            <div style={{ fontWeight: 600, marginBottom: 14 }}>Upload fix proof</div>
            <div className="form-group">
              <label className="label">Notes (optional)</label>
              <textarea className="input-field" rows={3} placeholder="Describe what you did..."
                value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
            <button className="btn-primary" onClick={resolveIssue} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Mark as fixed'}
            </button>
          </div>
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: 32 }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>✓</div>
            <div style={{ fontWeight: 600 }}>Issue resolved</div>
            <div style={{ fontSize: 14, color: '#888', marginTop: 6 }}>The operator has been notified.</div>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f7f7f7' }}>
      <div className="page-header">
        <span style={{ fontWeight: 700, fontSize: 18 }}>OpsLoom</span>
        <button className="btn-secondary" onClick={handleLogout} style={{ padding: '8px 14px', fontSize: 13 }}>
          Sign out
        </button>
      </div>

      <div style={{ padding: 20, maxWidth: 600, margin: '0 auto' }}>
        <div style={{ fontWeight: 600, marginBottom: 14 }}>My assigned issues</div>

        {loading && <div className="empty-state">Loading...</div>}
        {!loading && !issues.length && (
          <div className="empty-state">No issues assigned to you right now.</div>
        )}
        {!loading && issues.map(issue => (
          <div key={issue.id} className="card" style={{ marginBottom: 10, cursor: 'pointer' }}
            onClick={() => setSelected(issue)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{issue.category}</div>
                <div style={{ fontSize: 13, color: '#888', marginBottom: 6 }}>
                  {issue.properties?.name}
                </div>
                <div style={{ fontSize: 13, color: '#555' }}>{issue.description}</div>
              </div>
              <SeverityBadge severity={issue.severity} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
