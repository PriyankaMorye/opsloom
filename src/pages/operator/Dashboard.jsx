import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

function NavTab({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 16px',
        borderRadius: 8,
        fontSize: 14,
        fontWeight: 500,
        background: active ? '#0a0a0a' : 'transparent',
        color: active ? '#fff' : '#666',
        border: 'none',
        cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  )
}

function ReadinessBar({ percent }) {
  const color = percent === 100 ? '#16a34a' : percent >= 50 ? '#d97706' : '#dc2626'
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: '#888' }}>Readiness</span>
        <span style={{ fontSize: 12, fontWeight: 600, color }}>{percent || 0}%</span>
      </div>
      <div style={{ height: 6, background: '#f0f0f0', borderRadius: 3 }}>
        <div style={{ height: 6, background: color, borderRadius: 3, width: `${percent || 0}%`, transition: 'width 0.3s' }} />
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const map = {
    'Ready': 'badge-ready',
    'At Risk': 'badge-atrisk',
    'Not Ready': 'badge-notready',
  }
  return <span className={`badge ${map[status] || 'badge-notready'}`}>{status || 'Not Ready'}</span>
}

function SeverityBadge({ severity }) {
  const map = {
    'Critical': 'badge-critical',
    'High': 'badge-high',
    'Medium': 'badge-medium',
    'Low': 'badge-low',
  }
  return <span className={`badge ${map[severity] || 'badge-low'}`}>{severity}</span>
}

function ComplianceBadge({ status }) {
  const map = { 'Valid': 'badge-valid', 'Due Soon': 'badge-duesoon', 'Expired': 'badge-expired' }
  return <span className={`badge ${map[status] || 'badge-duesoon'}`}>{status}</span>
}

// ── Properties Tab ────────────────────────────────────────────────────
function PropertiesTab() {
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('properties').select('*').then(({ data }) => {
      setProperties(data || [])
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="empty-state">Loading properties...</div>
  if (!properties.length) return (
    <div className="empty-state">
      No properties yet. Add your first property to get started.
    </div>
  )

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {properties.map(p => (
        <div key={p.id} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{p.name}</div>
              <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>{p.address}</div>
              <div style={{ fontSize: 12, color: '#aaa' }}>
                {p.bedrooms} bedroom{p.bedrooms !== 1 ? 's' : ''} · Next check-in: {p.next_checkin ? new Date(p.next_checkin).toLocaleDateString('en-GB') : 'Not set'}
              </div>
            </div>
            <StatusBadge status={p.readiness_status} />
          </div>
          <ReadinessBar percent={p.readiness_percent || 0} />
        </div>
      ))}
    </div>
  )
}

// ── Issues Tab ────────────────────────────────────────────────────────
function IssuesTab() {
  const [issues, setIssues] = useState([])
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('issues').select('*, properties(name)').neq('status', 'Closed'),
      supabase.from('vendors').select('*'),
    ]).then(([issuesRes, vendorsRes]) => {
      setIssues(issuesRes.data || [])
      setVendors(vendorsRes.data || [])
      setLoading(false)
    })
  }, [])

  async function assignVendor(issueId, vendorId) {
    await supabase.from('issues').update({ vendor_id: vendorId, status: 'Assigned' }).eq('id', issueId)
    setIssues(issues.map(i => i.id === issueId ? { ...i, vendor_id: vendorId, status: 'Assigned' } : i))
  }

  if (loading) return <div className="empty-state">Loading issues...</div>
  if (!issues.length) return <div className="empty-state">No open issues. All clear.</div>

  const grouped = ['Critical', 'High', 'Medium', 'Low'].map(sev => ({
    severity: sev,
    items: issues.filter(i => i.severity === sev),
  })).filter(g => g.items.length > 0)

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {grouped.map(group => (
        <div key={group.severity}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <SeverityBadge severity={group.severity} />
            <span style={{ fontSize: 13, color: '#888' }}>{group.items.length} issue{group.items.length !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {group.items.map(issue => (
              <div key={issue.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{issue.category}</div>
                    <div style={{ fontSize: 13, color: '#888', marginBottom: 4 }}>{issue.properties?.name}</div>
                    <div style={{ fontSize: 13, color: '#555' }}>{issue.description}</div>
                  </div>
                  <span className={`badge badge-${(issue.status || 'open').toLowerCase().replace(' ', '')}`}>{issue.status || 'Open'}</span>
                </div>
                {issue.issue_photo_url && (
                  <img src={issue.issue_photo_url} alt="Issue" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 8, marginBottom: 10 }} />
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, color: '#888' }}>Assign to:</span>
                  <select
                    className="input-field"
                    style={{ flex: 1, padding: '6px 10px', fontSize: 13 }}
                    value={issue.vendor_id || ''}
                    onChange={e => assignVendor(issue.id, e.target.value)}
                  >
                    <option value="">Select vendor</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>{v.name} — {v.trade}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Restock Tab ───────────────────────────────────────────────────────
function RestockTab() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('restock').select('*, properties(name)').eq('needs_restock', true).then(({ data }) => {
      setItems(data || [])
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="empty-state">Loading restock items...</div>
  if (!items.length) return <div className="empty-state">No items need restocking. All good.</div>

  const byProperty = items.reduce((acc, item) => {
    const name = item.properties?.name || 'Unknown'
    if (!acc[name]) acc[name] = []
    acc[name].push(item)
    return acc
  }, {})

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {Object.entries(byProperty).map(([property, items]) => (
        <div key={property}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8, color: '#444' }}>{property}</div>
          <div style={{ display: 'grid', gap: 6 }}>
            {items.map(item => (
              <div key={item.id} className="card" style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 500 }}>{item.item_name}</span>
                  <span style={{ fontSize: 13, color: '#dc2626' }}>
                    {item.current_quantity} / {item.minimum_quantity} min
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Compliance Tab ────────────────────────────────────────────────────
function ComplianceTab() {
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('compliance_documents').select('*, properties(name)').then(({ data }) => {
      const enriched = (data || []).map(d => {
        const days = d.expiry_date ? Math.ceil((new Date(d.expiry_date) - new Date()) / (1000 * 60 * 60 * 24)) : null
        let status = 'Valid'
        if (days === null) status = 'Missing'
        else if (days < 0) status = 'Expired'
        else if (days <= 30) status = 'Due Soon'
        return { ...d, computed_status: status, days_remaining: days }
      })
      setDocs(enriched)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="empty-state">Loading compliance documents...</div>
  if (!docs.length) return <div className="empty-state">No compliance documents uploaded yet.</div>

  const grouped = ['Expired', 'Due Soon', 'Valid'].map(s => ({
    status: s,
    items: docs.filter(d => d.computed_status === s),
  })).filter(g => g.items.length > 0)

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {grouped.map(group => (
        <div key={group.status}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <ComplianceBadge status={group.status} />
            <span style={{ fontSize: 13, color: '#888' }}>{group.items.length} document{group.items.length !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {group.items.map(doc => (
              <div key={doc.id} className="card" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{doc.document_type}</div>
                    <div style={{ fontSize: 13, color: '#888' }}>{doc.properties?.name}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <ComplianceBadge status={doc.computed_status} />
                    <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>
                      {doc.expiry_date ? `Expires ${new Date(doc.expiry_date).toLocaleDateString('en-GB')}` : 'No date set'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────────────────────
export default function OperatorDashboard() {
  const [tab, setTab] = useState('properties')

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  const tabs = [
    { key: 'properties', label: 'Properties' },
    { key: 'issues', label: 'Issues' },
    { key: 'restock', label: 'Restock' },
    { key: 'compliance', label: 'Compliance' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#f7f7f7' }}>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.5px' }}>OpsLoom</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {tabs.map(t => (
              <NavTab key={t.key} label={t.label} active={tab === t.key} onClick={() => setTab(t.key)} />
            ))}
          </div>
        </div>
        <button className="btn-secondary" onClick={handleLogout} style={{ padding: '8px 16px' }}>
          Sign out
        </button>
      </div>

      {/* Content */}
      <div className="page-body">
        {tab === 'properties'  && <PropertiesTab />}
        {tab === 'issues'      && <IssuesTab />}
        {tab === 'restock'     && <RestockTab />}
        {tab === 'compliance'  && <ComplianceTab />}
      </div>
    </div>
  )
}
