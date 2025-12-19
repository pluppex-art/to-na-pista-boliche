
import { AppSettings } from '../types';
import { supabase } from './supabaseClient';

export const Integrations = {
  /**
   * Solicita a criação de uma preferência de pagamento de forma segura.
   */
  createMercadoPagoPreference: async (reservation: any, settings: AppSettings): Promise<string | null> => {
    try {
      console.log(`[Checkout] Solicitando link para reserva: ${reservation.id}`);

      // Chamada para a Edge Function
      const { data, error } = await supabase.functions.invoke('create-mp-preference', {
        body: { reservationId: reservation.id }
      });

      // Se o Supabase retornar um erro (HTTP != 2xx)
      if (error) {
        console.error('Erro na Edge Function:', error);
        
        // Tenta extrair a mensagem de erro que nós enviamos no JSON
        let customMessage = "Falha na comunicação com o servidor de pagamentos.";
        
        try {
            // No Supabase v2, o erro pode conter o corpo da resposta se for um erro de função
            if (error.context && typeof error.context.json === 'function') {
                const errorBody = await error.context.json();
                if (errorBody.error) customMessage = errorBody.error;
            } else if (error.message) {
                // Mensagem padrão do erro do Supabase
                customMessage = error.message;
            }
        } catch (e) {
            console.warn("Não foi possível ler o corpo do erro da function.");
        }

        throw new Error(customMessage);
      }

      // Erro retornado de dentro da lógica da função (se retornar 200 com flag de erro)
      if (data?.error) {
        throw new Error(data.error);
      }

      if (!data?.url) {
        throw new Error("O servidor não retornou uma URL de pagamento válida.");
      }

      return data.url;

    } catch (error: any) {
      console.error('Erro Final na Integração:', error.message);
      
      // Tradução de mensagens comuns para o usuário
      let userMsg = error.message;
      if (userMsg.includes("Failed to send a request")) {
          userMsg = "Não foi possível conectar ao servidor de pagamentos. Verifique sua internet ou tente novamente mais tarde.";
      }

      alert("Erro ao gerar pagamento: " + userMsg);
      return null;
    }
  }
};
