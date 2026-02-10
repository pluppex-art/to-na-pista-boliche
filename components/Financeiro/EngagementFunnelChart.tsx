
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
    { name: 'Visitas (Site)', value: data.visits, fill: '#3b82f6', label: '100%' },
    { name: 'Interesse (Botão)', value: data.clicks, fill: '#f97316', label: `${data.visits > 0 ? Math.round((data.clicks / data.visits) * 100) : 0}%` },
    { name: 'Pré-Reserva (Site)', value: data.bookingStarts, fill: '#a855f7', label: `${data.clicks > 0 ? Math.round((data.bookingStarts / data.clicks) * 100) : 0}%` },
    { name: 'Vendas Pagas', value: data.conversions, fill: '#22c55e', label: `${data.bookingStarts > 0 ? Math.round((data.conversions / data.bookingStarts) * 100) : 0}%` },
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

      <div className="flex-1 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            layout="vertical"
            data={funnelData}
            margin={{ top: 5, right: 80, left: 40, bottom: 5 }}
          >
            <XAxis type="number" hide />
            <YAxis 
              dataKey="name" 
              type="category" 
              width={120} 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#94a3b8', fontWeight: 'bold', fontSize: 11 }}
            />
            <Tooltip 
              cursor={{fill: 'rgba(255,255,255,0.05)'}}
              contentStyle={tooltipStyle}
              itemStyle={{color: '#fff', fontWeight: 'bold'}}
              formatter={(val: number) => [val, 'Usuários']}
            />
            <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={45}>
              {funnelData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
              <LabelList 
                dataKey="label" 
                position="right" 
                style={{ fill: '#fff', fontWeight: 'black', fontSize: 12, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }} 
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-6 flex justify-between items-center px-4 py-3 bg-slate-900/40 rounded-2xl border border-slate-700/50">
        <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase">
          <Users size={14}/> <span>Tráfego baseado em IDs Anônimos persistentes</span>
        </div>
        <ArrowRight size={14} className="text-slate-700" />
      </div>
    </div>
  );
};
