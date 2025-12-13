import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AppSettings, User } from '../types';
import { INITIAL_SETTINGS } from '../constants';
import { db } from '../services/mockBackend';
import { supabase } from '../services/supabaseClient';

interface AppContextType {
  settings: AppSettings;
  user: User | null;
  loading: boolean;
  refreshSettings: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(INITIAL_SETTINGS);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSettings = async () => {
    try {
      const s = await db.settings.get();
      setSettings(s);
    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
    }
  };

  const fetchUserProfile = async (userId: string) => {
      // Busca as permissões na tabela 'usuarios' usando o ID seguro do Auth
      const profile = await db.users.getById(userId);
      if (profile) {
          setUser(profile);
      } else {
          // Fallback: Se o usuário existe no Auth mas não na tabela (erro de sincronia),
          // deslogamos para evitar estado inconsistente.
          console.warn("Usuário autenticado sem perfil na tabela 'usuarios'.");
          await (supabase.auth as any).signOut();
          setUser(null);
      }
      setLoading(false);
  };

  const refreshUser = async () => {
    // Esta função agora é apenas um wrapper para compatibilidade, 
    // pois o listener do Supabase gerencia o estado automaticamente.
    const { data: { session } } = await (supabase.auth as any).getSession();
    if (session?.user) {
        await fetchUserProfile(session.user.id);
    } else {
        setUser(null);
        setLoading(false);
    }
  };

  useEffect(() => {
    // 1. Carrega configurações
    refreshSettings();

    // 2. Verifica sessão inicial
    (supabase.auth as any).getSession().then(({ data: { session } }: any) => {
        if (session?.user) {
            fetchUserProfile(session.user.id);
        } else {
            setLoading(false);
        }
    });

    // 3. Ouve mudanças de auth em tempo real (Login, Logout, Expiração)
    const { data: { subscription } } = (supabase.auth as any).onAuthStateChange(async (_event: any, session: any) => {
        if (session?.user) {
            // Usuário logou: busca permissões
            // Não seta loading=true aqui para evitar flash de tela se for apenas refresh de token
            await fetchUserProfile(session.user.id);
        } else {
            // Usuário deslogou
            setUser(null);
            setLoading(false);
            // Limpa qualquer resquício inseguro
            localStorage.removeItem('tonapista_auth');
        }
    });

    const handleSettingsUpdate = () => refreshSettings();
    window.addEventListener('settings_updated', handleSettingsUpdate);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('settings_updated', handleSettingsUpdate);
    };
  }, []);

  return (
    <AppContext.Provider value={{ settings, user, loading, refreshSettings, refreshUser }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};