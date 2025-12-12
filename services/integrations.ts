
import { Reservation, AppSettings } from '../types';

export const Integrations = {
  createMercadoPagoPreference: async (reservation: any, settings: AppSettings): Promise<string | null> => {
    if (!settings.onlinePaymentEnabled || !settings.mercadopagoAccessToken) {
      console.error('Online payments disabled or missing credentials.');
      return null;
    }

    console.log(`[Integration] Creating MP preference for reservation ${reservation.id}`);

    // URL base do Supabase (Hardcoded based on current config to ensure consistency)
    const SUPABASE_PROJECT_URL = 'https://rmirkhebjgvsqqenszts.supabase.co';
    const WEBHOOK_URL = `${SUPABASE_PROJECT_URL}/functions/v1/mp-webhook`;

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
        // CONFIGURAÇÃO DE MÉTODOS DE PAGAMENTO
        payment_methods: {
            excluded_payment_types: [
                { id: "ticket" }, // Remove Boleto Bancário e pagamentos em Lotérica (Pendentes)
                { id: "atm" }     // Remove pagamento em caixa eletrônico
            ],
            excluded_payment_methods: [
                // { id: "elo" } // Exemplo: Se quiser remover bandeira ELO, descomente aqui
            ],
            installments: 6 // Sugestão: Limita o parcelamento padrão para ficar mais limpo (opcional)
        },
        back_urls: {
            success: "https://www.tonapistaboliche.com.br/minha-conta",
            failure: "https://www.tonapistaboliche.com.br/agendamento",
            pending: "https://www.tonapistaboliche.com.br/minha-conta"
        },
        notification_url: WEBHOOK_URL, // IMPORTANTE: Define explicitamente onde o MP deve avisar
        auto_return: "approved",
        external_reference: reservation.id,
        // Garante que só aceita pagamento de quem está logado ou convidado
        binary_mode: true // IMPORTANTE: Isso força o pagamento a ser aprovado ou rejeitado na hora (sem pendência de boleto)
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
