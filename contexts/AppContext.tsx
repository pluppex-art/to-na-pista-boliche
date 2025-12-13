
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
      try {
          // Busca as permissões na tabela 'usuarios' usando o ID seguro do Auth
          const profile = await db.users.getById(userId);
          if (profile) {
              setUser(profile);
          } else {
              // Fallback: Se o usuário existe no Auth mas não na tabela (erro de sincronia),
              // deslogamos para evitar estado inconsistente.
              console.warn("Usuário autenticado sem perfil na tabela 'usuarios'. Realizando logout de segurança.");
              await (supabase.auth as any).signOut();
              setUser(null);
          }
      } catch (e) {
          console.error("Erro crítico ao buscar perfil do usuário:", e);
          setUser(null);
      } finally {
          setLoading(false);
      }
  };

  const refreshUser = async () => {
    // Esta função agora é chamada manualmente após login
    try {
        const { data: { session } } = await (supabase.auth as any).getSession();
        if (session?.user) {
            await fetchUserProfile(session.user.id);
        } else {
            setUser(null);
            setLoading(false);
        }
    } catch (e) {
        console.error("Erro no refreshUser:", e);
        setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    
    // 1. Carrega configurações
    refreshSettings();

    // 2. Verifica sessão inicial com Timeout de Segurança
    const initAuth = async () => {
        try {
            // Race condition: Se o supabase demorar mais que 5s, destrava a tela
            const sessionPromise = (supabase.auth as any).getSession();
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000));

            const result: any = await Promise.race([sessionPromise, timeoutPromise]);
            
            if (result.data?.session?.user) {
                if (isMounted) await fetchUserProfile(result.data.session.user.id);
            } else {
                if (isMounted) {
                    setUser(null);
                    setLoading(false);
                }
            }
        } catch (e) {
            console.warn("Auth Init timeout ou erro:", e);
            if (isMounted) setLoading(false);
        }
    };

    initAuth();

    // 3. Ouve mudanças de auth em tempo real (Login, Logout, Expiração)
    const { data: { subscription } } = (supabase.auth as any).onAuthStateChange(async (event: string, session: any) => {
        console.log(`[Auth State Change] ${event}`);
        if (session?.user) {
            // Usuário logou: busca permissões
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                 await fetchUserProfile(session.user.id);
            }
        } else if (event === 'SIGNED_OUT') {
            // Usuário deslogou
            setUser(null);
            setLoading(false);
            localStorage.removeItem('tonapista_auth');
        }
    });

    const handleSettingsUpdate = () => refreshSettings();
    window.addEventListener('settings_updated', handleSettingsUpdate);

    return () => {
      isMounted = false;
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
