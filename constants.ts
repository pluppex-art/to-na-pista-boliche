
import { EventType, FunnelStage, ReservationStatus, UserRole, AppSettings, User } from './types';

export const MOCK_DELAY = 500;

export const EVENT_TYPES = Object.values(EventType);
export const FUNNEL_STAGES = Object.values(FunnelStage);
export const STATUSES = Object.values(ReservationStatus);
export const TAGS = ['Lead novo', 'Cliente recorrente', 'Aniversário', 'Empresa', 'VIP', 'Frio', 'Quente'];

// 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab
// Regras: 
// - Terça a Sexta: 18:00 as 00:00
// - Sabado e Domingo: 17:00 as 00:00
// - Segunda: Fechado
const DEFAULT_HOURS = [
  { isOpen: true, start: 17, end: 0 },  // Domingo
  { isOpen: false, start: 18, end: 0 }, // Segunda (Fechado)
  { isOpen: true, start: 18, end: 0 },  // Terça
  { isOpen: true, start: 18, end: 0 },  // Quarta
  { isOpen: true, start: 18, end: 0 },  // Quinta
  { isOpen: true, start: 18, end: 0 },  // Sexta
  { isOpen: true, start: 17, end: 0 },  // Sábado
];

export const INITIAL_SETTINGS: AppSettings = {
  establishmentName: 'Tô Na Pista Boliche',
  address: 'Av. Juscelino Kubitschek, 103 Norte - Segundo estacionamento - Centro, Palmas - TO, 77001-014',
  phone: '(63) 99117-8242',
  whatsappLink: 'https://wa.me/5563991178242',
  logoUrl: '',
  activeLanes: 6,
  weekdayPrice: 99.90, 
  weekendPrice: 140, 
  onlinePaymentEnabled: false,
  mercadopagoPublicKey: 'APP_USR-598f3b9a-91d1-419e-9b82-53b7afccd6e9', 
  mercadopagoAccessToken: '',
  mercadopagoClientId: '',      
  mercadopagoClientSecret: '',  
  businessHours: DEFAULT_HOURS,
  blockedDates: []
};

// Definição das chaves de permissão para facilitar a UI
export const PERMISSION_KEYS: { key: keyof User; label: string }[] = [
  { key: 'perm_view_agenda', label: 'Ver Agenda/Dashboard' },
  { key: 'perm_view_financial', label: 'Acesso Financeiro' },
  { key: 'perm_view_crm', label: 'Acesso Clientes (CRM)' },
  { key: 'perm_create_reservation', label: 'Criar Reservas' },
  { key: 'perm_create_reservation_no_contact', label: 'Criar s/ Contato Obrigatório' },
  { key: 'perm_edit_reservation', label: 'Editar Reservas' },
  { key: 'perm_delete_reservation', label: 'Excluir/Cancelar Reservas' },
  { key: 'perm_edit_client', label: 'Editar Clientes' },
  { key: 'perm_receive_payment', label: 'Receber Pagamentos (Checkout)' },
];

// Lista VAZIA para forçar o uso do Banco de Dados
export const SEED_USERS: User[] = [];

export const FIRST_NAMES = [];
export const LAST_NAMES = [];
export const SEED_CLIENTS = [];
export const SEED_RESERVATIONS = [];
export const SEED_FUNNEL = [];
