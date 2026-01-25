// Fix: Added Deno declaration to avoid TypeScript errors in Supabase Edge Functions environment
declare const Deno: any;
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const resendApiKey = Deno.env.get('RESEND_API_KEY') ?? ''

    const supabaseAdmin = createClient(supabaseUrl, supabaseKey)
    const payload = await req.json()
    const reservation = payload.record 

    if (reservation.payment_status !== 'Pago') {
      return new Response(JSON.stringify({ message: "Status não é Pago. Ignorado." }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: client } = await supabaseAdmin
      .from('clientes')
      .select('email, name')
      .eq('client_id', reservation.client_id)
      .single()

    // --- TRAVA DE SEGURANÇA: Identifica se não tem e-mail e para aqui ---
    if (!client?.email) {
      return new Response(JSON.stringify({ message: "Cliente não possui e-mail cadastrado. Envio cancelado." }), { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const firstName = client?.name.split(' ')[0] || 'Cliente'
    const dateFormatted = new Date(reservation.date + 'T12:00:00').toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'long', year: 'numeric'
    })
    
    const totalFormatted = new Intl.NumberFormat('pt-BR', { 
      style: 'currency', currency: 'BRL' 
    }).format(reservation.total_value || 0)

    // Helper para gerar linhas de tabela com espaçamento garantido
    const renderRow = (label: string, value: string, icon: string, isLast = false, isPrice = false) => `
      <tr>
        <td style="padding: 16px 0; border-bottom: ${isLast ? 'none' : '1px solid rgba(51, 65, 85, 0.5)'};">
          <span style="color: #64748b; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">${icon} ${label}</span>
        </td>
        <td style="padding: 16px 0; border-bottom: ${isLast ? 'none' : '1px solid rgba(51, 65, 85, 0.5)'}; text-align: right;">
          <strong style="color: ${isPrice ? '#22c55e' : '#ffffff'}; font-size: ${isPrice ? '20px' : '15px'}; font-weight: ${isPrice ? '900' : '700'};">${value}</strong>
        </td>
      </tr>
    `;

    // Lógica para campos condicionais
    const birthdayRow = reservation.event_type === 'Aniversário' 
      ? renderRow("Tipo de Reserva", `Aniversário - ${reservation.birthday_name || 'Não informado'}`, "🎂")
      : renderRow("Tipo de Jogo", reservation.event_type || "Normal", "🎳");

    const tableRow = reservation.has_table_reservation 
      ? renderRow("Mesa/Cadeiras", `Sim - ${reservation.table_seat_count || 0} lugares`, "🪑")
      : '';

    const observationBlock = reservation.observations ? `
      <div style="margin-top: 20px; padding: 15px; background: rgba(2, 6, 23, 0.4); border-radius: 12px; border-left: 4px solid #334155;">
        <p style="margin: 0 0 5px 0; color: #64748b; font-size: 10px; font-weight: 800; text-transform: uppercase;">📝 Observação:</p>
        <p style="margin: 0; color: #e2e8f0; font-size: 13px; font-style: italic; line-height: 1.4;">"${reservation.observations}"</p>
      </div>
    ` : '';

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendApiKey}` },
      body: JSON.stringify({
        from: 'Tô Na Pista <vendas@tonapistaboliche.com.br>',
        to: [client.email],
        subject: `🎳 Reserva Confirmada! Tudo pronto para o seu Strike, ${firstName}!`,
        html: `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"></head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: sans-serif;">
  <div style="width: 100%; background-color: #ffffff; padding: 40px 0;">
    <div style="max-width: 600px; margin: 0 auto; background-color: #0f172a; border-radius: 32px; overflow: hidden; border: 1px solid #1e293b;">
      
      <div style="padding: 40px 20px; text-align: center; background: linear-gradient(180deg, #020617 0%, #0f172a 100%);">
        <div style="margin: 0 auto 30px auto; max-width: 200px;">
        <img src="https://drive.google.com/uc?export=view&id=13aPXLCPgWvDhavpvhqeMPE7sG8Q2L-9o" 
            alt="Tô Na Pista Boliche" 
            style="width: 100%; height: auto; display: block; margin: 0 auto;">
        </div>

        <div style="display: inline-block; background-color: rgba(34, 197, 94, 0.1); color: #22c55e; padding: 8px 20px; border-radius: 100px; font-size: 12px; font-weight: 800; text-transform: uppercase; border: 1px solid rgba(34, 197, 94, 0.2); margin-bottom: 24px;">
        ✓ Pagamento Confirmado
        </div>

        <h1 style="color: #ffffff; font-size: 32px; margin: 0 0 16px 0; letter-spacing: -1px; font-weight: 900; line-height: 1.2;">
        Sua diversão está garantida, ${firstName}!
        </h1>

        <p style="color: #94a3b8; font-size: 16px; margin: 0; line-height: 1.6; max-width: 480px; margin: 0 auto;">
        Prepare o braço e o apetite! Sua reserva foi confirmada e já estamos deixando tudo pronto para você e seus convidados.
        </p>
      </div>

      <div style="background-color: #1e293b; border-radius: 24px; padding: 32px; margin: 0 40px 32px 40px; border: 1px solid #334155;">
        <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
          ${renderRow("Data do Jogo", dateFormatted, "📅")}
          ${renderRow("Horário", reservation.time, "⏰")}
          ${renderRow("Pistas", String(reservation.lane_count), "🎳")}
          ${renderRow("Jogadores", String(reservation.people_count), "👥")}
          ${birthdayRow}
          ${tableRow}
          ${renderRow("Valor Pago", totalFormatted, "💰", true, true)}
        </table>
        ${observationBlock}
      </div>

      <div style="text-align: center; padding: 0 40px 48px 40px;">
        <a href="https://tonapistaboliche.com.br/#/minha-conta" style="background-color: #f97316; color: #ffffff; padding: 22px 40px; text-decoration: none; border-radius: 20px; font-weight: 900; font-size: 14px; display: inline-block; text-transform: uppercase; letter-spacing: 1px;">📱 ACESSAR MINHAS RESERVAS</a>
        <p style="color: #475569; font-size: 11px; font-weight: 700; text-transform: uppercase; margin-top: 24px; letter-spacing: 1px;">⚠️ Recomendamos chegar com 15 min de antecedência</p>
      </div>

      <div style="background-color: #020617; padding: 40px; text-align: center; border-top: 1px solid #1e293b;">
        <p style="font-size: 13px; color: #64748b; line-height: 1.8; margin: 0;">
          <strong style="color: #f97316; font-size: 15px;">Tô Na Pista Boliche</strong><br><br>
          📍 Av. Juscelino Kubitschek, 103 Norte - Palmas, TO<br>
          📱 Suporte WhatsApp: (63) 99117-8242
        </p>
      </div>
    </div>
  </div>
</body>
</html>`
      }),
    })

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
