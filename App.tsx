
import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './contexts/AppContext'; 
import Layout from './components/Layout';
import Login from './pages/Login';
import PublicBooking from './pages/PublicBooking';
import Checkout from './pages/Checkout';
import Agenda from './pages/Agenda';
import CRM from './pages/CRM';
import Settings from './pages/Settings';
import Financeiro from './pages/Financeiro';
import ClientDashboard from './pages/ClientDashboard';
import ResetPassword from './pages/ResetPassword';
import { UserRole, User } from './types';

// Declaração global para o TS reconhecer o fbq do Facebook
declare global {
  interface Window {
    fbq: any;
  }
}

// Componente que observa a mudança de URL e dispara o PageView
const PixelTracker: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    if (window.fbq) {
      window.fbq('track', 'PageView');
      console.log(`[Meta Pixel] PageView disparado para: ${location.pathname}`);
    }
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
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/agendamento" element={<PublicBooking />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/redefinir-senha" element={<ResetPassword />} />
                <Route path="/" element={<Navigate to="/agendamento" />} />
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
