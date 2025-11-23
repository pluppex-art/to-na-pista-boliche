import { EventType, FunnelStage, ReservationStatus, UserRole } from './types';

export const MOCK_DELAY = 500;

export const EVENT_TYPES = Object.values(EventType);
export const FUNNEL_STAGES = Object.values(FunnelStage);
export const STATUSES = Object.values(ReservationStatus);
export const TAGS = ['Lead novo', 'Cliente recorrente', 'Aniversário', 'Empresa', 'VIP', 'Frio', 'Quente'];

export const INITIAL_SETTINGS = {
  establishmentName: 'Tô Na Pista Boliche',
  address: 'Av. das Américas, 5000 - Barra da Tijuca',
  phone: '(21) 99999-9999',
  whatsappLink: 'https://wa.me/5521999999999',
  activeLanes: 6,
  googleCalendarEnabled: false,
  calendarId: '',
  onlinePaymentEnabled: false,
  mercadopagoPublicKey: '',
  mercadopagoAccessToken: '',
  weekDayStart: 18,
  weekDayEnd: 0,
  weekendStart: 17,
  weekendEnd: 0
};

// Seeding Data - Cleaned for Production/Supabase Prep
export const SEED_USERS = [
  {
    id: 'u1',
    name: 'Admin Master',
    email: 'admin@tonapista.com',
    role: UserRole.ADMIN,
    passwordHash: '123456'
  }
];

// Empty Helpers (No longer needed for mock generation)
export const FIRST_NAMES = [];
export const LAST_NAMES = [];

// Empty Data
export const SEED_CLIENTS = [];
export const SEED_RESERVATIONS = [];
export const SEED_FUNNEL = [];