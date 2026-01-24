
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/mockBackend';
import { Loader2, Lock, CheckCircle, ShieldCheck, ArrowRight, KeyRound, ArrowLeft, AlertTriangle, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSessionReady, setIsSessionReady] = useState(false);

  useEffect(() => {
      // 1. Verifica se há erro explícito na URL enviado pelo Supabase
      const fullUrl = window.location.href;
      if (fullUrl.includes('error=')) {
          const urlParams = new URLSearchParams(fullUrl.split('#').pop() || '');
          const errorDesc = urlParams.get('error_description');
          const errorCode = urlParams.get('error_code');
          
          if (errorCode === 'otp_expired' || fullUrl.includes('otp_expired')) {
              setUrlError('Este link de recuperação expirou (links duram pouco tempo). Por segurança, solicite um novo.');
          } else {
              setUrlError(errorDesc || 'Ocorreu um erro ao validar seu link.');
          }
          return;
      }

      // 2. Tenta forçar a detecção da sessão a partir do hash (importante para HashRouter)
      const checkSession = async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
              setIsSessionReady(true);
          }
      };
      checkSession();

      // 3. Escuta mudanças de autenticação (o evento PASSWORD_RECOVERY acontece quando clica no link)
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && fullUrl.includes('access_token'))) {
              setIsSessionReady(true);
          }
      });

      return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      
      if (password.length < 6) {
          setError('A senha deve ter pelo menos 6 caracteres.');
          return;
      }
      if (password !== confirmPassword) {
          setError('As senhas não coincidem.');
          return;
      }

      setIsLoading(true);
      try {
          // Garante que temos uma sessão ativa antes de tentar atualizar
          const { data: { session } } = await supabase.auth.getSession();
          
          if (!session) {
              setError('Sessão de segurança não detectada. Tente clicar no link do e-mail novamente ou peça um novo link.');
              setIsLoading(false);
              return;
          }

          const { success: updateSuccess, error: updateError } = await db.clients.updatePassword(password);
          
          if (updateError) {
              setError(updateError);
          } else {
              setSuccess(true);
              // Limpa a sessão após trocar a senha para forçar login novo
              await supabase.auth.signOut();
              setTimeout(() => navigate('/login'), 4000);
          }
      } catch (err) {
          setError('Erro técnico. Tente novamente mais tarde.');
      } finally {
          setIsLoading(false);
      }
  };

  // Lógica para cor do campo de confirmação
  const isConfirmError = confirmPassword !== '' && password !== confirmPassword;

  // TELA DE ERRO (LINK EXPIRADO)
  if (urlError) {
      return (
          <div className="min-h-screen bg-neon-bg flex items-center justify-center p-4">
              <div className="max-w-md w-full bg-slate-900 border border-red-500/50 p-10 rounded-[2.5rem] shadow-2xl text-center animate-scale-in">
                  <div className="w-20 h-20 bg-red-500/20 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-red-500/30">
                      <AlertTriangle size={40} />
                  </div>
                  <h2 className="text-2xl font-black text-white mb-4 uppercase tracking-tighter">Link Inválido</h2>
                  <p className="text-slate-400 mb-8 text-sm leading-relaxed">{urlError}</p>
                  <button onClick={() => navigate('/login')} className="w-full bg-white text-black font-black py-4 rounded-2xl flex items-center justify-center gap-2 uppercase text-xs tracking-widest active:scale-95 transition-all">
                      <RefreshCw size={16}/> Solicitar Novo Link
                  </button>
              </div>
          </div>
      );
  }

  // TELA DE SUCESSO
  if (success) {
      return (
          <div className="min-h-screen bg-neon-bg flex items-center justify-center p-4">
              <div className="max-w-md w-full bg-slate-900 border border-green-500/50 p-10 rounded-[2.5rem] shadow-2xl text-center animate-scale-in">
                  <div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-green-500/30">
                      <CheckCircle size={40} />
                  </div>
                  <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter">Senha Alterada!</h2>
                  <p className="text-slate-400 mb-8 text-sm">Sua conta foi atualizada. Redirecionando para o login...</p>
                  <div className="text-neon-blue font-black animate-pulse text-[10px] tracking-widest uppercase">Aguarde...</div>
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-neon-bg flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-8 md:p-12 rounded-[2.5rem] shadow-2xl relative animate-fade-in">
            <div className="text-center mb-10">
                <div className="w-16 h-16 bg-neon-blue/10 text-neon-blue rounded-2xl flex items-center justify-center mx-auto mb-6 border border-neon-blue/20">
                    <KeyRound size={32} />
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter">Nova Senha</h2>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-2">Crie sua nova credencial de acesso</p>
            </div>

            {!isSessionReady && !isLoading ? (
                <div className="p-6 bg-blue-500/5 border border-blue-500/20 rounded-2xl text-center space-y-4">
                    <Loader2 className="animate-spin text-neon-blue mx-auto" size={24} />
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Validando segurança...</p>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-1.5">
                        <label className="block text-[10px] font-black text-slate-500 mb-1 uppercase tracking-widest">Sua nova senha</label>
                        <div className="relative group">
                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-neon-blue transition-colors" size={18}/>
                            <input 
                                type={showPassword ? "text" : "password"} 
                                required 
                                autoFocus
                                className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 pl-12 pr-12 text-white font-bold outline-none focus:border-neon-blue transition-all" 
                                placeholder="Mínimo 6 dígitos"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                            />
                            <button 
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                            >
                                {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="block text-[10px] font-black text-slate-500 mb-1 uppercase tracking-widest">Confirme a senha</label>
                        <div className="relative group">
                            <ShieldCheck className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${isConfirmError ? 'text-red-500' : 'text-slate-600 group-focus-within:text-neon-blue'}`} size={18}/>
                            <input 
                                type={showConfirmPassword ? "text" : "password"} 
                                required 
                                className={`w-full bg-slate-800 border rounded-2xl p-4 pl-12 pr-12 text-white font-bold outline-none transition-all ${isConfirmError ? 'border-red-500 ring-2 ring-red-500/20' : 'border-slate-700 focus:border-neon-blue'}`} 
                                placeholder="Repita a senha"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                            />
                            <button 
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                            >
                                {showConfirmPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                            </button>
                        </div>
                        {isConfirmError && (
                            <p className="text-[9px] text-red-500 font-bold uppercase tracking-tight mt-1 ml-1 animate-fade-in">As senhas ainda não coincidem</p>
                        )}
                    </div>

                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] rounded-xl text-center font-bold uppercase animate-shake">
                            {error}
                        </div>
                    )}

                    <button 
                        type="submit" 
                        disabled={isLoading || isConfirmError} 
                        className={`w-full font-black py-5 rounded-2xl shadow-xl transition-all transform active:scale-95 flex items-center justify-center gap-3 uppercase text-xs tracking-widest ${isConfirmError ? 'bg-slate-700 text-slate-500 cursor-not-allowed opacity-50' : 'bg-neon-blue hover:bg-blue-600 text-white'}`}
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'DEFINIR NOVA SENHA'}
                    </button>
                </form>
            )}

            <div className="text-center mt-8">
                <button onClick={() => navigate('/login')} className="text-[10px] font-black text-slate-600 hover:text-slate-400 transition-colors uppercase tracking-widest flex items-center justify-center gap-2 mx-auto">
                    <ArrowLeft size={12}/> Voltar ao Login
                </button>
            </div>
        </div>
    </div>
  );
};

export default ResetPassword;
