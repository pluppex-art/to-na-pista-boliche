
import React, { useEffect, useState } from 'react';
import { db } from '../services/mockBackend';
import { Reservation, ReservationStatus, AppSettings, FunnelStage, EventType } from '../types';
import { INITIAL_SETTINGS } from '../constants';
import { ChevronLeft, ChevronRight, Calendar, LayoutGrid, X, Clock, Users, PlusCircle, Pencil, Save, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

const Agenda: React.FC = () => {
  const [viewMode, setViewMode] = useState<'INTERNAL' | 'GOOGLE'>('INTERNAL');
  
  // Initialize with today's date (Local Time)
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [settings, setSettings] = useState<AppSettings>(INITIAL_SETTINGS);
  const [loading, setLoading] = useState(true);
  
  // Modal & Editing State
  const [editingRes, setEditingRes] = useState<Reservation | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Reservation>>({});

  const loadData = async () => {
    setLoading(true);
    try {
      const s = await db.settings.get();
      setSettings(s);
      const all = await db.reservations.getAll();
      setReservations(all.filter(r => r.date === selectedDate));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  // Reset Edit Mode when closing modal
  const closeResModal = () => {
    setEditingRes(null);
    setIsEditMode(false);
    setEditForm({});
  };

  const openResModal = (res: Reservation) => {
    setEditingRes(res);
    setIsEditMode(false);
    setEditForm({
        peopleCount: res.peopleCount,
        laneCount: res.laneCount,
        time: res.time,
        observations: res.observations,
        eventType: res.eventType
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
      e.preventDefault();
      if(editingRes && editForm) {
          const updated = { ...editingRes, ...editForm };
          await db.reservations.update(updated);
          
          setIsEditMode(false);
          setEditingRes(updated);
          loadData();
      }
  };

  const handleStatusChange = async (status: ReservationStatus) => {
    if (editingRes) {
      const updated = { ...editingRes, status };
      await db.reservations.update(updated);

      if (status === ReservationStatus.CONFIRMADA) {
          const isToday = editingRes.date === new Date().toISOString().split('T')[0];
          const allFunnel = await db.funnel.getAll();
          const cardIndex = allFunnel.findIndex(f => f.clientId === editingRes.clientId && f.stage !== FunnelStage.POS_EVENTO);
          
          if (cardIndex >= 0) {
             if (isToday) {
                 allFunnel[cardIndex].stage = FunnelStage.POS_EVENTO;
             } else {
                 allFunnel[cardIndex].stage = FunnelStage.AGENDADO;
             }
             await db.funnel.update(allFunnel);
          }

          const allClients = await db.clients.getAll();
          const client = allClients.find(c => c.id === editingRes.clientId);
          if (client) {
              client.lastContactAt = new Date().toISOString();
              await db.clients.update(client);
          }

          await db.interactions.add({
            id: uuidv4(),
            clientId: editingRes.clientId,
            date: new Date().toISOString(),
            channel: 'Outro',
            note: `Status alterado para CONFIRMADA via Agenda.`
          });
      }

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
    const isWeekend = day === 0 || day === 6;

    let start = isWeekend ? settings.weekendStart : settings.weekDayStart;
    let end = isWeekend ? settings.weekendEnd : settings.weekDayEnd;
    if (end === 0) end = 24;
    if (start >= end) { start = 18; end = 24; }

    const hours = [];
    for (let h = start; h < end; h++) {
      hours.push(`${h}:00`);
    }
    return hours;
  };

  const getStatusColor = (status: ReservationStatus) => {
    switch (status) {
      case ReservationStatus.CHECK_IN: return 'border-neon-green bg-green-500/20 text-green-300';
      case ReservationStatus.CONFIRMADA: return 'border-neon-blue bg-blue-500/10 text-blue-300';
      case ReservationStatus.PENDENTE: return 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400';
      case ReservationStatus.CANCELADA: return 'border-red-500/50 bg-red-900/10 text-red-400';
      case ReservationStatus.NO_SHOW: return 'border-slate-500/50 bg-slate-800 text-slate-400';
      default: return 'border-slate-700 bg-slate-800 text-slate-300';
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6 pb-20 md:pb-0">
      {/* Top Controls */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-white">Agenda</h1>
          <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700 ml-4">
            <button 
              onClick={() => setViewMode('INTERNAL')}
              className={`px-3 py-1.5 rounded flex items-center gap-2 text-sm font-medium transition ${viewMode === 'INTERNAL' ? 'bg-neon-blue text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              <LayoutGrid size={16} /> Lista
            </button>
            <button 
              onClick={() => setViewMode('GOOGLE')}
              className={`px-3 py-1.5 rounded flex items-center gap-2 text-sm font-medium transition ${viewMode === 'GOOGLE' ? 'bg-neon-orange text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
              <Calendar size={16} /> Google
            </button>
          </div>
        </div>
        
        {viewMode === 'INTERNAL' && (
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
        )}
      </div>

      <div className="flex-1 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-2xl flex flex-col min-h-[600px]">
        
        {loading && viewMode === 'INTERNAL' ? (
          <div className="flex-1 flex justify-center items-center">
            <Loader2 className="animate-spin text-neon-blue" size={48} />
          </div>
        ) : viewMode === 'INTERNAL' ? (
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
             {getDailyHours().map(hour => {
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
                         <Link 
                            to="/agendamento" 
                            className="text-slate-500 hover:text-neon-green transition transform hover:scale-110"
                            title="Adicionar reserva neste horário"
                         >
                            <PlusCircle size={20} />
                         </Link>
                         <div className="h-4 w-[1px] bg-slate-700 mx-2"></div>
                         <span className="text-sm text-slate-500">
                           {lanesOccupied} / {settings.activeLanes} Pistas ocupadas
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
                         <div className="flex justify-between items-center py-2 px-2 text-slate-600 italic text-sm">
                           <span>Nenhum agendamento.</span>
                           <Link to="/agendamento" className="text-neon-blue/50 hover:text-neon-blue text-xs font-bold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                             <PlusCircle size={12} /> Agendar
                           </Link>
                         </div>
                       ) : (
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                           {hourReservations.map(res => {
                             const isStart = parseInt(res.time.split(':')[0]) === currentHourInt;
                             return (
                               <div 
                                  key={res.id}
                                  onClick={() => openResModal(res)}
                                  className={`relative p-4 rounded-lg border cursor-pointer hover:bg-slate-800 transition ${getStatusColor(res.status)}`}
                               >
                                  <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold truncate pr-2">{res.clientName}</h4>
                                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-black/20">
                                      {res.status}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-4 text-xs opacity-80 mb-2">
                                     <span className="flex items-center gap-1"><Users size={12}/> {res.peopleCount}</span>
                                     <span className="flex items-center gap-1"><LayoutGrid size={12}/> {res.laneCount} Pista(s)</span>
                                  </div>
                                  <div className="flex justify-between items-end">
                                    <div className="text-xs font-mono bg-black/20 p-1 rounded inline-block">
                                      {res.eventType}
                                    </div>
                                    {!isStart && (
                                      <span className="text-[10px] text-white/50 italic">(Continuação)</span>
                                    )}
                                  </div>
                               </div>
                             );
                           })}
                         </div>
                       )}
                    </div>
                 </div>
               );
             })}
          </div>
        ) : (
          <div className="flex-1 w-full h-full bg-white relative">
             <iframe 
              src={`https://calendar.google.com/calendar/embed?src=${settings.calendarId}&ctz=America%2FSao_Paulo`}
              style={{border: 0}} 
              width="100%" 
              height="100%" 
              title="Google Calendar"
            ></iframe>
            {!settings.googleCalendarEnabled && (
                <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center">
                    <div className="text-center p-6">
                        <h3 className="text-xl font-bold text-white mb-2">Integração Desativada</h3>
                        <p className="text-slate-400">Ative o Google Calendar nas configurações.</p>
                        <Link to="/configuracoes" className="mt-4 inline-block px-4 py-2 bg-neon-blue rounded text-white font-bold">Ir para Configurações</Link>
                    </div>
                </div>
            )}
          </div>
        )}
      </div>

      {editingRes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-600 w-full max-w-lg rounded-2xl shadow-2xl animate-scale-in">
            <div className="p-6 border-b border-slate-700 flex justify-between items-center">
              <div className="flex items-center gap-3">
                 <h3 className="text-xl font-bold text-white">Detalhes da Reserva</h3>
                 {!isEditMode && (
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
                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                        <p className="text-slate-400">Cliente</p>
                        <p className="text-white font-medium text-lg">{editingRes.clientName}</p>
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
                        <p className="text-slate-400">Pistas</p>
                        <p className="text-white font-medium">
                            {editingRes.laneCount} Pista(s) / {editingRes.peopleCount} Pessoas
                        </p>
                        </div>
                        <div className="col-span-2">
                        <p className="text-slate-400">Observações</p>
                        <p className="text-slate-300 italic bg-slate-900 p-2 rounded">{editingRes.observations || 'Nenhuma.'}</p>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-slate-700">
                        <p className="text-slate-400 mb-3 text-sm font-bold uppercase">Alterar Status</p>
                        <div className="flex flex-wrap gap-2">
                        <button 
                            onClick={() => handleStatusChange(ReservationStatus.CHECK_IN)}
                            className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium flex-1"
                        >
                            Check-in
                        </button>
                        <button 
                            onClick={() => handleStatusChange(ReservationStatus.CONFIRMADA)}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium flex-1"
                        >
                            Confirmar
                        </button>
                        <button 
                            onClick={() => handleStatusChange(ReservationStatus.NO_SHOW)}
                            className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm font-medium flex-1"
                        >
                            No-Show
                        </button>
                        <button 
                            onClick={() => handleStatusChange(ReservationStatus.CANCELADA)}
                            className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium flex-1"
                        >
                            Cancelar
                        </button>
                        </div>
                    </div>
                </div>
            ) : (
                // --- EDIT MODE ---
                <form onSubmit={handleSaveEdit} className="p-6 space-y-4 animate-fade-in">
                    <div className="grid grid-cols-2 gap-4">
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
                          <label className="block text-xs text-slate-400 mb-1">Tipo</label>
                          <select
                             className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 text-white"
                             value={editForm.eventType}
                             onChange={e => setEditForm({...editForm, eventType: e.target.value as EventType})}
                          >
                             {Object.values(EventType).map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
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
                       <button type="submit" className="flex-1 py-3 bg-neon-blue hover:bg-blue-500 text-white rounded-lg font-bold flex justify-center items-center gap-2">
                          <Save size={18} /> Salvar
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
