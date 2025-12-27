
import React from 'react';
import { Reservation, ReservationStatus } from '../../types';
import { Users, Clock, Hash, Utensils, Cake, Check, Ban, Tag, User, AtSign, Store } from 'lucide-react';

interface ReservationCardProps {
  res: Reservation;
  uniqueId: string;
  isCI: boolean;
  isNS: boolean;
  laneIdx: number;
  canEdit: boolean;
  onOpen: () => void;
  onGranularStatus: (e: React.MouseEvent, type: 'CHECK_IN' | 'NS') => void;
}

export const ReservationCard: React.FC<ReservationCardProps> = ({ 
  res, uniqueId, isCI, isNS, laneIdx, canEdit, onOpen, onGranularStatus 
}) => {
  const getStatusConfig = () => {
    if (isCI) return { color: 'green', border: 'border-l-green-600', badge: 'bg-green-600 text-white' };
    if (isNS) return { color: 'slate', border: 'border-l-slate-600', badge: 'bg-slate-700 text-slate-400' };
    if (res.status === ReservationStatus.CONFIRMADA) return { color: 'blue', border: 'border-l-blue-600', badge: 'bg-blue-600 text-white' };
    if (res.status === ReservationStatus.PENDENTE) return { color: 'orange', border: 'border-l-orange-600', badge: 'bg-orange-600 text-white' };
    return { color: 'slate', border: 'border-l-slate-700', badge: 'bg-slate-800 text-slate-400' };
  };

  const statusConfig = getStatusConfig();
  const statusLabel = isCI ? 'CHECK-IN' : isNS ? 'NO-SHOW' : res.status.toUpperCase();

  const isFromStaff = !!res.createdBy;
  const OriginIcon = isFromStaff ? User : AtSign;

  return (
    <div 
      onClick={onOpen} 
      className={`relative bg-[#1e293b]/40 rounded-[1.2rem] border border-slate-700/50 ${statusConfig.border} border-l-4 p-4 cursor-pointer hover:bg-[#1e293b]/60 transition-all shadow-xl group flex flex-col gap-2.5 overflow-hidden h-full min-h-[180px]`}
    >
      <div className="flex justify-between items-start">
        <div className="flex flex-wrap gap-1.5 items-center">
            <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider shadow-sm transition-colors ${statusConfig.badge}`}>
                {statusLabel}
            </span>
            <div className="p-1 bg-slate-800/50 rounded-md border border-slate-700 text-slate-500" title={isFromStaff ? "Reservado pela Equipe" : "Reservado pelo Site"}>
                <OriginIcon size={12} />
            </div>
            {res.payOnSite && (
              <div className="flex items-center gap-1 bg-purple-600/20 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-tighter">
                <Store size={10}/> Local
              </div>
            )}
        </div>

        <div className="flex gap-1.5">
          <button 
            disabled={!canEdit} 
            onClick={(e) => onGranularStatus(e, 'CHECK_IN')} 
            className={`w-7 h-7 flex items-center justify-center rounded-full border transition-all ${
                isCI ? 'bg-green-600 border-green-500 text-white shadow-[0_0_10px_rgba(34,197,94,0.3)]' : 'bg-slate-800/50 border-slate-700 text-slate-500 hover:text-green-400'
            }`}
          >
            <Check size={14} strokeWidth={3} />
          </button>
          <button 
            disabled={!canEdit} 
            onClick={(e) => onGranularStatus(e, 'NS')} 
            className={`w-7 h-7 flex items-center justify-center rounded-full border transition-all ${
                isNS ? 'bg-slate-600 border-slate-500 text-white' : 'bg-slate-800/50 border-slate-700 text-slate-500 hover:text-red-400'
            }`}
          >
            <Ban size={14} strokeWidth={3} />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <h3 className={`text-base font-black text-white uppercase tracking-tight leading-tight break-words overflow-hidden ${isNS ? 'line-through opacity-40 italic' : ''}`}>
          {res.clientName}
        </h3>
        {res.birthdayName && (
           <div className="flex items-center gap-1.5 text-pink-400">
              <Cake size={12} />
              <span className="text-[10px] font-black uppercase tracking-tighter truncate">Aniv: {res.birthdayName}</span>
           </div>
        )}
      </div>

      <div className="h-px bg-slate-700/20 w-full"></div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        <div className="flex items-center gap-1.5 text-slate-400">
            <Users size={12} className="text-slate-500 shrink-0" />
            <span className="text-[9px] font-bold uppercase tracking-widest leading-none">{res.peopleCount || 0} Jogadores</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-400">
            <Clock size={12} className="text-slate-500 shrink-0" />
            <span className="text-[9px] font-bold uppercase tracking-widest leading-none">{res.duration || 0} Horas</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-400">
            <Tag size={12} className="text-slate-500 shrink-0" />
            <span className="text-[9px] font-bold uppercase tracking-widest truncate leading-none">{res.eventType}</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-400 h-3">
            {isCI && (
              <>
                <Hash size={12} className="text-slate-500 shrink-0" />
                <span className="text-[9px] font-bold uppercase tracking-widest leading-none">
                    {res.lanesAssigned?.[laneIdx] ? `Pista: ${res.lanesAssigned[laneIdx]}` : `${res.laneCount || 0} Pista(s)`}
                </span>
              </>
            )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 pt-1">
          {res.comandaId && (
              <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 px-2 py-1 rounded-lg">
                  <Hash size={10} className="text-blue-400" />
                  <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest">COMANDA: {res.comandaId}</span>
              </div>
          )}
          {res.hasTableReservation && (
              <div className="flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/20 px-2 py-1 rounded-lg">
                  <Utensils size={10} className="text-orange-500" />
                  <span className="text-[8px] font-black text-orange-500 uppercase">Mesa: {res.tableSeatCount}L</span>
              </div>
          )}
      </div>
    </div>
  );
};
