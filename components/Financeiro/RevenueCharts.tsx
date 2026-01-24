
import React from 'react';
import { DollarSign, Monitor, PieChart as PieIcon, Tag } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie, Legend } from 'recharts';

interface RevenueChartsProps {
  trendData: any[];
  sourceData: any[];
  methodData: any[];
  typeData: any[];
  colors: string[];
  eventTypeColors: Record<string, string>;
}

export const RevenueCharts: React.FC<RevenueChartsProps> = ({ trendData, sourceData, methodData, typeData, colors, eventTypeColors }) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Evolução Faturamento */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg lg:col-span-3">
          <h3 className="text-lg font-black text-white mb-6 flex items-center gap-2 uppercase tracking-tighter"><DollarSign size={20} className="text-green-500"/> Evolução do Faturamento</h3>
          <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                      <defs>
                          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/><stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                          </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155"/>
                      <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tick={{fontWeight: 'bold', fill: '#94a3b8'}}/>
                      <YAxis stroke="#94a3b8" fontSize={12} tick={{fontWeight: 'bold', fill: '#94a3b8'}}/>
                      <Tooltip 
                        contentStyle={{backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px'}} 
                        itemStyle={{color: '#fff', fontWeight: 'bold'}} 
                        labelStyle={{color: '#fff', fontWeight: 'bold'}} 
                        formatter={(v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      />
                      <Area type="monotone" dataKey="value" name="Valor" stroke="#22c55e" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)"/>
                  </AreaChart>
              </ResponsiveContainer>
          </div>
      </div>

      {/* Origem Site vs Equipe */}
      <div className="lg:col-span-3 bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
          <h3 className="text-lg font-black text-white mb-6 flex items-center gap-2 uppercase tracking-tighter"><Monitor size={20} className="text-neon-blue"/> Faturamento por Origem</h3>
          <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={sourceData} margin={{ left: -10, right: 30, top: 10, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                      <XAxis type="number" stroke="#94a3b8" fontSize={10} tickFormatter={(v) => `R$ ${v/1000}k`} tick={{fill: '#94a3b8'}} />
                      <YAxis dataKey="name" type="category" stroke="#fff" fontSize={9} width={100} tick={{fontWeight: 'black', fill: '#fff'}} />
                      <Tooltip 
                        contentStyle={{backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px'}} 
                        itemStyle={{color: '#fff', fontWeight: 'bold'}} 
                        labelStyle={{color: '#fff', fontWeight: 'bold'}}
                        formatter={(v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} 
                      />
                      <Bar dataKey="value" name="Valor" radius={[0, 4, 4, 0]}>
                          {sourceData.map((entry, index) => (
                              <Cell key={`cell-source-${index}`} fill={entry.name.includes('SITE') ? '#3b82f6' : '#a855f7'} />
                          ))}
                      </Bar>
                  </BarChart>
              </ResponsiveContainer>
          </div>
      </div>

      {/* Pizzas */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
          <h3 className="text-sm font-black text-white mb-4 flex items-center gap-2 uppercase tracking-tighter"><PieIcon size={18} className="text-neon-orange"/> Receita por Meio</h3>
          <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                      <Pie data={methodData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value" stroke="none">
                          {methodData.map((e, i) => (<Cell key={`cell-${i}`} fill={colors[i % colors.length]}/>))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px'}} 
                        itemStyle={{color: '#fff', fontWeight: 'bold'}} 
                        labelStyle={{color: '#fff', fontWeight: 'bold'}}
                        formatter={(v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      />
                      <Legend verticalAlign="bottom" height={36} wrapperStyle={{fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase'}}/>
                  </PieChart>
              </ResponsiveContainer>
          </div>
      </div>

      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
          <h3 className="text-sm font-black text-white mb-4 flex items-center gap-2 uppercase tracking-tighter"><Tag size={18} className="text-neon-blue"/> Receita por Tipo</h3>
          <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                      <Pie data={typeData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value" stroke="none">
                          {typeData.map((e, i) => (<Cell key={`cell-type-${i}`} fill={eventTypeColors[e.name] || colors[i % colors.length]}/>))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px'}} 
                        itemStyle={{color: '#fff', fontWeight: 'bold'}} 
                        labelStyle={{color: '#fff', fontWeight: 'bold'}}
                        formatter={(v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      />
                      <Legend verticalAlign="bottom" height={36} wrapperStyle={{fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase'}}/>
                  </PieChart>
              </ResponsiveContainer>
          </div>
      </div>
    </div>
  );
};
