
declare const Deno: any;
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

Deno.serve(async (req: Request) => {
  try {
    // 1. Verificamos se é um POST (Mercado Pago envia notificações via POST)
    if (req.method !== 'POST') {
      return new Response("Method not allowed", { status: 405 });
    }

    // 2. Lemos o corpo como texto primeiro para evitar o erro de JSON vazio
    const text = await req.text();
    if (!text || text.trim() === "") {
      console.log("[WEBHOOK] Recebida requisição vazia (provavelmente teste de conexão).");
      return new Response("Empty body received", { status: 200 });
    }

    // 3. Tentamos converter para JSON
    let body;
    try {
      body = JSON.parse(text);
    } catch (e) {
      console.error("[WEBHOOK] Erro ao processar JSON:", e.message);
      return new Response("Invalid JSON", { status: 200 }); // Retornamos 200 para o MP parar de tentar
    }

    const { action, type, data } = body;
    const resourceId = data?.id || body.id;

    console.log(`[WEBHOOK] Evento: ${action || type} | ID: ${resourceId}`);

    // Só processamos eventos de pagamento
    if (type !== 'payment' && action !== 'payment.created' && action !== 'payment.updated') {
        return new Response("Ignored non-payment event", { status: 200 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const mpAccessToken = (Deno.env.get('MP_ACCESS_TOKEN') ?? '').trim();

    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // Consulta o status real no Mercado Pago para evitar fraudes
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${resourceId}`, {
      headers: { 'Authorization': `Bearer ${mpAccessToken}` }
    });

    if (!mpResponse.ok) {
        const errorData = await mpResponse.json();
        console.error("[WEBHOOK] Erro ao consultar MP:", errorData);
        throw new Error("Falha ao consultar pagamento no MP");
    }

    const payment = await mpResponse.json();
    const status = payment.status;
    const reservationId = payment.external_reference;

    console.log(`[WEBHOOK] Pagamento ${resourceId}: Status ${status} | Reserva ${reservationId}`);

    if (reservationId && status === 'approved') {
        const { error } = await supabaseClient
            .from('reservas')
            .update({ 
                status: 'Confirmada', 
                payment_status: 'Pago' 
            })
            .eq('id', reservationId);
        
        if (error) {
            console.error("[DB_UPDATE_ERROR]", error);
        } else {
            console.log(`[WEBHOOK] Reserva ${reservationId} confirmada com sucesso!`);
        }
    }

    return new Response("OK", { status: 200 });

  } catch (error: any) {
    console.error("[WEBHOOK_CRITICAL_ERROR]", error.message);
    // Retornamos 200 para o Mercado Pago não ficar repetindo o erro nos logs
    return new Response(`Error: ${error.message}`, { status: 200 }); 
  }
})
