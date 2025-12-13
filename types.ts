
export enum UserRole {
  ADMIN = 'ADMIN',
  GESTOR = 'GESTOR', // Mantemos o ID interno GESTOR, mas na UI será "Usuário"
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
  passwordHash: string;
  
  // Novas Permissões Booleanas
  perm_view_agenda: boolean;
  perm_view_financial: boolean;
  perm_view_crm: boolean;
  perm_create_reservation: boolean;
  perm_edit_reservation: boolean;
  perm_delete_reservation: boolean;
  perm_edit_client: boolean;
  perm_receive_payment: boolean;
  perm_create_reservation_no_contact: boolean; // Nova permissão

  active?: boolean;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
  password?: string; // Campo para login do cliente
  photoUrl?: string; // URL da foto de perfil
  tags: string[];
  createdAt: string;
  lastContactAt: string;
  funnelStage?: FunnelStage; 
  // Fidelidade
  loyaltyBalance?: number;
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
  createdAt: string;
  lanes?: number[]; 
  guests?: Guest[];
  checkedInIds?: string[]; 
  noShowIds?: string[]; 
  
  // Novos campos para mesa
  hasTableReservation?: boolean;
  birthdayName?: string;
  tableSeatCount?: number;

  // Controle de Pagamento no Local e Comanda
  payOnSite?: boolean;
  comandaId?: string;

  // Auditoria
  createdBy?: string; // User ID of staff who created
  
  // Pistas Específicas (1, 2, 3...)
  lanesAssigned?: number[];
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

export interface DayConfig {
  isOpen: boolean;
  start: number; 
  end: number;   
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
  blockedDates: string[]; // Novas datas bloqueadas (YYYY-MM-DD)
}

// Nova Interface de Log
export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  actionType: string; // 'CREATE_RESERVATION', 'UPDATE_STATUS', 'PAYMENT', 'LOGIN'
  entityId?: string;
  details: string;
  createdAt: string;
}

export interface StaffPerformance {
  userId: string;
  userName: string;
  reservationsCreated: number;
  totalSales: number;
  reservationsConfirmed: number;
  lastActivity: string;
}
