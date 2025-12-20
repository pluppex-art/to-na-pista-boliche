
import { AppSettings, Client, FunnelCard, Reservation, ReservationStatus, PaymentStatus, UserRole, FunnelStage, FunnelStageConfig, LoyaltyTransaction, AuditLog, User, EventType, Feedback, Suggestion } from '../types';
import { supabase } from './supabaseClient';
import { INITIAL_SETTINGS } from '../constants';
import { v4 as uuidv4 } from 'uuid';

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
  feedbacks: {
    create: async (feedback: Feedback) => {
      const { data, error } = await supabase.from('avaliacoes').upsert({
        reserva_id: feedback.reserva_id,
        cliente_id: feedback.cliente_id,
        nota: feedback.nota,
        comentario: feedback.comentario
      }, { onConflict: 'reserva_id' }).select().single();
      
      if (error) throw error;
      return data;
    },
    getByClient: async (clientId: string) => {
      const { data } = await supabase.from('avaliacoes').select('*').eq('cliente_id', clientId);
      return data || [];
    }
  },

  suggestions: {
    create: async (suggestion: Suggestion) => {
      if (!suggestion.titulo || !suggestion.descricao) {
          throw new Error("Título e descrição são obrigatórios.");
      }

      // CRITICAL: Removemos .select() para evitar erro de RLS "New row violates..." 
      // O Supabase tenta ler a linha inserida para retornar, e se o RLS de SELECT estiver bloqueado, 
      // ele dá erro no INSERT.
      const { error } = await supabase.from('sugestoes').insert({
        cliente_id: suggestion.cliente_id,
        titulo: suggestion.titulo,
        descricao: suggestion.descricao,
        status: 'Pendente'
      });
      
      if (error) {
          console.error("[SUPABASE ERROR]:", error);
          throw error;
      }
      return { success: true };
    }
  },

  audit: {
      log: async (userId: string, userName: string, actionType: string, details: string, entityId?: string) => {
          try {
              await supabase.from('audit_logs').insert({
                  user_id: userId, user_name: userName, action_type: actionType, details: details, entity_id: entityId
              });
          } catch (e) { console.warn("[AUDIT LOG ERROR]", e); }
      },
      getLogs: async (filters?: { userId?: string, actionType?: string, startDate?: string, endDate?: string, limit?: number }): Promise<AuditLog[]> => {
          let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false });
          if (filters?.userId && filters.userId !== 'ALL') query = query.eq('user_id', filters.userId);
          if (filters?.actionType && filters.actionType !== 'ALL') query = query.eq('action_type', filters.actionType);
          if (filters?.startDate) query = query.gte('created_at', `${filters.startDate}T00:00:00`);
          if (filters?.endDate) query = query.lte('created_at', `${filters.endDate}T23:59:59`);
          const { data, error } = await query.limit(filters?.limit || 100);
          if (error) return [];
          return data.map((l: any) => ({
              id: l.id, userId: l.user_id, userName: l.user_name || 'Sistema', actionType: l.action_type, entityId: l.entity_id, details: l.details, createdAt: l.created_at
          }));
      }
  },

  funnelStages: {
      getAll: async (): Promise<FunnelStageConfig[]> => {
          const { data, error } = await supabase.from('etapas_funil').select('*').order('ordem', { ascending: true });
          if (error) {
              console.error("[DB ERROR]", error.message);
              throw new Error(`Erro de Banco: ${error.message}`);
          }
          return (data || []).map(d => ({ id: d.id, nome: d.nome, ordem: d.ordem }));
      },
      create: async (nome: string, ordem: number) => {
          const { data, error } = await supabase.from('etapas_funil').insert({ nome, ordem }).select().single();
          if (error) throw error;
          return { id: data.id, nome: data.nome, ordem: data.ordem };
      },
      update: async (id: string, nome: string, ordem: number) => {
          const { error } = await supabase.from('etapas_funil').update({ nome, ordem }).eq('id', id);
          if (error) throw error;
      },
      delete: async (id: string) => {
          const { error } = await supabase.from('etapas_funil').delete().eq('id', id);
          if (error) throw error;
      }
  },

  users: {
    login: async (email: string, password: string) => {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) return { error: 'E-mail ou senha inválidos.' };
      const { data, error } = await supabase.from('usuarios').select('*').eq('id', authData.user.id).maybeSingle();
      if (error || !data) return { error: 'Perfil não configurado.' };
      const roleNormalized = (data.role || '').toUpperCase() as UserRole;
      const isAdmin = roleNormalized === UserRole.ADMIN;
      db.audit.log(data.id, data.nome, 'LOGIN', 'Usuário realizou login');
      return {
          user: {
            id: data.id, name: data.nome, email: data.email, role: roleNormalized, passwordHash: '',
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
    },
    logout: async () => { await supabase.auth.signOut(); },
    getAll: async (): Promise<User[]> => {
      const { data } = await supabase.from('usuarios').select('*');
      return (data || []).map((u: any) => {
        const isAdmin = u.role === 'ADMIN';
        return {
          id: u.id, name: u.nome, email: u.email, role: u.role, passwordHash: '',
          perm_view_agenda: isAdmin || u.perm_view_agenda, perm_view_financial: isAdmin || u.perm_view_financial,
          perm_view_crm: isAdmin || u.perm_view_crm, perm_create_reservation: isAdmin || u.perm_create_reservation,
          perm_edit_reservation: isAdmin || u.perm_edit_reservation, perm_delete_reservation: isAdmin || u.perm_delete_reservation,
          perm_edit_client: isAdmin || u.perm_edit_client, perm_receive_payment: isAdmin || u.perm_receive_payment,
          perm_create_reservation_no_contact: isAdmin || u.perm_create_reservation_no_contact
        };
      });
    },
    getById: async (id: string): Promise<User | null> => {
      const { data } = await supabase.from('usuarios').select('*').eq('id', id).maybeSingle();
      if (!data) return null;
      const isAdmin = data.role === 'ADMIN';
      return {
        id: data.id, name: data.nome, email: data.email, role: data.role, passwordHash: '',
        perm_view_agenda: isAdmin || data.perm_view_agenda, perm_view_financial: isAdmin || data.perm_view_financial,
        perm_view_crm: isAdmin || data.perm_view_crm, perm_create_reservation: isAdmin || data.perm_create_reservation,
        perm_edit_reservation: isAdmin || data.perm_edit_reservation, perm_delete_reservation: isAdmin || data.perm_delete_reservation,
        perm_edit_client: isAdmin || data.perm_edit_client, perm_receive_payment: isAdmin || data.perm_receive_payment,
        perm_create_reservation_no_contact: isAdmin || data.perm_create_reservation_no_contact
      };
    }
  },
  
  clients: {
    login: async (email: string, password: string) => {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) return { error: authError.message };
      const { data, error } = await supabase.from('clientes').select('*').eq('client_id', authData.user.id).maybeSingle();
      if (error || !data) return { error: 'Perfil de cliente não encontrado.' };
      return {
          client: {
              id: data.client_id, name: data.name, phone: data.phone, email: data.email, photoUrl: data.photo_url, address: data.address,
              tags: safeTags(data.tags), createdAt: data.created_at, lastContactAt: data.last_contact_at,
              funnelStage: data.funnel_stage, loyaltyBalance: data.loyalty_balance || 0
          }
      };
    },
    register: async (client: any, password: string) => {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: client.email,
        password: password,
        options: { data: { name: client.name } }
      });
      if (authError) return { error: authError.message };
      if (!authData.user) return { error: 'Erro ao criar usuário.' };

      const { data, error } = await supabase.from('clientes').insert({
        client_id: authData.user.id,
        name: client.name,
        phone: cleanPhone(client.phone),
        email: client.email,
        address: client.address || null,
        tags: client.tags || [],
        funnel_stage: client.funnel_stage || 'Novo',
        last_contact_at: new Date().toISOString()
      }).select().single();

      if (error) return { error: error.message };
      
      return {
          client: {
              id: data.client_id, name: data.name, phone: data.phone, email: data.email, photoUrl: data.photo_url, address: data.address,
              tags: safeTags(data.tags), createdAt: data.created_at, lastContactAt: data.last_contact_at,
              funnelStage: data.funnel_stage, loyaltyBalance: data.loyalty_balance || 0
          }
      };
    },
    forgotPassword: async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/#/redefinir-senha`,
      });
      return { error: error?.message };
    },
    updatePassword: async (password: string) => {
        const { error } = await supabase.auth.updateUser({ password });
        return { success: !error, error: error?.message };
    },
    logout: async () => { await supabase.auth.signOut(); },
    getAll: async (): Promise<Client[]> => {
      const { data, error } = await supabase.from('clientes').select('*');
      if (error) throw error;
      return (data || []).map((c: any) => ({
          id: c.client_id, name: c.name || 'Sem Nome', phone: c.phone || '', email: c.email, photoUrl: c.photo_url, address: c.address,
          tags: safeTags(c.tags), createdAt: c.created_at, lastContactAt: c.last_contact_at,
          funnelStage: c.funnel_stage, loyaltyBalance: c.loyalty_balance || 0
      }));
    },
    getById: async (id: string): Promise<Client | null> => {
      const { data } = await supabase.from('clientes').select('*').eq('client_id', id).maybeSingle();
      if (!data) return null;
      return {
        id: data.client_id, name: data.name, phone: data.phone, email: data.email, photoUrl: data.photo_url, address: data.address,
        tags: safeTags(data.tags), createdAt: data.created_at, lastContactAt: data.last_contact_at,
        funnelStage: data.funnel_stage, loyaltyBalance: data.loyalty_balance || 0
      };
    },
    getByPhone: async (phone: string): Promise<Client | null> => {
      const clean = cleanPhone(phone);
      const { data } = await supabase.from('clientes').select('*').eq('phone', clean).maybeSingle();
      if (!data) return null;
      return {
        id: data.client_id, name: data.name, phone: data.phone, email: data.email, photoUrl: data.photo_url, address: data.address,
        tags: safeTags(data.tags), createdAt: data.created_at, lastContactAt: data.last_contact_at,
        funnelStage: data.funnel_stage, loyaltyBalance: data.loyalty_balance || 0
      };
    },
    create: async (client: any, userId?: string): Promise<Client> => {
      const { data, error } = await supabase.from('clientes').insert({
        client_id: client.id || uuidv4(),
        name: client.name,
        phone: cleanPhone(client.phone),
        email: client.email || null,
        address: client.address || null,
        tags: client.tags || ['Lead'],
        funnel_stage: client.funnelStage || 'Novo',
        last_contact_at: new Date().toISOString()
      }).select().single();
      
      if (error) throw error;
      if (userId) db.audit.log(userId, 'STAFF', 'CREATE_CLIENT', `Criou cliente ${client.name}`, data.client_id);

      return {
          id: data.client_id, name: data.name, phone: data.phone, email: data.email, photoUrl: data.photo_url, address: data.address,
          tags: safeTags(data.tags), createdAt: data.created_at, lastContactAt: data.last_contact_at,
          funnelStage: data.funnel_stage, loyaltyBalance: data.loyalty_balance || 0
      };
    },
    update: async (client: Client, updatedBy?: string) => {
      const { error } = await supabase.from('clientes').update({
        name: client.name, phone: cleanPhone(client.phone), email: client.email || null,
        address: client.address || null,
        last_contact_at: client.lastContactAt, photo_url: client.photoUrl, funnel_stage: client.funnelStage
      }).eq('client_id', client.id);
      if (error) throw error;
      if (updatedBy) db.audit.log(updatedBy, 'STAFF', 'UPDATE_CLIENT', `Atualizou ${client.name}`, client.id);
    },
    updateStage: async (clientId: string, newStage: string) => {
        const { error } = await supabase.from('clientes').update({ funnel_stage: newStage }).eq('client_id', clientId);
        if (error) throw error;
    }
  },

  loyalty: {
      getHistory: async (clientId: string): Promise<LoyaltyTransaction[]> => {
          const { data } = await supabase.from('loyalty_transactions').select('*').eq('client_id', clientId).order('created_at', { ascending: false });
          return (data || []).map((t: any) => ({
              id: t.id, clientId: t.client_id, amount: t.amount, description: t.description, createdAt: t.created_at, reservationId: t.reservation_id
          }));
      },
      addTransaction: async (clientId: string, amount: number, description: string, userId?: string) => {
          await supabase.from('loyalty_transactions').insert({ client_id: clientId, amount, description, created_by: userId });
          const { data: client } = await supabase.from('clientes').select('loyalty_balance').eq('client_id', clientId).single();
          await supabase.from('clientes').update({ loyalty_balance: (client?.loyalty_balance || 0) + amount }).eq('client_id', clientId);
      }
  },

  reservations: {
    getByClient: async (clientId: string): Promise<Reservation[]> => {
        const { data, error } = await supabase.from('reservas').select('*').eq('client_id', clientId).order('date', { ascending: false });
        if (error) return [];
        return db.reservations._mapReservations(data);
    },
    getByDateRange: async (startDate: string, endDate: string): Promise<Reservation[]> => {
        const { data, error } = await supabase.from('reservas').select('*').gte('date', startDate).lte('date', endDate);
        if (error) return [];
        return db.reservations._mapReservations(data);
    },
    getAll: async (): Promise<Reservation[]> => {
      const { data, error } = await supabase.from('reservas').select('*');
      if (error) throw error;
      return db.reservations._mapReservations(data);
    },
    _mapReservations: (data: any[]): Reservation[] => {
        return data.map((r: any) => ({
            id: r.id, 
            clientId: r.client_id || '', 
            clientName: r.client_name || 'Cliente',
            date: r.date, 
            time: r.time, 
            peopleCount: r.people_count || 0, 
            laneCount: r.lane_count || 0, 
            duration: r.duration || 0, 
            totalValue: r.total_value || 0, 
            eventType: r.event_type as EventType, 
            observations: r.observations, 
            status: r.status as ReservationStatus, 
            paymentStatus: r.payment_status as PaymentStatus, 
            createdAt: r.created_at, 
            guests: r.guests || [], 
            lanes: r.lanes || [],
            checkedInIds: r.checked_in_ids || [], 
            noShowIds: r.no_show_ids || [],
            hasTableReservation: r.has_table_reservation, 
            birthdayName: r.birthday_name, 
            tableSeatCount: r.table_seat_count,
            payOnSite: r.pay_on_site, 
            comandaId: r.comanda_id, 
            createdBy: r.created_by, 
            lanesAssigned: r.pistas_usadas || []
        }));
    },
    create: async (res: Reservation, createdByUserId?: string) => {
      const { error } = await supabase.from('reservas').insert({
        id: res.id, client_id: res.clientId || null, client_name: res.clientName, date: res.date, time: res.time,
        people_count: res.peopleCount, lane_count: res.laneCount, duration: res.duration, total_value: res.totalValue,
        event_type: res.eventType, observations: res.observations, status: res.status, payment_status: res.paymentStatus,
        created_at: res.createdAt, has_table_reservation: res.hasTableReservation, birthday_name: res.birthdayName,
        table_seat_count: res.tableSeatCount, created_by: createdByUserId || null
      });
      if (error) throw error;
      return res;
    },
    update: async (res: Reservation, updatedByUserId?: string, actionDetail?: string) => {
      const { error } = await supabase.from('reservas').update({
        date: res.date, time: res.time, people_count: res.peopleCount, lane_count: res.laneCount, duration: res.duration,
        total_value: res.totalValue, event_type: res.eventType, observations: res.observations, status: res.status,
        payment_status: res.paymentStatus, checked_in_ids: res.checkedInIds || [], 
        no_show_ids: res.noShowIds || [], has_table_reservation: res.hasTableReservation, 
        table_seat_count: res.tableSeatCount, pistas_usadas: res.lanesAssigned
      }).eq('id', res.id);
      if (error) throw error;
    }
  },

  settings: {
    get: async (): Promise<AppSettings> => {
      const { data: configData, error: configError } = await supabase.from('configuracoes').select('*').limit(1).maybeSingle();
      const { data: hoursData, error: hoursError } = await supabase.from('configuracao_horarios').select('*').order('day_of_week', { ascending: true });
      
      if (configError) console.error("Erro config:", configError);
      if (hoursError) console.error("Erro horários:", hoursError);

      let businessHours = [...INITIAL_SETTINGS.businessHours];
      if (hoursData?.length) {
         hoursData.forEach((row: any) => {
             if (row.day_of_week >= 0 && row.day_of_week <= 6) businessHours[row.day_of_week] = { isOpen: row.is_open, start: row.start_hour, end: row.end_hour };
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
        businessHours: businessHours, blockedDates: data.blocked_dates || []
      };
    },
    saveGeneral: async (s: AppSettings) => {
      const { error } = await supabase.from('configuracoes').upsert({
        id: 1, establishment_name: s.establishmentName, address: s.address, phone: s.phone,
        whatsapp_link: s.whatsappLink, logo_url: s.logoUrl, active_lanes: s.activeLanes,
        weekday_price: s.weekdayPrice, weekend_price: s.weekendPrice,
        online_payment_enabled: s.onlinePaymentEnabled, mercadopago_public_key: s.mercadopagoPublicKey,
        blocked_dates: s.blockedDates
      });
      if (error) throw error;
      window.dispatchEvent(new Event('settings_updated'));
    },
    saveHours: async (s: AppSettings) => {
      const hoursPayload = s.businessHours.map((h, index) => ({
          config_id: 1, day_of_week: index, is_open: h.isOpen, start_hour: h.start, end_hour: h.end
      }));
      const { error } = await supabase.from('configuracao_horarios').upsert(hoursPayload, { onConflict: 'config_id,day_of_week' });
      if (error) throw error;
    }
  }
};
