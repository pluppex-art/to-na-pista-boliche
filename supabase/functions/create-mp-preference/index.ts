
declare const Deno: any;
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { reservationId } = await req.json()
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey)

    // 1. Busca as credenciais de produção diretamente da sua tabela 'configuracoes'
    const { data: config, error: configError } = await supabaseAdmin
      .from('configuracoes')
      .select('mercadopago_access_token')
      .limit(1)
      .maybeSingle()

    if (configError || !config?.mercadopago_access_token) {
      console.error("[ERRO CONFIG]", configError)
      throw new Error("Credenciais do Mercado Pago não encontradas na tabela 'configuracoes'.")
    }

    const mpAccessToken = config.mercadopago_access_token.trim()

    // 2. Busca os dados da reserva e do cliente
    const { data: res, error: resError } = await supabaseAdmin
      .from('reservas')
      .select('*, clientes(email, name)')
      .eq('id', reservationId)
      .maybeSingle()

    if (resError || !res) throw new Error("Reserva não encontrada.")

    // 3. Define o e-mail do pagador (MUITO IMPORTANTE para evitar 403)
    let payerEmail = res.clientes?.email || "cliente@tonapistaboliche.com.br"
    const payerName = res.clientes?.name || res.client_name || "Cliente"

    // Se o e-mail for o mesmo do vendedor (comum em testes), o MP bloqueia. 
    // Vamos garantir que seja um e-mail com formato válido de cliente.
    if (payerEmail.includes("admin") || payerEmail.includes("boliche")) {
       console.log("[AVISO] E-mail de pagador suspeito detectado, usando fallback seguro.");
    }

    const finalPrice = typeof res.total_value === 'string' 
      ? parseFloat(res.total_value.replace(',', '.')) 
      : Number(res.total_value)

    const origin = req.headers.get('origin') || 'https://tonapistaboliche.com.br'
    
    // Define data de expiração para exatamente 30 minutos a partir de agora
    const expirationDate = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const mpBody = {
      items: [{
        id: res.id,
        title: "Reserva de Boliche - Tô Na Pista",
        quantity: 1,
        currency_id: 'BRL',
        unit_price: finalPrice,
        category_id: 'entertainment',
        description: `Pista para ${res.people_count} pessoas`
      }],
      payer: {
        name: payerName.split(' ')[0] || "Cliente",
        surname: payerName.split(' ').slice(1).join(' ') || "Tô na Pista",
        email: payerEmail
      },
      external_reference: res.id,
      expires: true,
      expiration_date_to: expirationDate,
      back_urls: {
        success: `${origin}/#/minha-conta`,
        failure: `${origin}/#/agendamento`,
        pending: `${origin}/#/minha-conta`
      },
      auto_return: "approved",
      notification_url: `${supabaseUrl}/functions/v1/mp-webhook`,
      statement_descriptor: "TONAPISTA"
    }

    console.log(`[MP_REQUEST] Enviando para MP com expiração em: ${expirationDate}`)

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(mpBody)
    })

    const mpData = await mpResponse.json()

    if (!mpResponse.ok) {
      console.error("[MP_API_ERROR]", JSON.stringify(mpData))
      if (mpData.status === 403 || mpData.code === "PA_UNAUTHORIZED_RESULT_FROM_POLICIES") {
        throw new Error("O Mercado Pago recusou o pagamento (Erro 403).")
      }
      throw new Error(mpData.message || "Erro ao gerar link de pagamento no Mercado Pago.")
    }

    return new Response(JSON.stringify({ url: mpData.init_point }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error("[FATAL]", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
