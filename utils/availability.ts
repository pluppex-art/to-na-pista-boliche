
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
 * Calcula a disponibilidade de pistas para uma hora específica.
 * REGRA CRÍTICA: Limite máximo inegociável de 6 pistas.
 */
export const checkHourCapacity = (
  hourInt: number,
  dateStr: string,
  allReservations: Reservation[],
  totalLanes: number,
  excludeReservationId?: string
): { occupied: number; left: number; available: boolean } => {
  
  const now = new Date();
  const MAX_LIMIT_LANES = 6; // Limite físico de pistas do boliche

  // Filtra reservas do dia (exceto canceladas e a própria reserva se estiver editando)
  const dayReservations = allReservations.filter(r => {
    if (r.date !== dateStr) return false;
    if (r.status === ReservationStatus.CANCELADA) return false;
    if (r.id === excludeReservationId) return false;

    // Regra de expiração de 30 minutos para reservas pendentes online
    if (r.status === ReservationStatus.PENDENTE && !r.payOnSite && r.createdAt) {
        const created = new Date(r.createdAt);
        const diffMinutes = (now.getTime() - created.getTime()) / (1000 * 60);
        if (diffMinutes >= 30) {
            return false; 
        }
    }

    return true;
  });

  let occupied = 0;

  // SOMA RIGOROSA: Itera por cada reserva e soma a quantidade de pistas (laneCount)
  dayReservations.forEach(r => {
    const rStart = parseInt(r.time.split(':')[0]);
    const rEnd = rStart + r.duration;
    // Se a hora consultada estiver dentro do intervalo ocupado pela reserva
    if (hourInt >= rStart && hourInt < rEnd) {
      occupied += (r.laneCount || 1);
    }
  });

  // O limite real disponível é o menor entre o configurado e o limite físico de 6
  const capacity = Math.min(totalLanes, MAX_LIMIT_LANES);
  const left = capacity - occupied;
  
  // Disponível apenas se houver pelo menos 1 pista vaga
  const available = left > 0; 

  return { 
    occupied, 
    left: Math.max(0, left), 
    available 
  };
};

/**
 * Gera todos os slots de horário para um dia, com status de disponibilidade e tempo.
 */
export const generateDailySlots = (
  dateStr: string,
  settings: AppSettings,
  allReservations: Reservation[],
  excludeReservationId?: string,
  isStaff: boolean = false
): TimeSlot[] => {
  const dayConfig = getDayConfiguration(dateStr, settings);
  const isBlocked = settings?.blockedDates?.includes(dateStr);

  if (!dayConfig || !dayConfig.isOpen || isBlocked) return [];

  let start = dayConfig.start;
  let end = dayConfig.end;
  
  if (end === 0) end = 24;
  if (end < start) end += 24;

  const isToday = isDateToday(dateStr);
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  const slots: TimeSlot[] = [];

  for (let h = start; h < end; h++) {
    const displayHourInt = h >= 24 ? h - 24 : h;
    const timeValue = `${String(displayHourInt).padStart(2, '0')}:00`; 

    const { left, available } = checkHourCapacity(
      displayHourInt,
      dateStr,
      allReservations,
      settings.activeLanes,
      excludeReservationId
    );

    let isPast = false;
    if (isToday) {
        if (displayHourInt < currentHour) {
            isPast = true;
        } else if (displayHourInt === currentHour) {
            if (isStaff) {
                isPast = currentMinute > 5; 
            } else {
                isPast = true; 
            }
        }
    }

    slots.push({
      time: timeValue,
      label: timeValue,
      available: available && !isPast, 
      left,
      isPast
    });
  }

  return slots;
};
