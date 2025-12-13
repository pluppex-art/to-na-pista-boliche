
import { AppSettings, Client, FunnelCard, Interaction, Reservation, User, ReservationStatus, PaymentStatus, UserRole, FunnelStage, LoyaltyTransaction, AuditLog, StaffPerformance } from '../types';
import { supabase } from './supabaseClient';
import { INITIAL_SETTINGS, FUNNEL_STAGES } from '../constants';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';

export const cleanPhone = (phone: string) => {
  if (!phone) return '';
  return phone.replace(/\D/g, ''); 
};

const safeTags = (tags: any): string[] => {
  if (Array.isArray(tags)) return tags;
  if (typeof tags === 'string') {
     return tags.includes(',') ? tags.split(',').map(t => t.trim()) : [tags];
  }
  return [];
};

export const db = {
  // --- SERVIÇO DE ADMINISTRAÇÃO E MIGRAÇÃO ---
  admin: {
      syncDatabaseIds: async (onProgress: (msg: string) => void) => {
          const tempSupabase = createClient(
              (supabase as any).supabaseUrl,
              (supabase as any).supabaseKey
          );

          try {
              // 1. SINCRONIZAR USUÁRIOS (STAFF)
              onProgress("Buscando usuários da equipe...");
              const { data: users } = await supabase.from('usuarios').select('*');
              
              if (users) {
                  for (const u of users) {
                      onProgress(`Processando Staff: ${u.nome}...`);
                      
                      const { data: authData, error: authError } = await (tempSupabase.auth as any).signUp({
                          email: u.email,
                          password: '123456', 
                          options: { data: { name: u.nome, role: u.role } }
                      });

                      let authId = authData?.user?.id;
                      
                      if (authId && authId !== u.id) {
                          onProgress(`🔄 Tentando corrigir ID de ${u.nome}...`);
                          
                          try {
                              const { error: rpcError } = await supabase.rpc('swap_user_id', {
                                  old_id: u.id,
                                  new_id: authId
                              });

                              if (rpcError) {
                                  if (rpcError.message.includes('function') && rpcError.message.includes('does not exist')) {
                                      throw new Error("RPC_MISSING");
                                  }
                                  onProgress(`❌ Erro SQL: ${rpcError.message}`);
                              } else {
                                  onProgress(`✅ ID de ${u.nome} atualizado!`);
                              }
                          } catch (rpcErr: any) {
                              if (rpcErr.message === 'RPC_MISSING') throw rpcErr;
                              console.error(rpcErr);
                          }
                      } else if (!authId && authError?.message?.includes('registered')) {
                          onProgress(`⚠️ ${u.nome} já existe no Auth. Use o Script SQL para forçar a sincronia.`);
                      }
                  }
              }

              onProgress("FINALIZADO. Se houver erros, use o Script SQL.");

          } catch (e: any) {
              if (e.message === 'RPC_MISSING') {
                  throw e; 
              }
              onProgress(`ERRO: ${e.message}`);
              console.error(e);
          }
      }
  },

  // --- SERVIÇO DE AUDITORIA ---
  audit: {
      log: async (userId: string, userName: string, actionType: string, details: string, entityId?: string) => {
          try {
              const { error } = await supabase.from('audit_logs').insert({
                  user_id: userId,
                  user_name: userName,
                  action_type: actionType,
                  details: details,
                  entity_id: entityId
              });
              if (error) console.warn("[AUDIT LOG ERROR]", error.message);
          } catch (e) {
              console.warn("[AUDIT LOG EXCEPTION]", e);
          }
      },
      getLogs: async (filters?: { userId?: string, actionType?: string, startDate?: string, endDate?: string, limit?: number }): Promise<AuditLog[]> => {
          let query = supabase
              .from('audit_logs')
              .select('*')
              .order('created_at', { ascending: false });
          
          if (filters?.userId && filters.userId !== 'ALL') {
              query = query.eq('user_id', filters.userId);
          }
          if (filters?.actionType && filters.actionType !== 'ALL') {
              query = query.eq('action_type', filters.actionType);
          }
          if (filters?.startDate) {
              query = query.gte('created_at', `${filters.startDate}T00:00:00`);
          }
          if (filters?.endDate) {
              query = query.lte('created_at', `${filters.endDate}T23:59:59`);
          }

          const { data, error } = await query.limit(filters?.limit || 100);
          
          if (error) {
              console.error("Erro ao buscar logs:", error);
              return [];
          }
          
          return data.map((l: any) => ({
              id: l.id,
              userId: l.user_id,
              userName: l.user_name || 'Sistema',
              actionType: l.action_type,
              entityId: l.entity_id,
              details: typeof l.details === 'object' ? JSON.stringify(l.details) : l.details,
              createdAt: l.created_at
          }));
      }
  },

  users: {
    login: async (email: string, password: string): Promise<{ user?: User; isFirstAccess?: boolean; error?: string; errorCode?: string }> => {
      try {
        const { data: authData, error: authError } = await (supabase.auth as any).signInWithPassword({
            email,
            password
        });

        if (authError) return { error: 'E-mail ou senha incorretos.' };
        if (!authData.user) return { error: 'Erro ao recuperar usuário.' };

        let { data: profileData, error: profileError } = await supabase
          .from('usuarios')
          .select('*')
          .eq('id', authData.user.id) 
          .maybeSingle();

        if (profileError?.message?.includes('infinite recursion')) {
            return { error: 'Erro crítico de configuração (Loop no Banco de Dados). Contate o suporte.' };
        }

        if ((!profileData) && email === 'admin@tonapista.com') {
            console.warn("Perfil Admin não encontrado. Tentando Auto-Cura...");
            const { data: oldProfile } = await supabase.from('usuarios').select('*').eq('email', email).maybeSingle();
            if (oldProfile) {
                await supabase.from('usuarios').delete().eq('id', oldProfile.id);
            }

            const adminPayload = {
                id: authData.user.id,
                nome: 'Admin Master',
                email: email,
                role: 'ADMIN',
                ativo: true,
                perm_view_agenda: true,
                perm_view_financial: true,
                perm_view_crm: true,
                perm_create_reservation: true,
                perm_edit_reservation: true,
                perm_delete_reservation: true,
                perm_edit_client: true,
                perm_receive_payment: true,
                perm_create_reservation_no_contact: true
            };

            const { error: insertError } = await supabase.from('usuarios').upsert(adminPayload);
            if (!insertError) {
                const retry = await supabase.from('usuarios').select('*').eq('id', authData.user.id).maybeSingle();
                profileData = retry.data;
            } else {
                return { error: `Falha na Auto-Cura Admin: ${insertError.message}` };
            }
        }

        if (!profileData) {
            const { data: mismatchData } = await supabase.from('usuarios').select('id').eq('email', email).maybeSingle();
            if (mismatchData) {
                await (supabase.auth as any).signOut();
                return { error: 'Sua conta precisa de sincronização de ID.', errorCode: 'ID_MISMATCH' };
            }
            const { data: clientData } = await supabase.from('clientes').select('client_id').eq('client_id', authData.user.id).maybeSingle();
            await (supabase.auth as any).signOut();
            if (clientData) {
                return { error: 'Esta conta é de Cliente. Por favor, use a aba "Sou Cliente".' };
            }
            return { error: 'Acesso negado. Perfil de equipe não encontrado.' };
        }

        if (profileData.ativo === false) {
             await (supabase.auth as any).signOut();
             return { error: 'Conta desativada. Contate o administrador.' };
        }

        const roleNormalized = (profileData.role || '').toUpperCase() as UserRole;
        const isAdmin = roleNormalized === UserRole.ADMIN;
        const isFirstAccess = password === '123456'; 

        db.audit.log(profileData.id, profileData.nome, 'LOGIN', 'Usuário realizou login');

        return {
            isFirstAccess,
            user: {
              id: profileData.id,
              name: profileData.nome,
              email: profileData.email,
              role: roleNormalized,
              passwordHash: '', 
              perm_view_agenda: isAdmin ? true : (profileData.perm_view_agenda ?? false),
              perm_view_financial: isAdmin ? true : (profileData.perm_view_financial ?? false),
              perm_view_crm: isAdmin ? true : (profileData.perm_view_crm ?? false),
              perm_create_reservation: isAdmin ? true : (profileData.perm_create_reservation ?? false),
              perm_edit_reservation: isAdmin ? true : (profileData.perm_edit_reservation ?? false),
              perm_delete_reservation: isAdmin ? true : (profileData.perm_delete_reservation ?? false),
              perm_edit_client: isAdmin ? true : (profileData.perm_edit_client ?? false),
              perm_receive_payment: isAdmin ? true : (profileData.perm_receive_payment ?? false),
              perm_create_reservation_no_contact: isAdmin ? true : (profileData.perm_create_reservation_no_contact ?? false),
              active: profileData.ativo ?? true
            }
        };

      } catch (err) {
        console.error(err);
        return { error: 'Erro inesperado no login.' };
      }
    },
    
    create: async (user: User) => {
      const tempSupabase = createClient(
          (supabase as any).supabaseUrl,
          (supabase as any).supabaseKey
      );
      const { data: authData, error: authError } = await (tempSupabase.auth as any).signUp({
          email: user.email,
          password: user.passwordHash || '123456', 
          options: { data: { name: user.name, role: user.role } }
      });
      if (authError) throw new Error(authError.message);
      if (!authData.user) throw new Error("Erro ao criar usuário no Auth.");

      const { error: profileError } = await supabase.from('usuarios').upsert({
        id: authData.user.id, 
        nome: user.name,
        email: user.email,
        role: user.role,
        ativo: true,
        perm_view_agenda: user.perm_view_agenda,
        perm_view_financial: user.perm_view_financial,
        perm_view_crm: user.perm_view_crm,
        perm_create_reservation: user.perm_create_reservation,
        perm_edit_reservation: user.perm_edit_reservation,
        perm_delete_reservation: user.perm_delete_reservation,
        perm_edit_client: user.perm_edit_client,
        perm_receive_payment: user.perm_receive_payment,
        perm_create_reservation_no_contact: user.perm_create_reservation_no_contact
      });
      if (profileError) throw new Error(profileError.message);
    },

    getAll: async (): Promise<User[]> => {
      const { data, error } = await supabase.from('usuarios').select('*').order('nome');
      if (error) return [];
      return data.map((u: any) => {
        const roleNormalized = (u.role || '').toUpperCase() as UserRole;
        const isAdmin = roleNormalized === UserRole.ADMIN;
        return {
          id: u.id,
          name: u.nome || 'Usuário',         
          email: u.email || '',   
          role: roleNormalized, 
          passwordHash: '',
          perm_view_agenda: isAdmin ? true : (u.perm_view_agenda ?? false),
          perm_view_financial: isAdmin ? true : (u.perm_view_financial ?? false),
          perm_view_crm: isAdmin ? true : (u.perm_view_crm ?? false),
          perm_create_reservation: isAdmin ? true : (u.perm_create_reservation ?? false),
          perm_edit_reservation: isAdmin ? true : (u.perm_edit_reservation ?? false),
          perm_delete_reservation: isAdmin ? true : (u.perm_delete_reservation ?? false),
          perm_edit_client: isAdmin ? true : (u.perm_edit_client ?? false),
          perm_receive_payment: isAdmin ? true : (u.perm_receive_payment ?? false),
          perm_create_reservation_no_contact: isAdmin ? true : (u.perm_create_reservation_no_contact ?? false),
          active: u.ativo ?? true
        };
      });
    },

    getById: async (id: string): Promise<User | null> => {
      const { data, error } = await supabase.from('usuarios').select('*').eq('id', id).maybeSingle();
      if (error || !data) return null;
      
      const roleNormalized = (data.role || '').toUpperCase() as UserRole;
      const isAdmin = roleNormalized === UserRole.ADMIN;

      return {
        id: data.id,
        name: data.nome || 'Usuário',
        email: data.email || '',
        role: roleNormalized,
        passwordHash: '',
        perm_view_agenda: isAdmin ? true : (data.perm_view_agenda ?? false),
        perm_view_financial: isAdmin ? true : (data.perm_view_financial ?? false),
        perm_view_crm: isAdmin ? true : (data.perm_view_crm ?? false),
        perm_create_reservation: isAdmin ? true : (data.perm_create_reservation ?? false),
        perm_edit_reservation: isAdmin ? true : (data.perm_edit_reservation ?? false),
        perm_delete_reservation: isAdmin ? true : (data.perm_delete_reservation ?? false),
        perm_edit_client: isAdmin ? true : (data.perm_edit_client ?? false),
        perm_receive_payment: isAdmin ? true : (data.perm_receive_payment ?? false),
        perm_create_reservation_no_contact: isAdmin ? true : (data.perm_create_reservation_no_contact ?? false),
        active: data.ativo ?? true
      };
    },

    update: async (user: User) => {
      const payload: any = {
        nome: user.name,
        email: user.email,
        role: user.role,
        perm_view_agenda: user.perm_view_agenda,
        perm_view_financial: user.perm_view_financial,
        perm_view_crm: user.perm_view_crm,
        perm_create_reservation: user.perm_create_reservation,
        perm_edit_reservation: user.perm_edit_reservation,
        perm_delete_reservation: user.perm_delete_reservation,
        perm_edit_client: user.perm_edit_client,
        perm_receive_payment: user.perm_receive_payment,
        perm_create_reservation_no_contact: user.perm_create_reservation_no_contact,
        ativo: user.active ?? true
      };
      const { error } = await supabase.from('usuarios').update(payload).eq('id', user.id);
      if (error) throw new Error(error.message);
      if (user.passwordHash && user.passwordHash.length > 0) {
          const { error: authErr } = await (supabase.auth as any).updateUser({ password: user.passwordHash });
          if (authErr) console.warn("Aviso: Falha ao atualizar senha Auth.");
      }
    },

    delete: async (id: string) => {
      const { error } = await supabase.from('usuarios').delete().eq('id', id);
      if (error) throw new Error(error.message || "Erro ao excluir usuário.");
    },

    getPerformance: async (startDate: string, endDate: string): Promise<StaffPerformance[]> => {
        try {
            const { data: periodReservations, error } = await supabase
                .from('reservas')
                .select('created_by, total_value, status, payment_status')
                .gte('date', startDate)
                .lte('date', endDate)
                .neq('status', ReservationStatus.CANCELADA);

            if(error) throw error;

            const users = await db.users.getAll();
            const stats = users.map(u => {
                const createdByMe = periodReservations?.filter((r: any) => r.created_by === u.id) || [];
                const sales = createdByMe.reduce((acc: number, curr: any) => acc + (curr.payment_status === PaymentStatus.PAGO ? curr.total_value : 0), 0);
                
                return {
                    userId: u.id,
                    userName: u.name,
                    reservationsCreated: createdByMe.length,
                    totalSales: sales,
                    reservationsConfirmed: createdByMe.filter((r: any) => r.status === ReservationStatus.CONFIRMADA).length,
                    lastActivity: new Date().toISOString()
                };
            });
            return stats.sort((a, b) => b.totalSales - a.totalSales);
        } catch (e) {
            console.error("Erro ao calcular performance:", e);
            return [];
        }
    }
  },
  
  clients: {
    login: async (email: string, password: string): Promise<{ client?: Client; error?: string }> => {
      try {
        const { data: authData, error: authError } = await (supabase.auth as any).signInWithPassword({ email, password });
        if (authError) return { error: 'E-mail ou senha incorretos.' };
        if (!authData.user) return { error: 'Erro de autenticação.' };

        // Ao logar, pegamos o perfil completo (incluindo foto) pois é para o próprio usuário
        const { data: clientProfile, error: profileError } = await supabase.from('clientes').select('*').eq('client_id', authData.user.id).maybeSingle();

        if (profileError || !clientProfile) {
             const { data: staffData } = await supabase.from('usuarios').select('id').eq('id', authData.user.id).maybeSingle();
             await (supabase.auth as any).signOut();
             if (staffData) return { error: 'Esta conta pertence à Equipe. Mude para a aba "Sou Equipe".' };
             return { error: 'Perfil de cliente não encontrado.' };
        }

        return {
             client: {
                id: clientProfile.client_id,
                name: clientProfile.name,
                phone: clientProfile.phone,
                email: clientProfile.email,
                photoUrl: clientProfile.photo_url,
                tags: safeTags(clientProfile.tags),
                createdAt: clientProfile.created_at,
                lastContactAt: clientProfile.last_contact_at,
                funnelStage: clientProfile.funnel_stage,
                loyaltyBalance: clientProfile.loyalty_balance || 0
             }
        };
      } catch (err) {
        console.error(err);
        return { error: 'Erro inesperado.' };
      }
    },
    // --- NOVO MÉTODO OTIMIZADO PARA LISTAGEM (PAGINAÇÃO SERVER-SIDE) ---
    list: async (page = 1, pageSize = 50, search = ''): Promise<{ data: Client[], count: number }> => {
        let query = supabase.from('clientes').select('client_id, name, phone, email, tags, last_contact_at, funnel_stage, loyalty_balance', { count: 'exact' });
        
        if (search) {
            // Busca por nome ou telefone
            const cleanSearch = cleanPhone(search);
            if (cleanSearch.length > 3) {
                query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,phone.ilike.%${cleanSearch}%`);
            } else {
                query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
            }
        }

        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        const { data, count, error } = await query
            .order('name', { ascending: true })
            .range(from, to);

        if (error) {
            console.error("Erro ao listar clientes:", error);
            return { data: [], count: 0 };
        }

        const mapped = (data || []).map((c: any) => ({
            id: c.client_id,
            name: c.name || 'Sem Nome',
            phone: c.phone || '',
            email: c.email,
            photoUrl: '', // Não carrega foto na listagem leve
            tags: safeTags(c.tags),
            createdAt: new Date().toISOString(), // Não é crítico na listagem
            lastContactAt: c.last_contact_at || new Date().toISOString(),
            funnelStage: c.funnel_stage || FunnelStage.NOVO,
            loyaltyBalance: c.loyalty_balance || 0
        }));

        return { data: mapped, count: count || 0 };
    },
    
    // Mantém getAll APENAS para pequenos dropdowns, mas não deve ser usado no CRM principal
    getAll: async (): Promise<Client[]> => {
      const { data, error } = await supabase.from('clientes').select('client_id, name, phone, email, tags, funnel_stage').limit(200); // Limitado para segurança
      if (error) return [];
      return data.map((c: any) => ({
          id: c.client_id,
          name: c.name,
          phone: c.phone,
          email: c.email,
          tags: safeTags(c.tags),
          createdAt: new Date().toISOString(),
          lastContactAt: new Date().toISOString(),
          funnelStage: c.funnel_stage,
          photoUrl: ''
      }));
    },

    register: async (client: Client, password: string): Promise<{ client?: Client; error?: string }> => {
        try {
            const { data: authData, error: authError } = await (supabase.auth as any).signUp({
                email: client.email || `${client.phone}@temp.com`,
                password: password,
                options: { data: { name: client.name } }
            });
            if (authError) return { error: authError.message };
            if (!authData.user) return { error: "Erro ao criar conta segura." };

            const phoneClean = cleanPhone(client.phone);
            const dbClient = {
                client_id: authData.user.id,
                name: client.name,
                phone: phoneClean,
                email: client.email,
                photo_url: client.photoUrl,
                tags: ['Novo Cadastro'],
                last_contact_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
                funnel_stage: FunnelStage.NOVO,
                loyalty_balance: 0
            };
            const { error } = await supabase.from('clientes').upsert(dbClient);
            if (error) return { error: error.message };
            return { client: { ...client, id: authData.user.id } };
        } catch (e: any) { return { error: String(e) }; }
    },
    getByPhone: async (phone: string): Promise<Client | null> => {
      const cleanedPhone = cleanPhone(phone);
      if (!cleanedPhone) return null;
      const { data, error } = await supabase.from('clientes').select('*').or(`phone.eq.${phone},phone.eq.${cleanedPhone}`).maybeSingle();
      if (error || !data) return null;
      return {
        id: data.client_id, name: data.name, phone: data.phone, email: data.email, photoUrl: data.photo_url, tags: safeTags(data.tags), createdAt: data.created_at, lastContactAt: data.last_contact_at, funnelStage: data.funnel_stage || FunnelStage.NOVO, loyaltyBalance: data.loyalty_balance || 0
      };
    },
    getById: async (id: string): Promise<Client | null> => {
      const { data, error } = await supabase.from('clientes').select('*').eq('client_id', id).maybeSingle();
      if (error || !data) return null;
      return { id: data.client_id, name: data.name, phone: data.phone, email: data.email, photoUrl: data.photo_url, tags: safeTags(data.tags), createdAt: data.created_at, lastContactAt: data.last_contact_at, funnelStage: data.funnel_stage || FunnelStage.NOVO, loyaltyBalance: data.loyalty_balance || 0 };
    },
    create: async (client: Client, createdBy?: string): Promise<Client> => {
      const phoneClean = cleanPhone(client.phone);
      const hasEmail = client.email && client.email.trim().length > 0;
      if (!phoneClean && !hasEmail) return client; 
      let query = supabase.from('clientes').select('*');
      const conditions = [];
      if (phoneClean) conditions.push(`phone.eq.${phoneClean}`);
      if (hasEmail) conditions.push(`email.eq.${client.email}`);
      let existingClient = null;
      if (conditions.length > 0) {
          const { data } = await query.or(conditions.join(',')).maybeSingle();
          existingClient = data;
      }
      if (existingClient) {
          const updatePayload: any = {
              name: client.name || existingClient.name,
              email: (client.email && client.email.trim() !== '') ? client.email : existingClient.email,
              phone: phoneClean || existingClient.phone,
              tags: client.tags, 
              last_contact_at: client.lastContactAt,
              funnel_stage: client.funnelStage || FunnelStage.NOVO,
              photo_url: client.photoUrl || existingClient.photo_url
          };
          await supabase.from('clientes').update(updatePayload).eq('client_id', existingClient.client_id);
          return { ...client, id: existingClient.client_id, ...updatePayload };
      }
      const dbClient = {
        client_id: client.id || uuidv4(),
        name: client.name,
        phone: phoneClean,
        email: (client.email && client.email.trim() !== '') ? client.email : null,
        photo_url: client.photoUrl,
        tags: client.tags || [],
        last_contact_at: client.lastContactAt,
        created_at: client.createdAt,
        funnel_stage: client.funnelStage || FunnelStage.NOVO,
        loyalty_balance: 0
      };
      const { error } = await supabase.from('clientes').insert(dbClient);
      if (error) {
          if (error.code === '23505') { 
             const { data: retry } = await supabase.from('clientes').select('*').or(`phone.eq.${phoneClean},email.eq.${client.email}`).maybeSingle();
             if (retry) return { ...client, id: retry.client_id };
          }
          throw error;
      }
      if (createdBy) db.audit.log(createdBy, 'STAFF', 'CREATE_CLIENT', `Criou cliente ${client.name}`, client.id);
      return { ...client, phone: phoneClean, email: dbClient.email || '' };
    },
    update: async (client: Client, updatedBy?: string) => {
      const dbClient: any = { name: client.name, phone: cleanPhone(client.phone), email: (client.email && client.email.trim() !== '') ? client.email : null, tags: client.tags, last_contact_at: client.lastContactAt, photo_url: client.photoUrl, funnel_stage: client.funnelStage };
      await supabase.from('clientes').update(dbClient).eq('client_id', client.id);
      if (updatedBy) db.audit.log(updatedBy, 'STAFF', 'UPDATE_CLIENT', `Atualizou ${client.name}`, client.id);
    },
    updateLastContact: async (clientId: string) => { await supabase.from('clientes').update({ last_contact_at: new Date().toISOString() }).eq('client_id', clientId); },
    updateStage: async (clientId: string, newStage: FunnelStage) => {
        let { data } = await supabase.from('clientes').select('tags').eq('client_id', clientId).single();
        if (!data) return;
        let tags: string[] = safeTags(data.tags);
        tags = tags.filter(t => !FUNNEL_STAGES.includes(t as FunnelStage));
        await supabase.from('clientes').update({ funnel_stage: newStage, tags: tags }).eq('client_id', clientId);
    }
  },
  loyalty: {
      getHistory: async (clientId: string): Promise<LoyaltyTransaction[]> => {
          const { data, error } = await supabase.from('loyalty_transactions').select('*').eq('client_id', clientId).order('created_at', { ascending: false });
          if (error) return [];
          return data.map((t: any) => ({ id: t.id, clientId: t.client_id, amount: t.amount, description: t.description, createdAt: t.created_at, reservationId: t.reservation_id }));
      },
      addTransaction: async (clientId: string, amount: number, description: string, userId?: string) => {
          const { error } = await supabase.from('loyalty_transactions').insert({ client_id: clientId, amount: amount, description: description, created_by: userId });
          if (error) throw new Error(error.message);
          const { data: client } = await supabase.from('clientes').select('loyalty_balance').eq('client_id', clientId).single();
          await supabase.from('clientes').update({ loyalty_balance: (client?.loyalty_balance || 0) + amount }).eq('client_id', clientId);
          if (userId) db.audit.log(userId, 'STAFF', amount > 0 ? 'LOYALTY_ADD' : 'LOYALTY_REMOVE', `Ajuste ${amount} pts`, clientId);
      }
  },
  reservations: {
    // --- NOVO: BUSCA LEVE PARA FINANCEIRO ---
    getFinanceData: async (startDate: string, endDate: string) => {
        const { data, error } = await supabase
            .from('reservas')
            .select('date, total_value, status, payment_status, lane_count, duration, client_name, client_id')
            .gte('date', startDate)
            .lte('date', endDate);
            
        if (error) {
            console.error("Erro financeiro:", error);
            return [];
        }
        
        // Mapeia para um formato mínimo necessário
        return data.map((r: any) => ({
            id: 'n/a', // Não precisamos do ID completo
            clientId: r.client_id,
            clientName: r.client_name,
            date: r.date,
            time: '',
            peopleCount: 0,
            laneCount: r.lane_count || 1,
            duration: r.duration || 1,
            totalValue: r.total_value || 0,
            status: r.status,
            paymentStatus: r.payment_status,
            eventType: 'Outro',
            createdAt: ''
        })) as Reservation[];
    },

    // --- NOVO: BUSCA OTIMIZADA POR CLIENTE ---
    getByClientId: async (clientId: string): Promise<Reservation[]> => {
        const { data, error } = await supabase.from('reservas').select('*').eq('client_id', clientId);
        if(error) {
            console.error("Erro ao buscar reservas do cliente:", error);
            return [];
        }
        return db.reservations._mapReservations(data);
    },

    // --- NOVO: BUSCA OTIMIZADA POR MÚLTIPLOS IDs ---
    getByIds: async (ids: string[]): Promise<Reservation[]> => {
        if (!ids || ids.length === 0) return [];
        const { data, error } = await supabase.from('reservas').select('*').in('id', ids);
        if(error) {
            console.error("Erro ao buscar reservas por IDs:", error);
            return [];
        }
        return db.reservations._mapReservations(data);
    },

    getByDateRange: async (startDate: string, endDate: string): Promise<Reservation[]> => {
        const { data, error } = await supabase.from('reservas').select('*').gte('date', startDate).lte('date', endDate);
        if (error) { console.error("Erro ao buscar reservas por data:", error); return []; }
        return db.reservations._mapReservations(data);
    },
    
    getAll: async (): Promise<Reservation[]> => {
      // WARNING: This fetches EVERYTHING. Use sparingly or for admin tasks only.
      // Deprecated usage in production for client views.
      const { data, error } = await supabase.from('reservas').select('*');
      if (error) return [];
      return db.reservations._mapReservations(data);
    },
    _mapReservations: (data: any[]): Reservation[] => {
        const now = new Date();
        const expiredIds: string[] = [];
        const mapped = data.map((r: any) => ({
            id: r.id, clientId: r.client_id || '', clientName: r.client_name || 'Cliente', date: r.date, time: r.time, peopleCount: r.people_count, laneCount: r.lane_count, duration: r.duration, totalValue: r.total_value, eventType: r.event_type, observations: r.observations, status: (r.status as ReservationStatus) || ReservationStatus.PENDENTE, paymentStatus: (r.payment_status || PaymentStatus.PENDENTE) as PaymentStatus, createdAt: r.created_at, guests: r.guests || [], lanes: r.lanes || [], checkedInIds: r.checked_in_ids || [], noShowIds: r.no_show_ids || [], hasTableReservation: r.has_table_reservation, birthdayName: r.birthday_name, tableSeatCount: r.table_seat_count, payOnSite: r.pay_on_site, comandaId: r.comanda_id, createdBy: r.created_by, lanesAssigned: r.pistas_usadas || []
        }));
        mapped.forEach((r: Reservation) => {
            if (r.payOnSite) return;
            if (r.status === ReservationStatus.PENDENTE && r.createdAt) {
                const created = new Date(r.createdAt);
                const diffMinutes = (now.getTime() - created.getTime()) / (1000 * 60);
                if (diffMinutes > 30) { expiredIds.push(r.id); r.status = ReservationStatus.CANCELADA; r.observations = (r.observations || '') + ' [Tempo excedido]'; }
            }
        });
        if (expiredIds.length > 0) { supabase.from('reservas').update({ status: ReservationStatus.CANCELADA, observations: 'Cancelado: Tempo excedido' }).in('id', expiredIds).then(); }
        return mapped;
    },
    create: async (res: Reservation, createdByUserId?: string) => {
      const dbRes = { id: res.id, client_id: (res.clientId && res.clientId.trim() !== '') ? res.clientId : null, client_name: res.clientName, date: res.date, time: res.time, people_count: res.peopleCount, lane_count: res.laneCount, duration: res.duration, total_value: res.totalValue, event_type: res.eventType, observations: res.observations, status: res.status, payment_status: res.paymentStatus, guests: res.guests, lanes: res.lanes, created_at: res.createdAt, checked_in_ids: res.checkedInIds || [], no_show_ids: res.noShowIds || [], has_table_reservation: res.hasTableReservation, birthday_name: res.birthdayName, table_seat_count: res.tableSeatCount, pay_on_site: res.payOnSite, comanda_id: res.comandaId, created_by: createdByUserId, pistas_usadas: res.lanesAssigned };
      const { error } = await supabase.from('reservas').insert(dbRes);
      if (error) throw new Error(error.message);
      if (createdByUserId) db.audit.log(createdByUserId, 'STAFF', 'CREATE_RESERVATION', `Criou reserva ${res.clientName}`, res.id);
      return res;
    },
    update: async (res: Reservation, updatedByUserId?: string, actionDetail?: string) => {
      const dbRes = { date: res.date, time: res.time, people_count: res.peopleCount, lane_count: res.laneCount, duration: res.duration, total_value: res.totalValue, event_type: res.eventType, observations: res.observations, status: res.status, payment_status: res.paymentStatus, guests: res.guests, checked_in_ids: res.checkedInIds || [], no_show_ids: res.noShowIds || [], has_table_reservation: res.hasTableReservation, birthday_name: res.birthdayName, table_seat_count: res.tableSeatCount, pay_on_site: res.payOnSite, comanda_id: res.comandaId, pistas_usadas: res.lanesAssigned };
      const { error } = await supabase.from('reservas').update(dbRes).eq('id', res.id);
      if (error) throw new Error(error.message);
      if (updatedByUserId) db.audit.log(updatedByUserId, 'STAFF', 'UPDATE_RESERVATION', actionDetail || `Atualizou ${res.clientName}`, res.id);
    }
  },
  funnel: {
    getAll: async (): Promise<FunnelCard[]> => { const clients = await db.clients.getAll(); return clients.map(c => ({ id: c.id, clientId: c.id, clientName: c.name, stage: c.funnelStage || FunnelStage.NOVO, eventType: 'Outro' as any, notes: `Tel: ${c.phone}` })); },
    update: async (cards: FunnelCard[]) => { },
    add: async (card: FunnelCard) => { await db.clients.updateStage(card.clientId, card.stage); }
  },
  interactions: {
    getAll: async (): Promise<Interaction[]> => { const { data } = await supabase.from('interacoes').select('*'); return (data || []).map((i: any) => ({ id: i.id, clientId: i.client_id, date: i.date, channel: i.channel, note: i.note })); },
    add: async (interaction: Interaction) => { await supabase.from('interacoes').insert({ id: interaction.id, client_id: interaction.clientId, date: interaction.date, channel: interaction.channel, note: interaction.note }); }
  },
  settings: {
    get: async (): Promise<AppSettings> => {
      const { data: configData } = await supabase.from('configuracoes').select('*').limit(1).maybeSingle();
      const { data: hoursData } = await supabase.from('configuracao_horarios').select('*').order('day_of_week', { ascending: true });
      let businessHours = [...INITIAL_SETTINGS.businessHours];
      if (hoursData && hoursData.length > 0) { hoursData.forEach((row: any) => { if (row.day_of_week >= 0 && row.day_of_week <= 6) { businessHours[row.day_of_week] = { isOpen: row.is_open, start: row.start_hour, end: row.end_hour }; } }); }
      const data = configData || {};
      return { establishmentName: data.establishment_name || INITIAL_SETTINGS.establishmentName, address: data.address || INITIAL_SETTINGS.address, phone: data.phone || INITIAL_SETTINGS.phone, whatsappLink: data.whatsapp_link || INITIAL_SETTINGS.whatsappLink, logoUrl: data.logo_url || INITIAL_SETTINGS.logoUrl, activeLanes: data.active_lanes || INITIAL_SETTINGS.activeLanes, weekdayPrice: data.weekday_price || INITIAL_SETTINGS.weekdayPrice, weekendPrice: data.weekend_price || INITIAL_SETTINGS.weekendPrice, onlinePaymentEnabled: data.online_payment_enabled ?? INITIAL_SETTINGS.onlinePaymentEnabled, mercadopagoPublicKey: data.mercadopago_public_key || INITIAL_SETTINGS.mercadopagoPublicKey, mercadopagoAccessToken: data.mercadopago_access_token || INITIAL_SETTINGS.mercadopagoAccessToken, mercadopagoClientId: data.mercadopago_client_id || INITIAL_SETTINGS.mercadopagoClientId, mercadopagoClientSecret: data.mercadopago_client_secret || INITIAL_SETTINGS.mercadopagoClientSecret, businessHours: businessHours, blockedDates: data.blocked_dates || [] };
    },
    saveGeneral: async (s: AppSettings) => {
      const dbSettings = { id: 1, establishment_name: s.establishmentName, address: s.address, phone: s.phone, whatsapp_link: s.whatsappLink, logo_url: s.logoUrl, active_lanes: s.activeLanes, weekday_price: s.weekdayPrice, weekend_price: s.weekendPrice, online_payment_enabled: s.onlinePaymentEnabled, mercadopago_public_key: s.mercadopagoPublicKey, mercadopago_access_token: s.mercadopagoAccessToken, mercadopago_client_id: s.mercadopagoClientId, mercadopago_client_secret: s.mercadopagoClientSecret, blocked_dates: s.blockedDates };
      const { error } = await supabase.from('configuracoes').upsert(dbSettings);
      window.dispatchEvent(new Event('settings_updated'));
      if (error) throw error;
    },
    saveHours: async (s: AppSettings) => {
      const hoursPayload = s.businessHours.map((h, index) => ({ config_id: 1, day_of_week: index, is_open: h.isOpen, start_hour: h.start, end_hour: h.end }));
      const { error } = await supabase.from('configuracao_horarios').upsert(hoursPayload, { onConflict: 'config_id,day_of_week' });
      if (error) throw error;
    },
    save: async (s: AppSettings) => { await db.settings.saveGeneral(s); await db.settings.saveHours(s); }
  }
};
