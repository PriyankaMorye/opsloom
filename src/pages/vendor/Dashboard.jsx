import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

// ── ISSUE DETAIL VIEW ─────────────────────────────────────────────────
function IssueDetailView({ issue, vendorRecord, onBack, onResolved }) {
  const [property, setProperty] = useState(null)
  const [status, setStatus] = useState(issue.status)
  const [fixPhoto, setFixPhoto] = useState(null)
  const [fixNotes, setFixNotes] = useState('')
  const [uploading, setUploading] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [resolved, setResolved] = useState(issue.status === 'Fixed' || issue.status === 'Closed')
  const [declining, setDeclining] = useState(false)

  useEffect(() => {
    supabase.from('Properties').select('name, address').eq('id', issue.property_id).single()
      .then(({ data }) => setProperty(data))
  }, [issue.property_id])

  async function acceptIssue() {
    await supabase.from('issues').update({ status: 'In Progress' }).eq('id', issue.id)
    setStatus('In Progress')
  }

  async function declineIssue() {
    setDeclining(true)
    await supabase.from('issues').update({ status: 'Open', vendor_id: null }).eq('id', issue.id)
    setDeclining(false)
    onBack()
  }

  async function resolveIssue() {
    if (!fixPhoto) return alert('Please upload a fix photo first.')
    setResolving(true)
    let fixUrl = null
    const ext = fixPhoto.name.split('.').pop()
    const path = `issues/fix-${issue.id}-${Date.now()}.${ext}`
    await supabase.storage.from('uploads').upload(path, fixPhoto)
    const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(path)
    fixUrl = urlData.publicUrl
    await supabase.from('issues').update({
      status: 'Fixed',
      fix_photo_url: fixUrl,
      fix_notes: fixNotes || null,
      fixed_at: new Date().toISOString(),
    }).eq('id', issue.id)
    setStatus('Fixed')
    setResolved(true)
    setResolving(false)
    onResolved && onResolved(issue.id)
  }

  const sevColors = { Critical: { bg: '#fee2e2', text: '#991b1b' }, High: { bg: '#fee2e2', text: '#991b1b' }, Medium: { bg: '#fef9c3', text: '#854d0e' }, Low: { bg: '#f0f0f0', text: '#555' } }
  const sev = sevColors[issue.severity] || sevColors.Low

  if (resolved) return (
    <div style={{ minHeight: '100vh', background: '#f7f7f7', maxWidth: 600, margin: '0 auto' }}>
      <div style={{ background: '#0a0a0a', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={onBack} style={{ background: 'none', border: '1px solid #444', borderRadius: 8, padding: '6px 14px', fontSize: 13, cursor: 'pointer', color: '#fff' }}>← Back</button>
        <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: '#dcfce7', color: '#166534', fontWeight: 500 }}>Resolved</span>
      </div>
      <div style={{ padding: 32, textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <span style={{ fontSize: 30, color: '#16a34a' }}>✓</span>
        </div>
        <div style={{ fontWeight: 600, fontSize: 20, marginBottom: 6 }}>Issue resolved</div>
        <div style={{ fontSize: 14, color: '#888', marginBottom: 24 }}>The operator has been notified. Thank you.</div>
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e0e0e0', padding: 16, textAlign: 'left' }}>
          {[['Issue', issue.category], ['Property', property?.name || '—'], ['Resolved at', new Date().toLocaleString('en-GB')]].map(([l, v]) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: '#888' }}>{l}</span>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f7f7f7', maxWidth: 600, margin: '0 auto' }}>
      <div style={{ background: '#0a0a0a', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
        <button onClick={onBack} style={{ background: 'none', border: '1px solid #444', borderRadius: 8, padding: '6px 14px', fontSize: 13, cursor: 'pointer', color: '#fff' }}>← Back</button>
        <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: status === 'In Progress' ? '#fef9c3' : '#f0f0f0', color: status === 'In Progress' ? '#854d0e' : '#555', fontWeight: 500 }}>{status}</span>
      </div>
      <div style={{ padding: 16 }}>
        {/* Issue card */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e0e0e0', padding: 16, marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 18, marginBottom: 6 }}>{issue.category}</div>
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 500, background: sev.bg, color: sev.text }}>{issue.severity}</span>
            </div>
          </div>
          <div style={{ height: 1, background: '#f0f0f0', margin: '10px 0' }} />
          {[['Property', property?.name || '—'], ['Address', property?.address || '—'], ['Category', issue.category], ['Reported', issue.created_at ? new Date(issue.created_at).toLocaleString('en-GB') : '—']].map(([l, v]) => (
            <div key={l} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: '#aaa', marginBottom: 2 }}>{l}</div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{v}</div>
            </div>
          ))}
          {issue.description && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: '#aaa', marginBottom: 2 }}>Description</div>
              <div style={{ fontSize: 14, color: '#555' }}>{issue.description}</div>
            </div>
          )}
        </div>

        {/* Before photo */}
        {issue.issue_photo_url && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e0e0e0', padding: 14, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: '#aaa', marginBottom: 8 }}>Before photo</div>
            <img src={issue.issue_photo_url} alt="Issue" style={{ width: '100%', borderRadius: 8, maxHeight: 220, objectFit: 'cover' }} />
          </div>
        )}

        {/* Actions */}
        {status === 'Assigned' && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={acceptIssue} style={{ flex: 1, padding: 14, background: '#0a0a0a', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>Accept and start fix</button>
            <button onClick={declineIssue} disabled={declining} style={{ flex: 1, padding: 14, background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>{declining ? 'Declining...' : 'Cannot attend'}</button>
          </div>
        )}

        {status === 'In Progress' && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e0e0e0', padding: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 14 }}>Upload fix</div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>Fix photo *</div>
              {fixPhoto ? (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: '#166534' }}>✓ {fixPhoto.name}</span>
                  <button onClick={() => setFixPhoto(null)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#aaa' }}>×</button>
                </div>
              ) : (
                <label style={{ cursor: 'pointer' }}>
                  <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => e.target.files[0] && setFixPhoto(e.target.files[0])} />
                  <div style={{ border: '1.5px dashed #e0e0e0', borderRadius: 10, padding: 20, textAlign: 'center', color: '#aaa', fontSize: 13 }}>
                    <div style={{ fontSize: 28, marginBottom: 6 }}>📷</div>
                    Tap to take a photo of the fix
                  </div>
                </label>
              )}
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>Notes (optional)</div>
              <textarea value={fixNotes} onChange={e => setFixNotes(e.target.value)} rows={3} placeholder="Describe what you did to fix it..." style={{ width: '100%', padding: '10px 12px', border: '1px solid #e0e0e0', borderRadius: 8, fontSize: 14, resize: 'none', boxSizing: 'border-box' }} />
            </div>
            <button onClick={resolveIssue} disabled={resolving || !fixPhoto} style={{ width: '100%', padding: 14, background: fixPhoto ? '#16a34a' : '#f0f0f0', color: fixPhoto ? '#fff' : '#aaa', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: fixPhoto ? 'pointer' : 'not-allowed' }}>{resolving ? 'Uploading...' : '✓ Mark as resolved'}</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── ASSIGNED ISSUES TAB ───────────────────────────────────────────────
function AssignedTab({ vendorRecord, onIssueOpen }) {
  const [issues, setIssues] = useState([])
  const [properties, setProperties] = useState({})
  const [loading, setLoading] = useState(true)

  async function load() {
    const { data } = await supabase.from('issues').select('*').eq('vendor_id', vendorRecord.id).not('status', 'in', '("Fixed","Closed")').order('created_at', { ascending: false })
    const list = data || []
    if (list.length) {
      const propIds = [...new Set(list.map(i => i.property_id).filter(Boolean))]
      const { data: props } = await supabase.from('Properties').select('id, name, address').in('id', propIds)
      const map = {}
      if (props) props.forEach(p => { map[p.id] = p })
      setProperties(map)
    }
    setIssues(list)
    setLoading(false)
  }

  useEffect(() => { if (vendorRecord) load() }, [vendorRecord])

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: '#aaa' }}>Loading...</div>

  if (!issues.length) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🔧</div>
      <div style={{ fontWeight: 500, fontSize: 16, marginBottom: 6 }}>No assigned issues</div>
      <div style={{ fontSize: 13, color: '#aaa' }}>When the operator assigns you an issue it will appear here.</div>
    </div>
  )

  const sevColors = { Critical: { bg: '#fee2e2', text: '#991b1b' }, High: { bg: '#fee2e2', text: '#991b1b' }, Medium: { bg: '#fef9c3', text: '#854d0e' }, Low: { bg: '#f0f0f0', text: '#555' } }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 14 }}>{issues.length} open issue{issues.length !== 1 ? 's' : ''}</div>
      {issues.map(issue => {
        const prop = properties[issue.property_id]
        const sev = sevColors[issue.severity] || sevColors.Low
        return (
          <div key={issue.id} onClick={() => onIssueOpen(issue)} style={{ background: '#fff', borderRadius: 14, border: `1.5px solid ${issue.severity === 'Critical' || issue.severity === 'High' ? '#fecaca' : '#e0e0e0'}`, padding: 16, marginBottom: 10, cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 16 }}>{issue.category}</div>
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, fontWeight: 500, background: sev.bg, color: sev.text }}>{issue.severity}</span>
            </div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 4 }}>{prop?.name || '—'}</div>
            <div style={{ fontSize: 12, color: '#aaa', marginBottom: 8 }}>{prop?.address}</div>
            {issue.description && <div style={{ fontSize: 13, color: '#555', marginBottom: 8 }}>{issue.description}</div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: issue.status === 'In Progress' ? '#fef9c3' : '#f0f0f0', color: issue.status === 'In Progress' ? '#854d0e' : '#555', fontWeight: 500 }}>{issue.status}</span>
              <span style={{ fontSize: 12, color: '#aaa' }}>{new Date(issue.created_at).toLocaleDateString('en-GB')}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── COMPLETED ISSUES TAB ──────────────────────────────────────────────
function CompletedTab({ vendorRecord, onIssueOpen }) {
  const [issues, setIssues] = useState([])
  const [properties, setProperties] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!vendorRecord) return
    async function load() {
      const { data } = await supabase.from('issues').select('*').eq('vendor_id', vendorRecord.id).in('status', ['Fixed', 'Closed']).order('created_at', { ascending: false })
      const list = data || []
      if (list.length) {
        const propIds = [...new Set(list.map(i => i.property_id).filter(Boolean))]
        const { data: props } = await supabase.from('Properties').select('id, name').in('id', propIds)
        const map = {}
        if (props) props.forEach(p => { map[p.id] = p })
        setProperties(map)
      }
      setIssues(list)
      setLoading(false)
    }
    load()
  }, [vendorRecord])

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: '#aaa' }}>Loading...</div>

  if (!issues.length) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
      <div style={{ fontWeight: 500, fontSize: 16 }}>No completed issues yet</div>
    </div>
  )

  return (
    <div style={{ padding: 16 }}>
      {issues.map(issue => (
        <div key={issue.id} onClick={() => onIssueOpen(issue)} style={{ background: '#fff', borderRadius: 14, border: '0.5px solid #e0e0e0', padding: 16, marginBottom: 10, cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{issue.category}</div>
            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#dcfce7', color: '#166534', fontWeight: 500 }}>Fixed</span>
          </div>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 4 }}>{properties[issue.property_id]?.name || '—'}</div>
          {issue.description && <div style={{ fontSize: 13, color: '#555', marginBottom: 6 }}>{issue.description}</div>}
          {issue.fix_photo_url && (
            <div style={{ marginBottom: 8 }}>
              <img src={issue.fix_photo_url} alt="Fix" style={{ width: '100%', borderRadius: 8, maxHeight: 140, objectFit: 'cover' }} />
            </div>
          )}
          <div style={{ fontSize: 12, color: '#aaa' }}>{new Date(issue.created_at).toLocaleDateString('en-GB')}</div>
        </div>
      ))}
    </div>
  )
}

// ── PROFILE TAB ───────────────────────────────────────────────────────
function ProfileTab({ vendorRecord }) {
  const [stats, setStats] = useState({ total: 0, fixed: 0 })

  useEffect(() => {
    if (!vendorRecord) return
    supabase.from('issues').select('id, status').eq('vendor_id', vendorRecord.id)
      .then(({ data }) => {
        const list = data || []
        setStats({ total: list.length, fixed: list.filter(i => i.status === 'Fixed' || i.status === 'Closed').length })
      })
  }, [vendorRecord])

  if (!vendorRecord) return null

  const trades = (() => {
    try {
      const t = vendorRecord.trades
      if (!t) return [vendorRecord.trade].filter(Boolean)
      if (Array.isArray(t)) return t
      return JSON.parse(t)
    } catch { return [vendorRecord.trade].filter(Boolean) }
  })()

  return (
    <div style={{ padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 14, border: '0.5px solid #e0e0e0', padding: 16, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 20 }}>{vendorRecord.name?.charAt(0) || 'V'}</span>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 18 }}>{vendorRecord.name}</div>
            <div style={{ fontSize: 13, color: '#888' }}>{vendorRecord.agency_name && vendorRecord.agency_name !== 'No agency' ? vendorRecord.agency_name : 'Independent'}</div>
          </div>
        </div>
        {trades.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {trades.map(t => <span key={t} style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, background: '#f0f0f0', color: '#444' }}>{t}</span>)}
          </div>
        )}
        {[['Phone', vendorRecord.phone], ['Email', vendorRecord.email]].map(([l, v]) => (
          <div key={l} style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 13, color: '#aaa', width: 60 }}>{l}</span>
            <span style={{ fontSize: 13 }}>{v || 'Not set'}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div style={{ background: '#f7f7f7', borderRadius: 12, padding: 14, textAlign: 'center' }}>
          <div style={{ fontWeight: 600, fontSize: 28 }}>{stats.total}</div>
          <div style={{ fontSize: 12, color: '#888' }}>Total issues</div>
        </div>
        <div style={{ background: '#f0fdf4', borderRadius: 12, padding: 14, textAlign: 'center' }}>
          <div style={{ fontWeight: 600, fontSize: 28, color: '#16a34a' }}>{stats.fixed}</div>
          <div style={{ fontSize: 12, color: '#16a34a' }}>Fixed</div>
        </div>
      </div>

      <button onClick={() => supabase.auth.signOut()} style={{ width: '100%', padding: 14, background: '#fff', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 12, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>Sign out</button>
    </div>
  )
}

// ── MAIN ──────────────────────────────────────────────────────────────
export default function VendorDashboard() {
  const [tab, setTab] = useState('assigned')
  const [vendorRecord, setVendorRecord] = useState(null)
  const [openIssue, setOpenIssue] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('Vendors').select('*').eq('auth_user_id', user.id).single()
        .then(({ data }) => { if (data) setVendorRecord(data) })
    })
  }, [])

  function handleResolved(issueId) {
    setOpenIssue(null)
    setTab('completed')
    setRefreshKey(k => k + 1)
  }

  if (openIssue) return (
    <IssueDetailView
      issue={openIssue}
      vendorRecord={vendorRecord}
      onBack={() => setOpenIssue(null)}
      onResolved={handleResolved}
    />
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f7f7f7', display: 'flex', flexDirection: 'column', maxWidth: 600, margin: '0 auto' }}>
      <div style={{ background: '#0a0a0a', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 18, color: '#fff' }}>OpsLoom</span>
        {vendorRecord && <span style={{ fontSize: 13, color: '#888' }}>{vendorRecord.name}</span>}
      </div>

      <div style={{ display: 'flex', background: '#fff', borderBottom: '1px solid #e0e0e0' }}>
        {[{ key: 'assigned', label: 'Assigned' }, { key: 'completed', label: 'Completed' }, { key: 'profile', label: 'Profile' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ flex: 1, padding: '12px 8px', fontSize: 13, fontWeight: 500, border: 'none', background: 'none', cursor: 'pointer', color: tab === t.key ? '#0a0a0a' : '#888', borderBottom: tab === t.key ? '2px solid #0a0a0a' : '2px solid transparent' }}>{t.label}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'assigned' && <AssignedTab key={`a-${refreshKey}`} vendorRecord={vendorRecord} onIssueOpen={setOpenIssue} />}
        {tab === 'completed' && <CompletedTab key={`c-${refreshKey}`} vendorRecord={vendorRecord} onIssueOpen={setOpenIssue} />}
        {tab === 'profile' && <ProfileTab vendorRecord={vendorRecord} />}
      </div>
    </div>
  )
}
