
import React from 'react';
import { Filter, Users, ArrowRight, TrendingUp } from 'lucide-react';
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from 'recharts';

interface EngagementFunnelProps {
  data: {
    visits: number;
    clicks: number;
    bookingStarts: number;
    conversions: number;
  };
}

export const EngagementFunnelChart: React.FC<EngagementFunnelProps> = ({ data }) => {
  const funnelData = [
    { name: 'Visitas (Site)', value: data.visits, fill: '#3b82f6', label: `${data.visits} (100%)` },
    { name: 'Interesse (Botão)', value: data.clicks, fill: '#f97316', label: `${data.clicks} (${data.visits > 0 ? Math.round((data.clicks / data.visits) * 100) : 0}%)` },
    { name: 'Pré-Reserva (Site)', value: data.bookingStarts, fill: '#a855f7', label: `${data.bookingStarts} (${data.clicks > 0 ? Math.round((data.bookingStarts / data.clicks) * 100) : 0}%)` },
    { name: 'Vendas Pagas', value: data.conversions, fill: '#22c55e', label: `${data.conversions} (${data.bookingStarts > 0 ? Math.round((data.conversions / data.bookingStarts) * 100) : 0}%)` },
  ];

  const tooltipStyle = {
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '12px',
    padding: '12px',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
  };

  return (
    <div className="bg-slate-800/40 border border-slate-700 p-8 rounded-[2.5rem] shadow-2xl h-[450px] flex flex-col">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h3 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
            <Filter size={22} className="text-neon-blue"/> Funil de Engajamento
          </h3>
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-2">Conversão Real vs Intenção</p>
        </div>
        <div className="bg-slate-900/80 px-4 py-2 rounded-xl border border-slate-700 flex items-center gap-3">
            <TrendingUp size={16} className="text-neon-green" />
            <span className="text-white font-black text-xs">{(data.visits > 0 ? (data.conversions / data.visits) * 100 : 0).toFixed(1)}% Conv. Geral</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-between py-2">
        {funnelData.map((item, index) => (
          <div key={index} className="space-y-2">
            <div className="flex justify-between items-end px-1">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{item.name}</span>
              <span className="text-xs font-black text-white">{item.label}</span>
            </div>
            <div className="h-3 w-full bg-slate-900/50 rounded-full overflow-hidden border border-slate-700/30">
              <div 
                className="h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(0,0,0,0.2)]"
                style={{ 
                  width: `${(item.value / data.visits) * 100}%`,
                  backgroundColor: item.fill,
                  boxShadow: `0 0 20px ${item.fill}33`
                }}
              />
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-8 flex justify-between items-center px-4 py-3 bg-slate-900/40 rounded-2xl border border-slate-700/50">
        <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase">
          <Users size={14}/> <span>Tráfego baseado em IDs Anônimos persistentes</span>
        </div>
        <ArrowRight size={14} className="text-slate-700" />
      </div>
    </div>
  );
};
