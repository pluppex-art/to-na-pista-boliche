
import React, { useEffect, useState } from 'react';
import { db } from '../services/mockBackend';
import { Reservation, ReservationStatus, PaymentStatus, AuditLog, StaffPerformance, User } from '../types';
import { Loader2, DollarSign, TrendingUp, Users, Calendar, Filter, AlertCircle, Clock, Award, Shield, History, ArrowRight, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { supabase } from '../services/supabaseClient';

const Financeiro: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'TEAM'>('OVERVIEW');
  const [loading, setLoading] = useState(true);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // Team Metrics State
  const [teamStats, setTeamStats] = useState<StaffPerformance[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  // Audit Filters
  const [auditFilters, setAuditFilters] = useState({
      userId: 'ALL',
      actionType: 'ALL',
      startDate: '',
      endDate: ''
  });

  // Initialize date range to current month (Local Time)
  useEffect(() => {
    const now = new Date();
    const toLocalISO = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const startStr = toLocalISO(firstDay);
    const endStr = toLocalISO(lastDay);

    setDateRange({ start: startStr, end: endStr });
    // Init audit filters with same range
    setAuditFilters(prev => ({ ...prev, startDate: startStr, endDate: endStr }));
  }, []);

  const refreshData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
        const all = await db.reservations.getAll();
        setReservations(all);
        
        // Fetch Team Data
        const stats = await db.users.getPerformance(dateRange.start, dateRange.end);
        setTeamStats(stats);
        
        // Users for filter dropdown
        const usersList = await db.users.getAll();
        setAllUsers(usersList);
        
        await refreshAuditLogs();
    } finally {
        if (!isBackground) setLoading(false);
    }
  };

  const refreshAuditLogs = async () => {
      const logs = await db.audit.getLogs({
          userId: auditFilters.userId,
          actionType: auditFilters.actionType,
          startDate: auditFilters.startDate,
          endDate: auditFilters.endDate,
          limit: 100 
      });
      setAuditLogs(logs);
  };

  useEffect(() => {
    refreshData();

    // Subscribe to realtime updates
    const channel = supabase
        .channel('financeiro-updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas' }, () => {
            console.log('[Financeiro] Realtime refresh');
            refreshData(true);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_logs' }, () => {
            console.log('[Financeiro] Audit Log update');
            refreshData(true);
        })
        .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [dateRange]);

  // Trigger only audit refresh when filters change (except date range which triggers full refresh)
  useEffect(() => {
      refreshAuditLogs();
  }, [auditFilters.userId, auditFilters.actionType]); // Date changes already handled by refreshData effect

  // Filters
  const filtered = reservations.filter(r => {
    if (r.status === ReservationStatus.CANCELADA) return false;
    if (r.date < dateRange.start || r.date > dateRange.end) return false;
    return true;
  });

  // Total Revenue: Only count CONFIRMED, CHECK_IN or PAID (Exclude PENDING)
  const totalRevenue = filtered
    .filter(r => r.status !== ReservationStatus.PENDENTE)
    .reduce((acc, curr) => acc + curr.totalValue, 0);
  
  // Pending Revenue (Where status is Pending)
  const pendingRevenue = filtered
    .filter(r => r.status === ReservationStatus.PENDENTE)
    .reduce((acc, curr) => acc + curr.totalValue, 0);

  // Confirmed Slots Calculation (Hours * Lanes) for Confirmed/Paid/Check-in
  // This represents "Total Horas Vendidas" (Total Pistas x Horas)
  const confirmedSlots = filtered
    .filter(r => r.status !== ReservationStatus.PENDENTE && r.status !== ReservationStatus.NO_SHOW)
    .reduce((acc, curr) => acc + (curr.duration * curr.laneCount), 0);

  // Ticket Médio: Faturamento / Numero de Horas Vendidas
  const avgTicket = confirmedSlots > 0 ? totalRevenue / confirmedSlots : 0;
  
  // Charts Data
  // 1. Revenue by Day (Only confirmed money)
  const revenueByDayMap = new Map<string, number>();
  filtered
    .filter(r => r.status !== ReservationStatus.PENDENTE)
    .forEach(r => {
        const val = revenueByDayMap.get(r.date) || 0;
        revenueByDayMap.set(r.date, val + r.totalValue);
  });
  const revenueChartData = Array.from(revenueByDayMap.entries())
    .map(([date, value]) => ({ date: date.split('-').slice(1).reverse().join('/'), value }))
    .sort((a,b) => a.date.localeCompare(b.date));

  // 2. Top Clients
  const clientSpendMap = new Map<string, {name: string, total: number, slots: number}>();
  filtered.forEach(r => {
      const current = clientSpendMap.get(r.clientId) || { name: r.clientName, total: 0, slots: 0 };
      if (r.status !== ReservationStatus.PENDENTE) {
        current.total += r.totalValue;
      }
      current.slots += (r.duration * r.laneCount);
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
                <h1 className="text-3xl font-bold text-white">Financeiro & Performance</h1>
                <p className="text-slate-400">Resultados, vendas e ranking de equipe</p>
            </div>
            
            <div className="flex items-center gap-2 bg-slate-800 p-2 rounded-lg border border-slate-700 w-full md:w-auto overflow-x-auto">
                <Filter size={18} className="text-slate-400 ml-2 flex-shrink-0" />
                <input 
                    type="date" 
                    className="bg-transparent text-white text-sm focus:outline-none border-r border-slate-700 pr-2"
                    value={dateRange.start}
                    onChange={e => {
                        setDateRange({...dateRange, start: e.target.value});
                        setAuditFilters(prev => ({ ...prev, startDate: e.target.value }));
                    }}
                />
                <span className="text-slate-500 flex-shrink-0">até</span>
                <input 
                    type="date" 
                    className="bg-transparent text-white text-sm focus:outline-none pl-2"
                    value={dateRange.end}
                    onChange={e => {
                        setDateRange({...dateRange, end: e.target.value});
                        setAuditFilters(prev => ({ ...prev, endDate: e.target.value }));
                    }}
                />
            </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex space-x-4 border-b border-slate-700 mb-6">
            <button 
                onClick={() => setActiveTab('OVERVIEW')}
                className={`pb-2 px-4 font-medium transition ${activeTab === 'OVERVIEW' ? 'text-neon-blue border-b-2 border-neon-blue' : 'text-slate-400 hover:text-white'}`}
            >
                Visão Geral
            </button>
            <button 
                onClick={() => setActiveTab('TEAM')}
                className={`pb-2 px-4 font-medium transition ${activeTab === 'TEAM' ? 'text-neon-orange border-b-2 border-neon-orange' : 'text-slate-400 hover:text-white'}`}
            >
                Performance de Equipe
            </button>
        </div>

        {activeTab === 'OVERVIEW' ? (
            <div className="space-y-8 animate-fade-in">
                {/* KPI Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 lg:gap-6">
                    {/* Faturamento */}
                    <div className="bg-slate-800 p-3 lg:p-6 rounded-xl border border-green-500/30 flex items-center justify-between shadow-sm lg:shadow-lg hover:border-green-500 transition">
                        <div className="flex flex-row lg:flex-col lg:items-start items-center gap-3 lg:gap-0">
                            <div className="lg:hidden p-1.5 sm:p-2 bg-green-500/10 rounded-lg text-green-500"><DollarSign size={18} /></div>
                            <div>
                                <span className="text-[10px] sm:text-xs lg:text-sm text-green-500 lg:text-slate-400 uppercase font-bold lg:tracking-wide">Faturamento</span>
                                <p className="hidden lg:block text-2xl xl:text-3xl font-bold text-green-500 mt-2">{totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                            </div>
                        </div>
                        <div>
                            <span className="lg:hidden text-lg sm:text-2xl font-bold text-green-500">{totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            <div className="hidden lg:block p-4 bg-green-500/10 rounded-full text-green-500 border border-green-500/20"><DollarSign size={28} /></div>
                        </div>
                    </div>

                    {/* Valor Pendente */}
                    <div className="bg-slate-800 p-3 lg:p-6 rounded-xl border border-yellow-500/30 flex items-center justify-between shadow-sm lg:shadow-lg hover:border-yellow-500 transition">
                        <div className="flex flex-row lg:flex-col lg:items-start items-center gap-3 lg:gap-0">
                            <div className="lg:hidden p-1.5 sm:p-2 bg-yellow-500/10 rounded-lg text-yellow-500"><AlertCircle size={18} /></div>
                            <div>
                                <span className="text-[10px] sm:text-xs lg:text-sm text-yellow-500 lg:text-slate-400 uppercase font-bold lg:tracking-wide">Pendente</span>
                                <p className="hidden lg:block text-2xl xl:text-3xl font-bold text-yellow-500 mt-2">{pendingRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                            </div>
                        </div>
                        <div>
                            <span className="lg:hidden text-lg sm:text-2xl font-bold text-yellow-500">{pendingRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            <div className="hidden lg:block p-4 bg-yellow-500/10 rounded-full text-yellow-500 border border-yellow-500/20"><AlertCircle size={28} /></div>
                        </div>
                    </div>

                    {/* Reservas (Slots) */}
                    <div className="bg-slate-800 p-3 lg:p-6 rounded-xl border border-slate-700 flex items-center justify-between shadow-sm lg:shadow-lg hover:border-slate-500 transition">
                        <div className="flex flex-row lg:flex-col lg:items-start items-center gap-3 lg:gap-0">
                            <div className="lg:hidden p-1.5 sm:p-2 bg-slate-700/50 rounded-lg text-slate-400"><Clock size={18} /></div>
                            <div>
                                <span className="text-[10px] sm:text-xs lg:text-sm text-slate-400 lg:text-slate-400 uppercase font-bold lg:tracking-wide">Total De Reservas</span>
                                <p className="hidden lg:block text-2xl xl:text-3xl font-bold text-white mt-2">{confirmedSlots}</p>
                            </div>
                        </div>
                        <div>
                            <span className="lg:hidden text-lg sm:text-2xl font-bold text-white">{confirmedSlots}</span>
                            <div className="hidden lg:block p-4 bg-slate-700/30 rounded-full text-slate-200 border border-slate-600"><Clock size={28} /></div>
                        </div>
                    </div>

                    {/* Ticket Médio */}
                    <div className="bg-slate-800 p-3 lg:p-6 rounded-xl border border-neon-orange/30 flex items-center justify-between shadow-sm lg:shadow-lg hover:border-neon-orange transition">
                        <div className="flex flex-row lg:flex-col lg:items-start items-center gap-3 lg:gap-0">
                            <div className="lg:hidden p-1.5 sm:p-2 bg-neon-orange/10 rounded-lg text-neon-orange"><TrendingUp size={18} /></div>
                            <div>
                                <span className="text-[10px] sm:text-xs lg:text-sm text-neon-orange lg:text-slate-400 uppercase font-bold lg:tracking-wide">Ticket Médio</span>
                                <p className="hidden lg:block text-2xl xl:text-3xl font-bold text-neon-orange mt-2">{avgTicket.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                            </div>
                        </div>
                        <div>
                            <span className="lg:hidden text-lg sm:text-2xl font-bold text-neon-orange">{avgTicket.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                            <div className="hidden lg:block p-4 bg-neon-orange/10 rounded-full text-neon-orange border border-neon-orange/20"><TrendingUp size={28} /></div>
                        </div>
                    </div>
                </div>

                {/* Charts Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                        <h3 className="text-lg font-bold text-white mb-6">Faturamento Diário (Realizado)</h3>
                        <div className="h-80 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={revenueChartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                    <XAxis dataKey="date" stroke="#94a3b8" />
                                    <YAxis stroke="#94a3b8" />
                                    <Tooltip contentStyle={{backgroundColor: '#1e293b', border: '1px solid #475569', color: '#fff'}} itemStyle={{color: '#22c55e'}} />
                                    <Bar dataKey="value" name="Valor (R$)" fill="#22c55e" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg flex flex-col">
                        <h3 className="text-lg font-bold text-white mb-4">Top 5 Clientes</h3>
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="text-slate-400 border-b border-slate-700"><tr><th className="pb-2">Cliente</th><th className="pb-2 text-right">Reservas</th><th className="pb-2 text-right">Pago</th></tr></thead>
                                <tbody className="divide-y divide-slate-700">
                                    {topClients.map((c, i) => (
                                        <tr key={i} className="group hover:bg-slate-700/50">
                                            <td className="py-3 font-medium text-white">{c.name}</td>
                                            <td className="py-3 text-right text-slate-400">{c.slots}</td>
                                            <td className="py-3 text-right text-neon-green font-bold">{c.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                                        </tr>
                                    ))}
                                    {topClients.length === 0 && (<tr><td colSpan={3} className="py-8 text-center text-slate-500">Sem dados no período</td></tr>)}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
                {/* Team Ranking */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <Award className="text-neon-orange"/> Ranking de Vendas
                        </h3>
                        
                        {teamStats.length === 0 ? (
                            <div className="text-center py-10 text-slate-500">Nenhum dado de venda registrado no período.</div>
                        ) : (
                            <div className="space-y-4">
                                {/* Top 1 Podium (Visual) */}
                                <div className="flex justify-center mb-8">
                                    <div className="flex flex-col items-center">
                                        <div className="relative">
                                            <div className="w-20 h-20 bg-neon-orange/20 rounded-full flex items-center justify-center border-2 border-neon-orange shadow-[0_0_20px_rgba(249,115,22,0.3)]">
                                                <span className="text-2xl font-bold text-neon-orange">1º</span>
                                            </div>
                                            <Award size={24} className="absolute -bottom-2 -right-2 text-neon-orange drop-shadow-lg" fill="currentColor"/>
                                        </div>
                                        <h4 className="mt-2 font-bold text-white text-lg">{teamStats[0].userName}</h4>
                                        <p className="text-neon-green font-bold">{teamStats[0].totalSales.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</p>
                                    </div>
                                </div>

                                {/* Table */}
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-slate-900/50 text-slate-400 uppercase text-xs">
                                            <tr>
                                                <th className="p-3">Posição</th>
                                                <th className="p-3">Colaborador</th>
                                                <th className="p-3 text-right">Reservas Criadas</th>
                                                <th className="p-3 text-right">Confirmadas</th>
                                                <th className="p-3 text-right">Total Vendido</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-700">
                                            {teamStats.map((s, idx) => (
                                                <tr key={s.userId} className="hover:bg-slate-700/30">
                                                    <td className="p-3 font-bold text-slate-500">#{idx + 1}</td>
                                                    <td className="p-3 text-white font-medium">{s.userName}</td>
                                                    <td className="p-3 text-right">{s.reservationsCreated}</td>
                                                    <td className="p-3 text-right">{s.reservationsConfirmed}</td>
                                                    <td className="p-3 text-right text-neon-green font-bold">{s.totalSales.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Audit Log / Timeline */}
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg flex flex-col h-[600px]">
                    <div className="mb-4">
                        <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
                            <Shield className="text-neon-blue"/> Auditoria (Logs)
                        </h3>
                        {/* Audit Filters */}
                        <div className="flex flex-col gap-2 bg-slate-900/50 p-3 rounded-lg border border-slate-700">
                            <div className="flex gap-2">
                                <select 
                                    className="bg-slate-800 border border-slate-600 rounded text-xs text-white p-2 flex-1 outline-none"
                                    value={auditFilters.userId}
                                    onChange={e => setAuditFilters({...auditFilters, userId: e.target.value})}
                                >
                                    <option value="ALL">Todos Usuários</option>
                                    {allUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                                <select 
                                    className="bg-slate-800 border border-slate-600 rounded text-xs text-white p-2 flex-1 outline-none"
                                    value={auditFilters.actionType}
                                    onChange={e => setAuditFilters({...auditFilters, actionType: e.target.value})}
                                >
                                    <option value="ALL">Todas Ações</option>
                                    <option value="LOGIN">Login</option>
                                    <option value="CREATE_RESERVATION">Criar Reserva</option>
                                    <option value="UPDATE_RESERVATION">Atualizar Reserva</option>
                                    <option value="CREATE_CLIENT">Criar Cliente</option>
                                    <option value="LOYALTY_UPDATE">Fidelidade</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                        {auditLogs.length === 0 ? (
                            <div className="text-center text-slate-500 py-10">Nenhuma atividade com os filtros atuais.</div>
                        ) : (
                            auditLogs.map(log => (
                                <div key={log.id} className="relative pl-6 pb-4 border-l border-slate-700 last:border-0 last:pb-0">
                                    <div className="absolute left-[-5px] top-0 w-2.5 h-2.5 rounded-full bg-slate-600 border-2 border-slate-800"></div>
                                    <p className="text-xs text-slate-500 mb-1 flex justify-between">
                                        <span>{new Date(log.createdAt).toLocaleString('pt-BR')}</span>
                                    </p>
                                    <p className="text-sm text-white font-bold">{log.userName}</p>
                                    <p className="text-xs text-slate-400 mt-1">{log.details}</p>
                                    <span className="inline-block mt-2 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
                                        {log.actionType}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="pt-4 mt-4 border-t border-slate-700 text-center">
                         <button onClick={refreshAuditLogs} className="text-xs text-neon-blue hover:text-white flex items-center justify-center gap-1 mx-auto"><History size={12}/> Atualizar Logs</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default Financeiro;
