
declare const Deno: any;
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

Deno.serve(async (req: Request) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    // 1. Busca as credenciais
    const { data: config, error: configError } = await supabaseAdmin
      .from('configuracoes')
      .select('mercadopago_access_token')
      .limit(1)
      .maybeSingle();

    if (configError || !config?.mercadopago_access_token) {
      console.error("[WEBHOOK ERROR] Credenciais não encontradas");
      return new Response("Config missing", { status: 200 });
    }

    const mpAccessToken = config.mercadopago_access_token.trim();

    // 2. Extrair ID e Topic
    const url = new URL(req.url);
    const idFromQuery = url.searchParams.get('id') || url.searchParams.get('data.id');
    const topic = url.searchParams.get('topic') || url.searchParams.get('type');
    
    let body: any = {};
    try {
        const text = await req.text();
        if (text) body = JSON.parse(text);
    } catch (e) { }

    const resourceId = idFromQuery || body?.data?.id || body?.id;

    // Se for uma notificação de teste do Mercado Pago (IDs genéricos)
    if (!resourceId || resourceId === "123456" || resourceId === "123456789") {
        console.log(`[WEBHOOK] Notificação de teste recebida (ID: ${resourceId}). Ignorando.`);
        return new Response("Test OK", { status: 200 });
    }

    // Só processamos se o tópico for relacionado a pagamento
    const finalTopic = topic || body?.type || body?.topic;
    if (finalTopic && finalTopic !== 'payment' && finalTopic !== 'payment.created' && finalTopic !== 'payment.updated') {
        return new Response("Topic ignored", { status: 200 });
    }

    // 3. Consultar o status REAL no Mercado Pago
    console.log(`[WEBHOOK] Consultando pagamento ${resourceId}...`);
    
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${resourceId}`, {
      headers: { 
          'Authorization': `Bearer ${mpAccessToken}`,
          'Content-Type': 'application/json'
      }
    });

    if (!mpResponse.ok) {
        if (mpResponse.status === 404) console.log(`[WEBHOOK] Pagamento ${resourceId} não encontrado (teste?).`);
        return new Response("Done", { status: 200 });
    }

    const payment = await mpResponse.json();
    const status = payment.status; 
    const reservationId = payment.external_reference;
    
    // --- LÓGICA DE IDENTIFICAÇÃO DO MEIO ---
    const mpPaymentType = payment.payment_type_id; // credit_card, debit_card, bank_transfer, ticket
    let finalMethod = 'ONLINE';

    if (mpPaymentType === 'bank_transfer') finalMethod = 'PIX';
    else if (mpPaymentType === 'credit_card') finalMethod = 'CREDITO';
    else if (mpPaymentType === 'debit_card') finalMethod = 'DEBITO';

    console.log(`[WEBHOOK] Resultado MP -> ID: ${resourceId} | Status: ${status} | Meio: ${finalMethod} | Ref: ${reservationId}`);

    // 4. Se aprovado, atualiza a reserva
    if (reservationId && status === 'approved') {
        // Verifica se a reserva já não está paga para evitar processamento duplicado
        const { data: currentRes } = await supabaseAdmin
            .from('reservas')
            .select('payment_status')
            .eq('id', reservationId)
            .maybeSingle();
        
        if (currentRes && currentRes.payment_status === 'Pago') {
            console.log(`[WEBHOOK] Reserva ${reservationId} já está paga. Ignorando.`);
        } else {
            await supabaseAdmin
                .from('reservas')
                .update({ 
                    status: 'Confirmada', 
                    payment_status: 'Pago',
                    payment_method: finalMethod // SALVA O MEIO ESPECÍFICO AQUI
                })
                .eq('id', reservationId);
            
            console.log("[WEBHOOK] Reserva confirmada com sucesso.");
        }
    }

    return new Response("OK", { status: 200 });

  } catch (error: any) {
    console.error("[WEBHOOK CRITICAL ERROR]", error.message);
    return new Response("Internal Error", { status: 200 }); 
  }
})
