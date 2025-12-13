
import { AppSettings, Reservation, ReservationStatus } from '../types';

export interface TimeSlot {
  time: string;
  label: string;
  available: boolean;
  left: number;
  isPast: boolean;
}

/**
 * Verifica se uma data específica é "Hoje"
 */
export const isDateToday = (dateStr: string): boolean => {
  const now = new Date();
  const todayStr = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0')
  ].join('-');
  return dateStr === todayStr;
};

/**
 * Obtém a configuração de horário para um dia específico da semana
 */
export const getDayConfiguration = (dateStr: string, settings: AppSettings) => {
  if (!dateStr || !settings) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dayOfWeek = date.getDay(); // 0 = Domingo
  return settings.businessHours[dayOfWeek];
};

/**
 * Calcula a disponibilidade de pistas para uma hora específica
 */
export const checkHourCapacity = (
  hourInt: number,
  dateStr: string,
  allReservations: Reservation[],
  totalLanes: number,
  excludeReservationId?: string
): { occupied: number; left: number; available: boolean } => {
  
  const now = new Date();

  // Filtra reservas do dia (exceto canceladas e a própria reserva se estiver editando)
  const dayReservations = allReservations.filter(r => {
    // 1. Filtros Básicos
    if (r.date !== dateStr) return false;
    if (r.status === ReservationStatus.CANCELADA) return false;
    if (r.id === excludeReservationId) return false;

    // 2. REGRA DE 30 MINUTOS (Verificação Dupla)
    // Se estiver Pendente, sem pagamento no local (payOnSite), e criada há mais de 30min,
    // consideramos o horário LIBERADO para cálculo de capacidade, 
    // mesmo que o status no banco ainda esteja como 'Pendente'.
    if (r.status === ReservationStatus.PENDENTE && !r.payOnSite && r.createdAt) {
        const created = new Date(r.createdAt);
        const diffMinutes = (now.getTime() - created.getTime()) / (1000 * 60);
        
        // Se passou de 30 minutos (com tolerância de alguns segundos), ignora esta reserva na contagem
        if (diffMinutes >= 30) {
            return false; // Trata como se a reserva não existisse (libera a vaga)
        }
    }

    return true;
  });

  let occupied = 0;

  dayReservations.forEach(r => {
    const rStart = parseInt(r.time.split(':')[0]);
    const rEnd = rStart + r.duration;
    // Verifica se a hora solicitada cai dentro desta reserva
    if (hourInt >= rStart && hourInt < rEnd) {
      occupied += r.laneCount;
    }
  });

  const left = totalLanes - occupied;
  const available = left > 0; // Disponibilidade básica (pelo menos 1 vaga)

  return { occupied, left, available };
};

/**
 * Gera todos os slots de horário para um dia, com status de disponibilidade e tempo
 * Agora aceita isStaff para aplicar regra de tolerância
 */
export const generateDailySlots = (
  dateStr: string,
  settings: AppSettings,
  allReservations: Reservation[],
  excludeReservationId?: string,
  isStaff: boolean = false
): TimeSlot[] => {
  const dayConfig = getDayConfiguration(dateStr, settings);
  
  // Se fechado ou sem config
  if (!dayConfig || !dayConfig.isOpen) return [];

  let start = dayConfig.start;
  let end = dayConfig.end;
  
  // Lógica de virada de noite (Ex: 18h as 02h)
  if (end === 0) end = 24;
  if (end < start) end += 24;

  const isToday = isDateToday(dateStr);
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  const slots: TimeSlot[] = [];

  for (let h = start; h < end; h++) {
    // Normaliza para exibição (25:00 -> 01:00)
    const displayHourInt = h >= 24 ? h - 24 : h;
    const timeLabel = `${displayHourInt}:00`;
    const timeValue = `${displayHourInt}:00`; // Formato salvo no banco

    // Checa capacidade física
    const { left, available } = checkHourCapacity(
      displayHourInt,
      dateStr,
      allReservations,
      settings.activeLanes,
      excludeReservationId
    );

    // LÓGICA DE PASSADO COM TOLERÂNCIA
    let isPast = false;
    if (isToday) {
        if (displayHourInt < currentHour) {
            isPast = true;
        } else if (displayHourInt === currentHour) {
            // Se for a hora atual:
            // Cliente: Bloqueado
            // Staff: Liberado até X minutos (ex: 5 min)
            if (isStaff) {
                isPast = currentMinute > 5; // Tolerância de 5 minutos
            } else {
                isPast = true; // Cliente não pode agendar hora atual
            }
        }
    }

    slots.push({
      time: timeValue,
      label: timeLabel,
      available: available && !isPast, // Disponível apenas se tiver vaga E não for passado
      left,
      isPast
    });
  }

  return slots;
};
