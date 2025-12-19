
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/mockBackend';
import { Loader2, Lock, CheckCircle, ShieldCheck } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Monitora se o usuário está autenticado via token (Supabase faz isso automaticamente)
  useEffect(() => {
      supabase.auth.onAuthStateChange(async (event, session) => {
          if (event !== 'PASSWORD_RECOVERY') {
              // Se não for evento de recuperação e não tiver sessão, pode estar acessando direto
              if (!session) {
                  // Opcional: Redirecionar se não houver contexto de recuperação
                  // navigate('/login');
              }
          }
      });
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
          const { success: updateSuccess, error: updateError } = await db.clients.updatePassword(password);
          if (updateError) {
              setError(updateError);
          } else {
              setSuccess(true);
              // Logout para forçar novo login com a nova senha
              await db.clients.logout();
              setTimeout(() => navigate('/login'), 3000);
          }
      } catch (err) {
          setError('Erro ao processar alteração.');
      } finally {
          setIsLoading(false);
      }
  };

  if (success) {
      return (
          <div className="min-h-screen bg-neon-bg flex items-center justify-center p-4">
              <div className="max-w-md w-full bg-slate-900 border border-green-500/50 p-8 rounded-2xl shadow-2xl text-center animate-scale-in">
                  <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/30">
                      <CheckCircle size={32} />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Senha Alterada!</h2>
                  <p className="text-slate-400 mb-6">Sua senha foi atualizada com sucesso. Você será redirecionado para o login em instantes.</p>
                  <button onClick={() => navigate('/login')} className="text-neon-blue font-bold hover:underline">Ir para Login agora</button>
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-neon-bg flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-slate-700 p-8 rounded-2xl shadow-2xl relative overflow-hidden animate-fade-in">
            <div className="absolute top-0 right-0 p-4 opacity-5"><ShieldCheck size={80}/></div>
            
            <div className="text-center mb-8">
                <div className="w-16 h-16 bg-neon-blue/20 text-neon-blue rounded-full flex items-center justify-center mx-auto mb-4 border border-neon-blue/30">
                    <Lock size={32} />
                </div>
                <h2 className="text-2xl font-bold text-white">Nova Senha</h2>
                <p className="text-slate-400 text-sm mt-2">Crie uma nova senha segura para sua conta.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Nova Senha</label>
                    <input 
                        type="password" 
                        required 
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white focus:outline-none focus:border-neon-blue transition" 
                        placeholder="Mínimo 6 caracteres"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-400 mb-1 uppercase">Confirmar Nova Senha</label>
                    <input 
                        type="password" 
                        required 
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white focus:outline-none focus:border-neon-blue transition" 
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
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
                    className="w-full bg-neon-blue hover:bg-blue-600 text-white font-bold py-3 rounded-lg shadow-lg transition flex items-center justify-center gap-2"
                >
                    {isLoading ? <Loader2 className="animate-spin" /> : 'Atualizar Senha'}
                </button>
            </form>
        </div>
    </div>
  );
};

export default ResetPassword;
