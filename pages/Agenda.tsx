

import React, { useEffect, useState } from 'react';
import { db } from '../services/mockBackend';
import { Reservation, ReservationStatus, AppSettings, FunnelStage, EventType, User, UserRole } from '../types';
import { INITIAL_SETTINGS } from '../constants';
import { ChevronLeft, ChevronRight, LayoutGrid, X, Users, PlusCircle, Pencil, Save, Loader2, Calendar, Check, Ban, AlertCircle, Plus, Phone, Utensils, Cake, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

const Agenda: React.FC = () => {
  // Initialize with today's date (Local Time)
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [clientPhones, setClientPhones] = useState<Record<string, string>>({}); // Map clientId -> phone
  const [settings, setSettings] = useState<AppSettings>(INITIAL_SETTINGS);
  const [loading, setLoading] = useState(true);
  
  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Metrics State
  const [metrics, setMetrics] = useState({
      totalSlots: 0,
      pendingSlots: 0,
      confirmedSlots: 0, 
      checkInSlots: 0,
      noShowSlots: 0
  });

  // Modal & Editing State
  const [editingRes, setEditingRes] = useState<Reservation | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Reservation>>({});
  
  // Multi-select Time State
  const [selectedEditTimes, setSelectedEditTimes] = useState<string[]>([]);
  const [availableSlots, setAvailableSlots] = useState<{time: string, label: string, available: boolean, left: number, isPast?: boolean}[]>([]);
  const [calculatingSlots, setCalculatingSlots] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('tonapista_auth');
    if (stored) setCurrentUser(JSON.parse(stored));
  }, []);

  // Permissions Helpers
  const canCreate = currentUser?.role === UserRole.ADMIN || currentUser?.perm_create_reservation;
  const canEdit = currentUser?.role === UserRole.ADMIN || currentUser?.perm_edit_reservation;
  const canDelete = currentUser?.role === UserRole.ADMIN || currentUser?.perm_delete_reservation;

  const loadData = async () => {
    setLoading(true);
    try {
      const s = await db.settings.get();
      setSettings(s);
      
      const [allReservations, allClients] = await Promise.all([
          db.reservations.getAll(),
          db.clients.getAll()
      ]);

      // Create Phone Map
      const phoneMap: Record<string, string> = {};
      allClients.forEach(c => {
          phoneMap[c.id] = c.phone;
      });
      setClientPhones(phoneMap);

      const dayReservations = allReservations.filter(r => r.date === selectedDate && r.status !== ReservationStatus.CANCELADA);
      setReservations(dayReservations);

      // --- Calculate KPIs based on Granular Slots ---
      let total = 0;
      let pending = 0;
      let confirmed = 0;
      let checkIn = 0;
      let noShow = 0;

      dayReservations.forEach(r => {
          const slotCount = r.laneCount * r.duration;
          total += slotCount;

          // Granular Counts from Arrays
          const currentCheckIns = r.checkedInIds?.length || 0;
          const currentNoShows = r.noShowIds?.length || 0;
          
          checkIn += currentCheckIns;
          noShow += currentNoShows;

          if (r.status === ReservationStatus.PENDENTE) {
              pending += slotCount;
          } else {
              confirmed += slotCount;
          }
      });

      setMetrics({
          totalSlots: total,
          pendingSlots: pending,
          confirmedSlots: confirmed,
          checkInSlots: checkIn,
          noShowSlots: noShow
      });

    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  // --- ACTIONS GRANULARES ---
  const handleGranularStatus = async (e: React.MouseEvent, res: Reservation, uniqueId: string, type: 'CHECK_IN' | 'NO_SHOW') => {
      e.stopPropagation(); // Impede abrir o modal de edição ao clicar no botão
      
      if (!canEdit) return; // Security Check

      const currentCheckedInIds = res.checkedInIds || [];
      const currentNoShowIds = res.noShowIds || [];
      
      let newCheckedInIds = [...currentCheckedInIds];
      let newNoShowIds = [...currentNoShowIds];

      if (type === 'CHECK_IN') {
          // Se já está checked-in, remove (toggle). Se não, adiciona.
          if (newCheckedInIds.includes(uniqueId)) {
               newCheckedInIds = newCheckedInIds.filter(id => id !== uniqueId);
          } else {
               newCheckedInIds.push(uniqueId);
               // Garante que não está em no-show
               newNoShowIds = newNoShowIds.filter(id => id !== uniqueId);
          }
      } else if (type === 'NO_SHOW') {
          // Se já está no-show, remove (toggle). Se não, adiciona.
          if (newNoShowIds.includes(uniqueId)) {
               newNoShowIds = newNoShowIds.filter(id => id !== uniqueId);
          } else {
               newNoShowIds.push(uniqueId);
               // Garante que não está em check-in
               newCheckedInIds = newCheckedInIds.filter(id => id !== uniqueId);
          }
      }

      const updatedRes = { 
          ...res, 
          checkedInIds: newCheckedInIds,
          noShowIds: newNoShowIds
      };

      setReservations(prev => prev.map(r => r.id === res.id ? updatedRes : r));
      await db.reservations.update(updatedRes);
      loadData();
  };

  // --- SLOT CALCULATION FOR EDIT ---
  useEffect(() => {
    const calculateSlots = async () => {
        if (!isEditMode || !editingRes) return;
        const targetDate = editForm.date || editingRes.date;
        if (!targetDate) return;

        setCalculatingSlots(true);

        const targetLanes = editForm.laneCount || editingRes.laneCount || 1;
        const allRes = await db.reservations.getAll();
        
        const dayRes = allRes.filter(r => 
            r.date === targetDate && 
            r.id !== editingRes.id && 
            r.status !== ReservationStatus.CANCELADA
        );

        const [y, m, d] = targetDate.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        const day = dateObj.getDay();
        
        // Get day configuration
        const dayConfig = settings.businessHours[day];
        let start = 18;
        let end = 24;

        if (dayConfig && dayConfig.isOpen) {
            start = dayConfig.start;
            end = dayConfig.end;
            if (end === 0) end = 24;
            if (end < start) end += 24; // Handle late night
        } else {
             // Closed logic
             setAvailableSlots([]);
             setCalculatingSlots(false);
             return;
        }

        const now = new Date();
        const todayStr = [
            now.getFullYear(),
            String(now.getMonth() + 1).padStart(2, '0'),
            String(now.getDate()).padStart(2, '0')
        ].join('-');
        const isToday = targetDate === todayStr;
        const currentHour = now.getHours();

        const slots = [];
        for (let h = start; h < end; h++) {
            // Normalize hour for display
            const displayHour = h >= 24 ? h - 24 : h;
            
            let occupied = 0;
            dayRes.forEach(r => {
                const rStart = parseInt(r.time.split(':')[0]);
                const rEnd = rStart + r.duration;
                // Simple logic check for overlap
                if (displayHour >= rStart && displayHour < rEnd) {
                    occupied += r.laneCount;
                }
            });
            const left = settings.activeLanes - occupied;
            const isPast = isToday && (displayHour < currentHour || (displayHour === currentHour)); 
            const isAvailable = left >= targetLanes && !isPast;

            slots.push({
                time: `${displayHour}:00`,
                label: `${displayHour}:00`,
                available: isAvailable,
                left: isAvailable ? left : 0,
                isPast: isPast
            });
        }
        setAvailableSlots(slots);
        setCalculatingSlots(false);
    };

    calculateSlots();
  }, [isEditMode, editForm.date, editForm.laneCount, editingRes, settings]);


  const toggleEditTime = (time: string) => {
      setSelectedEditTimes(prev => {
          let newTimes;
          if (prev.includes(time)) {
              newTimes = prev.filter(t => t !== time);
          } else {
              newTimes = [...prev, time].sort((a, b) => parseInt(a) - parseInt(b));
          }
          setEditForm(f => ({ ...f, duration: newTimes.length }));
          return newTimes;
      });
  };

  const closeResModal = () => {
    setEditingRes(null);
    setIsEditMode(false);
    setEditForm({});
  };

  const openResModal = (res: Reservation) => {
    setEditingRes(res);
    setIsEditMode(false);
    const times = [];
    const startHour = parseInt(res.time.split(':')[0]);
    for(let i=0; i<res.duration; i++) {
        // Simple sequential addition. Doesn't account for midnight wrap in this simplified view yet
        times.push(`${startHour + i}:00`);
    }
    setSelectedEditTimes(times);
    
    // Initialize form with all fields including table info
    setEditForm({
        date: res.date,
        peopleCount: res.peopleCount,
        laneCount: res.laneCount,
        time: res.time,
        observations: res.observations,
        eventType: res.eventType,
        duration: res.duration,
        // New Fields
        hasTableReservation: res.hasTableReservation || false,
        birthdayName: res.birthdayName || '',
        tableSeatCount: res.tableSeatCount || 0
    });
  };

  // --- SAFETY CHECK FOR EDIT ---
  const validateEditAvailability = async (reservationId: string, date: string, times: string[], lanesRequired: number) => {
      const allReservations = await db.reservations.getAll();
      const currentSettings = await db.settings.get();
      const maxLanes = currentSettings.activeLanes;
      
      const otherReservations = allReservations.filter(r => 
        r.date === date && 
        r.id !== reservationId && 
        r.status !== ReservationStatus.CANCELADA
      );

      // Check each requested hour
      for (const timeStr of times) {
          const checkHour = parseInt(timeStr.split(':')[0]);
          let occupied = 0;
          
          otherReservations.forEach(r => {
             const rStart = parseInt(r.time.split(':')[0]);
             const rEnd = rStart + r.duration;
             if (checkHour >= rStart && checkHour < rEnd) {
                 occupied += r.laneCount;
             }
          });

          if (occupied + lanesRequired > maxLanes) {
              return { valid: false, message: `Horário ${checkHour}:00 lotado! Disp: ${maxLanes - occupied}, Req: ${lanesRequired}` };
          }
      }
      return { valid: true };
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canEdit) {
          alert("Você não tem permissão para editar reservas.");
          return;
      }

      if(editingRes && editForm && selectedEditTimes.length > 0) {
          setLoading(true);
          try {
             // 1. Validate Availability
             const reqLanes = editForm.laneCount || editingRes.laneCount || 1;
             const reqDate = editForm.date || editingRes.date;
             
             const validation = await validateEditAvailability(editingRes.id, reqDate, selectedEditTimes, reqLanes);
             if (!validation.valid) {
                 alert(validation.message);
                 setLoading(false);
                 return;
             }

             const sortedHours = selectedEditTimes.map(t => parseInt(t.split(':')[0])).sort((a,b) => a - b);
             const blocks: { time: string, duration: number }[] = [];
             
             let currentStart = sortedHours[0];
             let currentDuration = 1;

             for (let i = 1; i < sortedHours.length; i++) {
                 if (sortedHours[i] === sortedHours[i-1] + 1) {
                     currentDuration++;
                 } else {
                     blocks.push({ time: `${currentStart}:00`, duration: currentDuration });
                     currentStart = sortedHours[i];
                     currentDuration = 1;
                 }
             }
             blocks.push({ time: `${currentStart}:00`, duration: currentDuration });

             const firstBlock = blocks[0];
             const updated = { 
                 ...editingRes, 
                 ...editForm, 
                 time: firstBlock.time, 
                 duration: firstBlock.duration,
                 // Ensure table data consistency based on boolean
                 birthdayName: editForm.hasTableReservation ? editForm.birthdayName : undefined,
                 tableSeatCount: editForm.hasTableReservation ? editForm.tableSeatCount : undefined
             };
             await db.reservations.update(updated);
             
             if (blocks.length > 1) {
                  for (let i = 1; i < blocks.length; i++) {
                      const block = blocks[i];
                      const newResId = uuidv4();
                      const newRes: Reservation = {
                          ...updated, // Copy
                          id: newResId,
                          time: block.time,
                          duration: block.duration,
                          createdAt: new Date().toISOString()
                      };
                      await db.reservations.create(newRes);
                  }
             }
             
             setIsEditMode(false);
             setEditingRes(updated);
             loadData();
          } catch (error) {
             console.error(error);
             alert("Erro ao salvar.");
          } finally {
             setLoading(false);
          }
      }
  };

  const handleStatusChange = async (status: ReservationStatus) => {
    if (editingRes) {
      if (status === ReservationStatus.CANCELADA && !canDelete) {
          alert("Você não tem permissão para cancelar/excluir reservas.");
          return;
      }
      if (status !== ReservationStatus.CANCELADA && !canEdit) {
          alert("Você não tem permissão para editar o status.");
          return;
      }

      const updated = { ...editingRes, status };
      await db.reservations.update(updated);
      setEditingRes(null);
      loadData();
    }
  };

  const changeDate = (days: number) => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const newDate = new Date(y, m - 1, d + days);
    
    const year = newDate.getFullYear();
    const month = String(newDate.getMonth() + 1).padStart(2, '0');
    const day = String(newDate.getDate()).padStart(2, '0');
    setSelectedDate(`${year}-${month}-${day}`);
  };

  const getDailyHours = () => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const day = date.getDay();
    
    const dayConfig = settings.businessHours[day];
    if (!dayConfig || !dayConfig.isOpen) return [];

    let start = dayConfig.start;
    let end = dayConfig.end;
    if (end === 0) end = 24;
    if (end < start) end += 24;

    const hours = [];
    for (let h = start; h < end; h++) {
      const displayHour = h >= 24 ? h - 24 : h;
      hours.push(`${displayHour}:00`);
    }
    return hours;
  };

  // Helper para cor do card, considerando granularidade e novos padrões
  const getCardStyle = (status: ReservationStatus, isCheckIn: boolean, isNoShow: boolean) => {
    if (isCheckIn) return 'border-green-500 bg-slate-900 opacity-60 grayscale-[0.3]';
    if (isNoShow) return 'border-red-500 bg-red-900/10 grayscale-[0.5] opacity-70';
    
    switch (status) {
      case ReservationStatus.CONFIRMADA: return 'border-neon-blue bg-blue-900/20'; // CHANGED: Blue for Confirmed
      case ReservationStatus.PENDENTE: return 'border-yellow-500/50 bg-yellow-900/10';
      case ReservationStatus.CANCELADA: return 'border-red-500/30 bg-red-900/10';
      default: return 'border-slate-700 bg-slate-800';
    }
  };

  const formatDateDisplay = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  };

  return (
    <div className="flex flex-col h-full space-y-6 pb-20 md:pb-0">
      
      {/* Top Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Dashboard</h1>
          <p className="text-slate-400 text-sm">Gestão de {formatDateDisplay(selectedDate)}</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            <div className="flex items-center gap-4 bg-slate-800 p-2 rounded-lg border border-slate-700 shadow-sm w-full md:w-auto justify-between md:justify-start">
            <button onClick={() => changeDate(-1)} className="p-2 hover:bg-slate-700 rounded-full text-slate-300">
                <ChevronLeft size={20} />
            </button>
            <input 
                type="date" 
                className="bg-transparent text-white font-bold text-center focus:outline-none"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
            />
            <button onClick={() => changeDate(1)} className="p-2 hover:bg-slate-700 rounded-full text-slate-300">
                <ChevronRight size={20} />
            </button>
            </div>
            
            {canCreate && (
                <Link 
                    to="/agendamento"
                    className="bg-neon-orange hover:bg-orange-500 text-white px-6 py-3 rounded-lg font-bold shadow-lg flex items-center justify-center gap-2 transition"
                >
                    <Plus size={20} />
                    <span className="hidden sm:inline">Nova Reserva</span>
                    <span className="sm:hidden">Nova</span>
                </Link>
            )}
        </div>
      </div>

      {/* KPI CARDS - THIN HORIZONTAL STYLE */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
         {/* Total */}
         <div className="bg-slate-800 p-3 rounded-xl border border-slate-700 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-700/50 rounded-lg text-slate-400">
                    <Calendar size={18} />
                </div>
                <span className="text-xs text-slate-400 uppercase font-bold">Total</span>
            </div>
            <span className="text-2xl font-bold text-white">{loading ? '-' : metrics.totalSlots}</span>
         </div>

         {/* Pendentes */}
         <div className="bg-slate-800 p-3 rounded-xl border border-yellow-500/30 flex items-center justify-between shadow-sm">
             <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-500">
                    <AlertCircle size={18} />
                </div>
                <span className="text-xs text-yellow-500 uppercase font-bold">Pendentes</span>
             </div>
             <span className="text-2xl font-bold text-yellow-500">{loading ? '-' : metrics.pendingSlots}</span>
         </div>

         {/* Confirmadas */}
         <div className="bg-slate-800 p-3 rounded-xl border border-neon-blue/30 flex items-center justify-between shadow-sm">
             <div className="flex items-center gap-3">
                <div className="p-2 bg-neon-blue/10 rounded-lg text-neon-blue">
                    <Check size={18} />
                </div>
                <span className="text-xs text-neon-blue uppercase font-bold">Confirmadas</span>
             </div>
             <span className="text-2xl font-bold text-neon-blue">{loading ? '-' : metrics.confirmedSlots}</span>
         </div>

         {/* Check-in */}
         <div className="bg-green-900/20 p-3 rounded-xl border border-green-500/30 flex items-center justify-between shadow-sm">
             <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg text-green-400">
                    <Users size={18} />
                </div>
                <span className="text-xs text-green-400 uppercase font-bold">Check-in</span>
             </div>
             <span className="text-2xl font-bold text-green-400">{loading ? '-' : metrics.checkInSlots}</span>
         </div>

         {/* No-Show */}
         <div className="bg-red-900/20 p-3 rounded-xl border border-red-500/30 flex items-center justify-between shadow-sm">
             <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/20 rounded-lg text-red-400">
                    <Ban size={18} />
                </div>
                <span className="text-xs text-red-400 uppercase font-bold">No-Show</span>
             </div>
             <span className="text-2xl font-bold text-red-500">{loading ? '-' : metrics.noShowSlots}</span>
         </div>
      </div>

      <div className="flex-1 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-2xl flex flex-col min-h-[500px]">
        {loading ? (
          <div className="flex-1 flex justify-center items-center">
            <Loader2 className="animate-spin text-neon-blue" size={48} />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
             {getDailyHours().length === 0 ? (
                 <div className="flex flex-col items-center justify-center h-full text-slate-500">
                     <Ban size={48} className="mb-4 opacity-20"/>
                     <p>Estabelecimento fechado neste dia.</p>
                 </div>
             ) : (
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
                       <div className="flex items-center gap-3">
                         <span className="text-xl font-bold text-neon-blue">{hour}</span>
                         <div className="h-4 w-[1px] bg-slate-700 mx-2"></div>
                         <span className="text-sm text-slate-500">
                           {lanesOccupied} / {settings.activeLanes} Pistas
                         </span>
                       </div>
                       <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden">
                         <div 
                           className={`h-full ${occupancyRate >= 100 ? 'bg-red-500' : 'bg-green-500'}`} 
                           style={{width: `${Math.min(occupancyRate, 100)}%`}}
                         ></div>
                       </div>
                    </div>

                    <div className="p-3">
                       {hourReservations.length === 0 ? (
                         <div className="py-2 px-2 text-slate-600 italic text-sm">
                           Disponível
                         </div>
                       ) : (
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                           {/* Loop Cards with Granular Logic */}
                           {hourReservations.flatMap(res => {
                             // Only fallback if laneCount is unexpectedly 0
                             const numberOfCards = Math.max(1, res.laneCount || 1);
                             const clientPhone = clientPhones[res.clientId] || '';
                             
                             return Array.from({ length: numberOfCards }).map((_, laneIndex) => {
                               // Generate consistent ID for this slot
                               const uniqueId = `${res.id}_${currentHourInt}:00_${laneIndex+1}`;
                               
                               const isCheckedIn = res.checkedInIds?.includes(uniqueId) || false;
                               const isNoShow = res.noShowIds?.includes(uniqueId) || false;
                               
                               const cardStyle = getCardStyle(res.status, isCheckedIn, isNoShow);

                               return (
                               <div 
                                  key={uniqueId}
                                  onClick={() => openResModal(res)}
                                  className={`relative p-3 rounded-lg border cursor-pointer hover:bg-slate-800 transition ${cardStyle}`}
                               >
                                  <div className="flex justify-between items-start mb-2">
                                    <div className="min-w-0 pr-2">
                                        <h4 className={`font-bold truncate text-sm flex items-center gap-2 ${isNoShow ? 'line-through text-slate-500' : 'text-white'}`}>
                                            {res.clientName} 
                                        </h4>
                                        {/* Phone Number Display */}
                                        <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                                            <Phone size={10} /> {clientPhone || 'Sem telefone'}
                                        </div>

                                        <div className="flex items-center gap-2 mt-2">
                                            {/* Status Badge Granular */}
                                            {isCheckedIn ? (
                                                <span className="text-[10px] font-bold text-green-400 bg-green-500/20 px-1 rounded uppercase">CHECK-IN</span>
                                            ) : isNoShow ? (
                                                <span className="text-[10px] font-bold text-red-400 bg-red-500/20 px-1 rounded uppercase">NO-SHOW</span>
                                            ) : (
                                                <span className={`text-[10px] font-bold px-1 rounded uppercase ${
                                                    res.status === ReservationStatus.CONFIRMADA ? 'text-neon-blue bg-blue-900/40 border border-neon-blue/30' : // CHANGED: Blue for badge
                                                    res.status === ReservationStatus.PENDENTE ? 'text-yellow-400 bg-yellow-900/40 border border-yellow-500/30' :
                                                    'text-slate-400 bg-slate-800'
                                                }`}>
                                                    {res.status}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action Buttons: V and X */}
                                    <div className="flex gap-1">
                                        <button 
                                            disabled={!canEdit}
                                            onClick={(e) => handleGranularStatus(e, res, uniqueId, 'CHECK_IN')}
                                            className={`w-7 h-7 flex items-center justify-center rounded border transition ${!canEdit ? 'opacity-50 cursor-not-allowed bg-slate-800 border-slate-700' : (isCheckedIn ? 'bg-green-500 text-white border-green-400' : 'bg-slate-800 text-slate-500 border-slate-600 hover:text-green-400 hover:border-green-500')}`}
                                            title="Check-in"
                                        >
                                            <Check size={14} strokeWidth={3} />
                                        </button>
                                        <button 
                                            disabled={!canEdit}
                                            onClick={(e) => handleGranularStatus(e, res, uniqueId, 'NO_SHOW')}
                                            className={`w-7 h-7 flex items-center justify-center rounded border transition ${!canEdit ? 'opacity-50 cursor-not-allowed bg-slate-800 border-slate-700' : (isNoShow ? 'bg-red-500 text-white border-red-400' : 'bg-slate-800 text-slate-500 border-slate-600 hover:text-red-400 hover:border-red-500')}`}
                                            title="No-Show"
                                        >
                                            <X size={14} strokeWidth={3} />
                                        </button>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center gap-3 text-xs opacity-70 mb-1">
                                     <span className="flex items-center gap-1"><Users size={12}/> {Math.ceil(res.peopleCount / numberOfCards)}~</span>
                                     <span className="truncate max-w-[100px]">{res.eventType}</span>
                                  </div>

                                  {/* Table Reservation Info - Compact for Grid */}
                                  {res.hasTableReservation && (
                                      <div className="mt-2 pt-2 border-t border-slate-700/50">
                                          <div className="flex flex-col gap-1">
                                              <span className="text-[10px] font-bold text-neon-orange uppercase tracking-wider flex items-center gap-1">
                                                  <Utensils size={10} /> Mesa: {res.tableSeatCount} lug.
                                              </span>
                                              {res.birthdayName && (
                                                  <span className="text-[10px] text-neon-blue flex items-center gap-1 truncate font-bold" title="Aniversariante">
                                                      <Cake size={10} /> {res.birthdayName}
                                                  </span>
                                              )}
                                          </div>
                                      </div>
                                  )}
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
              <div className="flex items-center gap-3">
                 <h3 className="text-xl font-bold text-white">Detalhes da Reserva</h3>
                 {!isEditMode && canEdit && (
                     <button 
                        onClick={() => setIsEditMode(true)}
                        className="p-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition"
                        title="Editar Reserva"
                     >
                        <Pencil size={14} />
                     </button>
                 )}
              </div>
              <button onClick={closeResModal} className="text-slate-400 hover:text-white"><X /></button>
            </div>
            
            {!isEditMode ? (
                // --- VIEW MODE ---
                <div className="p-6 space-y-4 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                        <p className="text-slate-400">Cliente</p>
                        <p className="text-white font-medium text-lg">{editingRes.clientName}</p>
                        <p className="text-slate-500 flex items-center gap-1 text-xs mt-1">
                            <Phone size={12}/> {clientPhones[editingRes.clientId] || 'Sem telefone'}
                        </p>
                        </div>
                        <div>
                        <p className="text-slate-400">Tipo</p>
                        <p className="text-neon-orange font-medium">{editingRes.eventType}</p>
                        </div>
                        <div>
                        <p className="text-slate-400">Horário</p>
                        <p className="text-white font-medium">{editingRes.time} ({editingRes.date.split('-').reverse().join('/')})</p>
                        <p className="text-xs text-slate-500">Duração: {editingRes.duration}h</p>
                        </div>
                        <div>
                        <p className="text-slate-400">Pistas (Total)</p>
                        <p className="text-white font-medium">
                            {editingRes.laneCount} Pista(s) / {editingRes.peopleCount} Pessoas
                        </p>
                        </div>
                        
                        {/* Table Detail View */}
                        {editingRes.hasTableReservation && (
                             <div className="col-span-2 bg-slate-900/50 p-3 rounded border border-slate-700/50 flex gap-4 items-center">
                                 <div className="flex items-center gap-2">
                                     <div className="p-2 bg-neon-orange/10 rounded text-neon-orange"><Utensils size={16}/></div>
                                     <div>
                                         <p className="text-slate-400 text-xs">Mesa Reservada</p>
                                         <p className="text-white font-bold">{editingRes.tableSeatCount} Cadeiras</p>
                                     </div>
                                 </div>
                                 {editingRes.birthdayName && (
                                     <div className="flex items-center gap-2 pl-4 border-l border-slate-700">
                                         <div className="p-2 bg-neon-blue/10 rounded text-neon-blue"><Cake size={16}/></div>
                                         <div>
                                             <p className="text-slate-400 text-xs">Aniversariante</p>
                                             <p className="text-white font-bold">{editingRes.birthdayName}</p>
                                         </div>
                                     </div>
                                 )}
                             </div>
                        )}

                        <div className="col-span-2">
                        <p className="text-slate-400">Observações</p>
                        <p className="text-slate-300 italic bg-slate-900 p-2 rounded">{editingRes.observations || 'Nenhuma.'}</p>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-slate-700">
                        <p className="text-slate-400 mb-3 text-sm font-bold uppercase">Status Geral</p>
                        <div className="flex flex-wrap gap-2">
                        <button 
                            disabled={!canEdit}
                            onClick={() => handleStatusChange(ReservationStatus.CONFIRMADA)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium flex-1 ${!canEdit ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500 text-white'}`}
                        >
                            Confirmar
                        </button>
                        <button 
                            disabled={!canEdit}
                            onClick={() => handleStatusChange(ReservationStatus.PENDENTE)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium flex-1 ${!canEdit ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-yellow-600 hover:bg-yellow-500 text-white'}`}
                        >
                            Pendente
                        </button>
                        <button 
                            disabled={!canDelete}
                            onClick={() => handleStatusChange(ReservationStatus.CANCELADA)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium flex-1 ${!canDelete ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-red-600 hover:bg-red-500 text-white'}`}
                        >
                            Cancelar
                        </button>
                        </div>
                    </div>
                </div>
            ) : (
                // --- EDIT MODE ---
                <form onSubmit={handleSaveEdit} className="p-6 space-y-4 animate-fade-in overflow-y-auto">
                    <div className="grid grid-cols-2 gap-4">
                       <div>
                          <label className="block text-xs text-slate-400 mb-1">Data</label>
                          <input 
                            type="date" 
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white"
                            value={editForm.date}
                            onChange={e => setEditForm({...editForm, date: e.target.value})}
                          />
                       </div>
                       <div>
                          <label className="block text-xs text-slate-400 mb-1">Duração Total</label>
                          <div className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white font-bold text-neon-blue">
                              {selectedEditTimes.length} hora(s) selecionada(s)
                          </div>
                       </div>
                       
                       <div className="col-span-2">
                           <label className="block text-xs text-slate-400 mb-2">Horário (Multi-seleção)</label>
                           {calculatingSlots ? (
                               <div className="flex items-center gap-2 text-slate-400 text-sm"><Loader2 className="animate-spin" size={16}/> Calculando disponibilidade...</div>
                           ) : (
                               <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 gap-2 max-h-40 overflow-y-auto pr-1">
                                   {availableSlots.length === 0 ? (
                                       <div className="col-span-6 text-center text-slate-500 text-xs italic">
                                           Fechado ou sem horários configurados para este dia.
                                       </div>
                                   ) : availableSlots.map((slot) => {
                                       const isSelected = selectedEditTimes.includes(slot.time);
                                       return (
                                           <button
                                               key={slot.time}
                                               type="button"
                                               disabled={!slot.available && !isSelected}
                                               onClick={() => toggleEditTime(slot.time)}
                                               className={`
                                                   px-2 py-2 rounded text-xs font-bold border transition flex flex-col items-center justify-center
                                                   ${isSelected
                                                       ? 'bg-neon-blue text-white border-neon-blue ring-2 ring-neon-blue/30 shadow-[0_0_10px_rgba(59,130,246,0.5)]'
                                                       : !slot.available
                                                           ? 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed opacity-50'
                                                           : 'bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700'
                                                   }
                                               `}
                                           >
                                               <span>{slot.label}</span>
                                               {(!slot.available && !isSelected) ? (
                                                    <span className="text-[8px] text-red-500 font-bold uppercase mt-1">
                                                        {slot.isPast ? 'Encerrado' : 'Esgotado'}
                                                    </span>
                                               ) : (
                                                    <span className="text-[8px] font-normal text-slate-400 mt-0.5">Vagas: {slot.left}</span>
                                               )}
                                           </button>
                                       );
                                   })}
                               </div>
                           )}
                           <p className="text-[10px] text-slate-500 mt-1 italic">* Selecione múltiplos horários para estender a duração.</p>
                       </div>

                       <div>
                          <label className="block text-xs text-slate-400 mb-1">Pistas (Slots)</label>
                          <input 
                            type="number" 
                            min="1"
                            max="20"
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white font-bold text-neon-orange"
                            value={editForm.laneCount}
                            onChange={e => setEditForm({...editForm, laneCount: parseInt(e.target.value)})}
                          />
                       </div>
                       <div>
                          <label className="block text-xs text-slate-400 mb-1">Pessoas</label>
                          <input 
                            type="number" 
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white"
                            value={editForm.peopleCount}
                            onChange={e => setEditForm({...editForm, peopleCount: parseInt(e.target.value)})}
                          />
                       </div>
                       <div className="col-span-2">
                          <label className="block text-xs text-slate-400 mb-1">Tipo de Evento</label>
                          <select
                             className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white"
                             value={editForm.eventType}
                             onChange={e => setEditForm({...editForm, eventType: e.target.value as EventType})}
                          >
                             {Object.values(EventType).map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                       </div>

                       {/* Table Reservation Logic (Replicating PublicBooking UX) */}
                       <div className="col-span-2 pt-2 border-t border-slate-700">
                           <label className="flex items-center gap-3 cursor-pointer group mb-4">
                               <div className={`w-5 h-5 rounded border flex items-center justify-center transition ${editForm.hasTableReservation ? 'bg-neon-blue border-neon-blue' : 'border-slate-600 group-hover:border-slate-400'}`}>
                                   {editForm.hasTableReservation && <CheckCircle size={14} className="text-white" />}
                               </div>
                               <input 
                                   type="checkbox" 
                                   className="hidden"
                                   checked={editForm.hasTableReservation}
                                   onChange={e => setEditForm({...editForm, hasTableReservation: e.target.checked})}
                               />
                               <span className="font-bold text-slate-300 group-hover:text-white transition flex items-center gap-2">
                                   <Utensils size={16}/> Reservar Mesa?
                               </span>
                           </label>

                           {editForm.hasTableReservation && (
                               <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
                                   {editForm.eventType === 'Aniversário' && (
                                       <div>
                                           <label className="block text-xs font-medium mb-1 text-slate-400">
                                               Nome do Aniversariante
                                           </label>
                                           <div className="relative">
                                               <Cake size={14} className="absolute left-3 top-3 text-slate-500"/>
                                               <input 
                                                   type="text"
                                                   className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 pl-9 focus:border-neon-orange focus:outline-none text-white"
                                                   value={editForm.birthdayName}
                                                   onChange={e => setEditForm({...editForm, birthdayName: e.target.value})}
                                                   placeholder="Aniversariante"
                                               />
                                           </div>
                                       </div>
                                   )}
                                   <div className={editForm.eventType === 'Aniversário' ? "" : "sm:col-span-2"}>
                                       <label className="block text-xs font-medium mb-1 text-slate-400">
                                           Qtd. Pessoas (Cadeiras)
                                       </label>
                                       <input 
                                           type="number"
                                           min={1}
                                           className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 focus:border-neon-orange focus:outline-none text-white"
                                           value={editForm.tableSeatCount}
                                           onChange={e => setEditForm({...editForm, tableSeatCount: parseInt(e.target.value) || 0})}
                                           placeholder="Ex: 10"
                                       />
                                   </div>
                               </div>
                           )}
                       </div>

                       <div className="col-span-2">
                          <label className="block text-xs text-slate-400 mb-1">Observações</label>
                          <textarea 
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white h-24"
                            value={editForm.observations}
                            onChange={e => setEditForm({...editForm, observations: e.target.value})}
                          />
                       </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                       <button type="button" onClick={() => setIsEditMode(false)} className="flex-1 py-3 bg-slate-700 text-white rounded-lg">Cancelar</button>
                       <button 
                         type="submit" 
                         disabled={loading || selectedEditTimes.length === 0}
                         className="flex-1 py-3 bg-neon-blue hover:bg-blue-500 text-white rounded-lg font-bold flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                       >
                          {loading ? <Loader2 className="animate-spin" /> : <><Save size={18} /> Salvar Alterações</>}
                       </button>
                    </div>
                </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Agenda;