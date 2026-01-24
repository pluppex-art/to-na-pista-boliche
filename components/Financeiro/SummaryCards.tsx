
import React from 'react';
import { DollarSign, AlertCircle, TrendingUp, Clock, Calendar, Ban } from 'lucide-react';

interface SummaryCardsProps {
  totalRevenue: number;
  pendingRevenue: number;
  avgTicket: number;
  avgDaily: number;
  totalHours: number;
  cancellationRate: number;
  onDrillDown: (type: 'PENDING' | 'CANCELLED') => void;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ 
  totalRevenue, 
  pendingRevenue, 
  avgTicket,
  avgDaily,
  totalHours,
  cancellationRate,
  onDrillDown 
}) => {
  return (
    <div className="space-y-6">
      {/* PRIMEIRA LINHA: FINANCEIRO */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-slate-800 p-5 rounded-2xl border border-green-500/30 shadow-lg hover:border-green-500 transition-all group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] text-green-500 font-black uppercase mb-1 tracking-widest">Faturamento Realizado</p>
              <h3 className="text-2xl font-black text-white">{totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3>
              <p className="text-[8px] text-slate-500 font-bold mt-1 uppercase tracking-tighter">Reservas Confirmadas e Pagas</p>
            </div>
            <div className="p-2 bg-green-500/10 rounded-lg text-green-500 group-hover:scale-110 transition-transform"><DollarSign size={24}/></div>
          </div>
        </div>

        <div onClick={() => onDrillDown('PENDING')} className="bg-slate-800 p-5 rounded-2xl border border-yellow-500/30 shadow-lg hover:border-yellow-500 transition-all cursor-pointer group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] text-yellow-500 font-black uppercase mb-1 tracking-widest">A Receber / Pendente</p>
              <h3 className="text-2xl font-black text-white">{pendingRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3>
              <p className="text-[8px] text-slate-500 font-bold mt-1 uppercase underline group-hover:text-yellow-400 transition-colors">Clique para ver lista</p>
            </div>
            <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-500 group-hover:scale-110 transition-transform"><AlertCircle size={24}/></div>
          </div>
        </div>

        <div className="bg-slate-800 p-5 rounded-2xl border border-neon-blue/30 shadow-lg hover:border-neon-blue transition-all group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] text-neon-blue font-black uppercase mb-1 tracking-widest">Ticket Médio (H)</p>
              <h3 className="text-2xl font-black text-white">{avgTicket.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3>
              <p className="text-[8px] text-slate-500 font-bold mt-1 uppercase">Média por hora vendida</p>
            </div>
            <div className="p-2 bg-neon-blue/10 rounded-lg text-neon-blue group-hover:scale-110 transition-transform"><TrendingUp size={24}/></div>
          </div>
        </div>
      </div>

      {/* SEGUNDA LINHA: OPERACIONAL */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700 shadow-lg hover:border-neon-blue transition-all group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] text-slate-400 font-black uppercase mb-1 tracking-widest">Média Diária</p>
              <div className="flex items-baseline gap-1">
                <h3 className="text-2xl font-black text-white">{avgDaily.toFixed(1)}</h3>
                <span className="text-[10px] text-slate-500 font-bold uppercase">Horas</span>
              </div>
              <p className="text-[8px] text-slate-500 font-bold mt-1 uppercase">Desempenho por dia no período</p>
            </div>
            <div className="p-2 bg-slate-700/30 rounded-lg text-neon-blue group-hover:scale-110 transition-transform"><Clock size={24}/></div>
          </div>
        </div>

        <div className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700 shadow-lg hover:border-neon-orange transition-all group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] text-slate-400 font-black uppercase mb-1 tracking-widest">Total de Horas Vendidas</p>
              <div className="flex items-baseline gap-1">
                <h3 className="text-2xl font-black text-white">{totalHours}</h3>
                <span className="text-[10px] text-slate-500 font-bold uppercase">Horas</span>
              </div>
              <p className="text-[8px] text-slate-500 font-bold mt-1 uppercase">Volume total confirmado</p>
            </div>
            <div className="p-2 bg-slate-700/30 rounded-lg text-neon-orange group-hover:scale-110 transition-transform"><Calendar size={24}/></div>
          </div>
        </div>

        <div onClick={() => onDrillDown('CANCELLED')} className="bg-slate-800/60 p-5 rounded-2xl border border-slate-700 shadow-lg hover:border-red-500 transition-all cursor-pointer group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] text-red-500 font-black uppercase mb-1 tracking-widest">Estornos / Cancelados</p>
              <h3 className="text-2xl font-black text-red-500">{cancellationRate.toFixed(1)}%</h3>
              <p className="text-[8px] text-slate-500 font-bold mt-1 uppercase underline group-hover:text-red-400 transition-colors">Taxa sobre total de pedidos</p>
            </div>
            <div className="p-2 bg-red-500/10 rounded-lg text-red-500 group-hover:scale-110 transition-transform"><Ban size={24}/></div>
          </div>
        </div>
      </div>
    </div>
  );
};
