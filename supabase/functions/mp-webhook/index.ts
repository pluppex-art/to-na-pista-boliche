
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
        console.log(`[WEBHOOK] Notificação de teste recebida (ID: ${resourceId}). Ignorando com sucesso.`);
        return new Response("Test OK", { status: 200 });
    }

    // Só processamos se o tópico for 'payment'
    const finalTopic = topic || body?.type || body?.topic;
    if (finalTopic && finalTopic !== 'payment' && finalTopic !== 'payment.created' && finalTopic !== 'payment.updated') {
        console.log(`[WEBHOOK] Tópico irrelevante (${finalTopic}). Ignorando.`);
        return new Response("Topic ignored", { status: 200 });
    }

    // 3. Consultar o status REAL no Mercado Pago
    console.log(`[WEBHOOK] Consultando pagamento ${resourceId} no MP...`);
    
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${resourceId}`, {
      headers: { 
          'Authorization': `Bearer ${mpAccessToken}`,
          'Content-Type': 'application/json'
      }
    });

    if (!mpResponse.ok) {
        const errData = await mpResponse.json();
        // Se for 404, o MP enviou um ID que ele mesmo não reconhece (comum em testes de dashboard)
        if (mpResponse.status === 404) {
            console.log(`[WEBHOOK] Pagamento ${resourceId} não encontrado no MP (Pode ser um teste). Finalizando.`);
        } else {
            console.error(`[WEBHOOK] Erro na API do MP:`, JSON.stringify(errData));
        }
        return new Response("Done", { status: 200 });
    }

    const payment = await mpResponse.json();
    const status = payment.status; 
    const reservationId = payment.external_reference;

    console.log(`[WEBHOOK] Resultado MP -> ID: ${resourceId} | Status: ${status} | Ref: ${reservationId}`);

    // 4. Se aprovado, atualiza a reserva
    if (reservationId && status === 'approved') {
        // Verifica se a reserva já não está paga para evitar processamento duplicado
        const { data: currentRes } = await supabaseAdmin.from('reservas').select('payment_status').eq('id', reservationId).maybeSingle();
        
        if (currentRes && currentRes.payment_status === 'Pago') {
            console.log(`[WEBHOOK] Reserva ${reservationId} já consta como Paga. Nada a fazer.`);
        } else {
            console.log(`[WEBHOOK] Pagamento Aprovado! Confirmando reserva ${reservationId}`);
            await supabaseAdmin
                .from('reservas')
                .update({ status: 'Confirmada', payment_status: 'Pago' })
                .eq('id', reservationId);
            
            console.log("[WEBHOOK] Reserva atualizada com sucesso.");
        }
    }

    return new Response("OK", { status: 200 });

  } catch (error: any) {
    console.error("[WEBHOOK CRITICAL ERROR]", error.message);
    return new Response("Internal Error", { status: 200 }); 
  }
})
