// Migração única: envia todas as reservas já existentes no to na pista pro CRM
// Spy, uma a uma, em ordem cronológica (mais antiga primeiro) — o endpoint
// POST /api/v1/leads do Spy deduplica por telefone/e-mail dentro do tenant e
// acumula cada reserva no histórico do lead (ver server.ts do Axis), então o
// resultado final é um lead por cliente com o histórico completo de reservas.
//
// Uso:
//   SPY_API_URL="https://www.spycrm.com.br" \
//   SPY_API_KEY="spy_sk_..." \
//   node scripts/migrate-reservations-to-spy.mjs
//
// Lê `reservas`/`clientes` do to na pista com a chave pública (mesma usada pelo
// frontend — não precisa de service_role). Respeita o rate limit do Spy
// (60 req/min) com folga, é resumível (grava um checkpoint local) e loga falhas
// num arquivo separado pra reprocessar só o que deu erro.

import { writeFileSync, readFileSync, existsSync } from 'fs';

const SUPABASE_URL = 'https://rmirkhebjgvsqqenszts.supabase.co';
const SUPABASE_KEY = 'sb_publishable_h9bKTMYVO5RvO5eBQZTsNQ_zyZBQCc3';
const SPY_API_URL = (process.env.SPY_API_URL || '').replace(/\/$/, '');
const SPY_API_KEY = process.env.SPY_API_KEY || '';

if (!SPY_API_URL || !SPY_API_KEY) {
  console.error('Defina SPY_API_URL e SPY_API_KEY como variáveis de ambiente antes de rodar.');
  process.exit(1);
}

const DELAY_MS = 1400; // ~43 req/min, com folga sob o limite de 60/min do Axis
const CHECKPOINT_FILE = new URL('./.migrate-to-spy-checkpoint.json', import.meta.url);
const FAILURES_FILE = new URL('./.migrate-to-spy-failures.json', import.meta.url);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// fetch puro contra o REST/PostgREST do Supabase — evita depender de
// @supabase/supabase-js estar instalado (node_modules não existe neste
// checkout). Mesma chave pública que o frontend já usa.
async function supabaseSelect(table, params) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${params}`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase REST ${res.status}: ${await res.text()}`);
  return res.json();
}

function loadCheckpoint() {
  if (!existsSync(CHECKPOINT_FILE)) return { doneIds: [] };
  try { return JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf-8')); } catch { return { doneIds: [] }; }
}

function saveCheckpoint(state) {
  writeFileSync(CHECKPOINT_FILE, JSON.stringify(state));
}

function logFailure(reservationId, reason) {
  const failures = existsSync(FAILURES_FILE) ? JSON.parse(readFileSync(FAILURES_FILE, 'utf-8')) : [];
  failures.push({ reservationId, reason, at: new Date().toISOString() });
  writeFileSync(FAILURES_FILE, JSON.stringify(failures, null, 2));
}

async function fetchAllReservas() {
  let all = [];
  let from = 0;
  const step = 1000;
  const select = encodeURIComponent(
    'id,client_name,date,time,people_count,lane_count,duration,total_value,event_type,status,payment_status,created_at,clientes(name,email,phone,document,company)'
  );
  while (true) {
    const data = await supabaseSelect(
      'reservas',
      `select=${select}&order=created_at.asc&limit=${step}&offset=${from}`
    );
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < step) break;
    from += step;
  }
  return all;
}

// Funil "Reservas To Na Pista" (crm_funis.id = tnp-reservas). O front-end do
// Spy só reconhece pipelineId "comercial"/"sdr" pro filtro do Kanban — funis
// extras diferenciam-se só pelo stageId `${funilId}-${índice na lista de
// etapas}` (0-indexed), não pelo id salvo em crm_pipeline_stages.
const SPY_PIPELINE_ID = 'comercial';
function stageForReservationStatus(status) {
  const s = (status || '').toLowerCase();
  // Agendado(0), Confirmado(1), Compareceu(2), Cancelado(3), Não Compareceu(4)
  if (s.includes('cancel')) return 'tnp-reservas-3';
  if (s.includes('no-show') || s.includes('no show') || s.includes('não compare') || s.includes('nao compare')) return 'tnp-reservas-4';
  if (s.includes('check')) return 'tnp-reservas-2';
  if (s.includes('confirmad')) return 'tnp-reservas-1';
  return 'tnp-reservas-0';
}

// Status do lead no funil de vendas (campo "status", separado do stageId) —
// alimenta Win Rate e relatórios ("Fechado" = ganho). Confirmada/Compareceu
// vira negócio fechado; cancelada/no-show vira perdido.
function leadStatusForReservationStatus(status) {
  const s = (status || '').toLowerCase();
  if (s.includes('cancel') || s.includes('no-show') || s.includes('no show')
    || s.includes('não compare') || s.includes('nao compare')) return 'Perdido';
  if (s.includes('confirmad') || s.includes('check')) return 'Fechado';
  return 'Novo';
}

// Catálogo "Pista de Boliche" (products) — preço por pista/hora varia entre
// dia útil e fim de semana.
const PRODUCT_DIA_UTIL = 'e9aafbbc-3415-4d30-961a-c1741ebd1ac3';
const PRODUCT_FIM_DE_SEMANA = 'b8d14def-f3ee-4e9d-929b-0e1a36b81d3f';
function productForDate(dateStr) {
  if (!dateStr) return [];
  const day = new Date(`${dateStr}T00:00:00`).getUTCDay();
  return [day === 0 || day === 6 ? PRODUCT_FIM_DE_SEMANA : PRODUCT_DIA_UTIL];
}

async function syncOne(reserva) {
  const cliente = reserva.clientes || {};
  const name = cliente.name || reserva.client_name || 'Cliente';
  const phone = cliente.phone || '';
  const email = cliente.email || '';
  if (!phone && !email) return { skipped: true, reason: 'sem telefone/e-mail' };

  const body = {
    name,
    email,
    phone,
    cnpj: cliente.document || '',
    company: cliente.company || '',
    source: 'To Na Pista - Migração histórica',
    status: leadStatusForReservationStatus(reserva.status),
    priority: 'Média',
    value: reserva.total_value,
    clientName: name,
    tenantName: 'To Na Pista Boliche',
    pipelineId: SPY_PIPELINE_ID,
    stageId: stageForReservationStatus(reserva.status),
    productIds: productForDate(reserva.date),
    customFields: {
      origin: 'to-na-pista',
      reservation: {
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
      },
    },
  };

  const res = await fetch(`${SPY_API_URL}/api/v1/leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': SPY_API_KEY },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${data?.error || 'erro desconhecido'}`);
  return { skipped: false, deduped: !!data.deduped };
}

async function main() {
  console.log('Buscando reservas no to na pista...');
  const reservas = await fetchAllReservas();
  console.log(`Total: ${reservas.length} reservas.`);

  const checkpoint = loadCheckpoint();
  const doneIds = new Set(checkpoint.doneIds);
  const pending = reservas.filter((r) => !doneIds.has(r.id));
  console.log(`Já sincronizadas (checkpoint anterior): ${doneIds.size}. Pendentes: ${pending.length}.`);
  if (pending.length === 0) { console.log('Nada a fazer.'); return; }

  const etaMin = Math.ceil((pending.length * DELAY_MS) / 60000);
  console.log(`Tempo estimado: ~${etaMin} min (${DELAY_MS}ms entre chamadas).`);

  let created = 0, updated = 0, skipped = 0, failed = 0;

  for (let i = 0; i < pending.length; i++) {
    const reserva = pending[i];
    try {
      const result = await syncOne(reserva);
      if (result.skipped) skipped++;
      else if (result.deduped) updated++;
      else created++;
    } catch (err) {
      failed++;
      logFailure(reserva.id, err.message);
      console.warn(`[${i + 1}/${pending.length}] Falhou reserva ${reserva.id}: ${err.message}`);
    }

    doneIds.add(reserva.id);
    if ((i + 1) % 50 === 0 || i === pending.length - 1) {
      saveCheckpoint({ doneIds: [...doneIds] });
      console.log(`[${i + 1}/${pending.length}] novos=${created} atualizados=${updated} pulados=${skipped} falhas=${failed}`);
    }

    if (i < pending.length - 1) await sleep(DELAY_MS);
  }

  console.log('\nConcluído.');
  console.log(`Leads novos: ${created} | Leads atualizados (dedup): ${updated} | Pulados (sem contato): ${skipped} | Falhas: ${failed}`);
  if (failed > 0) console.log(`Detalhe das falhas em: ${FAILURES_FILE.pathname}`);
}

main().catch((err) => {
  console.error('Erro fatal na migração:', err);
  process.exit(1);
});
