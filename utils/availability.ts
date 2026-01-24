
import { AppSettings, Reservation, ReservationStatus } from '../types';

export interface TimeSlot {
  time: string;
  label: string;
  available: boolean;
  left: number;
  isPast: boolean;
}

/**
 * Normalizador interno para garantir que as datas de comparação sejam limpas (YYYY-MM-DD)
 */
const cleanDateStr = (s: string): string => {
    if (!s) return '';
    return s.trim().split(/[\sT]/)[0];
};

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
  return cleanDateStr(dateStr) === todayStr;
};

/**
 * Obtém a configuração de horário para um dia específico da semana
 */
export const getDayConfiguration = (dateStr: string, settings: AppSettings) => {
  if (!dateStr || !settings) return null;
  const parts = cleanDateStr(dateStr).split('-');
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
  const targetDate = cleanDateStr(dateStr);

  const dayReservations = allReservations.filter(r => {
    if (!r || cleanDateStr(r.date) !== targetDate) return false;
    
    // NUNCA ignora Check-in ou Confirmada para liberação de vaga
    if (r.status === ReservationStatus.CANCELADA) return false;
    if (r.id === excludeReservationId) return false;

    // REGRA DE OURO: Se estiver pendente (do site), só ocupa vaga se tiver menos de 30min de criação.
    // Aumentamos para 31min para dar margem de segurança ao processamento do Mercado Pago.
    if (r.status === ReservationStatus.PENDENTE && !r.payOnSite && r.createdAt) {
        const created = new Date(r.createdAt);
        const diffMinutes = (now.getTime() - created.getTime()) / (1000 * 60);
        if (diffMinutes > 30) { 
            return false; // A vaga está livre para outro cliente, mesmo que o status ainda não tenha mudado no banco.
        }
    }

    return true;
  });

  let occupied = 0;

  dayReservations.forEach(r => {
    const rTime = String(r.time || "00:00");
    const rStart = parseInt(rTime.split(':')[0] || "0");
    const rDur = Number(r.duration) || 1;
    const rEnd = rStart + rDur;
    const rLanes = Number(r.laneCount) || 1;
    
    if (hourInt >= rStart && hourInt < rEnd) {
      occupied += rLanes;
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
  const targetDate = cleanDateStr(dateStr);
  if (!targetDate) return [];
  const dayConfig = getDayConfiguration(targetDate, settings);
  const isBlocked = settings?.blockedDates?.some(d => cleanDateStr(d) === targetDate);

  if (!dayConfig || !dayConfig.isOpen || isBlocked) return [];

  let start = Number(dayConfig.start);
  let end = Number(dayConfig.end);
  
  if (end === 0) end = 24;
  if (end < start) end += 24;

  const isToday = isDateToday(targetDate);
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  const slots: TimeSlot[] = [];

  for (let h = start; h < end; h++) {
    const displayHourInt = h >= 24 ? h - 24 : h;
    const timeValue = `${String(displayHourInt).padStart(2, '0')}:00`; 

    const { left, available } = checkHourCapacity(
      displayHourInt,
      targetDate,
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
                isPast = currentMinute > 10; 
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
