

import { AppSettings, Client, FunnelCard, Interaction, Reservation, User, ReservationStatus, PaymentStatus, UserRole, FunnelStage, LoyaltyTransaction } from '../types';
import { supabase } from './supabaseClient';
import { INITIAL_SETTINGS, FUNNEL_STAGES } from '../constants';

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
  users: {
    login: async (email: string, password: string): Promise<{ user?: User; isFirstAccess?: boolean; error?: string }> => {
      try {
        const { data, error } = await supabase
          .from('usuarios')
          .select('*')
          .eq('email', email) 
          .maybeSingle();

        if (error) {
          console.error("Erro Supabase:", error);
          return { error: `Erro técnico.` };
        }

        if (!data) return { error: 'E-mail não encontrado.' };

        if (String(data.senha) === password) {
          if (data.ativo === false) return { error: 'Conta desativada.' };

          const roleNormalized = (data.role || '').toUpperCase() as UserRole;
          const isAdmin = roleNormalized === UserRole.ADMIN;
          
          // DETECTA PRIMEIRO ACESSO (Senha Padrão)
          const isFirstAccess = password === '123456';

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
              perm_receive_payment: isAdmin ? true : (data.perm_receive_payment ?? false)
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
          perm_receive_payment: isAdmin ? true : (u.perm_receive_payment ?? false)
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
        perm_receive_payment: isAdmin ? true : (data.perm_receive_payment ?? false)
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
        perm_receive_payment: user.perm_receive_payment
      });
      if (error) throw error;
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
        perm_receive_payment: user.perm_receive_payment
      };
      
      if (user.passwordHash && user.passwordHash.length > 0) {
          payload.senha = user.passwordHash;
      }

      const { error } = await supabase.from('usuarios').update(payload).eq('id', user.id);
      if (error) throw error;
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('usuarios').delete().eq('id', id);
      if (error) {
        throw new Error(error.message || "Erro ao excluir usuário.");
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

        // Verifica senha (texto simples por enquanto, ideal migrar para Auth depois)
        if (data.password === password) {
           const tags = safeTags(data.tags);
           return {
             client: {
               id: data.client_id,
               name: data.name,
               phone: data.phone,
               email: data.email,
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
                // If exists but no password, update it
                if (!existing.password) {
                    await supabase.from('clientes').update({ password: password }).eq('client_id', existing.client_id);
                    return { client: { ...client, id: existing.client_id, loyaltyBalance: existing.loyalty_balance } };
                } else {
                    return { error: 'Cliente já cadastrado com senha. Faça login.' };
                }
            }

            const dbClient = {
                client_id: client.id, 
                name: client.name,
                phone: phoneClean,
                email: client.email,
                password: password,
                tags: ['Novo Cadastro'],
                last_contact_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
                funnel_stage: FunnelStage.NOVO,
                loyalty_balance: 0
            };

            const { error } = await supabase.from('clientes').insert(dbClient);
            
            if (error) {
                if (error.message?.includes('column "password"')) {
                    return { error: "Erro de Configuração: Coluna 'password' não existe no banco. O Admin precisa rodar o SQL de atualização." };
                }
                return { error: error.message };
            }

            return { client };
        } catch (e: any) {
            return { error: e.message };
        }
    },
    getAll: async (): Promise<Client[]> => {
      const { data, error } = await supabase.from('clientes').select('*');
      if (error) return [];
      
      return data.map((c: any) => {
        const tags = safeTags(c.tags);
        const stageFromTag = tags.find((t: string) => FUNNEL_STAGES.includes(t as FunnelStage));
        const finalStage = (c.funnel_stage as FunnelStage) || (stageFromTag as FunnelStage) || FunnelStage.NOVO;

        return {
          id: c.client_id, 
          name: c.name || 'Sem Nome', 
          phone: c.phone || '',
          email: c.email,
          tags: tags,
          createdAt: c.created_at || new Date().toISOString(),
          lastContactAt: c.last_contact_at || new Date().toISOString(),
          funnelStage: finalStage,
          loyaltyBalance: c.loyalty_balance || 0
        };
      });
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
        tags: tags,
        createdAt: data.created_at,
        lastContactAt: data.last_contact_at,
        funnelStage: finalStage,
        loyaltyBalance: data.loyalty_balance || 0
      };
    },
    create: async (client: Client): Promise<Client> => {
      const currentTags = client.tags || [];
      const phoneClean = cleanPhone(client.phone);
      const initialStage = client.funnelStage || FunnelStage.NOVO;

      const { data: existingClient } = await supabase
          .from('clientes')
          .select('*')
          .eq('phone', phoneClean)
          .maybeSingle();

      if (existingClient) {
          const updatePayload = {
              name: client.name,
              email: client.email,
              tags: currentTags, 
              last_contact_at: client.lastContactAt,
              funnel_stage: initialStage
          };
          
          const { error: updateError } = await supabase
              .from('clientes')
              .update(updatePayload)
              .eq('client_id', existingClient.client_id);

          if (updateError) console.error("Erro ao atualizar cliente existente no create:", updateError);

          return { 
              ...client, 
              id: existingClient.client_id, 
              phone: phoneClean, 
              tags: currentTags,
              loyaltyBalance: existingClient.loyalty_balance || 0
          };
      }

      const dbClient = {
        client_id: client.id, 
        name: client.name,
        phone: phoneClean,
        email: client.email,
        tags: currentTags,
        last_contact_at: client.lastContactAt,
        created_at: client.createdAt,
        funnel_stage: initialStage,
        loyalty_balance: 0
      };
      
      const { error } = await supabase.from('clientes').insert(dbClient);
      
      if (error && error.code === '23505') { 
          const { data: retryClient } = await supabase.from('clientes').select('*').eq('phone', phoneClean).maybeSingle();
          if (retryClient) {
             return { ...client, id: retryClient.client_id, phone: phoneClean, loyaltyBalance: retryClient.loyalty_balance || 0 };
          }
      }
      
      if (error) throw error;
      
      return { ...client, phone: phoneClean, tags: currentTags, funnelStage: initialStage, loyaltyBalance: 0 };
    },
    update: async (client: Client) => {
      const dbClient = {
        name: client.name,
        phone: cleanPhone(client.phone),
        email: client.email,
        tags: client.tags,
        last_contact_at: client.lastContactAt,
        ...(client.funnelStage ? { funnel_stage: client.funnelStage } : {})
      };
      
      const { error } = await supabase.from('clientes').update(dbClient).eq('client_id', client.id);
      if (error) console.error("Erro ao atualizar cliente:", error);
    },
    updateLastContact: async (clientId: string) => {
      await supabase.from('clientes').update({ last_contact_at: new Date().toISOString() }).eq('client_id', clientId);
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
    }
  },

  // Serviço de Fidelidade
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
          // Insere transação
          const { error } = await supabase.from('loyalty_transactions').insert({
              client_id: clientId,
              amount: amount,
              description: description,
              created_by: userId
          });
          
          if (error) throw error;

          // Atualiza saldo do cliente
          const { data: client } = await supabase.from('clientes').select('loyalty_balance').eq('client_id', clientId).single();
          const currentBalance = client?.loyalty_balance || 0;
          
          await supabase.from('clientes').update({
              loyalty_balance: currentBalance + amount
          }).eq('client_id', clientId);
      }
  },

  reservations: {
    getAll: async (): Promise<Reservation[]> => {
      const { data, error } = await supabase.from('reservas').select('*');
      if (error) return [];
      
      return data.map((r: any) => ({
        id: r.id,
        clientId: r.client_id, 
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
        tableSeatCount: r.table_seat_count
      }));
    },
    create: async (res: Reservation) => {
      const dbRes = {
        id: res.id,
        client_id: res.clientId, 
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
        table_seat_count: res.tableSeatCount
      };
      
      const { error } = await supabase.from('reservas').insert(dbRes);
      if (error) throw error;
      return res;
    },
    update: async (res: Reservation) => {
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
        table_seat_count: res.tableSeatCount
      };
      
      const { error } = await supabase.from('reservas').update(dbRes).eq('id', res.id);
      if (error) console.error("Erro ao atualizar reserva:", error);
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
        blockedDates: data.blocked_dates || [] // Map blocked_dates from DB
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
        blocked_dates: s.blockedDates // Save blocked dates
      };
      
      const { error: configError } = await supabase.from('configuracoes').upsert(dbSettings);
      
      window.dispatchEvent(new Event('settings_updated'));

      if (configError) {
        const msg = configError.message || configError.code || 'Erro desconhecido';
        if (msg.includes('column')) {
             throw new Error(`Erro de Tabela: Colunas ausentes. Execute o SQL de atualização.`);
        }
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
          throw new Error("Falha ao salvar horários de funcionamento.");
      }
    },

    save: async (s: AppSettings) => {
        await db.settings.saveGeneral(s);
        await db.settings.saveHours(s);
    }
  }
};