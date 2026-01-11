
declare const Deno: any;
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

Deno.serve(async (req: Request) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    const { data: config } = await supabaseAdmin
      .from('configuracoes')
      .select('mercadopago_access_token, active_lanes')
      .limit(1)
      .maybeSingle();

    if (!config?.mercadopago_access_token) return new Response("Config missing", { status: 200 });

    const totalLanes = config.active_lanes || 6;
    const mpAccessToken = config.mercadopago_access_token.trim();
    
    const url = new URL(req.url);
    const idFromQuery = url.searchParams.get('id') || url.searchParams.get('data.id');
    
    let body: any = {};
    try {
        const text = await req.text();
        if (text) body = JSON.parse(text);
    } catch (e) { }

    const resourceId = idFromQuery || body?.data?.id || body?.id;

    if (!resourceId || ["123456", "123456789"].includes(resourceId)) {
        return new Response("Test OK", { status: 200 });
    }

    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${resourceId}`, {
      headers: { 'Authorization': `Bearer ${mpAccessToken}` }
    });

    if (!mpResponse.ok) return new Response("Done", { status: 200 });

    const payment = await mpResponse.json();
    const status = payment.status; 
    const reservationId = payment.external_reference;

    if (reservationId && status === 'approved') {
        const { data: res } = await supabaseAdmin
            .from('reservas')
            .select('*')
            .eq('id', reservationId)
            .single();
        
        if (!res) return new Response("Reserva não encontrada", { status: 200 });
        if (res.payment_status === 'Pago' || res.payment_status === 'Reembolsado') return new Response("Já processado", { status: 200 });

        const createdDate = new Date(res.created_at);
        const now = new Date();
        const diffMinutes = (now.getTime() - createdDate.getTime()) / 60000;

        let canConfirm = true;

        // --- VERIFICAÇÃO DE DISPONIBILIDADE SE PASSOU DE 35 MIN ---
        if (diffMinutes > 35) {
            const { data: others } = await supabaseAdmin
                .from('reservas')
                .select('lane_count, time, duration')
                .eq('date', res.date)
                .in('status', ['Confirmada', 'Check-in']);

            const startH = parseInt(res.time.split(':')[0]);
            const duration = Math.ceil(res.duration);
            
            for (let i = 0; i < duration; i++) {
                const currentCheckHour = startH + i;
                let occupiedLanes = 0;
                (others || []).forEach(other => {
                    const otherStart = parseInt(other.time.split(':')[0]);
                    const otherEnd = otherStart + Math.ceil(other.duration);
                    if (currentCheckHour >= otherStart && currentCheckHour < otherEnd) {
                        occupiedLanes += other.lane_count;
                    }
                });
                if (occupiedLanes + res.lane_count > totalLanes) {
                    canConfirm = false;
                    break;
                }
            }
        }

        if (canConfirm) {
            // CONFIRMAÇÃO NORMAL
            const mpPaymentType = payment.payment_type_id;
            let finalMethod = 'ONLINE';
            if (mpPaymentType === 'bank_transfer') finalMethod = 'PIX';
            else if (mpPaymentType === 'credit_card') finalMethod = 'CREDITO';
            else if (mpPaymentType === 'debit_card') finalMethod = 'DEBITO';

            await supabaseAdmin
                .from('reservas')
                .update({ 
                    status: 'Confirmada', 
                    payment_status: 'Pago',
                    payment_method: finalMethod,
                    observations: (res.observations || '') + (diffMinutes > 35 ? ` [PAGO COM ATRASO - VAGA LIVRE]` : '')
                })
                .eq('id', reservationId);
        } else {
            // --- ESTORNO AUTOMÁTICO POR FALTA DE VAGA ---
            console.log(`[ESTORNO] Iniciando reembolso para ${reservationId} devido a pagamento atrasado sem vagas.`);
            
            const refundResponse = await fetch(`https://api.mercadopago.com/v1/payments/${resourceId}/refunds`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${mpAccessToken}`, 'Content-Type': 'application/json' }
            });

            if (refundResponse.ok) {
                await supabaseAdmin
                    .from('reservas')
                    .update({ 
                        status: 'Cancelada', 
                        payment_status: 'Reembolsado',
                        observations: (res.observations || '') + ` [ESTORNO AUTOMÁTICO: Pagamento recebido aos ${Math.round(diffMinutes)}min, mas a vaga já estava ocupada por outro cliente.]`
                    })
                    .eq('id', reservationId);
                console.log(`[ESTORNO SUCESSO] Pagamento ${resourceId} devolvido.`);
            } else {
                // Se o estorno falhar por algum motivo da API, avisamos no banco para ação manual
                await supabaseAdmin
                    .from('reservas')
                    .update({ 
                        status: 'Cancelada', 
                        payment_status: 'Pendente Estorno',
                        observations: (res.observations || '') + ` [ERRO NO ESTORNO AUTO] Realizar devolução manual no Mercado Pago (Atraso de ${Math.round(diffMinutes)}min).`
                    })
                    .eq('id', reservationId);
            }
        }
    }
    return new Response("OK", { status: 200 });
  } catch (error: any) {
    return new Response("Error", { status: 200 }); 
  }
})
