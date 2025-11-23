
import React, { useEffect, useState } from 'react';
import { db } from '../services/mockBackend';
import { Reservation, ReservationStatus, PaymentStatus } from '../types';
import { Loader2, DollarSign, TrendingUp, Users, Calendar, Filter } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const Financeiro: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // Initialize date range to current month
  useEffect(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
    setDateRange({ start, end });
  }, []);

  const refreshData = async () => {
    setLoading(true);
    const all = await db.reservations.getAll();
    setReservations(all);
    setLoading(false);
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Filters
  const filtered = reservations.filter(r => {
    if (r.status === ReservationStatus.CANCELADA) return false;
    if (r.date < dateRange.start || r.date > dateRange.end) return false;
    return true;
  });

  // Metrics
  const totalRevenue = filtered.reduce((acc, curr) => acc + curr.totalValue, 0);
  const paidReservations = filtered.filter(r => r.paymentStatus === PaymentStatus.PAGO || r.status === ReservationStatus.CONFIRMADA).length;
  const avgTicket = paidReservations > 0 ? totalRevenue / paidReservations : 0;
  
  // Charts Data
  // 1. Revenue by Day
  const revenueByDayMap = new Map<string, number>();
  filtered.forEach(r => {
      const val = revenueByDayMap.get(r.date) || 0;
      revenueByDayMap.set(r.date, val + r.totalValue);
  });
  const revenueChartData = Array.from(revenueByDayMap.entries())
    .map(([date, value]) => ({ date: date.split('-').slice(1).reverse().join('/'), value }))
    .sort((a,b) => a.date.localeCompare(b.date));

  // 2. Top Clients
  const clientSpendMap = new Map<string, {name: string, total: number, count: number}>();
  filtered.forEach(r => {
      const current = clientSpendMap.get(r.clientId) || { name: r.clientName, total: 0, count: 0 };
      current.total += r.totalValue;
      current.count += 1;
      clientSpendMap.set(r.clientId, current);
  });
  const topClients = Array.from(clientSpendMap.values())
    .sort((a,b) => b.total - a.total)
    .slice(0, 5);

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-neon-blue" size={48} /></div>;

  return (
    <div className="space-y-8 animate-fade-in pb-20 md:pb-0">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-6">
            <div>
                <h1 className="text-3xl font-bold text-white">Financeiro</h1>
                <p className="text-slate-400">Resultados e performance de vendas</p>
            </div>
            
            <div className="flex items-center gap-2 bg-slate-800 p-2 rounded-lg border border-slate-700">
                <Filter size={18} className="text-slate-400 ml-2" />
                <input 
                    type="date" 
                    className="bg-transparent text-white text-sm focus:outline-none border-r border-slate-700 pr-2"
                    value={dateRange.start}
                    onChange={e => setDateRange({...dateRange, start: e.target.value})}
                />
                <span className="text-slate-500">até</span>
                <input 
                    type="date" 
                    className="bg-transparent text-white text-sm focus:outline-none pl-2"
                    value={dateRange.end}
                    onChange={e => setDateRange({...dateRange, end: e.target.value})}
                />
            </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <DollarSign size={64} className="text-neon-green"/>
                </div>
                <p className="text-slate-400 text-xs font-bold uppercase">Faturamento Total</p>
                <p className="text-3xl font-bold text-neon-green mt-2">
                    {totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
                <p className="text-xs text-slate-500 mt-1">no período selecionado</p>
            </div>
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Calendar size={64} className="text-neon-blue"/>
                </div>
                <p className="text-slate-400 text-xs font-bold uppercase">Reservas Confirmadas</p>
                <p className="text-3xl font-bold text-white mt-2">{paidReservations}</p>
                <p className="text-xs text-slate-500 mt-1">agendamentos realizados</p>
            </div>
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <TrendingUp size={64} className="text-neon-orange"/>
                </div>
                <p className="text-slate-400 text-xs font-bold uppercase">Ticket Médio</p>
                <p className="text-3xl font-bold text-neon-orange mt-2">
                    {avgTicket.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
                <p className="text-xs text-slate-500 mt-1">por reserva</p>
            </div>
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-4 opacity-10">
                    <Users size={64} className="text-purple-500"/>
                </div>
                <p className="text-slate-400 text-xs font-bold uppercase">Melhor Cliente</p>
                <p className="text-xl font-bold text-white mt-2 truncate">
                    {topClients[0]?.name || '---'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                    {topClients[0]?.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </p>
            </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Chart */}
            <div className="lg:col-span-2 bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                <h3 className="text-lg font-bold text-white mb-6">Faturamento Diário</h3>
                <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={revenueChartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="date" stroke="#94a3b8" />
                            <YAxis stroke="#94a3b8" />
                            <Tooltip 
                                contentStyle={{backgroundColor: '#1e293b', border: '1px solid #475569', color: '#fff'}}
                                itemStyle={{color: '#22c55e'}}
                            />
                            <Bar dataKey="value" name="Valor (R$)" fill="#22c55e" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Top Clients Table */}
            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg flex flex-col">
                <h3 className="text-lg font-bold text-white mb-4">Top 5 Clientes</h3>
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="text-slate-400 border-b border-slate-700">
                            <tr>
                                <th className="pb-2">Cliente</th>
                                <th className="pb-2 text-right">Reservas</th>
                                <th className="pb-2 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {topClients.map((c, i) => (
                                <tr key={i} className="group hover:bg-slate-700/50">
                                    <td className="py-3 font-medium text-white">{c.name}</td>
                                    <td className="py-3 text-right text-slate-400">{c.count}</td>
                                    <td className="py-3 text-right text-neon-green font-bold">
                                        {c.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </td>
                                </tr>
                            ))}
                            {topClients.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="py-8 text-center text-slate-500">Sem dados no período</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
  );
};

export default Financeiro;
