
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

    // 1. Busca Token do MP
    const { data: config } = await supabaseAdmin
      .from('configuracoes')
      .select('mercadopago_access_token')
      .limit(1)
      .maybeSingle()

    if (!config?.mercadopago_access_token) throw new Error("Credenciais do Mercado Pago não configuradas.");

    const mpAccessToken = config.mercadopago_access_token.trim()

    // 2. Busca Reserva
    const { data: res } = await supabaseAdmin
      .from('reservas')
      .select('*, clientes(email, name)')
      .eq('id', reservationId)
      .single()

    if (!res) throw new Error("Reserva não encontrada.")

    // 3. Trava de tempo (30 minutos a partir da criação)
    const createdAt = new Date(res.created_at).getTime();
    const expirationTime = new Date(createdAt + 30 * 60 * 1000);
    const now = new Date();
    
    if (now.getTime() > expirationTime.getTime()) {
       throw new Error("O prazo de 30 minutos para pagamento expirou. Inicie uma nova reserva.");
    }

    // 4. Monta Preferência para o MP
    const finalPrice = typeof res.total_value === 'string' 
      ? parseFloat(res.total_value.replace(',', '.')) 
      : Number(res.total_value)

    const mpBody = {
      items: [{
        id: res.id,
        title: "Reserva de Boliche - Tô Na Pista",
        quantity: 1,
        currency_id: 'BRL',
        unit_price: finalPrice,
        description: `Dia ${res.date} às ${res.time}`
      }],
      payer: {
        name: (res.clientes?.name || res.client_name || "Cliente"),
        email: res.clientes?.email || "vendas@tonapistaboliche.com.br"
      },
      external_reference: res.id,
      expires: true,
      expiration_date_to: expirationTime.toISOString(), // Expiração real no banco
      back_urls: {
        success: `${req.headers.get('origin')}/#/minha-conta`,
        failure: `${req.headers.get('origin')}/#/agendamento`,
        pending: `${req.headers.get('origin')}/#/minha-conta`
      },
      auto_return: "approved",
      notification_url: `${supabaseUrl}/functions/v1/mp-webhook`,
      statement_descriptor: "TONAPISTA"
    }

    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mpAccessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(mpBody)
    })

    const mpData = await mpResponse.json()
    if (!mpResponse.ok) throw new Error(mpData.message || "Erro ao gerar link no Mercado Pago.");

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
