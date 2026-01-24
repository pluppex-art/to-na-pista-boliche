
import React from 'react';
import { Monitor } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Props {
  data: any[];
}

export const RevenueByOriginChart: React.FC<Props> = ({ data }) => {
  return (
    <div className="bg-slate-800/40 border border-slate-700 p-8 rounded-[2.5rem] shadow-2xl h-[400px] flex flex-col">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
          <Monitor size={20} />
        </div>
        <h3 className="text-base font-black text-white uppercase tracking-tighter">Faturamento por Origem</h3>
      </div>

      <div className="flex-1 w-full">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-600 font-bold uppercase text-[10px] tracking-widest">Sem dados no período</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={data} margin={{ left: 20, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" stroke="#fff" fontSize={10} width={80} tick={{fontWeight: 'black', fill: '#fff'}} axisLine={false} tickLine={false} />
              <Tooltip 
                cursor={{fill: '#1e293b', opacity: 0.4}}
                contentStyle={{backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '12px', padding: '12px'}}
                itemStyle={{color: '#ffffff', fontWeight: 'bold'}}
                labelStyle={{color: '#94a3b8', fontWeight: 'black', marginBottom: '4px', fontSize: '10px', textTransform: 'uppercase'}}
                formatter={(v: number) => [v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), 'Total']}
              />
              <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={32}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.name.includes('SITE') ? '#3b82f6' : '#a855f7'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
