
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db } from '../services/mockBackend';
import { Loader2, Users, Briefcase, ChevronRight, Globe, Lock, Key, Mail, ArrowLeft } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { useApp } from '../contexts/AppContext';

const Login: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'CLIENT' | 'STAFF'>('CLIENT');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(''); 
  const [phone, setPhone] = useState(''); 
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [imgError, setImgError] = useState(false);
  
  const [logoUrl, setLogoUrl] = useState('');
  const [establishmentName, setEstablishmentName] = useState('TÔ NA PISTA');

  const navigate = useNavigate();
  const { refreshUser } = useApp(); 

  useEffect(() => {
    const fetchSettings = async () => {
        try {
            const s = await db.settings.get();
            if (s.logoUrl) setLogoUrl(s.logoUrl);
            if (s.establishmentName) setEstablishmentName(s.establishmentName);
        } catch (e) {
            console.error("Erro ao carregar configurações:", e);
        }
    };
    fetchSettings();
  }, []);

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const { user, error: loginError } = await db.users.login(email, password);
      
      if (loginError || !user) {
        setError(loginError || 'E-mail ou senha inválidos.');
        setIsLoading(false);
        return;
      }

      localStorage.setItem('tonapista_auth', JSON.stringify(user));
      refreshUser();
      navigate('/agenda', { replace: true });
    } catch (err) {
      setError('Erro ao processar login.');
      setIsLoading(false);
    }
  };

  const handleClientLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setIsLoading(true);

      try {
          const { client, error: loginError } = await db.clients.login(email, password);
          if (loginError || !client) {
              setError(loginError || 'E-mail ou senha inválidos.');
              setIsLoading(false);
          } else {
              localStorage.setItem('tonapista_client_auth', JSON.stringify(client));
              navigate('/minha-conta', { replace: true });
          }
      } catch (err) {
          setError('Erro ao conectar.');
          setIsLoading(false);
      }
  };

  const handleClientRegister = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setIsLoading(true);

      try {
          const newClient = {
              id: uuidv4(),
              name: name,
              email: email,
              phone: phone,
              tags: [],
              createdAt: new Date().toISOString(),
              lastContactAt: new Date().toISOString()
          };

          const { client, error: regError } = await db.clients.register(newClient, password);
          if (regError) {
              setError(regError);
              setIsLoading(false);
          } else if (client) {
              localStorage.setItem('tonapista_client_auth', JSON.stringify(client));
              navigate('/minha-conta', { replace: true });
          }
      } catch (err) {
          setError('Erro ao registrar.');
          setIsLoading(false);
      }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setSuccess('');
      setIsLoading(true);
      try {
          const { success: resetSuccess, error: resetError } = await db.clients.forgotPassword(email);
          if (resetError) {
              setError(resetError);
          } else {
              setSuccess('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
          }
      } catch (e) {
          setError('Erro ao solicitar recuperação.');
      } finally {
          setIsLoading(false);
      }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neon-bg relative overflow-hidden p-4">
      <div className="absolute top-[-20%] left-[-10%] w-96 h-96 bg-neon-orange/20 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-96 h-96 bg-neon-blue/20 rounded-full blur-3xl"></div>

      <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-md border border-slate-700 rounded-2xl shadow-2xl z-10 overflow-hidden">
        <div className="text-center p-8 pb-4 flex flex-col items-center">
          {!imgError ? (
             <img src={logoUrl || "/logo.png"} alt={establishmentName} className="h-20 w-auto mb-2 object-contain drop-shadow-[0_0_15px_rgba(249,115,22,0.5)]" onError={() => setImgError(true)} />
           ) : (
             <h1 className="text-2xl font-bold text-neon-orange font-sans tracking-tighter uppercase mb-2">{establishmentName}</h1>
           )}
        </div>

        {!isForgotPassword && (
            <div className="flex border-b border-slate-700">
                <button onClick={() => { setActiveTab('CLIENT'); setIsRegistering(false); setError(''); }} className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition ${activeTab === 'CLIENT' ? 'text-white border-b-2 border-neon-blue bg-slate-800/50' : 'text-slate-500 hover:text-white hover:bg-slate-800/30'}`}><Users size={18}/> Sou Cliente</button>
                <button onClick={() => { setActiveTab('STAFF'); setError(''); }} className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition ${activeTab === 'STAFF' ? 'text-white border-b-2 border-neon-orange bg-slate-800/50' : 'text-slate-500 hover:text-white hover:bg-slate-800/30'}`}><Briefcase size={18}/> Sou Equipe</button>
            </div>
        )}

        <div className="p-8 pt-6">
            {isForgotPassword ? (
                <form onSubmit={handleForgotPassword} className="space-y-5 animate-fade-in">
                    <button onClick={() => setIsForgotPassword(false)} className="text-slate-400 hover:text-white flex items-center gap-2 text-sm mb-4">
                        <ArrowLeft size={16}/> Voltar ao login
                    </button>
                    <div className="text-center mb-6">
                        <div className="w-16 h-16 bg-neon-blue/20 rounded-full flex items-center justify-center mx-auto mb-4 text-neon-blue border border-neon-blue/30">
                            <Mail size={32}/>
                        </div>
                        <h2 className="text-xl font-bold text-white">Recuperar Senha</h2>
                        <p className="text-slate-400 text-sm mt-2">Enviaremos um link de segurança para o seu e-mail cadastrado.</p>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">E-mail da Conta</label>
                        <input type="email" required className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-neon-blue transition" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    {error && <div className="p-3 bg-red-500/10 border border-red-500/50 text-red-400 text-sm rounded-lg text-center">{error}</div>}
                    {success && <div className="p-3 bg-green-500/10 border border-green-500/50 text-green-400 text-sm rounded-lg text-center">{success}</div>}
                    <button type="submit" disabled={isLoading || !!success} className="w-full bg-neon-blue hover:bg-blue-600 text-white font-bold py-3 rounded-lg shadow-lg transition flex items-center justify-center gap-2">
                        {isLoading ? <Loader2 className="animate-spin" /> : 'Enviar E-mail de Recuperação'}
                    </button>
                </form>
            ) : activeTab === 'STAFF' ? (
                <form onSubmit={handleStaffLogin} className="space-y-5 animate-fade-in">
                    <div><label className="block text-xs font-bold text-slate-400 mb-1 uppercase">E-mail Corporativo</label><input type="email" required className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-neon-orange transition" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                    <div><label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Senha</label><input type="password" required className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-neon-orange transition" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                    {error && <div className="p-3 bg-red-500/10 border border-red-500/50 text-red-400 text-sm rounded-lg text-center">{error}</div>}
                    <button type="submit" disabled={isLoading} className="w-full bg-neon-orange hover:bg-orange-600 text-white font-bold py-3 rounded-lg shadow-lg transition flex items-center justify-center gap-2">{isLoading ? <Loader2 className="animate-spin" /> : 'Acessar Sistema'}</button>
                </form>
            ) : (
                <div className="animate-fade-in">
                    {!isRegistering ? (
                        <form onSubmit={handleClientLogin} className="space-y-5">
                            <div><label className="block text-xs font-bold text-slate-400 mb-1 uppercase">E-mail</label><input type="email" required className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white focus:border-neon-blue outline-none" value={email} onChange={e => setEmail(e.target.value)} /></div>
                            <div>
                                <div className="flex justify-between mb-1">
                                    <label className="block text-xs font-bold text-slate-400 uppercase">Senha</label>
                                    <button type="button" onClick={() => setIsForgotPassword(true)} className="text-[10px] text-neon-blue hover:underline">Esqueceu a senha?</button>
                                </div>
                                <input type="password" required className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white focus:border-neon-blue outline-none" value={password} onChange={e => setPassword(e.target.value)} />
                            </div>
                            {error && <div className="p-3 bg-red-500/10 border border-red-500/50 text-red-400 text-sm rounded-lg text-center">{error}</div>}
                            <button type="submit" disabled={isLoading} className="w-full bg-neon-blue hover:bg-blue-600 text-white font-bold py-3 rounded-lg shadow-lg transition flex items-center justify-center gap-2">{isLoading ? <Loader2 className="animate-spin"/> : 'Entrar'}</button>
                            <div className="text-center mt-4 text-sm text-slate-400">Não tem conta? <button type="button" onClick={() => setIsRegistering(true)} className="text-neon-blue font-bold hover:underline">Cadastre-se</button></div>
                        </form>
                    ) : (
                        <form onSubmit={handleClientRegister} className="space-y-4">
                            <h3 className="text-lg font-bold text-white mb-2">Criar nova conta</h3>
                            <div><label className="block text-xs font-bold text-slate-400 mb-1">Nome Completo</label><input type="text" required className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-neon-blue outline-none" value={name} onChange={e => setName(e.target.value)} /></div>
                            <div><label className="block text-xs font-bold text-slate-400 mb-1">WhatsApp</label><input type="tel" required className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-neon-blue outline-none" value={phone} onChange={e => setPhone(e.target.value)} /></div>
                            <div><label className="block text-xs font-bold text-slate-400 mb-1">E-mail</label><input type="email" required className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-neon-blue outline-none" value={email} onChange={e => setEmail(e.target.value)} /></div>
                            <div><label className="block text-xs font-bold text-slate-400 mb-1">Senha</label><input type="password" required className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white focus:border-neon-blue outline-none" value={password} onChange={e => setPassword(e.target.value)} /></div>
                            {error && <div className="p-3 bg-red-500/10 border border-red-500/50 text-red-400 text-sm rounded-lg text-center">{error}</div>}
                            <button type="submit" disabled={isLoading} className="w-full bg-neon-green hover:bg-green-600 text-white font-bold py-3 rounded-lg shadow-lg transition flex items-center justify-center gap-2">{isLoading ? <Loader2 className="animate-spin"/> : 'Criar Conta'}</button>
                            <div className="text-center mt-2 text-sm text-slate-400">Já tem conta? <button type="button" onClick={() => setIsRegistering(false)} className="text-neon-blue font-bold hover:underline">Fazer Login</button></div>
                        </form>
                    )}
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default Login;
