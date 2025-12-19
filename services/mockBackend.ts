
/**
 * DATABASE SERVICE (Anteriormente mockBackend.ts)
 * 
 * PRIORIDADE 1: SEGURANÇA & RLS (MASTER CONFIG)
 * -----------------------------------------------------------------------------
 * INSTRUÇÕES PARA O BANCO DE DADOS (Execute no SQL Editor do Supabase):
 * 
 * 1. Habilitar RLS em absolutamente todas as tabelas:
 *    ALTER TABLE configuracoes ENABLE ROW LEVEL SECURITY;
 *    ALTER TABLE reservas ENABLE ROW LEVEL SECURITY;
 *    ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
 *    ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
 *    ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
 *    ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
 *    ALTER TABLE configuracao_horarios ENABLE ROW LEVEL SECURITY;
 *    ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;
 * 
 * 2. Proteger Logs e Webhooks (Apenas Admin acessa):
 *    CREATE POLICY "Admin total logs" ON webhook_logs FOR ALL TO authenticated 
 *    USING (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND role = 'ADMIN'));
 * 
 * 3. Proteger Configurações (Apenas Edge Functions / Service Role acessam chaves):
 *    CREATE POLICY "Acesso restrito a configuracoes" ON configuracoes FOR ALL 
 *    TO service_role USING (true);
 * 
 * 4. Proteger Reservas (Clientes veem as suas, Equipe vê todas):
 *    CREATE POLICY "Clientes veem proprias reservas" ON reservas FOR SELECT 
 *    USING (auth.uid() = client_id);
 *    CREATE POLICY "Equipe vê todas as reservas" ON reservas FOR ALL 
 *    TO authenticated USING (true);
 * -----------------------------------------------------------------------------
 */

import { AppSettings, Client, FunnelCard, Interaction, Reservation, ReservationStatus, PaymentStatus, UserRole, FunnelStage, LoyaltyTransaction, AuditLog, StaffPerformance, User, EventType } from '../types';
import { supabase } from './supabaseClient';
import { INITIAL_SETTINGS, FUNNEL_STAGES } from '../constants';
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
          
          if (filters?.userId && filters.userId !== 'ALL') query = query.eq('user_id', filters.userId);
          if (filters?.actionType && filters.actionType !== 'ALL') query = query.eq('action_type', filters.actionType);
          if (filters?.startDate) query = query.gte('created_at', `${filters.startDate}T00:00:00`);
          if (filters?.endDate) query = query.lte('created_at', `${filters.endDate}T23:59:59`);

          const { data, error } = await query.limit(filters?.limit || 100);
          if (error) return [];
          
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
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });

        if (authError) return { error: 'E-mail ou senha inválidos.' };
        if (!authData.user) return { error: 'Usuário não encontrado.' };

        const { data, error } = await supabase.from('usuarios').select('*').eq('id', authData.user.id).maybeSingle();

        if (error) return { error: `Erro ao buscar perfil: ${error.message}` };
        if (!data) return { error: 'Perfil de usuário não configurado.' };
        if (data.ativo === false) return { error: 'Esta conta foi desativada.' };

        const roleNormalized = (data.role || '').toUpperCase() as UserRole;
        const isAdmin = roleNormalized === UserRole.ADMIN;
        
        db.audit.log(data.id, data.nome, 'LOGIN', 'Usuário realizou login no sistema administrativo');

        return {
          isFirstAccess: false, 
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
      } catch (err: any) {
        return { error: err.message || 'Erro inesperado no servidor.' };
      }
    },
    logout: async () => { await supabase.auth.signOut(); },
    getAll: async (): Promise<User[]> => {
      const { data, error } = await supabase.from('usuarios').select('*');
      if (error) return [];
      
      return data.map((u: any) => {
        const roleNormalized = (u.role || '').toUpperCase() as UserRole;
        const isAdmin = roleNormalized === UserRole.ADMIN;
        return {
          id: u.id,
          name: u.nome || 'Usuário', email: u.email || '', role: roleNormalized, passwordHash: '',
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
      const { data, error } = await supabase.from('usuarios').select('*').eq('id', id).maybeSingle();
      if (error || !data) return null;
      
      const roleNormalized = (data.role || '').toUpperCase() as UserRole;
      const isAdmin = roleNormalized === UserRole.ADMIN;

      return {
        id: data.id, name: data.nome || 'Usuário', email: data.email || '', role: roleNormalized, passwordHash: '',
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
        const { data, error } = await supabase.functions.invoke('manage-staff', {
            body: { 
                action: 'CREATE', 
                userData: { 
                    ...user, 
                    password: user.passwordHash 
                } 
            }
        });
        if (error || data?.error) throw new Error(data?.error || error.message);
    },
    update: async (user: User) => {
        const { data, error } = await supabase.functions.invoke('manage-staff', {
            body: { 
                action: 'UPDATE', 
                userData: { 
                    ...user, 
                    password: user.passwordHash 
                } 
            }
        });
        if (error || data?.error) throw new Error(data?.error || error.message);
    },
    delete: async (id: string) => {
        const { data, error } = await supabase.functions.invoke('manage-staff', {
            body: { action: 'DELETE', userData: { id } }
        });
        if (error || data?.error) throw new Error(data?.error || error.message);
    }
  },
  
  clients: {
    login: async (email: string, password: string): Promise<{ client?: Client; error?: string }> => {
      try {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) return { error: 'E-mail ou senha incorretos.' };
        const { data, error } = await supabase.from('clientes').select('*').eq('client_id', authData.user.id).maybeSingle();
        if (error || !data) return { error: 'Cadastro não localizado.' };

        return {
            client: {
                id: data.client_id, name: data.name, phone: data.phone, email: data.email, photoUrl: data.photo_url,
                tags: safeTags(data.tags), createdAt: data.created_at, lastContactAt: data.last_contact_at,
                funnelStage: data.funnel_stage, loyaltyBalance: data.loyalty_balance || 0
            }
        };
      } catch (err) { return { error: 'Erro inesperado.' }; }
    },
    forgotPassword: async (email: string) => {
        return await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/#/redefinir-senha` });
    },
    updatePassword: async (newPassword: string) => {
        return await supabase.auth.updateUser({ password: newPassword });
    },
    logout: async () => { await supabase.auth.signOut(); },
    register: async (client: Client, password: string): Promise<{ client?: Client; error?: string }> => {
        try {
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: client.email || '', password, options: { data: { name: client.name, phone: client.phone } }
            });
            if (authError) return { error: authError.message };
            const authId = authData.user?.id;
            if (!authId) return { error: 'Erro ao gerar ID.' };

            const phoneClean = cleanPhone(client.phone);
            const { data: existing } = await supabase.from('clientes').select('*').eq('phone', phoneClean).maybeSingle();

            if (existing) {
                await supabase.from('clientes').update({ email: client.email, client_id: authId }).eq('phone', phoneClean);
                return { client: { ...client, id: authId } };
            }

            const { error } = await supabase.from('clientes').insert({
                client_id: authId, name: client.name, phone: phoneClean, email: client.email,
                photo_url: client.photoUrl, tags: ['Novo Cadastro'], last_contact_at: new Date().toISOString(),
                created_at: new Date().toISOString(), funnel_stage: FunnelStage.NOVO, loyalty_balance: 0
            });
            if (error) return { error: error.message };
            return { client: { ...client, id: authId } };
        } catch (e: any) { return { error: String(e) }; }
    },
    getAll: async (): Promise<Client[]> => {
      const { data, error } = await supabase.from('clientes').select('*');
      if (error) return [];
      return data.map((c: any) => ({
          id: c.client_id, name: c.name || 'Sem Nome', phone: c.phone || '', email: c.email, photoUrl: c.photo_url,
          tags: safeTags(data.tags), createdAt: c.created_at, lastContactAt: c.last_contact_at,
          funnelStage: c.funnel_stage || FunnelStage.NOVO, loyaltyBalance: c.loyalty_balance || 0
      }));
    },
    getById: async (id: string): Promise<Client | null> => {
      const { data, error } = await supabase.from('clientes').select('*').eq('client_id', id).maybeSingle();
      if (error || !data) return null;
      return {
        id: data.client_id, name: data.name, phone: data.phone, email: data.email, photoUrl: data.photo_url,
        tags: safeTags(data.tags), createdAt: data.created_at, lastContactAt: data.last_contact_at,
        funnelStage: data.funnel_stage || FunnelStage.NOVO, loyaltyBalance: data.loyalty_balance || 0
      };
    },
    getByPhone: async (phone: string): Promise<Client | null> => {
      const { data, error } = await supabase.from('clientes').select('*').eq('phone', cleanPhone(phone)).maybeSingle();
      if (error || !data) return null;
      return {
        id: data.client_id, name: data.name, phone: data.phone, email: data.email, photoUrl: data.photo_url,
        tags: safeTags(data.tags), createdAt: data.created_at, lastContactAt: data.last_contact_at,
        funnelStage: data.funnel_stage || FunnelStage.NOVO, loyaltyBalance: data.loyalty_balance || 0
      };
    },
    create: async (client: Client, createdBy?: string): Promise<Client> => {
      const phoneClean = cleanPhone(client.phone);
      const { data: existing } = await supabase.from('clientes').select('*').eq('phone', phoneClean).maybeSingle();

      if (existing) {
          await supabase.from('clientes').update({ name: client.name, email: client.email || existing.email }).eq('client_id', existing.client_id);
          return { ...client, id: existing.client_id };
      }

      const { error } = await supabase.from('clientes').insert({
        client_id: client.id, name: client.name, phone: phoneClean, email: client.email || null,
        photo_url: client.photoUrl, tags: client.tags || [], last_contact_at: client.lastContactAt,
        created_at: client.createdAt, funnel_stage: client.funnelStage || FunnelStage.NOVO, loyalty_balance: 0
      });
      if (error) throw error;
      if (createdBy) db.audit.log(createdBy, 'STAFF', 'CREATE_CLIENT', `Criou cliente ${client.name}`, client.id);
      return client;
    },
    update: async (client: Client, updatedBy?: string) => {
      await supabase.from('clientes').update({
        name: client.name, phone: cleanPhone(client.phone), email: client.email || null,
        tags: client.tags, last_contact_at: client.lastContactAt, photo_url: client.photoUrl, funnel_stage: client.funnelStage
      }).eq('client_id', client.id);
      if (updatedBy) db.audit.log(updatedBy, 'STAFF', 'UPDATE_CLIENT', `Atualizou ${client.name}`, client.id);
    },
    updateStage: async (clientId: string, newStage: FunnelStage) => {
        await supabase.from('clientes').update({ funnel_stage: newStage }).eq('client_id', clientId);
    }
  },

  loyalty: {
      getHistory: async (clientId: string): Promise<LoyaltyTransaction[]> => {
          const { data, error } = await supabase.from('loyalty_transactions').select('*').eq('client_id', clientId).order('created_at', { ascending: false });
          if (error) return [];
          return data.map((t: any) => ({
              id: t.id, clientId: t.client_id, amount: t.amount, description: t.description, createdAt: t.created_at, reservationId: t.reservation_id
          }));
      },
      addTransaction: async (clientId: string, amount: number, description: string, userId?: string) => {
          const { error } = await supabase.from('loyalty_transactions').insert({ client_id: clientId, amount, description, created_by: userId });
          if (error) throw new Error(error.message);
          const { data: client } = await supabase.from('clientes').select('loyalty_balance').eq('client_id', clientId).single();
          await supabase.from('clientes').update({ loyalty_balance: (client?.loyalty_balance || 0) + amount }).eq('client_id', clientId);
          if (userId) db.audit.log(userId, 'STAFF', amount > 0 ? 'LOYALTY_ADD' : 'LOYALTY_REMOVE', `Ajuste ${amount} pts`, clientId);
      }
  },

  reservations: {
    getByClient: async (clientId: string): Promise<Reservation[]> => {
        const { data, error } = await supabase.from('reservas').select('*').eq('client_id', clientId).order('created_at', { ascending: false });
        return error ? [] : db.reservations._mapReservations(data);
    },
    getByDateRange: async (startDate: string, endDate: string): Promise<Reservation[]> => {
        const { data, error } = await supabase.from('reservas').select('*').gte('date', startDate).lte('date', endDate);
        return error ? [] : db.reservations._mapReservations(data);
    },
    getAll: async (): Promise<Reservation[]> => {
      const { data, error } = await supabase.from('reservas').select('*');
      return error ? [] : db.reservations._mapReservations(data);
    },
    _mapReservations: (data: any[]): Reservation[] => {
        return data.map((r: any) => ({
            id: r.id, clientId: r.client_id || '', clientName: r.client_name || 'Cliente',
            date: r.date, time: r.time, peopleCount: r.people_count, laneCount: r.lane_count, duration: r.duration, 
            totalValue: r.total_value, eventType: r.event_type as EventType, observations: r.observations, 
            status: (r.status as ReservationStatus) || ReservationStatus.PENDENTE,
            paymentStatus: (r.payment_status as PaymentStatus) || PaymentStatus.PENDENTE, 
            createdAt: r.created_at, guests: r.guests || [], lanes: r.lanes || [],
            checkedInIds: r.checked_in_ids || [], noShowIds: r.no_show_ids || [],
            hasTableReservation: r.has_table_reservation, birthdayName: r.birthday_name, tableSeatCount: r.table_seat_count,
            payOnSite: r.pay_on_site, comandaId: r.comanda_id, createdBy: r.created_by, lanesAssigned: r.pistas_usadas || []
        }));
    },
    create: async (res: Reservation, createdByUserId?: string) => {
      const { error } = await supabase.from('reservas').insert({
        id: res.id, client_id: res.clientId || null, client_name: res.clientName, date: res.date, time: res.time,
        people_count: res.peopleCount, lane_count: res.laneCount, duration: res.duration, total_value: res.totalValue,
        event_type: res.eventType, observations: res.observations, status: res.status, payment_status: res.paymentStatus,
        guests: res.guests, lanes: res.lanes, created_at: res.createdAt, checked_in_ids: res.checkedInIds || [], 
        no_show_ids: res.noShowIds || [], has_table_reservation: res.hasTableReservation, birthday_name: res.birthdayName,
        table_seat_count: res.tableSeatCount, pay_on_site: res.payOnSite, comanda_id: res.comandaId,
        created_by: createdByUserId || null, pistas_usadas: res.lanesAssigned
      });
      if (error) throw new Error(error.message);
      if (createdByUserId) db.audit.log(createdByUserId, 'STAFF', 'CREATE_RESERVATION', `Criou reserva ${res.clientName}`, res.id);
      return res;
    },
    update: async (res: Reservation, updatedByUserId?: string, actionDetail?: string) => {
      const { error } = await supabase.from('reservas').update({
        date: res.date, time: res.time, people_count: res.peopleCount, lane_count: res.laneCount, duration: res.duration,
        total_value: res.totalValue, event_type: res.eventType, observations: res.observations, status: res.status,
        payment_status: res.paymentStatus, guests: res.guests, checked_in_ids: res.checkedInIds || [], 
        no_show_ids: res.noShowIds || [], has_table_reservation: res.hasTableReservation, birthday_name: res.birthdayName,
        table_seat_count: res.tableSeatCount, pay_on_site: res.payOnSite, comanda_id: res.comandaId, pistas_usadas: res.lanesAssigned
      }).eq('id', res.id);
      if (error) throw new Error(error.message);
      if (updatedByUserId) db.audit.log(updatedByUserId, 'STAFF', 'UPDATE_RESERVATION', actionDetail || `Atualizou ${res.clientName}`, res.id);
    }
  },

  funnel: {
    getAll: async () => {
      const clients = await db.clients.getAll();
      return clients.map(c => ({
          id: c.id, clientId: c.id, clientName: c.name, stage: c.funnelStage || FunnelStage.NOVO,
          eventType: 'Outro' as any, notes: `Tel: ${c.phone}`
      }));
    },
    update: async (cards: FunnelCard[]) => { },
    add: async (card: FunnelCard) => { await db.clients.updateStage(card.clientId, card.stage); }
  },

  settings: {
    get: async (): Promise<AppSettings> => {
      const { data: configData } = await supabase.from('configuracoes').select(`
            establishment_name, address, phone, whatsapp_link, logo_url, active_lanes, weekday_price, 
            weekend_price, online_payment_enabled, mercadopago_public_key, blocked_dates
        `).limit(1).maybeSingle();

      const { data: hoursData } = await supabase.from('configuracao_horarios').select('*').order('day_of_week', { ascending: true });
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
        mercadopagoAccessToken: '', mercadopagoClientId: '', mercadopagoClientSecret: '',  
        businessHours: businessHours, blockedDates: data.blocked_dates || []
      };
    },
    saveGeneral: async (s: AppSettings) => {
      const dbSettings: any = {
        id: 1, establishment_name: s.establishmentName, address: s.address, phone: s.phone,
        whatsapp_link: s.whatsappLink, logo_url: s.logoUrl, active_lanes: s.activeLanes,
        weekday_price: s.weekdayPrice, weekend_price: s.weekendPrice,
        online_payment_enabled: s.onlinePaymentEnabled, mercadopago_public_key: s.mercadopagoPublicKey,
        blocked_dates: s.blockedDates
      };
      if (s.mercadopagoAccessToken) dbSettings.mercadopago_access_token = s.mercadopagoAccessToken;
      if (s.mercadopagoClientId) dbSettings.mercadopago_client_id = s.mercadopagoClientId;
      if (s.mercadopagoClientSecret) dbSettings.mercadopago_client_secret = s.mercadopagoClientSecret;

      const { error } = await supabase.from('configuracoes').upsert(dbSettings);
      window.dispatchEvent(new Event('settings_updated'));
      if (error) throw error;
    },
    saveHours: async (s: AppSettings) => {
      const hoursPayload = s.businessHours.map((h, index) => ({
          config_id: 1, day_of_week: index, is_open: h.isOpen, start_hour: h.start, end_hour: h.end
      }));
      const { error } = await supabase.from('configuracao_horarios').upsert(hoursPayload, { onConflict: 'config_id,day_of_week' });
      if (error) throw error;
    },
    save: async (s: AppSettings) => {
        await db.settings.saveGeneral(s);
        await db.settings.saveHours(s);
    }
  }
};
