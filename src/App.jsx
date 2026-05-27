import { Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import OperatorDashboard from './pages/operator/Dashboard'
import CleanerDashboard from './pages/cleaner/Dashboard'
import VendorDashboard from './pages/vendor/Dashboard'

export default function App() {
  const [session, setSession] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        setRole(session.user.user_metadata?.role || 'operator')
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        setRole(session.user.user_metadata?.role || 'operator')
      } else {
        setRole(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>OpsLoom</div>
          <div style={{ fontSize: 14, color: '#aaa' }}>Loading...</div>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/vendor-link/:token" element={<VendorDashboard publicMode />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      {role === 'operator' && (
        <>
          <Route path="/operator/*" element={<OperatorDashboard />} />
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
    </Routes>
  )
}
