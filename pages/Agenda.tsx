
import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../services/mockBackend';
import { supabase } from '../services/supabaseClient';
import { Reservation, ReservationStatus, EventType, UserRole, PaymentStatus } from '../types';
import { useApp } from '../contexts/AppContext'; 
import { generateDailySlots, checkHourCapacity } from '../utils/availability'; 
import { 
  ChevronLeft, 
  ChevronRight, 
  Users, 
  Pencil, 
  Save, 
  Loader2, 
  Calendar, 
  Check, 
  Ban, 
  AlertCircle, 
  Plus, 
  Phone, 
  Utensils, 
  Cake, 
  X, 
  MessageCircle, 
  Clock, 
  Store, 
  LayoutGrid, 
  DollarSign, 
  FileText, 
  Wallet, 
  User as UserIcon, 
  Info, 
  Trash2, 
  Layout, 
  CheckCircle2,
  AlertTriangle,
  Bell,
  Zap,
  Timer
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { EVENT_TYPES } from '../constants';

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
  const [editingRes, setEditingRes] = useState<Reservation | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Reservation>>({});
  
  const [showLaneSelector, setShowLaneSelector] = useState(false);
  const [laneSelectorTargetRes, setLaneSelectorTargetRes] = useState<Reservation | null>(null);
  const [tempSelectedLanes, setTempSelectedLanes] = useState<number[]>([]);
  
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const canEdit = currentUser?.role === UserRole.ADMIN || currentUser?.perm_edit_reservation;
  const canDelete = currentUser?.role === UserRole.ADMIN || currentUser?.perm_delete_reservation;
  const canReceivePayment = currentUser?.role === UserRole.ADMIN || currentUser?.perm_receive_payment;

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const loadData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      
      const startRange = [yesterday.getFullYear(), String(yesterday.getMonth() + 1).padStart(2, '0'), String(yesterday.getDate()).padStart(2, '0')].join('-');
      const endRange = selectedDate > [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-') ? selectedDate : [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');

      const [rangeReservations, allClients] = await Promise.all([
          db.reservations.getByDateRange(startRange, endRange),
          db.clients.getAll()
      ]);

      setAllReservationsForAlerts(rangeReservations);

      const phoneMap: Record<string, string> = {};
      allClients.forEach(c => { phoneMap[c.id] = c.phone; });
      setClientPhones(phoneMap);

      const dayReservations = rangeReservations
        .filter(r => r.date === selectedDate && r.status !== ReservationStatus.CANCELADA)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

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

  // --- LÓGICA DE ALERTAS ATUALIZADA (SEM 10 MIN) ---
  const alerts = useMemo(() => {
      const globalAlerts: { type: string, message: string, res: Reservation }[] = [];
      const todayStr = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const yesterdayStr = [yesterday.getFullYear(), String(yesterday.getMonth() + 1).padStart(2, '0'), String(yesterday.getDate()).padStart(2, '0')].join('-');

      allReservationsForAlerts.forEach(res => {
          if (res.status === ReservationStatus.CANCELADA) return;

          // Alerta 2: Pagamento Pendente de Ontem
          if (res.date === yesterdayStr && res.paymentStatus === PaymentStatus.PENDENTE && res.payOnSite) {
              globalAlerts.push({ type: 'OVERDUE_PAYMENT', message: `Pagamento pendente de ontem: ${res.clientName}`, res });
          }

          if (res.date === todayStr) {
              const [h, m] = res.time.split(':').map(Number);
              const startTime = new Date(now);
              startTime.setHours(h, m, 0, 0);
              const diffToStart = (now.getTime() - startTime.getTime()) / 60000;

              // Alerta 3: Check-in Atrasado (20 min após início)
              if (res.status === ReservationStatus.CONFIRMADA && diffToStart >= 20 && diffToStart < 60) {
                  globalAlerts.push({ type: 'LATE_CHECKIN', message: `${res.clientName} está ${Math.ceil(diffToStart)}min atrasado para o check-in!`, res });
              }

              // Alerta 4: Expiração de Pré-Reserva Online (30 min após criação)
              if (res.status === ReservationStatus.PENDENTE && !res.payOnSite && res.createdAt) {
                  const created = new Date(res.createdAt);
                  const diffCreated = (now.getTime() - created.getTime()) / 60000;
                  if (diffCreated >= 25 && diffCreated < 35) {
                      globalAlerts.push({ type: 'EXPIRING_PENDING', message: `Reserva online de ${res.clientName} expira em instantes!`, res });
                  }
              }
          }
      });

      return globalAlerts;
  }, [allReservationsForAlerts, now]);

  const handleGranularStatus = async (e: React.MouseEvent, res: Reservation, uniqueId: string, type: 'CHECK_IN' | 'NO_SHOW') => {
      e.stopPropagation(); 
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
      await db.reservations.update(updatedRes, currentUser?.id, `${type} granular em ${res.clientName}`);
      
      if (type === 'CHECK_IN' && !res.checkedInIds?.includes(uniqueId)) {
          setLaneSelectorTargetRes(updatedRes);
          setTempSelectedLanes(updatedRes.lanesAssigned || []);
          setShowLaneSelector(true);
      } else { loadData(true); }
  };

  const handleQuickReceive = async (e: React.MouseEvent, res: Reservation) => {
      e.stopPropagation();
      if (!canReceivePayment) return;
      if (!window.confirm(`Confirmar recebimento de ${res.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}?`)) return;
      const updatedRes = { ...res, paymentStatus: PaymentStatus.PAGO };
      await db.reservations.update(updatedRes, currentUser?.id, 'Recebimento Rápido');
      loadData(true);
  };

  const saveLaneSelection = async () => {
      if (!laneSelectorTargetRes) return;
      const updatedRes = { ...laneSelectorTargetRes, lanesAssigned: tempSelectedLanes };
      await db.reservations.update(updatedRes, currentUser?.id, 'Atualizou pistas atribuídas');
      setShowLaneSelector(false);
      setLaneSelectorTargetRes(null);
      if (editingRes && editingRes.id === updatedRes.id) { setEditingRes(updatedRes); }
      loadData(true);
  };

  const openResModal = (res: Reservation) => {
    setEditingRes(res);
    setIsEditMode(false);
    setEditForm({ ...res });
    setIsCancelling(false);
  };

  const handleStatusChange = async (status: ReservationStatus) => {
    if (!editingRes) return;
    if (status === ReservationStatus.CANCELADA) { setIsCancelling(true); return; }
    if (status === ReservationStatus.CONFIRMADA && editingRes.status === ReservationStatus.PENDENTE) {
        navigate('/checkout', { 
            state: { 
                clientId: editingRes.clientId, name: editingRes.clientName, whatsapp: clientPhones[editingRes.clientId] || '',
                date: editingRes.date, time: editingRes.time, people: editingRes.peopleCount, lanes: editingRes.laneCount,
                duration: editingRes.duration, type: editingRes.eventType, totalValue: editingRes.totalValue, reservationIds: [editingRes.id]
            } 
        });
        return;
    }
    const updated = { ...editingRes, status, paymentStatus: status === ReservationStatus.CONFIRMADA && !editingRes.payOnSite ? PaymentStatus.PAGO : editingRes.paymentStatus };
    await db.reservations.update(updated, currentUser?.id, `Alterou status para ${status}`);
    setEditingRes(null); 
    loadData(true); 
  };

  const handleSaveFullEdit = async () => {
      if (!editingRes || !editForm) return;
      const [y, m, d] = (editForm.date || '').split('-').map(Number);
      const date = new Date(y, m - 1, d);
      const isWeekend = [0, 5, 6].includes(date.getDay());
      const price = isWeekend ? settings.weekendPrice : settings.weekdayPrice;
      const total = price * (editForm.laneCount || 1) * (editForm.duration || 1);
      const finalUpdate = { ...editingRes, ...editForm, totalValue: total } as Reservation;
      await db.reservations.update(finalUpdate, currentUser?.id, 'Edição completa de agendamento');
      setEditingRes(null);
      loadData(true);
  };

  return (
    <div className="flex flex-col h-full space-y-6 pb-20 md:pb-0">
      
      {alerts.length > 0 && (
          <div className="space-y-2">
              {alerts.slice(0, 3).map((alert, i) => (
                  <div key={i} onClick={() => openResModal(alert.res)} className={`p-4 rounded-2xl border flex items-center justify-between cursor-pointer transition-all hover:scale-[1.01] shadow-lg animate-fade-in ${
                      alert.type === 'OVERDUE_PAYMENT' ? 'bg-red-900/40 border-red-500 text-red-100' :
                      alert.type === 'LATE_CHECKIN' ? 'bg-orange-900/40 border-orange-500 text-orange-100' :
                      'bg-blue-900/40 border-blue-500 text-blue-100'
                  }`}>
                      <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl ${
                              alert.type === 'OVERDUE_PAYMENT' ? 'bg-red-500/20' :
                              alert.type === 'LATE_CHECKIN' ? 'bg-orange-500/20' :
                              'bg-blue-500/20'
                          }`}>
                              <AlertTriangle size={20} />
                          </div>
                          <div>
                              <p className="text-xs font-black uppercase tracking-widest leading-none mb-1">{alert.type.replace('_', ' ')}</p>
                              <p className="text-sm font-bold">{alert.message}</p>
                          </div>
                      </div>
                      <ChevronRight size={20} className="opacity-50" />
                  </div>
              ))}
              {alerts.length > 3 && <p className="text-[10px] text-slate-500 font-bold uppercase text-center tracking-widest">+ {alerts.length - 3} outros alertas ativos</p>}
          </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-6">
        <div><h1 className="text-3xl font-black text-white tracking-tight uppercase">Agenda</h1><p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Gestão de {selectedDate.split('-').reverse().join('/')}</p></div>
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            <div className="flex items-center gap-4 bg-slate-800 p-2 rounded-2xl border border-slate-700 shadow-xl w-full md:w-auto justify-between md:justify-start">
                <button onClick={() => { const [y,m,d] = selectedDate.split('-').map(Number); const nd = new Date(y,m-1,d-1); setSelectedDate([nd.getFullYear(),String(nd.getMonth()+1).padStart(2,'0'),String(nd.getDate()).padStart(2,'0')].join('-')); }} className="p-2 hover:bg-slate-700 rounded-full text-slate-300"><ChevronLeft size={20} /></button>
                <input type="date" className="bg-transparent text-white font-black text-center focus:outline-none uppercase text-xs tracking-widest cursor-pointer" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}/>
                <button onClick={() => { const [y,m,d] = selectedDate.split('-').map(Number); const nd = new Date(y,m-1,d+1); setSelectedDate([nd.getFullYear(),String(nd.getMonth()+1).padStart(2,'0'),String(nd.getDate()).padStart(2,'0')].join('-')); }} className="p-2 hover:bg-slate-700 rounded-full text-slate-300"><ChevronRight size={20} /></button>
            </div>
            {currentUser?.perm_create_reservation && <Link to="/agendamento" className="bg-neon-orange hover:bg-orange-500 text-white px-8 py-3 rounded-2xl font-black shadow-xl flex items-center justify-center gap-2 transition transform hover:scale-105 w-full sm:w-auto uppercase text-xs tracking-[0.2em]"><Plus size={20} /> Nova Reserva</Link>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
         <div className="p-4 rounded-2xl border flex items-center justify-between shadow-xl bg-slate-800 border-slate-700">
             <div className="flex items-center gap-3"><div className="p-2 bg-slate-500/10 rounded-xl text-slate-500"><CheckCircle2 size={20} /></div><span className="text-[10px] uppercase font-black text-slate-500 tracking-widest">Confirmada</span></div>
             <span className="text-2xl font-black text-slate-200">{loading ? '-' : metrics.confirmedSlots}</span>
         </div>
         <div className="p-4 rounded-2xl border flex items-center justify-between shadow-xl bg-slate-800 border-yellow-500/30">
             <div className="flex items-center gap-3"><div className="p-2 bg-yellow-500/10 rounded-xl text-yellow-500"><AlertCircle size={20} /></div><span className="text-[10px] uppercase font-black text-yellow-500 tracking-widest">Pendente</span></div>
             <span className="text-2xl font-black text-yellow-500">{loading ? '-' : metrics.pendingSlots}</span>
         </div>
         <div className="bg-green-900/20 p-4 rounded-2xl border border-green-500/30 flex items-center justify-between shadow-xl">
             <div className="flex items-center gap-3"><div className="p-2 bg-green-500/20 rounded-xl text-green-400"><Users size={20} /></div><span className="text-[10px] text-green-400 uppercase font-black tracking-widest">Check-in</span></div>
             <span className="text-2xl font-black text-green-400">{loading ? '-' : metrics.checkInSlots}</span>
         </div>
         <div className="bg-red-900/20 p-4 rounded-2xl border border-red-500/30 flex items-center justify-between shadow-xl">
             <div className="flex items-center gap-3"><div className="p-2 bg-red-500/20 rounded-xl text-red-400"><Ban size={20} /></div><span className="text-[10px] text-red-400 uppercase font-black tracking-widest">No-Show</span></div>
             <span className="text-2xl font-black text-red-400">{loading ? '-' : metrics.noShowSlots}</span>
         </div>
      </div>

      <div className="flex-1 bg-slate-800 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl flex flex-col min-h-[500px]">
        {loading ? (<div className="flex-1 flex justify-center items-center"><Loader2 className="animate-spin text-neon-blue" size={48} /></div>) : (
          <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar">
             {generateDailySlots(selectedDate, settings, []).length === 0 ? <div className="flex flex-col items-center justify-center h-full text-slate-500 py-16"><Ban size={64} className="mb-4 opacity-10"/><p className="font-bold uppercase tracking-widest">Fechado neste dia.</p></div> : (
             generateDailySlots(selectedDate, settings, []).map(slot => {
               const currentHourInt = parseInt(slot.time.split(':')[0]);
               const hourReservations = reservations.filter(r => {
                 const start = parseInt(r.time.split(':')[0]);
                 return currentHourInt >= start && currentHourInt < start + r.duration;
               });
               const lanesOccupied = hourReservations.reduce((acc, curr) => acc + curr.laneCount, 0);
               return (
                 <div key={slot.time} className="bg-slate-900/40 rounded-3xl border border-slate-700/50 overflow-hidden group hover:border-slate-600 transition-colors">
                    <div className="bg-slate-900/80 p-4 px-6 flex justify-between items-center border-b border-slate-700/50 backdrop-blur-sm">
                       <div className="flex items-center gap-4"><span className="text-2xl font-black text-neon-blue tracking-tighter">{slot.time}</span><div className="h-6 w-[1px] bg-slate-700"></div><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{lanesOccupied} / {settings.activeLanes} Pistas Ocupadas</span></div>
                       <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden shadow-inner"><div className={`h-full transition-all duration-500 ${lanesOccupied >= settings.activeLanes ? 'bg-red-500' : 'bg-neon-blue'}`} style={{width: `${(lanesOccupied / settings.activeLanes) * 100}%`}}></div></div>
                    </div>
                    <div className="p-4 px-6">
                       {hourReservations.length === 0 ? <div className="py-4 text-slate-700 italic text-xs font-medium uppercase tracking-widest opacity-40">Sem reservas para este horário</div> : (
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                           {hourReservations.flatMap(res => {
                             return Array.from({ length: res.laneCount }).map((_, idx) => {
                               const uid = `${res.id}_${currentHourInt}:00_${idx+1}`;
                               const isCI = res.checkedInIds?.includes(uid);
                               const isNS = res.noShowIds?.includes(uid);
                               const cardAlert = alerts.find(a => a.res.id === res.id);

                               return (
                               <div key={uid} onClick={() => openResModal(res)} className={`relative p-5 rounded-2xl border cursor-pointer hover:scale-[1.02] active:scale-95 transition-all shadow-lg ${
                                   isCI ? 'border-green-500 bg-slate-900 opacity-95' : 
                                   isNS ? 'border-red-500 bg-red-900/10 grayscale opacity-80' : 
                                   cardAlert?.type === 'LATE_CHECKIN' ? 'border-orange-500 bg-orange-500/10 ring-2 ring-orange-500/20' :
                                   res.status === ReservationStatus.CONFIRMADA ? 'border-neon-blue bg-blue-900/10' : 
                                   'border-yellow-500/50 bg-yellow-900/10'
                               }`}>
                                  {cardAlert && !isCI && !isNS && (
                                      <div className="absolute -top-2 -right-2 bg-orange-600 text-white p-1.5 rounded-full shadow-xl animate-bounce border-2 border-slate-800">
                                          <Bell size={14}/>
                                      </div>
                                  )}
                                  <div className="flex justify-between items-start mb-4">
                                    <div className="min-w-0 pr-2">
                                        <h4 className={`font-bold truncate text-sm text-slate-100 uppercase tracking-wide leading-tight ${isNS ? 'line-through text-slate-500' : ''}`}>{res.clientName}</h4>
                                        <div className="flex items-center gap-1.5 mt-4 flex-wrap">
                                            {isCI ? <span className="text-[8px] font-black text-green-400 bg-green-500/20 px-2 py-0.5 rounded-lg border border-green-500/30 uppercase">CHECK-IN</span> : isNS ? <span className="text-[8px] font-black text-red-400 bg-red-600/20 px-2 py-0.5 rounded-lg border border-red-500/30 uppercase tracking-widest">NO-SHOW</span> : <span className={`text-[8px] font-black px-2 py-0.5 rounded-lg border uppercase tracking-widest ${res.status === ReservationStatus.CONFIRMADA ? 'text-neon-blue bg-blue-900/40 border-neon-blue/30 shadow-blue-900/20 shadow-lg' : 'text-yellow-400 bg-yellow-900/40 border-yellow-500/30 shadow-yellow-900/20 shadow-lg'}`}>{res.status}</span>}
                                            {res.paymentStatus === PaymentStatus.PENDENTE && <span className="text-[8px] font-black text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-lg animate-pulse uppercase">Pagamento Pendente</span>}
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-3">
                                        <div className="flex gap-1.5">
                                            <button disabled={!canEdit} onClick={(e) => handleGranularStatus(e, res, uid, 'CHECK_IN')} className={`w-8 h-8 flex items-center justify-center rounded-xl border transition-all shadow-md ${isCI ? 'bg-green-600 text-white border-green-500' : 'bg-slate-800 text-slate-500 border-slate-700 hover:text-green-400 hover:border-green-400'}`}><Check size={16}/></button>
                                            <button disabled={!canEdit} onClick={(e) => handleGranularStatus(e, res, uid, 'NO_SHOW')} className={`w-8 h-8 flex items-center justify-center rounded-xl border transition-all shadow-md ${isNS ? 'bg-red-600 text-white border-red-500' : 'bg-slate-800 text-slate-500 border-slate-700 hover:text-red-400 hover:border-red-400'}`}><Ban size={16}/></button>
                                        </div>
                                    </div>
                                  </div>
                                  <div className="pt-4 border-t border-slate-700/50 space-y-1.5 mt-2">
                                      {res.hasTableReservation && <div className="flex items-center gap-1.5 text-[10px] font-black text-orange-400 uppercase tracking-tighter"><Utensils size={14} className="opacity-50"/> MESA: {res.tableSeatCount} LUG.</div>}
                                      {res.birthdayName && <div className="flex items-center gap-1.5 text-[10px] font-black text-blue-400 uppercase tracking-tighter"><Cake size={14} className="opacity-50"/> {res.birthdayName}</div>}
                                  </div>
                               </div>
                             )});
                           })}
                         </div>
                       )}
                    </div>
                 </div>
               );
             }))}
          </div>
        )}
      </div>

      {editingRes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl p-3 md:p-4">
          <div className="bg-slate-800 border border-slate-600 w-full max-w-lg md:max-w-2xl rounded-[1.5rem] md:rounded-[2.5rem] shadow-2xl animate-scale-in flex flex-col max-h-[95vh] overflow-hidden">
            <div className="p-4 md:p-8 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
              <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-neon-blue/10 rounded-xl flex items-center justify-center text-neon-blue border border-neon-blue/20 shadow-inner flex-shrink-0"><Info size={20} className="md:w-6 md:h-6"/></div>
                  <div className="min-w-0"><h3 className="text-base md:text-xl font-bold text-white tracking-tight uppercase leading-tight mb-1 truncate">{editingRes.clientName}</h3><p className="text-[8px] md:text-[10px] text-slate-500 font-bold uppercase tracking-widest">Reserva #{editingRes.id.slice(0,8)}</p></div>
              </div>
              <div className="flex items-center gap-2 md:gap-3 ml-2">
                  {canEdit && <button onClick={() => setIsEditMode(!isEditMode)} className={`p-2.5 md:p-3 rounded-xl border transition-all ${isEditMode ? 'bg-neon-blue text-white border-neon-blue shadow-lg' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'}`}><Pencil size={18} className="md:w-5 md:h-5"/></button>}
                  <button onClick={() => setEditingRes(null)} className="text-slate-400 hover:text-white p-2.5 md:p-3 bg-slate-800 rounded-xl border border-slate-700 transition-colors"><X size={20} className="md:w-6 md:h-6"/></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 md:space-y-8 custom-scrollbar bg-slate-800">
                {isEditMode ? (
                    <div className="space-y-6 animate-fade-in">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                            <div className="col-span-2"><label className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase block mb-1 tracking-widest">Data</label><input type="date" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 md:p-4 text-white text-xs md:text-sm font-bold" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} /></div>
                            <div><label className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase block mb-1 tracking-widest">Hora</label><input type="time" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 md:p-4 text-white text-xs md:text-sm font-bold" value={editForm.time} onChange={e => setEditForm({...editForm, time: e.target.value})} /></div>
                            <div><label className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase block mb-1 tracking-widest">Horas</label><input type="number" step="0.5" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 md:p-4 text-white text-xs md:text-sm font-bold" value={editForm.duration} onChange={e => setEditForm({...editForm, duration: parseFloat(e.target.value)})} /></div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                            <div><label className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase block mb-1 tracking-widest">Pistas</label><input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 md:p-4 text-white text-xs md:text-sm font-black" value={editForm.laneCount} onChange={e => setEditForm({...editForm, laneCount: parseInt(e.target.value)})} /></div>
                            <div><label className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase block mb-1 tracking-widest">Pessoas</label><input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 md:p-4 text-white text-xs md:text-sm font-black" value={editForm.peopleCount} onChange={e => setEditForm({...editForm, peopleCount: parseInt(e.target.value)})} /></div>
                            <div className="col-span-2 md:col-span-1"><label className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase block mb-1 tracking-widest">Evento</label><select className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 md:p-4 text-white text-xs md:text-sm font-bold" value={editForm.eventType} onChange={e => setEditForm({...editForm, eventType: e.target.value as EventType})}>{EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                        </div>
                        <button onClick={handleSaveFullEdit} className="w-full py-4 md:py-5 bg-neon-blue hover:bg-blue-600 text-white rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-[0.2em] shadow-xl flex items-center justify-center gap-3 transition-all active:scale-95"><Save size={18}/> Salvar Dados</button>
                    </div>
                ) : (
                    <div className="space-y-5 md:space-y-8 animate-fade-in">
                        <div className="grid grid-cols-2 gap-3 md:gap-4">
                            <div className="bg-slate-900/50 p-3 md:p-5 rounded-2xl border border-slate-700/50 shadow-inner"><p className="text-[7px] md:text-[9px] text-slate-500 font-bold uppercase mb-1 md:mb-2 tracking-widest">Agenda</p><p className="text-white font-bold text-xs md:text-sm">{editingRes.date.split('-').reverse().join('/')}</p><p className="text-neon-blue text-sm md:text-lg font-black">{editingRes.time}</p></div>
                            <div className="bg-slate-900/50 p-3 md:p-5 rounded-2xl border border-slate-700/50 shadow-inner"><p className="text-[7px] md:text-[9px] text-slate-500 font-bold uppercase mb-1 md:mb-2 tracking-widest">Grade</p><p className="text-white font-bold text-xs md:text-sm uppercase leading-tight">{editingRes.laneCount} Pistas</p><p className="text-slate-400 text-xs md:text-base font-bold">{editingRes.duration} Horas</p></div>
                            <div className="bg-slate-900/50 p-3 md:p-5 rounded-2xl border border-slate-700/50 shadow-inner"><p className="text-[7px] md:text-[9px] text-slate-500 font-bold uppercase mb-1 md:mb-2 tracking-widest">Grupo</p><p className="text-white font-bold text-sm md:text-xl leading-tight">{editingRes.peopleCount} Jogadores</p></div>
                            <div className="bg-slate-900/50 p-3 md:p-5 rounded-2xl border border-slate-700/50 shadow-inner"><p className="text-[7px] md:text-[9px] text-slate-500 font-bold uppercase mb-1 md:mb-2 tracking-widest">Financeiro</p><p className="text-neon-green font-black text-sm md:text-xl leading-tight">{editingRes.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p></div>
                        </div>
                        
                        {editingRes.paymentStatus === PaymentStatus.PENDENTE && (
                            <div className="bg-red-950/30 border border-red-500/50 p-4 rounded-2xl flex items-center justify-between shadow-lg animate-pulse">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-red-500/20 rounded-xl text-red-500"><DollarSign size={20}/></div>
                                    <div>
                                        <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">Pagamento Pendente</p>
                                        <p className="text-xs font-bold text-red-200">Aguardando recebimento</p>
                                    </div>
                                </div>
                                {canReceivePayment && (
                                    <button onClick={(e) => handleQuickReceive(e, editingRes)} className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-colors shadow-lg">Receber</button>
                                )}
                            </div>
                        )}

                        {editingRes.status === ReservationStatus.CHECK_IN && (
                             <div className="bg-slate-900/80 p-4 md:p-6 rounded-2xl border border-slate-700 shadow-xl space-y-3">
                                <div className="flex justify-between items-center"><h4 className="text-[8px] md:text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1.5 tracking-widest"><LayoutGrid size={12} className="text-neon-blue"/> Pistas Ativas</h4>{canEdit && <button onClick={() => { setLaneSelectorTargetRes(editingRes); setTempSelectedLanes(editingRes.lanesAssigned || []); setShowLaneSelector(true); }} className="text-[8px] md:text-[10px] font-bold text-neon-blue uppercase flex items-center gap-1 hover:underline"><Pencil size={10}/> Editar</button>}</div>
                                <div className="flex flex-wrap gap-2">{editingRes.lanesAssigned && editingRes.lanesAssigned.length > 0 ? ( editingRes.lanesAssigned.map(l => ( <div key={l} className="w-10 h-10 md:w-12 md:h-12 bg-neon-blue text-white rounded-xl flex items-center justify-center font-black text-lg md:text-xl shadow-lg border border-white/10">{l}</div> )) ) : <div className="text-slate-500 italic text-[10px] py-1">Nenhuma pista definida</div>}</div>
                             </div>
                        )}
                        {editingRes.observations && (<div className="bg-slate-900/80 p-4 rounded-2xl border-l-4 border-neon-blue shadow-lg"><p className="text-[8px] md:text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-widest">Observações Equipe</p><p className="text-slate-300 text-xs md:text-sm italic font-medium leading-relaxed truncate-2-lines">"{editingRes.observations}"</p></div>)}
                    </div>
                )}
            </div>
            <div className="p-4 md:p-8 bg-slate-900 border-t border-slate-700">
                {!isEditMode && !isCancelling && (
                    <div className="flex flex-col gap-2">
                        <button disabled={!canEdit} onClick={() => handleStatusChange(ReservationStatus.CONFIRMADA)} className={`w-full py-3.5 md:py-5 rounded-xl md:rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-[0.2em] transition-all border flex items-center justify-center gap-2 shadow-xl ${editingRes.status === ReservationStatus.CONFIRMADA ? 'bg-green-600 text-white border-green-500' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'}`}><Check size={18}/> Confirmar Reserva</button>
                        <div className="flex gap-2">
                            <button disabled={!canEdit} onClick={() => handleStatusChange(ReservationStatus.PENDENTE)} className={`flex-1 py-3 md:py-4 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all border flex items-center justify-center gap-2 ${editingRes.status === ReservationStatus.PENDENTE ? 'bg-yellow-500 text-black border-yellow-500' : 'bg-slate-800 text-slate-400 border-slate-700'}`}><Clock size={14}/> Pendente</button>
                            <button disabled={!canDelete} onClick={() => setIsCancelling(true)} className="flex-1 py-3 md:py-4 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-black uppercase tracking-widest bg-red-600/10 text-red-500 border border-red-500/20 flex items-center justify-center gap-2"><Ban size={14}/> Cancelar</button>
                        </div>
                    </div>
                )}
                {isCancelling && (
                    <div className="space-y-4 animate-scale-in">
                        <textarea className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 md:p-4 text-white text-xs md:text-sm focus:border-red-500 transition-all font-medium h-20 md:h-24" placeholder="Motivo do cancelamento..." value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
                        <div className="flex gap-2"><button onClick={() => setIsCancelling(false)} className="flex-1 py-3 bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase">Voltar</button><button onClick={async () => { if(!cancelReason.trim()) return; await db.reservations.update({...editingRes, status: ReservationStatus.CANCELADA}, currentUser?.id, `Cancelado: ${cancelReason}`); setEditingRes(null); loadData(true); }} className="flex-[2] py-3 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg">Anular Reserva</button></div>
                    </div>
                )}
            </div>
          </div>
        </div>
      )}

      {showLaneSelector && laneSelectorTargetRes && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 p-4 backdrop-blur-xl">
              <div className="bg-slate-800 border border-slate-600 w-full max-w-sm rounded-[2.5rem] p-8 md:p-12 shadow-2xl animate-scale-in">
                  <div className="text-center mb-8"><div className="w-16 h-16 md:w-20 md:h-20 bg-neon-blue/20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-neon-blue border border-neon-blue/30 shadow-inner animate-pulse"><LayoutGrid size={32}/></div><h3 className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter leading-none mb-2">Atribuir Pista</h3><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest truncate">{laneSelectorTargetRes.clientName}</p></div>
                  <div className="grid grid-cols-3 gap-3 md:gap-4 mb-10">{Array.from({ length: settings.activeLanes }).map((_, i) => { const n = i + 1; const sel = tempSelectedLanes.includes(n); return ( <button key={n} onClick={() => setTempSelectedLanes(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n])} className={`h-14 md:h-16 rounded-xl md:rounded-2xl flex items-center justify-center text-xl md:text-2xl font-black transition-all border-2 shadow-lg active:scale-90 ${sel ? 'bg-neon-blue border-white text-white shadow-blue-500/50' : 'bg-slate-900 border-slate-700 text-slate-600 hover:border-slate-500'}`}>{n}</button> ) })}</div>
                  <div className="flex gap-2"><button onClick={() => setShowLaneSelector(false)} className="flex-1 py-4 bg-slate-700 text-white rounded-xl md:rounded-2xl font-black uppercase text-[10px] tracking-widest">Voltar</button><button onClick={saveLaneSelection} className="flex-[2] py-4 bg-green-600 hover:bg-green-500 text-white rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-[0.2em] shadow-xl transition-all active:scale-95">CONFIRMAR</button></div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Agenda;
