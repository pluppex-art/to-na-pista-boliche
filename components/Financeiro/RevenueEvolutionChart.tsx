
import React from 'react';
import { DollarSign } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  data: any[];
}

export const RevenueEvolutionChart: React.FC<Props> = ({ data }) => {
  return (
    <div className="bg-slate-800/40 border border-slate-700 p-8 rounded-[2.5rem] shadow-2xl h-[450px] flex flex-col">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-green-500/10 rounded-xl text-green-500">
          <DollarSign size={20} />
        </div>
        <h3 className="text-base font-black text-white uppercase tracking-tighter">Evolução do Faturamento</h3>
      </div>

      <div className="flex-1 w-full">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-600 font-bold uppercase text-[10px] tracking-widest">Sem dados no período</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis dataKey="date" stroke="#475569" fontSize={10} tick={{fontWeight: 'bold', fill: '#94a3b8'}} axisLine={false} tickLine={false} />
              <YAxis stroke="#475569" fontSize={10} tick={{fill: '#475569'}} axisLine={false} tickLine={false} tickFormatter={(v) => `R$ ${v}`} />
              <Tooltip 
                contentStyle={{backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '12px', padding: '12px'}}
                itemStyle={{color: '#ffffff', fontWeight: 'bold'}} 
                labelStyle={{color: '#94a3b8', fontWeight: 'black', marginBottom: '4px', fontSize: '10px', textTransform: 'uppercase'}}
                formatter={(v: number) => [v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 'Faturamento']}
              />
              <Area type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
