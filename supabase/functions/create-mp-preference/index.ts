
// @ts-ignore
declare const Deno: any;

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // Lida com requisições OPTIONS (CORS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { reservationId } = await req.json()

    if (!reservationId) {
      throw new Error("O ID da reserva é obrigatório para processar o pagamento.")
    }

    // 1. Inicializa Supabase com a Service Role Key (Chave Mestra)
    // Isso permite ler colunas escondidas do público
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 2. Busca os dados reais da reserva no banco
    // Isso evita que o usuário altere o preço no navegador
    const { data: res, error: resError } = await supabaseAdmin
      .from('reservas')
      .select('*')
      .eq('id', reservationId)
      .single()

    if (resError || !res) {
      console.error("Reserva não encontrada:", resError)
      throw new Error("Não foi possível localizar os dados da reserva.")
    }

    // 3. Busca o Access Token do Mercado Pago
    const { data: config, error: configError } = await supabaseAdmin
      .from('configuracoes')
      .select('mercadopago_access_token, establishment_name')
      .single()

    if (configError || !config?.mercadopago_access_token) {
      throw new Error("A integração com Mercado Pago não está configurada no painel administrativo.")
    }

    // 4. Cria a Preferência no Mercado Pago via API nativa
    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.mercadopago_access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        items: [{
          id: res.id,
          title: `Reserva de Pista - ${config.establishment_name || 'Tô Na Pista'}`,
          description: `Data: ${res.date} às ${res.time} (${res.lane_count} pistas)`,
          quantity: 1,
          currency_id: 'BRL',
          unit_price: Number(res.total_value)
        }],
        payer: {
          name: res.client_name,
        },
        external_reference: res.id, // Vincula o pagamento à nossa reserva
        notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mp-webhook`,
        back_urls: {
          success: `${req.headers.get('origin')}/#/minha-conta`,
          failure: `${req.headers.get('origin')}/#/agendamento`,
          pending: `${req.headers.get('origin')}/#/minha-conta`
        },
        auto_return: "approved",
        binary_mode: true // Evita status "in_process" (intermediário)
      })
    })

    if (!mpResponse.ok) {
      const errorData = await mpResponse.json()
      console.error("Erro MP API:", errorData)
      throw new Error("O provedor de pagamento recusou a solicitação.")
    }

    const mpData = await mpResponse.json()

    // Retorna apenas a URL para o front-end
    return new Response(JSON.stringify({ url: mpData.init_point }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
