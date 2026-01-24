
import React from 'react';
import { Clock } from 'lucide-react';

interface OperationalSummaryProps {
  avgDaily: number;
  totalHours: number;
  cancellationRate: number;
}

export const OperationalSummary: React.FC<OperationalSummaryProps> = ({ avgDaily, totalHours, cancellationRate }) => {
  return (
    <div className="bg-slate-800/40 border border-slate-700 p-6 md:p-10 rounded-[2.5rem] shadow-2xl space-y-8">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-orange-500/10 rounded-lg text-orange-500">
          <Clock size={24} />
        </div>
        <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter">Resumo Operacional</h2>
      </div>

      <div className="space-y-4">
        {/* MÉDIA DIÁRIA */}
        <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl group hover:border-slate-700 transition-colors">
          <p className="text-[10px] md:text-xs text-slate-500 font-black uppercase tracking-[0.15em] mb-2">Média Diária</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl md:text-4xl font-black text-white">{avgDaily.toFixed(1)}</h3>
            <span className="text-[10px] md:text-xs text-slate-500 font-bold uppercase tracking-widest">Horas</span>
          </div>
        </div>

        {/* TOTAL DE HORAS VENDIDAS */}
        <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl group hover:border-slate-700 transition-colors">
          <p className="text-[10px] md:text-xs text-slate-500 font-black uppercase tracking-[0.15em] mb-2">Total de Horas Vendidas</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl md:text-4xl font-black text-white">{totalHours}</h3>
            <span className="text-[10px] md:text-xs text-slate-500 font-bold uppercase tracking-widest">Horas</span>
          </div>
        </div>

        {/* ESTORNOS / CANCELADOS */}
        <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl group hover:border-slate-700 transition-colors">
          <p className="text-[10px] md:text-xs text-slate-500 font-black uppercase tracking-[0.15em] mb-2">Estornos / Cancelados</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl md:text-4xl font-black text-red-500">{cancellationRate.toFixed(1)}%</h3>
          </div>
        </div>
      </div>
    </div>
  );
};
