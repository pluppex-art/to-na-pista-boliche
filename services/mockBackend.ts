
import { AppSettings, Client, FunnelCard, Reservation, ReservationStatus, PaymentStatus, UserRole, FunnelStage, FunnelStageConfig, LoyaltyTransaction, AuditLog, User, EventType, Feedback, Suggestion } from '../types';
import { supabase } from './supabaseClient';
import { INITIAL_SETTINGS } from '../constants';
import { v4 as uuidv4 } from 'uuid';

const SETTINGS_ID = 'e7a04692-b6ea-4827-afca-53886112938c';

export const cleanPhone = (phone: string | null | undefined): string | null => {
  if (!phone) return null;
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length > 0 ? cleaned : null;
};

const safeTags = (tags: any): string[] => {
  if (Array.isArray(tags)) return tags;
  if (typeof tags === 'string') {
     return tags.includes(',') ? tags.split(',').map(t => t.trim()) : [tags];
  }
  return [];
};

const normalizeDate = (dateStr: any): string => {
    if (!dateStr) return '';
    const s = String(dateStr).trim();
    const match = s.match(/^\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
    if (s.includes('/')) {
        const parts = s.split(' ')[0].split('/');
        if (parts.length === 3) {
            const [d, m, y] = parts;
            return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
    }
    return s.substring(0, 10);
};

const normalizeTime = (timeStr: any): string => {
    if (!timeStr) return '00:00';
    const s = String(timeStr).trim();
    const parts = s.split(':');
    if (parts.length >= 2) {
        return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    }
    return s;
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
      const { error } = await supabase.from('sugestoes').insert({
        cliente_id: suggestion.cliente_id,
        titulo: suggestion.titulo,
        descricao: suggestion.descricao,
        status: 'Pendente'
      });
      if (error) throw error;
      return { success: true };
    }
  },

  audit: {
      log: async (userId: string, userName: string, actionType: string, details: string, entityId?: string) => {
          try {
              await supabase.from('audit_logs').insert({
                  user_id: userId, 
                  user_name: userName || 'Sistema', 
                  action_type: actionType, 
                  details: details, 
                  entity_id: entityId
              });
          } catch (e) { console.warn("[AUDIT LOG ERROR]", e); }
      },
      getLogs: async (filters?: { userId?: string, actionType?: string, startDate?: string, endDate?: string, limit?: number }): Promise<AuditLog[]> => {
          let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false });
          if (filters?.userId && filters.userId !== 'ALL') query = query.eq('user_id', filters.userId);
          if (filters?.actionType && filters.actionType !== 'ALL') query = query.eq('action_type', filters.actionType);
          if (filters?.startDate) query = query.gte('created_at', `${filters.startDate}T00:00:00`);
          if (filters?.endDate) query = query.lte('created_at', `${filters.endDate}T23:59:59`);
          const { data, error } = await query.limit(filters?.limit || 300);
          if (error) return [];
          return (data || []).map((l: any) => ({
              id: l.id, userId: l.user_id, userName: l.user_name || 'Sistema', actionType: l.action_type, entityId: l.entity_id, details: l.details, createdAt: l.created_at
          }));
      }
  },

  funnelStages: {
      getAll: async (): Promise<FunnelStageConfig[]> => {
          const { data, error } = await supabase.from('etapas_funil').select('*').order('ordem', { ascending: true });
          if (error) throw error;
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
      
      const mappedUser = {
        id: data.id, name: data.nome, email: data.email, role: data.role as UserRole, passwordHash: '',
        perm_view_agenda: data.role === 'ADMIN' ? true : (data.perm_view_agenda ?? false),
        perm_view_financial: data.role === 'ADMIN' ? true : (data.perm_view_financial ?? false),
        perm_view_crm: data.role === 'ADMIN' ? true : (data.perm_view_crm ?? false),
        perm_create_reservation: data.role === 'ADMIN' ? true : (data.perm_create_reservation ?? false),
        perm_edit_reservation: data.role === 'ADMIN' ? true : (data.perm_edit_reservation ?? false),
        perm_delete_reservation: data.role === 'ADMIN' ? true : (data.perm_delete_reservation ?? false),
        perm_edit_client: data.role === 'ADMIN' ? true : (data.perm_edit_client ?? false),
        perm_receive_payment: data.role === 'ADMIN' ? true : (data.perm_receive_payment ?? false),
        perm_create_reservation_no_contact: data.role === 'ADMIN' ? true : (data.perm_create_reservation_no_contact ?? false)
      };

      await db.audit.log(mappedUser.id, mappedUser.name, 'LOGIN', `Usuário realizou login no sistema.`);

      return { user: mappedUser };
    },
    logout: async () => { await supabase.auth.signOut(); },
    getAll: async (): Promise<User[]> => {
      const { data } = await supabase.from('usuarios').select('*');
      return (data || []).map((u: any) => ({
          id: u.id, name: u.nome, email: u.email, role: u.role, passwordHash: '',
          perm_view_agenda: u.role === 'ADMIN' || u.perm_view_agenda, perm_view_financial: u.role === 'ADMIN' || u.perm_view_financial,
          perm_view_crm: u.role === 'ADMIN' || u.perm_view_crm, perm_create_reservation: u.role === 'ADMIN' || u.perm_create_reservation,
          perm_edit_reservation: u.role === 'ADMIN' || u.perm_edit_reservation, perm_delete_reservation: u.role === 'ADMIN' || u.perm_delete_reservation,
          perm_edit_client: u.role === 'ADMIN' || u.perm_edit_client, perm_receive_payment: u.role === 'ADMIN' || u.perm_receive_payment,
          perm_create_reservation_no_contact: u.role === 'ADMIN' || u.perm_create_reservation_no_contact
      }));
    },
    getById: async (id: string): Promise<User | null> => {
      const { data } = await supabase.from('usuarios').select('*').eq('id', id).maybeSingle();
      if (!data) return null;
      return {
          id: data.id, name: data.nome, email: data.email, role: data.role, passwordHash: '',
          perm_view_agenda: data.role === 'ADMIN' || data.perm_view_agenda, perm_view_financial: data.role === 'ADMIN' || data.perm_view_financial,
          perm_view_crm: data.role === 'ADMIN' || data.perm_view_crm, perm_create_reservation: data.role === 'ADMIN' || data.perm_create_reservation,
          perm_edit_reservation: data.role === 'ADMIN' || data.perm_edit_reservation, perm_delete_reservation: data.role === 'ADMIN' || data.perm_delete_reservation,
          perm_edit_client: data.role === 'ADMIN' || data.perm_edit_client, perm_receive_payment: data.role === 'ADMIN' || data.perm_receive_payment,
          perm_create_reservation_no_contact: data.role === 'ADMIN' || data.perm_create_reservation_no_contact
      };
    }
  },
  
  clients: {
    login: async (email: string, password: string) => {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) return { error: authError.message };
      const { data, error } = await supabase.from('clientes').select('*').eq('client_id', authData.user.id).maybeSingle();
      if (error || !data) return { error: 'Perfil de cliente não encontrado.' };
      return { client: { id: data.client_id, name: data.name, phone: data.phone, email: data.email, photoUrl: data.photo_url, address: data.address, tags: safeTags(data.tags), createdAt: data.created_at, lastContactAt: data.last_contact_at, funnelStage: data.funnel_stage, loyaltyBalance: data.loyalty_balance || 0 } };
    },
    register: async (client: any, password: string) => {
      const { data: authData, error: authError } = await supabase.auth.signUp({ email: client.email, password: password, options: { data: { name: client.name } } });
      if (authError) return { error: authError.message };
      const phoneToInsert = cleanPhone(client.phone);
      const { data, error } = await supabase.from('clientes').insert({ client_id: authData.user.id, name: client.name, phone: phoneToInsert, email: client.email || null, address: client.address || null, tags: client.tags || [], funnel_stage: 'Novo', last_contact_at: new Date().toISOString() }).select().single();
      if (error) return { error: error.message };
      return { client: { id: data.client_id, name: data.name, phone: data.phone, email: data.email, photoUrl: data.photo_url, address: data.address, tags: safeTags(data.tags), createdAt: data.created_at, last_contact_at: data.last_contact_at, funnelStage: data.funnel_stage, loyaltyBalance: data.loyalty_balance || 0 } };
    },
    forgotPassword: async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/#/reset-password` });
      return { error: error?.message };
    },
    updatePassword: async (password: string) => {
        const { error } = await supabase.auth.updateUser({ password });
        return { success: !error, error: error?.message };
    },
    logout: async () => { await supabase.auth.signOut(); },
    getAll: async (from = 0, to = 999): Promise<{ data: Client[], count: number }> => {
      // Usando range para superar o limite de 1000 e trazer a contagem total
      const { data, error, count } = await supabase
        .from('clientes')
        .select('*', { count: 'exact' })
        .order('name', { ascending: true })
        .range(from, to);
        
      if (error) throw error;
      const mapped = (data || []).map((c: any) => ({ 
          id: c.client_id, 
          name: c.name || 'Sem Nome', 
          phone: c.phone || '', 
          email: c.email, 
          photoUrl: c.photo_url, 
          address: c.address, 
          tags: safeTags(c.tags), 
          createdAt: c.created_at, 
          lastContactAt: c.last_contact_at, 
          funnelStage: c.funnel_stage, 
          loyaltyBalance: c.loyalty_balance || 0 
      }));
      return { data: mapped, count: count || 0 };
    },
    getById: async (id: string): Promise<Client | null> => {
      const { data } = await supabase.from('clientes').select('*').eq('client_id', id).maybeSingle();
      if (!data) return null;
      return { id: data.client_id, name: data.name, phone: data.phone, email: data.email, photoUrl: data.photo_url, address: data.address, tags: safeTags(data.tags), createdAt: data.created_at, lastContactAt: data.last_contact_at, funnelStage: data.funnel_stage, loyaltyBalance: data.loyalty_balance || 0 };
    },
    getByPhone: async (phone: string | null): Promise<Client | null> => {
      const clean = cleanPhone(phone);
      if (!clean) return null;
      const { data } = await supabase.from('clientes').select('*').eq('phone', clean).maybeSingle();
      if (!data) return null;
      return { id: data.client_id, name: data.name, phone: data.phone, email: data.email, photoUrl: data.photo_url, address: data.address, tags: safeTags(data.tags), createdAt: data.created_at, lastContactAt: data.last_contact_at, funnelStage: data.funnel_stage, loyaltyBalance: data.loyalty_balance || 0 };
    },
    create: async (client: any, userId?: string): Promise<Client> => {
      const phoneCleaned = cleanPhone(client.phone);
      if (phoneCleaned) {
          const existing = await db.clients.getByPhone(phoneCleaned);
          if (existing) return existing;
      }
      const clientId = client.id || uuidv4();
      const { data, error } = await supabase.from('clientes').insert({ client_id: clientId, name: client.name, phone: phoneCleaned, email: client.email?.trim() || null, address: client.address || null, tags: client.tags || ['Lead'], funnel_stage: client.funnelStage || 'Novo', last_contact_at: new Date().toISOString() }).select().single();
      if (error) throw error;
      if (userId) {
          const staff = await db.users.getById(userId);
          db.audit.log(userId, staff?.name || 'STAFF', 'CREATE_CLIENT', `Criou cliente ${client.name}`, data.client_id);
      }
      return { id: data.client_id, name: data.name, phone: data.phone, email: data.email, photoUrl: data.photo_url, address: data.address, tags: safeTags(data.tags), createdAt: data.created_at, lastContactAt: data.last_contact_at, funnelStage: data.funnel_stage, loyaltyBalance: data.loyalty_balance || 0 };
    },
    update: async (client: Client, updatedBy?: string) => {
      const { error } = await supabase.from('clientes').update({ name: client.name, phone: cleanPhone(client.phone), email: client.email?.trim() || null, address: client.address || null, last_contact_at: client.lastContactAt, photo_url: client.photoUrl, funnel_stage: client.funnelStage }).eq('client_id', client.id);
      if (error) throw error;
      if (updatedBy) {
          const staff = await db.users.getById(updatedBy);
          db.audit.log(updatedBy, staff?.name || 'STAFF', 'UPDATE_CLIENT', `Atualizou dados do cliente ${client.name}`, client.id);
      }
    },
    updateStage: async (clientId: string, newStage: string) => {
        const { error } = await supabase.from('clientes').update({ funnel_stage: newStage }).eq('client_id', clientId);
        if (error) throw error;
    }
  },

  loyalty: {
      getHistory: async (clientId: string): Promise<LoyaltyTransaction[]> => {
          const { data } = await supabase.from('loyalty_transactions').select('*').eq('client_id', clientId).order('created_at', { ascending: false });
          return (data || []).map((t: any) => ({ id: t.id, clientId: t.client_id, amount: t.amount, description: t.description, createdAt: t.created_at, reservationId: t.reservation_id }));
      },
      addTransaction: async (clientId: string, amount: number, description: string, userId?: string) => {
          await supabase.from('loyalty_transactions').insert({ client_id: clientId, amount, description, created_by: userId });
          const { data: client } = await supabase.from('clientes').select('loyalty_balance').eq('client_id', clientId).single();
          await supabase.from('clientes').update({ loyalty_balance: (client?.loyalty_balance || 0) + amount }).eq('client_id', clientId);
      }
  },

  reservations: {
    getByClient: async (clientId: string): Promise<Reservation[]> => {
        const { data, error = null } = await supabase.from('reservas').select('*').eq('client_id', clientId).order('date', { ascending: false }).limit(500);
        if (error) return [];
        return db.reservations._mapReservations(data);
    },
    getByDateRange: async (startDate: string, endDate: string): Promise<Reservation[]> => {
        const { data, error = null } = await supabase.from('reservas').select('*').gte('date', startDate).lte('date', endDate).limit(2000);
        if (error) return [];
        return db.reservations._mapReservations(data);
    },
    getAll: async (): Promise<Reservation[]> => {
      const { data, error } = await supabase.from('reservas').select('*').order('date', { ascending: false }).limit(5000);
      if (error) throw error;
      return db.reservations._mapReservations(data);
    },
    _mapReservations: (data: any[]): Reservation[] => {
        return data.map((r: any) => {
            let rawStatus = String(r.status || 'Pendente').trim();
            let mappedStatus = ReservationStatus.PENDENTE;
            const lowStatus = rawStatus.toLowerCase();
            if (lowStatus.includes('check') || lowStatus.includes('in')) mappedStatus = ReservationStatus.CHECK_IN;
            else if (lowStatus === 'confirmada') mappedStatus = ReservationStatus.CONFIRMADA;
            else if (lowStatus === 'cancelada') mappedStatus = ReservationStatus.CANCELADA;
            else if (lowStatus === 'no-show' || lowStatus === 'no show') mappedStatus = ReservationStatus.NO_SHOW;
            const safeDuration = Math.max(1, Number(r.duration) || 1);
            const safeLanes = Math.max(1, Number(r.lane_count) || 1);
            return {
                id: r.id, 
                clientId: r.client_id || '', 
                clientName: r.client_name || 'Cliente',
                date: normalizeDate(r.date),
                time: normalizeTime(r.time), 
                peopleCount: Number(r.people_count) || 0, 
                laneCount: safeLanes, 
                duration: safeDuration,    
                totalValue: Number(r.total_value) || 0, 
                eventType: r.event_type as EventType, 
                observations: r.observations, 
                status: mappedStatus, 
                paymentStatus: r.payment_status as PaymentStatus, 
                paymentMethod: r.payment_method,
                paymentDetails: r.payment_details || [],
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
            };
        });
    },
    create: async (res: Reservation, createdByUserId?: string) => {
      const { error } = await supabase.from('reservas').insert({
        id: res.id, client_id: res.clientId || null, client_name: res.clientName, date: res.date, time: res.time,
        people_count: res.peopleCount, lane_count: res.laneCount, duration: res.duration, total_value: res.totalValue,
        event_type: res.eventType, observations: res.observations, status: res.status, payment_status: res.paymentStatus,
        payment_method: res.paymentMethod, payment_details: res.paymentDetails, created_at: res.createdAt, has_table_reservation: res.hasTableReservation, 
        birthday_name: res.birthdayName, table_seat_count: res.tableSeatCount, created_by: createdByUserId || null,
        pay_on_site: res.payOnSite || false, comanda_id: res.comandaId || null
      });
      if (error) throw error;

      if (createdByUserId) {
          const staff = await db.users.getById(createdByUserId);
          await db.audit.log(createdByUserId, staff?.name || 'EQUIPE', 'CREATE_RESERVATION', `Criou nova reserva para ${res.clientName} dia ${res.date} às ${res.time}`, res.id);
      }

      return res;
    },
    update: async (res: Reservation, updatedByUserId?: string, actionDetail?: string) => {
      const { error } = await supabase.from('reservas').update({
        date: res.date, time: res.time, people_count: res.peopleCount, lane_count: res.laneCount, duration: res.duration,
        total_value: res.totalValue, event_type: res.eventType, observations: res.observations, status: res.status,
        payment_status: res.paymentStatus, payment_method: res.paymentMethod, payment_details: res.paymentDetails,
        checked_in_ids: res.checkedInIds || [], no_show_ids: res.noShowIds || [], has_table_reservation: res.hasTableReservation, 
        /* Fix: Property 'table_seat_count' does not exist on type 'Reservation'. Changed to tableSeatCount. */
        table_seat_count: res.tableSeatCount, pistas_usadas: res.lanesAssigned,
        pay_on_site: res.payOnSite, comanda_id: res.comandaId
      }).eq('id', res.id);
      if (error) throw error;

      if (updatedByUserId) {
          const staff = await db.users.getById(updatedByUserId);
          const detail = actionDetail || `Alterou reserva de ${res.clientName} (Status: ${res.status})`;
          await db.audit.log(updatedByUserId, staff?.name || 'EQUIPE', 'UPDATE_RESERVATION', detail, res.id);
      }
    }
  },

  settings: {
    get: async (): Promise<AppSettings> => {
      const { data: configData } = await supabase.from('configuracoes').select('*').eq('id', SETTINGS_ID).maybeSingle();
      const { data: hoursData } = await supabase.from('configuracao_horarios').select('*').eq('unidade_id', SETTINGS_ID).order('day_of_week', { ascending: true });
      let businessHours = [...INITIAL_SETTINGS.businessHours];
      if (hoursData && hoursData.length > 0) {
         hoursData.forEach((row: any) => { if (row.day_of_week >= 0 && row.day_of_week <= 6) businessHours[row.day_of_week] = { isOpen: row.is_open, start: row.start_hour, end: row.end_hour }; });
      }
      const data = configData || {};
      return {
        establishmentName: data.establishment_name || INITIAL_SETTINGS.establishmentName,
        address: data.address || INITIAL_SETTINGS.address,
        phone: data.phone || INITIAL_SETTINGS.phone,
        whatsappLink: data.whatsapp_link || INITIAL_SETTINGS.whatsappLink || '',
        logoUrl: data.logo_url || INITIAL_SETTINGS.logoUrl || '',
        activeLanes: data.active_lanes ?? INITIAL_SETTINGS.activeLanes,
        weekdayPrice: data.weekday_price ?? INITIAL_SETTINGS.weekdayPrice,
        weekendPrice: data.weekend_price ?? INITIAL_SETTINGS.weekendPrice,
        onlinePaymentEnabled: data.online_payment_enabled ?? INITIAL_SETTINGS.onlinePaymentEnabled,
        mercadopagoPublicKey: data.mercadopago_public_key || INITIAL_SETTINGS.mercadopagoPublicKey,
        mercadopagoAccessToken: data.mercadopago_access_token || '',
        businessHours: businessHours, 
        blockedDates: data.blocked_dates || []
      };
    },
    saveGeneral: async (s: AppSettings) => {
      const { error } = await supabase.from('configuracoes').update({
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
        blocked_dates: s.blockedDates
      }).eq('id', SETTINGS_ID);
      if (error) throw error;
      window.dispatchEvent(new Event('settings_updated'));
    },
    saveHours: async (s: AppSettings) => {
      await supabase.from('configuracao_horarios').delete().eq('unidade_id', SETTINGS_ID);
      const hoursPayload = s.businessHours.map((h, index) => ({ unidade_id: SETTINGS_ID, day_of_week: index, is_open: h.isOpen, start_hour: h.start, end_hour: h.end }));
      const { error } = await supabase.from('configuracao_horarios').insert(hoursPayload);
      if (error) throw error;
    }
  }
};
