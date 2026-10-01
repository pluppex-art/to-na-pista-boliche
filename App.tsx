
import React, { useEffect, Suspense, lazy } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './contexts/AppContext'; 
import Layout from './components/Layout';
const Login = lazy(() => import('./pages/Login'));
const PublicBooking = lazy(() => import('./pages/PublicBooking'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Agenda = lazy(() => import('./pages/Agenda'));
const CRM = lazy(() => import('./pages/CRM/CRM'));
const Settings = lazy(() => import('./pages/Settings'));
const Financeiro = lazy(() => import('./pages/Financeiro'));
const ClientDashboard = lazy(() => import('./pages/ClientDashboard'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Home = lazy(() => import('./pages/Home'));
const LP = lazy(() => import('./pages/LP'));
import { UserRole, User } from './types';
import { Analytics } from './services/analytics';

declare global {
  interface Window {
    fbq: any;
  }
}

const PixelTracker: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    // Meta Pixel
    if (window.fbq) {
      window.fbq('track', 'PageView');
    }
    
    // Rastreamento Interno Supabase
    const path = location.pathname === '/' ? 'home' : location.pathname.replace('/', '');
    Analytics.trackEvent(`visit_${path || 'home'}`);
    
    console.log(`%c[Analytics] Tracking PageView: ${location.pathname}`, 'color: #10b981; font-weight: bold;');
  }, [location]);

  return null;
};

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requiredPermission?: keyof User; 
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles, requiredPermission }) => {
  const { user, loading } = useApp();
  
  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500">Carregando...</div>; 

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/agenda" replace />; 
  }

  if (requiredPermission && user.role !== UserRole.ADMIN) {
     const hasPermission = user[requiredPermission];
     if (hasPermission !== true) {
         return <Navigate to="/agenda" replace />; 
     }
  }

  return <>{children}</>;
};

const AppContent: React.FC = () => {
    const { settings } = useApp();

    useEffect(() => {
        const link = (document.querySelector("link[rel*='icon']") || document.createElement('link')) as HTMLLinkElement;
        link.type = 'image/x-icon';
        link.rel = 'shortcut icon';
        link.href = settings.logoUrl || '/logo.png'; 
        document.getElementsByTagName('head')[0].appendChild(link);
    }, [settings.logoUrl]);

    return (
        <Router>
            <PixelTracker />
            <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-500">Carregando...</div>}>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/lp" element={<LP />} />
                <Route path="/login" element={<Login />} />
                <Route path="/agendamento" element={<PublicBooking />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/minha-conta" element={<ClientDashboard />} />
                
                <Route path="/agenda" element={
                    <ProtectedRoute requiredPermission="perm_view_agenda">
                        <Layout><Agenda /></Layout>
                    </ProtectedRoute>
                } />
                
                <Route path="/financeiro" element={
                    <ProtectedRoute requiredPermission="perm_view_financial">
                        <Layout><Financeiro /></Layout>
                    </ProtectedRoute>
                } />
                
                <Route path="/clientes" element={
                    <ProtectedRoute requiredPermission="perm_view_crm">
                        <Layout><CRM /></Layout>
                    </ProtectedRoute>
                } />
                
                <Route path="/configuracoes" element={
                    <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
                        <Layout><Settings /></Layout>
                    </ProtectedRoute>
                } />
            </Routes>
            </Suspense>
        </Router>
    );
};

const App: React.FC = () => {
  return (
    <AppProvider>
        <AppContent />
    </AppProvider>
  );
};

export default App;
