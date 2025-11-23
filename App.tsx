
import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import PublicBooking from './pages/PublicBooking';
import Checkout from './pages/Checkout';
import Dashboard from './pages/Dashboard';
import Agenda from './pages/Agenda';
import CRM from './pages/CRM';
import Funnel from './pages/Funnel';
import Settings from './pages/Settings';
import Financeiro from './pages/Financeiro';
import { UserRole } from './types';

// Protected Route Wrapper
interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const stored = localStorage.getItem('tonapista_auth');
  
  if (!stored) {
    return <Navigate to="/login" replace />;
  }

  const user = JSON.parse(stored);
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />; // or an unauthorized page
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/agendamento" element={<PublicBooking />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/" element={<Navigate to="/agendamento" />} />

        {/* Protected Admin Routes */}
        <Route path="/dashboard" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.GESTOR]}><Layout><Dashboard /></Layout></ProtectedRoute>} />
        <Route path="/financeiro" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.GESTOR]}><Layout><Financeiro /></Layout></ProtectedRoute>} />
        <Route path="/agenda" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.GESTOR]}><Layout><Agenda /></Layout></ProtectedRoute>} />
        <Route path="/crm" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.GESTOR]}><Layout><CRM /></Layout></ProtectedRoute>} />
        <Route path="/funil" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN, UserRole.GESTOR]}><Layout><Funnel /></Layout></ProtectedRoute>} />
        <Route path="/configuracoes" element={<ProtectedRoute allowedRoles={[UserRole.ADMIN]}><Layout><Settings /></Layout></ProtectedRoute>} />
      </Routes>
    </Router>
  );
};

export default App;
