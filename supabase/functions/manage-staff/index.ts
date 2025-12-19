
declare const Deno: any;
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey)

    // 1. Verificar se quem está chamando é um ADMIN
    const authHeader = req.headers.get('Authorization')!
    const { data: { user: requester }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''))

    if (authError || !requester) throw new Error("Não autenticado.")

    const { data: requesterProfile } = await supabaseAdmin
      .from('usuarios')
      .select('role')
      .eq('id', requester.id)
      .single()

    if (requesterProfile?.role !== 'ADMIN') {
      throw new Error("Apenas administradores podem gerenciar a equipe.")
    }

    // 2. Extrair dados da requisição
    const { action, userData } = await req.json()

    if (action === 'CREATE') {
      // Criar no Auth
      const { data: authUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true,
        user_metadata: { name: userData.name }
      })

      if (createError) throw createError

      // Criar na tabela de perfis (usuarios)
      const { error: profileError } = await supabaseAdmin.from('usuarios').insert({
        id: authUser.user.id,
        nome: userData.name,
        email: userData.email,
        role: userData.role,
        ativo: true,
        perm_view_agenda: userData.perm_view_agenda,
        perm_view_financial: userData.perm_view_financial,
        perm_view_crm: userData.perm_view_crm,
        perm_create_reservation: userData.perm_create_reservation,
        perm_edit_reservation: userData.perm_edit_reservation,
        perm_delete_reservation: userData.perm_delete_reservation,
        perm_edit_client: userData.perm_edit_client,
        perm_receive_payment: userData.perm_receive_payment,
        perm_create_reservation_no_contact: userData.perm_create_reservation_no_contact
      })

      if (profileError) {
        // Rollback: deletar o auth se o perfil falhar
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
        throw profileError
      }

      return new Response(JSON.stringify({ success: true, userId: authUser.user.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    if (action === 'UPDATE') {
      // Atualizar Auth se a senha foi enviada
      if (userData.password) {
        const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(userData.id, {
          password: userData.password
        })
        if (updateAuthError) throw updateAuthError
      }

      // Atualizar Perfil
      const { error: updateProfileError } = await supabaseAdmin.from('usuarios').update({
        nome: userData.name,
        email: userData.email,
        role: userData.role,
        perm_view_agenda: userData.perm_view_agenda,
        perm_view_financial: userData.perm_view_financial,
        perm_view_crm: userData.perm_view_crm,
        perm_create_reservation: userData.perm_create_reservation,
        perm_edit_reservation: userData.perm_edit_reservation,
        perm_delete_reservation: userData.perm_delete_reservation,
        perm_edit_client: userData.perm_edit_client,
        perm_receive_payment: userData.perm_receive_payment,
        perm_create_reservation_no_contact: userData.perm_create_reservation_no_contact
      }).eq('id', userData.id)

      if (updateProfileError) throw updateProfileError

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    if (action === 'DELETE') {
      // Deletar do Auth e da Tabela (Cascade deve estar on, mas fazemos manual por segurança)
      const { error: delAuthError } = await supabaseAdmin.auth.admin.deleteUser(userData.id)
      if (delAuthError) throw delAuthError

      const { error: delProfileError } = await supabaseAdmin.from('usuarios').delete().eq('id', userData.id)
      if (delProfileError) throw delProfileError

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    throw new Error("Ação inválida.")

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    })
  }
})
