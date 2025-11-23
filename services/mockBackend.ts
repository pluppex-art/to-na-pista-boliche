
import { AppSettings, Client, FunnelCard, Interaction, Reservation, User, ReservationStatus, PaymentStatus, UserRole } from '../types';
import { supabase } from './supabaseClient';
import { INITIAL_SETTINGS } from '../constants';
import { v4 as uuidv4 } from 'uuid';

// Helper to transform Snake Case (DB) to Camel Case (App)
const toApp = (data: any): any => {
  if (!data) return null;
  if (Array.isArray(data)) return data.map(toApp);
  
  const newData: any = {};
  for (const key in data) {
    const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    newData[camelKey] = data[key];
  }
  return newData;
};

// Helper to transform Camel Case (App) to Snake Case (DB)
const toDB = (data: any): any => {
  if (!data) return null;
  const newData: any = {};
  for (const key in data) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    newData[snakeKey] = data[key];
  }
  return newData;
};

// --- REAL BACKEND INTERFACE ---

export const db = {
  users: {
    getAll: async (): Promise<User[]> => {
      const { data, error } = await supabase.from('usuarios').select('*');
      if (error) { console.error(error); return []; }
      // Map DB fields to User type manually if needed or use transformer
      return data.map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role as UserRole,
        passwordHash: u.password_hash
      }));
    },
    find: async (email: string): Promise<User | undefined> => {
      const { data, error } = await supabase.from('usuarios').select('*').eq('email', email).single();
      if (error || !data) return undefined;
      return {
        id: data.id,
        name: data.name,
        email: data.email,
        role: data.role as UserRole,
        passwordHash: data.password_hash
      };
    },
    create: async (user: User) => {
      const dbUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        password_hash: user.passwordHash
      };
      await supabase.from('usuarios').insert(dbUser);
    },
    delete: async (id: string) => {
      await supabase.from('usuarios').delete().eq('id', id);
    }
  },
  clients: {
    getAll: async (): Promise<Client[]> => {
      const { data, error } = await supabase.from('clientes').select('*');
      if (error) return [];
      return data.map((c: any) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        tags: c.tags || [],
        createdAt: c.created_at,
        lastContactAt: c.last_contact_at
      }));
    },
    create: async (client: Client): Promise<Client> => {
      const dbClient = {
        id: client.id,
        name: client.name,
        phone: client.phone,
        email: client.email,
        tags: client.tags,
        created_at: client.createdAt,
        last_contact_at: client.lastContactAt
      };
      const { data, error } = await supabase.from('clientes').insert(dbClient).select().single();
      if (error) throw error;
      return { ...client }; // Return payload or fetched data
    },
    update: async (client: Client) => {
      const dbClient = {
        name: client.name,
        phone: client.phone,
        email: client.email,
        tags: client.tags,
        last_contact_at: client.lastContactAt
      };
      await supabase.from('clientes').update(dbClient).eq('id', client.id);
    }
  },
  reservations: {
    getAll: async (): Promise<Reservation[]> => {
      const { data, error } = await supabase.from('reservas').select('*');
      if (error) return [];
      return data.map((r: any) => ({
        id: r.id,
        clientId: r.client_id,
        clientName: r.client_name,
        date: r.date,
        time: r.time,
        peopleCount: r.people_count,
        laneCount: r.lane_count,
        duration: r.duration,
        totalValue: r.total_value,
        eventType: r.event_type,
        observations: r.observations,
        status: r.status as ReservationStatus,
        paymentStatus: (r.payment_status || PaymentStatus.PENDENTE) as PaymentStatus,
        createdAt: r.created_at,
        lanes: r.lanes || [],
        guests: r.guests || []
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
        payment_status: res.paymentStatus || PaymentStatus.PENDENTE,
        created_at: res.createdAt,
        lanes: res.lanes,
        guests: res.guests
      };
      const { error } = await supabase.from('reservas').insert(dbRes);
      if (error) console.error("Error creating reservation:", error);
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
        guests: res.guests
      };
      await supabase.from('reservas').update(dbRes).eq('id', res.id);
    }
  },
  funnel: {
    getAll: async (): Promise<FunnelCard[]> => {
      const { data, error } = await supabase.from('funil_prospeccao').select('*');
      if (error) return [];
      return data.map((f: any) => ({
        id: f.id,
        clientId: f.client_id,
        clientName: f.client_name,
        stage: f.stage,
        eventType: f.event_type,
        desiredDate: f.desired_date,
        notes: f.notes
      }));
    },
    update: async (cards: FunnelCard[]) => {
      // Supabase upsert requires simpler logic or iterating. 
      // For drag and drop, we usually update one card. 
      // If passing array, we upsert all.
      const dbCards = cards.map(c => ({
        id: c.id,
        client_id: c.clientId,
        client_name: c.clientName,
        stage: c.stage,
        event_type: c.eventType,
        desired_date: c.desiredDate,
        notes: c.notes
      }));
      await supabase.from('funil_prospeccao').upsert(dbCards);
    },
    add: async (card: FunnelCard) => {
      const dbCard = {
        id: card.id,
        client_id: card.clientId,
        client_name: card.clientName,
        stage: card.stage,
        event_type: card.eventType,
        desired_date: card.desiredDate,
        notes: card.notes
      };
      await supabase.from('funil_prospeccao').insert(dbCard);
    }
  },
  interactions: {
    getAll: async (): Promise<Interaction[]> => {
      const { data, error } = await supabase.from('interacoes').select('*');
      if (error) return [];
      return data.map((i: any) => ({
        id: i.id,
        clientId: i.client_id,
        date: i.date,
        channel: i.channel,
        note: i.note
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
      // Assuming 'configuracoes' table has key-value pairs or a single row with id='DEFAULT'
      // Implementation: We'll fetch the row with id='DEFAULT' or create it
      const { data, error } = await supabase.from('configuracoes').select('*').eq('id', 'DEFAULT').single();
      
      if (error || !data) {
          // If not found, try to insert initial
          await supabase.from('configuracoes').insert({ id: 'DEFAULT', ...toDB(INITIAL_SETTINGS) });
          return INITIAL_SETTINGS;
      }
      return toApp(data) as AppSettings;
    },
    save: async (s: AppSettings) => {
      const dbSettings = { id: 'DEFAULT', ...toDB(s) };
      await supabase.from('configuracoes').upsert(dbSettings);
    }
  }
};
