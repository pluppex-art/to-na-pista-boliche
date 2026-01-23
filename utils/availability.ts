
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
  if (!dateStr) return false;
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
  const parts = dateStr.split('-');
  if (parts.length < 3) return null;
  
  const [y, m, d] = parts.map(Number);
  const date = new Date(y, m - 1, d);
  const dayOfWeek = date.getDay(); // 0 = Domingo
  return settings.businessHours[dayOfWeek];
};

/**
 * Calcula a disponibilidade de pistas para uma hora específica.
 */
export const checkHourCapacity = (
  hourInt: number,
  dateStr: string,
  allReservations: Reservation[],
  totalLanes: number,
  excludeReservationId?: string
): { occupied: number; left: number; available: boolean } => {
  
  const now = new Date();

  const dayReservations = allReservations.filter(r => {
    if (!r || r.date !== dateStr) return false;
    if (r.status === ReservationStatus.CANCELADA) return false;
    if (r.id === excludeReservationId) return false;

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

  dayReservations.forEach(r => {
    // Proteção contra r.time indefinido
    const timeStr = r.time || "00:00";
    const rStart = parseInt(timeStr.split(':')[0] || "0");
    const rEnd = rStart + (r.duration || 1);
    
    if (hourInt >= rStart && hourInt < rEnd) {
      occupied += (r.laneCount || 1);
    }
  });

  const left = totalLanes - occupied;
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
  if (!dateStr) return [];
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
