
import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../services/mockBackend';
import { supabase } from '../services/supabaseClient';
import { Reservation, ReservationStatus, EventType, UserRole, PaymentStatus } from '../types';
import { useApp } from '../contexts/AppContext'; 
import { generateDailySlots, checkHourCapacity, getDayConfiguration } from '../utils/availability'; 
import { 
  ChevronLeft, ChevronRight, Loader2, Plus, X, Ban, AlertTriangle, LayoutGrid, Check, MessageCircle, CreditCard, Clock, UserCheck, DollarSign, CalendarOff, Moon
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

// Componentes Modulares
import { MetricCards } from '../components/Agenda/MetricCards';
import { ReservationCard } from '../components/Agenda/ReservationCard';
import { InfoModal } from '../components/Agenda/InfoModal';
import { EditModal } from '../components/Agenda/EditModal';

interface GlobalAlert {
    type: 'PENDING_URGENT' | 'LATE_ACTION' | 'OPEN_TABS';
    message: string;
    res: Reservation;
    color: string;
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
    const isBlocked = settings.blockedDates?.includes(selectedDate);
    if (isBlocked) return { isClosed: true, reason: 'BLOQUEIO EXCEPCIONAL' };
    
    const config = getDayConfiguration(selectedDate, settings);
    if (!config || !config.isOpen) return { isClosed: true, reason: 'ESTABELECIMENTO FECHADO NESTE DIA' };
    
    return { isClosed: false, reason: '' };
  }, [selectedDate, settings]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10000); 
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const checkExpirations = async () => {
        const expired = allReservationsForAlerts.filter(res => 
            res.status === ReservationStatus.PENDENTE && 
            !res.payOnSite && 
            res.createdAt && 
            (now.getTime() - new Date(res.createdAt).getTime()) / 60000 >= 30
        );

        if (expired.length > 0) {
            for (const res of expired) {
                await db.reservations.update({
                    ...res,
                    status: ReservationStatus.CANCELADA,
                    observations: (res.observations || '') + ' [Cancelamento Automático: Expiração de 30min]'
                }, 'SYSTEM', 'Reserva expirou sem pagamento');
            }
        }
    };
    
    if (allReservationsForAlerts.length > 0) {
        checkExpirations();
    }
  }, [allReservationsForAlerts, now]);

  const loadData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const [allReservations, allClients] = await Promise.all([
          db.reservations.getAll(),
          db.clients.getAll()
      ]);

      setAllReservationsForAlerts(allReservations);

      const phoneMap: Record<string, string> = {};
      allClients.forEach(c => { phoneMap[c.id] = c.phone; });
      setClientPhones(phoneMap);

      const dayReservations = allReservations
        .filter(r => r && r.date === selectedDate && r.status !== ReservationStatus.CANCELADA)
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

      setReservations(dayReservations);

      let total = 0, pending = 0, confirmed = 0, checkIn = 0, noShow = 0;
      dayReservations.forEach(r => {
          const slotCount = (r.laneCount || 1) * Math.ceil(r.duration || 1);
          total += slotCount;
          if (r.status === ReservationStatus.CHECK_IN) checkIn += (r.checkedInIds?.length || 0);
          else if (r.status === ReservationStatus.NO_SHOW) noShow += (r.noShowIds?.length || 0);
          if (r.paymentStatus === PaymentStatus.PENDENTE) pending += slotCount;
          else confirmed += slotCount;
      });

      setMetrics({ totalSlots: total, pendingSlots: pending, confirmedSlots: confirmed, checkInSlots: checkIn, noShowSlots: noShow });
    } finally { if (!isBackground) setLoading(false); }
  };

  useEffect(() => { 
    loadData();
    const channel = supabase.channel(`agenda-sync-global`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas' }, () => loadData(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedDate]);

  const alerts = useMemo(() => {
      const globalAlerts: GlobalAlert[] = [];
      const todayStr = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');

      allReservationsForAlerts.forEach(res => {
          if (!res || res.status === ReservationStatus.CANCELADA) return;

          // 1. Reservas Pendentes (Site) prestes a expirar - Somente de Hoje para não poluir
          if (res.date === todayStr && res.status === ReservationStatus.PENDENTE && !res.payOnSite && res.createdAt) {
              const created = new Date(res.createdAt).getTime();
              const diffMinutes = (now.getTime() - created) / 60000;
              if (diffMinutes >= 20 && diffMinutes < 30) {
                  globalAlerts.push({ 
                    type: 'PENDING_URGENT', 
                    message: `Reserva de ${res.clientName} expira em ${Math.ceil(30 - diffMinutes)}min!`, 
                    res, 
                    color: 'border-orange-500 bg-orange-950/40 text-orange-100 shadow-orange-500/10' 
                  });
              }
          }

          // 2. Atrasos de Check-in (Retroativo: Mostra até que seja feito o check-in ou cancelada)
          if (res.status === ReservationStatus.CONFIRMADA) {
              const [h, m] = (res.time || "00:00").split(':').map(Number);
              const startTime = new Date(res.date + 'T' + (res.time.length === 5 ? res.time : '0' + res.time));
              const diffMinutes = (now.getTime() - startTime.getTime()) / 60000;
              
              if (diffMinutes >= 20) {
                  const dateLabel = res.date === todayStr ? 'Hoje' : res.date.split('-').reverse().join('/');
                  globalAlerts.push({ 
                    type: 'LATE_ACTION', 
                    message: `[${dateLabel}] ${res.clientName} está ${Math.ceil(diffMinutes)}min atrasado.`, 
                    res, 
                    color: 'border-blue-500 bg-blue-950/40 text-blue-100 shadow-blue-500/10' 
                  });
              }
          }

          // 3. Comandas em Aberto (Retroativo: Mostra eventos locais pendentes de pagamento)
          if (res.payOnSite && res.paymentStatus === PaymentStatus.PENDENTE) {
              // Só avisa se o horário de início já passou
              const startTime = new Date(res.date + 'T' + (res.time.length === 5 ? res.time : '0' + res.time));
              if (now > startTime) {
                const dateLabel = res.date === todayStr ? 'Hoje' : res.date.split('-').reverse().join('/');
                globalAlerts.push({ 
                    type: 'OPEN_TABS', 
                    message: `Comanda em aberto [${dateLabel}]: ${res.clientName} (${res.comandaId || 'S/N'})`, 
                    res, 
                    color: 'border-red-500 bg-red-950/40 text-red-100 shadow-red-500/10' 
                });
              }
          }
      });
      
      // Ordena por data (mais antigas primeiro para priorizar o que ficou pra trás)
      return globalAlerts.sort((a,b) => a.res.date.localeCompare(b.res.date));
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
            clientId: res.clientId, name: res.clientName, whatsapp: clientPhones[res.clientId] || '',
            date: res.date, time: res.time, people: res.peopleCount, lanes: res.laneCount,
            duration: res.duration, type: res.eventType, totalValue: res.totalValue, reservationIds: [res.id]
        } 
    });
  };

  const openWhatsApp = (phone: string, message: string) => {
    window.open(`https://wa.me/55${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
  };

  const handleNewReservationForClient = () => {
    if (!selectedRes) return;
    const clientData = { id: selectedRes.clientId, name: selectedRes.clientName, phone: clientPhones[selectedRes.clientId] || '' };
    navigate('/agendamento', { state: { prefilledClient: clientData } });
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
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    return parts.reverse().join('/');
  };

  const timeSlots = useMemo(() => generateDailySlots(selectedDate, settings, []), [selectedDate, settings]);

  return (
    <div className="flex flex-col h-full space-y-6 pb-20 md:pb-0">
      
      {alerts.length > 0 && (
          <div className="space-y-2 sticky top-0 z-50 md:relative max-h-[300px] overflow-y-auto no-scrollbar">
              {alerts.map((alert, i) => (
                  <div key={`${alert.res.id}-${i}`} className={`p-4 rounded-2xl border shadow-2xl animate-fade-in transition-all backdrop-blur-md ${alert.color}`}>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => { setSelectedRes(alert.res); setIsEditMode(false); }}>
                              <AlertTriangle size={20} className="shrink-0 animate-pulse text-current" />
                              <div>
                                  <p className="text-[9px] font-black uppercase tracking-[0.2em] mb-1 opacity-60">{alert.type.replace('_', ' ')}</p>
                                  <p className="text-sm font-bold group-hover:underline transition-all">{alert.message}</p>
                              </div>
                          </div>
                          
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                              {alert.type === 'PENDING_URGENT' && (
                                  <>
                                      <button onClick={() => openWhatsApp(clientPhones[alert.res.clientId] || '', `Olá ${alert.res.clientName}! Sua reserva expira em instantes.`)} className="flex-1 sm:flex-none bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1.5 transition active:scale-95">
                                          <MessageCircle size={14}/> WhatsApp
                                      </button>
                                      <button onClick={() => handleQuickCheckout(alert.res)} className="flex-1 sm:flex-none bg-white text-orange-950 px-3 py-2 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1.5 transition active:scale-95 shadow-lg">
                                          <CreditCard size={14}/> Checkout
                                      </button>
                                  </>
                              )}
                              
                              {alert.type === 'LATE_ACTION' && (
                                  <button onClick={() => handleGranularStatus(null, alert.res, `${alert.res.id}_${alert.res.time}_1`, 'CHECK_IN')} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1.5 transition shadow-xl active:scale-95">
                                      <UserCheck size={14}/> Fazer Check-in
                                  </button>
                              )}

                              {alert.type === 'OPEN_TABS' && (
                                  <button onClick={() => handleQuickCheckout(alert.res)} className="w-full sm:w-auto bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1.5 transition shadow-xl active:scale-95">
                                      <DollarSign size={14}/> Receber Comanda
                                  </button>
                              )}
                          </div>
                      </div>
                  </div>
              ))}
          </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-6">
        <div><h1 className="text-3xl font-black text-white tracking-tight uppercase leading-none">Dashboard</h1><p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Painel Operacional • {formatDateDisplay(selectedDate)}</p></div>
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
                 const rTimeParts = (r.time || "00:00").split(':');
                 const start = parseInt(rTimeParts[0] || "0");
                 return currentHourInt >= start && currentHourInt < start + (r.duration || 1);
               });
               const lanesOccupied = hourReservations.reduce((acc, curr) => acc + (curr.laneCount || 0), 0);
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
                           return Array.from({ length: res.laneCount || 1 }).map((_, idx) => {
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
          onClose={() => setSelectedRes(null)}
          onEdit={() => setIsEditMode(true)}
          onNewBooking={handleNewReservationForClient}
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
          <div className="bg-slate-800 border border-slate-600 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-scale-in space-y-6">
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
