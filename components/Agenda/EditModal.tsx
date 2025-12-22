
import React, { useState, useEffect } from 'react';
import { Reservation, EventType, ReservationStatus, UserRole } from '../../types';
import { EVENT_TYPES } from '../../constants';
import { db } from '../../services/mockBackend';
import { useApp } from '../../contexts/AppContext';
import { checkHourCapacity } from '../../utils/availability';
import { 
  X, 
  Save, 
  Info, 
  Pencil, 
  Utensils, 
  Calendar, 
  Clock, 
  Hash, 
  Users, 
  Tag, 
  DollarSign,
  Loader2,
  Armchair
} from 'lucide-react';

interface EditModalProps {
  res: Reservation;
  onClose: () => void;
  onSave: (formData: Partial<Reservation>) => void;
}

export const EditModal: React.FC<EditModalProps> = ({ res, onClose, onSave }) => {
  const { settings, user: currentUser } = useApp();
  const [form, setForm] = useState<Partial<Reservation>>({ ...res });
  const [isValidating, setIsValidating] = useState(false);

  // Regras Dinâmicas
  const maxLanes = settings?.activeLanes || 6;
  const maxPeople = (form.laneCount || 1) * 6;
  const maxHours = (form.laneCount || 1) * 6;
  const isAdmin = currentUser?.role === UserRole.ADMIN;

  // Ajusta valores se as pistas diminuírem
  useEffect(() => {
    if (form.peopleCount && form.peopleCount > maxPeople) {
      setForm(prev => ({ ...prev, peopleCount: maxPeople }));
    }
    if (form.duration && form.duration > maxHours) {
      setForm(prev => ({ ...prev, duration: maxHours }));
    }
  }, [form.laneCount]);

  const handleLocalSave = async () => {
    if (isValidating) return;
    setIsValidating(true);

    try {
      // 1. Validação de Pistas Ativas
      if ((form.laneCount || 0) > maxLanes) {
        alert(`O boliche possui apenas ${maxLanes} pistas no total.`);
        setIsValidating(false);
        return;
      }

      // 2. Validação de Pessoas (Limite 6 por pista)
      if ((form.peopleCount || 0) > maxPeople) {
        alert(`Capacidade excedida! Para ${form.laneCount} pista(s), o máximo é ${maxPeople} pessoas.`);
        setIsValidating(false);
        return;
      }

      // 3. Validação de Horas (Limite pistas * 6)
      if ((form.duration || 0) > maxHours) {
        alert(`Limite de tempo excedido! Para ${form.laneCount} pista(s), o máximo é ${maxHours} horas.`);
        setIsValidating(false);
        return;
      }

      // 4. Validação de Disponibilidade Real (Conflitos)
      const allRes = await db.reservations.getAll();
      const startH = parseInt((form.time || res.time).split(':')[0]);
      const duration = Math.ceil(form.duration || res.duration);
      const date = form.date || res.date;
      const lanesNeeded = form.laneCount || res.laneCount;

      for (let i = 0; i < duration; i++) {
        const checkHour = startH + i;
        const { left } = checkHourCapacity(checkHour, date, allRes, maxLanes, res.id);
        
        if (left < lanesNeeded) {
          alert(`Indisponível! Existem apenas ${left} pistas livres no horário das ${checkHour}:00.`);
          setIsValidating(false);
          return;
        }
      }

      onSave(form);
    } catch (error) {
      console.error(error);
      alert("Erro ao validar disponibilidade.");
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-2 md:p-4 overflow-y-auto">
      <div className="bg-[#0f172a] border border-slate-800 w-full max-w-4xl rounded-[2.5rem] shadow-2xl animate-scale-in flex flex-col my-auto overflow-hidden">
        
        {/* HEADER */}
        <div className="p-6 md:p-10 flex justify-between items-start">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl border border-blue-500/30 bg-blue-500/10 flex items-center justify-center text-blue-400 shadow-inner">
              <Info size={28} />
            </div>
            <div>
              <h2 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">{res.clientName}</h2>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Reserva #{res.id.slice(0,8)}</span>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase ${
                  res.status === ReservationStatus.CHECK_IN ? 'bg-blue-600 text-white' : 
                  res.status === ReservationStatus.CONFIRMADA ? 'bg-green-600 text-white' : 'bg-yellow-500 text-black'
                }`}>
                  {res.status}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-600/20">
              <Pencil size={24} />
            </div>
            <button onClick={onClose} className="p-3 bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-700 transition-all">
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="h-px bg-slate-800/50 mx-10"></div>

        {/* FORMULÁRIO */}
        <div className="p-6 md:p-10 space-y-8 overflow-y-auto custom-scrollbar">
          
          {/* Linha 1: Data, Hora, Horas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Data</label>
              <input 
                type="date" 
                className="w-full bg-[#1e293b]/40 border border-slate-700/50 rounded-2xl p-5 text-white font-bold outline-none focus:border-blue-500 transition-all"
                value={form.date}
                onChange={e => setForm({...form, date: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Hora</label>
              <input 
                type="time" 
                className="w-full bg-[#1e293b]/40 border border-slate-700/50 rounded-2xl p-5 text-white font-bold outline-none focus:border-blue-500 transition-all"
                value={form.time}
                onChange={e => setForm({...form, time: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Horas (Máx: {maxHours})</label>
              <input 
                type="number" 
                step="0.5"
                max={maxHours}
                className="w-full bg-[#1e293b]/40 border border-slate-700/50 rounded-2xl p-5 text-white font-bold outline-none focus:border-blue-500 transition-all"
                value={form.duration}
                onChange={e => setForm({...form, duration: parseFloat(e.target.value)})}
              />
            </div>
          </div>

          {/* Linha 2: Pistas, Pessoas, Evento */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Pistas (Máx: {maxLanes})</label>
              <input 
                type="number" 
                min="1"
                max={maxLanes}
                className="w-full bg-[#1e293b]/40 border border-slate-700/50 rounded-2xl p-5 text-white font-bold outline-none focus:border-blue-500 transition-all"
                value={form.laneCount}
                onChange={e => {
                    const val = parseInt(e.target.value);
                    if (val <= maxLanes) setForm({...form, laneCount: val});
                }}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Pessoas (Máx: {maxPeople})</label>
              <input 
                type="number" 
                min="1"
                max={maxPeople}
                className="w-full bg-[#1e293b]/40 border border-slate-700/50 rounded-2xl p-5 text-white font-bold outline-none focus:border-blue-500 transition-all"
                value={form.peopleCount}
                onChange={e => setForm({...form, peopleCount: parseInt(e.target.value)})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Evento</label>
              <select 
                className="w-full bg-[#1e293b]/40 border border-slate-700/50 rounded-2xl p-5 text-white font-bold outline-none focus:border-blue-500 transition-all appearance-none"
                value={form.eventType}
                onChange={e => setForm({...form, eventType: e.target.value as EventType})}
              >
                {EVENT_TYPES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
              </select>
            </div>
          </div>

          <div className="h-px bg-slate-800/30"></div>

          {/* Linha 3: Valor Total (Admin) e Nome Aniversariante */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-orange-500 uppercase tracking-widest ml-1">Valor Total (Admin)</label>
              <div className="relative">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-green-500 font-bold">R$</span>
                <input 
                  type="number" 
                  disabled={!isAdmin}
                  className={`w-full bg-[#1e293b]/40 border border-slate-700/50 rounded-2xl p-5 pl-12 text-green-400 text-xl font-black outline-none focus:border-blue-500 transition-all ${!isAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                  value={form.totalValue}
                  onChange={e => setForm({...form, totalValue: parseFloat(e.target.value)})}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome do Aniversariante</label>
              <input 
                type="text"
                placeholder="Se aplicável"
                className="w-full bg-[#1e293b]/40 border border-slate-700/50 rounded-2xl p-5 text-white font-bold outline-none focus:border-blue-500 transition-all"
                value={form.birthdayName}
                onChange={e => setForm({...form, birthdayName: e.target.value})}
              />
            </div>
          </div>

          {/* Linha 4: Reserva de Mesa Switch */}
          <div className="space-y-4">
            <div className="bg-[#1e293b]/20 border border-slate-700/50 rounded-3xl p-6 flex items-center justify-between group hover:border-slate-600 transition-all">
                <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-500/10 text-orange-500 rounded-xl">
                    <Utensils size={24} />
                </div>
                <div>
                    <h4 className="text-sm font-black text-white uppercase tracking-tight leading-none">Reserva de Mesa</h4>
                    <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">Solicitar lugares no restaurante</p>
                </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={form.hasTableReservation}
                    onChange={e => setForm({...form, hasTableReservation: e.target.checked})}
                />
                <div className="w-14 h-8 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
            </div>

            {/* Input de Quantidade (Aparece ao marcar) */}
            {form.hasTableReservation && (
                <div className="grid grid-cols-1 animate-scale-in">
                    <div className="space-y-2">
                        <label className="text-[11px] font-black text-orange-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                            <Armchair size={14}/> Quantidade de Lugares
                        </label>
                        <input 
                            type="number"
                            min="1"
                            className="w-full bg-[#1e293b]/60 border border-orange-500/30 rounded-2xl p-5 text-white font-black outline-none focus:border-orange-500 transition-all"
                            value={form.tableSeatCount}
                            onChange={e => setForm({...form, tableSeatCount: parseInt(e.target.value)})}
                            placeholder="Ex: 10"
                        />
                    </div>
                </div>
            )}
          </div>

          {/* Observações Extras */}
          <div className="space-y-2">
             <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">Observações Internas</label>
             <textarea 
                className="w-full bg-[#1e293b]/40 border border-slate-700/50 rounded-2xl p-5 text-white text-sm outline-none focus:border-blue-500 transition-all h-24"
                value={form.observations}
                onChange={e => setForm({...form, observations: e.target.value})}
                placeholder="Notas técnicas sobre esta reserva..."
             />
          </div>

          {/* BOTÃO SALVAR */}
          <button 
            onClick={handleLocalSave} 
            disabled={isValidating}
            className="w-full py-6 bg-blue-600 hover:bg-blue-500 text-white rounded-3xl font-black uppercase text-sm tracking-[0.2em] shadow-xl shadow-blue-900/20 flex items-center justify-center gap-3 transition-all active:scale-[0.98] mt-4"
          >
            {isValidating ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20} /> SALVAR DADOS</>}
          </button>

        </div>
      </div>
    </div>
  );
};
