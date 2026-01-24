
import React from 'react';
import { Gauge, Calendar, Clock } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

interface OccupancyChartsProps {
  stats: {
    percentage: number;
    totalCapacity: number;
    occupiedTotal: number;
    byDay: any[];
    byHour: any[];
  };
}

const getOccupancyColor = (val: number) => {
    if (val < 30) return '#ef4444'; // Vermelho (Baixa)
    if (val < 70) return '#f59e0b'; // Amarelo/Laranja (Média)
    return '#22c55e'; // Verde (Alta)
};

export const OccupancyCharts: React.FC<OccupancyChartsProps> = ({ stats }) => {
  const gaugeData = [
    { value: stats.percentage },
    { value: 100 - stats.percentage }
  ];

  const tooltipStyle = {
    backgroundColor: '#1e293b',
    border: '1px solid #475569',
    borderRadius: '12px',
    padding: '12px',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)'
  };

  const itemStyle = {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: '12px'
  };

  const labelStyle = {
    color: '#94a3b8',
    fontWeight: '900',
    marginBottom: '4px',
    fontSize: '10px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em'
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* 1. TAXA DE OCUPAÇÃO GERAL (GAUGE) */}
      <div className="bg-slate-800/40 border border-slate-700 p-8 rounded-[2.5rem] shadow-2xl flex flex-col items-center relative min-h-[500px]">
        <div className="text-center mb-10">
            <h3 className="text-xl font-black text-white flex items-center justify-center gap-3 uppercase tracking-tighter">
                <Gauge size={22} className="text-orange-500"/> TAXA DE OCUPAÇÃO GERAL
            </h3>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mt-2">Desempenho da Unidade</p>
        </div>

        <div className="h-48 w-full relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={gaugeData}
                        cx="50%" cy="100%" 
                        startAngle={180} endAngle={0} 
                        innerRadius={85} outerRadius={115} 
                        paddingAngle={0} dataKey="value" stroke="none"
                        animationBegin={0} animationDuration={1500}
                    >
                        <Cell fill={getOccupancyColor(stats.percentage)} />
                        <Cell fill="#1e293b" />
                    </Pie>
                </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
                <span className="text-4xl font-black text-white leading-none">{Math.round(stats.percentage)}%</span>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-3">Capacidade</span>
            </div>
        </div>

        <div className="w-full bg-slate-900/60 p-6 rounded-[1.8rem] border border-slate-700/50 flex justify-between gap-4 mt-12 shadow-inner">
            <div className="flex flex-col items-center flex-1 text-center">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.15em] mb-2">Horas Disponíveis</span>
                <span className="text-2xl font-black text-white">{stats.totalCapacity}h</span>
            </div>
            <div className="w-px bg-slate-700/60 self-stretch"></div>
            <div className="flex flex-col items-center flex-1 text-center">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.15em] mb-2">Horas Vendidas</span>
                <span className="text-2xl font-black text-blue-500">{stats.occupiedTotal}h</span>
            </div>
        </div>

        <div className="w-full grid grid-cols-3 gap-3 mt-10">
            <div className="space-y-2">
                <div className="h-1 bg-red-600 rounded-full w-full opacity-80"></div>
                <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest text-center">Baixa</p>
            </div>
            <div className="space-y-2">
                <div className="h-1 bg-orange-500 rounded-full w-full opacity-80"></div>
                <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest text-center">Média</p>
            </div>
            <div className="space-y-2">
                <div className="h-1 bg-green-500 rounded-full w-full opacity-80"></div>
                <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest text-center">Alta</p>
            </div>
        </div>
      </div>

      {/* 2. OCUPAÇÃO POR DIA */}
      <div className="bg-slate-800/40 border border-slate-700 p-8 rounded-[2.5rem] shadow-2xl flex flex-col">
        <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
                <Calendar size={20} />
            </div>
            <h3 className="text-base font-black text-white uppercase tracking-tighter">Ocupação por Dia</h3>
        </div>

        <div className="flex-1 w-full min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.byDay} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="name" stroke="#475569" fontSize={10} axisLine={false} tickLine={false} tick={{fontWeight: 'bold', fill: '#94a3b8'}} />
                    <YAxis stroke="#475569" fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} domain={[0, 100]} tick={{fill: '#475569'}} />
                    <Tooltip 
                        cursor={{fill: '#1e293b', opacity: 0.4}}
                        contentStyle={tooltipStyle}
                        itemStyle={itemStyle}
                        labelStyle={labelStyle}
                        formatter={(v: number) => [`${v}%`, 'Ocupação']}
                    />
                    <Bar dataKey="porcentagem" radius={[6, 6, 0, 0]} barSize={24}>
                        {stats.byDay.map((entry, index) => (
                            <Cell key={`cell-day-${index}`} fill={getOccupancyColor(entry.porcentagem)} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
      </div>

      {/* 3. OCUPAÇÃO POR HORA */}
      <div className="bg-slate-800/40 border border-slate-700 p-8 rounded-[2.5rem] shadow-2xl flex flex-col">
        <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-green-500/10 rounded-xl text-green-500">
                <Clock size={20} />
            </div>
            <h3 className="text-base font-black text-white uppercase tracking-tighter">Ocupação por Hora</h3>
        </div>

        <div className="flex-1 w-full min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.byHour} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="hora" stroke="#475569" fontSize={10} axisLine={false} tickLine={false} tick={{fontWeight: 'bold', fill: '#94a3b8'}} />
                    <YAxis stroke="#475569" fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} domain={[0, 100]} tick={{fill: '#475569'}} />
                    <Tooltip 
                        cursor={{fill: '#1e293b', opacity: 0.4}}
                        contentStyle={tooltipStyle}
                        itemStyle={itemStyle}
                        labelStyle={labelStyle}
                        formatter={(v: number) => [`${v}%`, 'Ocupação Média']}
                    />
                    <Bar dataKey="porcentagem" radius={[6, 6, 0, 0]} barSize={24}>
                        {stats.byHour.map((entry, index) => (
                            <Cell key={`cell-hour-${index}`} fill={getOccupancyColor(entry.porcentagem)} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
