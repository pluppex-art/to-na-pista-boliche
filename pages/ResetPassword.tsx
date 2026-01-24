
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/mockBackend';
// Fix: Added ArrowLeft to the imports from lucide-react
import { Loader2, Lock, CheckCircle, ShieldCheck, ArrowRight, KeyRound, ArrowLeft } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTokenValid, setIsTokenValid] = useState(true);

  useEffect(() => {
      // Captura o evento de recuperação de senha do Supabase
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (event === 'PASSWORD_RECOVERY') {
              console.log("Evento PASSWORD_RECOVERY detectado");
              setIsTokenValid(true);
          }
      });

      // Se o usuário cair aqui sem sessão ou sem evento, damos um aviso (opcional)
      const checkSession = async () => {
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
            // Em produção, se não houver sessão, o link pode estar expirado
            // Mas mantemos habilitado pois o Supabase injeta o token na URL
        }
      };
      checkSession();

      return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      
      if (password.length < 6) {
          setError('A senha deve ter pelo menos 6 caracteres por segurança.');
          return;
      }
      if (password !== confirmPassword) {
          setError('As senhas digitadas não são idênticas.');
          return;
      }

      setIsLoading(true);
      try {
          const { success: updateSuccess, error: updateError } = await db.clients.updatePassword(password);
          if (updateError) {
              if (updateError.includes("Auth session missing")) {
                  setError('Sessão expirada. Por favor, solicite um novo link de recuperação no login.');
              } else {
                  setError(updateError);
              }
          } else {
              setSuccess(true);
              // Faz logout por segurança para garantir que o próximo acesso use a senha nova
              await db.clients.logout();
              // Meta Pixel: Track de redefinição concluída
              if (window.fbq) window.fbq('trackCustom', 'PasswordResetComplete');
              setTimeout(() => navigate('/login'), 4000);
          }
      } catch (err) {
          setError('Houve um erro técnico. Tente novamente mais tarde.');
      } finally {
          setIsLoading(false);
      }
  };

  if (success) {
      return (
          <div className="min-h-screen bg-neon-bg flex items-center justify-center p-4">
              <div className="max-w-md w-full bg-slate-900 border border-green-500/50 p-10 rounded-[2.5rem] shadow-[0_0_50px_rgba(34,197,94,0.1)] text-center animate-scale-in overflow-hidden relative">
                  <div className="absolute top-0 left-0 w-full h-1 bg-green-500 animate-pulse"></div>
                  <div className="w-20 h-20 bg-green-500/20 text-green-500 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 border border-green-500/30 shadow-inner">
                      <CheckCircle size={40} />
                  </div>
                  <h2 className="text-3xl font-black text-white mb-2 uppercase tracking-tighter">Senha Atualizada!</h2>
                  <p className="text-slate-400 mb-8 font-medium">Sua conta agora está protegida com a nova senha. Você será levado à tela de login em instantes.</p>
                  <div className="flex items-center justify-center gap-2 text-neon-blue font-black uppercase text-[10px] tracking-widest animate-pulse">
                      Redirecionando <ArrowRight size={14}/>
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-neon-bg flex items-center justify-center p-4 relative overflow-hidden">
        {/* Efeitos de fundo */}
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-neon-blue/5 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-neon-orange/5 rounded-full blur-[120px]"></div>

        <div className="max-w-md w-full bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-8 md:p-12 rounded-[2.5rem] shadow-2xl relative animate-fade-in">
            <div className="absolute top-0 right-0 p-6 opacity-[0.03] pointer-events-none"><ShieldCheck size={120}/></div>
            
            <div className="text-center mb-10">
                <div className="w-16 h-16 bg-neon-blue/10 text-neon-blue rounded-2xl flex items-center justify-center mx-auto mb-6 border border-neon-blue/20 shadow-inner">
                    <KeyRound size={32} />
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter">Nova Senha</h2>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2">Segurança em primeiro lugar</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-slate-500 mb-1 uppercase tracking-widest ml-1">Crie sua nova senha</label>
                    <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-neon-blue transition-colors" size={18}/>
                        <input 
                            type="password" 
                            required 
                            autoFocus
                            className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 pl-12 text-white font-bold outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue/20 transition-all placeholder:text-slate-600" 
                            placeholder="Mínimo 6 caracteres"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="block text-[10px] font-black text-slate-500 mb-1 uppercase tracking-widest ml-1">Confirme a senha</label>
                    <div className="relative group">
                        <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-neon-blue transition-colors" size={18}/>
                        <input 
                            type="password" 
                            required 
                            className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 pl-12 text-white font-bold outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue/20 transition-all placeholder:text-slate-600" 
                            placeholder="Repita a nova senha"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                        />
                    </div>
                </div>

                {error && (
                    <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl text-center font-bold animate-shake uppercase tracking-tight">
                        {error}
                    </div>
                )}

                <button 
                    type="submit" 
                    disabled={isLoading} 
                    className="w-full bg-neon-blue hover:bg-blue-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-blue-900/20 transition-all transform active:scale-95 flex items-center justify-center gap-3 uppercase text-xs tracking-[0.2em]"
                >
                    {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'DEFINIR NOVA SENHA'}
                </button>

                <div className="text-center pt-2">
                    <button 
                        type="button"
                        onClick={() => navigate('/login')}
                        className="text-[10px] font-black text-slate-600 hover:text-slate-400 transition-colors uppercase tracking-widest flex items-center justify-center gap-2 mx-auto"
                    >
                        <ArrowLeft size={12}/> Voltar ao Login
                    </button>
                </div>
            </form>
        </div>
    </div>
  );
};

export default ResetPassword;
