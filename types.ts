
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
  REEMBOLSADO = 'Reembolsado',
  // Fix: Added PENDENTE_ESTORNO to the enum to match values used in the system for failed automatic refunds
  PENDENTE_ESTORNO = 'Pendente Estorno'
}

export enum FunnelStage {
  NOVO = 'Novo contato',
  INTERESSADO = 'Interessado',
  AGENDADO = 'Agendado',
  POS_VENDA = 'Pós Venda',
  NO_SHOW = 'No Show'
}

export enum EventType {
  JOGO_NORMAL = 'Jogo normal',
  ANIVERSARIO = 'Aniversário',
  EMPRESA = 'Empresa',
  FAMILIA = 'Família',
  OUTRO = 'Outro'
}

export interface FunnelStageConfig {
    id: string;
    nome: string;
    ordem: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  passwordHash: string;
  perm_view_agenda: boolean;
  perm_view_financial: boolean;
  perm_view_crm: boolean;
  perm_create_reservation: boolean;
  perm_edit_reservation: boolean;
  perm_delete_reservation: boolean;
  perm_edit_client: boolean;
  perm_receive_payment: boolean;
  perm_create_reservation_no_contact: boolean;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
  password?: string;
  photoUrl?: string;
  address?: string;
  tags: string[];
  createdAt: string;
  lastContactAt: string;
  funnelStage?: string; 
  loyaltyBalance?: number;
}

export interface Feedback {
    id?: string;
    reserva_id: string;
    cliente_id: string;
    nota: number;
    comentario: string;
    created_at?: string;
}

export interface Suggestion {
    id?: string;
    cliente_id: string;
    titulo: string;
    descricao: string;
    status?: string;
    created_at?: string;
}

export interface LoyaltyTransaction {
  id: string;
  clientId: string;
  amount: number;
  description: string;
  createdAt: string;
  reservationId?: string;
}

export interface Guest {
  name: string;
  phone: string;
}

export interface Reservation {
  id: string;
  clientId: string;
  clientName: string; 
  date: string; 
  time: string; 
  peopleCount: number;
  laneCount: number;
  duration: number; 
  totalValue: number; 
  eventType: EventType;
  observations?: string;
  status: ReservationStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: string;
  createdAt: string;
  lanes?: number[]; 
  guests?: Guest[];
  checkedInIds?: string[]; 
  noShowIds?: string[]; 
  hasTableReservation?: boolean;
  birthdayName?: string;
  tableSeatCount?: number;
  payOnSite?: boolean;
  comandaId?: string;
  createdBy?: string;
  lanesAssigned?: number[];
  rating?: number;
}

export interface FunnelCard {
  id: string;
  clientId: string;
  clientName: string;
  stage: string;
  eventType: EventType;
  desiredDate?: string;
  notes?: string;
}

export interface AppSettings {
  establishmentName: string;
  address: string;
  phone: string;
  whatsappLink: string;
  logoUrl?: string; 
  activeLanes: number; 
  weekdayPrice: number; 
  weekendPrice: number; 
  onlinePaymentEnabled: boolean;
  mercadopagoPublicKey?: string;
  mercadopagoAccessToken?: string;
  mercadopagoClientId?: string;     
  mercadopagoClientSecret?: string; 
  businessHours: DayConfig[];
  blockedDates: string[];
}

export interface DayConfig {
  isOpen: boolean;
  start: number; 
  end: number;   
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  actionType: string;
  entityId?: string;
  details: string;
  createdAt: string;
}
