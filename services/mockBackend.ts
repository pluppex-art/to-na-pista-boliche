

import { AppSettings, Client, FunnelCard, Interaction, Reservation, User, ReservationStatus, PaymentStatus, UserRole, FunnelStage } from '../types';
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
    login: async (email: string, password: string): Promise<{ user?: User; error?: string }> => {
      try {
        const { data, error } = await supabase
          .from('usuarios')
          .select('*')
          .eq('email', email) 
          .maybeSingle();

        if (error) {
          console.error("[Login] Erro do Supabase:", error);
          return { error: `Erro técnico: ${error.message}` };
        }

        if (!data) return { error: 'E-mail não encontrado.' };

        if (String(data.senha) === password) {
          if (data.ativo === false) return { error: 'Conta desativada.' };

          const roleNormalized = (data.role || '').toUpperCase() as UserRole;

          return {
            user: {
              id: data.id,
              name: data.nome,
              email: data.email,
              role: Object.values(UserRole).includes(roleNormalized) ? roleNormalized : UserRole.COMUM,
              passwordHash: '',
              // Mapeamento das colunas booleanas
              perm_view_agenda: data.perm_view_agenda ?? false,
              perm_view_financial: data.perm_view_financial ?? false,
              perm_view_crm: data.perm_view_crm ?? false,
              perm_create_reservation: data.perm_create_reservation ?? false,
              perm_edit_reservation: data.perm_edit_reservation ?? false,
              perm_delete_reservation: data.perm_delete_reservation ?? false,
              perm_edit_client: data.perm_edit_client ?? false,
              perm_receive_payment: data.perm_receive_payment ?? false
            }
          };
        } else {
          return { error: 'Senha incorreta.' };
        }
      } catch (err) {
        return { error: 'Erro inesperado ao conectar.' };
      }
    },
    getAll: async (): Promise<User[]> => {
      const { data, error } = await supabase.from('usuarios').select('*');
      if (error) return [];
      
      return data.map((u: any) => ({
        id: u.id,
        name: u.nome || 'Usuário',         
        email: u.email || '',   
        role: (u.role || '').toUpperCase() as UserRole, 
        passwordHash: '',
        perm_view_agenda: u.perm_view_agenda ?? false,
        perm_view_financial: u.perm_view_financial ?? false,
        perm_view_crm: u.perm_view_crm ?? false,
        perm_create_reservation: u.perm_create_reservation ?? false,
        perm_edit_reservation: u.perm_edit_reservation ?? false,
        perm_delete_reservation: u.perm_delete_reservation ?? false,
        perm_edit_client: u.perm_edit_client ?? false,
        perm_receive_payment: u.perm_receive_payment ?? false
      }));
    },
    create: async (user: User) => {
      await supabase.from('usuarios').insert({
        id: user.id,
        nome: user.name,
        email: user.email,
        role: user.role,
        senha: user.passwordHash,
        ativo: true,
        // Colunas
        perm_view_agenda: user.perm_view_agenda,
        perm_view_financial: user.perm_view_financial,
        perm_view_crm: user.perm_view_crm,
        perm_create_reservation: user.perm_create_reservation,
        perm_edit_reservation: user.perm_edit_reservation,
        perm_delete_reservation: user.perm_delete_reservation,
        perm_edit_client: user.perm_edit_client,
        perm_receive_payment: user.perm_receive_payment
      });
    },
    update: async (user: User) => {
      const payload: any = {
        nome: user.name,
        email: user.email,
        role: user.role,
        // Colunas
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

      await supabase.from('usuarios').update(payload).eq('id', user.id);
    },
    delete: async (id: string) => {
      await supabase.from('usuarios').delete().eq('id', id);
    }
  },
  
  clients: {
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
          funnelStage: finalStage
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
        funnelStage: finalStage
      };
    },
    create: async (client: Client): Promise<Client> => {
      const currentTags = client.tags || [];
      const phoneClean = cleanPhone(client.phone);
      const initialStage = client.funnelStage || FunnelStage.NOVO;

      // 1. Tenta buscar existente primeiro para evitar conflito de PK no Upsert/Insert
      const { data: existingClient } = await supabase
          .from('clientes')
          .select('*')
          .eq('phone', phoneClean)
          .maybeSingle();

      if (existingClient) {
          // UPDATE: Cliente existe. Atualizamos dados, mas preservamos o ID original (PK).
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

          // Retorna o objeto cliente com o ID real do banco
          return { 
              ...client, 
              id: existingClient.client_id, 
              phone: phoneClean, 
              tags: currentTags 
          };
      }

      // 2. INSERT: Cliente é novo
      const dbClient = {
        client_id: client.id, 
        name: client.name,
        phone: phoneClean,
        email: client.email,
        tags: currentTags,
        last_contact_at: client.lastContactAt,
        created_at: client.createdAt,
        funnel_stage: initialStage
      };
      
      const { error } = await supabase.from('clientes').insert(dbClient);
      
      // Tratamento de Race Condition (inserido por outro processo entre o select e o insert)
      if (error && error.code === '23505') { // Postgres Unique Violation
          const { data: retryClient } = await supabase.from('clientes').select('*').eq('phone', phoneClean).maybeSingle();
          if (retryClient) {
             return { ...client, id: retryClient.client_id, phone: phoneClean };
          }
      }
      
      if (error) throw error;
      
      return { ...client, phone: phoneClean, tags: currentTags, funnelStage: initialStage };
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
        // Novos campos
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
        // Novos campos
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
        // Novos campos
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
        businessHours: businessHours 
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
        mercadopago_client_secret: s.mercadopagoClientSecret
      };
      
      const { error: configError } = await supabase.from('configuracoes').upsert(dbSettings);
      
      if (configError) {
        throw new Error(`Falha ao salvar dados gerais: ${configError.message || configError.code}`);
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
