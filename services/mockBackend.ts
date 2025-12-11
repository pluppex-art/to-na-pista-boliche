import { AppSettings, Client, FunnelCard, Interaction, Reservation, User, ReservationStatus, PaymentStatus, UserRole, FunnelStage, LoyaltyTransaction, AuditLog, StaffPerformance } from '../types';
import { supabase } from './supabaseClient';
import { INITIAL_SETTINGS, FUNNEL_STAGES } from '../constants';
import { v4 as uuidv4 } from 'uuid';

// CACHE EM MEMÓRIA PARA OTIMIZAÇÃO
const CACHE: {
  clients: Client[] | null;
  reservations: Reservation[] | null;
} = {
  clients: null,
  reservations: null
};

// --- REALTIME CACHE INVALIDATION ---
supabase
  .channel('db-cache-invalidation')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas' }, () => {
      console.log('[Cache] Invalidando cache de reservas via Realtime');
      CACHE.reservations = null;
  })
  .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, () => {
      console.log('[Cache] Invalidando cache de clientes via Realtime');
      CACHE.clients = null;
  })
  .subscribe();

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
  // --- SERVIÇO DE AUDITORIA ---
  audit: {
      log: async (userId: string, userName: string, actionType: string, details: string, entityId?: string) => {
          // Fire and forget robusto - não bloqueia o fluxo principal mesmo se der erro de RLS
          try {
              const { error } = await supabase.from('audit_logs').insert({
                  user_id: userId,
                  user_name: userName,
                  action_type: actionType,
                  details: details,
                  entity_id: entityId
              });
              
              if (error) {
                  // Apenas loga no console, não joga erro para o usuário
                  console.warn("[AUDIT LOG ERROR] Falha ao gravar auditoria (Possível bloqueio RLS):", error.message);
              }
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
    login: async (email: string, password: string): Promise<{ user?: User; isFirstAccess?: boolean; error?: string }> => {
      try {
        const { data, error } = await supabase
          .from('usuarios')
          .select('*')
          .eq('email', email) 
          .maybeSingle();

        if (error) {
          console.error("Erro Supabase Login:", error);
          return { error: `Erro técnico: ${error.message}` };
        }

        if (!data) return { error: 'E-mail não encontrado.' };

        if (String(data.senha) === password) {
          if (data.ativo === false) return { error: 'Conta desativada.' };

          const roleNormalized = (data.role || '').toUpperCase() as UserRole;
          const isAdmin = roleNormalized === UserRole.ADMIN;
          
          const isFirstAccess = password === '123456';

          // Log Login
          db.audit.log(data.id, data.nome, 'LOGIN', 'Usuário realizou login');

          return {
            isFirstAccess, 
            user: {
              id: data.id,
              name: data.nome,
              email: data.email,
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
              perm_create_reservation_no_contact: isAdmin ? true : (data.perm_create_reservation_no_contact ?? false)
            }
          };
        } else {
          return { error: 'Senha incorreta.' };
        }
      } catch (err) {
        return { error: 'Erro inesperado.' };
      }
    },
    getAll: async (): Promise<User[]> => {
      const { data, error } = await supabase.from('usuarios').select('*');
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
          perm_create_reservation_no_contact: isAdmin ? true : (u.perm_create_reservation_no_contact ?? false)
        };
      });
    },
    getById: async (id: string): Promise<User | null> => {
      const { data, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error || !data) return null;

      const roleNormalized = (data.role || '').toUpperCase() as UserRole;
      const isAdmin = roleNormalized === UserRole.ADMIN;

      return {
        id: data.id,
        name: data.nome || 'Usuário',
        email: data.email || '',
        role: Object.values(UserRole).includes(roleNormalized) ? roleNormalized : UserRole.COMUM,
        passwordHash: '',
        perm_view_agenda: isAdmin ? true : (data.perm_view_agenda ?? false),
        perm_view_financial: isAdmin ? true : (data.perm_view_financial ?? false),
        perm_view_crm: isAdmin ? true : (data.perm_view_crm ?? false),
        perm_create_reservation: isAdmin ? true : (data.perm_create_reservation ?? false),
        perm_edit_reservation: isAdmin ? true : (data.perm_edit_reservation ?? false),
        perm_delete_reservation: isAdmin ? true : (data.perm_delete_reservation ?? false),
        perm_edit_client: isAdmin ? true : (data.perm_edit_client ?? false),
        perm_receive_payment: isAdmin ? true : (data.perm_receive_payment ?? false),
        perm_create_reservation_no_contact: isAdmin ? true : (data.perm_create_reservation_no_contact ?? false)
      };
    },
    create: async (user: User) => {
      const { error } = await supabase.from('usuarios').insert({
        id: user.id,
        nome: user.name,
        email: user.email,
        role: user.role,
        senha: user.passwordHash,
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
      if (error) throw new Error(error.message);
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
        perm_create_reservation_no_contact: user.perm_create_reservation_no_contact
      };
      
      if (user.passwordHash && user.passwordHash.length > 0) {
          payload.senha = user.passwordHash;
      }

      const { error } = await supabase.from('usuarios').update(payload).eq('id', user.id);
      if (error) throw new Error(error.message);
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('usuarios').delete().eq('id', id);
      if (error) {
        throw new Error(error.message || "Erro ao excluir usuário.");
      }
    },

    getPerformance: async (startDate: string, endDate: string): Promise<StaffPerformance[]> => {
        try {
            const users = await db.users.getAll();
            const reservations = await db.reservations.getAll();
            
            const filteredRes = reservations.filter(r => r.date >= startDate && r.date <= endDate && r.status !== ReservationStatus.CANCELADA);

            const stats = users.map(u => {
                const createdByMe = filteredRes.filter(r => r.createdBy === u.id);
                const sales = createdByMe.reduce((acc, curr) => acc + (curr.paymentStatus === PaymentStatus.PAGO ? curr.totalValue : 0), 0);
                
                return {
                    userId: u.id,
                    userName: u.name,
                    reservationsCreated: createdByMe.length,
                    totalSales: sales,
                    reservationsConfirmed: createdByMe.filter(r => r.status === ReservationStatus.CONFIRMADA).length,
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
        const { data, error } = await supabase
          .from('clientes')
          .select('*')
          .eq('email', email)
          .maybeSingle();

        if (error) {
          return { error: `Erro técnico: ${error.message}` };
        }

        if (!data) return { error: 'E-mail não encontrado.' };

        if (data.password === password) {
           const tags = safeTags(data.tags);
           return {
             client: {
               id: data.client_id,
               name: data.name,
               phone: data.phone,
               email: data.email,
               photoUrl: data.photo_url,
               tags: tags,
               createdAt: data.created_at,
               lastContactAt: data.last_contact_at,
               funnelStage: data.funnel_stage,
               loyaltyBalance: data.loyalty_balance || 0
             }
           };
        } else {
          return { error: 'Senha incorreta.' };
        }
      } catch (err) {
        return { error: 'Erro inesperado.' };
      }
    },
    register: async (client: Client, password: string): Promise<{ client?: Client; error?: string }> => {
        try {
            const phoneClean = cleanPhone(client.phone);
            
            // Check if exists by phone OR email
            const { data: existing } = await supabase
                .from('clientes')
                .select('*')
                .or(`phone.eq.${phoneClean},email.eq.${client.email}`)
                .maybeSingle();

            if (existing) {
                if (!existing.password) {
                    const { error: updateError } = await supabase.from('clientes').update({ password: password }).eq('client_id', existing.client_id);
                    if (updateError) throw updateError;
                    
                    CACHE.clients = null;
                    return { client: { ...client, id: existing.client_id, loyaltyBalance: existing.loyalty_balance, photoUrl: existing.photo_url } };
                } else {
                    return { error: 'Cliente já cadastrado com senha. Faça login.' };
                }
            }

            const dbClient = {
                client_id: client.id, 
                name: client.name,
                phone: phoneClean,
                // CORREÇÃO: Garante que email vazio seja NULL
                email: (client.email && client.email.trim() !== '') ? client.email : null,
                password: password,
                photo_url: client.photoUrl,
                tags: ['Novo Cadastro'],
                last_contact_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
                funnel_stage: FunnelStage.NOVO,
                loyalty_balance: 0
            };

            const { error } = await supabase.from('clientes').insert(dbClient);
            
            if (error) {
                if (error.code === '42501') return { error: 'Permissão negada (RLS). Execute o SQL de correção no Supabase.' };
                if (error.message?.includes('column "password"')) return { error: "Erro de Configuração do Banco: Coluna 'password' ausente." };
                return { error: error.message };
            }

            CACHE.clients = null;
            return { client };
        } catch (e: any) {
            return { error: e instanceof Error ? e.message : String(e || 'Erro desconhecido ao registrar.') };
        }
    },
    getAll: async (): Promise<Client[]> => {
      if (CACHE.clients) return CACHE.clients;

      const { data, error } = await supabase.from('clientes').select('*');
      if (error) return [];
      
      const mapped = data.map((c: any) => {
        const tags = safeTags(c.tags);
        const stageFromTag = tags.find((t: string) => FUNNEL_STAGES.includes(t as FunnelStage));
        const finalStage = (c.funnel_stage as FunnelStage) || (stageFromTag as FunnelStage) || FunnelStage.NOVO;

        return {
          id: c.client_id, 
          name: c.name || 'Sem Nome', 
          phone: c.phone || '',
          email: c.email,
          photoUrl: c.photo_url,
          tags: tags,
          createdAt: c.created_at || new Date().toISOString(),
          lastContactAt: c.last_contact_at || new Date().toISOString(),
          funnelStage: finalStage,
          loyaltyBalance: c.loyalty_balance || 0
        };
      });

      CACHE.clients = mapped;
      return mapped;
    },
    getByPhone: async (phone: string): Promise<Client | null> => {
      const cleanedPhone = cleanPhone(phone);
      if (!cleanedPhone) return null;
      
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .or(`phone.eq.${phone},phone.eq.${cleanedPhone}`)
        .maybeSingle();

      if (error || !data) return null;

      const tags = safeTags(data.tags);
      const stageFromTag = tags.find((t: string) => FUNNEL_STAGES.includes(t as FunnelStage));
      const finalStage = (data.funnel_stage as FunnelStage) || (stageFromTag as FunnelStage) || FunnelStage.NOVO;

      return {
        id: data.client_id, 
        name: data.name,
        phone: data.phone,
        email: data.email,
        photoUrl: data.photo_url,
        tags: tags,
        createdAt: data.created_at,
        lastContactAt: data.last_contact_at,
        funnelStage: finalStage,
        loyaltyBalance: data.loyalty_balance || 0
      };
    },
    getById: async (id: string): Promise<Client | null> => {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('client_id', id)
        .maybeSingle();

      if (error || !data) return null;

      const tags = safeTags(data.tags);
      const stageFromTag = tags.find((t: string) => FUNNEL_STAGES.includes(t as FunnelStage));
      const finalStage = (data.funnel_stage as FunnelStage) || (stageFromTag as FunnelStage) || FunnelStage.NOVO;

      return {
        id: data.client_id, 
        name: data.name,
        phone: data.phone,
        email: data.email,
        photoUrl: data.photo_url,
        tags: tags,
        createdAt: data.created_at,
        lastContactAt: data.last_contact_at,
        funnelStage: finalStage,
        loyaltyBalance: data.loyalty_balance || 0
      };
    },
    create: async (client: Client, createdBy?: string): Promise<Client> => {
      const currentTags = client.tags || [];
      const phoneClean = cleanPhone(client.phone);
      const initialStage = client.funnelStage || FunnelStage.NOVO;
      const hasEmail = client.email && client.email.trim().length > 0;

      // SEGURANÇA CONTRA SUJEIRA NO BANCO:
      // Se não tiver nem telefone nem email, NÃO cria cliente no banco.
      if (!phoneClean && !hasEmail) {
          console.log("[Client Create] Bloqueado: Sem telefone e sem email. Retornando cliente sem persistir.");
          return client; 
      }

      // LÓGICA DE BUSCA APRIMORADA: Verifica Telefone OU Email
      let query = supabase.from('clientes').select('*');
      const conditions = [];
      if (phoneClean) conditions.push(`phone.eq.${phoneClean}`);
      if (hasEmail) conditions.push(`email.eq.${client.email}`);
      
      let existingClient = null;
      if (conditions.length > 0) {
          // Busca por qualquer um dos dois (OR)
          const { data } = await query.or(conditions.join(',')).maybeSingle();
          existingClient = data;
      }

      if (existingClient) {
          // SE EXISTE, ATUALIZA (UPDATE/MERGE)
          // Regra: Atualizar se o campo no banco for nulo/vazio, ou sobrescrever se tiver valor novo (Latest Wins)
          const newEmail = (client.email && client.email.trim() !== '') ? client.email : existingClient.email;
          const newPhone = phoneClean || existingClient.phone;

          const updatePayload: any = {
              name: client.name || existingClient.name, // Atualiza nome caso tenha corrigido
              email: newEmail,
              phone: newPhone,
              tags: currentTags, 
              last_contact_at: client.lastContactAt,
              funnel_stage: initialStage,
              photo_url: client.photoUrl || existingClient.photo_url
          };
          
          try {
              const { error } = await supabase.from('clientes').update(updatePayload).eq('client_id', existingClient.client_id);
              if (error) throw error;
          } catch (err: any) {
              // ERRO 23505: Unique Violation
              // Isso acontece se tentamos atualizar um e-mail ou telefone para um valor que JÁ PERTENCE a outro cliente (ID diferente).
              // Neste caso, falhamos a atualização do campo conflitante, mas mantemos o resto para não quebrar o fluxo.
              if (err.code === '23505') {
                  console.warn("Merge Conflict (Unique Constraint): E-mail ou Telefone já em uso por outro registro. Ignorando atualização de campos únicos.");
                  // Fallback: Atualiza apenas dados seguros
                  const safePayload = {
                      name: updatePayload.name,
                      tags: updatePayload.tags,
                      last_contact_at: updatePayload.last_contact_at,
                      funnel_stage: updatePayload.funnel_stage
                  };
                  await supabase.from('clientes').update(safePayload).eq('client_id', existingClient.client_id);
                  // Retorna o cliente com os dados originais do banco para os campos conflitantes
                  return { ...client, id: existingClient.client_id, phone: existingClient.phone, email: existingClient.email, loyaltyBalance: existingClient.loyalty_balance || 0 };
              } else {
                  throw err;
              }
          }
          
          CACHE.clients = null;
          return { ...client, id: existingClient.client_id, phone: updatePayload.phone, email: updatePayload.email, tags: currentTags, loyaltyBalance: existingClient.loyalty_balance || 0, photoUrl: existingClient.photo_url };
      }

      // SE NÃO EXISTE, CRIA (INSERT)
      const dbClient = {
        client_id: client.id, 
        name: client.name,
        phone: phoneClean,
        // CORREÇÃO: Garante que email vazio seja NULL para evitar erro UNIQUE
        email: (client.email && client.email.trim() !== '') ? client.email : null,
        photo_url: client.photoUrl,
        tags: currentTags,
        last_contact_at: client.lastContactAt,
        created_at: client.createdAt,
        funnel_stage: initialStage,
        loyalty_balance: 0
      };
      
      const { error } = await supabase.from('clientes').insert(dbClient);
      
      if (error) {
          if (error.code === '23505') { 
             // Fallback em caso de race condition
             const { data: retryClient } = await supabase.from('clientes').select('*').or(`phone.eq.${phoneClean},email.eq.${client.email}`).maybeSingle();
             if (retryClient) return { ...client, id: retryClient.client_id, phone: retryClient.phone, email: retryClient.email, loyaltyBalance: retryClient.loyalty_balance || 0, photoUrl: retryClient.photo_url };
          }
          if (error.code === '42501') throw new Error("Erro de Permissão (RLS) ao criar cliente. Atualize o banco.");
          throw error;
      }
      
      if (createdBy) {
          db.audit.log(createdBy, 'STAFF', 'CREATE_CLIENT', `Criou cliente ${client.name}`, client.id);
      }

      CACHE.clients = null;
      return { ...client, phone: phoneClean, email: dbClient.email || '', tags: currentTags, funnelStage: initialStage, loyaltyBalance: 0 };
    },
    update: async (client: Client, updatedBy?: string) => {
      const dbClient: any = {
        name: client.name,
        phone: cleanPhone(client.phone),
        // CORREÇÃO: Garante que email vazio seja NULL
        email: (client.email && client.email.trim() !== '') ? client.email : null,
        tags: client.tags,
        last_contact_at: client.lastContactAt,
        photo_url: client.photoUrl
      };
      
      if (client.funnelStage) dbClient.funnel_stage = client.funnelStage;
      
      // Update Password if present in object but normally handled by dedicated methods
      if (client.password) dbClient.password = client.password;

      const { error } = await supabase.from('clientes').update(dbClient).eq('client_id', client.id);
      if (error) console.error("Erro ao atualizar cliente:", error);
      
      if (updatedBy) {
          db.audit.log(updatedBy, 'STAFF', 'UPDATE_CLIENT', `Atualizou dados de ${client.name}`, client.id);
      }

      CACHE.clients = null;
    },
    updateLastContact: async (clientId: string) => {
      await supabase.from('clientes').update({ last_contact_at: new Date().toISOString() }).eq('client_id', clientId);
      CACHE.clients = null;
    },
    updateStage: async (clientId: string, newStage: FunnelStage) => {
        let { data, error } = await supabase.from('clientes').select('tags').eq('client_id', clientId).single();
        if (error || !data) return;

        let tags: string[] = safeTags(data.tags);
        tags = tags.filter(t => !FUNNEL_STAGES.includes(t as FunnelStage));
        
        const updatePayload = { 
            funnel_stage: newStage,
            tags: tags 
        };

        await supabase.from('clientes').update(updatePayload).eq('client_id', clientId);
        CACHE.clients = null;
    }
  },

  loyalty: {
      getHistory: async (clientId: string): Promise<LoyaltyTransaction[]> => {
          const { data, error } = await supabase
              .from('loyalty_transactions')
              .select('*')
              .eq('client_id', clientId)
              .order('created_at', { ascending: false });
          
          if (error) return [];
          
          return data.map((t: any) => ({
              id: t.id,
              clientId: t.client_id,
              amount: t.amount,
              description: t.description,
              createdAt: t.created_at,
              reservationId: t.reservation_id
          }));
      },
      addTransaction: async (clientId: string, amount: number, description: string, userId?: string) => {
          const { error } = await supabase.from('loyalty_transactions').insert({
              client_id: clientId,
              amount: amount,
              description: description,
              created_by: userId
          });
          
          if (error) {
              if (error.code === '42501') throw new Error("Erro RLS: Não foi possível gravar fidelidade.");
              throw new Error(error.message);
          }

          const { data: client } = await supabase.from('clientes').select('loyalty_balance').eq('client_id', clientId).single();
          const currentBalance = client?.loyalty_balance || 0;
          
          await supabase.from('clientes').update({
              loyalty_balance: currentBalance + amount
          }).eq('client_id', clientId);

          if (userId) {
              const action = amount > 0 ? 'LOYALTY_ADD' : 'LOYALTY_REMOVE';
              db.audit.log(userId, 'STAFF', action, `Ajuste de ${amount} pontos para cliente ${clientId}.`, clientId);
          }

          CACHE.clients = null;
      }
  },

  reservations: {
    getAll: async (): Promise<Reservation[]> => {
      if (CACHE.reservations) return CACHE.reservations;

      const { data, error } = await supabase.from('reservas').select('*');
      if (error) return [];
      
      const mapped = data.map((r: any) => ({
        id: r.id,
        clientId: r.client_id || '', // Tratamento para null
        clientName: r.client_name || 'Cliente',
        date: r.date, 
        time: r.time, 
        peopleCount: r.people_count, 
        laneCount: r.lane_count, 
        duration: r.duration, 
        totalValue: r.total_value, 
        eventType: r.event_type, 
        observations: r.observations, 
        status: (r.status as ReservationStatus) || ReservationStatus.PENDENTE,
        paymentStatus: (r.payment_status || PaymentStatus.PENDENTE) as PaymentStatus, 
        createdAt: r.created_at, 
        guests: r.guests || [],
        lanes: r.lanes || [],
        checkedInIds: r.checked_in_ids || [], 
        noShowIds: r.no_show_ids || [],
        hasTableReservation: r.has_table_reservation,
        birthdayName: r.birthday_name,
        tableSeatCount: r.table_seat_count,
        payOnSite: r.pay_on_site, // Mapeado do banco
        createdBy: r.created_by,
        lanesAssigned: r.pistas_usadas || [] // Mapeamento novo
      }));

      // --- AUTOMATIC EXPIRATION CHECK (30 MIN RULE) ---
      // Verificação "Preguiçosa": Quando os dados são lidos, verificamos se há algo expirado
      // Se houver, atualizamos o banco silenciosamente
      const now = new Date();
      const expiredIds: string[] = [];

      mapped.forEach((r: Reservation) => {
          // Ignora se estiver marcado para pagar no local
          if (r.payOnSite) return;

          if (r.status === ReservationStatus.PENDENTE && r.createdAt) {
              const created = new Date(r.createdAt);
              const diffMinutes = (now.getTime() - created.getTime()) / (1000 * 60);
              
              if (diffMinutes > 30) {
                  expiredIds.push(r.id);
                  // Atualiza localmente para refletir na UI instantaneamente
                  r.status = ReservationStatus.CANCELADA;
                  r.observations = (r.observations || '') + ' [Cancelado: Tempo de confirmação excedido]';
              }
          }
      });

      if (expiredIds.length > 0) {
          // Dispara atualização em background (sem await para não travar a UI)
          (async () => {
              try {
                console.log(`[Auto-Expire] Cancelando ${expiredIds.length} reservas expiradas...`);
                await supabase
                    .from('reservas')
                    .update({ 
                        status: ReservationStatus.CANCELADA,
                        observations: 'Cancelado: Tempo de confirmação excedido'
                    })
                    .in('id', expiredIds);
                
                // Grava log de auditoria
                for (const id of expiredIds) {
                     await db.audit.log('SYSTEM', 'SISTEMA', 'AUTO_CANCEL', 'Reserva expirou (30min sem pagamento)', id);
                }
              } catch (err) {
                  console.error("Erro ao auto-cancelar reservas:", err);
              }
          })();
      }

      CACHE.reservations = mapped;
      return mapped;
    },
    create: async (res: Reservation, createdByUserId?: string) => {
      const dbRes = {
        id: res.id,
        // Envia NULL se o clientId for string vazia ou undefined (Reserva sem cadastro)
        // Isso evita "Violates Foreign Key Constraint" quando o ID é falso
        client_id: (res.clientId && res.clientId.trim() !== '') ? res.clientId : null, 
        client_name: res.clientName,
        date: res.date,
        time: res.time,
        people_count: res.peopleCount,
        lane_count: res.laneCount,
        duration: res.duration,
        total_value: res.totalValue,
        event_type: res.eventType,
        observations: res.observations,
        status: res.status,                
        payment_status: res.paymentStatus,
        guests: res.guests,
        lanes: res.lanes,
        created_at: res.createdAt,
        checked_in_ids: res.checkedInIds || [], 
        no_show_ids: res.noShowIds || [],
        has_table_reservation: res.hasTableReservation,
        birthday_name: res.birthdayName,
        table_seat_count: res.tableSeatCount,
        pay_on_site: res.payOnSite, // Grava no banco
        created_by: createdByUserId,
        pistas_usadas: res.lanesAssigned // Salva no banco
      };
      
      const { error } = await supabase.from('reservas').insert(dbRes);
      if (error) {
          if (error.code === '42501') throw new Error("Erro de Permissão (RLS): O sistema não pôde criar a reserva. Execute o SQL de correção.");
          if (error.code === '23503') throw new Error("Erro de Relacionamento: O sistema tentou criar uma reserva para um cliente inválido. Execute o SQL para tornar client_id opcional.");
          throw new Error(error.message);
      }
      
      if (createdByUserId) {
          db.audit.log(createdByUserId, 'STAFF', 'CREATE_RESERVATION', `Criou reserva para ${res.clientName} em ${res.date}`, res.id);
      }

      CACHE.reservations = null;
      return res;
    },
    update: async (res: Reservation, updatedByUserId?: string, actionDetail?: string) => {
      const dbRes = {
        date: res.date,
        time: res.time,
        people_count: res.peopleCount,
        lane_count: res.laneCount,
        duration: res.duration,
        total_value: res.totalValue,
        event_type: res.eventType,
        observations: res.observations,
        status: res.status,
        payment_status: res.paymentStatus,
        guests: res.guests,
        checked_in_ids: res.checkedInIds || [], 
        no_show_ids: res.noShowIds || [],
        has_table_reservation: res.hasTableReservation,
        birthday_name: res.birthdayName,
        table_seat_count: res.tableSeatCount,
        pay_on_site: res.payOnSite,
        pistas_usadas: res.lanesAssigned // Atualiza no banco
      };
      
      const { error } = await supabase.from('reservas').update(dbRes).eq('id', res.id);
      if (error) throw new Error(error.message);
      
      if (updatedByUserId) {
           db.audit.log(updatedByUserId, 'STAFF', 'UPDATE_RESERVATION', actionDetail || `Atualizou reserva de ${res.clientName}`, res.id);
      }

      CACHE.reservations = null;
    }
  },

  funnel: {
    getAll: async (): Promise<FunnelCard[]> => {
      const clients = await db.clients.getAll();
      return clients.map(c => ({
          id: c.id, 
          clientId: c.id,
          clientName: c.name,
          stage: c.funnelStage || FunnelStage.NOVO,
          eventType: 'Outro' as any, 
          notes: `Tel: ${c.phone}`
      }));
    },
    update: async (cards: FunnelCard[]) => { },
    add: async (card: FunnelCard) => {
       await db.clients.updateStage(card.clientId, card.stage);
    }
  },

  interactions: {
    getAll: async (): Promise<Interaction[]> => {
      const { data, error } = await supabase.from('interacoes').select('*');
      if (error) return [];
      return data.map((i: any) => ({
        id: i.id,
        clientId: i.client_id,
        date: i.date || new Date().toISOString(),
        channel: i.channel || 'Outro',
        note: i.note || ''
      }));
    },
    add: async (interaction: Interaction) => {
      const dbInt = {
        id: interaction.id,
        client_id: interaction.clientId,
        date: interaction.date,
        channel: interaction.channel,
        note: interaction.note
      };
      await supabase.from('interacoes').insert(dbInt);
    }
  },

  settings: {
    get: async (): Promise<AppSettings> => {
      const { data: configData, error: configError } = await supabase.from('configuracoes').select('*').limit(1).maybeSingle();
      
      const { data: hoursData, error: hoursError } = await supabase
        .from('configuracao_horarios')
        .select('*')
        .order('day_of_week', { ascending: true });

      let businessHours = [...INITIAL_SETTINGS.businessHours];

      if (hoursData && hoursData.length > 0) {
         hoursData.forEach((row: any) => {
             if (row.day_of_week >= 0 && row.day_of_week <= 6) {
                 businessHours[row.day_of_week] = {
                     isOpen: row.is_open,
                     start: row.start_hour,
                     end: row.end_hour
                 };
             }
         });
      }

      const data = configData || {};

      return {
        establishmentName: data.establishment_name || INITIAL_SETTINGS.establishmentName,
        address: data.address || INITIAL_SETTINGS.address,
        phone: data.phone || INITIAL_SETTINGS.phone,
        whatsappLink: data.whatsapp_link || INITIAL_SETTINGS.whatsappLink,
        logoUrl: data.logo_url || INITIAL_SETTINGS.logoUrl,
        activeLanes: data.active_lanes || INITIAL_SETTINGS.activeLanes,
        weekdayPrice: data.weekday_price || INITIAL_SETTINGS.weekdayPrice,
        weekendPrice: data.weekend_price || INITIAL_SETTINGS.weekendPrice,
        onlinePaymentEnabled: data.online_payment_enabled ?? INITIAL_SETTINGS.onlinePaymentEnabled,
        mercadopagoPublicKey: data.mercadopago_public_key || INITIAL_SETTINGS.mercadopagoPublicKey,
        mercadopagoAccessToken: data.mercadopago_access_token || INITIAL_SETTINGS.mercadopagoAccessToken,
        mercadopagoClientId: data.mercadopago_client_id || INITIAL_SETTINGS.mercadopagoClientId,
        mercadopagoClientSecret: data.mercadopago_client_secret || INITIAL_SETTINGS.mercadopagoClientSecret,
        businessHours: businessHours,
        blockedDates: data.blocked_dates || []
      };
    },
    
    saveGeneral: async (s: AppSettings) => {
      const dbSettings = {
        id: 1, 
        establishment_name: s.establishmentName,
        address: s.address,
        phone: s.phone,
        whatsapp_link: s.whatsappLink,
        logo_url: s.logoUrl,
        active_lanes: s.activeLanes,
        weekday_price: s.weekdayPrice,
        weekend_price: s.weekendPrice,
        online_payment_enabled: s.onlinePaymentEnabled,
        mercadopago_public_key: s.mercadopagoPublicKey,
        mercadopago_access_token: s.mercadopagoAccessToken,
        mercadopago_client_id: s.mercadopagoClientId,
        mercadopago_client_secret: s.mercadopagoClientSecret,
        blocked_dates: s.blockedDates
      };
      
      const { error: configError } = await supabase.from('configuracoes').upsert(dbSettings);
      
      window.dispatchEvent(new Event('settings_updated'));

      if (configError) {
        if (configError.code === '42501') throw new Error("Erro RLS: Execute o SQL de correção no Supabase.");
        const msg = configError.message || configError.code || 'Erro desconhecido';
        if (msg.includes('column')) throw new Error(`Erro de Tabela: Coluna ausente. Verifique o banco.`);
        throw new Error(`Falha ao salvar dados gerais: ${msg}`);
      }
    },

    saveHours: async (s: AppSettings) => {
      const hoursPayload = s.businessHours.map((h, index) => ({
          config_id: 1,
          day_of_week: index,
          is_open: h.isOpen,
          start_hour: h.start,
          end_hour: h.end
      }));

      const { error: hoursError } = await supabase
          .from('configuracao_horarios')
          .upsert(hoursPayload, { onConflict: 'config_id,day_of_week' });

      if (hoursError) {
          if (hoursError.code === '42501') throw new Error("Erro RLS: Não foi possível salvar horários.");
          throw new Error("Falha ao salvar horários de funcionamento.");
      }
    },

    save: async (s: AppSettings) => {
        await db.settings.saveGeneral(s);
        await db.settings.saveHours(s);
    }
  }
};