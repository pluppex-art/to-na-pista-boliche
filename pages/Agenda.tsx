
import React, { useEffect, useState } from 'react';
import { db } from '../services/mockBackend';
import { supabase } from '../services/supabaseClient';
import { Reservation, ReservationStatus, EventType, UserRole, PaymentStatus } from '../types';
import { useApp } from '../contexts/AppContext'; 
import { generateDailySlots, checkHourCapacity } from '../utils/availability'; 
import { ChevronLeft, ChevronRight, Users, Pencil, Save, Loader2, Calendar, Check, Ban, AlertCircle, Plus, Phone, Utensils, Cake, CheckCircle2, X, AlertTriangle, MessageCircle, Clock, Store, LayoutGrid, Hash, DollarSign, FileText, ClipboardList, MousePointerClick, Wallet, User as UserIcon, Info } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { EVENT_TYPES } from '../constants';

// Componente Interno para o Contador de 30 minutos
const CountdownBadge: React.FC<{ createdAt: string }> = ({ createdAt }) => {
    const [timeLeft, setTimeLeft] = useState<string>("");

    useEffect(() => {
        const updateTimer = () => {
            const created = new Date(createdAt).getTime();
            const expires = created + 30 * 60 * 1000;
            const now = new Date().getTime();
            const diff = expires - now;

            if (diff <= 0) {
                setTimeLeft("EXPIRADO");
                return;
            }

            const mins = Math.floor(diff / 60000);
            const secs = Math.floor((diff % 60000) / 1000);
            setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [createdAt]);

    if (timeLeft === "EXPIRADO") {
        return <span className="text-[8px] font-black text-red-500 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded uppercase">Tempo Esgotado</span>;
    }

    return (
        <span className="text-[8px] font-black text-yellow-500 bg-yellow-500/10 border border-yellow-500/30 px-1.5 py-0.5 rounded uppercase flex items-center gap-1 animate-pulse">
            <Clock size={8}/> Cancela em {timeLeft}
        </span>
    );
};

const Agenda: React.FC = () => {
  const navigate = useNavigate();
  const { settings, user: currentUser } = useApp(); 
  
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  });

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [clientPhones, setClientPhones] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  
  const [metrics, setMetrics] = useState({
      totalSlots: 0, pendingSlots: 0, confirmedSlots: 0, checkInSlots: 0, noShowSlots: 0
  });

  const [editingRes, setEditingRes] = useState<Reservation | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Reservation>>({});
  
  const [showLaneSelector, setShowLaneSelector] = useState(false);
  const [laneSelectorTargetRes, setLaneSelectorTargetRes] = useState<Reservation | null>(null);
  const [tempSelectedLanes, setTempSelectedLanes] = useState<number[]>([]);
  
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  
  const [unpaidConfirmed, setUnpaidConfirmed] = useState<Reservation[]>([]);
  const [unresolvedAttendance, setUnresolvedAttendance] = useState<Reservation[]>([]);

  const canEdit = currentUser?.role === UserRole.ADMIN || currentUser?.perm_edit_reservation;
  const canDelete = currentUser?.role === UserRole.ADMIN || currentUser?.perm_delete_reservation;
  const canReceivePayment = currentUser?.role === UserRole.ADMIN || currentUser?.perm_receive_payment;

  const getMonthRange = (dateStr: string) => {
      const [y, m] = dateStr.split('-').map(Number);
      const start = `${y}-${String(m).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const end = `${y}-${String(m).padStart(2, '0')}-${lastDay}`;
      return { start, end };
  };

  const loadData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const { start, end } = getMonthRange(selectedDate);
      const [monthReservations, allClients] = await Promise.all([
          db.reservations.getByDateRange(start, end),
          db.clients.getAll()
      ]);

      const phoneMap: Record<string, string> = {};
      allClients.forEach(c => { phoneMap[c.id] = c.phone; });
      setClientPhones(phoneMap);

      const dayReservations = monthReservations.filter(r => r.date === selectedDate && r.status !== ReservationStatus.CANCELADA);
      setReservations(dayReservations);

      let total = 0, pending = 0, confirmed = 0, checkIn = 0, noShow = 0;
      dayReservations.forEach(r => {
          const slotCount = (r.laneCount || 1) * Math.ceil(r.duration || 1);
          total += slotCount;
          checkIn += r.checkedInIds?.length || 0;
          noShow += r.noShowIds?.length || 0;
          
          if (r.paymentStatus === PaymentStatus.PENDENTE) pending += slotCount;
          else confirmed += slotCount;
      });

      setMetrics({ totalSlots: total, pendingSlots: pending, confirmedSlots: confirmed, checkInSlots: checkIn, noShowSlots: noShow });

      const now = new Date();
      const unresolved = monthReservations.filter(r => {
          if (r.status !== ReservationStatus.CONFIRMADA) return false;
          if (r.checkedInIds && r.checkedInIds.length > 0) return false;
          if (r.noShowIds && r.noShowIds.length > 0) return false;
          const startDateTime = new Date(`${r.date}T${r.time}`);
          return now > new Date(startDateTime.getTime() + 20 * 60000);
      });
      setUnresolvedAttendance(unresolved);

      const unpaid = monthReservations.filter(r => {
          if (r.date !== selectedDate) return false;
          const isActive = r.status === ReservationStatus.CONFIRMADA || r.status === ReservationStatus.CHECK_IN;
          return isActive && r.paymentStatus === PaymentStatus.PENDENTE;
      });
      setUnpaidConfirmed(unpaid);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => { 
    loadData();
    const channel = supabase.channel('agenda-realtime-v5')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas' }, () => loadData(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedDate]);

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
      } else {
          loadData(true);
      }
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

    if (status === ReservationStatus.CANCELADA) { 
        setIsCancelling(true); 
        return; 
    }

    if (status === ReservationStatus.CONFIRMADA && editingRes.status === ReservationStatus.PENDENTE) {
        navigate('/checkout', { 
            state: { 
                clientId: editingRes.clientId,
                name: editingRes.clientName,
                whatsapp: clientPhones[editingRes.clientId] || '',
                date: editingRes.date,
                time: editingRes.time,
                people: editingRes.peopleCount,
                lanes: editingRes.laneCount,
                duration: editingRes.duration,
                type: editingRes.eventType,
                totalValue: editingRes.totalValue,
                reservationIds: [editingRes.id]
            } 
        });
        return;
    }

    const updated = { 
        ...editingRes, 
        status, 
        paymentStatus: status === ReservationStatus.CONFIRMADA && !editingRes.payOnSite ? PaymentStatus.PAGO : editingRes.paymentStatus 
    };
    
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
      {/* Alertas de Operação */}
      <div className="space-y-2">
        {unpaidConfirmed.length > 0 && (
            <div className="bg-purple-500/10 border border-purple-500/50 rounded-xl p-4 animate-pulse">
                <h3 className="text-purple-400 font-bold flex items-center gap-2 mb-2"><Wallet size={18} /> Confirmados s/ Pagamento</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {unpaidConfirmed.map(r => (
                        <div key={r.id} onClick={() => openResModal(r)} className="bg-slate-900/90 p-3 rounded border border-purple-500/30 cursor-pointer hover:bg-slate-800 transition">
                            <div className="flex justify-between items-start mb-1"><span className="text-xs font-bold text-white truncate">{r.clientName}</span><span className="text-[10px] text-green-400 font-bold">{r.totalValue.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</span></div>
                            <span className="text-[10px] text-slate-500">{r.time}</span>
                            <button onClick={(e) => handleQuickReceive(e, r)} className="w-full mt-2 bg-green-600 hover:bg-green-500 text-white text-[10px] font-bold py-1.5 rounded flex items-center justify-center gap-1"><DollarSign size={12}/> Receber</button>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-4">
        <div><h1 className="text-3xl font-bold text-white tracking-tight">Dashboard</h1><p className="text-slate-400 text-sm">Gestão de {selectedDate.split('-').reverse().join('/')}</p></div>
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            <div className="flex items-center gap-4 bg-slate-800 p-2 rounded-lg border border-slate-700 shadow-sm w-full md:w-auto justify-between md:justify-start">
                <button onClick={() => { const [y,m,d] = selectedDate.split('-').map(Number); const nd = new Date(y,m-1,d-1); setSelectedDate([nd.getFullYear(),String(nd.getMonth()+1).padStart(2,'0'),String(nd.getDate()).padStart(2,'0')].join('-')); }} className="p-2 hover:bg-slate-700 rounded-full text-slate-300"><ChevronLeft size={20} /></button>
                <input type="date" className="bg-transparent text-white font-bold text-center focus:outline-none" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}/>
                <button onClick={() => { const [y,m,d] = selectedDate.split('-').map(Number); const nd = new Date(y,m-1,d+1); setSelectedDate([nd.getFullYear(),String(nd.getMonth()+1).padStart(2,'0'),String(nd.getDate()).padStart(2,'0')].join('-')); }} className="p-2 hover:bg-slate-700 rounded-full text-slate-300"><ChevronRight size={20} /></button>
            </div>
            {currentUser?.perm_create_reservation && <Link to="/agendamento" className="bg-neon-orange hover:bg-orange-500 text-white px-6 py-3 rounded-lg font-bold shadow-lg flex items-center justify-center gap-2 transition transform hover:scale-105 w-full sm:w-auto"><Plus size={20} /> Nova Reserva</Link>}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
         <div className="p-3 rounded-xl border flex items-center justify-between shadow-sm bg-slate-800 border-slate-700"><div className="flex items-center gap-3"><div className="p-2 bg-slate-500/10 rounded-lg text-slate-500"><Calendar size={18} /></div><span className="text-xs uppercase font-bold text-slate-500 hidden sm:inline">Total</span></div><span className="text-xl font-bold text-slate-200">{loading ? '-' : metrics.totalSlots}</span></div>
         <div className="p-3 rounded-xl border flex items-center justify-between shadow-sm bg-slate-800 border-yellow-500/30"><div className="flex items-center gap-3"><div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-500"><AlertCircle size={18} /></div><span className="text-xs uppercase font-bold text-yellow-500 hidden sm:inline">Pendente</span></div><span className="text-xl font-bold text-yellow-500">{loading ? '-' : metrics.pendingSlots}</span></div>
         <div className="bg-green-900/20 p-3 rounded-xl border border-green-500/30 flex items-center justify-between shadow-sm"><div className="flex items-center gap-3"><div className="p-2 bg-green-500/20 rounded-lg text-green-400"><Users size={18} /></div><span className="text-xs text-green-400 uppercase font-bold hidden sm:inline">Check-in</span></div><span className="text-xl font-bold text-green-400">{loading ? '-' : metrics.checkInSlots}</span></div>
         <div className="bg-red-900/20 p-3 rounded-xl border border-red-500/30 flex items-center justify-between shadow-sm"><div className="flex items-center gap-3"><div className="p-2 bg-red-500/20 rounded-lg text-red-400"><Ban size={18} /></div><span className="text-xs text-red-400 uppercase font-bold hidden sm:inline">No-Show</span></div><span className="text-xl font-bold text-red-400">{loading ? '-' : metrics.noShowSlots}</span></div>
      </div>

      <div className="flex-1 bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl flex flex-col min-h-[500px]">
        {loading ? (<div className="flex-1 flex justify-center items-center"><Loader2 className="animate-spin text-neon-blue" size={48} /></div>) : (
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
             {generateDailySlots(selectedDate, settings, []).length === 0 ? <div className="flex flex-col items-center justify-center h-full text-slate-500 py-10"><Ban size={48} className="mb-4 opacity-20"/><p>Fechado neste dia.</p></div> : (
             generateDailySlots(selectedDate, settings, []).map(slot => {
               const currentHourInt = parseInt(slot.time.split(':')[0]);
               const hourReservations = reservations.filter(r => {
                 const start = parseInt(r.time.split(':')[0]);
                 return currentHourInt >= start && currentHourInt < start + r.duration;
               });
               const lanesOccupied = hourReservations.reduce((acc, curr) => acc + curr.laneCount, 0);
               return (
                 <div key={slot.time} className="bg-slate-900/50 rounded-xl border border-slate-700 overflow-hidden group">
                    <div className="bg-slate-900 p-3 flex justify-between items-center border-b border-slate-700">
                       <div className="flex items-center gap-3"><span className="text-xl font-bold text-neon-blue">{slot.time}</span><div className="h-4 w-[1px] bg-slate-700 mx-2"></div><span className="text-sm text-slate-500">{lanesOccupied} / {settings.activeLanes} Pistas</span></div>
                       <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden"><div className={`h-full ${lanesOccupied >= settings.activeLanes ? 'bg-red-500' : 'bg-green-500'}`} style={{width: `${(lanesOccupied / settings.activeLanes) * 100}%`}}></div></div>
                    </div>
                    <div className="p-3">
                       {hourReservations.length === 0 ? <div className="py-2 px-2 text-slate-700 italic text-xs">Sem reservas neste horário</div> : (
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                           {hourReservations.flatMap(res => {
                             return Array.from({ length: res.laneCount }).map((_, idx) => {
                               const uid = `${res.id}_${currentHourInt}:00_${idx+1}`;
                               const isCI = res.checkedInIds?.includes(uid);
                               const isNS = res.noShowIds?.includes(uid);
                               const phone = clientPhones[res.clientId] || '';
                               
                               return (
                               <div key={uid} onClick={() => openResModal(res)} className={`relative p-4 rounded-xl border cursor-pointer hover:bg-slate-800 transition shadow-sm ${isCI ? 'border-green-500 bg-slate-900 opacity-95' : isNS ? 'border-red-500 bg-red-900/10 grayscale opacity-80' : res.status === ReservationStatus.CONFIRMADA ? 'border-neon-blue bg-blue-900/20' : 'border-yellow-500/50 bg-yellow-900/10'}`}>
                                  <div className="flex justify-between items-start mb-3">
                                    <div className="min-w-0 pr-2">
                                        <h4 className={`font-bold truncate text-sm text-white ${isNS ? 'line-through text-slate-500' : ''}`}>{res.clientName}</h4>
                                        {phone && <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5"><Phone size={10}/> {phone}</p>}
                                        
                                        <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                                            {isCI ? <span className="text-[8px] font-bold text-green-400 bg-green-500/20 px-1.5 py-0.5 rounded border border-green-500/30 uppercase">CHECK-IN</span> : isNS ? <span className="text-[8px] font-bold text-red-400 bg-red-600/20 px-1.5 py-0.5 rounded border border-red-500/30 uppercase">NO-SHOW</span> : <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase ${res.status === ReservationStatus.CONFIRMADA ? 'text-neon-blue bg-blue-900/40 border-neon-blue/20' : 'text-yellow-400 bg-yellow-900/40 border-yellow-500/20'}`}>{res.status}</span>}
                                            
                                            {/* CONTAGEM DOS 30 MINUTOS */}
                                            {res.status === ReservationStatus.PENDENTE && !res.payOnSite && res.createdAt && (
                                                <CountdownBadge createdAt={res.createdAt} />
                                            )}
                                            
                                            {res.paymentStatus === PaymentStatus.PENDENTE && <span className="text-[8px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded animate-pulse">PAGAMENTO</span>}
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-3">
                                        <div className="flex gap-1">
                                            <button disabled={!canEdit} onClick={(e) => handleGranularStatus(e, res, uid, 'CHECK_IN')} className={`w-7 h-7 flex items-center justify-center rounded border transition ${isCI ? 'bg-green-600 text-white border-green-500' : 'bg-slate-800 text-slate-500 border-slate-700 hover:text-green-400'}`}><Check size={14}/></button>
                                            <button disabled={!canEdit} onClick={(e) => handleGranularStatus(e, res, uid, 'NO_SHOW')} className={`w-7 h-7 flex items-center justify-center rounded border transition ${isNS ? 'bg-red-600 text-white border-red-500' : 'bg-slate-800 text-slate-500 border-slate-700 hover:text-red-400'}`}><Ban size={14}/></button>
                                        </div>
                                        {isCI && res.lanesAssigned && res.lanesAssigned.length > 0 && <div className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center border border-white/20 text-white font-black text-[10px]">{res.lanesAssigned[0]}</div>}
                                    </div>
                                  </div>

                                  <div className="pt-3 border-t border-slate-700/50 space-y-1 mt-2">
                                      {res.hasTableReservation && <div className="flex items-center gap-1.5 text-[10px] font-bold text-orange-400 uppercase"><Utensils size={12} /> Mesa: {res.tableSeatCount} Lug.</div>}
                                      {res.birthdayName && <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-400 uppercase"><Cake size={12} /> {res.birthdayName}</div>}
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

      {/* MODAL DETALHADO DE RESERVA */}
      {editingRes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
          <div className="bg-slate-800 border border-slate-600 w-full max-w-2xl rounded-3xl shadow-2xl animate-scale-in flex flex-col max-h-[90vh] overflow-hidden">
            
            <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
              <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-neon-blue/10 rounded-full flex items-center justify-center text-neon-blue border border-neon-blue/20"><Info size={20}/></div>
                  <div>
                      <h3 className="text-xl font-bold text-white tracking-tighter uppercase">{editingRes.clientName}</h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Reserva #{editingRes.id.slice(0,8)}</p>
                  </div>
              </div>
              <div className="flex items-center gap-2">
                  {canEdit && <button onClick={() => setIsEditMode(!isEditMode)} className={`p-2 rounded-xl border transition ${isEditMode ? 'bg-neon-blue text-white border-neon-blue shadow-lg' : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'}`} title="Editar Agendamento"><Pencil size={20}/></button>}
                  <button onClick={() => setEditingRes(null)} className="text-slate-400 hover:text-white p-2 bg-slate-800 rounded-xl border border-slate-700 transition"><X size={20}/></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                
                {isEditMode ? (
                    <div className="space-y-6 animate-fade-in">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="col-span-2"><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Data</label><input type="date" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-sm" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} /></div>
                            <div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Hora</label><input type="time" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-sm" value={editForm.time} onChange={e => setEditForm({...editForm, time: e.target.value})} /></div>
                            <div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Duração (h)</label><input type="number" step="0.5" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-sm" value={editForm.duration} onChange={e => setEditForm({...editForm, duration: parseFloat(e.target.value)})} /></div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Pistas</label><input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-sm font-black" value={editForm.laneCount} onChange={e => setEditForm({...editForm, laneCount: parseInt(e.target.value)})} /></div>
                            <div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Pessoas</label><input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-sm" value={editForm.peopleCount} onChange={e => setEditForm({...editForm, peopleCount: parseInt(e.target.value)})} /></div>
                            <div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Tipo Evento</label><select className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-sm" value={editForm.eventType} onChange={e => setEditForm({...editForm, eventType: e.target.value as EventType})}>{EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                        </div>
                        <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700 space-y-4">
                            <label className="flex items-center gap-2 cursor-pointer font-bold text-white text-xs"><input type="checkbox" checked={editForm.hasTableReservation} onChange={e => setEditForm({...editForm, hasTableReservation: e.target.checked})} className="w-4 h-4 accent-neon-orange"/> RESERVAR MESA NO RESTAURANTE</label>
                            {editForm.hasTableReservation && (
                                <div className="grid grid-cols-2 gap-4 pl-6 animate-scale-in">
                                    <div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Lugares Mesa</label><input type="number" className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-white text-sm" value={editForm.tableSeatCount} onChange={e => setEditForm({...editForm, tableSeatCount: parseInt(e.target.value)})} /></div>
                                    <div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Nome Aniv.</label><input className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2 text-white text-sm" value={editForm.birthdayName} onChange={e => setEditForm({...editForm, birthdayName: e.target.value})} /></div>
                                </div>
                            )}
                        </div>
                        <div><label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Observações Operacionais</label><textarea className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-sm h-24" value={editForm.observations} onChange={e => setEditForm({...editForm, observations: e.target.value})} placeholder="Instruções para a equipe..."/></div>
                        <button onClick={handleSaveFullEdit} className="w-full py-4 bg-neon-blue text-white rounded-2xl font-bold uppercase text-xs tracking-widest shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 transition active:scale-95"><Save size={18}/> Salvar Alterações</button>
                    </div>
                ) : (
                    <div className="space-y-6 animate-fade-in">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700"><p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Data/Hora</p><p className="text-white font-bold text-sm">{editingRes.date.split('-').reverse().join('/')} às {editingRes.time}</p></div>
                            <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700"><p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Configuração</p><p className="text-white font-bold text-sm">{editingRes.laneCount} Pistas / {editingRes.duration}h</p></div>
                            <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700"><p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Pessoas</p><p className="text-white font-bold text-sm">{editingRes.peopleCount} Jogadores</p></div>
                            <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-700"><p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Valor Total</p><p className="text-green-400 font-black text-sm">{editingRes.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p></div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-slate-900/30 p-5 rounded-2xl border border-slate-700 relative overflow-hidden group">
                                <div className="absolute right-[-10px] top-[-10px] text-white opacity-5 rotate-12 group-hover:scale-110 transition"><UserIcon size={100}/></div>
                                <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-3 flex items-center gap-2 tracking-widest"><UserIcon size={12}/> Dados do Cliente</h4>
                                <p className="text-white font-bold text-base mb-1">{editingRes.clientName}</p>
                                <p className="text-neon-blue font-mono font-bold text-sm flex items-center gap-2"><Phone size={14}/> {clientPhones[editingRes.clientId] || 'N/A'}</p>
                                <button onClick={() => window.open(`https://wa.me/55${(clientPhones[editingRes.clientId]||'').replace(/\D/g,'')}`)} className="mt-4 w-full py-2 bg-green-600/20 text-green-400 border border-green-500/20 rounded-xl text-[10px] font-bold uppercase flex items-center justify-center gap-2 hover:bg-green-600 hover:text-white transition"><MessageCircle size={14}/> Iniciar WhatsApp</button>
                            </div>
                            <div className="bg-slate-900/30 p-5 rounded-2xl border border-slate-700 relative overflow-hidden group">
                                <div className="absolute right-[-10px] top-[-10px] text-white opacity-5 -rotate-12 group-hover:scale-110 transition"><Utensils size={100}/></div>
                                <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-3 flex items-center gap-2 tracking-widest"><Store size={12}/> Restaurante & Evento</h4>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2"><div className="p-1.5 bg-slate-800 rounded-lg text-slate-400"><FileText size={14}/></div><span className="text-xs font-bold text-slate-200">{editingRes.eventType}</span></div>
                                    {editingRes.hasTableReservation ? (
                                        <>
                                            <div className="flex items-center gap-2"><div className="p-1.5 bg-orange-900/30 rounded-lg text-orange-400"><Utensils size={14}/></div><span className="text-xs font-bold text-orange-400">MESA PARA {editingRes.tableSeatCount} PESSOAS</span></div>
                                            {editingRes.birthdayName && <div className="flex items-center gap-2"><div className="p-1.5 bg-blue-900/30 rounded-lg text-blue-400"><Cake size={14}/></div><span className="text-xs font-bold text-blue-400">{editingRes.birthdayName}</span></div>}
                                        </>
                                    ) : <p className="text-[10px] text-slate-600 italic">Sem reserva de mesa</p>}
                                </div>
                            </div>
                        </div>

                        {editingRes.observations && (
                            <div className="bg-slate-900/80 p-5 rounded-2xl border-l-4 border-neon-blue shadow-inner">
                                <p className="text-[10px] text-slate-500 font-bold uppercase mb-2 tracking-widest">Observações Operações</p>
                                <p className="text-slate-300 text-sm italic">"{editingRes.observations}"</p>
                            </div>
                        )}

                        <div className="pt-4 border-t border-slate-700 flex flex-col md:flex-row justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-900 rounded-xl border border-slate-700 text-slate-500"><Clock size={16}/></div>
                                <div><p className="text-[9px] font-bold text-slate-500 uppercase">Criado em</p><p className="text-[11px] text-slate-300">{new Date(editingRes.createdAt).toLocaleString('pt-BR')}</p></div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tighter border ${editingRes.paymentStatus === PaymentStatus.PAGO ? 'bg-green-600/10 text-green-500 border-green-500/20' : 'bg-red-600/10 text-red-500 border-red-500/20 animate-pulse'}`}>PGTO: {editingRes.paymentStatus}</span>
                                {editingRes.comandaId && <span className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-tighter border bg-slate-900 text-slate-400 border-slate-700">Comanda: {editingRes.comandaId}</span>}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="p-6 bg-slate-900 border-t border-slate-700">
                {!isEditMode && (
                    <div className="flex flex-wrap gap-2">
                        <button disabled={!canEdit} onClick={() => handleStatusChange(ReservationStatus.CONFIRMADA)} className={`px-4 py-3 rounded-2xl text-[10px] font-bold uppercase flex-1 transition-all border flex items-center justify-center gap-2 ${editingRes.status === ReservationStatus.CONFIRMADA ? 'bg-green-600 text-white border-green-500 shadow-lg' : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'}`}><Check size={16}/> Confirmar Reserva</button>
                        <button disabled={!canEdit} onClick={() => handleStatusChange(ReservationStatus.PENDENTE)} className={`px-4 py-3 rounded-2xl text-[10px] font-bold uppercase flex-1 transition-all border flex items-center justify-center gap-2 ${editingRes.status === ReservationStatus.PENDENTE ? 'bg-yellow-500 text-black border-yellow-500 shadow-lg' : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'}`}><Clock size={16}/> Pendente</button>
                        <button disabled={!canDelete} onClick={() => setIsCancelling(true)} className="px-4 py-3 rounded-2xl text-[10px] font-bold uppercase flex-1 bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600 hover:text-white transition flex items-center justify-center gap-2"><Ban size={16}/> Cancelar</button>
                    </div>
                )}

                {isCancelling && (
                    <div className="mt-4 p-5 bg-red-950/20 border border-red-500/30 rounded-2xl animate-scale-in">
                        <label className="text-[10px] font-bold text-red-400 uppercase mb-3 block tracking-widest">Motivo do Cancelamento</label>
                        <textarea className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-white text-sm outline-none focus:border-red-500 transition-all shadow-inner" placeholder="Ex: Cliente desistiu via chat..." value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
                        <div className="flex gap-3 justify-end mt-4">
                            <button onClick={() => setIsCancelling(false)} className="px-5 py-3 rounded-xl text-xs font-bold bg-slate-800 text-white border border-slate-700 hover:bg-slate-700 transition">Voltar</button>
                            <button onClick={async () => { if(!cancelReason.trim()) return; await db.reservations.update({...editingRes, status: ReservationStatus.CANCELADA}, currentUser?.id, `Cancelado: ${cancelReason}`); setEditingRes(null); loadData(true); }} className="px-6 py-3 rounded-xl text-xs font-bold bg-red-600 text-white shadow-lg shadow-red-900/30 hover:bg-red-500 transition active:scale-95">Confirmar Cancelamento</button>
                        </div>
                    </div>
                )}
            </div>
          </div>
        </div>
      )}

      {showLaneSelector && laneSelectorTargetRes && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 p-4 backdrop-blur-xl">
              <div className="bg-slate-800 border border-slate-600 w-full max-w-sm rounded-[40px] p-10 shadow-2xl animate-scale-in">
                  <div className="text-center mb-10">
                      <div className="w-20 h-20 bg-neon-blue/20 rounded-[30px] flex items-center justify-center mx-auto mb-6 text-neon-blue border border-neon-blue/30 shadow-inner"><LayoutGrid size={40}/></div>
                      <h3 className="text-2xl font-bold text-white uppercase tracking-tighter">Atribuir Pista</h3>
                      <p className="text-[10px] text-slate-500 font-bold uppercase mt-2 tracking-widest">Iniciando jogo para {laneSelectorTargetRes.clientName}</p>
                  </div>
                  <div className="grid grid-cols-3 gap-5 mb-10">
                      {Array.from({ length: settings.activeLanes }).map((_, i) => { 
                          const n = i + 1; 
                          const sel = tempSelectedLanes.includes(n); 
                          return (
                              <button key={n} onClick={() => setTempSelectedLanes(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n])} className={`h-20 rounded-[25px] flex items-center justify-center text-3xl font-black transition-all border-2 ${sel ? 'bg-neon-blue border-white text-white shadow-[0_0_20px_rgba(59,130,246,0.6)]' : 'bg-slate-900 border-slate-700 text-slate-600 hover:border-slate-500'}`}>{n}</button>
                          )
                      })}
                  </div>
                  <button onClick={saveLaneSelection} className="w-full py-5 bg-green-600 hover:bg-green-500 text-white rounded-[25px] font-black uppercase text-sm tracking-[0.2em] shadow-xl transition active:scale-95">SALVAR E INICIAR</button>
              </div>
          </div>
      )}
    </div>
  );
};

export default Agenda;
