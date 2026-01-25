import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Lock, CheckCircle, KeyRound, ArrowLeft, ArrowRight } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [isTokenValid, setIsTokenValid] = useState(false);

  useEffect(() => {
    const validateToken = async () => {
      try {
        console.log('Iniciando validação...');
        
        // Extrai parâmetros da URL
        const fullHash = window.location.hash;
        console.log('Hash completa:', fullHash);
        
        let params: URLSearchParams;
        
        if (fullHash.includes('?')) {
          const queryString = fullHash.split('?')[1];
          params = new URLSearchParams(queryString);
          console.log('Query string extraída:', queryString);
        } else {
          throw new Error('URL sem parâmetros');
        }

        const accessToken = params.get('access_token');
        const type = params.get('type');

        console.log('Access token:', accessToken ? 'Presente' : 'Ausente');
        console.log('Type:', type);

        if (!accessToken || type !== 'recovery') {
          throw new Error('Token ou tipo inválido');
        }

        // MUDANÇA AQUI: Usar exchangeCodeForSession em vez de setSession
        // O Supabase espera que você use o fluxo PKCE
        // Mas como estamos no HashRouter, vamos usar uma abordagem diferente
        
        // Primeiro, tenta verificar se já existe uma sessão ativa
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        
        if (existingSession) {
          console.log('Sessão já existe!');
          setIsTokenValid(true);
          setIsValidating(false);
          return;
        }

        // Se não existe sessão, vamos criar uma usando verifyOtp
        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: accessToken,
          type: 'recovery'
        });

        console.log('Resultado verifyOtp:', data);
        console.log('Erro verifyOtp:', verifyError);

        if (verifyError) {
          throw verifyError;
        }

        if (data.session) {
          console.log('Sessão criada com sucesso!');
          setIsTokenValid(true);
        } else {
          throw new Error('Não foi possível criar a sessão');
        }
        
      } catch (err: any) {
        console.error('Erro completo:', err);
        setIsTokenValid(false);
        setError(err?.message || 'Link inválido ou expirado');
      } finally {
        setIsValidating(false);
      }
    };

    validateToken();
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
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        throw updateError;
      }

      setSuccess(true);
      await supabase.auth.signOut();
      setTimeout(() => navigate('/login'), 4000);
    } catch (err: any) {
      console.error('Erro ao atualizar senha:', err);
      setError(err?.message || 'Erro ao atualizar senha.');
      setIsLoading(false);
    }
  };

  // Loading state
  if (isValidating) {
    return (
      <div className="min-h-screen bg-neon-bg flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-10 rounded-[2.5rem] text-center">
          <Loader2 size={48} className="mx-auto text-neon-blue mb-6 animate-spin" />
          <h2 className="text-2xl font-black text-white mb-2 uppercase">Validando Link</h2>
          <p className="text-slate-400">Aguarde um momento...</p>
        </div>
      </div>
    );
  }

  // Invalid token
  if (!isTokenValid) {
    return (
      <div className="min-h-screen bg-neon-bg flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-red-500/50 p-10 rounded-[2.5rem] text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock size={32} className="text-red-400" />
          </div>
          <h2 className="text-2xl font-black text-red-400 mb-4 uppercase">Link Inválido</h2>
          <p className="text-slate-400 mb-2">{error || 'Auth session missing!'}</p>
          <p className="text-slate-500 text-sm mb-6">Solicite um novo link na página de login.</p>
          <button
            onClick={() => navigate('/login')}
            className="text-white bg-red-600 hover:bg-red-700 px-6 py-3 rounded-xl font-bold transition-colors"
          >
            Voltar ao Login
          </button>
        </div>
      </div>
    );
  }

  // Success
  if (success) {
    return (
      <div className="min-h-screen bg-neon-bg flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-green-500/50 p-10 rounded-[2.5rem] text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <h2 className="text-3xl font-black text-white mb-2 uppercase">Senha Atualizada!</h2>
          <p className="text-slate-400 mb-2">Sua senha foi alterada com sucesso.</p>
          <p className="text-slate-500 text-sm">Redirecionando para o login...</p>
        </div>
      </div>
    );
  }

  // Form
  return (
    <div className="min-h-screen bg-neon-bg flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-neon-blue/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <KeyRound size={32} className="text-neon-blue" />
          </div>
          <h2 className="text-2xl font-black text-white uppercase">Nova Senha</h2>
          <p className="text-slate-400 text-sm mt-2">Defina uma senha forte e segura</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-slate-400 text-sm font-bold mb-2">
              Nova Senha
            </label>
            <input
              type="password"
              placeholder="Mínimo 6 caracteres"
              className="w-full p-4 rounded-xl bg-slate-800 text-white border border-slate-700 focus:border-neon-blue focus:outline-none transition-colors"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <div>
            <label className="block text-slate-400 text-sm font-bold mb-2">
              Confirmar Senha
            </label>
            <input
              type="password"
              placeholder="Digite a senha novamente"
              className="w-full p-4 rounded-xl bg-slate-800 text-white border border-slate-700 focus:border-neon-blue focus:outline-none transition-colors"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-4">
              <p className="text-red-400 text-sm font-bold text-center">
                {error}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-neon-blue hover:bg-neon-blue/80 py-4 rounded-xl text-white font-bold uppercase tracking-wide transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Salvando...
              </>
            ) : (
              <>
                Definir Nova Senha
                <ArrowRight size={20} />
              </>
            )}
          </button>

          <div className="text-center pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-slate-400 hover:text-white text-sm font-medium transition-colors inline-flex items-center gap-2"
            >
              <ArrowLeft size={16} />
              Voltar ao Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;