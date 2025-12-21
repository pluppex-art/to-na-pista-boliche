
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
  Timer,
  Hash,
  Tag,
  Monitor,
  Mail,
  Smartphone,
  UserCheck,
  History
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
  const isAdmin = currentUser?.role === UserRole.ADMIN;

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

  const alerts = useMemo(() => {
      const globalAlerts: { type: string, message: string, res: Reservation }[] = [];
      const todayStr = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const yesterdayStr = [yesterday.getFullYear(), String(yesterday.getMonth() + 1).padStart(2, '0'), String(yesterday.getDate()).padStart(2, '0')].join('-');

      allReservationsForAlerts.forEach(res => {
          if (res.status === ReservationStatus.CANCELADA) return;

          if (res.date === yesterdayStr && res.paymentStatus === PaymentStatus.PENDENTE && res.payOnSite) {
              globalAlerts.push({ type: 'OVERDUE_PAYMENT', message: `Pagamento pendente de ontem: ${res.clientName}`, res });
          }

          if (res.date === todayStr) {
              const [h, m] = res.time.split(':').map(Number);
              const startTime = new Date(now);
              startTime.setHours(h, m, 0, 0);
              const diffToStart = (now.getTime() - startTime.getTime()) / 60000;

              if (res.status === ReservationStatus.CONFIRMADA && diffToStart >= 20 && diffToStart < 60) {
                  globalAlerts.push({ type: 'LATE_CHECKIN', message: `${res.clientName} está ${Math.ceil(diffToStart)}min atrasado!`, res });
              }

              if (res.status === ReservationStatus.PENDENTE && !res.payOnSite && res.createdAt) {
                  const created = new Date(res.createdAt);
                  const diffCreated = (now.getTime() - created.getTime()) / 60000;
                  if (diffCreated >= 25 && diffCreated < 35) {
                      globalAlerts.push({ type: 'EXPIRING_PENDING', message: `Pré-reserva de ${res.clientName} expira agora!`, res });
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
      
      if (editingRes && editingRes.id === res.id) {
          setEditingRes(updatedRes);
      }
      
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
    setEditingRes(updated); 
    loadData(true); 
  };

  const handleSaveFullEdit = async () => {
      if (!editingRes || !editForm) return;

      const dateStr = editForm.date || editingRes.date;
      const timeStr = editForm.time || editingRes.time;
      const lanesReq = editForm.laneCount || 1;
      const duration = editForm.duration || editingRes.duration;
      const peopleReq = editForm.peopleCount || 1;

      const maxLanes = settings.activeLanes;
      const maxPeople = maxLanes * 6;

      if (lanesReq > maxLanes) {
          alert(`Capacidade máxima excedida! O sistema permite no máximo ${maxLanes} pistas.`);
          return;
      }

      if (peopleReq > maxPeople) {
          alert(`Capacidade máxima excedida! O limite é de 6 pessoas por pista (${maxPeople} no total).`);
          return;
      }

      const startH = parseInt(timeStr.split(':')[0]);
      const allRes = await db.reservations.getAll();

      for (let i = 0; i < Math.ceil(duration); i++) {
          const currentH = (startH + i) % 24;
          const { left } = checkHourCapacity(currentH, dateStr, allRes, settings.activeLanes, editingRes.id);
          if (left < lanesReq) {
              alert(`Indisponível! O horário das ${currentH}:00 já atingiu o limite de pistas configurado (${settings.activeLanes}).`);
              return;
          }
      }

      let total = editForm.totalValue || editingRes.totalValue;
      
      if (!isAdmin) {
          const [y, m, d] = dateStr.split('-').map(Number);
          const dateObj = new Date(y, m - 1, d);
          const isWeekend = [0, 5, 6].includes(dateObj.getDay());
          const price = isWeekend ? settings.weekendPrice : settings.weekdayPrice;
          total = price * lanesReq * duration;
      }

      const finalUpdate = { ...editingRes, ...editForm, laneCount: lanesReq, peopleCount: peopleReq, totalValue: total } as Reservation;
      await db.reservations.update(finalUpdate, currentUser?.id, 'Edição completa de agendamento');
      setEditingRes(finalUpdate);
      setIsEditMode(false);
      loadData(true);
  };

  const openWhatsApp = (phone?: string) => {
    if(!phone) return;
    window.open(`https://wa.me/55${phone.replace(/\D/g, '')}`, '_blank');
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
          </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-6">
        <div><h1 className="text-3xl font-black text-white tracking-tight uppercase">Dashboard Equipe</h1><p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Painel Operacional • {selectedDate.split('-').reverse().join('/')}</p></div>
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            <div className="flex items-center gap-4 bg-slate-800 p-2 rounded-2xl border border-slate-700 shadow-xl w-full md:w-auto justify-between md:justify-start">
                <button onClick={() => { const [y,m,d] = selectedDate.split('-').map(Number); const nd = new Date(y,m-1,d-1); setSelectedDate([nd.getFullYear(),String(nd.getMonth()+1).padStart(2,'0'),String(nd.getDate()).padStart(2,'0')].join('-')); }} className="p-2 hover:bg-slate-700 rounded-full text-slate-300 transition-colors"><ChevronLeft size={20} /></button>
                <input type="date" className="bg-transparent text-white font-black text-center focus:outline-none uppercase text-xs tracking-widest cursor-pointer" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}/>
                <button onClick={() => { const [y,m,d] = selectedDate.split('-').map(Number); const nd = new Date(y,m-1,d+1); setSelectedDate([nd.getFullYear(),String(nd.getMonth()+1).padStart(2,'0'),String(nd.getDate()).padStart(2,'0')].join('-')); }} className="p-2 hover:bg-slate-700 rounded-full text-slate-300 transition-colors"><ChevronRight size={20} /></button>
            </div>
            {currentUser?.perm_create_reservation && <Link to="/agendamento" className="bg-neon-orange hover:bg-orange-500 text-white px-8 py-3 rounded-2xl font-black shadow-xl flex items-center justify-center gap-2 transition transform active:scale-95 w-full sm:w-auto uppercase text-xs tracking-[0.2em]"><Plus size={20} /> Nova Reserva</Link>}
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
                               const isStaffRes = !!res.createdBy;

                               return (
                               <div key={uid} onClick={() => openResModal(res)} className={`relative p-5 rounded-2xl border cursor-pointer hover:scale-[1.02] active:scale-95 transition-all shadow-lg overflow-hidden ${
                                   isCI ? 'border-green-500 bg-slate-900 opacity-95' : 
                                   isNS ? 'border-red-500 bg-red-900/10 grayscale opacity-80' : 
                                   cardAlert?.type === 'LATE_CHECKIN' ? 'border-orange-500 bg-orange-500/10 ring-2 ring-orange-500/20' :
                                   res.status === ReservationStatus.CONFIRMADA ? 'border-neon-blue bg-blue-900/10' : 
                                   'border-yellow-500/50 bg-yellow-900/10'
                               }`}>
                                  <div className={`absolute top-0 left-0 w-1 h-full ${isStaffRes ? 'bg-purple-500' : 'bg-neon-orange'}`} title={isStaffRes ? 'Equipe' : 'Online'}></div>

                                  <div className="flex justify-between items-start mb-4">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-col gap-1.5 mb-1">
                                            {/* BADGE DE STATUS CLARO E IMPORTANTE */}
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase flex items-center gap-1 ${
                                                    res.status === ReservationStatus.CONFIRMADA ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                                                    res.status === ReservationStatus.PENDENTE ? 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30 animate-pulse' :
                                                    res.status === ReservationStatus.CHECK_IN ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                                                    'bg-slate-700 text-slate-400 border-slate-600'
                                                }`}>
                                                    {res.status === ReservationStatus.PENDENTE && <AlertCircle size={8}/>}
                                                    {res.status}
                                                </span>
                                                {!isStaffRes && <Monitor size={10} className="text-neon-orange opacity-60" />}
                                            </div>

                                            <h4 className={`font-black text-sm text-slate-100 uppercase tracking-tight leading-tight break-words ${isNS ? 'line-through text-slate-500' : ''}`}>{res.clientName}</h4>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2 ml-2">
                                        <div className="flex gap-1">
                                            <button disabled={!canEdit} onClick={(e) => handleGranularStatus(e, res, uid, 'CHECK_IN')} className={`w-8 h-8 flex items-center justify-center rounded-xl border transition-all shadow-md ${isCI ? 'bg-green-600 text-white border-green-500' : 'bg-slate-800 text-slate-500 border-slate-700 hover:text-green-400 hover:border-green-400'}`}><Check size={16}/></button>
                                            <button disabled={!canEdit} onClick={(e) => handleGranularStatus(e, res, uid, 'NO_SHOW')} className={`w-8 h-8 flex items-center justify-center rounded-xl border transition-all shadow-md ${isNS ? 'bg-red-600 text-white border-red-500' : 'bg-slate-800 text-slate-500 border-slate-700 hover:text-red-400 hover:border-red-400'}`}><Ban size={16}/></button>
                                        </div>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-y-2 gap-x-4 mb-4 pt-3 border-t border-slate-700/50">
                                      <div className="flex items-center gap-2 text-slate-400">
                                          <Users size={12} className="text-slate-500"/>
                                          <span className="text-[10px] font-bold uppercase">{res.peopleCount} Jogadores</span>
                                      </div>
                                      <div className="flex items-center gap-2 text-slate-400">
                                          <Clock size={12} className="text-slate-500"/>
                                          <span className="text-[10px] font-bold uppercase">{res.duration} Horas</span>
                                      </div>
                                      <div className="flex items-center gap-2 text-slate-400">
                                          <Tag size={12} className="text-slate-500"/>
                                          <span className="text-[10px] font-bold uppercase truncate">{res.eventType}</span>
                                      </div>
                                      <div className="flex items-center gap-2 text-slate-400">
                                          <Hash size={12} className="text-slate-500"/>
                                          <span className="text-[10px] font-bold uppercase">
                                              {isCI && res.lanesAssigned && res.lanesAssigned[idx] 
                                                  ? `Pista: ${res.lanesAssigned[idx]}` 
                                                  : `${res.laneCount} Pista(s)`}
                                          </span>
                                      </div>
                                  </div>

                                  <div className="flex flex-wrap gap-1.5">
                                      {res.hasTableReservation && (
                                          <div className="flex items-center gap-1.5 text-[10px] font-black text-orange-400 uppercase tracking-tighter bg-orange-900/10 p-1.5 rounded-lg border border-orange-500/20">
                                              <Utensils size={14} className="opacity-70"/> MESA: {res.tableSeatCount} LUG.
                                          </div>
                                      )}
                                      {res.birthdayName && (
                                          <div className="flex items-center gap-1.5 text-[10px] font-black text-blue-400 uppercase tracking-tighter bg-blue-900/10 p-1.5 rounded-lg border border-blue-500/20">
                                              <Cake size={14} className="opacity-70"/> ANIV: {res.birthdayName.toUpperCase()}
                                          </div>
                                      )}
                                      {res.payOnSite && (
                                          <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-tighter bg-slate-800 p-1.5 rounded-lg border border-slate-700">
                                              <Store size={14} className="opacity-70"/> PGTO LOCAL
                                          </div>
                                      )}
                                      {res.comandaId && (
                                          <div className="flex items-center gap-1.5 text-[10px] font-black text-purple-400 uppercase tracking-tighter bg-purple-900/10 p-1.5 rounded-lg border border-purple-500/20">
                                              <Hash size={14} className="opacity-70"/> COMANDA: {res.comandaId}
                                          </div>
                                      )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl p-2 md:p-4 overflow-y-auto">
          <div className="bg-slate-800 border border-slate-600 w-full max-w-3xl rounded-[1.5rem] md:rounded-[2.5rem] shadow-2xl animate-scale-in flex flex-col my-auto max-h-none lg:max-h-[95vh] overflow-hidden">
            
            <div className="p-4 md:p-8 border-b border-slate-700 flex justify-between items-start bg-slate-900/50 sticky top-0 z-10 backdrop-blur-md">
              <div className="flex items-start gap-3 md:gap-4 flex-1 min-w-0 pr-2">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-neon-blue/10 rounded-xl flex items-center justify-center text-neon-blue border border-neon-blue/30 shadow-inner flex-shrink-0 mt-0.5"><Info size={20} className="md:w-6 md:h-6"/></div>
                  <div className="min-w-0">
                    <h3 className="text-sm md:text-2xl font-black text-white tracking-tight uppercase leading-tight mb-1 break-words">{editingRes.clientName}</h3>
                    <div className="flex flex-wrap gap-2 items-center">
                      <p className="text-[8px] md:text-[10px] text-slate-500 font-bold uppercase tracking-widest">Reserva #{editingRes.id.slice(0,8)}</p>
                      <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase ${
                          editingRes.status === ReservationStatus.CONFIRMADA ? 'bg-green-600 text-white' : 
                          editingRes.status === ReservationStatus.PENDENTE ? 'bg-yellow-500 text-black' :
                          editingRes.status === ReservationStatus.CHECK_IN ? 'bg-blue-600 text-white' :
                          'bg-slate-700 text-slate-300'
                      }`}>{editingRes.status}</span>
                    </div>
                  </div>
              </div>
              <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
                  {canEdit && <button onClick={() => setIsEditMode(!isEditMode)} className={`p-2.5 md:p-3 rounded-xl border transition-all ${isEditMode ? 'bg-neon-blue text-white border-neon-blue shadow-lg' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'}`}><Pencil size={18} className="md:w-5 md:h-5"/></button>}
                  <button onClick={() => setEditingRes(null)} className="text-slate-400 hover:text-white p-2.5 md:p-3 bg-slate-800 rounded-xl border border-slate-700 transition-colors"><X size={20} className="md:w-6 md:h-6"/></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar bg-slate-800">
                {isEditMode ? (
                    <div className="space-y-6 animate-fade-in">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                            <div className="col-span-2"><label className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase block mb-1 tracking-widest">Data</label><input type="date" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 md:p-4 text-white text-xs md:text-sm font-bold" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} /></div>
                            <div><label className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase block mb-1 tracking-widest">Hora</label><input type="time" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 md:p-4 text-white text-xs md:text-sm font-bold" value={editForm.time} onChange={e => setEditForm({...editForm, time: e.target.value})} /></div>
                            <div><label className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase block mb-1 tracking-widest">Horas</label><input type="number" step="0.5" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 md:p-4 text-white text-xs md:text-sm font-bold" value={editForm.duration} onChange={e => setEditForm({...editForm, duration: parseFloat(e.target.value)})} /></div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                            <div>
                                <label className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase block mb-1 tracking-widest">Pistas</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 md:p-4 text-white text-xs md:text-sm font-black" 
                                    value={editForm.laneCount === undefined ? '' : editForm.laneCount} 
                                    onChange={e => {
                                        const val = e.target.value;
                                        if (val === '') {
                                            setEditForm({...editForm, laneCount: undefined});
                                            return;
                                        }
                                        const num = parseInt(val);
                                        if (isNaN(num)) return;
                                        if (num > settings.activeLanes) {
                                            alert(`Capacidade máxima excedida! O boliche possui ${settings.activeLanes} pistas.`);
                                            setEditForm({...editForm, laneCount: settings.activeLanes});
                                        } else {
                                            setEditForm({...editForm, laneCount: num});
                                        }
                                    }} 
                                />
                            </div>
                            <div>
                                <label className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase block mb-1 tracking-widest">Pessoas</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 md:p-4 text-white text-xs md:text-sm font-black" 
                                    value={editForm.peopleCount === undefined ? '' : editForm.peopleCount} 
                                    onChange={e => {
                                        const val = e.target.value;
                                        if (val === '') {
                                            setEditForm({...editForm, peopleCount: undefined});
                                            return;
                                        }
                                        const num = parseInt(val);
                                        const maxPeople = settings.activeLanes * 6;
                                        if (isNaN(num)) return;
                                        if (num > maxPeople) {
                                            alert(`Capacidade máxima excedida! O limite total é de ${maxPeople} pessoas.`);
                                            setEditForm({...editForm, peopleCount: maxPeople});
                                        } else {
                                            setEditForm({...editForm, peopleCount: num});
                                        }
                                    }} 
                                />
                            </div>
                            <div className="col-span-2 md:col-span-1"><label className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase block mb-1 tracking-widest">Evento</label><select className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 md:p-4 text-white text-xs md:text-sm font-bold" value={editForm.eventType} onChange={e => setEditForm({...editForm, eventType: e.target.value as EventType})}>{EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 pt-4 border-t border-slate-700/50">
                             {isAdmin && (
                                 <div>
                                     <label className="text-[8px] md:text-[10px] font-black text-neon-orange uppercase block mb-1 tracking-widest">Valor Total (ADMIN)</label>
                                     <div className="relative">
                                         <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14}/>
                                         <input type="number" step="0.01" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 md:p-4 pl-10 text-neon-green text-sm font-black outline-none focus:border-neon-green" value={editForm.totalValue} onChange={e => setEditForm({...editForm, totalValue: parseFloat(e.target.value)})} />
                                     </div>
                                 </div>
                             )}
                             <div className={`${!isAdmin ? 'md:col-span-2' : ''}`}>
                                <label className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase block mb-1 tracking-widest">Nome do Aniversariante</label>
                                <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 md:p-4 text-white text-sm font-bold" value={editForm.birthdayName || ''} onChange={e => setEditForm({...editForm, birthdayName: e.target.value})} placeholder="Se aplicável" />
                             </div>
                        </div>

                        <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700">
                             <div className="flex items-center justify-between">
                                 <div className="flex items-center gap-3">
                                     <Utensils size={20} className="text-neon-orange"/>
                                     <div>
                                         <p className="text-xs font-bold text-white uppercase tracking-tighter">Reserva de Mesa</p>
                                         <p className="text-[9px] text-slate-500 uppercase">Solicitar lugares no restaurante</p>
                                     </div>
                                 </div>
                                 <label className="relative inline-flex items-center cursor-pointer">
                                     <input type="checkbox" className="sr-only peer" checked={editForm.hasTableReservation} onChange={e => setEditForm({...editForm, hasTableReservation: e.target.checked})} />
                                     <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-neon-orange after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                                 </label>
                             </div>
                             {editForm.hasTableReservation && (
                                 <div className="mt-4 pt-4 border-t border-slate-800 animate-scale-in">
                                     <label className="text-[8px] md:text-[10px] font-black text-slate-500 uppercase block mb-1 tracking-widest">Lugares na Mesa</label>
                                     <input type="number" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white text-sm font-black" value={editForm.tableSeatCount || 0} onChange={e => setEditForm({...editForm, tableSeatCount: parseInt(e.target.value)})} />
                                 </div>
                             )}
                        </div>

                        <button onClick={handleSaveFullEdit} className="w-full py-4 md:py-5 bg-neon-blue hover:bg-blue-600 text-white rounded-xl md:rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-[0.2em] shadow-xl flex items-center justify-center gap-3 transition-all active:scale-95"><Save size={18}/> Salvar Dados</button>
                    </div>
                ) : (
                    <div className="space-y-6 animate-fade-in">
                        
                        <div className="bg-slate-900/30 p-4 md:p-6 rounded-[2rem] border border-slate-700/50 shadow-inner">
                            <h4 className="text-[9px] font-black text-slate-500 uppercase mb-4 tracking-widest flex items-center gap-2"><LayoutGrid size={14}/> Logística da Reserva</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                                <div className="bg-slate-800/80 p-3 md:p-4 rounded-2xl border border-slate-700/50">
                                    <p className="text-[7px] text-slate-500 font-bold uppercase mb-1 tracking-widest">Data</p>
                                    <p className="text-white font-bold text-xs md:text-sm">{editingRes.date.split('-').reverse().join('/')}</p>
                                </div>
                                <div className="bg-slate-800/80 p-3 md:p-4 rounded-2xl border border-slate-700/50">
                                    <p className="text-[7px] text-slate-500 font-bold uppercase mb-1 tracking-widest">Horário</p>
                                    <p className="text-neon-blue text-sm md:text-lg font-black">{editingRes.time}</p>
                                </div>
                                <div className="bg-slate-800/80 p-3 md:p-4 rounded-2xl border border-slate-700/50">
                                    <p className="text-[7px] text-slate-500 font-bold uppercase mb-1 tracking-widest">Duração</p>
                                    <p className="text-white font-bold text-xs md:text-sm">{editingRes.duration} Horas</p>
                                </div>
                                <div className="bg-slate-800/80 p-3 md:p-4 rounded-2xl border border-slate-700/50">
                                    <p className="text-[7px] text-slate-500 font-bold uppercase mb-1 tracking-widest">Recursos</p>
                                    <p className="text-white font-bold text-xs md:text-sm">{editingRes.laneCount} Pistas • {editingRes.peopleCount} Jog.</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-900/30 p-4 md:p-6 rounded-[2rem] border border-slate-700/50 shadow-inner">
                            <h4 className="text-[9px] font-black text-slate-500 uppercase mb-4 tracking-widest flex items-center gap-2"><UserIcon size={14}/> Identificação e Contato</h4>
                            <div className="flex flex-col md:flex-row gap-4">
                                <div className="flex-1 bg-slate-800/80 p-4 rounded-2xl border border-slate-700/50 flex items-center justify-between">
                                    <div>
                                        <p className="text-[7px] text-slate-500 font-bold uppercase mb-1">WhatsApp</p>
                                        <p className="text-white font-mono font-bold text-xs md:text-sm">{clientPhones[editingRes.clientId] || 'Não cadastrado'}</p>
                                    </div>
                                    {clientPhones[editingRes.clientId] && (
                                        <button onClick={() => openWhatsApp(clientPhones[editingRes.clientId])} className="p-2 bg-green-600/20 text-green-500 rounded-xl border border-green-500/20 hover:bg-green-600 hover:text-white transition-all shadow-lg"><MessageCircle size={20}/></button>
                                    )}
                                </div>
                                <div className="flex-1 bg-slate-800/80 p-4 rounded-2xl border border-slate-700/50 flex items-center gap-3">
                                    <div className={`p-2 rounded-xl ${!!editingRes.createdBy ? 'bg-purple-900/20 text-purple-400 border border-purple-500/20' : 'bg-neon-orange/10 text-neon-orange border border-neon-orange/20'}`}>
                                        {!!editingRes.createdBy ? <Smartphone size={18}/> : <Monitor size={18}/>}
                                    </div>
                                    <div>
                                        <p className="text-[7px] text-slate-500 font-bold uppercase mb-1">Canal de Origem</p>
                                        <p className="text-white font-bold text-[10px] md:text-xs uppercase tracking-tight">{!!editingRes.createdBy ? 'Lançado pela Equipe' : 'Reserva Online (Cliente)'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {(editingRes.birthdayName || editingRes.hasTableReservation) && (
                            <div className="bg-slate-900/30 p-4 md:p-6 rounded-[2rem] border border-slate-700/50 shadow-inner">
                                <h4 className="text-[9px] font-black text-slate-500 uppercase mb-4 tracking-widest flex items-center gap-2"><Zap size={14}/> Informações de Evento</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {editingRes.birthdayName && (
                                        <div className="bg-blue-900/20 p-4 rounded-2xl border border-blue-500/20 flex items-center gap-4">
                                            <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-400"><Cake size={20}/></div>
                                            <div>
                                                <p className="text-[7px] text-blue-400 font-bold uppercase mb-1">Aniversariante</p>
                                                <p className="text-white font-black text-xs md:text-sm uppercase">{editingRes.birthdayName}</p>
                                            </div>
                                        </div>
                                    )}
                                    {editingRes.hasTableReservation && (
                                        <div className="bg-orange-900/20 p-4 rounded-2xl border border-orange-500/20 flex items-center gap-4">
                                            <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center text-orange-400"><Utensils size={20}/></div>
                                            <div>
                                                <p className="text-[7px] text-orange-400 font-bold uppercase mb-1">Mesa no Restaurante</p>
                                                <p className="text-white font-black text-xs md:text-sm uppercase">{editingRes.tableSeatCount} LUGARES RESERVADOS</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="bg-slate-900/30 p-4 md:p-6 rounded-[2rem] border border-slate-700/50 shadow-inner">
                            <h4 className="text-[9px] font-black text-slate-500 uppercase mb-4 tracking-widest flex items-center gap-2"><DollarSign size={14}/> Financeiro e Pagamento</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/50 shadow-lg">
                                    <p className="text-[7px] text-slate-500 font-bold uppercase mb-1">Valor do Agendamento</p>
                                    <p className="text-neon-green font-black text-base md:text-xl leading-tight">{editingRes.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                </div>
                                <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/50 flex flex-col justify-center">
                                    <p className="text-[7px] text-slate-500 font-bold uppercase mb-2">Status do Pagamento</p>
                                    <span className={`w-fit text-[9px] font-black px-3 py-1 rounded-full border uppercase ${editingRes.paymentStatus === PaymentStatus.PAGO ? 'bg-green-900/30 text-green-400 border-green-500/30' : 'bg-red-900/30 text-red-400 border-red-500/30 animate-pulse'}`}>{editingRes.paymentStatus}</span>
                                </div>
                                <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/50 shadow-lg">
                                    <p className="text-[7px] text-slate-500 font-bold uppercase mb-1">Identificação Comercial</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Hash size={14} className="text-slate-500"/>
                                        <span className="text-white font-bold text-xs uppercase">{editingRes.comandaId || 'Sem Comanda'}</span>
                                    </div>
                                    {editingRes.payOnSite && <span className="text-[7px] text-neon-orange font-bold uppercase block mt-1 tracking-tighter">* Pagamento marcado para o local</span>}
                                </div>
                            </div>
                            
                            {editingRes.paymentStatus === PaymentStatus.PENDENTE && (
                                <div className="mt-4 bg-red-600/10 border border-red-600/40 p-5 rounded-2xl flex items-center justify-between shadow-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-red-600/20 rounded-xl text-red-500"><DollarSign size={24}/></div>
                                        <p className="text-xs font-black text-red-500 uppercase tracking-widest">Aguardando recebimento financeiro</p>
                                    </div>
                                    {canReceivePayment && (
                                        <button onClick={(e) => handleQuickReceive(e, editingRes)} className="bg-red-600 hover:bg-red-500 text-white px-8 py-3 rounded-xl text-xs font-black uppercase transition-all shadow-xl active:scale-95">Receber</button>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="bg-slate-900/30 p-4 md:p-6 rounded-[2rem] border border-slate-700/50 shadow-inner">
                            <h4 className="text-[9px] font-black text-slate-500 uppercase mb-3 tracking-widest flex items-center gap-2"><FileText size={14}/> Observações Internas</h4>
                            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-700 shadow-inner">
                                <p className="text-slate-300 text-xs md:text-sm italic font-medium leading-relaxed">
                                    {editingRes.observations ? `"${editingRes.observations}"` : 'Nenhuma observação técnica para esta reserva.'}
                                </p>
                            </div>
                        </div>

                        <div className="bg-slate-950/20 p-4 rounded-2xl border border-slate-800 flex flex-wrap gap-x-6 gap-y-2 opacity-50">
                            <div className="flex items-center gap-2">
                                <Calendar size={12} className="text-slate-600"/>
                                <span className="text-[8px] font-bold uppercase text-slate-600 tracking-widest">Criada em: {new Date(editingRes.createdAt).toLocaleString('pt-BR')}</span>
                            </div>
                            {editingRes.createdBy && (
                                <div className="flex items-center gap-2">
                                    <UserCheck size={12} className="text-slate-600"/>
                                    <span className="text-[8px] font-bold uppercase text-slate-600 tracking-widest">Lançado por ID: {editingRes.createdBy.slice(0,8)}</span>
                                </div>
                            )}
                        </div>

                        {editingRes.status === ReservationStatus.CHECK_IN && (
                             <div className="bg-slate-900/80 p-4 md:p-6 rounded-2xl border border-slate-700 shadow-xl space-y-3">
                                <div className="flex justify-between items-center"><h4 className="text-[8px] md:text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1.5 tracking-widest"><LayoutGrid size={12} className="text-neon-blue"/> Pistas Operacionais Ativas</h4>{canEdit && <button onClick={() => { setLaneSelectorTargetRes(editingRes); setTempSelectedLanes(editingRes.lanesAssigned || []); setShowLaneSelector(true); }} className="text-[8px] md:text-[10px] font-bold text-neon-blue uppercase flex items-center gap-1 hover:underline"><Pencil size={10}/> Editar Pistas</button>}</div>
                                <div className="flex flex-wrap gap-3">{editingRes.lanesAssigned && editingRes.lanesAssigned.length > 0 ? ( editingRes.lanesAssigned.map(l => ( <div key={l} className="w-10 h-10 md:w-14 md:h-14 bg-neon-blue text-white rounded-xl md:rounded-2xl flex items-center justify-center font-black text-lg md:text-2xl shadow-lg border border-white/10">{l}</div> )) ) : <div className="text-slate-500 italic text-[10px] py-1">Nenhuma pista física atribuída ainda</div>}</div>
                             </div>
                        )}
                    </div>
                )}
            </div>

            <div className="p-4 md:p-8 bg-slate-900 border-t border-slate-700 sticky bottom-0 z-10 shadow-[0_-10px_20px_rgba(0,0,0,0.3)]">
                {!isEditMode && !isCancelling && (
                    <div className="flex flex-col gap-3">
                        <button disabled={!canEdit} onClick={() => handleStatusChange(ReservationStatus.CONFIRMADA)} className={`w-full py-4 md:py-6 rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-[0.2em] transition-all border flex items-center justify-center gap-3 shadow-xl active:scale-[0.98] ${editingRes.status === ReservationStatus.CONFIRMADA ? 'bg-green-600 text-white border-green-500 shadow-green-900/20' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'}`}><Check size={20}/> Confirmar Reserva e Vaga</button>
                        <div className="flex gap-3">
                            <button disabled={!canEdit} onClick={() => handleStatusChange(ReservationStatus.PENDENTE)} className={`flex-1 py-4 md:py-5 rounded-2xl text-[9px] md:text-[11px] font-black uppercase tracking-widest transition-all border flex items-center justify-center gap-2 active:scale-[0.98] ${editingRes.status === ReservationStatus.PENDENTE ? 'bg-yellow-500 text-black border-yellow-500 shadow-yellow-900/20' : 'bg-slate-800 text-slate-400 border-slate-700'}`}><Clock size={16}/> Pendente</button>
                            <button disabled={!canDelete} onClick={() => setIsCancelling(true)} className="flex-1 py-4 md:py-5 rounded-2xl text-[9px] md:text-[11px] font-black uppercase tracking-widest bg-red-600/10 text-red-500 border border-red-500/20 flex items-center justify-center gap-2 hover:bg-red-600 hover:text-white transition-all active:scale-[0.98] shadow-lg shadow-red-900/10"><Ban size={16}/> Cancelar</button>
                        </div>
                    </div>
                )}
                {isCancelling && (
                    <div className="space-y-4 animate-fade-in">
                        <div className="flex items-center gap-2 mb-2"><AlertCircle size={18} className="text-red-500"/><h5 className="text-[10px] font-black text-white uppercase tracking-widest">Motivo do Cancelamento</h5></div>
                        <textarea className="w-full bg-slate-950 border border-slate-700 rounded-2xl p-4 text-white text-xs md:text-sm focus:border-red-500 transition-all font-medium h-24 shadow-inner outline-none" placeholder="Informe por que a reserva está sendo anulada..." value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
                        <div className="flex gap-3"><button onClick={() => setIsCancelling(false)} className="flex-1 py-4 bg-slate-800 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg">Voltar</button><button onClick={async () => { if(!cancelReason.trim()) return; await db.reservations.update({...editingRes, status: ReservationStatus.CANCELADA}, currentUser?.id, `Cancelado: ${cancelReason}`); setEditingRes(null); loadData(true); }} className="flex-[2] py-4 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-black uppercase text-[10px] md:text-xs tracking-[0.2em] shadow-xl shadow-red-900/30 transition-all active:scale-95">Anular Reserva Permanentemente</button></div>
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
                  <div className="flex gap-2"><button onClick={() => setShowLaneSelector(false)} className="flex-1 py-4 bg-slate-700 text-white rounded-xl md:rounded-[2.5rem] font-black uppercase text-[10px] tracking-widest">Voltar</button><button onClick={saveLaneSelection} className="flex-[2] py-4 bg-green-600 hover:bg-green-500 text-white rounded-xl md:rounded-[2.5rem] font-black uppercase text-[10px] md:text-xs tracking-[0.2em] shadow-xl transition-all active:scale-95">CONFIRMAR</button></div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Agenda;
