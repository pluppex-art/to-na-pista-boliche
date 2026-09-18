
declare const Deno: any;
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Sincroniza uma reserva com o CRM Spy (best-effort). Nunca deve derrubar o
// fluxo de reserva do usuário — qualquer falha aqui é logada e respondida com
// 200, porque quem chama (mockBackend.ts) dispara isso em fire-and-forget
// depois que a reserva já foi gravada com sucesso no to na pista.
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const respond = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status,
    })

  try {
    const { reservationId } = await req.json()
    if (!reservationId) return respond({ success: false, error: 'reservationId é obrigatório.' }, 400)

    const spyApiUrl = (Deno.env.get('SPY_API_URL') ?? '').replace(/\/$/, '')
    const spyApiKey = Deno.env.get('SPY_API_KEY') ?? ''
    if (!spyApiUrl || !spyApiKey) {
      console.warn('[sync-to-spy] SPY_API_URL/SPY_API_KEY não configurados — sync ignorado.')
      return respond({ skipped: true, reason: 'Integração com Spy não configurada neste ambiente.' })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey)

    const { data: reserva, error: reservaError } = await supabaseAdmin
      .from('reservas')
      .select('*, clientes(name, email, phone, document, company)')
      .eq('id', reservationId)
      .single()

    if (reservaError || !reserva) throw new Error('Reserva não encontrada.')

    const cliente = reserva.clientes || {}
    const name = cliente.name || reserva.client_name || 'Cliente'
    const phone = cliente.phone || ''
    const email = cliente.email || ''

    if (!phone && !email) {
      return respond({ skipped: true, reason: 'Cliente sem telefone e sem e-mail.' })
    }

    const reservationPayload = {
      id: reserva.id,
      date: reserva.date,
      time: reserva.time,
      peopleCount: reserva.people_count,
      laneCount: reserva.lane_count,
      duration: reserva.duration,
      totalValue: reserva.total_value,
      eventType: reserva.event_type,
      status: reserva.status,
      paymentStatus: reserva.payment_status,
      createdAt: reserva.created_at,
    }

    const spyResponse = await fetch(`${spyApiUrl}/api/v1/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': spyApiKey },
      body: JSON.stringify({
        name,
        email,
        phone,
        cnpj: cliente.document || '',
        company: cliente.company || '',
        source: 'To Na Pista - Agendamento',
        status: 'Novo',
        priority: 'Média',
        value: reserva.total_value,
        clientName: name,
        tenantName: 'To Na Pista Boliche',
        customFields: { origin: 'to-na-pista', reservation: reservationPayload },
      }),
    })

    const spyData = await spyResponse.json().catch(() => ({}))
    if (!spyResponse.ok) {
      console.error('[sync-to-spy] Spy recusou a sincronização:', spyResponse.status, spyData)
      return respond({ success: false, error: spyData?.error || 'Falha ao sincronizar com o Spy.' })
    }

    return respond({ success: true, deduped: !!spyData?.deduped })
  } catch (error: any) {
    console.error('[sync-to-spy] Erro:', error?.message)
    return respond({ success: false, error: error?.message || 'Erro desconhecido.' })
  }
})
