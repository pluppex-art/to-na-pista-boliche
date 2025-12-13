
import React, { useEffect, useState } from 'react';
import { db } from '../services/mockBackend';
import { Reservation, ReservationStatus, AuditLog, User } from '../types';
import { Loader2, DollarSign, TrendingUp, Users, Calendar, AlertCircle, Shield, History, Calculator, Percent, CalendarRange, ListChecks, ChevronDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '../services/supabaseClient';

const Financeiro: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'LOGS'>('OVERVIEW');
  const [loading, setLoading] = useState(true);
  
  // Otimização: Não usar Reservation[] completo aqui, apenas o subset financeiro
  const [financeData, setFinanceData] = useState<Reservation[]>([]);
  
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  
  // Estado visual do preset selecionado (para o Select do Mobile)
  const [currentPreset, setCurrentPreset] = useState<string>('MONTH');

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  const [auditFilters, setAuditFilters] = useState({
      userId: 'ALL',
      actionType: 'ALL',
      startDate: '',
      endDate: ''
  });

  const toLocalISO = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const startStr = toLocalISO(firstDay);
    const endStr = toLocalISO(lastDay);

    setDateRange({ start: startStr, end: endStr });
    setAuditFilters(prev => ({ ...prev, startDate: startStr, endDate: endStr }));
  }, []);

  const refreshData = async (isBackground = false) => {
    if (!dateRange.start || !dateRange.end) return;
    if (!isBackground) setLoading(true);
    try {
        // OTIMIZAÇÃO: Busca apenas colunas necessárias via getFinanceData
        const data = await db.reservations.getFinanceData(dateRange.start, dateRange.end);
        setFinanceData(data);
        
        // Logs ainda são necessários na aba de auditoria
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

    const channel = supabase
        .channel('financeiro-updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas' }, (payload) => {
            const newRes = payload.new as any;
            if (newRes && newRes.date >= dateRange.start && newRes.date <= dateRange.end) {
                refreshData(true);
            }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_logs' }, () => {
            refreshData(true);
        })
        .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [dateRange]);

  useEffect(() => {
      refreshAuditLogs();
  }, [auditFilters.userId, auditFilters.actionType]); 

  const applyDatePreset = (preset: 'TODAY' | '7D' | '30D' | '90D' | 'WEEK' | 'MONTH' | 'YEAR' | 'CUSTOM') => {
      setCurrentPreset(preset);
      if (preset === 'CUSTOM') return;

      const today = new Date();
      let start = new Date();
      let end = new Date();

      switch(preset) {
          case 'TODAY':
              break;
          case '7D':
              start.setDate(today.getDate() - 6);
              break;
          case '30D':
              start.setDate(today.getDate() - 29);
              break;
          case '90D':
              start.setDate(today.getDate() - 89);
              break;
          case 'WEEK':
              const day = today.getDay(); 
              const diff = today.getDate() - day + (day === 0 ? -6 : 1); 
              start.setDate(diff);
              break;
          case 'MONTH':
              start = new Date(today.getFullYear(), today.getMonth(), 1);
              end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
              break;
          case 'YEAR':
              start = new Date(today.getFullYear(), 0, 1);
              end = new Date(today.getFullYear(), 11, 31);
              break;
      }

      const s = toLocalISO(start);
      const e = toLocalISO(end);
      setDateRange({ start: s, end: e });
      setAuditFilters(prev => ({ ...prev, startDate: s, endDate: e }));
  };

  // --- CÁLCULOS DE MÉTRICAS ---
  
  const calculateSlots = (r: Reservation) => (r.laneCount || 1) * Math.ceil(r.duration || 1);

  const realizedReservations = financeData.filter(r => 
      r.status === ReservationStatus.CONFIRMADA || 
      r.status === ReservationStatus.CHECK_IN
  );

  const pendingReservations = financeData.filter(r => 
      r.status === ReservationStatus.PENDENTE
  );

  const totalRevenue = realizedReservations.reduce((acc, curr) => acc + curr.totalValue, 0);
  const pendingRevenue = pendingReservations.reduce((acc, curr) => acc + curr.totalValue, 0);
  const confirmedSlotsCount = realizedReservations.reduce((acc, r) => acc + calculateSlots(r), 0);
  
  const avgTicket = confirmedSlotsCount > 0 ? totalRevenue / confirmedSlotsCount : 0;
  
  const startD = new Date(dateRange.start);
  const endD = new Date(dateRange.end);
  const diffTime = Math.abs(endD.getTime() - startD.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 
  const dailyAverage = diffDays > 0 ? (confirmedSlotsCount / diffDays) : 0;

  const cancelledReservations = financeData.filter(r => r.status === ReservationStatus.CANCELADA);
  const totalSlotsIncludingCancelled = financeData.reduce((acc, r) => acc + calculateSlots(r), 0);
  const cancelledSlotsCount = cancelledReservations.reduce((acc, r) => acc + calculateSlots(r), 0);

  const cancellationRate = totalSlotsIncludingCancelled > 0 
      ? (cancelledSlotsCount / totalSlotsIncludingCancelled) * 100 
      : 0;

  // Gráfico
  const revenueByDayMap = new Map<string, number>();
  realizedReservations.forEach(r => {
      const val = revenueByDayMap.get(r.date) || 0;
      revenueByDayMap.set(r.date, val + r.totalValue);
  });
  const revenueChartData = Array.from(revenueByDayMap.entries())
    .map(([date, value]) => ({ date: date.split('-').slice(1).reverse().join('/'), value }))
    .sort((a,b) => a.date.localeCompare(b.date));

  // Top Clientes
  const clientSpendMap = new Map<string, {name: string, total: number, slots: number}>();
  realizedReservations.forEach(r => {
      const current = clientSpendMap.get(r.clientId) || { name: r.clientName, total: 0, slots: 0 };
      current.total += r.totalValue;
      current.slots += calculateSlots(r);
      clientSpendMap.set(r.clientId, current);
  });
  
  const topClients = Array.from(clientSpendMap.values())
    .sort((a,b) => b.total - a.total)
    .slice(0, 5);

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-neon-blue" size={48} /></div>;

  return (
    <div className="space-y-6 animate-fade-in pb-20 md:pb-0">
        <div className="flex flex-col gap-4 border-b border-slate-800 pb-6">
            <h1 className="text-3xl font-bold text-white">Financeiro</h1>

            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col gap-4">
                <div>
                    <label className="text-xs text-slate-400 font-bold uppercase mb-2 block">Período de Análise</label>
                    <div className="md:hidden relative">
                        <select 
                            className="w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg p-3 appearance-none focus:border-neon-blue outline-none font-bold"
                            value={currentPreset}
                            onChange={(e) => applyDatePreset(e.target.value as any)}
                        >
                            <option value="TODAY">Hoje</option>
                            <option value="WEEK">Esta Semana</option>
                            <option value="MONTH">Este Mês</option>
                            <option value="YEAR">Este Ano</option>
                            <option value="7D">Últimos 7 dias</option>
                            <option value="30D">Últimos 30 dias</option>
                            <option value="90D">Últimos 90 dias</option>
                            <option value="CUSTOM">Personalizado</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-3.5 text-slate-400 pointer-events-none" size={16} />
                    </div>

                    <div className="hidden md:flex flex-wrap gap-2">
                        {[
                            { id: 'TODAY', label: 'Hoje' },
                            { id: 'WEEK', label: 'Esta Semana' },
                            { id: 'MONTH', label: 'Este Mês' },
                            { id: '7D', label: 'Últimos 7 dias' },
                            { id: '30D', label: 'Últimos 30 dias' },
                            { id: '90D', label: 'Últimos 90 dias' },
                            { id: 'YEAR', label: 'Este Ano' }
                        ].map(preset => (
                            <button 
                                key={preset.id}
                                onClick={() => applyDatePreset(preset.id as any)} 
                                className={`px-3 py-1.5 rounded-full text-xs font-bold transition border ${
                                    currentPreset === preset.id 
                                    ? 'bg-neon-blue text-white border-neon-blue' 
                                    : 'bg-slate-700 text-slate-300 border-transparent hover:bg-slate-600'
                                }`}
                            >
                                {preset.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-2 md:flex md:items-center gap-3 pt-2 border-t border-slate-700/50">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-slate-500 font-bold uppercase mb-1">De</span>
                        <input 
                            type="date" 
                            className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-neon-blue outline-none w-full"
                            value={dateRange.start}
                            onChange={e => {
                                setDateRange({...dateRange, start: e.target.value});
                                setAuditFilters(prev => ({ ...prev, startDate: e.target.value }));
                                setCurrentPreset('CUSTOM');
                            }}
                        />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] text-slate-500 font-bold uppercase mb-1">Até</span>
                        <input 
                            type="date" 
                            className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-neon-blue outline-none w-full"
                            value={dateRange.end}
                            onChange={e => {
                                setDateRange({...dateRange, end: e.target.value});
                                setAuditFilters(prev => ({ ...prev, endDate: e.target.value }));
                                setCurrentPreset('CUSTOM');
                            }}
                        />
                    </div>
                    <div className="hidden md:flex items-center text-slate-500 text-xs ml-auto">
                        <CalendarRange size={14} className="mr-1"/> Período Selecionado
                    </div>
                </div>
            </div>
        </div>

        <div className="flex space-x-4 border-b border-slate-700 mb-6 overflow-x-auto no-scrollbar">
            <button onClick={() => setActiveTab('OVERVIEW')} className={`pb-2 px-4 font-medium transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'OVERVIEW' ? 'text-neon-blue border-b-2 border-neon-blue' : 'text-slate-400 hover:text-white'}`}><TrendingUp size={16}/> Visão Geral</button>
            <button onClick={() => setActiveTab('LOGS')} className={`pb-2 px-4 font-medium transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'LOGS' ? 'text-neon-orange border-b-2 border-neon-orange' : 'text-slate-400 hover:text-white'}`}><Shield size={16}/> Auditoria & Logs</button>
        </div>

        {activeTab === 'OVERVIEW' ? (
            <div className="space-y-6 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                    
                    <div className="bg-slate-800 p-4 rounded-xl border border-green-500/30 shadow-lg hover:border-green-500 transition xl:col-span-2">
                         <div className="flex justify-between items-start">
                             <div>
                                 <p className="text-xs text-green-500 font-bold uppercase tracking-wide mb-1">Faturamento Realizado</p>
                                 <h3 className="text-2xl font-bold text-white">{totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3>
                                 <p className="text-[10px] text-slate-500 mt-1">Confirmados & Check-ins</p>
                             </div>
                             <div className="p-2 bg-green-500/10 rounded-lg text-green-500"><DollarSign size={24}/></div>
                         </div>
                    </div>

                    <div className="bg-slate-800 p-4 rounded-xl border border-yellow-500/30 shadow-lg hover:border-yellow-500 transition xl:col-span-2">
                         <div className="flex justify-between items-start">
                             <div>
                                 <p className="text-xs text-yellow-500 font-bold uppercase tracking-wide mb-1">A Receber / Pendente</p>
                                 <h3 className="text-2xl font-bold text-white">{pendingRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3>
                             </div>
                             <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-500"><AlertCircle size={24}/></div>
                         </div>
                    </div>

                     <div className="bg-slate-800 p-4 rounded-xl border border-neon-blue/30 shadow-lg hover:border-neon-blue transition xl:col-span-2">
                         <div className="flex justify-between items-start">
                             <div>
                                 <p className="text-xs text-neon-blue font-bold uppercase tracking-wide mb-1">Ticket Médio (p/ Reserva)</p>
                                 <h3 className="text-2xl font-bold text-white">{avgTicket.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3>
                             </div>
                             <div className="p-2 bg-neon-blue/10 rounded-lg text-neon-blue"><TrendingUp size={24}/></div>
                         </div>
                    </div>

                    <div className="bg-slate-800 p-4 rounded-xl border border-slate-600 shadow-lg xl:col-span-2">
                         <div className="flex justify-between items-start">
                             <div>
                                 <p className="text-xs text-slate-400 font-bold uppercase tracking-wide mb-1">Reservas (Horas Vendidas)</p>
                                 <h3 className="text-2xl font-bold text-white">{confirmedSlotsCount}</h3>
                                 <p className="text-[10px] text-slate-500 mt-1">Soma de Pistas x Horas</p>
                             </div>
                             <div className="p-2 bg-slate-700 rounded-lg text-slate-300"><ListChecks size={24}/></div>
                         </div>
                    </div>

                    <div className="bg-slate-800 p-4 rounded-xl border border-purple-500/30 shadow-lg hover:border-purple-500 transition xl:col-span-2">
                         <div className="flex justify-between items-start">
                             <div>
                                 <p className="text-xs text-purple-400 font-bold uppercase tracking-wide mb-1">Média Diária de Vendas</p>
                                 <h3 className="text-2xl font-bold text-white">{dailyAverage.toFixed(1)} <span className="text-sm font-normal text-slate-400">reservas/dia</span></h3>
                             </div>
                             <div className="p-2 bg-purple-500/10 rounded-lg text-purple-500"><Calculator size={24}/></div>
                         </div>
                    </div>

                    <div className="bg-slate-800 p-4 rounded-xl border border-red-500/30 shadow-lg hover:border-red-500 transition xl:col-span-2">
                         <div className="flex justify-between items-start">
                             <div>
                                 <p className="text-xs text-red-400 font-bold uppercase tracking-wide mb-1">Taxa de Cancelamento</p>
                                 <h3 className="text-2xl font-bold text-white">{cancellationRate.toFixed(1)}%</h3>
                                 <p className="text-[10px] text-slate-500 mt-1">Baseado em reservas perdidas</p>
                             </div>
                             <div className="p-2 bg-red-500/10 rounded-lg text-red-500"><Percent size={24}/></div>
                         </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2"><DollarSign size={20} className="text-green-500"/> Faturamento Diário (Realizado)</h3>
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
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Users size={20} className="text-neon-blue"/> Top 5 Clientes</h3>
                        <div className="flex-1 overflow-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="text-slate-400 border-b border-slate-700"><tr><th className="pb-2">Cliente</th><th className="pb-2 text-right">Qtd Reservas</th><th className="pb-2 text-right">Total</th></tr></thead>
                                <tbody className="divide-y divide-slate-700">
                                    {topClients.map((c, i) => (<tr key={i} className="group hover:bg-slate-700/50"><td className="py-3 font-medium text-white">{c.name}</td><td className="py-3 text-right text-slate-400">{c.slots}</td><td className="py-3 text-right text-neon-green font-bold">{c.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td></tr>))}
                                    {topClients.length === 0 && (<tr><td colSpan={3} className="py-8 text-center text-slate-500">Sem dados no período</td></tr>)}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        ) : (
            <div className="animate-fade-in bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg flex flex-col h-[700px]">
                <div className="mb-4">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-4"><Shield className="text-neon-orange"/> Registro de Atividades (Logs)</h3>
                    <div className="flex flex-col md:flex-row gap-2 bg-slate-900/50 p-3 rounded-lg border border-slate-700">
                        <select className="bg-slate-800 border border-slate-600 rounded text-xs text-white p-2 flex-1 outline-none" value={auditFilters.userId} onChange={e => setAuditFilters({...auditFilters, userId: e.target.value})}><option value="ALL">Todos Usuários</option>{allUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
                        <select className="bg-slate-800 border border-slate-600 rounded text-xs text-white p-2 flex-1 outline-none" value={auditFilters.actionType} onChange={e => setAuditFilters({...auditFilters, actionType: e.target.value})}><option value="ALL">Todas Ações</option><option value="LOGIN">Login</option><option value="CREATE_RESERVATION">Criar Reserva</option><option value="UPDATE_RESERVATION">Atualizar Reserva</option><option value="CREATE_CLIENT">Criar Cliente</option><option value="LOYALTY_UPDATE">Fidelidade</option></select>
                        <button onClick={refreshAuditLogs} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded text-xs font-bold flex items-center gap-2"><History size={14}/> Atualizar</button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                    {auditLogs.length === 0 ? (<div className="text-center text-slate-500 py-10">Nenhuma atividade encontrada com os filtros atuais.</div>) : (auditLogs.map(log => (<div key={log.id} className="relative pl-6 pb-6 border-l border-slate-700 last:border-0 last:pb-0"><div className="absolute left-[-5px] top-0 w-2.5 h-2.5 rounded-full bg-neon-blue border-2 border-slate-800"></div><p className="text-xs text-slate-500 mb-1 flex justify-between"><span>{new Date(log.createdAt).toLocaleString('pt-BR')}</span></p><div className="bg-slate-900/50 p-3 rounded border border-slate-700/50"><p className="text-sm text-white font-bold flex items-center gap-2">{log.userName} <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">{log.actionType}</span></p><p className="text-xs text-slate-400 mt-1">{log.details}</p></div></div>)))}
                </div>
            </div>
        )}
    </div>
  );
};

export default Financeiro;
