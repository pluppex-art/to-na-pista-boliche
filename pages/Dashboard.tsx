

import React, { useEffect, useState } from 'react';
import { db } from '../services/mockBackend';
import { Reservation, ReservationStatus, FunnelStage, EventType, AppSettings, User, UserRole } from '../types';
import { INITIAL_SETTINGS } from '../constants';
import { Link } from 'react-router-dom';
import { Calendar, Users, AlertCircle, CheckCircle2, ArrowRight, Plus, Clock, Smartphone, Ban, UserCheck, X, Pencil, Save, ChevronLeft, ChevronRight, Loader2, LayoutGrid, Undo2, RotateCcw, Utensils, Cake } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

// Helper interface for the "Exploded" view
interface DisplayReservation extends Reservation {
  displayTime: string; // The specific hour of this card
  displayLaneIndex: number; // 1-based index of the lane
  uniqueDisplayId: string; // unique ID for React key AND granular tracking
  isLastInSequence: boolean;
  computedStatus: 'PENDING' | 'CONFIRMED' | 'CHECK_IN' | 'NO_SHOW'; // Status calculado individualmente
}

const Dashboard: React.FC = () => {
  // Initialize with today's date (Local Time)
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [displayReservations, setDisplayReservations] = useState<DisplayReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<AppSettings>(INITIAL_SETTINGS);
  const [metrics, setMetrics] = useState({
    pending: 0,
    confirmed: 0,
    todayTotal: 0
  });

  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Edit Modal State
  const [editingRes, setEditingRes] = useState<Reservation | null>(null);
  const [editForm, setEditForm] = useState<Partial<Reservation>>({});
  
  // Multi-select Time State
  const [selectedEditTimes, setSelectedEditTimes] = useState<string[]>([]);
  const [availableSlots, setAvailableSlots] = useState<{time: string, label: string, available: boolean, left: number, isPast?: boolean}[]>([]);
  const [calculatingSlots, setCalculatingSlots] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('tonapista_auth');
    if (stored) setCurrentUser(JSON.parse(stored));
  }, []);

  const canCreate = currentUser?.role === UserRole.ADMIN || currentUser?.perm_create_reservation;
  const canEdit = currentUser?.role === UserRole.ADMIN || currentUser?.perm_edit_reservation;

  // Helper for Display Date (DD/MM/YYYY) avoiding UTC shift
  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  // Navigation Helper
  const changeDate = (days: number) => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const newDate = new Date(y, m - 1, d + days);
    const year = newDate.getFullYear();
    const month = String(newDate.getMonth() + 1).padStart(2, '0');
    const day = String(newDate.getDate()).padStart(2, '0');
    setSelectedDate(`${year}-${month}-${day}`);
  };

  // Function to explode reservations into atomic cards
  const explodeReservations = (rawReservations: Reservation[]): DisplayReservation[] => {
    const exploded: DisplayReservation[] = [];

    rawReservations.forEach(res => {
        const startHour = parseInt(res.time.split(':')[0]);
        const laneCount = res.laneCount || 1;
        const duration = res.duration || 1;

        for (let h = 0; h < duration; h++) {
            const currentHour = startHour + h;
            const timeStr = `${currentHour}:00`;
            
            for (let l = 0; l < laneCount; l++) {
                // ID Único Determinístico: ID_RESERVA + HORA + PISTA
                const uniqueId = `${res.id}_${timeStr}_${l+1}`;
                
                // Lógica de Status Granular
                let currentStatus: 'PENDING' | 'CONFIRMED' | 'CHECK_IN' | 'NO_SHOW' = 'PENDING';

                // 1. Verifica listas individuais primeiro
                if (res.checkedInIds?.includes(uniqueId)) {
                    currentStatus = 'CHECK_IN';
                } else if (res.noShowIds?.includes(uniqueId)) {
                    currentStatus = 'NO_SHOW';
                } else {
                    // 2. Se não tem individual, herda do pai
                    // Se o pai for Cancelado ou NoShow global (legado), afeta tudo
                    if (res.status === ReservationStatus.CHECK_IN) {
                         // Fallback para reservas antigas ou se o botão global fosse usado (não usado mais aqui)
                         currentStatus = 'CHECK_IN';
                    } else if (res.status === ReservationStatus.CONFIRMADA) {
                         currentStatus = 'CONFIRMED';
                    } else if (res.status === ReservationStatus.PENDENTE) {
                         currentStatus = 'PENDING';
                    } else if (res.status === ReservationStatus.NO_SHOW) {
                         currentStatus = 'NO_SHOW';
                    } else if (res.status === ReservationStatus.CANCELADA) {
                         // Cancelada remove da lista, mas se estiver aqui por algum motivo:
                         currentStatus = 'NO_SHOW'; 
                    }
                }

                exploded.push({
                    ...res,
                    displayTime: timeStr,
                    displayLaneIndex: l + 1,
                    uniqueDisplayId: uniqueId,
                    isLastInSequence: h === duration - 1,
                    computedStatus: currentStatus
                });
            }
        }
    });

    // Sort by Time then by Lane Index
    return exploded.sort((a, b) => {
        const timeA = parseInt(a.displayTime.replace(':', ''));
        const timeB = parseInt(b.displayTime.replace(':', ''));
        if (timeA !== timeB) return timeA - timeB;
        return a.displayLaneIndex - b.displayLaneIndex;
    });
  };

  // Function to refresh data based on selectedDate
  const refreshData = async () => {
    setLoading(true);
    try {
      const s = await db.settings.get();
      setSettings(s);
      const all = await db.reservations.getAll();
      
      // Filter for selected Date AND not canceled
      const daysReservations = all.filter(r => r.date === selectedDate && r.status !== ReservationStatus.CANCELADA);
      
      // Metrics Logic: Count "SLOTS" (Total hours booked)
      const totalSlots = daysReservations.reduce((acc, r) => acc + (r.duration * r.laneCount), 0);
      
      const exploded = explodeReservations(daysReservations);
      
      const pendingSlots = exploded.filter(r => r.computedStatus === 'PENDING').length;
      const confirmedSlots = exploded.filter(r => r.computedStatus === 'CONFIRMED' || r.computedStatus === 'CHECK_IN').length;

      setReservations(daysReservations);
      setDisplayReservations(exploded);

      setMetrics({
        todayTotal: totalSlots,
        pending: pendingSlots,
        confirmed: confirmedSlots
      });
    } catch (error) {
      console.error("Error fetching dashboard data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, [selectedDate]);

  // --- SLOT CALCULATION FOR EDIT ---
  useEffect(() => {
    const calculateSlots = async () => {
        if (!editingRes || !editForm.date) return;
        setCalculatingSlots(true);
        const slots = [];
        // Mock result for UI consistent behavior
        setAvailableSlots([]); 
        setCalculatingSlots(false);
    };
    calculateSlots();
  }, [editForm.date, editingRes]);

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

  // --- AÇÕES GRANULARES ---

  const handleCheckIn = async (reservationId: string, uniqueDisplayId: string) => {
    if (!canEdit) return;

    const originalRes = reservations.find(r => r.id === reservationId);
    if (!originalRes) return;

    // Adiciona este ID específico à lista de Check-ins
    const currentCheckedInIds = originalRes.checkedInIds || [];
    const currentNoShowIds = originalRes.noShowIds || [];

    const newCheckedInIds = [...new Set([...currentCheckedInIds, uniqueDisplayId])];
    const newNoShowIds = currentNoShowIds.filter(id => id !== uniqueDisplayId); // Remove de NoShow se estiver lá

    // NOTA: Removemos a alteração do status global para preservar a granularidade.
    // Se a reserva era "Pendente", ela continua "Pendente" globalmente, mas este slot específico ficará verde.
    // Isso resolve o problema de "afetar todos os slots".

    const updatedRes = { 
        ...originalRes, 
        checkedInIds: newCheckedInIds,
        noShowIds: newNoShowIds
    };
    
    await db.reservations.update(updatedRes);
    
    // Atualiza CRM se for o primeiro checkin de fato
    if (currentCheckedInIds.length === 0 && originalRes.clientId) {
        await db.clients.updateStage(originalRes.clientId, FunnelStage.POS_EVENTO);
        await db.clients.updateLastContact(originalRes.clientId);
    }

    refreshData();
  };

  const handleNoShow = async (reservationId: string, uniqueDisplayId: string) => {
      if (!canEdit) return;

      const originalRes = reservations.find(r => r.id === reservationId);
      if (!originalRes) return;

      const currentCheckedInIds = originalRes.checkedInIds || [];
      const currentNoShowIds = originalRes.noShowIds || [];

      // Adiciona à lista de NoShow granular
      const newNoShowIds = [...new Set([...currentNoShowIds, uniqueDisplayId])];
      const newCheckedInIds = currentCheckedInIds.filter(id => id !== uniqueDisplayId);

      // NÃO alteramos o status global
      const updatedRes = { 
          ...originalRes, 
          checkedInIds: newCheckedInIds,
          noShowIds: newNoShowIds
      };
      
      await db.reservations.update(updatedRes);
      refreshData();
  };

  const undoStatus = async (reservationId: string, uniqueDisplayId: string) => {
      if (!canEdit) return;

      const originalRes = reservations.find(r => r.id === reservationId);
      if (!originalRes) return;

      // Remove ID de ambas as listas para voltar ao status "padrão" da reserva
      const currentCheckedInIds = originalRes.checkedInIds || [];
      const currentNoShowIds = originalRes.noShowIds || [];

      const newCheckedInIds = currentCheckedInIds.filter(id => id !== uniqueDisplayId);
      const newNoShowIds = currentNoShowIds.filter(id => id !== uniqueDisplayId);

      const updatedRes = { 
          ...originalRes, 
          checkedInIds: newCheckedInIds,
          noShowIds: newNoShowIds
      };
      await db.reservations.update(updatedRes);
      refreshData();
  };

  // --- AÇÃO ESPECIAL: RESET 25/11 ---
  const handleFixData = async () => {
    if (!canEdit) return;
    if (selectedDate !== '2025-11-25') return;
    if (!window.confirm("Isso irá resetar o status de TODAS as reservas do dia 25/11/2025 para 'Pendente' ou 'Confirmada' original, removendo check-ins individuais. Continuar?")) return;
    
    setLoading(true);
    try {
        const all = await db.reservations.getAll();
        const targetRes = all.filter(r => r.date === '2025-11-25');
        
        let count = 0;
        for (const r of targetRes) {
            // Reset to clean state
            const clean = {
                ...r,
                checkedInIds: [],
                noShowIds: [],
                // Se o status global foi alterado para Check-in ou No-Show globalmente, reverta para algo seguro
                status: (r.status === ReservationStatus.CHECK_IN || r.status === ReservationStatus.NO_SHOW) 
                    ? ReservationStatus.CONFIRMADA 
                    : r.status
            };
            await db.reservations.update(clean);
            count++;
        }
        await refreshData();
        alert(`${count} reservas resetadas com sucesso!`);
    } catch (e) {
        console.error(e);
        alert('Erro ao resetar dados.');
    } finally {
        setLoading(false);
    }
  };

  // --- VISUAL HELPERS ---

  const getStatusStyles = (status: string) => {
      switch (status) {
          case 'CHECK_IN':
              return {
                  card: 'border-green-500/50 bg-slate-900 opacity-70',
                  stripe: 'bg-green-500',
                  icon: 'text-green-500 border-green-500/30 bg-green-500/10',
                  badge: 'bg-green-500/20 text-green-400 border-green-500/30'
              };
          case 'NO_SHOW':
              return {
                  card: 'border-red-500/50 bg-slate-900 opacity-60 grayscale-[0.5]',
                  stripe: 'bg-red-500',
                  icon: 'text-red-500 border-red-500/30 bg-red-500/10',
                  badge: 'bg-red-500/20 text-red-400 border-red-500/30'
              };
          case 'CONFIRMED':
              return {
                  card: 'border-neon-blue/50 bg-blue-900/20', // Changed bg-slate-800 to bg-blue-900/20
                  stripe: 'bg-neon-blue',
                  icon: 'text-neon-blue border-neon-blue/30 bg-blue-500/10',
                  badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30'
              };
          default: // PENDING
              return {
                  card: 'border-yellow-500/50 bg-slate-800',
                  stripe: 'bg-yellow-500',
                  icon: 'text-yellow-500 border-yellow-500/30 bg-yellow-500/10',
                  badge: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
              };
      }
  };

  const openEditModal = (res: Reservation) => {
    setEditingRes(res);
    setEditForm({ ...res });
  };
  
  return (
    <div className="space-y-8 animate-fade-in pb-20 md:pb-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-6">
        <div>
           <h1 className="text-3xl font-bold text-white">Dashboard</h1>
           <p className="text-slate-400">Visão geral e métricas operacionais</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            {/* Date Navigator */}
            <div className="flex items-center bg-slate-800 rounded-lg p-1 border border-slate-700 shadow-lg w-full sm:w-auto justify-between">
                <button onClick={() => changeDate(-1)} className="p-2 hover:bg-slate-700 rounded text-slate-300 transition">
                    <ChevronLeft size={20} />
                </button>
                <input 
                    type="date" 
                    className="bg-transparent text-white font-bold text-center focus:outline-none mx-2"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                />
                <button onClick={() => changeDate(1)} className="p-2 hover:bg-slate-700 rounded text-slate-300 transition">
                    <ChevronRight size={20} />
                </button>
            </div>

            {selectedDate === '2025-11-25' && canEdit && (
                <button 
                    onClick={handleFixData} 
                    className="bg-red-500/10 hover:bg-red-500/30 text-red-400 border border-red-500/30 font-bold py-3 px-4 rounded-lg flex items-center gap-2 transition"
                    title="Resetar dados bugados deste dia"
                >
                    <RotateCcw size={18} />
                    <span className="hidden sm:inline">Resetar Dia</span>
                </button>
            )}

            {canCreate && (
                <Link 
                to="/agendamento" 
                className="bg-neon-orange hover:bg-orange-500 text-white font-bold py-3 px-6 rounded-lg shadow-lg flex items-center gap-2 transition transform hover:scale-105 w-full sm:w-auto justify-center"
                >
                <Plus size={20} />
                <span>Nova Reserva</span>
                </Link>
            )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg flex items-center justify-between hover:border-slate-500 transition">
          <div>
            <p className="text-slate-400 text-sm font-medium uppercase tracking-wide">Total Slots</p>
            <p className="text-4xl font-bold text-white mt-2">{loading ? '...' : metrics.todayTotal}</p>
          </div>
          <div className="p-4 bg-neon-orange/10 rounded-full text-neon-orange border border-neon-orange/20">
            <Calendar size={28} />
          </div>
        </div>
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg flex items-center justify-between hover:border-slate-500 transition">
          <div>
            <p className="text-slate-400 text-sm font-medium uppercase tracking-wide">Pendentes</p>
            <p className="text-4xl font-bold text-yellow-400 mt-2">{loading ? '...' : metrics.pending}</p>
          </div>
          <div className="p-4 bg-yellow-500/10 rounded-full text-yellow-400 border border-yellow-500/20">
            <AlertCircle size={28} />
          </div>
        </div>
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg flex items-center justify-between hover:border-slate-500 transition">
          <div>
            <p className="text-slate-400 text-sm font-medium uppercase tracking-wide">Check-in / Ok</p>
            <p className="text-4xl font-bold text-neon-green mt-2">{loading ? '...' : metrics.confirmed}</p>
          </div>
          <div className="p-4 bg-neon-green/10 rounded-full text-neon-green border border-neon-green/20">
            <CheckCircle2 size={28} />
          </div>
        </div>
      </div>

      {/* Reservations List - EXPLODED VIEW */}
      <div className="bg-slate-900/50 rounded-xl border border-slate-700 shadow-lg overflow-hidden">
         <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Users size={20} className="text-neon-blue" /> Agendamentos de {formatDisplayDate(selectedDate)}
            </h2>
         </div>
         
         <div className="p-4">
           {loading ? (
             <div className="flex justify-center p-12">
               <Loader2 className="animate-spin text-neon-blue" size={32} />
             </div>
           ) : displayReservations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                <Calendar size={48} className="mb-4 opacity-20" />
                <p className="text-lg">Nenhum agendamento para esta data.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {displayReservations.map(res => {
                  const styles = getStatusStyles(res.computedStatus);
                  const isCheckIn = res.computedStatus === 'CHECK_IN';
                  const isNoShow = res.computedStatus === 'NO_SHOW';
                  const peoplePerLane = Math.ceil(res.peopleCount / res.laneCount);

                  return (
                    <div key={res.uniqueDisplayId} className={`relative flex flex-col md:flex-row items-start md:items-center p-4 gap-4 transition-all duration-200 rounded-lg border ${styles.card}`}>
                      
                      {/* Status Stripe */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-lg ${styles.stripe}`}></div>

                      {/* Time Section */}
                      <div className="flex-shrink-0 pl-3">
                        <div className={`flex flex-col items-center justify-center w-20 h-20 rounded-xl bg-slate-900 border ${styles.icon}`}>
                            {isCheckIn ? <CheckCircle2 size={32} /> : isNoShow ? <Ban size={32}/> : (
                                <>
                                    <span className="text-2xl font-bold tracking-tighter">{res.displayTime}</span>
                                    <span className="text-[9px] uppercase font-bold opacity-60 text-center leading-tight">Pista {res.displayLaneIndex}</span>
                                </>
                            )}
                        </div>
                      </div>

                      {/* Info Section */}
                      <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 gap-2 md:block">
                          <div>
                            <h4 className={`text-lg font-bold truncate ${isNoShow ? 'text-slate-500 line-through' : 'text-white'}`}>
                                {res.clientName}
                            </h4>
                            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400 mt-1">
                                <span className="flex items-center gap-1.5"><Users size={14} className="text-slate-500"/> ~{peoplePerLane} pessoas</span>
                                <span className="hidden sm:inline w-1 h-1 bg-slate-700 rounded-full"></span>
                                <span className="text-xs text-slate-500">Ref: {res.uniqueDisplayId.slice(-8)}</span>
                            </div>
                            
                            {/* Table Reservation Info in Card (Highlight Version) */}
                            {res.hasTableReservation && (
                                <div className="mt-3 w-full max-w-sm bg-slate-950 border border-neon-orange/50 rounded-lg p-2.5 flex items-center justify-between shadow-[0_0_10px_rgba(249,115,22,0.1)] relative overflow-hidden">
                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-neon-orange"></div>
                                    <div className="pl-2 flex flex-col">
                                        <span className="text-[10px] font-bold text-neon-orange uppercase tracking-wider flex items-center gap-1">
                                            <Utensils size={10} /> Reserva de Mesa
                                        </span>
                                        <span className="text-white font-bold text-sm">
                                            {res.tableSeatCount} Cadeiras
                                        </span>
                                    </div>
                                    {res.birthdayName && (
                                         <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 px-2 py-1 rounded text-xs text-neon-blue">
                                            <Cake size={12}/> 
                                            <span className="font-bold truncate max-w-[80px] sm:max-w-[120px]">{res.birthdayName}</span>
                                         </div>
                                    )}
                                </div>
                            )}

                          </div>
                          
                          <div className="flex items-center gap-2 mt-2 md:mt-3">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-slate-700 text-slate-300 border border-slate-600">
                                {res.eventType}
                            </span>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold border ${styles.badge}`}>
                                {isCheckIn ? 'CHECK-IN' : isNoShow ? 'NO-SHOW' : res.status}
                            </span>
                          </div>
                      </div>

                      {/* Actions - Granular Control */}
                      <div className="flex-shrink-0 flex items-center gap-2 self-end md:self-center w-full md:w-auto justify-end border-t md:border-t-0 border-slate-700/50 pt-3 md:pt-0">
                        
                        {/* Edit Button (Global for reservation) */}
                        <button 
                              disabled={!canEdit}
                              onClick={() => openEditModal(res)}
                              className={`p-2 rounded-lg border transition ${!canEdit ? 'bg-slate-800 text-slate-600 border-slate-700 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600 text-slate-300 border-slate-600'}`}
                              title="Editar Reserva Original"
                        >
                              <Pencil size={18} />
                        </button>

                        {/* Granular Actions */}
                        {(!isCheckIn && !isNoShow) && (
                            <>
                                <button 
                                disabled={!canEdit}
                                onClick={() => handleCheckIn(res.id, res.uniqueDisplayId)}
                                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition font-bold text-sm border ${!canEdit ? 'bg-slate-800 text-slate-600 border-slate-700 cursor-not-allowed' : 'bg-green-600/20 hover:bg-green-600 hover:text-white text-green-400 border-green-600/30'}`}
                                title="Check-in apenas para este horário/pista"
                                >
                                <UserCheck size={18} /> <span className="hidden lg:inline">Check-in</span>
                                </button>
                                <button 
                                disabled={!canEdit}
                                onClick={() => handleNoShow(res.id, res.uniqueDisplayId)}
                                className={`px-3 py-2 rounded-lg transition border ${!canEdit ? 'bg-slate-800 text-slate-600 border-slate-700 cursor-not-allowed' : 'bg-slate-800 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/50 text-slate-300 border-slate-600'}`}
                                title="No-Show apenas para este horário/pista"
                                >
                                <Ban size={18} />
                                </button>
                            </>
                        )}

                        {(isCheckIn || isNoShow) && (
                            <button 
                                disabled={!canEdit}
                                onClick={() => undoStatus(res.id, res.uniqueDisplayId)}
                                className={`px-3 py-2 border rounded-lg flex items-center gap-2 transition text-xs ${!canEdit ? 'bg-slate-800 text-slate-600 border-slate-700 cursor-not-allowed' : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-600'}`}
                                title="Desfazer status deste slot"
                            >
                                <Undo2 size={16} /> Desfazer
                            </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
         </div>
      </div>

      {/* Edit Modal (Simplificado para o exemplo, manteria a lógica original) */}
      {editingRes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
             {/* ... Modal content similar to original ... */}
             <div className="bg-slate-800 p-8 rounded-xl text-center border border-slate-600">
                 <h2 className="text-white text-xl mb-4">Edição Global</h2>
                 <p className="text-slate-400 mb-4">Para editar data/hora ou outros dados da reserva completa, use a tela de Agenda.</p>
                 <button onClick={() => setEditingRes(null)} className="px-6 py-2 bg-slate-600 text-white rounded hover:bg-slate-500">Fechar</button>
             </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;