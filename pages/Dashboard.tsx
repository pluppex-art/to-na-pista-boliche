
import React, { useEffect, useState } from 'react';
import { db } from '../services/mockBackend';
import { Reservation, ReservationStatus, FunnelStage, EventType } from '../types';
import { Link } from 'react-router-dom';
import { Calendar, Users, AlertCircle, CheckCircle2, ArrowRight, Plus, Clock, Smartphone, Ban, UserCheck, X, Pencil, Save, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

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
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    pending: 0,
    confirmed: 0,
    todayTotal: 0
  });

  // Edit Modal State
  const [editingRes, setEditingRes] = useState<Reservation | null>(null);
  const [editForm, setEditForm] = useState<Partial<Reservation>>({});

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

  // Function to refresh data based on selectedDate
  const refreshData = async () => {
    setLoading(true);
    try {
      const all = await db.reservations.getAll();
      
      // Filter for selected Date
      const daysReservations = all.filter(r => r.date === selectedDate);
      
      // Metrics
      const pending = daysReservations.filter(r => r.status === ReservationStatus.PENDENTE).length;
      // Count both Confirmed and Check-in as "Active/Confirmed" for basic metrics
      const confirmed = daysReservations.filter(r => r.status === ReservationStatus.CONFIRMADA || r.status === ReservationStatus.CHECK_IN).length;

      // Sort by time
      const sortedForDay = daysReservations.sort((a, b) => {
          const timeA = parseInt(a.time.replace(':', ''));
          const timeB = parseInt(b.time.replace(':', ''));
          return timeA - timeB;
      });

      setReservations(sortedForDay);
      setMetrics({
        todayTotal: daysReservations.length,
        pending,
        confirmed
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

  const handleCheckIn = async (reservation: Reservation) => {
    const updatedRes = { ...reservation, status: ReservationStatus.CHECK_IN };
    await db.reservations.update(updatedRes);

    // Move Client to "Pós-evento" in Funnel
    const allFunnel = await db.funnel.getAll();
    const cardIndex = allFunnel.findIndex(f => f.clientId === reservation.clientId && f.stage !== FunnelStage.POS_EVENTO);
    if (cardIndex >= 0) {
        allFunnel[cardIndex].stage = FunnelStage.POS_EVENTO;
        await db.funnel.update(allFunnel); // Upsert needs full array logic or single update in real DB
    }

    // Update Client Last Contact
    const allClients = await db.clients.getAll();
    const client = allClients.find(c => c.id === reservation.clientId);
    if (client) {
        client.lastContactAt = new Date().toISOString();
        await db.clients.update(client);
    }

    // Add Interaction
    await db.interactions.add({
        id: uuidv4(),
        clientId: reservation.clientId,
        date: new Date().toISOString(),
        channel: 'Presencial',
        note: `Check-in realizado para reserva de ${reservation.time}.`
    });

    refreshData();
  };

  const handleNoShow = async (reservation: Reservation) => {
      const updatedRes = { ...reservation, status: ReservationStatus.NO_SHOW };
      await db.reservations.update(updatedRes);
      
      const allClients = await db.clients.getAll();
      const client = allClients.find(c => c.id === reservation.clientId);
      if (client) {
          client.lastContactAt = new Date().toISOString();
          await db.clients.update(client);
      }
      
      await db.interactions.add({
        id: uuidv4(),
        clientId: reservation.clientId,
        date: new Date().toISOString(),
        channel: 'Presencial',
        note: `Cliente não compareceu (No-Show) para reserva de ${reservation.time}.`
      });

      refreshData();
  };

  const undoStatus = async (reservation: Reservation) => {
      const updatedRes = { ...reservation, status: ReservationStatus.CONFIRMADA };
      await db.reservations.update(updatedRes);
      refreshData();
  };

  const openEditModal = (res: Reservation) => {
    setEditingRes(res);
    setEditForm({
      peopleCount: res.peopleCount,
      laneCount: res.laneCount,
      date: res.date,
      time: res.time,
      observations: res.observations,
      eventType: res.eventType
    });
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRes && editForm) {
      const updated = { ...editingRes, ...editForm };
      await db.reservations.update(updated);
      setEditingRes(null);
      refreshData();
    }
  };

  // Helper to get client details (Phone not directly in reservation, might need client lookup or just display N/A if not joined)
  // In a real DB, we would join. Here we fetch clients.
  const [clients, setClients] = useState<any[]>([]);
  useEffect(() => {
    const fetchClients = async () => {
      const c = await db.clients.getAll();
      setClients(c);
    };
    fetchClients();
  }, []);

  const getClientPhone = (clientId: string) => {
     const client = clients.find(c => c.id === clientId);
     return client ? client.phone : 'N/A';
  };

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-8 animate-fade-in pb-20 md:pb-0">
      {/* Header with Controls */}
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

            <Link 
            to="/agendamento" 
            className="bg-neon-orange hover:bg-orange-500 text-white font-bold py-3 px-6 rounded-lg shadow-lg flex items-center gap-2 transition transform hover:scale-105 w-full sm:w-auto justify-center"
            >
            <Plus size={20} />
            <span>Nova Reserva</span>
            </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg flex items-center justify-between hover:border-slate-500 transition">
          <div>
            <p className="text-slate-400 text-sm font-medium uppercase tracking-wide">Total em {formatDisplayDate(selectedDate)}</p>
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
            <p className="text-slate-400 text-sm font-medium uppercase tracking-wide">Confirmadas</p>
            <p className="text-4xl font-bold text-neon-green mt-2">{loading ? '...' : metrics.confirmed}</p>
          </div>
          <div className="p-4 bg-neon-green/10 rounded-full text-neon-green border border-neon-green/20">
            <CheckCircle2 size={28} />
          </div>
        </div>
      </div>

      {/* Reservations List */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-lg overflow-hidden">
         <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-900/30">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Users size={20} className="text-neon-blue" /> Agendamentos de {formatDisplayDate(selectedDate)}
            </h2>
            <Link to="/agenda" className="text-neon-blue hover:text-blue-400 text-sm font-bold flex items-center gap-1">
              VER VISÃO DE PISTAS <ArrowRight size={14} />
            </Link>
         </div>
         
         <div className="p-0">
           {loading ? (
             <div className="flex justify-center p-12">
               <Loader2 className="animate-spin text-neon-blue" size={32} />
             </div>
           ) : reservations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                <Calendar size={48} className="mb-4 opacity-20" />
                <p className="text-lg">Nenhum agendamento para esta data.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-700/50">
                {reservations.map(res => {
                  const phone = getClientPhone(res.clientId);
                  
                  // Visual States
                  const isCheckIn = res.status === ReservationStatus.CHECK_IN;
                  const isNoShow = res.status === ReservationStatus.NO_SHOW;
                  const isConfirmed = res.status === ReservationStatus.CONFIRMADA;
                  const isPending = res.status === ReservationStatus.PENDENTE;
                  
                  // Dim the row if handled (Check-in or No Show)
                  const rowOpacity = (isCheckIn || isNoShow) ? 'opacity-50 bg-slate-900/50' : 'hover:bg-slate-700/30';

                  return (
                    <div key={res.id} className={`flex flex-col md:flex-row md:items-center justify-between p-5 transition ${rowOpacity} group`}>
                      
                      {/* Time & Date Box */}
                      <div className="flex items-center gap-4 md:w-1/4 mb-3 md:mb-0">
                        <div className={`flex flex-col items-center justify-center w-14 h-14 rounded-lg font-bold border ${isNoShow ? 'border-slate-700 text-slate-600' : isCheckIn ? 'bg-green-500/10 border-green-500 text-green-500' : isConfirmed ? 'bg-neon-blue/10 border-neon-blue text-neon-blue' : 'bg-slate-700 border-slate-600 text-slate-400'}`}>
                           {isCheckIn ? <CheckCircle2 size={24}/> : isNoShow ? <Ban size={24}/> : <span className="text-lg">{res.time.split(':')[0]}h</span>}
                        </div>
                        <div>
                           <p className={`font-bold text-lg ${isNoShow ? 'text-slate-500 line-through' : 'text-white'}`}>
                             {isToday ? 'Hoje' : formatDisplayDate(res.date)}
                           </p>
                           <p className="text-sm text-slate-400 flex items-center gap-1"><Clock size={12}/> {res.duration} hora(s)</p>
                        </div>
                      </div>

                      {/* Client Info */}
                      <div className="md:w-2/4 mb-3 md:mb-0">
                         <h4 className={`font-bold text-lg transition ${isNoShow ? 'text-slate-500' : 'text-white'}`}>
                           {res.clientName}
                         </h4>
                         <div className="flex items-center gap-4 text-sm text-slate-400 mt-1">
                           <span className="flex items-center gap-1"><Smartphone size={14}/> {phone}</span>
                           <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
                           <span>{res.peopleCount} Pessoas</span>
                           <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
                           <span>{res.laneCount} Pista(s)</span>
                         </div>
                         <div className="flex gap-2 mt-2">
                            <span className="inline-block text-xs bg-slate-900 text-slate-300 px-2 py-1 rounded border border-slate-700">
                                {res.eventType}
                            </span>
                            <span className={`inline-block text-xs px-2 py-1 rounded border ${
                                isCheckIn ? 'bg-green-500/10 border-green-500/30 text-green-400' : 
                                isConfirmed ? 'bg-neon-blue/10 border-neon-blue/30 text-neon-blue' :
                                isPending ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' : 
                                isNoShow ? 'bg-slate-800 border-slate-600 text-slate-500' : ''
                            }`}>
                                {res.status}
                            </span>
                         </div>
                      </div>

                      {/* Actions */}
                      <div className="md:w-1/4 flex flex-col items-end justify-center gap-2 min-h-[50px]">
                        
                        <div className="flex items-center gap-2">
                            {/* Edit Button - Always visible for admin/staff actions */}
                            <button 
                              onClick={() => openEditModal(res)}
                              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-600 transition"
                              title="Editar Reserva"
                            >
                              <Pencil size={16} />
                            </button>

                            {/* If Confirmed or Pending, show Check-in/No-show buttons */}
                            {(isConfirmed || isPending) && (
                            <>
                                <button 
                                onClick={() => handleCheckIn(res)}
                                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg shadow-lg flex items-center gap-2 transition"
                                title="Cliente Compareceu (Check-in)"
                                >
                                <UserCheck size={18} /> <span className="font-bold">Compareceu</span>
                                </button>
                                <button 
                                onClick={() => handleNoShow(res)}
                                className="px-3 py-2 bg-slate-700 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/50 text-slate-300 border border-slate-600 rounded-lg shadow-lg transition"
                                title="Marcar como No-Show"
                                >
                                <Ban size={18} />
                                </button>
                            </>
                            )}
                        </div>

                        {isCheckIn && (
                            <div className="flex items-center gap-2 text-green-500 font-bold bg-green-500/10 px-4 py-2 rounded-lg border border-green-500/20">
                                <CheckCircle2 size={20} />
                                <span>Presente</span>
                                <button onClick={() => undoStatus(res)} className="ml-2 text-xs text-slate-500 hover:text-white underline font-normal">Desfazer</button>
                            </div>
                        )}

                        {isNoShow && (
                            <div className="flex items-center gap-2 text-red-400 font-bold bg-red-500/10 px-4 py-2 rounded-lg border border-red-500/20">
                                <X size={20} />
                                <span>No-Show</span>
                                <button onClick={() => undoStatus(res)} className="ml-2 text-xs text-slate-500 hover:text-white underline font-normal">Desfazer</button>
                            </div>
                        )}
                        
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
         </div>
      </div>

      {/* Edit Modal */}
      {editingRes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-600 w-full max-w-lg rounded-2xl shadow-2xl animate-scale-in">
             <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                <h3 className="text-xl font-bold text-white flex items-center gap-2"><Pencil size={20} className="text-neon-orange"/> Editar Reserva</h3>
                <button onClick={() => setEditingRes(null)} className="text-slate-400 hover:text-white"><X size={24}/></button>
             </div>
             <form onSubmit={saveEdit} className="p-6 space-y-4">
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
                      <label className="block text-xs text-slate-400 mb-1">Horário</label>
                      <input 
                        type="time" step="3600" 
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white"
                        value={editForm.time}
                        onChange={e => setEditForm({...editForm, time: e.target.value})}
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
                   <div>
                      <label className="block text-xs text-slate-400 mb-1">Pistas</label>
                      <input 
                        type="number" 
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white"
                        value={editForm.laneCount}
                        onChange={e => setEditForm({...editForm, laneCount: parseInt(e.target.value)})}
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
                   <div className="col-span-2">
                      <label className="block text-xs text-slate-400 mb-1">Observações</label>
                      <textarea 
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white h-20"
                        value={editForm.observations}
                        onChange={e => setEditForm({...editForm, observations: e.target.value})}
                      />
                   </div>
                </div>
                <div className="pt-4 flex gap-2">
                   <button type="button" onClick={() => setEditingRes(null)} className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium">Cancelar</button>
                   <button type="submit" className="flex-1 py-3 bg-neon-blue hover:bg-blue-500 text-white rounded-lg font-medium flex items-center justify-center gap-2">
                      <Save size={18} /> Salvar Alterações
                   </button>
                </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
