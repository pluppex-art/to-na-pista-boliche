import React from 'react';
import { Monitor, TrendingUp, ArrowRight } from 'lucide-react';

interface Props {
  data: {
    name: string;
    value: number;
  }[];
}

export const RevenueByOriginChart: React.FC<Props> = ({ data }) => {
  const total = data.reduce((acc, curr) => acc + curr.value, 0);
  
  const chartData = data.map((item, index) => {
    const percentage = total > 0 ? Math.round((item.value / total) * 100) : 0;
    const colors = ['#3b82f6', '#a855f7', '#f97316', '#22c55e', '#ef4444', '#eab308', '#ec4899', '#06b6d4'];
    return {
      name: item.name,
      value: item.value,
      fill: colors[index % colors.length],
      label: `${item.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (${percentage}%)`
    };
  });

  return (
    <div className="bg-slate-800/40 border border-slate-700 p-8 rounded-[2.5rem] shadow-2xl h-[450px] flex flex-col">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h3 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
            <Monitor size={22} className="text-blue-500"/> Faturamento por Origem
          </h3>
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-2">Distribuição de Receita por Canal</p>
        </div>
        <div className="bg-slate-900/80 px-4 py-2 rounded-xl border border-slate-700 flex items-center gap-3">
            <TrendingUp size={16} className="text-blue-500" />
            <span className="text-white font-black text-xs">
              {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} Total
            </span>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-between py-1">
        {chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-slate-600 font-bold uppercase text-[10px] tracking-widest">Sem dados no período</div>
        ) : (
          chartData.map((item, index) => {
            const barWidth = total > 0 ? (item.value / total) * 100 : 0;
            return (
              <div key={index} className="space-y-1">
                <div className="flex justify-between items-end px-1">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{item.name}</span>
                  <span className="text-[10px] font-black text-white">{item.label}</span>
                </div>
                <div className="h-2 w-full bg-slate-900/50 rounded-full overflow-hidden border border-slate-700/30">
                  <div 
                    className="h-full rounded-full"
                    style={{ 
                      width: `${barWidth}%`,
                      backgroundColor: item.fill,
                      boxShadow: `0 0 10px ${item.fill}44`
                    }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
      
      <div className="mt-6 flex justify-between items-center px-4 py-3 bg-slate-900/40 rounded-2xl border border-slate-700/50">
        <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase">
          <TrendingUp size={14}/> <span>Análise de Performance por Origem</span>
        </div>
        <ArrowRight size={14} className="text-slate-700" />
      </div>
    </div>
  );
};
