
import React from 'react';
import { DollarSign, AlertCircle, TrendingUp, Clock, Calendar, Ban, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface SummaryCardsProps {
  totalRevenue: number;
  pendingRevenue: number;
  avgTicket: number;
  avgDaily: number;
  totalHours: number;
  cancellationRate: number;
  projectedRevenue: number;
  historical2025: number;
  percentTo2025: number;
  diffTo2025: number;
  onDrillDown: (type: 'PENDING' | 'CANCELLED') => void;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ 
  totalRevenue, 
  pendingRevenue, 
  avgTicket,
  avgDaily,
  totalHours,
  cancellationRate,
  projectedRevenue,
  historical2025,
  percentTo2025,
  diffTo2025,
  onDrillDown 
}) => {
  const isExceeding = diffTo2025 >= 0;

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
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Faturamento Realizado</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-3xl font-black text-white tracking-tighter">
                  {totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </h3>
                <p className="text-[8px] text-slate-500 font-bold uppercase tracking-tighter">Reservas Confirmadas e Pagas</p>
              </div>

              {projectedRevenue > 0 && (
                <div className="pt-4 border-t border-slate-800/50">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest mb-1">Projeção Final do Mês</p>
                      <h4 className="text-xl font-black text-neon-blue tracking-tighter">
                        {projectedRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </h4>
                    </div>
                    
                    <div className={`flex flex-col items-end ${isExceeding ? 'text-green-400' : 'text-orange-500'}`}>
                      <div className="flex items-center gap-1">
                        {isExceeding ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                        <span className="text-sm font-black tracking-tighter">
                          {Math.abs(percentTo2025).toFixed(1)}%
                        </span>
                      </div>
                      <p className="text-[8px] font-bold uppercase tracking-tighter">vs Recorde 2025</p>
                    </div>
                  </div>
                  
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-1000 ${isExceeding ? 'bg-green-500' : 'bg-orange-500'}`}
                        style={{ width: `${Math.min(100, (projectedRevenue / (historical2025 || projectedRevenue)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[8px] font-black text-slate-600 uppercase">
                      Meta: {historical2025.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                </div>
              )}
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

        {/* Total de Horas Vendidas */}
        <div className="bg-slate-900/60 p-6 rounded-3xl border border-slate-800 shadow-xl relative overflow-hidden group hover:border-neon-orange/30 transition-all duration-500">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Calendar size={64} className="text-neon-orange" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 bg-neon-orange/10 rounded-xl flex items-center justify-center border border-neon-orange/20">
                <Calendar size={20} className="text-neon-orange" />
              </div>
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Total de Horas Vendidas</h3>
            </div>
            <div className="flex items-baseline gap-1">
              <h3 className="text-3xl font-black text-white tracking-tighter">{totalHours}</h3>
              <span className="text-[10px] text-slate-500 font-bold uppercase">Horas</span>
            </div>
            <p className="text-[8px] text-slate-500 font-bold mt-1 uppercase">Volume total confirmado</p>
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
