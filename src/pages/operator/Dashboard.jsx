import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

function NavTab({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '8px 16px', borderRadius: 8, fontSize: 14, fontWeight: 500,
      background: active ? '#0a0a0a' : 'transparent',
      color: active ? '#fff' : '#666', border: 'none', cursor: 'pointer', transition: 'all 0.15s',
    }}>{label}</button>
  )
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

// ── PROPERTY PROFILE ──────────────────────────────────────────────────
function PropertyProfileTab() {
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [issues, setIssues] = useState([])
  const [restockItems, setRestockItems] = useState([])
  const [compDocs, setCompDocs] = useState([])
  const [jobs, setJobs] = useState([])

  useEffect(() => {
    supabase.from('Properties').select('*').then(({ data }) => {
      setProperties(data || [])
      setLoading(false)
    })
  }, [])

  async function openProperty(p) {
    setSelected(p)
    const [issRes, restRes, compRes, jobRes] = await Promise.all([
      supabase.from('issues').select('*').eq('property_id', p.id).order('created_at', { ascending: false }).limit(1),
      supabase.from('restock').select('*').eq('property_id', p.id),
      supabase.from('compliance_documents').select('*').eq('property_id', p.id),
      supabase.from('jobs').select('*').eq('property_id', p.id).order('created_at', { ascending: false }).limit(5),
    ])
    setIssues(issRes.data || [])
    setRestockItems(restRes.data || [])
    setCompDocs(compRes.data || [])
    setJobs(jobRes.data || [])
  }

  const filtered = properties.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.address?.toLowerCase().includes(search.toLowerCase())
  )

  // Detail view
  if (selected) {
    const lastIssue = issues[0]
    const needsRestock = restockItems.filter(r => r.needs_restock)
    const expiredDocs = compDocs.filter(d => {
      const days = d.expiry_date ? Math.ceil((new Date(d.expiry_date) - new Date()) / 86400000) : null
      return days !== null && days < 0
    })
    const dueSoonDocs = compDocs.filter(d => {
      const days = d.expiry_date ? Math.ceil((new Date(d.expiry_date) - new Date()) / 86400000) : null
      return days !== null && days >= 0 && days <= 30
    })

    return (
      <div>
        <button onClick={() => setSelected(null)} style={{
          background: 'none', border: '1px solid #e0e0e0', borderRadius: 8,
          padding: '8px 16px', fontSize: 13, cursor: 'pointer', marginBottom: 16, color: '#555'
        }}>← Back to properties</button>

        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 4 }}>{selected.name}</div>
              <div style={{ fontSize: 14, color: '#888', marginBottom: 8 }}>{selected.address}</div>
              <div style={{ fontSize: 13, color: '#aaa' }}>{selected.bedroom} bedroom{selected.bedroom !== 1 ? 's' : ''}</div>
            </div>
            <StatusBadge status={selected.readiness_status} />
          </div>
          <ReadinessBar percent={selected.readiness_percent || 0} />
        </div>

        {/* Knowledge Base */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 12 }}>Knowledge Base</div>
          <div style={{ display: 'grid', gap: 10 }}>
            <div><div style={{ fontSize: 11, color: '#aaa', marginBottom: 2 }}>Access code</div>
              <div style={{ fontSize: 16, fontWeight: 600, fontFamily: 'monospace' }}>{selected.access_code || 'Not set'}</div></div>
            <div><div style={{ fontSize: 11, color: '#aaa', marginBottom: 2 }}>Linen location</div>
              <div style={{ fontSize: 14 }}>{selected.linen_location || 'Not set'}</div></div>
            <div><div style={{ fontSize: 11, color: '#aaa', marginBottom: 2 }}>Appliance notes</div>
              <div style={{ fontSize: 14 }}>{selected.appliance_notes || 'Not set'}</div></div>
          </div>
        </div>

        {/* Cleaning Status */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontWeight: 600 }}>Cleaning Status</div>
            <button style={{ fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}>
              View cleaning history →
            </button>
          </div>
          {jobs.length > 0 ? (
            <div>
              <div style={{ fontSize: 13, color: '#888', marginBottom: 4 }}>Last turnover: {new Date(jobs[0].job_date).toLocaleDateString('en-GB')}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`badge ${jobs[0].status === 'Complete' ? 'badge-ready' : jobs[0].status === 'In progress' ? 'badge-atrisk' : 'badge-notready'}`}>{jobs[0].status}</span>
                <span style={{ fontSize: 13, color: '#888' }}>{jobs[0].readiness_percent || 0}% complete</span>
              </div>
            </div>
          ) : <div style={{ fontSize: 13, color: '#aaa' }}>No cleaning jobs recorded yet.</div>}
        </div>

        {/* Issue Status */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontWeight: 600 }}>Issue Status</div>
            <button style={{ fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}>
              View issue history →
            </button>
          </div>
          {lastIssue ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <SeverityBadge s={lastIssue.severity} />
                <span style={{ fontSize: 13, fontWeight: 500 }}>{lastIssue.category}</span>
              </div>
              <div style={{ fontSize: 13, color: '#555' }}>{lastIssue.description}</div>
              <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>Status: {lastIssue.status}</div>
            </div>
          ) : <div style={{ fontSize: 13, color: '#16a34a' }}>No open issues.</div>}
        </div>

        {/* Inventory */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Inventory Status</div>
          {needsRestock.length > 0 ? (
            <div>
              <div style={{ fontSize: 13, color: '#dc2626', marginBottom: 8 }}>{needsRestock.length} item{needsRestock.length !== 1 ? 's' : ''} need restocking</div>
              {needsRestock.map(item => (
                <div key={item.id} style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>
                  • {item.item_name} — {item.current_quantity} / {item.minimum_quantity} min
                </div>
              ))}
            </div>
          ) : <div style={{ fontSize: 13, color: '#16a34a' }}>All inventory stocked.</div>}
        </div>

        {/* Compliance */}
        <div className="card">
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Compliance Status</div>
          {expiredDocs.length > 0 && (
            <div style={{ fontSize: 13, color: '#dc2626', marginBottom: 6 }}>{expiredDocs.length} document{expiredDocs.length !== 1 ? 's' : ''} expired</div>
          )}
          {dueSoonDocs.length > 0 && (
            <div style={{ fontSize: 13, color: '#d97706', marginBottom: 6 }}>{dueSoonDocs.length} document{dueSoonDocs.length !== 1 ? 's' : ''} due soon</div>
          )}
          {expiredDocs.length === 0 && dueSoonDocs.length === 0 && (
            <div style={{ fontSize: 13, color: '#16a34a' }}>All compliance documents valid.</div>
          )}
        </div>
      </div>
    )
  }

  if (loading) return <div className="empty-state">Loading properties...</div>

  return (
    <div>
      <input className="input-field" placeholder="Search properties..." value={search}
        onChange={e => setSearch(e.target.value)} style={{ marginBottom: 16 }} />
      {!filtered.length && <div className="empty-state">No properties found.</div>}
      <div style={{ display: 'grid', gap: 12 }}>
        {filtered.map(p => (
          <div key={p.id} className="card" style={{ cursor: 'pointer' }} onClick={() => openProperty(p)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{p.name}</div>
                <div style={{ fontSize: 13, color: '#888', marginBottom: 6 }}>{p.address}</div>
                <div style={{ fontSize: 12, color: '#aaa' }}>
                  {p.bedroom} bed · Check-in: {p.next_checkin ? new Date(p.next_checkin).toLocaleDateString('en-GB') : 'Not set'}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <StatusBadge status={p.readiness_status} />
                <span style={{ fontSize: 12, color: '#aaa' }}>Tap to view →</span>
              </div>
            </div>
            <ReadinessBar percent={p.readiness_percent || 0} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── VENDOR DIRECTORY ──────────────────────────────────────────────────
function VendorDirectoryTab() {
  const [vendors, setVendors] = useState([])
  const [cleaners, setCleaners] = useState([])
  const [agencies, setAgencies] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('vendors')

  useEffect(() => {
    Promise.all([
      supabase.from('Vendors').select('*'),
      supabase.from('Cleaners').select('*'),
      supabase.from('agencies').select('*'),
    ]).then(([v, c, a]) => {
      setVendors(v.data || [])
      setCleaners(c.data || [])
      setAgencies(a.data || [])
      setLoading(false)
    })
  }, [])

  const tradeColors = { Plumber: '#dbeafe', Electrician: '#fef9c3', Handyman: '#dcfce7', Laundry: '#f3e8ff', Other: '#f3f4f6' }
  const tradeText   = { Plumber: '#1e40af', Electrician: '#854d0e', Handyman: '#166534', Laundry: '#6b21a8', Other: '#374151' }

  if (loading) return <div className="empty-state">Loading...</div>

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['vendors', 'cleaners', 'agencies'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
            background: tab === t ? '#0a0a0a' : '#f0f0f0', color: tab === t ? '#fff' : '#555', border: 'none',
          }}>{t.charAt(0).toUpperCase() + t.slice(1)} ({(t === 'vendors' ? vendors : t === 'cleaners' ? cleaners : agencies).length})</button>
        ))}
      </div>

      {tab === 'vendors' && (
        <div style={{ display: 'grid', gap: 10 }}>
          {!vendors.length && <div className="empty-state">No vendors added yet.</div>}
          {vendors.map(v => (
            <div key={v.id} className="card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{v.name}</div>
                  <div style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>{v.phone}</div>
                  <div style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>{v.email}</div>
                  <div style={{ fontSize: 13, color: '#aaa' }}>
                    {v.agency_name && v.agency_name !== 'No agency' ? `Agency: ${v.agency_name}` : 'No agency'}
                  </div>
                </div>
                <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                  background: tradeColors[v.trade] || tradeColors.Other, color: tradeText[v.trade] || tradeText.Other }}>
                  {v.trade}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'cleaners' && (
        <div style={{ display: 'grid', gap: 10 }}>
          {!cleaners.length && <div className="empty-state">No cleaners added yet.</div>}
          {cleaners.map(c => (
            <div key={c.id} className="card" style={{ padding: '14px 16px' }}>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{c.name}</div>
              <div style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>{c.phone}</div>
              <div style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>{c.email}</div>
              <div style={{ fontSize: 13, color: '#aaa' }}>
                {c.agency_name && c.agency_name !== 'No agency' ? `Agency: ${c.agency_name}` : 'No agency'}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'agencies' && (
        <div style={{ display: 'grid', gap: 10 }}>
          {!agencies.length && <div className="empty-state">No agencies added yet.</div>}
          {agencies.map(a => (
            <div key={a.id} className="card" style={{ padding: '14px 16px' }}>
              <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{a.name}</div>
              <div style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>{a.contact_no}</div>
              <div style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>{a.email}</div>
              <div style={{ fontSize: 13, color: '#aaa' }}>{a.address}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── ISSUES ────────────────────────────────────────────────────────────
function IssuesTab() {
  const [issues, setIssues] = useState([])
  const [vendors, setVendors] = useState([])
  const [cleaners, setCleaners] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [closeComment, setCloseComment] = useState('')
  const [assigning, setAssigning] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('issues').select('*').neq('status', 'Closed'),
      supabase.from('Vendors').select('*'),
      supabase.from('Cleaners').select('*'),
    ]).then(([i, v, c]) => {
      setIssues(i.data || [])
      setVendors(v.data || [])
      setCleaners(c.data || [])
      setLoading(false)
    })
  }, [])

  function getAssigneeName(issue) {
    if (!issue.vendor_id) return null
    const vendor = vendors.find(v => v.id === issue.vendor_id)
    const cleaner = cleaners.find(c => c.id === issue.vendor_id)
    return vendor?.name || cleaner?.name || null
  }

  async function assignIssue(issueId, assigneeId) {
    setAssigning(true)
    const status = assigneeId ? 'Assigned' : 'Open'
    await supabase.from('issues').update({ vendor_id: assigneeId || null, status }).eq('id', issueId)
    const updated = issues.map(i => i.id === issueId ? { ...i, vendor_id: assigneeId || null, status } : i)
    setIssues(updated)
    if (selected?.id === issueId) setSelected({ ...selected, vendor_id: assigneeId || null, status })
    setAssigning(false)
  }

  async function closeIssue(issueId) {
    await supabase.from('issues').update({ status: 'Closed' }).eq('id', issueId)
    setIssues(issues.filter(i => i.id !== issueId))
    setSelected(null)
    setCloseComment('')
  }

  // Detail view
  if (selected) {
    const assigneeName = getAssigneeName(selected)
    const allAssignees = [
      { id: '', name: 'Not assigned' },
      ...vendors.map(v => ({ id: v.id, name: `${v.name} (Vendor)` })),
      ...cleaners.map(c => ({ id: c.id, name: `${c.name} (Cleaner)` })),
    ]

    return (
      <div>
        <button onClick={() => setSelected(null)} style={{
          background: 'none', border: '1px solid #e0e0e0', borderRadius: 8,
          padding: '8px 16px', fontSize: 13, cursor: 'pointer', marginBottom: 16, color: '#555'
        }}>← Back to issues</button>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 6 }}>{selected.category}</div>
              <SeverityBadge s={selected.severity} />
            </div>
            <span className={`badge badge-${(selected.status || 'open').toLowerCase().replace(' ', '')}`}>{selected.status || 'Open'}</span>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: '#aaa', marginBottom: 4 }}>Issue details</div>
            <div style={{ fontSize: 14, color: '#333' }}>{selected.description}</div>
          </div>

          {selected.issue_photo_url && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#aaa', marginBottom: 6 }}>Before photo</div>
              <img src={selected.issue_photo_url} alt="Issue" style={{ width: '100%', borderRadius: 8, maxHeight: 200, objectFit: 'cover' }} />
            </div>
          )}

          {selected.fix_photo_url && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#aaa', marginBottom: 6 }}>After photo</div>
              <img src={selected.fix_photo_url} alt="Fix" style={{ width: '100%', borderRadius: 8, maxHeight: 200, objectFit: 'cover' }} />
            </div>
          )}

          <div className="divider" />

          <div style={{ marginBottom: 16 }}>
            <label className="label">Assigned to</label>
            <select className="input-field" value={selected.vendor_id || ''}
              onChange={e => assignIssue(selected.id, e.target.value)}>
              {allAssignees.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          <button className="btn-primary" onClick={() => assignIssue(selected.id, selected.vendor_id)}
            disabled={assigning} style={{ marginBottom: 12 }}>
            {assigning ? 'Assigning...' : 'Confirm assignment'}
          </button>

          <div className="divider" />

          <div style={{ marginBottom: 12 }}>
            <label className="label">Close issue with comment</label>
            <textarea className="input-field" rows={3} placeholder="Add a closing comment..."
              value={closeComment} onChange={e => setCloseComment(e.target.value)} />
          </div>
          <button onClick={() => closeIssue(selected.id)} style={{
            width: '100%', padding: 12, borderRadius: 8, fontSize: 15, fontWeight: 500,
            background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', cursor: 'pointer'
          }}>Close issue</button>
        </div>
      </div>
    )
  }

  if (loading) return <div className="empty-state">Loading issues...</div>
  if (!issues.length) return <div className="empty-state">No open issues. All clear.</div>

  const grouped = ['Critical', 'High', 'Medium', 'Low'].map(sev => ({
    severity: sev, items: issues.filter(i => i.severity === sev),
  })).filter(g => g.items.length > 0)

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {grouped.map(group => (
        <div key={group.severity}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <SeverityBadge s={group.severity} />
            <span style={{ fontSize: 13, color: '#888' }}>{group.items.length} issue{group.items.length !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {group.items.map(issue => {
              const assigneeName = getAssigneeName(issue)
              return (
                <div key={issue.id} className="card" style={{ cursor: 'pointer' }} onClick={() => setSelected(issue)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div style={{ fontWeight: 600 }}>{issue.category}</div>
                    <span className={`badge ${issue.status === 'Assigned' ? 'badge-valid' : issue.status === 'In progress' ? 'badge-atrisk' : 'badge-open'}`}>
                      {issue.status || 'Not assigned'}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: '#555', marginBottom: 6 }}>{issue.description}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>
                    {assigneeName ? `Assigned to: ${assigneeName}` : 'Not assigned'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── INVENTORY ─────────────────────────────────────────────────────────
function InventoryTab() {
  const [items, setItems] = useState([])
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('restock').select('*'),
      supabase.from('Properties').select('id, name'),
    ]).then(([r, p]) => {
      setItems(r.data || [])
      setProperties(p.data || [])
      setLoading(false)
    })
  }, [])

  const filtered = items.filter(item => {
    if (filter === 'all') return true
    if (filter === 'needs_restock') return item.needs_restock
    return item.property_id === filter
  })

  if (loading) return <div className="empty-state">Loading inventory...</div>

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <select className="input-field" style={{ maxWidth: 260, padding: '8px 12px' }}
          value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="all">All properties</option>
          <option value="needs_restock">Needs restock only</option>
          {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {!filtered.length && <div className="empty-state">No inventory items found.</div>}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ background: '#f4f4f4' }}>
              {['Property', 'Item', 'Min qty', 'Current qty', 'Status'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600,
                  fontSize: 13, color: '#444', borderBottom: '1px solid #e0e0e0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((item, i) => (
              <tr key={item.id} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0', color: '#555' }}>
                  {properties.find(p => p.id == item.property_id)?.name || '—'}
                </td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0', fontWeight: 500 }}>
                  {item.item_name}
                </td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0', color: '#888' }}>
                  {item.minimum_quantity}
                </td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0',
                  color: item.needs_restock ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                  {item.current_quantity}
                </td>
                <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0' }}>
                  <span className={`badge ${item.needs_restock ? 'badge-notready' : 'badge-ready'}`}>
                    {item.needs_restock ? 'Needs restock' : 'Stocked'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── COMPLIANCE ────────────────────────────────────────────────────────
function ComplianceTab() {
  const [docs, setDocs] = useState([])
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ document_type: '', property_id: '', issue_date: '', expiry_date: '', status: 'Valid' })
  const [saving, setSaving] = useState(false)

  const docTypes = ['Gas Safety Record (CP12)', 'EICR', 'EPC', 'Public Liability Insurance', 'Fire Risk Assessment']

  useEffect(() => {
    Promise.all([
      supabase.from('compliance_documents').select('*'),
      supabase.from('Properties').select('id, name'),
    ]).then(([d, p]) => {
      const enriched = (d.data || []).map(doc => {
        const days = doc.expiry_date ? Math.ceil((new Date(doc.expiry_date) - new Date()) / 86400000) : null
        let status = 'Valid'
        if (days === null) status = 'Missing'
        else if (days < 0) status = 'Expired'
        else if (days <= 30) status = 'Due Soon'
        return { ...doc, computed_status: status }
      })
      setDocs(enriched)
      setProperties(p.data || [])
      setLoading(false)
    })
  }, [])

  async function saveDocument() {
    setSaving(true)
    const days = form.expiry_date ? Math.ceil((new Date(form.expiry_date) - new Date()) / 86400000) : null
    let status = 'Valid'
    if (days === null) status = 'Missing'
    else if (days < 0) status = 'Expired'
    else if (days <= 30) status = 'Due Soon'

    await supabase.from('compliance_documents').insert({
      document_type: form.document_type,
      property_id: form.property_id || null,
      issue_date: form.issue_date || null,
      expiry_date: form.expiry_date || null,
      status,
    })

    // Refresh
    const { data } = await supabase.from('compliance_documents').select('*')
    const enriched = (data || []).map(doc => {
      const d = doc.expiry_date ? Math.ceil((new Date(doc.expiry_date) - new Date()) / 86400000) : null
      let s = 'Valid'
      if (d === null) s = 'Missing'
      else if (d < 0) s = 'Expired'
      else if (d <= 30) s = 'Due Soon'
      return { ...doc, computed_status: s }
    })
    setDocs(enriched)
    setForm({ document_type: '', property_id: '', issue_date: '', expiry_date: '', status: 'Valid' })
    setShowForm(false)
    setSaving(false)
  }

  if (loading) return <div className="empty-state">Loading compliance documents...</div>

  const grouped = ['Expired', 'Due Soon', 'Valid'].map(s => ({
    status: s, items: docs.filter(d => d.computed_status === s),
  })).filter(g => g.items.length > 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 14, color: '#888' }}>{docs.length} document{docs.length !== 1 ? 's' : ''} total</div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary" style={{ width: 'auto', padding: '8px 16px' }}>
          {showForm ? 'Cancel' : '+ Add document'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 16 }}>Add compliance document</div>

          <div className="form-group">
            <label className="label">Document type</label>
            <select className="input-field" value={form.document_type}
              onChange={e => setForm({ ...form, document_type: e.target.value })}>
              <option value="">Select document</option>
              {docTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="label">Property</label>
            <select className="input-field" value={form.property_id}
              onChange={e => setForm({ ...form, property_id: e.target.value })}>
              <option value="">Select property</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="label">Issue date</label>
            <input className="input-field" type="date" value={form.issue_date}
              onChange={e => setForm({ ...form, issue_date: e.target.value })} />
          </div>

          <div className="form-group">
            <label className="label">Expiry date</label>
            <input className="input-field" type="date" value={form.expiry_date}
              onChange={e => setForm({ ...form, expiry_date: e.target.value })} />
          </div>

          <button className="btn-primary" onClick={saveDocument} disabled={saving || !form.document_type}>
            {saving ? 'Saving...' : 'Save document'}
          </button>
        </div>
      )}

      {!docs.length && <div className="empty-state">No compliance documents yet. Add one above.</div>}

      {grouped.map(group => (
        <div key={group.status} style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <CompBadge status={group.status} />
            <span style={{ fontSize: 13, color: '#888' }}>{group.items.length} document{group.items.length !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {group.items.map(doc => (
              <div key={doc.id} className="card" style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{doc.document_type}</div>
                    {doc.notes && <div style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>{doc.notes}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <CompBadge status={doc.computed_status} />
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

// ── MAIN DASHBOARD ────────────────────────────────────────────────────
export default function OperatorDashboard() {
  const [tab, setTab] = useState('property-profile')

  async function handleLogout() {
    await supabase.auth.signOut()
  }

  const tabs = [
    { key: 'property-profile', label: 'Property Profile' },
    { key: 'vendor-directory', label: 'Vendor Directory' },
    { key: 'issues', label: 'Issues' },
    { key: 'inventory', label: 'Inventory' },
    { key: 'compliance', label: 'Compliance' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#f7f7f7' }}>
      <div className="page-header" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: '-0.5px' }}>OpsLoom</span>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {tabs.map(t => <NavTab key={t.key} label={t.label} active={tab === t.key} onClick={() => setTab(t.key)} />)}
          </div>
        </div>
        <button className="btn-secondary" onClick={handleLogout} style={{ padding: '8px 16px' }}>Sign out</button>
      </div>
      <div className="page-body">
        {tab === 'property-profile'  && <PropertyProfileTab />}
        {tab === 'vendor-directory'  && <VendorDirectoryTab />}
        {tab === 'issues'            && <IssuesTab />}
        {tab === 'inventory'         && <InventoryTab />}
        {tab === 'compliance'        && <ComplianceTab />}
      </div>
    </div>
  )
}
