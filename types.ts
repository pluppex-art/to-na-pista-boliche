
export enum UserRole {
  ADMIN = 'ADMIN',
  GESTOR = 'GESTOR',
  COMUM = 'COMUM'
}

export enum ReservationStatus {
  PENDENTE = 'Pendente',
  CONFIRMADA = 'Confirmada',
  CHECK_IN = 'Check-in',
  CANCELADA = 'Cancelada',
  NO_SHOW = 'No-show'
}

export enum PaymentStatus {
  PENDENTE = 'Pendente',
  PAGO = 'Pago',
  REEMBOLSADO = 'Reembolsado'
}

export enum FunnelStage {
  NOVO = 'Novo contato',
  INTERESSADO = 'Interessado',
  NEGOCIACAO = 'Negociação',
  AGENDADO = 'Agendado',
  POS_EVENTO = 'Pós-evento'
}

export enum EventType {
  JOGO_NORMAL = 'Jogo normal',
  ANIVERSARIO = 'Aniversário',
  EMPRESA = 'Empresa',
  FAMILIA = 'Família',
  OUTRO = 'Outro'
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  passwordHash: string; // Used for mock auth or custom table auth
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
  tags: string[];
  createdAt: string;
  lastContactAt: string;
}

export interface Guest {
  name: string;
  phone: string;
}

export interface Reservation {
  id: string;
  clientId: string;
  clientName: string; // Denormalized for easier UI
  date: string; // YYYY-MM-DD
  time: string; // HH:00
  peopleCount: number;
  laneCount: number;
  duration: number; // in hours
  totalValue: number; // in currency units
  eventType: EventType;
  observations?: string;
  status: ReservationStatus;
  paymentStatus: PaymentStatus;
  createdAt: string;
  lanes?: number[]; // e.g., [1, 2]
  guests?: Guest[];
}

export interface FunnelCard {
  id: string;
  clientId: string;
  clientName: string;
  stage: FunnelStage;
  eventType: EventType;
  desiredDate?: string;
  notes?: string;
}

export interface Interaction {
  id: string;
  clientId: string;
  date: string;
  channel: 'WhatsApp' | 'Telefone' | 'Presencial' | 'Outro';
  note: string;
}

export interface AppSettings {
  establishmentName: string;
  address: string;
  phone: string;
  whatsappLink: string;
  activeLanes: number; // 1 to 6
  // Calendar Integration
  googleCalendarEnabled: boolean;
  calendarId: string;
  // Payment Integration
  onlinePaymentEnabled: boolean;
  mercadopagoPublicKey?: string;
  mercadopagoAccessToken?: string;
  // Business Hours Config
  weekDayStart: number; // e.g. 18
  weekDayEnd: number;   // e.g. 0 (midnight) or 24
  weekendStart: number; // e.g. 17
  weekendEnd: number;   // e.g. 0
}