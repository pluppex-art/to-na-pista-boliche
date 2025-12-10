import React, { useEffect, useState } from 'react';
import { db } from '../services/mockBackend';
import { Reservation, ReservationStatus, EventType, UserRole } from '../types';
import { useApp } from '../contexts/AppContext'; // Context
import { generateDailySlots, checkHourCapacity } from '../utils/availability'; // Utils
import { ChevronLeft, ChevronRight, Users, Pencil, Save, Loader2, Calendar, Check, Ban, AlertCircle, Plus, Phone, Utensils, Cake, CheckCircle2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

const Agenda: React.FC = () => {
  const { settings, user: currentUser } = useApp(); // Use Context
  
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  });

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [clientPhones, setClientPhones] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  
  // Metrics State
  const [metrics, setMetrics] = useState({
      totalSlots: 0, pendingSlots: 0, confirmedSlots: 0, checkInSlots: 0, noShowSlots: 0
  });

  // Modal State
  const [editingRes, setEditingRes] = useState<Reservation | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Reservation>>({});
  
  const [selectedEditTimes, setSelectedEditTimes] = useState<string[]>([]);
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [calculatingSlots, setCalculatingSlots] = useState(false);

  // Permissions Helpers
  const canCreate = currentUser?.role === UserRole.ADMIN || currentUser?.perm_create_reservation;
  const canEdit = currentUser?.role === UserRole.ADMIN || currentUser?.perm_edit_reservation;
  const canDelete = currentUser?.role === UserRole.ADMIN || currentUser?.perm_delete_reservation;

  const loadData = async () => {
    setLoading(true);
    try {
      const [allReservations, allClients] = await Promise.all([
          db.reservations.getAll(),
          db.clients.getAll()
      ]);

      const phoneMap: Record<string, string> = {};
      allClients.forEach(c => { phoneMap[c.id] = c.phone; });
      setClientPhones(phoneMap);

      const dayReservations = allReservations.filter(r => r.date === selectedDate && r.status !== ReservationStatus.CANCELADA);
      setReservations(dayReservations);

      let total = 0, pending = 0, confirmed = 0, checkIn = 0, noShow = 0;
      dayReservations.forEach(r => {
          const slotCount = r.laneCount * r.duration;
          total += slotCount;
          checkIn += r.checkedInIds?.length || 0;
          noShow += r.noShowIds?.length || 0;
          if (r.status === ReservationStatus.PENDENTE) pending += slotCount; else confirmed += slotCount;
      });

      setMetrics({ totalSlots: total, pendingSlots: pending, confirmedSlots: confirmed, checkInSlots: checkIn, noShowSlots: noShow });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [selectedDate]);

  // --- ACTIONS GRANULARES ---
  const handleGranularStatus = async (e: React.MouseEvent, res: Reservation, uniqueId: string, type: 'CHECK_IN' | 'NO_SHOW') => {
      e.stopPropagation(); 
      if (!canEdit) return; 

      const currentCheckedInIds = res.checkedInIds || [];
      const currentNoShowIds = res.noShowIds || [];
      let newCheckedInIds = [...currentCheckedInIds];
      let newNoShowIds = [...currentNoShowIds];

      if (type === 'CHECK_IN') {
          if (newCheckedInIds.includes(uniqueId)) newCheckedInIds = newCheckedInIds.filter(id => id !== uniqueId);
          else { newCheckedInIds.push(uniqueId); newNoShowIds = newNoShowIds.filter(id => id !== uniqueId); }
      } else if (type === 'NO_SHOW') {
          if (newNoShowIds.includes(uniqueId)) newNoShowIds = newNoShowIds.filter(id => id !== uniqueId);
          else { newNoShowIds.push(uniqueId); newCheckedInIds = newCheckedInIds.filter(id => id !== uniqueId); }
      }

      const updatedRes = { ...res, checkedInIds: newCheckedInIds, noShowIds: newNoShowIds };
      setReservations(prev => prev.map(r => r.id === res.id ? updatedRes : r));
      
      // Update with audit trail
      await db.reservations.update(updatedRes, currentUser?.id, `${type} em ${res.clientName}`);
      loadData();
  };

  // --- SLOT CALCULATION FOR EDIT (USING UTILS) ---
  useEffect(() => {
    const calculateSlots = async () => {
        if (!isEditMode || !editingRes) return;
        const targetDate = editForm.date || editingRes.date;
        if (!targetDate) return;

        setCalculatingSlots(true);
        const targetLanes = editForm.laneCount || editingRes.laneCount || 1;
        const allRes = await db.reservations.getAll();
        
        // Use utility logic, but we need to pass 'excludeReservationId'
        const rawSlots = generateDailySlots(targetDate, settings, allRes, editingRes.id);
        
        // Post-process to respect 'targetLanes' (utility only checks > 0, we need >= targetLanes)
        const slots = rawSlots.map(s => ({
            ...s,
            available: s.available && s.left >= targetLanes
        }));

        setAvailableSlots(slots);
        setCalculatingSlots(false);
    };
    calculateSlots();
  }, [isEditMode, editForm.date, editForm.laneCount, editingRes, settings]);

  const toggleEditTime = (time: string) => {
      setSelectedEditTimes(prev => {
          let newTimes;
          if (prev.includes(time)) newTimes = prev.filter(t => t !== time);
          else newTimes = [...prev, time].sort((a, b) => parseInt(a) - parseInt(b));
          setEditForm(f => ({ ...f, duration: newTimes.length }));
          return newTimes;
      });
  };

  const closeResModal = () => { setEditingRes(null); setIsEditMode(false); setEditForm({}); };

  const openResModal = (res: Reservation) => {
    setEditingRes(res);
    setIsEditMode(false);
    const times = [];
    const startHour = parseInt(res.time.split(':')[0]);
    for(let i=0; i<res.duration; i++) times.push(`${startHour + i}:00`);
    setSelectedEditTimes(times);
    setEditForm({ ...res });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canEdit) { alert("Sem permissão."); return; }

      if(editingRes && editForm && selectedEditTimes.length > 0) {
          setLoading(true);
          try {
             // Validate Availability using Utility Logic directly
             const reqLanes = editForm.laneCount || editingRes.laneCount || 1;
             const reqDate = editForm.date || editingRes.date;
             const allRes = await db.reservations.getAll();

             // Check for table limit if this reservation has a table
             const hasTable = editForm.hasTableReservation ?? editingRes.hasTableReservation;
             if (hasTable) {
                 const tableCount = allRes.filter(r => 
                    r.date === reqDate && 
                    r.hasTableReservation && 
                    r.status !== ReservationStatus.CANCELADA && 
                    r.id !== editingRes.id
                 ).length;
                 
                 if (tableCount >= 25) {
                     alert("Limite de 25 mesas atingido para esta data.");
                     setLoading(false);
                     return;
                 }
             }

             for (const timeStr of selectedEditTimes) {
                 const h = parseInt(timeStr.split(':')[0]);
                 const { left } = checkHourCapacity(h, reqDate, allRes, settings.activeLanes, editingRes.id);
                 if (left < reqLanes) {
                     alert(`Horário ${h}:00 lotado!`);
                     setLoading(false); return;
                 }
             }

             // Proceed to save (blocks creation logic same as before)
             const sortedHours = selectedEditTimes.map(t => parseInt(t.split(':')[0])).sort((a,b) => a - b);
             const blocks: { time: string, duration: number }[] = [];
             let currentStart = sortedHours[0];
             let currentDuration = 1;
             for (let i = 1; i < sortedHours.length; i++) {
                 if (sortedHours[i] === sortedHours[i-1] + 1) currentDuration++;
                 else { blocks.push({ time: `${currentStart}:00`, duration: currentDuration }); currentStart = sortedHours[i]; currentDuration = 1; }
             }
             blocks.push({ time: `${currentStart}:00`, duration: currentDuration });

             const firstBlock = blocks[0];
             const updated = { 
                 ...editingRes, ...editForm, time: firstBlock.time, duration: firstBlock.duration,
                 birthdayName: editForm.hasTableReservation ? editForm.birthdayName : undefined,
                 tableSeatCount: editForm.hasTableReservation ? editForm.tableSeatCount : undefined
             };
             
             // Update main block with audit
             await db.reservations.update(updated, currentUser?.id, `Editou detalhes da reserva`);
             
             if (blocks.length > 1) {
                  for (let i = 1; i < blocks.length; i++) {
                      const newResId = uuidv4();
                      const newRes: Reservation = { ...updated, id: newResId, time: blocks[i].time, duration: blocks[i].duration, createdAt: new Date().toISOString() };
                      await db.reservations.create(newRes, currentUser?.id);
                  }
             }
             setIsEditMode(false); setEditingRes(updated); loadData();
          } catch (error) { console.error(error); alert("Erro ao salvar."); } finally { setLoading(false); }
      }
  };

  const handleStatusChange = async (status: ReservationStatus) => {
    if (editingRes) {
      if (status === ReservationStatus.CANCELADA && !canDelete) { alert("Sem permissão."); return; }
      if (status !== ReservationStatus.CANCELADA && !canEdit) { alert("Sem permissão."); return; }
      
      // Lógica de Fidelidade: Se o status mudar para CONFIRMADA e antes NÃO ERA confirmada, adiciona pontos
      if (status === ReservationStatus.CONFIRMADA && editingRes.status !== ReservationStatus.CONFIRMADA) {
          try {
              const points = Math.floor(editingRes.totalValue);
              if (points > 0) {
                  await db.loyalty.addTransaction(
                      editingRes.clientId,
                      points,
                      `Confirmação Manual (${editingRes.date})`,
                      currentUser?.id
                  );
              }
          } catch (error) {
              console.error("Erro ao adicionar pontos de fidelidade", error);
          }
      }

      const updated = { ...editingRes, status };
      // Update with audit
      await db.reservations.update(updated, currentUser?.id, `Alterou status para ${status}`);
      setEditingRes(null); loadData();
    }
  };

  const changeDate = (days: number) => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const newDate = new Date(y, m - 1, d + days);
    setSelectedDate([newDate.getFullYear(), String(newDate.getMonth() + 1).padStart(2, '0'), String(newDate.getDate()).padStart(2, '0')].join('-'));
  };

  // Uses utility to get hours for display list
  const getDailyHours = () => {
      // We pass empty reservations just to get the time range structure from settings
      return generateDailySlots(selectedDate, settings, []).map(s => s.time);
  };

  const getCardStyle = (status: ReservationStatus, isCheckIn: boolean, isNoShow: boolean) => {
    if (isCheckIn) return 'border-green-500 bg-slate-900 opacity-70';
    if (isNoShow) return 'border-red-500 bg-red-900/10 grayscale opacity-70';
    switch (status) {
      case ReservationStatus.CONFIRMADA: return 'border-neon-blue bg-blue-900/20';
      case ReservationStatus.PENDENTE: return 'border-yellow-500/50 bg-yellow-900/10';
      default: return 'border-slate-700 bg-slate-800';
    }
  };

  const formatDateDisplay = (dateStr: string) => dateStr.split('-').reverse().join('/');

  // KPI Component
  const KPI = ({ label, value, color, icon: Icon }: any) => (
      <div className={`p-3 rounded-xl border flex items-center justify-between shadow-sm bg-slate-800 border-${color}-500/30`}>
          <div className="flex items-center gap-3"><div className={`p-2 bg-${color}-500/10 rounded-lg text-${color}-500`}><Icon size={18} /></div><span className={`text-xs uppercase font-bold text-${color}-500`}>{label}</span></div>
          <span className={`text-2xl font-bold text-${color}-500`}>{loading ? '-' : value}</span>
      </div>
  );

  return (
    <div className="flex flex-col h-full space-y-6 pb-20 md:pb-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-4">
        <div><h1 className="text-3xl font-bold text-white tracking-tight">Dashboard</h1><p className="text-slate-400 text-sm">Gestão de {formatDateDisplay(selectedDate)}</p></div>
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            <div className="flex items-center gap-4 bg-slate-800 p-2 rounded-lg border border-slate-700 shadow-sm w-full md:w-auto justify-between md:justify-start">
            <button onClick={() => changeDate(-1)} className="p-2 hover:bg-slate-700 rounded-full text-slate-300"><ChevronLeft size={20} /></button>
            <input type="date" className="bg-transparent text-white font-bold text-center focus:outline-none" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}/>
            <button onClick={() => changeDate(1)} className="p-2 hover:bg-slate-700 rounded-full text-slate-300"><ChevronRight size={20} /></button>
            </div>
            {canCreate && (<Link to="/agendamento" className="bg-neon-orange hover:bg-orange-500 text-white px-6 py-3 rounded-lg font-bold shadow-lg flex items-center justify-center gap-2 transition transform hover:scale-105 w-full sm:w-auto"><Plus size={20} /><span className="hidden sm:inline">Nova Reserva</span><span className="sm:hidden">Nova</span></Link>)}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
         <KPI label="Total" value={metrics.totalSlots} color="slate" icon={Calendar} />
         <KPI label="Pendentes" value={metrics.pendingSlots} color="yellow" icon={AlertCircle} />
         <KPI label="Confirmadas" value={metrics.confirmedSlots} color="neon-blue" icon={Check} />
         <div className="bg-green-900/20 p-3 rounded-xl border border-green-500/30 flex items-center justify-between shadow-sm"><div className="flex items-center gap-3"><div className="p-2 bg-green-500/20 rounded-lg text-green-400"><Users size={18} /></div><span className="text-xs text-green-400 uppercase font-bold">Check-in</span></div><span className="text-2xl font-bold text-green-400">{loading ? '-' : metrics.checkInSlots}</span></div>
         <div className="bg-red-900/20 p-3 rounded-xl border border-red-500/30 flex items-center justify-between shadow-sm"><div className="flex items-center gap-3"><div className="p-2 bg-red-500/20 rounded-lg text-red-400"><Ban size={18} /></div><span className="text-xs text-red-400 uppercase font-bold">No-Show</span></div><span className="text-2xl font-bold text-red-500">{loading ? '-' : metrics.noShowSlots}</span></div>
      </div>

      <div className="flex-1 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-2xl flex flex-col min-h-[500px]">
        {loading ? (<div className="flex-1 flex justify-center items-center"><Loader2 className="animate-spin text-neon-blue" size={48} /></div>) : (
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
             {getDailyHours().length === 0 ? <div className="flex flex-col items-center justify-center h-full text-slate-500"><Ban size={48} className="mb-4 opacity-20"/><p>Estabelecimento fechado neste dia.</p></div> : (
             getDailyHours().map(hour => {
               const currentHourInt = parseInt(hour.split(':')[0]);
               const hourReservations = reservations.filter(r => {
                 if (r.status === ReservationStatus.CANCELADA) return false;
                 const start = parseInt(r.time.split(':')[0]);
                 const end = start + r.duration;
                 return currentHourInt >= start && currentHourInt < end;
               });
               const lanesOccupied = hourReservations.reduce((acc, curr) => acc + curr.laneCount, 0);
               const occupancyRate = (lanesOccupied / settings.activeLanes) * 100;

               return (
                 <div key={hour} className="bg-slate-900/50 rounded-xl border border-slate-700 overflow-hidden group">
                    <div className="bg-slate-900 p-3 flex justify-between items-center border-b border-slate-700">
                       <div className="flex items-center gap-3"><span className="text-xl font-bold text-neon-blue">{hour}</span><div className="h-4 w-[1px] bg-slate-700 mx-2"></div><span className="text-sm text-slate-500">{lanesOccupied} / {settings.activeLanes} Pistas</span></div>
                       <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden"><div className={`h-full ${occupancyRate >= 100 ? 'bg-red-500' : 'bg-green-500'}`} style={{width: `${Math.min(occupancyRate, 100)}%`}}></div></div>
                    </div>
                    <div className="p-3">
                       {hourReservations.length === 0 ? <div className="py-2 px-2 text-slate-600 italic text-sm">Disponível</div> : (
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                           {hourReservations.flatMap(res => {
                             const numberOfCards = Math.max(1, res.laneCount || 1);
                             return Array.from({ length: numberOfCards }).map((_, laneIndex) => {
                               const uniqueId = `${res.id}_${currentHourInt}:00_${laneIndex+1}`;
                               const isCheckedIn = res.checkedInIds?.includes(uniqueId) || false;
                               const isNoShow = res.noShowIds?.includes(uniqueId) || false;
                               const cardStyle = getCardStyle(res.status, isCheckedIn, isNoShow);

                               return (
                               <div key={uniqueId} onClick={() => openResModal(res)} className={`relative p-3 rounded-lg border cursor-pointer hover:bg-slate-800 transition ${cardStyle}`}>
                                  <div className="flex justify-between items-start mb-2">
                                    <div className="min-w-0 pr-2">
                                        <h4 className={`font-bold truncate text-sm flex items-center gap-2 ${isNoShow ? 'line-through text-slate-500' : 'text-white'}`}>{res.clientName}</h4>
                                        <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5"><Phone size={10} /> {clientPhones[res.clientId] || 'Sem telefone'}</div>
                                        <div className="flex items-center gap-2 mt-2">
                                            {isCheckedIn ? <span className="text-[10px] font-bold text-green-400 bg-green-500/20 px-1 rounded uppercase">CHECK-IN</span> : isNoShow ? <span className="text-[10px] font-bold text-red-400 bg-red-500/20 px-1 rounded uppercase">NO-SHOW</span> : <span className={`text-[10px] font-bold px-1 rounded uppercase ${res.status === ReservationStatus.CONFIRMADA ? 'text-neon-blue bg-blue-900/40 border border-neon-blue/30' : res.status === ReservationStatus.PENDENTE ? 'text-yellow-400 bg-yellow-900/40 border border-yellow-500/30' : 'text-slate-400 bg-slate-800'}`}>{res.status}</span>}
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button disabled={!canEdit} onClick={(e) => handleGranularStatus(e, res, uniqueId, 'CHECK_IN')} className={`w-7 h-7 flex items-center justify-center rounded border transition ${!canEdit ? 'opacity-50' : isCheckedIn ? 'bg-green-500 text-white border-green-400' : 'bg-slate-800 text-slate-500 border-slate-600 hover:text-green-400'}`}><Check size={14}/></button>
                                        <button disabled={!canEdit} onClick={(e) => handleGranularStatus(e, res, uniqueId, 'NO_SHOW')} className={`w-7 h-7 flex items-center justify-center rounded border transition ${!canEdit ? 'opacity-50' : isNoShow ? 'bg-red-500 text-white border-red-400' : 'bg-slate-800 text-slate-500 border-slate-600 hover:text-red-400'}`}><Ban size={14}/></button>
                                    </div>
                                  </div>
                                  {res.hasTableReservation && <div className="mt-2 pt-2 border-t border-slate-700/50"><div className="flex flex-col gap-1"><span className="text-[10px] font-bold text-neon-orange uppercase tracking-wider flex items-center gap-1"><Utensils size={10} /> Mesa: {res.tableSeatCount} lug.</span>{res.birthdayName && <span className="text-[10px] text-neon-blue flex items-center gap-1 truncate font-bold"><Cake size={10} /> {res.birthdayName}</span>}</div></div>}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-600 w-full max-w-2xl rounded-2xl shadow-2xl animate-scale-in flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-700 flex justify-between items-center">
              <div className="flex items-center gap-3"><h3 className="text-xl font-bold text-white">Detalhes da Reserva</h3>{!isEditMode && canEdit && (<button onClick={() => setIsEditMode(true)} className="p-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition"><Pencil size={14} /></button>)}</div>
              <button onClick={closeResModal} className="text-slate-400 hover:text-white"><X /></button>
            </div>
            
            {!isEditMode ? (
                <div className="p-6 space-y-4 overflow-y-auto">
                    {/* View Mode UI (same as before but compact) */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><p className="text-slate-400">Cliente</p><p className="text-white font-medium text-lg">{editingRes.clientName}</p></div>
                        <div><p className="text-slate-400">Tipo</p><p className="text-neon-orange font-medium">{editingRes.eventType}</p></div>
                        <div><p className="text-slate-400">Horário</p><p className="text-white font-medium">{editingRes.time} ({editingRes.date.split('-').reverse().join('/')})</p></div>
                        <div><p className="text-slate-400">Pistas</p><p className="text-white font-medium">{editingRes.laneCount} Pista(s) / {editingRes.peopleCount} Pessoas</p></div>
                        {editingRes.hasTableReservation && <div className="col-span-2 bg-slate-900/50 p-3 rounded border border-slate-700/50 flex gap-4 items-center"><div className="flex items-center gap-2"><Utensils size={16} className="text-neon-orange"/> <span className="text-white font-bold">{editingRes.tableSeatCount} Cadeiras</span></div>{editingRes.birthdayName && <div className="flex items-center gap-2 pl-4 border-l border-slate-700"><Cake size={16} className="text-neon-blue"/><span className="text-white font-bold">{editingRes.birthdayName}</span></div>}</div>}
                    </div>
                    <div className="pt-4 border-t border-slate-700 flex gap-2">
                        <button disabled={!canEdit} onClick={() => handleStatusChange(ReservationStatus.CONFIRMADA)} className={`px-4 py-2 rounded-lg text-sm font-medium flex-1 ${!canEdit ? 'opacity-50' : 'bg-green-600 hover:bg-green-500 text-white'}`}>Confirmar</button>
                        <button disabled={!canEdit} onClick={() => handleStatusChange(ReservationStatus.PENDENTE)} className={`px-4 py-2 rounded-lg text-sm font-medium flex-1 ${!canEdit ? 'opacity-50' : 'bg-yellow-600 hover:bg-yellow-500 text-white'}`}>Pendente</button>
                        <button disabled={!canDelete} onClick={() => handleStatusChange(ReservationStatus.CANCELADA)} className={`px-4 py-2 rounded-lg text-sm font-medium flex-1 ${!canDelete ? 'opacity-50' : 'bg-red-600 hover:bg-red-500 text-white'}`}>Cancelar</button>
                    </div>
                </div>
            ) : (
                <form onSubmit={handleSaveEdit} className="p-6 space-y-4 animate-fade-in overflow-y-auto">
                    {/* Simplified Edit Form using utility availableSlots */}
                    <div className="grid grid-cols-2 gap-4">
                       <div><label className="text-xs text-slate-400">Data</label><input type="date" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} /></div>
                       <div><label className="text-xs text-slate-400">Duração</label><div className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white font-bold text-neon-blue">{selectedEditTimes.length}h</div></div>
                       <div className="col-span-2">
                           <label className="text-xs text-slate-400">Horários</label>
                           {calculatingSlots ? <div className="text-slate-400 text-sm"><Loader2 className="animate-spin inline mr-2"/>Calculando...</div> : (
                               <div className="grid grid-cols-6 gap-2 max-h-40 overflow-y-auto">
                                   {availableSlots.map(slot => {
                                       const isSelected = selectedEditTimes.includes(slot.time);
                                       return (
                                           <button key={slot.time} type="button" disabled={!slot.available && !isSelected} onClick={() => toggleEditTime(slot.time)} className={`p-2 rounded text-xs font-bold border ${isSelected ? 'bg-neon-blue text-white' : !slot.available ? 'opacity-50 bg-slate-900' : 'bg-slate-800 text-slate-300'}`}>{slot.label}</button>
                                       )
                                   })}
                               </div>
                           )}
                       </div>
                       <div><label className="text-xs text-slate-400">Pistas</label><input type="number" min="1" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" value={editForm.laneCount} onChange={e => setEditForm({...editForm, laneCount: parseInt(e.target.value)})} /></div>
                       <div><label className="text-xs text-slate-400">Pessoas</label><input type="number" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" value={editForm.peopleCount} onChange={e => setEditForm({...editForm, peopleCount: parseInt(e.target.value)})} /></div>
                    </div>
                    <div className="flex gap-3 pt-2"><button type="button" onClick={() => setIsEditMode(false)} className="flex-1 py-3 bg-slate-700 text-white rounded-lg">Cancelar</button><button type="submit" disabled={loading || selectedEditTimes.length === 0} className="flex-1 py-3 bg-neon-blue hover:bg-blue-500 text-white rounded-lg font-bold">{loading ? <Loader2 className="animate-spin" /> : 'Salvar'}</button></div>
                </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Agenda;