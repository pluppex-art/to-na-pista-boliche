
declare const Deno: any;
// @ts-expect-error Deno resolves HTTPS imports at runtime.
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

const INTERACTION_TYPE_LABEL: Record<string, string> = {
  CALL: 'Ligação', WHATSAPP: 'WhatsApp', EMAIL: 'E-mail',
  MEETING: 'Reunião', NOTE: 'Nota', SURVEY: 'Pesquisa de Satisfação',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const respond = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status,
    })

  try {
    const {
      reservationId, clientId, interactionId, evaluationId, suggestionId, financeEntryId,
    } = await req.json()
    if (!reservationId && !clientId && !interactionId && !evaluationId && !suggestionId && !financeEntryId) {
      return respond({ success: false, error: 'Informe reservationId, clientId, interactionId, evaluationId, suggestionId ou financeEntryId.' }, 400)
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

    const postToSpy = async (path: string, body: Record<string, unknown>) => {
      const r = await fetch(`${spyApiUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': spyApiKey },
        body: JSON.stringify(body),
      })
      const data = await r.json().catch(() => ({}))
      return { ok: r.ok, status: r.status, data }
    }

    // ── Lançamento financeiro (faturamento_historico) ──────────────────────
    // Essa tabela nunca é escrita pelo app (só lida em Financeiro.tsx) — é
    // alimentada por fechamento manual/externo. Por isso o "gatilho ao vivo"
    // aqui vem de um trigger de banco (pg_net), não de uma chamada fire-and-
    // forget no front, mas a lógica de sincronização fica centralizada aqui
    // como as demais.
    if (financeEntryId) {
      const { data: row, error } = await supabaseAdmin
        .from('faturamento_historico').select('*').eq('id', financeEntryId).single()
      if (error || !row) throw new Error('Lançamento de faturamento histórico não encontrado.')

      const mes = String(row.mes).padStart(2, '0')
      const { ok, data } = await postToSpy('/api/v1/finance-entries', {
        externalId: row.id,
        description: `Faturamento histórico ${mes}/${row.ano}`,
        value: row.valor_arrecadado ?? 0,
        date: `${row.ano}-${mes}-01`,
        category: 'Faturamento Histórico',
        type: 'Receber',
        status: 'Pago',
      })
      if (!ok) { console.error('[sync-to-spy] Spy recusou finance-entry:', data); return respond({ success: false, error: data?.error || 'Falha ao sincronizar lançamento.' }) }
      return respond({ success: true, deduped: !!data?.deduped })
    }

    // ── Interações / Avaliações / Sugestões → lead_activities do Spy ───────
    if (interactionId || evaluationId || suggestionId) {
      let clienteId: string | null = null
      let activity: { type: string; title: string; description: string; date: string; seller: string; externalId: string } | null = null

      if (interactionId) {
        const { data: row, error } = await supabaseAdmin
          .from('interacoes').select('*, clientes(name, email, phone)').eq('id', interactionId).single()
        if (error || !row) throw new Error('Interação não encontrada.')
        clienteId = row.client_id
        const typeLabel = INTERACTION_TYPE_LABEL[row.type] || row.type || 'Interação'
        const extra = [
          row.nps_score != null ? `NPS: ${row.nps_score}` : null,
          row.satisfaction_level ? `Satisfação: ${row.satisfaction_level}` : null,
        ].filter(Boolean).join(' · ')
        activity = {
          type: typeLabel, title: `${typeLabel} (To Na Pista)`,
          description: [row.content, extra].filter(Boolean).join('\n') || '(sem conteúdo registrado)',
          date: (row.created_at || new Date().toISOString()).slice(0, 10),
          seller: row.user_name || '', externalId: `interacao_${row.id}`,
        }
      } else if (evaluationId) {
        const { data: row, error } = await supabaseAdmin
          .from('avaliacoes').select('*, clientes(name, email, phone)').eq('id', evaluationId).single()
        if (error || !row) throw new Error('Avaliação não encontrada.')
        clienteId = row.cliente_id
        activity = {
          type: 'Pesquisa de Satisfação', title: 'Avaliação de satisfação (To Na Pista)',
          description: `Nota: ${row.nota ?? '-'}/5${row.comentario ? ' — ' + row.comentario : ''}`,
          date: (row.created_at || new Date().toISOString()).slice(0, 10),
          seller: '', externalId: `avaliacao_${row.id}`,
        }
      } else if (suggestionId) {
        const { data: row, error } = await supabaseAdmin
          .from('sugestoes').select('*, clientes(name, email, phone)').eq('id', suggestionId).single()
        if (error || !row) throw new Error('Sugestão não encontrada.')
        clienteId = row.cliente_id
        activity = {
          type: 'Sugestão', title: row.titulo || 'Sugestão de cliente (To Na Pista)',
          description: row.descricao || '(sem descrição)',
          date: (row.created_at || new Date().toISOString()).slice(0, 10),
          seller: '', externalId: `sugestao_${row.id}`,
        }
      }

      if (!clienteId || !activity) return respond({ skipped: true, reason: 'Registro sem cliente associado.' })
      const { data: cliente } = await supabaseAdmin.from('clientes').select('name, email, phone').eq('client_id', clienteId).single()
      const phone = cliente?.phone || ''
      const email = cliente?.email || ''
      if (!phone && !email) return respond({ skipped: true, reason: 'Cliente sem telefone e sem e-mail.' })

      const { ok, data } = await postToSpy('/api/v1/lead-activities', { phone, email, ...activity })
      if (!ok) { console.error('[sync-to-spy] Spy recusou lead-activity:', data); return respond({ success: false, error: data?.error || 'Falha ao sincronizar atividade.' }) }
      return respond({ success: true, deduped: !!data?.deduped, skipped: !!data?.skipped })
    }

    // ── Reserva ou cliente → POST /api/v1/leads (cria e mantém atualizado) ─
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

      // Receita no Spy sempre reflete o estado ATUAL da reserva — não
      // depende de a reserva ter contato (telefone/e-mail) pra existir, e
      // é um upsert determinístico por reservationId (tnp_fat_<id> no
      // Spy), então repetir a chamada (retry, novo update) nunca duplica.
      // Isso também resolve retratação automática: se a reserva vira
      // Cancelada/Reembolsada depois de já ter gerado receita, o valor aqui
      // cai pra 0 e ZERA o lançamento anterior — sem precisar de nenhuma
      // reconciliação manual.
      const qualifica = ['Check-in', 'Confirmada'].includes(reserva.status) && reserva.payment_status === 'Pago'
      const clienteNome = cliente.name || reserva.client_name || 'Cliente'
      const { ok: finOk, data: finData } = await postToSpy('/api/v1/finance-entries', {
        externalId: reserva.id,
        description: `Reserva de Boliche: Reserva de Boliche${reserva.event_type ? ' - ' + reserva.event_type : ''} (${clienteNome})`,
        value: qualifica ? reserva.total_value : 0,
        date: reserva.date,
        category: 'Reservas - Boliche',
        type: 'Receber',
        status: 'Pago',
      })
      if (!finOk) console.error('[sync-to-spy] Spy recusou finance-entry da reserva:', finData)
    } else {
      const { data: clienteRow, error: clienteError } = await supabaseAdmin
        .from('clientes')
        .select('name, email, phone, document, company, address, birth_date, tags, funnel_stage, loyalty_balance')
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

    // Perfil completo do cliente (Clientes.tsx) — só existe quando a chamada
    // veio de clientId (reserva usa customFields.reservation, que já traz o
    // que interessa do agendamento em si).
    const clienteProfile = !reservationPayload ? {
      address: cliente.address || '', birthDate: cliente.birth_date || '',
      tags: cliente.tags || [], funnelStage: cliente.funnel_stage || '',
      loyaltyBalance: cliente.loyalty_balance || 0,
    } : undefined

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
          : { origin: 'to-na-pista', clienteProfile },
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
