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

function computeDocStatus(doc) {
  const days = doc.expiry_date ? Math.ceil((new Date(doc.expiry_date) - new Date()) / 86400000) : null
  if (days === null) return 'Missing'
  if (days < 0) return 'Expired'
  if (days <= 30) return 'Due Soon'
  return 'Valid'
}

function calculateReadiness(issues, restockItems, compDocs, jobs) {
  const openIssues = issues.filter(i => i.status !== 'Closed' && i.status !== 'Fixed')
  const criticalOpen = openIssues.some(i => i.severity === 'Critical')
  const expiredDocs = compDocs.some(d => computeDocStatus(d) === 'Expired')
  const needsRestock = restockItems.some(r => r.needs_restock)
  const dueSoonDocs = compDocs.some(d => computeDocStatus(d) === 'Due Soon')
  const highOpen = openIssues.some(i => i.severity === 'High')
  const lastJob = jobs[0]
  const cleaningIncomplete = lastJob && lastJob.status !== 'Complete'

  if (criticalOpen || expiredDocs) return 'Not Ready'
  if (needsRestock || dueSoonDocs || highOpen || cleaningIncomplete) return 'At Risk'
  return 'Ready'
}

// ── PROPERTY PROFILE ─────────────────────────────────────────────────
function PropertyProfileTab() {
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [detailData, setDetailData] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [showCompForm, setShowCompForm] = useState(false)
  const [compForm, setCompForm] = useState({ document_type: '', issue_date: '', expiry_date: '' })
  const [savingComp, setSavingComp] = useState(false)

  const docTypes = ['Gas Safety Record (CP12)', 'EICR', 'EPC', 'Public Liability Insurance', 'Fire Risk Assessment']

  useEffect(() => {
    supabase.from('Properties').select('*').then(({ data }) => {
      setProperties(data || [])
      setLoading(false)
    })
  }, [])

  async function openProperty(p) {
    setSelected(p)
    setDetailLoading(true)
    const [issRes, restRes, compRes, jobRes] = await Promise.all([
      supabase.from('issues').select('*').eq('property_id', p.id),
      supabase.from('restock').select('*').eq('property_id', p.id),
      supabase.from('compliance_documents').select('*').eq('property_id', p.id),
      supabase.from('jobs').select('*').eq('property_id', p.id).order('created_at', { ascending: false }).limit(5),
    ])
    const issues = issRes.data || []
    const restock = restRes.data || []
    const comp = compRes.data || []
    const jobs = jobRes.data || []
    const calculatedStatus = calculateReadiness(issues, restock, comp, jobs)
    setDetailData({ issues, restock, comp, jobs, calculatedStatus })
    setDetailLoading(false)
  }

  async function saveCompDocument() {
    setSavingComp(true)
    await supabase.from('compliance_documents').insert({
      document_type: compForm.document_type,
      property_id: selected.id,
      issue_date: compForm.issue_date || null,
      expiry_date: compForm.expiry_date || null,
    })
    const { data } = await supabase.from('compliance_documents').select('*').eq('property_id', selected.id)
    setDetailData(prev => ({ ...prev, comp: data || [] }))
    setCompForm({ document_type: '', issue_date: '', expiry_date: '' })
    setShowCompForm(false)
    setSavingComp(false)
  }

  const filtered = properties.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.address?.toLowerCase().includes(search.toLowerCase())
  )

  if (selected) {
    if (detailLoading) return (
      <div>
        <button onClick={() => setSelected(null)} style={{
          background: 'none', border: '1px solid #e0e0e0', borderRadius: 8,
          padding: '8px 16px', fontSize: 13, cursor: 'pointer', marginBottom: 16, color: '#555'
        }}>← Back to properties</button>
        <div className="empty-state">Loading property details...</div>
      </div>
    )

    const { issues, restock, comp, jobs, calculatedStatus } = detailData
    const openIssues = issues.filter(i => i.status !== 'Closed' && i.status !== 'Fixed')
    const lastIssue = openIssues[0]
    const needsRestock = restock.filter(r => r.needs_restock)
    const lastJob = jobs[0]
    const enrichedComp = comp.map(d => ({ ...d, computed_status: computeDocStatus(d) }))
    const expiredDocs = enrichedComp.filter(d => d.computed_status === 'Expired')
    const dueSoonDocs = enrichedComp.filter(d => d.computed_status === 'Due Soon')
    const validDocs = enrichedComp.filter(d => d.computed_status === 'Valid')

    return (
      <div>
        <button onClick={() => { setSelected(null); setDetailData(null); setShowCompForm(false) }} style={{
          background: 'none', border: '1px solid #e0e0e0', borderRadius: 8,
          padding: '8px 16px', fontSize: 13, cursor: 'pointer', marginBottom: 16, color: '#555'
        }}>← Back to properties</button>

        {/* Property header */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 4 }}>{selected.name}</div>
              <div style={{ fontSize: 14, color: '#888', marginBottom: 8 }}>{selected.address}</div>
              <div style={{ fontSize: 13, color: '#aaa' }}>{selected.bedroom} bedroom{selected.bedroom !== 1 ? 's' : ''} · Next check-in: {selected.next_checkin ? new Date(selected.next_checkin).toLocaleDateString('en-GB') : 'Not set'}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              <StatusBadge status={calculatedStatus} />
              <span style={{ fontSize: 11, color: '#aaa' }}>Auto-calculated</span>
            </div>
          </div>
        </div>

        {/* Readiness breakdown */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 12 }}>Readiness Breakdown</div>
          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
              <span style={{ fontSize: 13 }}>Cleaning</span>
              <span className={`badge ${!lastJob ? 'badge-notready' : lastJob.status === 'Complete' ? 'badge-ready' : 'badge-atrisk'}`}>
                {!lastJob ? 'No job recorded' : lastJob.status}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
              <span style={{ fontSize: 13 }}>Open issues</span>
              <span className={`badge ${openIssues.some(i => i.severity === 'Critical') ? 'badge-notready' : openIssues.some(i => i.severity === 'High') ? 'badge-atrisk' : openIssues.length > 0 ? 'badge-duesoon' : 'badge-ready'}`}>
                {openIssues.length > 0 ? `${openIssues.length} open` : 'All clear'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
              <span style={{ fontSize: 13 }}>Inventory</span>
              <span className={`badge ${needsRestock.length > 0 ? 'badge-atrisk' : 'badge-ready'}`}>
                {needsRestock.length > 0 ? `${needsRestock.length} need restock` : 'All stocked'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
              <span style={{ fontSize: 13 }}>Compliance</span>
              <span className={`badge ${expiredDocs.length > 0 ? 'badge-notready' : dueSoonDocs.length > 0 ? 'badge-atrisk' : 'badge-ready'}`}>
                {expiredDocs.length > 0 ? `${expiredDocs.length} expired` : dueSoonDocs.length > 0 ? `${dueSoonDocs.length} due soon` : 'All valid'}
              </span>
            </div>
          </div>
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

        {/* Last job */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Last Cleaning Job</div>
          {lastJob ? (
            <div>
              <div style={{ fontSize: 13, color: '#888', marginBottom: 6 }}>Date: {new Date(lastJob.job_date).toLocaleDateString('en-GB')}</div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span className={`badge ${lastJob.status === 'Complete' ? 'badge-ready' : lastJob.status === 'In progress' ? 'badge-atrisk' : 'badge-notready'}`}>{lastJob.status}</span>
                <span style={{ fontSize: 13, color: '#888' }}>{lastJob.readiness_percent || 0}% complete · {lastJob.completed_tasks || 0}/{lastJob.total_tasks || 0} tasks</span>
              </div>
            </div>
          ) : <div style={{ fontSize: 13, color: '#aaa' }}>No cleaning jobs recorded yet.</div>}
        </div>

        {/* Open issues */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Open Issues ({openIssues.length})</div>
          {openIssues.length === 0 && <div style={{ fontSize: 13, color: '#16a34a' }}>No open issues.</div>}
          {openIssues.map(issue => (
            <div key={issue.id} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <SeverityBadge s={issue.severity} />
                <span style={{ fontSize: 13, fontWeight: 500 }}>{issue.category}</span>
              </div>
              <div style={{ fontSize: 13, color: '#555' }}>{issue.description}</div>
            </div>
          ))}
        </div>

        {/* Inventory */}
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Inventory</div>
          {restock.length === 0 && <div style={{ fontSize: 13, color: '#aaa' }}>No inventory items set up.</div>}
          {restock.map(item => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
              <span style={{ fontSize: 13 }}>{item.item_name}</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: item.needs_restock ? '#dc2626' : '#16a34a' }}>{item.current_quantity}/{item.minimum_quantity}</span>
                <span className={`badge ${item.needs_restock ? 'badge-notready' : 'badge-ready'}`}>{item.needs_restock ? 'Restock' : 'OK'}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Compliance documents for this property */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 600 }}>Compliance Documents ({enrichedComp.length})</div>
            <button onClick={() => setShowCompForm(!showCompForm)} style={{
              background: '#0a0a0a', color: '#fff', border: 'none', borderRadius: 8,
              padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 500
            }}>{showCompForm ? 'Cancel' : '+ Add document'}</button>
          </div>

          {showCompForm && (
            <div style={{ background: '#f7f7f7', borderRadius: 8, padding: 14, marginBottom: 14 }}>
              <div className="form-group">
                <label className="label">Document type</label>
                <select className="input-field" value={compForm.document_type} onChange={e => setCompForm({ ...compForm, document_type: e.target.value })}>
                  <option value="">Select document</option>
                  {docTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="label">Issue date</label>
                <input className="input-field" type="date" value={compForm.issue_date} onChange={e => setCompForm({ ...compForm, issue_date: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="label">Expiry date</label>
                <input className="input-field" type="date" value={compForm.expiry_date} onChange={e => setCompForm({ ...compForm, expiry_date: e.target.value })} />
              </div>
              <button className="btn-primary" onClick={saveCompDocument} disabled={savingComp || !compForm.document_type}>
                {savingComp ? 'Saving...' : 'Save document'}
              </button>
            </div>
          )}

          {enrichedComp.length === 0 && <div style={{ fontSize: 13, color: '#aaa' }}>No compliance documents for this property yet.</div>}

          {['Expired', 'Due Soon', 'Valid'].map(status => {
            const docs = enrichedComp.filter(d => d.computed_status === status)
            if (!docs.length) return null
            return (
              <div key={status} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <CompBadge status={status} />
                  <span style={{ fontSize: 12, color: '#888' }}>{docs.length} document{docs.length !== 1 ? 's' : ''}</span>
                </div>
                {docs.map(doc => (
                  <div key={doc.id} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{doc.document_type}</span>
                      <span style={{ fontSize: 12, color: '#888' }}>
                        {doc.expiry_date ? `Expires ${new Date(doc.expiry_date).toLocaleDateString('en-GB')}` : 'No date'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
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
          </div>
        ))}
      </div>
    </div>
  )
}

// ── VENDOR DIRECTORY ─────────────────────────────────────────────────
function VendorDirectoryTab() {
  const [vendors, setVendors] = useState([])
  const [cleaners, setCleaners] = useState([])
  const [agencies, setAgencies] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('vendors')
  const [selected, setSelected] = useState(null)
  const [selectedType, setSelectedType] = useState(null)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

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

  async function openVendor(v) {
    setSelected(v); setSelectedType('vendor'); setHistoryLoading(true)
    const { data } = await supabase.from('issues').select('*').eq('vendor_id', v.id).order('created_at', { ascending: false })
    setHistory(data || []); setHistoryLoading(false)
  }

  async function openCleaner(c) {
    setSelected(c); setSelectedType('cleaner'); setHistoryLoading(true)
    const { data } = await supabase.from('jobs').select('*').eq('cleaner_id', c.id).order('created_at', { ascending: false })
    setHistory(data || []); setHistoryLoading(false)
  }

  const tradeColors = { Plumber: '#dbeafe', Electrician: '#fef9c3', Handyman: '#dcfce7', Laundry: '#f3e8ff', Other: '#f3f4f6' }
  const tradeText   = { Plumber: '#1e40af', Electrician: '#854d0e', Handyman: '#166534', Laundry: '#6b21a8', Other: '#374151' }

  if (loading) return <div className="empty-state">Loading...</div>

  if (selected && selectedType === 'vendor') {
    return (
      <div>
        <button onClick={() => { setSelected(null); setSelectedType(null) }} style={{
          background: 'none', border: '1px solid #e0e0e0', borderRadius: 8,
          padding: '8px 16px', fontSize: 13, cursor: 'pointer', marginBottom: 16, color: '#555'
        }}>← Back to vendors</button>
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{selected.name}</div>
              <div style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>{selected.phone}</div>
              <div style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>{selected.email}</div>
              <div style={{ fontSize: 13, color: '#aaa' }}>{selected.agency_name && selected.agency_name !== 'No agency' ? `Agency: ${selected.agency_name}` : 'No agency'}</div>
            </div>
            <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
              background: tradeColors[selected.trade] || tradeColors.Other, color: tradeText[selected.trade] || tradeText.Other }}>{selected.trade}</span>
          </div>
        </div>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>Issue history ({history.length} total)</div>
        {historyLoading && <div className="empty-state">Loading...</div>}
        {!historyLoading && !history.length && <div className="empty-state">No issues assigned to this vendor yet.</div>}
        {!historyLoading && history.map(issue => (
          <div key={issue.id} className="card" style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontWeight: 600 }}>{issue.category}</div>
              <span className={`badge ${issue.status === 'Fixed' || issue.status === 'Closed' ? 'badge-ready' : 'badge-atrisk'}`}>{issue.status}</span>
            </div>
            <div style={{ fontSize: 13, color: '#555', marginBottom: 4 }}>{issue.description}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <SeverityBadge s={issue.severity} />
              <span style={{ fontSize: 12, color: '#aaa' }}>{new Date(issue.created_at).toLocaleDateString('en-GB')}</span>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (selected && selectedType === 'cleaner') {
    return (
      <div>
        <button onClick={() => { setSelected(null); setSelectedType(null) }} style={{
          background: 'none', border: '1px solid #e0e0e0', borderRadius: 8,
          padding: '8px 16px', fontSize: 13, cursor: 'pointer', marginBottom: 16, color: '#555'
        }}>← Back to cleaners</button>
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 4 }}>{selected.name}</div>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>{selected.phone}</div>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>{selected.email}</div>
          <div style={{ fontSize: 13, color: '#aaa' }}>{selected.agency_name && selected.agency_name !== 'No agency' ? `Agency: ${selected.agency_name}` : 'No agency'}</div>
        </div>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>Job history ({history.length} total)</div>
        {historyLoading && <div className="empty-state">Loading...</div>}
        {!historyLoading && !history.length && <div className="empty-state">No jobs assigned to this cleaner yet.</div>}
        {!historyLoading && history.map(job => (
          <div key={job.id} className="card" style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontWeight: 600 }}>Job — {new Date(job.job_date).toLocaleDateString('en-GB')}</div>
              <span className={`badge ${job.status === 'Complete' ? 'badge-ready' : job.status === 'In progress' ? 'badge-atrisk' : 'badge-notready'}`}>{job.status}</span>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <span style={{ fontSize: 13, color: '#888' }}>Readiness: <strong>{job.readiness_percent || 0}%</strong></span>
              <span style={{ fontSize: 13, color: '#888' }}>Tasks: {job.completed_tasks || 0}/{job.total_tasks || 0}</span>
            </div>
          </div>
        ))}
      </div>
    )
  }

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
            <div key={v.id} className="card" style={{ padding: '14px 16px', cursor: 'pointer' }} onClick={() => openVendor(v)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{v.name}</div>
                  <div style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>{v.phone}</div>
                  <div style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>{v.email}</div>
                  <div style={{ fontSize: 13, color: '#aaa' }}>{v.agency_name && v.agency_name !== 'No agency' ? `Agency: ${v.agency_name}` : 'No agency'}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                  <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                    background: tradeColors[v.trade] || tradeColors.Other, color: tradeText[v.trade] || tradeText.Other }}>{v.trade}</span>
                  <span style={{ fontSize: 12, color: '#aaa' }}>Tap to view history →</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'cleaners' && (
        <div style={{ display: 'grid', gap: 10 }}>
          {!cleaners.length && <div className="empty-state">No cleaners added yet.</div>}
          {cleaners.map(c => (
            <div key={c.id} className="card" style={{ padding: '14px 16px', cursor: 'pointer' }} onClick={() => openCleaner(c)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{c.name}</div>
                  <div style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>{c.phone}</div>
                  <div style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>{c.email}</div>
                  <div style={{ fontSize: 13, color: '#aaa' }}>{c.agency_name && c.agency_name !== 'No agency' ? `Agency: ${c.agency_name}` : 'No agency'}</div>
                </div>
                <span style={{ fontSize: 12, color: '#aaa' }}>Tap to view history →</span>
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

// ── ISSUES ───────────────────────────────────────────────────────────
function IssuesTab() {
  const [issues, setIssues] = useState([])
  const [vendors, setVendors] = useState([])
  const [cleaners, setCleaners] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [closeComment, setCloseComment] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [closedIssues, setClosedIssues] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

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
    return vendors.find(v => v.id === issue.vendor_id)?.name || cleaners.find(c => c.id === issue.vendor_id)?.name || null
  }

  async function loadHistory() {
    setHistoryLoading(true)
    const { data } = await supabase.from('issues').select('*').eq('status', 'Closed').order('created_at', { ascending: false })
    setClosedIssues(data || [])
    setHistoryLoading(false)
    setShowHistory(true)
  }

  async function assignIssue(issueId, assigneeId) {
    setAssigning(true)
    const status = assigneeId ? 'Assigned' : 'Open'
    await supabase.from('issues').update({ vendor_id: assigneeId || null, status }).eq('id', issueId)
    setIssues(issues.map(i => i.id === issueId ? { ...i, vendor_id: assigneeId || null, status } : i))
    if (selected?.id === issueId) setSelected(prev => ({ ...prev, vendor_id: assigneeId || null, status }))
    setAssigning(false)
  }

  async function closeIssue(issueId) {
    await supabase.from('issues').update({ status: 'Closed' }).eq('id', issueId)
    setIssues(issues.filter(i => i.id !== issueId))
    setSelected(null)
    setCloseComment('')
  }

  if (showHistory) {
    return (
      <div>
        <button onClick={() => setShowHistory(false)} style={{
          background: 'none', border: '1px solid #e0e0e0', borderRadius: 8,
          padding: '8px 16px', fontSize: 13, cursor: 'pointer', marginBottom: 16, color: '#555'
        }}>← Back to open issues</button>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>Closed issues history ({closedIssues.length} total)</div>
        {historyLoading && <div className="empty-state">Loading...</div>}
        {!historyLoading && !closedIssues.length && <div className="empty-state">No closed issues yet.</div>}
        {!historyLoading && closedIssues.map(issue => (
          <div key={issue.id} className="card" style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontWeight: 600 }}>{issue.category}</div>
              <span className="badge badge-ready">Closed</span>
            </div>
            <div style={{ fontSize: 13, color: '#555', marginBottom: 6 }}>{issue.description}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <SeverityBadge s={issue.severity} />
              <span style={{ fontSize: 12, color: '#aaa' }}>{new Date(issue.created_at).toLocaleDateString('en-GB')}</span>
            </div>
            {issue.issue_photo_url && <img src={issue.issue_photo_url} alt="Issue" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 8, marginTop: 8 }} />}
            {issue.fix_photo_url && <img src={issue.fix_photo_url} alt="Fix" style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 8, marginTop: 8 }} />}
          </div>
        ))}
      </div>
    )
  }

  if (selected) {
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
            <div style={{ fontSize: 14 }}>{selected.description}</div>
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
            <select className="input-field" value={selected.vendor_id || ''} onChange={e => assignIssue(selected.id, e.target.value)}>
              {allAssignees.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <button className="btn-primary" onClick={() => assignIssue(selected.id, selected.vendor_id)} disabled={assigning} style={{ marginBottom: 12 }}>
            {assigning ? 'Assigning...' : 'Confirm assignment'}
          </button>
          <div className="divider" />
          <div style={{ marginBottom: 12 }}>
            <label className="label">Close issue with comment</label>
            <textarea className="input-field" rows={3} placeholder="Add a closing comment..." value={closeComment} onChange={e => setCloseComment(e.target.value)} />
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

  const grouped = ['Critical', 'High', 'Medium', 'Low'].map(sev => ({
    severity: sev, items: issues.filter(i => i.severity === sev),
  })).filter(g => g.items.length > 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 14, color: '#888' }}>{issues.length} open issue{issues.length !== 1 ? 's' : ''}</div>
        <button onClick={loadHistory} style={{
          background: 'none', border: '1px solid #e0e0e0', borderRadius: 8,
          padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: '#555'
        }}>View closed history</button>
      </div>
      {!issues.length && <div className="empty-state">No open issues. All clear.</div>}
      <div style={{ display: 'grid', gap: 20 }}>
        {grouped.map(group => (
          <div key={group.severity}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <SeverityBadge s={group.severity} />
              <span style={{ fontSize: 13, color: '#888' }}>{group.items.length} issue{group.items.length !== 1 ? 's' : ''}</span>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {group.items.map(issue => (
                <div key={issue.id} className="card" style={{ cursor: 'pointer' }} onClick={() => setSelected(issue)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ fontWeight: 600 }}>{issue.category}</div>
                    <span className={`badge ${issue.status === 'Assigned' ? 'badge-valid' : issue.status === 'In progress' ? 'badge-atrisk' : 'badge-open'}`}>{issue.status || 'Not assigned'}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#555', marginBottom: 6 }}>{issue.description}</div>
                  <div style={{ fontSize: 12, color: '#888' }}>{getAssigneeName(issue) ? `Assigned to: ${getAssigneeName(issue)}` : 'Not assigned'}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── INVENTORY ────────────────────────────────────────────────────────
function InventoryTab() {
  const [items, setItems] = useState([])
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedPropertyId, setSelectedPropertyId] = useState('all')

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

  const filtered = selectedPropertyId === 'all'
    ? items
    : items.filter(item => String(item.property_id) === String(selectedPropertyId))

  const needsRestockCount = filtered.filter(i => i.needs_restock).length

  if (loading) return <div className="empty-state">Loading inventory...</div>

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <select className="input-field" style={{ maxWidth: 280, padding: '8px 12px' }}
          value={selectedPropertyId} onChange={e => setSelectedPropertyId(e.target.value)}>
          <option value="all">All properties</option>
          {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {needsRestockCount > 0 && <span className="badge badge-notready">{needsRestockCount} need restock</span>}
        {needsRestockCount === 0 && filtered.length > 0 && <span className="badge badge-ready">All stocked</span>}
      </div>
      {!filtered.length && <div className="empty-state">{selectedPropertyId === 'all' ? 'No inventory items added yet.' : 'No inventory items for this property.'}</div>}
      {filtered.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: '#f4f4f4' }}>
                {(selectedPropertyId === 'all' ? ['Property', 'Item', 'Min qty', 'Current qty', 'Status'] : ['Item', 'Min qty', 'Current qty', 'Status']).map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, fontSize: 13, color: '#444', borderBottom: '1px solid #e0e0e0' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, i) => (
                <tr key={item.id} style={{ background: item.needs_restock ? '#fff8f8' : i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  {selectedPropertyId === 'all' && (
                    <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0', color: '#555' }}>
                      {properties.find(p => String(p.id) === String(item.property_id))?.name || '—'}
                    </td>
                  )}
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0', fontWeight: 500 }}>{item.item_name}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0', color: '#888', textAlign: 'center' }}>{item.minimum_quantity}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0', color: item.needs_restock ? '#dc2626' : '#16a34a', fontWeight: 600, textAlign: 'center' }}>{item.current_quantity}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0' }}>
                    <span className={`badge ${item.needs_restock ? 'badge-notready' : 'badge-ready'}`}>{item.needs_restock ? 'Needs restock' : 'Enough'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── COMPLIANCE ───────────────────────────────────────────────────────
function ComplianceTab() {
  const [docs, setDocs] = useState([])
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ document_type: '', property_id: '', issue_date: '', expiry_date: '' })
  const [saving, setSaving] = useState(false)
  const docTypes = ['Gas Safety Record (CP12)', 'EICR', 'EPC', 'Public Liability Insurance', 'Fire Risk Assessment']

  async function loadDocs() {
    const { data } = await supabase.from('compliance_documents').select('*')
    setDocs((data || []).map(doc => ({ ...doc, computed_status: computeDocStatus(doc) })))
  }

  useEffect(() => {
    Promise.all([supabase.from('compliance_documents').select('*'), supabase.from('Properties').select('id, name')]).then(([d, p]) => {
      setDocs((d.data || []).map(doc => ({ ...doc, computed_status: computeDocStatus(doc) })))
      setProperties(p.data || [])
      setLoading(false)
    })
  }, [])

  async function saveDocument() {
    setSaving(true)
    await supabase.from('compliance_documents').insert({ document_type: form.document_type, property_id: form.property_id || null, issue_date: form.issue_date || null, expiry_date: form.expiry_date || null })
    await loadDocs()
    setForm({ document_type: '', property_id: '', issue_date: '', expiry_date: '' })
    setShowForm(false)
    setSaving(false)
  }

  if (loading) return <div className="empty-state">Loading compliance documents...</div>

  const grouped = ['Expired', 'Due Soon', 'Valid'].map(s => ({ status: s, items: docs.filter(d => d.computed_status === s) })).filter(g => g.items.length > 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 14, color: '#888' }}>{docs.length} document{docs.length !== 1 ? 's' : ''} total</div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary" style={{ width: 'auto', padding: '8px 16px' }}>{showForm ? 'Cancel' : '+ Add document'}</button>
      </div>
      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 16 }}>Add compliance document</div>
          <div className="form-group">
            <label className="label">Document type</label>
            <select className="input-field" value={form.document_type} onChange={e => setForm({ ...form, document_type: e.target.value })}>
              <option value="">Select document</option>
              {docTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label">Property</label>
            <select className="input-field" value={form.property_id} onChange={e => setForm({ ...form, property_id: e.target.value })}>
              <option value="">Select property</option>
              {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label">Issue date</label>
            <input className="input-field" type="date" value={form.issue_date} onChange={e => setForm({ ...form, issue_date: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="label">Expiry date</label>
            <input className="input-field" type="date" value={form.expiry_date} onChange={e => setForm({ ...form, expiry_date: e.target.value })} />
          </div>
          <button className="btn-primary" onClick={saveDocument} disabled={saving || !form.document_type}>{saving ? 'Saving...' : 'Save document'}</button>
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
                    <div style={{ fontSize: 13, color: '#888' }}>{properties.find(p => String(p.id) === String(doc.property_id))?.name || '—'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <CompBadge status={doc.computed_status} />
                    <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>{doc.expiry_date ? `Expires ${new Date(doc.expiry_date).toLocaleDateString('en-GB')}` : 'No date set'}</div>
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

// ── MAIN ─────────────────────────────────────────────────────────────
export default function OperatorDashboard({ onCreateJob }) {
  const [tab, setTab] = useState('property-profile')
  async function handleLogout() { await supabase.auth.signOut() }

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
        <div style={{ display: 'flex', gap: 8 }}><button className="btn-primary" onClick={onCreateJob} style={{ padding: '8px 16px', width: 'auto' }}>+ Create job</button><button className="btn-secondary" onClick={handleLogout} style={{ padding: '8px 16px' }}>Sign out</button></div>
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
