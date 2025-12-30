
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { UserRole, User } from '../types';
import { db } from '../services/mockBackend';
import { useApp } from '../contexts/AppContext';
import { 
  CalendarDays, 
  Users, 
  Settings, 
  Menu,
  X,
  LogOut,
  PieChart
} from 'lucide-react';

interface LayoutProps {
  children?: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { settings, user } = useApp(); // Agora usa o contexto global sincronizado
  
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [imgError, setImgError] = useState(false);

  const handleLogout = async () => {
    localStorage.removeItem('tonapista_auth');
    await db.users.logout();
    navigate('/login', { replace: true });
  };

  const navItems = [
    { 
        path: '/agenda', 
        label: 'Dashboard', 
        icon: CalendarDays, 
        check: (u: User) => u.role === UserRole.ADMIN || u.perm_view_agenda 
    },
    { 
        path: '/financeiro', 
        label: 'Financeiro', 
        icon: PieChart, 
        check: (u: User) => u.role === UserRole.ADMIN || u.perm_view_financial 
    },
    { 
        path: '/clientes', 
        label: 'Clientes', 
        icon: Users, 
        check: (u: User) => u.role === UserRole.ADMIN || u.perm_view_crm 
    },
    { 
        path: '/configuracoes', 
        label: 'Config', 
        icon: Settings, 
        check: (u: User) => u.role === UserRole.ADMIN 
    },
  ];

  const allowedItems = navItems.filter(item => user && item.check(user));

  return (
    <div className="min-h-screen flex flex-col bg-neon-bg text-slate-100 font-sans">
      <header className="bg-neon-surface border-b border-slate-700 shadow-lg z-20 sticky top-0">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 md:h-20 items-center justify-between">
                
                <div className="flex items-center gap-4 lg:gap-8 flex-1">
                    <div className="md:hidden">
                        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-slate-200 p-2 rounded hover:bg-slate-800">
                            {isMobileMenuOpen ? <X /> : <Menu />}
                        </button>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                        {settings.logoUrl && !imgError ? (
                        <img 
                            src={settings.logoUrl} 
                            alt={settings.establishmentName}
                            className="h-8 md:h-10 lg:h-12 w-auto object-contain drop-shadow-[0_0_8px_rgba(249,115,22,0.3)]" 
                            onError={() => setImgError(true)}
                        />
                        ) : (
                        <div className="w-8 h-8 md:w-10 md:h-10 bg-neon-orange/20 rounded-full flex items-center justify-center border border-neon-orange/50">
                            <span className="text-neon-orange font-bold text-sm md:text-lg">TP</span>
                        </div>
                        )}
                        
                        <div className="flex flex-col">
                            <h1 className="text-sm md:text-lg lg:text-xl font-bold text-neon-orange font-sans tracking-tighter leading-none whitespace-nowrap">
                                {settings.establishmentName.toUpperCase()}
                            </h1>
                            <p className="text-[9px] text-slate-400 tracking-widest uppercase hidden lg:block">
                                Sistema de Gestão
                            </p>
                        </div>
                    </div>

                    <nav className="hidden md:flex items-center gap-1 ml-2 lg:ml-4 overflow-x-auto no-scrollbar">
                        {allowedItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center gap-1.5 lg:gap-2 px-3 py-1.5 lg:px-4 lg:py-2 rounded-lg text-[10px] lg:text-xs font-bold uppercase tracking-wide transition-all duration-200 border border-transparent whitespace-nowrap ${
                                isActive 
                                ? 'bg-slate-800 text-neon-orange border-slate-700 shadow-sm' 
                                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                            }`}
                            >
                            <item.icon size={14} className="lg:w-4 lg:h-4" />
                            <span>{item.label}</span>
                            </Link>
                        );
                        })}
                    </nav>
                </div>

                <div className="flex items-center gap-2 lg:gap-4 flex-shrink-0">
                    <div className="hidden lg:flex flex-col items-end mr-2">
                         {user && (
                            <>
                                <span className="text-xs text-white font-bold max-w-[100px] truncate">{user.name}</span>
                                <span className="text-[10px] text-slate-500 uppercase">{user.role}</span>
                            </>
                        )}
                    </div>
                    <button 
                        onClick={handleLogout}
                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                        title="Sair do Sistema"
                    >
                        <LogOut size={18} className="lg:w-5 lg:h-5" />
                    </button>
                </div>
            </div>
        </div>
      </header>

      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-neon-bg pt-20 p-4 animate-fade-in">
          <nav className="space-y-2">
             {allowedItems.map((item) => {
               const isActive = location.pathname === item.path;
               return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-4 rounded-lg border border-transparent ${
                    isActive 
                      ? 'bg-slate-800 text-neon-orange border-slate-700' 
                      : 'bg-slate-900/50 text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <item.icon size={20} />
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
             })}
             
             <button 
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full flex items-center gap-3 px-4 py-4 rounded-lg border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 mt-4"
              >
                <LogOut size={20} />
                <span className="font-medium">Sair do Sistema</span>
             </button>
          </nav>
        </div>
      )}

      <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto w-full max-w-[1600px] mx-auto">
        {children}
      </main>
    </div>
  );
};

export default Layout;
