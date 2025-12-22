
import React from 'react';
import { CheckCircle2, AlertCircle, Users, Ban } from 'lucide-react';

interface MetricCardsProps {
  metrics: {
    confirmedSlots: number;
    pendingSlots: number;
    checkInSlots: number;
    noShowSlots: number;
  };
  loading: boolean;
}

export const MetricCards: React.FC<MetricCardsProps> = ({ metrics, loading }) => {
  return (
    <div className="flex flex-col sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
      {/* Confirmada - AZUL */}
      <div className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border flex items-center justify-between shadow-lg bg-slate-800/50 border-blue-500/20">
        <div className="flex items-center gap-3">
          <div className="p-1.5 sm:p-2 bg-blue-500/10 rounded-lg text-blue-500"><CheckCircle2 size={18} /></div>
          <span className="text-[9px] sm:text-[10px] uppercase font-black text-slate-400 tracking-widest">Confirmadas</span>
        </div>
        <span className="text-xl sm:text-2xl font-black text-blue-400">{loading ? '-' : metrics.confirmedSlots}</span>
      </div>

      {/* Pendente - LARANJA */}
      <div className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border flex items-center justify-between shadow-lg bg-slate-800/50 border-orange-500/20">
        <div className="flex items-center gap-3">
          <div className="p-1.5 sm:p-2 bg-orange-500/10 rounded-lg text-orange-500"><AlertCircle size={18} /></div>
          <span className="text-[9px] sm:text-[10px] uppercase font-black text-slate-400 tracking-widest">Pendentes</span>
        </div>
        <span className="text-xl sm:text-2xl font-black text-orange-400">{loading ? '-' : metrics.pendingSlots}</span>
      </div>

      {/* Check-in - VERDE */}
      <div className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border flex items-center justify-between shadow-lg bg-green-900/10 border-green-500/20">
        <div className="flex items-center gap-3">
          <div className="p-1.5 sm:p-2 bg-green-500/10 rounded-lg text-green-500"><Users size={18} /></div>
          <span className="text-[9px] sm:text-[10px] uppercase font-black text-slate-400 tracking-widest">CHECK IN</span>
        </div>
        <span className="text-xl sm:text-2xl font-black text-green-500">{loading ? '-' : metrics.checkInSlots}</span>
      </div>

      {/* No-Show - CINZA */}
      <div className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl border flex items-center justify-between shadow-lg bg-slate-900/50 border-slate-700">
        <div className="flex items-center gap-3">
          <div className="p-1.5 sm:p-2 bg-slate-700/20 rounded-lg text-slate-500"><Ban size={18} /></div>
          <span className="text-[9px] sm:text-[10px] uppercase font-black text-slate-400 tracking-widest">No-Show</span>
        </div>
        <span className="text-xl sm:text-2xl font-black text-slate-500">{loading ? '-' : metrics.noShowSlots}</span>
      </div>
    </div>
  );
};
