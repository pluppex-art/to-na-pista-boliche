
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

    // 1. Busca as credenciais de produção
    const { data: config, error: configError } = await supabaseAdmin
      .from('configuracoes')
      .select('mercadopago_access_token')
      .limit(1)
      .maybeSingle()

    if (configError || !config?.mercadopago_access_token) {
      throw new Error("Credenciais do Mercado Pago não configuradas.")
    }

    const mpAccessToken = config.mercadopago_access_token.trim()

    // 2. Busca os dados da reserva
    const { data: res, error: resError } = await supabaseAdmin
      .from('reservas')
      .select('*, clientes(email, name)')
      .eq('id', reservationId)
      .maybeSingle()

    if (resError || !res) throw new Error("Reserva não encontrada.")

    // 3. Define o e-mail do pagador
    let payerEmail = res.clientes?.email || "atendimento@tonapistaboliche.com.br"
    const payerName = res.clientes?.name || res.client_name || "Cliente"

    const finalPrice = typeof res.total_value === 'string' 
      ? parseFloat(res.total_value.replace(',', '.')) 
      : Number(res.total_value)

    const origin = req.headers.get('origin') || 'https://tonapistaboliche.com.br'
    
    // --- LÓGICA DE EXPIRAÇÃO DE 30 MINUTOS ---
    // Calculamos 30 minutos a partir do momento da criação da reserva, não do clique no botão.
    // Isso garante que se ele esperar 20 min para clicar no botão, ele só terá 10 min de link ativo.
    const createdAt = new Date(res.created_at).getTime();
    const expirationTime = new Date(createdAt + 30 * 60 * 1000);
    const expirationDateStr = expirationTime.toISOString();
    
    // Se por algum motivo ele clicar após os 30 min, a função já deve barrar aqui
    if (new Date() > expirationTime) {
       throw new Error("O prazo de 30 minutos para iniciar o pagamento desta reserva expirou.");
    }

    const mpBody = {
      items: [{
        id: res.id,
        title: "Reserva de Boliche - Tô Na Pista",
        quantity: 1,
        currency_id: 'BRL',
        unit_price: finalPrice,
        category_id: 'entertainment',
        description: `Agendamento para ${res.date} às ${res.time}`
      }],
      payer: {
        name: payerName.split(' ')[0] || "Cliente",
        surname: payerName.split(' ').slice(1).join(' ') || "Tô na Pista",
        email: payerEmail
      },
      external_reference: res.id,
      // Configuração de Expiração Real no Mercado Pago
      expires: true,
      expiration_date_to: expirationDateStr, 
      back_urls: {
        success: `${origin}/#/minha-conta`,
        failure: `${origin}/#/agendamento`,
        pending: `${origin}/#/minha-conta`
      },
      auto_return: "approved",
      notification_url: `${supabaseUrl}/functions/v1/mp-webhook`,
      statement_descriptor: "TONAPISTA"
    }

    console.log(`[MP_PAYMENT_LOCK] Link expira em: ${expirationDateStr}`);

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
      console.error("[MP_API_ERROR]", mpData);
      throw new Error(mpData.message || "Erro ao gerar preferência no Mercado Pago.");
    }

    return new Response(JSON.stringify({ url: mpData.init_point }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error: any) {
    console.error("[CHECKOUT_ERROR]", error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
