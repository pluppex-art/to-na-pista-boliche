
import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../services/mockBackend';
import { Reservation, ReservationStatus, AuditLog, User, PaymentStatus, EventType } from '../types';
import { Loader2, DollarSign, TrendingUp, Users, Calendar, AlertCircle, Shield, History, Calculator, Percent, CalendarRange, ListChecks, ChevronDown, Clock, PieChart as PieIcon, Tag, X, FileText, Ban, CreditCard, Filter } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, Legend } from 'recharts';
import { supabase } from '../services/supabaseClient';

const DATE_PRESETS = [
    { id: 'TODAY', label: 'HOJE' },
    { id: 'WEEK', label: 'ESSA SEMANA' },
    { id: 'MONTH', label: 'ESTE MÊS' },
    { id: '7D', label: '7 DIAS' },
    { id: '30D', label: '30 DIAS' },
    { id: '90D', label: '90 DIAS' },
    { id: 'YEAR', label: 'ANO' }
];

// Mapeamento de cores por tipo de evento
const EVENT_TYPE_COLORS: Record<string, string> = {
    [EventType.JOGO_NORMAL]: '#3b82f6', // Azul Neon
    [EventType.ANIVERSARIO]: '#f97316', // Laranja
    [EventType.EMPRESA]: '#a855f7',    // Roxo
    [EventType.FAMILIA]: '#22c55e',    // Verde
    [EventType.OUTRO]: '#64748b'       // Cinza
};

const Financeiro: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'LOGS'>('OVERVIEW');
  const [loading, setLoading] = useState(true);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [rawReservations, setRawReservations] = useState<Reservation[]>([]);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [currentPreset, setCurrentPreset] = useState<string>('MONTH');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('ALL');

  const [drillDownType, setDrillDownType] = useState<'PENDING' | 'CANCELLED' | null>(null);

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
        const all = await db.reservations.getByDateRange(dateRange.start, dateRange.end);
        setRawReservations(all);
        setReservations(all.filter(r => r.status !== ReservationStatus.CANCELADA));
        setAllUsers(await db.users.getAll());
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

  // REALTIME ATIVADO
  useEffect(() => {
    refreshData();
    const channel = supabase.channel('financeiro-realtime-sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas' }, () => refreshData(true))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_logs' }, () => refreshData(true))
        .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [dateRange]);

  useEffect(() => { refreshAuditLogs(); }, [auditFilters.userId, auditFilters.actionType]); 

  const applyDatePreset = (preset: string) => {
      setCurrentPreset(preset);
      if (preset === 'CUSTOM') return;
      const today = new Date();
      let start = new Date();
      let end = new Date();
      switch(preset) {
          case 'TODAY': start = today; break;
          case '7D': start.setDate(today.getDate() - 6); break;
          case '30D': start.setDate(today.getDate() - 29); break;
          case '90D': start.setDate(today.getDate() - 89); break;
          case 'WEEK': start.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1)); break;
          case 'MONTH': start = new Date(today.getFullYear(), today.getMonth(), 1); end = new Date(today.getFullYear(), today.getMonth() + 1, 0); break;
          case 'YEAR': start = new Date(today.getFullYear(), 0, 1); end = new Date(today.getFullYear(), 11, 31); break;
      }
      const s = toLocalISO(start);
      const e = toLocalISO(end);
      setDateRange({ start: s, end: e });
      setAuditFilters(prev => ({ ...prev, startDate: s, endDate: e }));
  };

  const calculateSlots = (r: Reservation) => (r.laneCount || 1) * Math.ceil(r.duration || 1);

  const realizedReservations = useMemo(() => {
      return reservations.filter(r => {
          const isRealizedStatus = r.status === ReservationStatus.CONFIRMADA || r.status === ReservationStatus.CHECK_IN;
          const isPaid = r.paymentStatus === PaymentStatus.PAGO;
          const matchesMethod = paymentMethodFilter === 'ALL' || r.paymentMethod === paymentMethodFilter;
          return isRealizedStatus && isPaid && matchesMethod;
      });
  }, [reservations, paymentMethodFilter]);

  const pendingReservations = reservations.filter(r => r.status === ReservationStatus.PENDENTE || (r.status !== ReservationStatus.CANCELADA && r.paymentStatus !== PaymentStatus.PAGO));
  const totalRevenue = realizedReservations.reduce((acc, curr) => acc + curr.totalValue, 0);
  const pendingRevenue = pendingReservations.reduce((acc, curr) => acc + curr.totalValue, 0);
  const confirmedSlotsCount = realizedReservations.reduce((acc, r) => acc + calculateSlots(r), 0);
  const avgTicket = confirmedSlotsCount > 0 ? totalRevenue / confirmedSlotsCount : 0;
  
  const diffDays = useMemo(() => {
      if (!dateRange.start || !dateRange.end) return 0;
      const s = new Date(dateRange.start);
      const e = new Date(dateRange.end);
      return Math.ceil(Math.abs(e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }, [dateRange]);
  
  const dailyAverage = diffDays > 0 ? (confirmedSlotsCount / diffDays) : 0;

  const cancelledReservations = rawReservations.filter(r => 
      r.status === ReservationStatus.CANCELADA && 
      r.createdBy && 
      (r.paymentStatus === PaymentStatus.PAGO || r.paymentStatus === PaymentStatus.REEMBOLSADO)
  );
  
  const cancelledSlotsCount = cancelledReservations.reduce((acc, r) => acc + calculateSlots(r), 0);
  const totalRelevantSlots = confirmedSlotsCount + cancelledSlotsCount;
  const cancellationRate = totalRelevantSlots > 0 ? (cancelledSlotsCount / totalRelevantSlots) * 100 : 0;

  const revenueByDayMap = new Map<string, number>();
  realizedReservations.forEach(r => {
      const val = revenueByDayMap.get(r.date) || 0;
      revenueByDayMap.set(r.date, val + r.totalValue);
  });
  const revenueChartData = Array.from(revenueByDayMap.entries())
    .map(([date, value]) => ({ date: date.split('-').slice(1).reverse().join('/'), value }))
    .sort((a,b) => a.date.localeCompare(b.date));

  const revenueByTypeMap = new Map<string, number>();
  realizedReservations.forEach(r => {
      const current = revenueByTypeMap.get(r.eventType || 'NÃO INFORMADO') || 0;
      revenueByTypeMap.set(r.eventType || 'NÃO INFORMADO', current + r.totalValue);
  });
  const revenueByTypeData = Array.from(revenueByTypeMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const revenueByMethodMap = new Map<string, number>();
  realizedReservations.forEach(r => {
      const method = r.paymentMethod || 'OUTRO/ANTERIOR';
      const current = revenueByMethodMap.get(method) || 0;
      revenueByMethodMap.set(method, current + r.totalValue);
  });
  const revenueByMethodData = Array.from(revenueByMethodMap.entries()).map(([name, value]) => ({ name, value }));

  const hoursMap = new Array(24).fill(0);
  realizedReservations.forEach(r => {
      const startH = parseInt(r.time.split(':')[0]);
      for (let i = 0; i < Math.ceil(r.duration); i++) hoursMap[(startH + i) % 24] += (r.laneCount || 1);
  });
  const peakHoursChartData = hoursMap.map((count, hour) => ({ hour: `${hour}:00`, count })).filter(d => d.count > 0 || (parseInt(d.hour) >= 16 || parseInt(d.hour) <= 2));

  const COLORS = ['#22c55e', '#3b82f6', '#f97316', '#a855f7', '#ef4444', '#eab308', '#64748b', '#06b6d4', '#ec4899'];

  const getDrillDownList = () => {
      if (drillDownType === 'PENDING') return pendingReservations;
      if (drillDownType === 'CANCELLED') return cancelledReservations;
      return [];
  };

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-neon-blue" size={48} /></div>;

  return (
    <div className="space-y-6 animate-fade-in pb-20 md:pb-0">
        <div className="flex flex-col gap-4 border-b border-slate-800 pb-6">
            <h1 className="text-3xl font-bold text-white uppercase tracking-tighter">Financeiro</h1>
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs text-slate-400 font-bold uppercase mb-2 block flex items-center gap-2"><CalendarRange size={14}/> Período de Análise</label>
                        <div className="md:hidden relative">
                            <select className="w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg p-3 appearance-none focus:border-neon-blue outline-none font-bold" value={currentPreset} onChange={(e) => applyDatePreset(e.target.value)}>
                                <option value="TODAY">Hoje</option><option value="WEEK">Esta Semana</option><option value="MONTH">Este Mês</option><option value="YEAR">Este Ano</option><option value="7D">Últimos 7 dias</option><option value="30D">Últimos 30 dias</option><option value="90D">Últimos 90 dias</option><option value="CUSTOM">Personalizado</option>
                            </select>
                            <ChevronDown className="absolute right-3 top-3.5 text-slate-400 pointer-events-none" size={16} />
                        </div>
                        <div className="hidden md:flex flex-wrap gap-2">
                            {DATE_PRESETS.map(preset => (<button key={preset.id} onClick={() => applyDatePreset(preset.id)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-widest transition-all border ${currentPreset === preset.id ? 'bg-neon-blue text-white border-neon-blue shadow-lg' : 'bg-slate-700 text-slate-400 border-transparent hover:bg-slate-600'}`}>{preset.label}</button>))}
                        </div>
                    </div>
                    <div>
                        <label className="text-xs text-slate-400 font-bold uppercase mb-2 block flex items-center gap-2"><Filter size={14}/> Filtro por Meio</label>
                        <div className="relative">
                            <select className="w-full bg-slate-900 border border-slate-600 text-white text-sm rounded-lg p-3 appearance-none focus:border-neon-blue outline-none font-bold" value={paymentMethodFilter} onChange={e => setPaymentMethodFilter(e.target.value)}>
                                <option value="ALL">Todos os Meios</option><option value="DINHEIRO">Dinheiro</option><option value="PIX">PIX</option><option value="DEBITO">Cartão Débito</option><option value="CREDITO">Cartão Crédito</option><option value="ONLINE">Online (Mercado Pago)</option><option value="COMANDA">Comanda / Local</option>
                            </select>
                            <CreditCard className="absolute right-3 top-3.5 text-slate-400 pointer-events-none" size={16} />
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-2 md:flex md:items-center gap-3 pt-2 border-t border-slate-700/50">
                    <div className="flex flex-col"><span className="text-[10px] text-slate-500 font-bold uppercase mb-1">De</span><input type="date" className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-neon-blue outline-none w-full font-bold" value={dateRange.start} onChange={e => { setDateRange({...dateRange, start: e.target.value}); setAuditFilters(prev => ({ ...prev, startDate: e.target.value })); setCurrentPreset('CUSTOM'); }}/></div>
                    <div className="flex flex-col"><span className="text-[10px] text-slate-500 font-bold uppercase mb-1">Até</span><input type="date" className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-neon-blue outline-none w-full font-bold" value={dateRange.end} onChange={e => { setDateRange({...dateRange, end: e.target.value}); setAuditFilters(prev => ({ ...prev, endDate: e.target.value })); setCurrentPreset('CUSTOM'); }}/></div>
                </div>
            </div>
        </div>

        <div className="flex space-x-4 border-b border-slate-700 mb-6 overflow-x-auto no-scrollbar">
            <button onClick={() => setActiveTab('OVERVIEW')} className={`pb-2 px-4 font-black uppercase text-xs tracking-widest transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'OVERVIEW' ? 'text-neon-blue border-b-2 border-neon-blue' : 'text-slate-400 hover:text-white'}`}><TrendingUp size={16}/> Visão Geral</button>
            <button onClick={() => setActiveTab('LOGS')} className={`pb-2 px-4 font-black uppercase text-xs tracking-widest transition flex items-center gap-2 whitespace-nowrap ${activeTab === 'LOGS' ? 'text-neon-orange border-b-2 border-neon-orange' : 'text-slate-400 hover:text-white'}`}><Shield size={16}/> Auditoria & Logs</button>
        </div>

        {activeTab === 'OVERVIEW' ? (
            <div className="space-y-6 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                    <div className="bg-slate-800 p-4 rounded-xl border border-green-500/30 shadow-lg hover:border-green-500 transition xl:col-span-2"><div className="flex justify-between items-start"><div><p className="text-[10px] text-green-500 font-black uppercase mb-1 tracking-widest">Faturamento Realizado</p><h3 className="text-2xl font-black text-white">{totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3><p className="text-[8px] text-slate-500 font-bold mt-1 uppercase tracking-tighter">Somente reservas Confirmadas e Pagas</p></div><div className="p-2 bg-green-500/10 rounded-lg text-green-500"><DollarSign size={24}/></div></div></div>
                    <div onClick={() => setDrillDownType('PENDING')} className="bg-slate-800 p-4 rounded-xl border border-yellow-500/30 shadow-lg hover:border-yellow-500 transition xl:col-span-2 cursor-pointer group"><div className="flex justify-between items-start"><div><p className="text-[10px] text-yellow-500 font-black uppercase mb-1 tracking-widest">A Receber / Pendente</p><h3 className="text-2xl font-black text-white">{pendingRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3><p className="text-[8px] text-slate-500 font-bold mt-1 uppercase underline group-hover:text-yellow-400 transition-colors">Clique para ver lista</p></div><div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-500"><AlertCircle size={24}/></div></div></div>
                    <div className="bg-slate-800 p-4 rounded-xl border border-neon-blue/30 shadow-lg hover:border-neon-blue transition xl:col-span-2"><div className="flex justify-between items-start"><div><p className="text-[10px] text-neon-blue font-black uppercase mb-1 tracking-widest">Ticket Médio (H)</p><h3 className="text-2xl font-black text-white">{avgTicket.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3></div><div className="p-2 bg-neon-blue/10 rounded-lg text-neon-blue"><TrendingUp size={24}/></div></div></div>
                    <div className="bg-slate-800 p-4 rounded-xl border border-slate-600 shadow-lg xl:col-span-2"><div className="flex justify-between items-start"><div><p className="text-[10px] text-slate-400 font-black uppercase mb-1 tracking-widest">Horas Vendidas</p><h3 className="text-2xl font-black text-white">{confirmedSlotsCount}</h3></div><div className="p-2 bg-slate-700 rounded-lg text-slate-300"><ListChecks size={24}/></div></div></div>
                    <div className="bg-slate-800 p-4 rounded-xl border border-purple-500/30 shadow-lg hover:border-purple-500 transition xl:col-span-2"><div className="flex justify-between items-start"><div><p className="text-[10px] text-purple-400 font-black uppercase mb-1 tracking-widest">Média Diária</p><h3 className="text-2xl font-black text-white">{dailyAverage.toFixed(1)} <span className="text-sm font-normal text-slate-400 uppercase font-black">res/dia</span></h3></div><div className="p-2 bg-purple-500/10 rounded-lg text-purple-500"><Calculator size={24}/></div></div></div>
                    <div onClick={() => setDrillDownType('CANCELLED')} className="bg-slate-800 p-4 rounded-xl border border-red-500/30 shadow-lg hover:border-red-500 transition xl:col-span-2 cursor-pointer group"><div className="flex justify-between items-start"><div><p className="text-[10px] text-red-400 font-black uppercase mb-1 tracking-widest">Taxa Estorno</p><h3 className="text-2xl font-black text-white">{cancellationRate.toFixed(1)}%</h3><p className="text-[8px] text-slate-500 font-bold mt-1 uppercase underline group-hover:text-red-400 transition-colors">Clique para ver lista</p></div><div className="p-2 bg-red-500/10 rounded-lg text-red-500"><Percent size={24}/></div></div></div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg lg:col-span-2"><h3 className="text-lg font-black text-white mb-6 flex items-center gap-2 uppercase tracking-tighter"><DollarSign size={20} className="text-green-500"/> Evolução do Faturamento no Período</h3><div className="h-80 w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={revenueChartData}><defs><linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/><stop offset="95%" stopColor="#22c55e" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#334155"/><XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tick={{fontWeight: 'bold'}}/><YAxis stroke="#94a3b8" fontSize={12} tick={{fontWeight: 'bold'}}/><Tooltip contentStyle={{backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', fontWeight: 'bold'}} itemStyle={{color: '#fff'}} labelStyle={{color: '#fff'}} formatter={(v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/><Area type="monotone" dataKey="value" name="Valor" stroke="#22c55e" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)"/></AreaChart></ResponsiveContainer></div></div>
                    
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg"><h3 className="text-lg font-black text-white mb-4 flex items-center gap-2 uppercase tracking-tighter"><PieIcon size={20} className="text-neon-orange"/> Receita por Meio de Pagamento</h3><div className="h-80 w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={revenueByMethodData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">{revenueByMethodData.map((e, i) => (<Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]}/>))}</Pie><Tooltip contentStyle={{backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', fontWeight: 'bold'}} itemStyle={{color: '#fff'}} labelStyle={{color: '#fff'}} formatter={(v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/><Legend verticalAlign="bottom" height={36} wrapperStyle={{fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase'}}/></PieChart></ResponsiveContainer></div></div>
                    
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg"><h3 className="text-lg font-black text-white mb-4 flex items-center gap-2 uppercase tracking-tighter"><Tag size={20} className="text-neon-blue"/> Receita por Tipo de Reserva</h3><div className="h-80 w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={revenueByTypeData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">{revenueByTypeData.map((e, i) => (<Cell key={`cell-type-${i}`} fill={EVENT_TYPE_COLORS[e.name] || COLORS[i % COLORS.length]}/>))}</Pie><Tooltip contentStyle={{backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', fontWeight: 'bold'}} itemStyle={{color: '#fff'}} labelStyle={{color: '#fff'}} formatter={(v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/><Legend verticalAlign="bottom" height={36} wrapperStyle={{fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase'}}/></PieChart></ResponsiveContainer></div></div>

                    <div className="lg:col-span-2 bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg"><h3 className="text-lg font-black text-white mb-6 flex items-center gap-2 uppercase tracking-tighter"><Clock size={20} className="text-neon-orange"/> Movimentação por Hora (Ocupação Pistas)</h3><div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={peakHoursChartData}><CartesianGrid strokeDasharray="3 3" stroke="#334155"/><XAxis dataKey="hour" stroke="#94a3b8" fontSize={12} tick={{fontWeight: 'bold'}}/><YAxis stroke="#94a3b8" fontSize={12} tick={{fontWeight: 'bold'}}/><Tooltip contentStyle={{backgroundColor: '#1e293b', border: '1px solid #475569', borderRadius: '8px', fontWeight: 'bold'}} itemStyle={{color: '#fff'}} labelStyle={{color: '#fff'}} cursor={{fill: '#334155', opacity: 0.4}}/><Bar dataKey="count" name="Pistas Ocupadas" fill="#f97316" radius={[4, 4, 0, 0]}/></BarChart></ResponsiveContainer></div></div>
                </div>
            </div>
        ) : (
            <div className="animate-fade-in bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg flex flex-col h-[700px]">
                <div className="mb-4">
                    <h3 className="text-xl font-black text-white flex items-center gap-2 mb-4 uppercase tracking-tighter"><Shield className="text-neon-orange"/> Registro de Auditoria do Sistema</h3>
                    <div className="flex flex-col md:flex-row gap-2 bg-slate-900/50 p-3 rounded-lg border border-slate-700">
                        <select className="bg-slate-800 border border-slate-600 rounded text-xs text-white p-2 flex-1 outline-none font-bold uppercase" value={auditFilters.userId} onChange={e => setAuditFilters({...auditFilters, userId: e.target.value})}><option value="ALL">Todos Usuários</option>{allUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
                        <select className="bg-slate-800 border border-slate-600 rounded text-xs text-white p-2 flex-1 outline-none font-bold uppercase" value={auditFilters.actionType} onChange={e => setAuditFilters({...auditFilters, actionType: e.target.value})}><option value="ALL">Todas Ações</option><option value="LOGIN">Acessos (Login)</option><option value="CREATE_RESERVATION">Novas Reservas</option><option value="UPDATE_RESERVATION">Edições</option><option value="CREATE_CLIENT">Cadastro Clientes</option></select>
                        <button onClick={refreshAuditLogs} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded text-xs font-black uppercase flex items-center gap-2 transition-all"><History size={14}/> Sincronizar</button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">{auditLogs.length === 0 ? (<div className="text-center text-slate-500 py-10 font-bold uppercase tracking-widest text-[10px]">Nenhuma atividade registrada no período.</div>) : (auditLogs.map(log => (<div key={log.id} className="relative pl-6 pb-6 border-l border-slate-700 last:border-0 last:pb-0"><div className="absolute left-[-5px] top-0 w-2.5 h-2.5 rounded-full bg-neon-blue border-2 border-slate-800 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div><p className="text-[10px] text-slate-500 mb-1 flex justify-between font-bold"><span>{new Date(log.createdAt).toLocaleString('pt-BR')}</span></p><div className="bg-slate-900/50 p-3 rounded-xl border border-slate-700/50"><p className="text-sm text-white font-black flex items-center gap-2 uppercase tracking-tighter">{log.userName} <span className="text-[9px] uppercase font-black px-1.5 py-0.5 rounded-md bg-slate-700 text-neon-blue border border-neon-blue/20">{log.actionType}</span></p><p className="text-xs text-slate-400 mt-1 font-medium">{log.details}</p></div></div>)))}</div>
            </div>
        )}

        {drillDownType && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
                <div className="bg-slate-800 border border-slate-600 w-full max-w-2xl rounded-3xl shadow-2xl animate-scale-in flex flex-col max-h-[90vh]">
                    <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-900/50 rounded-t-3xl"><div className="flex items-center gap-4">{drillDownType === 'PENDING' ? (<div className="p-3 bg-yellow-500/10 rounded-2xl text-yellow-500"><AlertCircle size={32}/></div>) : (<div className="p-3 bg-red-500/10 rounded-2xl text-red-500"><Ban size={32}/></div>)}<div><h3 className="text-xl font-black text-white uppercase tracking-tighter leading-none mb-1">{drillDownType === 'PENDING' ? 'Reservas Pendentes' : 'Reservas Canceladas'}</h3><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{getDrillDownList().length} registros encontrados</p></div></div><button onClick={() => setDrillDownType(null)} className="text-slate-400 hover:text-white p-2 transition-colors"><X size={24}/></button></div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar bg-slate-800/50">
                        {getDrillDownList().length === 0 ? (<div className="text-center py-20 text-slate-600 font-black uppercase text-sm italic tracking-widest">Nenhum registro para exibir.</div>) : (getDrillDownList().map(res => (
                            <div key={res.id} className="bg-slate-900/80 border border-slate-700 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-lg group hover:border-slate-500 transition-colors">
                                <div className="flex-1">
                                    <h4 className="font-black text-white uppercase tracking-tight group-hover:text-neon-blue transition-colors">{res.clientName}</h4>
                                    <div className="text-[10px] text-slate-500 font-bold flex items-center gap-3 mt-1 uppercase tracking-widest">
                                        <div className="flex items-center gap-1"><Calendar size={12}/> {res.date.split('-').reverse().join('/')}</div>
                                        <div className="flex items-center gap-1"><Clock size={12}/> {res.time}</div>
                                    </div>
                                    <div className="mt-2 flex items-center gap-2">
                                        <span className="text-[9px] font-black text-slate-400 border border-slate-700 px-2 py-0.5 rounded-md uppercase tracking-tighter bg-slate-800">MEIO: {res.paymentMethod || 'NÃO INF.'}</span>
                                        <span className="text-[9px] font-black text-slate-400 border border-slate-700 px-2 py-0.5 rounded-md uppercase tracking-tighter bg-slate-800">TIPO: {res.eventType}</span>
                                    </div>
                                </div>
                                <div className="text-right flex flex-col items-end gap-1.5 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-700/30">
                                    <span className={`font-black text-xl tracking-tighter ${drillDownType === 'PENDING' ? 'text-yellow-500' : 'text-red-500'}`}>{res.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                    <span className={`text-[9px] px-2 py-0.5 rounded-md font-black uppercase tracking-widest shadow-sm ${res.status === 'Cancelada' ? 'bg-red-600 text-white' : 'bg-yellow-500 text-black'}`}>{res.status}</span>
                                </div>
                            </div>
                        )))}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default Financeiro;
