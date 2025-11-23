
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db } from '../services/mockBackend';
import { UserRole } from '../types';
import { Loader2 } from 'lucide-react';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [imgError, setImgError] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const user = await db.users.find(email);
      
      if (user && user.passwordHash === password) {
        // Store basic simulated session
        localStorage.setItem('tonapista_auth', JSON.stringify(user));
        if (user.role === UserRole.ADMIN || user.role === UserRole.GESTOR) {
          navigate('/dashboard');
        } else {
          setError('Acesso não autorizado para este perfil.');
        }
      } else {
        setError('E-mail ou senha inválidos.');
      }
    } catch (err) {
      console.error(err);
      setError('Erro ao conectar com o servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neon-bg relative overflow-hidden p-4">
      {/* Background Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-96 h-96 bg-neon-orange/20 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-96 h-96 bg-neon-blue/20 rounded-full blur-3xl"></div>

      <div className="w-full max-w-md p-8 bg-slate-900/80 backdrop-blur-md border border-slate-700 rounded-2xl shadow-2xl z-10">
        <div className="text-center mb-8 flex flex-col items-center min-h-[120px] justify-center">
          {!imgError ? (
             <img 
               src="/logo.png" 
               alt="Tô Na Pista" 
               className="h-32 w-auto mb-4 object-contain drop-shadow-[0_0_15px_rgba(249,115,22,0.5)]" 
               onError={() => setImgError(true)}
             />
           ) : (
             <div className="mb-6">
               <h1 className="text-4xl font-bold text-neon-orange font-sans tracking-tighter">TÔ NA PISTA</h1>
             </div>
           )}
          <p className="text-slate-400 text-sm">Sistema de Gestão e Reservas</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">E-mail</label>
            <input
              type="email"
              required
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-neon-orange focus:ring-1 focus:ring-neon-orange transition"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Senha</label>
            <input
              type="password"
              required
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-neon-orange focus:ring-1 focus:ring-neon-orange transition"
              placeholder="••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/50 text-red-400 text-sm rounded-lg text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-neon-orange to-neon-blue text-white font-bold py-3 rounded-lg shadow-lg hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] transition-all duration-300 transform hover:-translate-y-1 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="animate-spin" /> : 'ENTRAR'}
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <Link to="/agendamento" className="text-sm text-neon-blue hover:underline">
            Ir para Agendamento Público &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
