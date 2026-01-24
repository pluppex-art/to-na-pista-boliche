import { supabase } from './supabaseClient';
import { 
  Client, 
  Reservation, 
  User, 
  AppSettings, 
  FunnelStageConfig, 
  Feedback, 
  Suggestion, 
  LoyaltyTransaction,
  AuditLog,
  ReservationStatus,
  PaymentStatus,
  EventType
} from '../types';

// Utility to clean phone numbers by removing non-numeric characters
export const cleanPhone = (phone: string) => phone.replace(/\D/g, '');

// Internal mappers to translate Supabase snake_case fields to App camelCase interfaces
const mapClient = (c: any): Client => ({
  id: c.client_id || c.id,
  name: c.name || c.nome,
  phone: c.phone,
  email: c.email,
  photoUrl: c.photo_url,
  tags: c.tags || [],
  createdAt: c.created_at,
  lastContactAt: c.last_contact_at,
  funnelStage: c.funnel_stage,
  loyaltyBalance: c.loyalty_balance || 0
});

const mapReservation = (r: any): Reservation => ({
  id: r.id,
  clientId: r.client_id,
  clientName: r.client_name,
  date: r.date,
  time: r.time,
  peopleCount: r.people_count,
  laneCount: r.lane_count,
  duration: r.duration,
  totalValue: r.total_value,
  eventType: r.event_type as EventType,
  observations: r.observations,
  status: r.status as ReservationStatus,
  paymentStatus: r.payment_status as PaymentStatus,
  paymentMethod: r.payment_method,
  createdAt: r.created_at,
  lanesAssigned: r.lanes_assigned,
  checkedInIds: r.checked_in_ids,
  noShowIds: r.no_show_ids,
  hasTableReservation: r.has_table_reservation,
  birthdayName: r.birthday_name,
  tableSeatCount: r.table_seat_count,
  payOnSite: r.pay_on_site,
  comandaId: r.comanda_id,
  createdBy: r.created_by
});

const mapSettings = (s: any): AppSettings => ({
  establishmentName: s.establishment_name,
  address: s.address,
  phone: s.phone,
  whatsappLink: s.whatsapp_link,
  logoUrl: s.logo_url,
  activeLanes: s.active_lanes,
  weekdayPrice: s.weekday_price,
  weekendPrice: s.weekend_price,
  onlinePaymentEnabled: s.online_payment_enabled,
  mercadopagoPublicKey: s.mercadopago_public_key,
  mercadopagoAccessToken: s.mercadopago_access_token,
  businessHours: s.business_hours,
  blockedDates: s.blocked_dates || []
});

const mapAuditLog = (l: any): AuditLog => ({
  id: l.id,
  userId: l.user_id,
  userName: l.user_name || 'Usuário',
  actionType: l.action_type,
  entityId: l.entity_id,
  details: l.details,
  createdAt: l.created_at
});

// Main database API wrapper
export const db = {
  users: {
    getById: async (id: string) => {
      const { data } = await supabase.from('usuarios').select('*').eq('id', id).single();
      return data;
    },
    getAll: async () => {
      const { data } = await supabase.from('usuarios').select('*');
      return data || [];
    },
    login: async (email: string, pass: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) return { error: error.message };
      const { data: user } = await supabase.from('usuarios').select('*').eq('id', data.user.id).single();
      return { user };
    },
    logout: async () => {
      await supabase.auth.signOut();
    }
  },
  clients: {
    getAll: async () => {
      const { data } = await supabase.from('clientes').select('*');
      return (data || []).map(mapClient);
    },
    getById: async (id: string) => {
      const { data } = await supabase.from('clientes').select('*').eq('client_id', id).single();
      return data ? mapClient(data) : null;
    },
    getByPhone: async (phone: string) => {
      const { data } = await supabase.from('clientes').select('*').eq('phone', cleanPhone(phone)).maybeSingle();
      return data ? mapClient(data) : null;
    },
    login: async (email: string, pass: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) return { error: error.message };
      const { data: client } = await supabase.from('clientes').select('*').eq('id', data.user.id).single();
      return { client: client ? mapClient(client) : null };
    },
    register: async (client: any, pass: string) => {
      const { data, error } = await supabase.auth.signUp({ email: client.email, password: pass });
      if (error) return { error: error.message };
      const { data: newClient, error: clientError } = await supabase.from('clientes').insert({
        client_id: client.id,
        name: client.name,
        phone: cleanPhone(client.phone),
        email: client.email,
        tags: client.tags || [],
        funnel_stage: client.funnelStage || 'Novo contato'
      }).select().single();
      return { client: newClient ? mapClient(newClient) : null, error: clientError?.message };
    },
    // Fix: Redefined forgotPassword with clean URL and proper parameters
    forgotPassword: async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { 
          redirectTo: `${window.location.origin}/#/reset-password` 
      });
      return { error: error?.message };
    },
    updatePassword: async (password: string) => {
      const { error } = await supabase.auth.updateUser({ password });
      return { success: !error, error: error?.message };
    },
    update: async (client: any, userId?: string) => {
      const { error } = await supabase.from('clientes').update({
        name: client.name,
        phone: cleanPhone(client.phone),
        email: client.email,
        photo_url: client.photoUrl,
        tags: client.tags,
        funnel_stage: client.funnelStage
      }).eq('client_id', client.id);
      return { error: error?.message };
    },
    create: async (client: any, userId?: string) => {
      const { data } = await supabase.from('clientes').insert({
        client_id: client.id,
        name: client.name,
        phone: cleanPhone(client.phone),
        email: client.email,
        tags: client.tags || [],
        funnel_stage: client.funnelStage || 'Novo contato'
      }).select().single();
      return data ? mapClient(data) : null;
    },
    logout: async () => {
      await supabase.auth.signOut();
    },
    updateStage: async (clientId: string, stage: string) => {
      await supabase.from('clientes').update({ funnel_stage: stage }).eq('client_id', clientId);
    }
  },
  reservations: {
    getAll: async () => {
      const { data } = await supabase.from('reservas').select('*');
      return (data || []).map(mapReservation);
    },
    getByClient: async (clientId: string) => {
      const { data } = await supabase.from('reservas').select('*').eq('client_id', clientId);
      return (data || []).map(mapReservation);
    },
    getByDateRange: async (start: string, end: string) => {
      const { data } = await supabase.from('reservas').select('*').gte('date', start).lte('date', end);
      return (data || []).map(mapReservation);
    },
    create: async (res: Reservation, userId?: string) => {
      const { error } = await supabase.from('reservas').insert({
        id: res.id,
        client_id: res.clientId,
        client_name: res.clientName,
        date: res.date,
        time: res.time,
        people_count: res.peopleCount,
        lane_count: res.lane_count,
        duration: res.duration,
        total_value: res.totalValue,
        event_type: res.eventType,
        observations: res.observations,
        status: res.status,
        payment_status: res.paymentStatus,
        pay_on_site: res.payOnSite,
        comanda_id: res.comandaId,
        has_table_reservation: res.hasTableReservation,
        birthday_name: res.birthdayName,
        table_seat_count: res.tableSeatCount,
        created_by: userId
      });
      return { error: error?.message };
    },
    update: async (res: Reservation, userId?: string, logDetails?: string) => {
      const { error } = await supabase.from('reservas').update({
        client_id: res.clientId,
        date: res.date,
        time: res.time,
        lane_count: res.lane_count,
        people_count: res.peopleCount,
        duration: res.duration,
        total_value: res.totalValue,
        event_type: res.eventType,
        status: res.status,
        payment_status: res.paymentStatus,
        payment_method: res.paymentMethod,
        lanes_assigned: res.lanes_assigned,
        checked_in_ids: res.checked_in_ids,
        no_show_ids: res.no_show_ids,
        pay_on_site: res.pay_on_site,
        comanda_id: res.comandaId,
        observations: res.observations,
        has_table_reservation: res.hasTableReservation,
        birthday_name: res.birthdayName,
        table_seat_count: res.table_seat_count
      }).eq('id', res.id);
      
      if (logDetails && userId) {
        await db.audit.log(userId, 'UPDATE_RESERVATION', res.id, logDetails);
      }
      return { error: error?.message };
    }
  },
  settings: {
    get: async () => {
      const { data } = await supabase.from('configuracoes').select('*').single();
      return data ? mapSettings(data) : null;
    },
    saveGeneral: async (s: AppSettings) => {
      await supabase.from('configuracoes').update({
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
      }).eq('id', 1);
    },
    saveHours: async (s: AppSettings) => {
      await supabase.from('configuracoes').update({
        business_hours: s.businessHours
      }).eq('id', 1);
    }
  },
  funnelStages: {
    getAll: async () => {
      const { data } = await supabase.from('etapas_funil').select('*').order('ordem');
      return data || [];
    },
    create: async (nome: string, ordem: number) => {
      await supabase.from('etapas_funil').insert({ nome, ordem });
    },
    update: async (id: string, nome: string, ordem: number) => {
      await supabase.from('etapas_funil').update({ nome, ordem }).eq('id', id);
    },
    delete: async (id: string) => {
      await supabase.from('etapas_funil').delete().eq('id', id);
    }
  },
  loyalty: {
    getHistory: async (clientId: string) => {
      const { data } = await supabase.from('fidelidade_historico').select('*').eq('cliente_id', clientId);
      return (data || []).map(l => ({
        id: l.id,
        clientId: l.cliente_id,
        amount: l.amount,
        description: l.description,
        createdAt: l.created_at,
        reservationId: l.reservation_id
      }));
    }
  },
  audit: {
    getLogs: async (filters: any) => {
      let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false });
      if (filters.userId && filters.userId !== 'ALL') query = query.eq('user_id', filters.userId);
      if (filters.actionType && filters.actionType !== 'ALL') query = query.eq('action_type', filters.actionType);
      const { data } = await query;
      return (data || []).map(mapAuditLog);
    },
    log: async (userId: string, type: string, entityId: string | undefined, details: string) => {
      const { data: userData } = await supabase.from('usuarios').select('nome').eq('id', userId).single();
      await supabase.from('audit_logs').insert({ 
        user_id: userId, 
        user_name: userData?.nome || 'Equipe',
        action_type: type, 
        entity_id: entityId, 
        details 
      });
    }
  },
  feedbacks: {
    create: async (f: Feedback) => {
      await supabase.from('feedbacks').insert({
        reserva_id: f.reserva_id,
        cliente_id: f.cliente_id,
        nota: f.nota,
        comentario: f.comentario
      });
    }
  },
  suggestions: {
    create: async (s: Suggestion) => {
      await supabase.from('sugestoes').insert({
        cliente_id: s.cliente_id,
        titulo: s.titulo,
        descricao: s.descricao
      });
    }
  }
};