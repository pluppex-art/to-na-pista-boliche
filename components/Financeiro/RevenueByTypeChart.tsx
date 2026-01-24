
import React from 'react';
import { Tag } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface Props {
  data: any[];
  typeColors: Record<string, string>;
  fallbackColors: string[];
}

export const RevenueByTypeChart: React.FC<Props> = ({ data, typeColors, fallbackColors }) => {
  return (
    <div className="bg-slate-800/40 border border-slate-700 p-8 rounded-[2.5rem] shadow-2xl h-[400px] flex flex-col">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-purple-500/10 rounded-xl text-purple-500">
          <Tag size={20} />
        </div>
        <h3 className="text-base font-black text-white uppercase tracking-tighter">Receita por Tipo</h3>
      </div>

      <div className="flex-1 w-full">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-600 font-bold uppercase text-[10px] tracking-widest">Sem dados</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={8} dataKey="value" stroke="none">
                {data.map((e, i) => <Cell key={`cell-type-${i}`} fill={typeColors[e.name] || fallbackColors[i % fallbackColors.length]} />)}
              </Pie>
              <Tooltip 
                contentStyle={{backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '12px', padding: '12px'}}
                itemStyle={{color: '#ffffff', fontWeight: 'bold'}}
                labelStyle={{color: '#94a3b8', fontWeight: 'black', marginBottom: '4px', fontSize: '10px', textTransform: 'uppercase'}}
                formatter={(v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              />
              <Legend verticalAlign="bottom" height={36} wrapperStyle={{fontSize: '9px', fontWeight: 'black', textTransform: 'uppercase', paddingTop: '20px'}} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
