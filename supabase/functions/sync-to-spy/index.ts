
declare const Deno: any;
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Funil "Reservas To Na Pista" (crm_funis.id = tnp-reservas), criado no Spy
// pra esse tenant. IMPORTANTE: o front-end do Spy (usePipeline.ts) só
// reconhece pipelineId "comercial" ou "sdr" — qualquer outro valor nunca
// aparece no Kanban. Funis "comercial" extras (como este) são diferenciados
// só pelo stageId, calculado como `${funilId}-${índice na lista de etapas}`
// (0-indexed) — não pelo id que a tabela crm_pipeline_stages guarda pra cada
// etapa (esse id não é lido pelo front pra esse fim).
const SPY_PIPELINE_ID = 'comercial'
function stageForReservationStatus(status: string | null | undefined): string {
  const s = (status || '').toLowerCase()
  // Ordem das etapas em crm_funis.etapas: Agendado(0), Confirmado(1), Compareceu(2), Cancelado(3), Não Compareceu(4)
  if (s.includes('cancel')) return 'tnp-reservas-3'
  if (s.includes('no-show') || s.includes('no show') || s.includes('não compare') || s.includes('nao compare')) return 'tnp-reservas-4'
  if (s.includes('check')) return 'tnp-reservas-2'
  if (s.includes('confirmad')) return 'tnp-reservas-1'
  return 'tnp-reservas-0'
}

// Status do lead no funil de vendas do Spy (campo "status", separado do
// stageId/Kanban) — é o que alimenta Win Rate e os relatórios ("Fechado"
// conta como ganho em Dashboard.tsx, Leads.tsx, RelatoriosExecutivos.tsx
// etc). Reserva confirmada ou já realizada (compareceu) é negócio fechado;
// cancelada/no-show é perdido; o resto continua em aberto.
function leadStatusForReservationStatus(status: string | null | undefined): string {
  const s = (status || '').toLowerCase()
  if (s.includes('cancel') || s.includes('no-show') || s.includes('no show')
    || s.includes('não compare') || s.includes('nao compare')) return 'Perdido'
  if (s.includes('confirmad') || s.includes('check')) return 'Fechado'
  return 'Novo'
}

// Catálogo "Pista de Boliche" (products), criado no Spy pra esse tenant —
// preço por pista/hora varia entre dia útil e fim de semana.
const PRODUCT_DIA_UTIL = 'e9aafbbc-3415-4d30-961a-c1741ebd1ac3'
const PRODUCT_FIM_DE_SEMANA = 'b8d14def-f3ee-4e9d-929b-0e1a36b81d3f'
function productForDate(dateStr: string | null | undefined): string[] {
  if (!dateStr) return []
  const day = new Date(`${dateStr}T00:00:00`).getUTCDay() // 0=domingo, 6=sábado
  return [day === 0 || day === 6 ? PRODUCT_FIM_DE_SEMANA : PRODUCT_DIA_UTIL]
}

// Sincroniza um cliente ou uma reserva com o CRM Spy (best-effort). Nunca deve
// derrubar o fluxo do usuário — qualquer falha aqui é logada e respondida com
// 200, porque quem chama (mockBackend.ts) dispara isso em fire-and-forget
// depois que o registro já foi gravado com sucesso no to na pista.
//
// Aceita { reservationId } (reserva feita — Checkout/PublicBooking) ou
// { clientId } (cliente/lead cadastrado direto no CRM interno, sem reserva
// ainda). Nos dois casos cai no mesmo POST /api/v1/leads do Spy; a diferença
// é só se `customFields.reservation` vai preenchido ou não.
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const respond = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status,
    })

  try {
    const { reservationId, clientId } = await req.json()
    if (!reservationId && !clientId) {
      return respond({ success: false, error: 'Informe reservationId ou clientId.' }, 400)
    }

    const spyApiUrl = (Deno.env.get('SPY_API_URL') ?? '').replace(/\/$/, '')
    const spyApiKey = Deno.env.get('SPY_API_KEY') ?? ''
    if (!spyApiUrl || !spyApiKey) {
      console.warn('[sync-to-spy] SPY_API_URL/SPY_API_KEY não configurados — sync ignorado.')
      return respond({ skipped: true, reason: 'Integração com Spy não configurada neste ambiente.' })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey)

    let cliente: any = {}
    let reservationPayload: Record<string, unknown> | null = null
    let source = 'To Na Pista - Cadastro CRM'

    if (reservationId) {
      const { data: reserva, error: reservaError } = await supabaseAdmin
        .from('reservas')
        .select('*, clientes(name, email, phone, document, company)')
        .eq('id', reservationId)
        .single()
      if (reservaError || !reserva) throw new Error('Reserva não encontrada.')

      cliente = reserva.clientes || { name: reserva.client_name }
      source = 'To Na Pista - Agendamento'
      reservationPayload = {
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
    } else {
      const { data: clienteRow, error: clienteError } = await supabaseAdmin
        .from('clientes')
        .select('name, email, phone, document, company')
        .eq('client_id', clientId)
        .single()
      if (clienteError || !clienteRow) throw new Error('Cliente não encontrado.')
      cliente = clienteRow
    }

    const name = cliente.name || 'Cliente'
    const phone = cliente.phone || ''
    const email = cliente.email || ''

    if (!phone && !email) {
      return respond({ skipped: true, reason: 'Cliente sem telefone e sem e-mail.' })
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
        source,
        status: reservationPayload ? leadStatusForReservationStatus(reservationPayload.status as string) : 'Novo',
        priority: 'Média',
        value: reservationPayload?.totalValue ?? 0,
        clientName: name,
        tenantName: 'To Na Pista Boliche',
        pipelineId: SPY_PIPELINE_ID,
        stageId: reservationPayload ? stageForReservationStatus(reservationPayload.status as string) : 'tnp-reservas-0',
        productIds: reservationPayload ? productForDate(reservationPayload.date as string) : [],
        customFields: reservationPayload
          ? { origin: 'to-na-pista', reservation: reservationPayload }
          : { origin: 'to-na-pista' },
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
