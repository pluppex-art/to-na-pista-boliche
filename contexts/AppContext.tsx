
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AppSettings, User } from '../types';
import { INITIAL_SETTINGS } from '../constants';
import { db } from '../services/mockBackend';

interface AppContextType {
  settings: AppSettings;
  user: User | null;
  loading: boolean;
  refreshSettings: () => Promise<void>;
  refreshUser: () => void;
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

  const refreshUser = () => {
    const stored = localStorage.getItem('tonapista_auth');
    if (stored) {
      try {
        const parsedUser = JSON.parse(stored);
        // Seta o usuário otimisticamente para não piscar a tela de login
        setUser(parsedUser);
        
        // Valida se o usuário ainda existe no banco de dados
        db.users.getById(parsedUser.id).then(freshUser => {
             if (freshUser) {
                 // Usuário existe, atualiza estado e storage com dados frescos
                 setUser(freshUser);
                 localStorage.setItem('tonapista_auth', JSON.stringify(freshUser));
             } else {
                 // Usuário NÃO existe (foi deletado), força logout
                 console.warn("Sessão inválida: Usuário não encontrado no banco. Realizando logout automático.");
                 localStorage.removeItem('tonapista_auth');
                 setUser(null);
             }
        }).catch((err) => {
            console.error("Erro ao validar sessão do usuário:", err);
            // Em caso de erro de rede, mantemos a sessão otimista por segurança UX,
            // mas erros de 404/Null já foram tratados acima.
        });
      } catch (e) {
        console.error("Erro ao ler usuário do storage:", e);
        localStorage.removeItem('tonapista_auth');
        setUser(null);
      }
    } else {
      setUser(null);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      refreshUser(); 
      await refreshSettings();
      setLoading(false);
    };
    init();

    const handleSettingsUpdate = () => refreshSettings();
    window.addEventListener('settings_updated', handleSettingsUpdate);

    return () => {
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
