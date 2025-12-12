
// Declare Deno to avoid TypeScript errors in non-Deno environments
declare const Deno: any;

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Definição de tipos básicos para evitar erros de TS no Deno
interface WebhookBody {
  action?: string;
  type?: string;
  data?: { id: string };
  id?: number | string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  // 1. Tratamento de CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    
    // 2. Parse do Body com segurança
    let body: WebhookBody;
    try {
        body = await req.json();
    } catch (e) {
        console.error("Erro ao fazer parse do JSON:", e);
        return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: corsHeaders });
    }

    const { action, type, data } = body;
    const resourceId = data?.id || body.id; // Fallback para ID na raiz se necessário

    console.log(`[Webhook] Evento recebido: ${action || type} | ID: ${resourceId}`);

    // 3. Filtro de Eventos: Apenas pagamentos criados ou atualizados
    // O Mercado Pago envia 'payment.created' ou 'payment.updated' no campo action
    // Ou type='payment'
    if (action !== 'payment.created' && action !== 'payment.updated') {
       if (type !== 'payment') {
           console.log("[Webhook] Evento ignorado (não é pagamento).");
           return new Response(JSON.stringify({ message: "Ignored event" }), { status: 200, headers: corsHeaders });
       }
    }

    if (!resourceId) {
        console.error("[Webhook] ID do pagamento não encontrado no corpo.");
        return new Response(JSON.stringify({ error: "Payment ID missing" }), { status: 200, headers: corsHeaders }); // Retorna 200 para parar retentativas de bad request
    }

    // 4. Inicializa Supabase Client
    // IMPORTANTE: As variáveis de ambiente devem estar configuradas no Painel do Supabase > Edge Functions > Secrets
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
        console.error("[Webhook] Erro Crítico: Variáveis de ambiente SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidas.");
        throw new Error("Server Configuration Error");
    }

    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // 5. Busca Token do Mercado Pago no Banco
    const { data: settings, error: settingsError } = await supabaseClient
      .from('configuracoes')
      .select('mercadopago_access_token')
      .limit(1)
      .single();

    if (settingsError || !settings?.mercadopago_access_token) {
      console.error("[Webhook] Token MP não encontrado no banco:", settingsError);
      throw new Error("Token do Mercado Pago não configurado.");
    }

    // 6. Consulta API do Mercado Pago para confirmar status real
    console.log(`[Webhook] Consultando Mercado Pago para ID: ${resourceId}`);
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${resourceId}`, {
      headers: {
        'Authorization': `Bearer ${settings.mercadopago_access_token}`
      }
    });

    if (!mpResponse.ok) {
      const errorText = await mpResponse.text();
      console.error(`[Webhook] Erro MP API (${mpResponse.status}):`, errorText);
      throw new Error("Falha ao consultar API do Mercado Pago");
    }

    const paymentData = await mpResponse.json();
    const status = paymentData.status; // approved, pending, rejected, etc.
    const externalReference = paymentData.external_reference; // ID da Reserva

    console.log(`[Webhook] Status Real MP: ${status} | Referência: ${externalReference}`);

    // 7. Atualiza Reserva se Aprovado
    if (externalReference && status === 'approved') {
        const { error: updateError } = await supabaseClient
            .from('reservas')
            .update({
                status: 'Confirmada',
                payment_status: 'Pago'
                // REMOVIDO: observations: `Pagamento PIX/Cartão confirmado via MP (ID: ${resourceId})`
                // Mantém a UI limpa sem dados técnicos. O status "Confirmada" já é suficiente.
            })
            .eq('id', externalReference);

        if (updateError) {
            console.error("[Webhook] Erro ao atualizar reserva:", updateError);
            throw updateError;
        }
        
        console.log(`[Webhook] Reserva ${externalReference} confirmada com sucesso!`);
    }

    return new Response(JSON.stringify({ message: "Success" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error("[Webhook] Exception:", error.message);
    // Retorna 500 se for erro de servidor, ou 400 se for erro de lógica
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})
