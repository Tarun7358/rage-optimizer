import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useSearchParams, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Servers from './pages/Servers';
import Dashboard from './pages/Dashboard';
import WelcomeDash from './pages/WelcomeDash';
import ModDash from './pages/ModDash';
import TicketDash from './pages/TicketDash';
import SecurityDash from './pages/SecurityDash';
import NotificationDash from './pages/NotificationDash';
import AdminPanel from './pages/AdminPanel';

// Protected Route wrapper component
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/" replace />;
  return children;
}

// OAuth2 Callback handler component
function AuthCallback() {
  const [searchParams] = useSearchParams();
  const { exchangeCode } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      exchangeCode(code)
        .then(() => {
          navigate('/servers');
        })
        .catch((err) => {
          console.error(err);
          navigate('/');
        });
    } else {
      navigate('/');
    }
  }, [searchParams, exchangeCode, navigate]);

  return (
    <div className="min-h-screen bg-[#08080c] flex items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <div className="w-12 h-12 border-t-2 border-accentRed rounded-full animate-spin"></div>
        <span className="text-textGray text-sm font-semibold tracking-wider">Verifying Discord Session...</span>
      </div>
    </div>
  );
}

function MainAppLayout() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        
        {/* Protected Dashboard pages */}
        <Route path="/servers" element={
          <ProtectedRoute>
            <Servers />
          </ProtectedRoute>
        } />
        <Route path="/dashboard/:guildId" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/welcome/:guildId" element={
          <ProtectedRoute>
            <WelcomeDash />
          </ProtectedRoute>
        } />
        <Route path="/moderation/:guildId" element={
          <ProtectedRoute>
            <ModDash />
          </ProtectedRoute>
        } />
        <Route path="/tickets/:guildId" element={
          <ProtectedRoute>
            <TicketDash />
          </ProtectedRoute>
        } />
        <Route path="/security/:guildId" element={
          <ProtectedRoute>
            <SecurityDash />
          </ProtectedRoute>
        } />
        <Route path="/notifications/:guildId" element={
          <ProtectedRoute>
            <NotificationDash />
          </ProtectedRoute>
        } />
        <Route path="/admin" element={
          <ProtectedRoute>
            <AdminPanel />
          </ProtectedRoute>
        } />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <MainAppLayout />
      </AuthProvider>
    </BrowserRouter>
  );
}
