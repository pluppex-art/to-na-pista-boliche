import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Declare Deno global to fix TypeScript errors in environments where Deno types are not automatically loaded
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// Configuração do CORS para aceitar requisições do Mercado Pago
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Recebe a notificação do Mercado Pago
    const url = new URL(req.url)
    const body = await req.json()
    const { action, data } = body

    // Log para debug no painel do Supabase
    console.log("Webhook recebido:", action, data?.id)

    // Só nos interessa quando um pagamento é criado ou atualizado
    if (action !== 'payment.created' && action !== 'payment.updated') {
      return new Response(JSON.stringify({ message: "Ignored event" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // 2. Cria conexão com o banco (Supabase Admin)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 3. Busca configurações para pegar o Access Token do MP do banco de dados
    const { data: settings } = await supabaseClient
      .from('configuracoes')
      .select('mercadopago_access_token')
      .single()

    if (!settings?.mercadopago_access_token) {
      throw new Error("Token do Mercado Pago não configurado no banco.")
    }

    // 4. Valida o pagamento diretamente na API do Mercado Pago (Segurança)
    // Não confiamos apenas no body do webhook, perguntamos ao MP o status real
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${data.id}`, {
      headers: {
        'Authorization': `Bearer ${settings.mercadopago_access_token}`
      }
    })

    if (!mpResponse.ok) {
      throw new Error("Falha ao consultar pagamento no Mercado Pago")
    }

    const paymentData = await mpResponse.json()
    const paymentStatus = paymentData.status // approved, pending, rejected
    const externalReference = paymentData.external_reference // ID da Reserva

    console.log(`Pagamento ${data.id} para Reserva ${externalReference}: Status ${paymentStatus}`)

    // 5. Atualiza a Reserva no Banco de Dados
    if (externalReference && paymentStatus === 'approved') {
        // Atualiza status para CONFIRMADA e PAGO
        const { error: updateError } = await supabaseClient
            .from('reservas')
            .update({
                status: 'Confirmada',
                payment_status: 'Pago',
                // Adicionamos observação automática
                observations: `Pagamento PIX/Cartão confirmado via MP (ID: ${data.id})`
            })
            .eq('id', externalReference)

        if (updateError) throw updateError

        // (Opcional) Adicionar Pontos de Fidelidade
        // Se desejar, você pode calcular pontos e inserir na tabela loyalty_transactions aqui
    }

    return new Response(JSON.stringify({ message: "Success" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error("Erro no Webhook:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400, // Retorna erro para o MP tentar de novo se for falha nossa
    })
  }
})