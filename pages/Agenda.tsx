
import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../services/mockBackend';
import { supabase } from '../services/supabaseClient';
import { Reservation, ReservationStatus, EventType, UserRole, PaymentStatus, User } from '../types';
import { useApp } from '../contexts/AppContext'; 
import { generateDailySlots, checkHourCapacity, getDayConfiguration } from '../utils/availability'; 
import { 
  ChevronLeft, ChevronRight, Loader2, Plus, X, Ban, AlertTriangle, LayoutGrid, Check, MessageCircle, CreditCard, Clock, UserCheck, DollarSign, CalendarOff, Moon, AlertCircle, PlayCircle, Timer
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

// Componentes Modulares
import { MetricCards } from '../components/Agenda/MetricCards';
import { ReservationCard } from '../components/Agenda/ReservationCard';
import { InfoModal } from '../components/Agenda/InfoModal';
import { EditModal } from '../components/Agenda/EditModal';

interface GlobalAlert {
    type: 'SITE_URGENTE' | 'ATRASO_CHECKIN' | 'AGUARDANDO_INICIO' | 'PENDENCIA_PASSADA' | 'PARTIDA_ENCERRADA' | 'COMANDA_HOJE';
    message: string;
    res: Reservation;
    color: string;
    icon: React.ReactNode;
}

const Agenda: React.FC = () => {
  const navigate = useNavigate();
  const { settings, user: currentUser } = useApp(); 
  
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  });

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [allReservationsForAlerts, setAllReservationsForAlerts] = useState<Reservation[]>([]);
  const [clientPhones, setClientPhones] = useState<Record<string, string>>({});
  const [staffMap, setStaffMap] = useState<Record<string, string>>({}); 
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  
  const [metrics, setMetrics] = useState({ totalSlots: 0, pendingSlots: 0, confirmedSlots: 0, checkInSlots: 0, noShowSlots: 0 });
  const [selectedRes, setSelectedRes] = useState<Reservation | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  
  const [showLaneSelector, setShowLaneSelector] = useState(false);
  const [laneSelectorTargetRes, setLaneSelectorTargetRes] = useState<Reservation | null>(null);
  const [tempSelectedLanes, setTempSelectedLanes] = useState<number[]>([]);
  
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const canEdit = currentUser?.role === UserRole.ADMIN || currentUser?.perm_edit_reservation;
  const canCreateReservation = currentUser?.role === UserRole.ADMIN || currentUser?.perm_create_reservation;

  const dayStatus = useMemo(() => {
    if (!settings) return { isClosed: false, reason: '' };
    const cleanSelected = selectedDate.trim().substring(0, 10);
    const isBlocked = settings.blockedDates?.some(d => d.trim().substring(0, 10) === cleanSelected);
    if (isBlocked) return { isClosed: true, reason: 'ESTABELECIMENTO FECHADO NESTE DIA' };
    
    const config = getDayConfiguration(selectedDate, settings);
    if (!config || !config.isOpen) return { isClosed: true, reason: 'ESTABELECIMENTO FECHADO NESTE DIA' };
    
    return { isClosed: false, reason: '' };
  }, [selectedDate, settings]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10000); 
    return () => clearInterval(timer);
  }, []);

  const loadData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const [allReservations, allClients, allUsers] = await Promise.all([
          db.reservations.getAll(),
          db.clients.getAll(),
          db.users.getAll()
      ]);

      const validReservations = (allReservations || []).filter(r => r && r.id);
      setAllReservationsForAlerts(validReservations);

      const phoneMap: Record<string, string> = {};
      (allClients || []).forEach(c => { if(c && c.id) phoneMap[c.id] = c.phone; });
      setClientPhones(phoneMap);

      const uMap: Record<string, string> = {};
      (allUsers || []).forEach(u => { uMap[u.id] = u.name; });
      setStaffMap(uMap);

      const dayReservations = validReservations
        .filter(r => {
            const rDate = String(r.date || "").trim().substring(0, 10);
            const sDate = String(selectedDate || "").trim().substring(0, 10);
            const isTodayRes = rDate === sDate;
            
            if (!isTodayRes) return false;
            if (r.status === ReservationStatus.CANCELADA) return false;

            // FILTRO DE LIMPEZA VISUAL: Se a reserva estiver pendente e tiver mais de 45 minutos (margem de erro do robô cron)
            // nós não mostramos ela na agenda principal para não confundir o staff.
            if (r.status === ReservationStatus.PENDENTE && !r.payOnSite && r.createdAt) {
                const created = new Date(r.createdAt).getTime();
                const diffMin = (now.getTime() - created) / 60000;
                if (diffMin > 45) return false; 
            }

            return true;
        })
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

      setReservations(dayReservations);

      let total = 0, pending = 0, confirmed = 0, checkIn = 0, noShow = 0;
      dayReservations.forEach(r => {
          const lCount = Math.max(1, r.laneCount || 1);
          const dur = Math.max(1, Math.ceil(r.duration || 1));
          const slotCount = lCount * dur;
          
          total += slotCount;
          if (r.status === ReservationStatus.CHECK_IN) checkIn += (r.checkedInIds?.length || lCount);
          else if (r.status === ReservationStatus.NO_SHOW) noShow += (r.noShowIds?.length || 0);
          
          if (r.paymentStatus === PaymentStatus.PENDENTE) pending += slotCount;
          else confirmed += slotCount;
      });

      setMetrics({ totalSlots: total, pendingSlots: pending, confirmedSlots: confirmed, checkInSlots: checkIn, noShowSlots: noShow });
    } finally { if (!isBackground) setLoading(false); }
  };

  useEffect(() => { 
    loadData();
    const channel = supabase.channel(`agenda-sync-realtime`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas' }, () => loadData(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedDate]);

  const alerts = useMemo(() => {
      const globalAlerts: GlobalAlert[] = [];
      const todayStr = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
      const todayDate = new Date(todayStr + 'T00:00:00');

      allReservationsForAlerts.forEach(res => {
          if (!res || res.status === ReservationStatus.CANCELADA || res.paymentStatus === PaymentStatus.PAGO) return;

          if (res.status === ReservationStatus.PENDENTE && !res.payOnSite && res.createdAt) {
              const created = new Date(res.createdAt).getTime();
              const diffMinutes = (now.getTime() - created) / 60000;
              if (diffMinutes >= 0 && diffMinutes < 30) {
                  const isUrgent = diffMinutes >= 20;
                  globalAlerts.push({ 
                    type: 'SITE_URGENTE', 
                    message: `SITE: Pagamento de ${res.clientName} expira em ${Math.ceil(30 - diffMinutes)}min`, 
                    res, 
                    icon: <CreditCard size={20} className="animate-pulse"/>,
                    color: isUrgent ? 'border-red-500 bg-red-950/60 text-red-100 shadow-red-500/20' : 'border-orange-500 bg-orange-950/40 text-orange-100 shadow-orange-500/10' 
                  });
              }
              return; 
          }

          const resDate = new Date(res.date + 'T00:00:00');
          if (resDate < todayDate) {
              const diffTime = Math.abs(todayDate.getTime() - resDate.getTime());
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              globalAlerts.push({
                  type: 'PENDENCIA_PASSADA',
                  message: `PENDÊNCIA PASSADA (${diffDays}d atrás): ${res.clientName} - ${res.date.split('-').reverse().join('/')}`,
                  res,
                  icon: <AlertTriangle size={20} />,
                  color: 'border-red-600 bg-red-900/60 text-white shadow-xl animate-pulse'
              });
          } else if (res.date === todayStr) {
              const startTime = new Date(res.date + 'T' + (res.time.length === 5 ? res.time : res.time.slice(0,5)));
              const endTime = new Date(startTime.getTime() + (res.duration * 60 * 60 * 1000));

              if (res.status === ReservationStatus.CHECK_IN) {
                  if (now >= endTime) {
                      globalAlerts.push({
                          type: 'PARTIDA_ENCERRADA',
                          message: `FINALIZADO: ${res.clientName} encerrou às ${res.time} + ${res.duration}h. DAR BAIXA!`,
                          res,
                          icon: <DollarSign size={20} />,
                          color: 'border-blue-500 bg-blue-900/40 text-white shadow-lg'
                      });
                  } else {
                      globalAlerts.push({
                          type: 'COMANDA_HOJE',
                          message: `EM JOGO: ${res.clientName} (Pista ${res.lanesAssigned?.join(',') || 'S/N'}) - Pagamento pendente`,
                          res,
                          icon: <PlayCircle size={20} className="text-green-400" />,
                          color: 'border-green-600/30 bg-slate-900/80 text-slate-200'
                      });
                  }
              } else {
                  globalAlerts.push({ 
                    type: 'COMANDA_HOJE', 
                    message: `COMANDA HOJE: ${res.clientName} às ${res.time} - Pagamento no Local pendente.`, 
                    res, 
                    icon: <Timer size={20} className="text-yellow-500" />,
                    color: 'border-yellow-600/40 bg-yellow-950/20 text-yellow-100' 
                  });
              }
          }
      });
      
      return globalAlerts.sort((a,b) => {
          const order = { 'PENDENCIA_PASSADA': 0, 'PARTIDA_ENCERRADA': 1, 'SITE_URGENTE': 2, 'COMANDA_HOJE': 3 };
          return order[a.type] - order[b.type];
      });
  }, [allReservationsForAlerts, now]);

  const handleGranularStatus = async (e: React.MouseEvent | null, res: Reservation, uniqueId: string, type: 'CHECK_IN' | 'NS') => {
      if (e) e.stopPropagation(); 
      if (!canEdit) return; 

      let newCheckedInIds = [...(res.checkedInIds || [])];
      let newNoShowIds = [...(res.noShowIds || [])];

      if (type === 'CHECK_IN') {
          if (newCheckedInIds.includes(uniqueId)) newCheckedInIds = newCheckedInIds.filter(id => id !== uniqueId);
          else { newCheckedInIds.push(uniqueId); newNoShowIds = newNoShowIds.filter(id => id !== uniqueId); }
      } else {
          if (newNoShowIds.includes(uniqueId)) newNoShowIds = newNoShowIds.filter(id => id !== uniqueId);
          else { newNoShowIds.push(uniqueId); newCheckedInIds = newCheckedInIds.filter(id => id !== uniqueId); }
      }

      let newStatus = res.status;
      if (newCheckedInIds.length > 0) newStatus = ReservationStatus.CHECK_IN;
      else if (newNoShowIds.length > 0) newStatus = ReservationStatus.NO_SHOW;
      else newStatus = ReservationStatus.CONFIRMADA;

      const updatedRes = { ...res, status: newStatus, checkedInIds: newCheckedInIds, noShowIds: newNoShowIds };
      await db.reservations.update(updatedRes, currentUser?.id, `${type} granular`);
      
      if (type === 'CHECK_IN' && !res.checkedInIds?.includes(uniqueId)) {
          setLaneSelectorTargetRes(updatedRes);
          setTempSelectedLanes(updatedRes.lanesAssigned || []);
          setShowLaneSelector(true);
      } else { loadData(true); }
  };

  const handleQuickCheckout = (res: Reservation) => {
    navigate('/checkout', { 
        state: { 
            clientId: res.clientId, 
            name: res.clientName, 
            whatsapp: clientPhones[res.clientId] || '',
            date: res.date, 
            time: res.time, 
            people: res.peopleCount, 
            lanes: res.laneCount,
            duration: res.duration, 
            type: res.eventType, 
            totalValue: res.totalValue, 
            reservationIds: [res.id]
        } 
    });
  };

  const saveLaneSelection = async () => {
      if (!laneSelectorTargetRes) return;
      const updatedRes = { ...laneSelectorTargetRes, lanesAssigned: tempSelectedLanes };
      await db.reservations.update(updatedRes, currentUser?.id, 'Atribuiu pistas');
      setShowLaneSelector(false);
      setLaneSelectorTargetRes(null);
      if (selectedRes && selectedRes.id === updatedRes.id) { setSelectedRes(updatedRes); }
      loadData(true);
  };

  const handleStatusChange = async (status: ReservationStatus) => {
    if (!selectedRes) return;
    if (status === ReservationStatus.CONFIRMADA) {
        handleQuickCheckout(selectedRes);
        return;
    }
    const updated = { ...selectedRes, status };
    await db.reservations.update(updated, currentUser?.id, `Alterou para ${status}`);
    setSelectedRes(updated); 
    loadData(true); 
  };

  const handleSaveFullEdit = async (editForm: Partial<Reservation>) => {
      if (!selectedRes) return;
      const allRes = await db.reservations.getAll();
      const timeStr = editForm.time || selectedRes.time || "00:00";
      const timeParts = timeStr.split(':');
      const startH = parseInt(timeParts[0] || "0");
      const dur = editForm.duration || selectedRes.duration || 1;
      const date = editForm.date || selectedRes.date || "";
      const lanes = editForm.laneCount || selectedRes.laneCount || 1;

      for (let i = 0; i < dur; i++) {
          const { left } = checkHourCapacity(startH + i, date, allRes, settings.activeLanes, selectedRes.id);
          if (left < lanes) {
              alert(`Indisponível! Apenas ${left} pistas livres às ${startH + i}:00.`);
              return;
          }
      }

      const finalUpdate = { ...selectedRes, ...editForm } as Reservation;
      await db.reservations.update(finalUpdate, currentUser?.id, 'Edição completa');
      setSelectedRes(finalUpdate);
      setIsEditMode(false);
      loadData(true);
  };

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '---';
    const parts = dateStr.trim().substring(0, 10).split('-');
    if (parts.length < 3) return dateStr;
    return parts.reverse().join('/');
  };

  const timeSlots = useMemo(() => generateDailySlots(selectedDate, settings, []), [selectedDate, settings]);

  return (
    <div className="flex flex-col h-full space-y-6 pb-20 md:pb-0">
      
      {alerts.length > 0 && (
          <div className="space-y-2 sticky top-0 z-50 md:relative max-h-[400px] overflow-y-auto no-scrollbar pb-4">
              {alerts.map((alert, i) => (
                  <div key={`${alert.res.id}-${i}`} className={`p-4 rounded-2xl border shadow-2xl animate-fade-in transition-all backdrop-blur-md ${alert.color}`}>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-3 cursor-pointer group flex-1 min-w-0" onClick={() => { setSelectedRes(alert.res); setIsEditMode(false); }}>
                              <div className="shrink-0">{alert.icon}</div>
                              <div className="min-w-0 flex-1">
                                  <p className="text-[9px] font-black uppercase tracking-[0.2em] mb-1 opacity-60">
                                      {alert.type.replace('_', ' ')}
                                  </p>
                                  <p className="text-sm font-bold group-hover:underline transition-all truncate">{alert.message}</p>
                              </div>
                          </div>
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                              {(alert.type !== 'ATRASO_CHECKIN') && (
                                  <button onClick={() => handleQuickCheckout(alert.res)} className="flex-1 sm:flex-none bg-white text-slate-900 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-2 transition active:scale-95 shadow-xl border border-white/20">
                                      <DollarSign size={16}/> Receber / Baixa
                                  </button>
                              )}
                          </div>
                      </div>
                  </div>
              ))}
          </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-6">
        <div><h1 className="text-3xl font-black text-white tracking-tight uppercase leading-none">Agendamento</h1><p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Painel Operacional • {formatDateDisplay(selectedDate)}</p></div>
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            <div className="flex items-center gap-4 bg-slate-800 p-2 rounded-2xl border border-slate-700 shadow-xl w-full md:w-auto justify-between md:justify-start">
                <button onClick={() => { 
                    const parts = selectedDate.split('-').map(Number); 
                    const nd = new Date(parts[0], parts[1]-1, parts[2]-1); 
                    setSelectedDate([nd.getFullYear(),String(nd.getMonth()+1).padStart(2,'0'),String(nd.getDate()).padStart(2,'0')].join('-')); 
                }} className="p-2 hover:bg-slate-700 rounded-full text-slate-300 transition-colors"><ChevronLeft size={20} /></button>
                <input type="date" className="bg-transparent text-white font-black text-center focus:outline-none uppercase text-xs tracking-widest cursor-pointer" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}/>
                <button onClick={() => { 
                    const parts = selectedDate.split('-').map(Number); 
                    const nd = new Date(parts[0], parts[1]-1, parts[2]+1); 
                    setSelectedDate([nd.getFullYear(),String(nd.getMonth()+1).padStart(2,'0'),String(nd.getDate()).padStart(2,'0')].join('-')); 
                }} className="p-2 hover:bg-slate-700 rounded-full text-slate-300 transition-colors"><ChevronRight size={20} /></button>
            </div>
            {canCreateReservation && <Link to="/agendamento" className="bg-neon-orange hover:bg-orange-600 text-white px-8 py-3 rounded-2xl font-black shadow-xl flex items-center justify-center gap-2 transition transform active:scale-95 w-full sm:w-auto uppercase text-xs tracking-[0.2em]"><Plus size={20} /> Nova Reserva</Link>}
        </div>
      </div>

      <MetricCards metrics={metrics} loading={loading} />

      <div className="flex-1 bg-slate-800 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl flex flex-col min-h-[500px]">
        {loading ? (
            <div className="flex-1 flex justify-center items-center"><Loader2 className="animate-spin text-neon-blue" size={48} /></div>
        ) : dayStatus.isClosed ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-6 animate-fade-in bg-slate-900/50">
                <div className="w-32 h-32 bg-slate-800 rounded-[2.5rem] flex items-center justify-center text-slate-600 border-2 border-dashed border-slate-700 shadow-inner group">
                    <CalendarOff size={64} className="group-hover:rotate-12 transition-transform duration-500" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl md:text-4xl font-black text-white uppercase tracking-tighter">{dayStatus.reason}</h2>
                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs max-w-md mx-auto">Não há horários de funcionamento configurados ou esta data foi bloqueada manualmente nas configurações.</p>
                </div>
                <div className="flex items-center gap-2 px-6 py-3 bg-slate-800 rounded-2xl border border-slate-700 text-slate-400 font-black text-[10px] uppercase tracking-[0.2em]">
                    <Moon size={16} /> Loja em Repouso
                </div>
            </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar">
             {timeSlots.map(slot => {
               const timeParts = slot.time.split(':');
               const currentHourInt = parseInt(timeParts[0] || "0");
               
               const hourReservations = reservations.filter(r => {
                 const rTimeParts = (r.time || "00:00").trim().split(':');
                 const start = parseInt(rTimeParts[0] || "0");
                 const dur = Math.max(1, r.duration || 1);
                 return currentHourInt >= start && currentHourInt < start + dur;
               });
               
               const lanesOccupied = hourReservations.reduce((acc, curr) => acc + (curr.laneCount || 1), 0);
               return (
                 <div key={slot.time} className="bg-slate-900/40 rounded-[2rem] border border-slate-700/50 overflow-hidden group transition-colors mb-8">
                    <div className="bg-slate-900/80 p-4 px-8 flex justify-between items-center border-b border-slate-700/50 backdrop-blur-sm">
                       <div className="flex items-center gap-4"><span className="text-2xl font-black text-neon-blue tracking-tighter">{slot.time}</span><div className="h-6 w-[1px] bg-slate-700"></div><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{lanesOccupied} / {settings.activeLanes} Pistas Ocupadas</span></div>
                       <div className="flex items-center gap-3">
                            <div className="w-32 h-1.5 bg-slate-800 rounded-full overflow-hidden hidden sm:block"><div className={`h-full transition-all duration-500 ${lanesOccupied >= settings.activeLanes ? 'bg-red-500' : 'bg-neon-blue'}`} style={{width: `${(lanesOccupied / settings.activeLanes) * 100}%`}}></div></div>
                            <div className={`w-3 h-3 rounded-full animate-pulse ${lanesOccupied >= settings.activeLanes ? 'bg-red-500' : 'bg-green-500'}`}></div>
                       </div>
                    </div>
                    <div className="p-6">
                       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
                         {hourReservations.length === 0 ? (
                            <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-700 border-2 border-dashed border-slate-800/50 rounded-3xl">
                                <Clock size={40} className="opacity-20 mb-2" />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Sem reservas neste horário</span>
                            </div>
                         ) : hourReservations.flatMap(res => {
                           const lCount = Math.max(1, res.laneCount || 1);
                           return Array.from({ length: lCount }).map((_, idx) => {
                             const uid = `${res.id}_${currentHourInt}:00_${idx+1}`;
                             return (
                               <ReservationCard 
                                 key={uid}
                                 res={res}
                                 uniqueId={uid}
                                 isCI={!!res.checkedInIds?.includes(uid)}
                                 isNS={!!res.noShowIds?.includes(uid)}
                                 laneIdx={idx}
                                 canEdit={canEdit}
                                 staffName={res.createdBy ? staffMap[res.createdBy] : undefined} 
                                 onOpen={() => { setSelectedRes(res); setIsEditMode(false); }}
                                 onGranularStatus={(e, type) => handleGranularStatus(e, res, uid, type)}
                               />
                             )
                           });
                         })}
                       </div>
                    </div>
                 </div>
               );
             })}
          </div>
        )}
      </div>

      {selectedRes && !isEditMode && (
        <InfoModal 
          res={selectedRes}
          phone={clientPhones[selectedRes.clientId] || ''}
          canEdit={canEdit}
          canCreate={canCreateReservation}
          staffName={selectedRes.createdBy ? staffMap[selectedRes.createdBy] : undefined}
          onClose={() => setSelectedRes(null)}
          onEdit={() => setIsEditMode(true)}
          onNewBooking={() => navigate('/agendamento', { state: { prefilledClient: { id: selectedRes.clientId, name: selectedRes.clientName, phone: clientPhones[selectedRes.clientId] || '' } } })}
          onStatusChange={handleStatusChange}
          onCancel={() => setIsCancelling(true)}
        />
      )}

      {selectedRes && isEditMode && (
        <EditModal 
          res={selectedRes}
          onClose={() => setIsEditMode(false)}
          onSave={handleSaveFullEdit}
        />
      )}

      {isCancelling && selectedRes && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4">
          <div className="bg-slate-800 border border-slate-600 w-full max-md rounded-[2.5rem] p-8 shadow-2xl animate-scale-in space-y-6">
            <h3 className="text-xl font-black text-white uppercase tracking-tighter">Confirmar Cancelamento</h3>
            <textarea className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 text-white text-sm h-24" placeholder="Motivo..." value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
            <div className="flex gap-4">
              <button onClick={() => setIsCancelling(false)} className="flex-1 py-4 bg-slate-800 text-white rounded-2xl font-black text-xs uppercase">Voltar</button>
              <button onClick={async () => { await db.reservations.update({...selectedRes, status: ReservationStatus.CANCELADA}, currentUser?.id, `Cancelado: ${cancelReason}`); setSelectedRes(null); setIsCancelling(false); loadData(true); }} className="flex-[2] py-4 bg-red-600 text-white rounded-2xl font-black text-xs uppercase shadow-xl">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {showLaneSelector && laneSelectorTargetRes && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 p-4 backdrop-blur-xl">
              <div className="bg-slate-800 border border-slate-600 w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-scale-in">
                  <div className="text-center mb-8"><div className="w-16 h-16 bg-neon-blue/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-neon-blue border border-neon-blue/30 shadow-inner"><LayoutGrid size={32}/></div><h3 className="text-xl font-black text-white uppercase tracking-tighter leading-none mb-2">Atribuir Pista</h3><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{laneSelectorTargetRes.clientName}</p></div>
                  <div className="grid grid-cols-3 gap-3 mb-10">{Array.from({ length: settings.activeLanes }).map((_, i) => { const n = i + 1; const sel = tempSelectedLanes.includes(n); return ( <button key={n} onClick={() => setTempSelectedLanes(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n])} className={`h-14 rounded-xl flex items-center justify-center text-xl font-black transition-all border-2 ${sel ? 'bg-neon-blue border-white text-white shadow-lg' : 'bg-slate-900 border-slate-700 text-slate-600'}`}>{n}</button> ) })}</div>
                  <div className="flex gap-2"><button onClick={() => setShowLaneSelector(false)} className="flex-1 py-4 bg-slate-700 text-white rounded-xl font-black uppercase text-[10px]">Voltar</button><button onClick={saveLaneSelection} className="flex-[2] py-4 bg-green-600 text-white rounded-xl font-black uppercase text-[10px] shadow-lg active:scale-95">CONFIRMAR</button></div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Agenda;
