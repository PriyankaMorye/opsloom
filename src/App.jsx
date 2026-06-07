import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import OperatorDashboard from './pages/operator/Dashboard'
import CreateJob from './pages/operator/CreateJob'
import CleanerDashboard from './pages/cleaner/Dashboard'
import VendorDashboard from './pages/vendor/Dashboard'
import MagicLinkJob from './pages/cleaner/MagicLinkJob'

function OperatorApp() {
  const [view, setView] = useState('dashboard')

  return (
    <div>
      {view === 'dashboard' && (
        <OperatorDashboard onCreateJob={() => setView('create-job')} />
      )}
      {view === 'create-job' && (
        <div style={{ minHeight: '100vh', background: '#f7f7f7' }}>
          <div style={{ padding: '16px 24px', background: '#fff', borderBottom: '1px solid #f0f0f0',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700, fontSize: 18 }}>OpsLoom</span>
          </div>
          <div style={{ padding: 24, maxWidth: 600, margin: '0 auto' }}>
            <CreateJob onBack={() => setView('dashboard')} onCreated={() => setView('dashboard')} />
          </div>
        </div>
      )}
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) setRole(session.user.user_metadata?.role || 'operator')
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) setRole(session.user.user_metadata?.role || 'operator')
      else setRole(null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Public routes — always accessible, no login needed
  const path = window.location.pathname
  if (path.startsWith('/job/')) {
    return (
      <Routes>
        <Route path="/job/:token" element={<MagicLinkJob />} />
      </Routes>
    )
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>OpsLoom</div>
        <div style={{ fontSize: 14, color: '#aaa' }}>Loading...</div>
      </div>
    </div>
  )

  if (!session) return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/job/:token" element={<MagicLinkJob />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )

  return (
    <Routes>
      {role === 'operator' && (
        <>
          <Route path="/operator/*" element={<OperatorApp />} />
          <Route path="*" element={<Navigate to="/operator" replace />} />
        </>
      )}
      {role === 'cleaner' && (
        <>
          <Route path="/cleaner/*" element={<CleanerDashboard />} />
          <Route path="*" element={<Navigate to="/cleaner" replace />} />
        </>
      )}
      {role === 'vendor' && (
        <>
          <Route path="/vendor/*" element={<VendorDashboard />} />
          <Route path="*" element={<Navigate to="/vendor" replace />} />
        </>
      )}
      <Route path="/job/:token" element={<MagicLinkJob />} />
    </Routes>
  )
}
