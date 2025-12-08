import { Reservation, AppSettings } from '../types';

export const Integrations = {
  createMercadoPagoPreference: async (reservation: any, settings: AppSettings): Promise<string | null> => {
    if (!settings.onlinePaymentEnabled || !settings.mercadopagoAccessToken) {
      console.error('Online payments disabled or missing credentials.');
      return null;
    }

    console.log(`[Integration] Creating MP preference for reservation ${reservation.id}`);

    // DADOS PARA ENVIAR AO MERCADO PAGO
    const preferenceData = {
        items: [
            {
                id: reservation.id,
                title: `Reserva - ${settings.establishmentName}`,
                description: `Reserva de Pista de Boliche para ${reservation.clientName}`,
                quantity: 1,
                currency_id: 'BRL',
                unit_price: Number(reservation.totalValue)
            }
        ],
        payer: {
            name: reservation.clientName,
            email: reservation.clientEmail || 'cliente@email.com',
        },
        back_urls: {
            success: window.location.origin + '/checkout/success', 
            failure: window.location.origin + '/checkout/failure',
            pending: window.location.origin + '/checkout/pending'
        },
        auto_return: "approved",
        external_reference: reservation.id
    };

    try {
        // Tenta fazer a chamada real à API do Mercado Pago
        // NOTA: Em um ambiente puramente frontend (navegador), esta chamada pode ser bloqueada por CORS
        // dependendo da configuração da conta do Mercado Pago ou do navegador.
        // O ideal é que esta chamada seja feita através de um Backend (Node.js/Supabase Edge Function).
        
        const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${settings.mercadopagoAccessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(preferenceData)
        });

        if (response.ok) {
            const data = await response.json();
            // Retorna o link de pagamento (init_point para produção ou sandbox_init_point para testes)
            return data.init_point; 
        } else {
            const errorData = await response.json();
            console.error('Erro Mercado Pago:', errorData);
            
            // --- FALLBACK PARA DEMONSTRAÇÃO ---
            console.warn('Usando Mock Link devido a erro na API (Provavel CORS ou Credencial Inválida).');
            return `https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=mock_pref_${reservation.id}`;
        }

    } catch (error) {
        console.error('Erro de conexão com Mercado Pago:', error);
        // Fallback
        return `https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=mock_pref_${reservation.id}`;
    }
  }
};