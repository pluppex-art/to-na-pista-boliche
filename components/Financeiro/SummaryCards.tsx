
import React from 'react';
import { DollarSign, AlertCircle, TrendingUp, Clock, Ban, ArrowUpRight, ArrowDownRight, HandCoins, Target } from 'lucide-react';

interface SummaryCardsProps {
  totalRevenue: number;
  pendingRevenue: number;
  avgTicket: number;
  avgDaily: number;
  totalHours: number;
  cancellationRate: number;
  previousYearRev: number;
  revenueDiff: number;
  revenueProjection: number;
  pluppexCommission: number;
  maxCapacityHours: number;
  onDrillDown: (type: 'PENDING' | 'CANCELLED') => void;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ 
  totalRevenue, 
  pendingRevenue, 
  avgTicket,
  avgDaily,
  totalHours,
  cancellationRate,
  previousYearRev,
  revenueDiff,
  revenueProjection,
  pluppexCommission,
  maxCapacityHours,
  onDrillDown 
}) => {
  const isRevenueUp = revenueDiff >= 0;
  const growthPercent = previousYearRev > 0 ? (revenueDiff / previousYearRev) * 100 : 100;
  
  const goalHours = maxCapacityHours * 0.7;
  const capacityPercent = maxCapacityHours > 0 ? (totalHours / maxCapacityHours) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* PRIMEIRA LINHA: FINANCEIRO */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Faturamento Realizado + Projeção */}
        <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden group hover:border-neon-green/30 transition-all duration-500">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <DollarSign size={64} className="text-neon-green" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-neon-green/10 rounded-xl flex items-center justify-center border border-neon-green/20">
                <DollarSign size={20} className="text-neon-green" />
              </div>
              <div className="flex flex-col">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Faturamento</h3>
                <span className="text-[8px] font-bold text-neon-green uppercase tracking-widest">Realizado</span>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-3xl font-black text-white tracking-tighter">
                    {totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </h3>
                  <div className={`px-3 py-1 rounded-full border flex items-center gap-1 shrink-0 ${isRevenueUp ? 'bg-neon-green/10 border-neon-green/20 text-neon-green' : 'bg-red-500/10 border-red-500/20 text-red-500'}`}>
                      {isRevenueUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                      <span className="text-[10px] font-black">{Math.abs(growthPercent).toFixed(1)}%</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1 mt-2">
                    <div className="flex items-center gap-2">
                        <span className="text-[8px] text-slate-500 font-bold uppercase">Ano Anterior:</span>
                        <span className="text-[10px] text-white font-black">{previousYearRev.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[8px] text-slate-500 font-bold uppercase">Diferença:</span>
                        <span className={`text-[10px] font-black ${isRevenueUp ? 'text-neon-green' : 'text-red-500'}`}>
                            {isRevenueUp ? '+' : ''}{revenueDiff.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                    </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800/50">
                <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest mb-1">Projeção Final</p>
                <div className="flex items-center justify-between">
                    <h4 className="text-xl font-black text-white tracking-tighter">
                        {revenueProjection.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </h4>
                    <span className="text-[10px] font-black text-neon-green bg-neon-green/10 px-2 py-0.5 rounded-md">+{(growthPercent * 1.1).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* A Receber / Pendente */}
        <div onClick={() => onDrillDown('PENDING')} className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden group hover:border-yellow-500/30 transition-all duration-500 cursor-pointer">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <AlertCircle size={64} className="text-yellow-500" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-yellow-500/10 rounded-xl flex items-center justify-center border border-yellow-500/20">
                <AlertCircle size={20} className="text-yellow-500" />
              </div>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">A Receber / Pendente</h3>
            </div>
            <h3 className="text-3xl font-black text-white tracking-tighter">
              {pendingRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </h3>
            <p className="text-[8px] text-slate-500 font-bold mt-1 uppercase underline group-hover:text-yellow-400 transition-colors">Clique para ver lista</p>
          </div>
        </div>

        {/* Ticket Médio (H) */}
        <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden group hover:border-neon-blue/30 transition-all duration-500">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <TrendingUp size={64} className="text-neon-blue" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-neon-blue/10 rounded-xl flex items-center justify-center border border-neon-blue/20">
                <TrendingUp size={20} className="text-neon-blue" />
              </div>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Ticket Médio (H)</h3>
            </div>
            <h3 className="text-3xl font-black text-white tracking-tighter">
              {avgTicket.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </h3>
            <p className="text-[8px] text-slate-500 font-bold mt-1 uppercase">Média por hora vendida</p>
          </div>
        </div>
      </div>

      {/* SEGUNDA LINHA: OPERACIONAL */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Média Diária */}
        <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden group hover:border-neon-blue/30 transition-all duration-500">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Clock size={64} className="text-neon-blue" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-neon-blue/10 rounded-xl flex items-center justify-center border border-neon-blue/20">
                <Clock size={20} className="text-neon-blue" />
              </div>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Média Diária</h3>
            </div>
            <div className="flex items-baseline gap-1">
              <h3 className="text-3xl font-black text-white tracking-tighter">{avgDaily.toFixed(1)}</h3>
              <span className="text-[10px] text-slate-500 font-bold uppercase">Horas</span>
            </div>
            <p className="text-[8px] text-slate-500 font-bold mt-1 uppercase">Desempenho por dia no período</p>
          </div>
        </div>

        {/* Comissão Pluppex */}
        <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden group hover:border-neon-blue/30 transition-all duration-500">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <HandCoins size={64} className="text-neon-blue" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-neon-blue/10 rounded-xl flex items-center justify-center border border-neon-blue/20">
                <HandCoins size={20} className="text-neon-blue" />
              </div>
              <div className="flex flex-col">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Comissão</h3>
                <span className="text-[8px] font-bold text-neon-blue uppercase tracking-widest">Pluppex</span>
              </div>
            </div>
            <h3 className="text-3xl font-black text-white tracking-tighter">
              {pluppexCommission.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </h3>
            <p className="text-[8px] text-slate-500 font-bold mt-1 uppercase">10% sobre o crescimento real vs ano anterior</p>
            
            <div className="mt-6 pt-4 border-t border-slate-800/50">
                <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                        <Target size={12} className="text-neon-blue" />
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Meta Produtiva (+70%)</span>
                    </div>
                    <span className="text-[10px] font-black text-neon-blue">{capacityPercent.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                        className={`h-full transition-all duration-1000 ${capacityPercent >= 70 ? 'bg-neon-green shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 'bg-neon-blue'}`}
                        style={{ width: `${Math.min(100, capacityPercent)}%` }}
                    />
                </div>
                <div className="flex justify-between mt-2">
                    <span className="text-[8px] font-bold text-slate-600 uppercase tracking-tighter">Vendido: {totalHours}H</span>
                    <span className="text-[8px] font-bold text-slate-600 uppercase tracking-tighter">Meta: {Math.round(goalHours)}H</span>
                </div>
            </div>
          </div>
        </div>

        {/* Estornos / Cancelados */}
        <div onClick={() => onDrillDown('CANCELLED')} className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden group hover:border-red-500/30 transition-all duration-500 cursor-pointer">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Ban size={64} className="text-red-500" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center border border-red-500/20">
                <Ban size={20} className="text-red-500" />
              </div>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Estornos / Cancelados</h3>
            </div>
            <h3 className="text-3xl font-black text-red-500 tracking-tighter">{cancellationRate.toFixed(1)}%</h3>
            <p className="text-[8px] text-slate-500 font-bold mt-1 uppercase underline group-hover:text-red-400 transition-colors">Taxa sobre total de pedidos</p>
          </div>
        </div>
      </div>
    </div>
  );
};
