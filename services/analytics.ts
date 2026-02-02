
import { supabase } from './supabaseClient';
import { v4 as uuidv4 } from 'uuid';

const ANON_ID_KEY = 'tp_anonymous_id';

export const Analytics = {
  /**
   * Obtém ou gera um ID único para o navegador do usuário
   */
  getAnonymousId: (): string => {
    let id = localStorage.getItem(ANON_ID_KEY);
    if (!id) {
      id = uuidv4();
      localStorage.setItem(ANON_ID_KEY, id);
    }
    return id;
  },

  /**
   * Registra um evento de engajamento no Supabase
   * Ignora automaticamente se o usuário for da Equipe (Staff/Admin)
   */
  trackEvent: async (eventName: string, metadata: any = {}) => {
    try {
      // TRAVA DE SEGURANÇA: Se for membro da equipe, não registramos tráfego no funil
      const isStaff = localStorage.getItem('tonapista_auth');
      if (isStaff) {
        return; 
      }

      const anonId = Analytics.getAnonymousId();
      const currentPath = window.location.hash || window.location.pathname;
      
      // Tenta pegar o ID do cliente se estiver logado como CLIENTE
      let clientId = null;
      const storedClient = localStorage.getItem('tonapista_client_auth');
      if (storedClient) {
        try {
          clientId = JSON.parse(storedClient).id;
        } catch (e) {
          console.error("Erro ao ler auth do cliente", e);
        }
      }

      await supabase.from('analytics_events').insert({
        anonymous_id: anonId,
        client_id: clientId,
        event_name: eventName,
        page_path: currentPath,
        metadata: {
          ...metadata,
          userAgent: navigator.userAgent,
          screenSize: `${window.innerWidth}x${window.innerHeight}`
        }
      });
    } catch (e) {
      // Falha silenciosa para não quebrar a UX do cliente
      console.warn('[Analytics Error]', e);
    }
  }
};
