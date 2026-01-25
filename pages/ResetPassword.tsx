import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

  // ✅ AQUI ESTÁ O PULO DO GATO
  useEffect(() => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);

    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');

    if (access_token && refresh_token) {
      supabase.auth.setSession({
        access_token,
        refresh_token,
      }).then(({ error }) => {
        if (error) {
          setIsTokenValid(false);
          setError('Link de recuperação inválido ou expirado.');
        }
      });
    } else {
      setIsTokenValid(false);
      setError('Link de recuperação inválido.');
    }
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

    const { error } = await supabase.auth.updateUser({
      password: password,
    });

    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
      await supabase.auth.signOut();
      setTimeout(() => navigate('/login'), 4000);
    }

    setIsLoading(false);
  };

  if (!isTokenValid) {
    return (
      <div className="min-h-screen bg-neon-bg flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-red-500/50 p-10 rounded-[2.5rem] text-center">
          <h2 className="text-2xl font-black text-red-400 mb-4 uppercase">Link Expirado</h2>
          <p className="text-slate-400 mb-6">Este link de recuperação não é mais válido. Solicite um novo no login.</p>
          <button
            onClick={() => navigate('/login')}
            className="text-white bg-red-600 px-6 py-3 rounded-xl font-bold"
          >
            Voltar ao Login
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-neon-bg flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-green-500/50 p-10 rounded-[2.5rem] text-center">
          <CheckCircle size={48} className="mx-auto text-green-500 mb-6" />
          <h2 className="text-3xl font-black text-white mb-2 uppercase">Senha Atualizada!</h2>
          <p className="text-slate-400 mb-6">Você será redirecionado para o login.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neon-bg flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl">
        <div className="text-center mb-8">
          <KeyRound size={36} className="mx-auto text-neon-blue mb-4" />
          <h2 className="text-2xl font-black text-white uppercase">Nova Senha</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <input
            type="password"
            placeholder="Nova senha"
            className="w-full p-4 rounded-xl bg-slate-800 text-white"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder="Confirmar senha"
            className="w-full p-4 rounded-xl bg-slate-800 text-white"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
          />

          {error && (
            <div className="text-red-400 text-sm text-center font-bold">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-neon-blue py-4 rounded-xl text-white font-bold"
          >
            {isLoading ? <Loader2 className="animate-spin mx-auto" /> : 'Definir Nova Senha'}
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-xs text-slate-400 mt-4"
            >
              <ArrowLeft size={12} className="inline mr-1" />
              Voltar ao Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
