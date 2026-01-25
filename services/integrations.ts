import { AppSettings } from '../types';
import { supabase } from './supabaseClient';

export const Integrations = {
  createMercadoPagoPreference: async (
    reservation: any,
    settings: AppSettings
  ): Promise<string | null> => {
    try {
      console.log(`[Checkout] Solicitando link para reserva: ${reservation.id}`);

      // ✅ Pega direto do cliente já configurado
      const supabaseUrl = supabase.supabaseUrl;
      const anonKey = supabase.supabaseKey;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/create-mp-preference`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: anonKey,
          },
          body: JSON.stringify({
            reservationId: reservation.id,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Erro ao criar pagamento.');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (!data?.url) {
        throw new Error('O servidor não retornou uma URL válida.');
      }

      return data.url;

    } catch (error: any) {
      console.error('Erro Final na Integração:', error.message);

      let userMsg = error.message;

      if (userMsg.includes('Failed to fetch')) {
        userMsg =
          'Não foi possível conectar ao servidor de pagamentos. Verifique sua internet ou tente novamente.';
      }

      alert('Erro ao gerar pagamento: ' + userMsg);
      return null;
    }
  },
};
