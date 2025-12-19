
declare const Deno: any;
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

Deno.serve(async (req: Request) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    // 1. Busca as credenciais de produção diretamente da sua tabela 'configuracoes'
    const { data: config, error: configError } = await supabaseAdmin
      .from('configuracoes')
      .select('mercadopago_access_token')
      .limit(1)
      .maybeSingle();

    if (configError || !config?.mercadopago_access_token) {
      console.error("[WEBHOOK ERROR] Credenciais não encontradas na tabela 'configuracoes'");
      return new Response("Config missing", { status: 200 });
    }

    const mpAccessToken = config.mercadopago_access_token.trim();

    // 2. Identificar o ID do Pagamento enviado pelo MP
    const url = new URL(req.url);
    const idFromQuery = url.searchParams.get('id') || url.searchParams.get('data.id');
    
    let body: any = {};
    try {
        const text = await req.text();
        if (text) body = JSON.parse(text);
    } catch (e) { /* corpo vazio */ }

    const resourceId = idFromQuery || body?.data?.id || body?.id;

    if (!resourceId) {
        console.log("[WEBHOOK] Notificação recebida sem ID de recurso. Ignorando.");
        return new Response("No ID", { status: 200 });
    }

    // 3. Consultar o status REAL do pagamento no Mercado Pago usando a chave do banco
    console.log(`[WEBHOOK] Consultando pagamento ${resourceId} no MP...`);
    
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${resourceId}`, {
      headers: { 
          'Authorization': `Bearer ${mpAccessToken}`,
          'Content-Type': 'application/json'
      }
    });

    if (!mpResponse.ok) {
        const errData = await mpResponse.json();
        console.error(`[WEBHOOK] Erro na API do MP:`, JSON.stringify(errData));
        return new Response("MP API Error", { status: 200 });
    }

    const payment = await mpResponse.json();
    const status = payment.status; 
    const reservationId = payment.external_reference;

    console.log(`[WEBHOOK] Resultado MP -> ID: ${resourceId} | Status: ${status} | Ref: ${reservationId}`);

    // 4. Se aprovado, atualiza a reserva
    if (reservationId && status === 'approved') {
        console.log(`[WEBHOOK] Pagamento Aprovado! Atualizando reserva ${reservationId}`);
        
        const { error: updateError } = await supabaseAdmin
            .from('reservas')
            .update({ 
                status: 'Confirmada', 
                payment_status: 'Pago' 
            })
            .eq('id', reservationId);
        
        if (updateError) {
            console.error("[WEBHOOK] Erro ao atualizar reserva:", updateError.message);
        } else {
            console.log("[WEBHOOK] Reserva atualizada com sucesso.");
            
            // Lógica de Fidelidade (Opcional)
            if (payment.transaction_amount && payment.payer?.email) {
                // Aqui você pode buscar o cliente pelo email ou ID e adicionar os pontos
            }
        }
    }

    return new Response("OK", { status: 200 });

  } catch (error: any) {
    console.error("[WEBHOOK CRITICAL ERROR]", error.message);
    return new Response("Internal Error", { status: 200 }); 
  }
})
