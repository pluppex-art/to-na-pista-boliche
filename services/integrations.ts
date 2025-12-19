
import { AppSettings } from '../types';
import { supabase } from './supabaseClient';

export const Integrations = {
  /**
   * Solicita a criação de uma preferência de pagamento de forma segura.
   * O front-end não envia mais o preço nem recebe o token do Mercado Pago.
   */
  createMercadoPagoPreference: async (reservation: any, settings: AppSettings): Promise<string | null> => {
    try {
      console.log(`[Segurança] Solicitando link de pagamento via Servidor para Reserva: ${reservation.id}`);

      // Chamada para a Edge Function
      // Passamos apenas o reservationId. A função buscará o valor real no DB.
      const { data, error } = await supabase.functions.invoke('create-mp-preference', {
        body: { reservationId: reservation.id }
      });

      if (error) {
        console.error('Erro na Edge Function:', error);
        throw new Error(error.message);
      }

      if (!data?.url) {
        console.error('Resposta inválida do servidor de pagamentos');
        return null;
      }

      return data.url; // URL do checkout (init_point)

    } catch (error: any) {
      console.error('Erro crítico na integração de pagamento:', error);
      alert("Erro ao gerar pagamento: " + (error.message || "Conexão interrompida"));
      return null;
    }
  }
};
