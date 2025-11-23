
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { UserRole, User } from '../types';
import { 
  LayoutDashboard, 
  CalendarDays, 
  Users, 
  Filter, 
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('tonapista_auth');
    if (stored) {
      setUser(JSON.parse(stored));
    }
  }, []);

  const isPublic = location.pathname === '/agendamento' || location.pathname === '/login' || location.pathname === '/';

  if (isPublic) {
    return <div className="min-h-screen bg-neon-bg">{children}</div>;
  }

  const handleLogout = () => {
    localStorage.removeItem('tonapista_auth');
    navigate('/login', { replace: true });
  };

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: [UserRole.ADMIN, UserRole.GESTOR] },
    { path: '/financeiro', label: 'Financeiro', icon: PieChart, roles: [UserRole.ADMIN, UserRole.GESTOR] },
    { path: '/agenda', label: 'Agenda', icon: CalendarDays, roles: [UserRole.ADMIN, UserRole.GESTOR] },
    { path: '/crm', label: 'CRM', icon: Users, roles: [UserRole.ADMIN, UserRole.GESTOR] },
    { path: '/funil', label: 'Funil', icon: Filter, roles: [UserRole.ADMIN, UserRole.GESTOR] },
    { path: '/configuracoes', label: 'Configurações', icon: Settings, roles: [UserRole.ADMIN] },
  ];

  // Filter items based on user role
  const allowedItems = navItems.filter(item => 
    !user || item.roles.includes(user.role)
  );

  return (
    <div className="min-h-screen flex flex-col bg-neon-bg text-slate-100 font-sans">
      {/* Header Area (Logo + Nav) */}
      <header className="bg-neon-surface border-b border-slate-700 shadow-lg z-20 relative">
        
        {/* Logo Section */}
        <div className="flex justify-between md:justify-center items-center py-4 md:py-6 px-4 border-b border-slate-700/50 bg-slate-900/30 relative">
           
           {/* Mobile Menu Button */}
           <div className="md:hidden">
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-slate-200 p-2 rounded hover:bg-slate-800">
                {isMobileMenuOpen ? <X /> : <Menu />}
              </button>
           </div>

           <div className="flex justify-center flex-1 md:flex-none">
             {!imgError ? (
               <img 
                 src="/logo.png" 
                 alt="Tô Na Pista" 
                 className="h-16 md:h-24 w-auto object-contain drop-shadow-[0_0_10px_rgba(249,115,22,0.3)]" 
                 onError={() => setImgError(true)}
               />
             ) : (
               <div className="text-center">
                 <h1 className="text-2xl md:text-3xl font-bold text-neon-orange font-sans tracking-tighter">TÔ NA PISTA</h1>
                 <p className="text-[10px] md:text-xs text-slate-400 tracking-widest uppercase">Bowling Club System</p>
               </div>
             )}
           </div>

           {/* Desktop Logout (Absolute Right) */}
           <div className="hidden md:block absolute right-8 top-1/2 transform -translate-y-1/2">
              <div className="flex items-center gap-4">
                  {user && (
                      <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">{user.name}</span>
                  )}
                  <button 
                    onClick={handleLogout}
                    className="flex items-center gap-2 text-slate-400 hover:text-red-400 transition font-medium text-sm bg-slate-800/50 px-3 py-2 rounded-lg hover:bg-slate-800"
                    title="Sair do Sistema"
                  >
                    <LogOut size={16} /> Sair
                  </button>
              </div>
           </div>

           {/* Mobile Logout (Placeholder for spacing) */}
           <div className="md:hidden w-10"></div>
        </div>

        {/* Desktop Navigation (Horizontal below logo) */}
        <div className="hidden md:flex justify-center items-center bg-slate-900/50">
          <nav className="flex items-center">
            {allowedItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-bold uppercase tracking-wide transition-all duration-200 border-b-2 ${
                    isActive 
                      ? 'text-neon-orange border-neon-orange bg-slate-800/50' 
                      : 'text-slate-400 border-transparent hover:text-slate-100 hover:bg-slate-800'
                  }`}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
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
             
             {/* Mobile Logout Button */}
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

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto w-full max-w-7xl mx-auto">
        {children}
      </main>
    </div>
  );
};

export default Layout;
