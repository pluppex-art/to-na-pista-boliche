
import React, { useEffect, useState } from 'react';
import { db } from '../services/mockBackend';
import { Reservation, ReservationStatus, AuditLog, User, PaymentStatus } from '../types';
import { Loader2, DollarSign, TrendingUp, Users, Calendar, AlertCircle, Shield, History, Calculator, Percent, CalendarRange, ListChecks, ChevronDown, Clock, PieChart as PieIcon, Tag, X, FileText, Ban } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, Legend } from 'recharts';
import { supabase } from '../services/supabaseClient';

const Financeiro: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'LOGS'>('OVERVIEW');
  const [loading, setLoading] = useState(true);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [rawReservations, setRawReservations] = useState<Reservation[]>([]);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  
  // Estado visual do preset selecionado (para o Select do Mobile)
  const [currentPreset, setCurrentPreset] = useState<string>('MONTH');

  // Drill Down State (Modal de Detalhes)
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

  // --- CÁLCULOS DE MÉTRICAS (CORRIGIDO PARA RESERVAS POR HORA ARREDONDADA) ---
  
  // Helper para calcular slots de uma reserva (Pistas * Horas arredondadas para cima)
  // Ex: 0.5h = 1 reserva, 1.5h = 2 reservas
  const calculateSlots = (r: Reservation) => (r.laneCount || 1) * Math.ceil(r.duration || 1);

  // 1. Definição do que é "Realizado": CONFIRMADA ou CHECK-IN.
  const realizedReservations = reservations.filter(r => 
      r.status === ReservationStatus.CONFIRMADA || 
      r.status === ReservationStatus.CHECK_IN
  );

  const pendingReservations = reservations.filter(r => 
      r.status === ReservationStatus.PENDENTE
  );

  // Faturamento Realizado
  const totalRevenue = realizedReservations.reduce((acc, curr) => acc + curr.totalValue, 0);
  
  // Faturamento Pendente
  const pendingRevenue = pendingReservations.reduce((acc, curr) => acc + curr.totalValue, 0);

  // Quantidade Realizada (EM SLOTS: Pistas * Horas)
  const confirmedSlotsCount = realizedReservations.reduce((acc, r) => acc + calculateSlots(r), 0);
  
  // Ticket Médio (Agora divide pela quantidade de horas vendidas)
  const avgTicket = confirmedSlotsCount > 0 ? totalRevenue / confirmedSlotsCount : 0;
  
  // Média Diária
  const startD = new Date(dateRange.start);
  const endD = new Date(dateRange.end);
  const diffTime = Math.abs(endD.getTime() - startD.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 
  const dailyAverage = diffDays > 0 ? (confirmedSlotsCount / diffDays) : 0;

  // --- TAXA DE CANCELAMENTO (ESTORNOS DA EQUIPE) ---
  // Filtra reservas que:
  // 1. Estão Canceladas
  // 2. Foram criadas pela equipe (createdBy existe/truthy)
  // 3. Tiveram pagamento confirmado anteriormente (Status PAGO ou REEMBOLSADO)
  // Esta lista é específica para a métrica de "Perda de Venda", mas no drill-down
  // pode ser interessante mostrar todos os cancelamentos relevantes.
  const cancelledReservations = rawReservations.filter(r => 
      r.status === ReservationStatus.CANCELADA && 
      r.createdBy && 
      (r.paymentStatus === PaymentStatus.PAGO || r.paymentStatus === PaymentStatus.REEMBOLSADO)
  );
  
  // Para a base do cálculo, usamos (Realizadas + Canceladas com Estorno)
  // Ignoramos as pendentes que expiraram para não sujar a métrica
  const cancelledSlotsCount = cancelledReservations.reduce((acc, r) => acc + calculateSlots(r), 0);
  const totalRelevantSlots = confirmedSlotsCount + cancelledSlotsCount;

  const cancellationRate = totalRelevantSlots > 0 
      ? (cancelledSlotsCount / totalRelevantSlots) * 100 
      : 0;

  // Gráfico Faturamento (Usando apenas Realizado)
  const revenueByDayMap = new Map<string, number>();
  realizedReservations.forEach(r => {
      const val = revenueByDayMap.get(r.date) || 0;
      revenueByDayMap.set(r.date, val + r.totalValue);
  });
  const revenueChartData = Array.from(revenueByDayMap.entries())
    .map(([date, value]) => ({ date: date.split('-').slice(1).reverse().join('/'), value }))
    .sort((a,b) => a.date.localeCompare(b.date));

  // --- NOVO GRÁFICO: RECEITA POR TIPO DE EVENTO (PIE CHART) ---
  const revenueByTypeMap = new Map<string, number>();
  realizedReservations.forEach(r => {
      const current = revenueByTypeMap.get(r.eventType) || 0;
      revenueByTypeMap.set(r.eventType, current + r.totalValue);
  });
  
  const revenueByTypeData = Array.from(revenueByTypeMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Paleta de Cores Neon/Vibrante para o gráfico
  const COLORS = ['#22c55e', '#3b82f6', '#f97316', '#a855f7', '#ef4444', '#eab308'];

  // --- NOVO GRÁFICO: HORÁRIOS DE PICO (HEATMAP SIMPLIFICADO) ---
  const hoursMap = new Array(24).fill(0);
  
  realizedReservations.forEach(r => {
      const startH = parseInt(r.time.split(':')[0]);
      const duration = Math.ceil(r.duration);
      const lanes = r.laneCount || 1;

      // Adiciona o peso (número de pistas) para cada hora que a reserva ocupa
      for (let i = 0; i < duration; i++) {
          const currentHour = (startH + i) % 24; // Lida com virada de noite se necessário
          hoursMap[currentHour] += lanes;
      }
  });

  // Filtra apenas horas com movimento para o gráfico ficar mais limpo
  // Exibimos das 16h as 02h geralmente, ou dinamicamente onde tem dados
  const peakHoursChartData = hoursMap.map((count, hour) => ({
      hour: `${hour}:00`,
      count: count
  })).filter(d => d.count > 0 || (parseInt(d.hour) >= 16 || parseInt(d.hour) <= 2)); // Mostra pelo menos o horário comercial noturno padrão

  // --- HELPER PARA O DRILL DOWN LIST ---
  const getDrillDownList = () => {
      if (drillDownType === 'PENDING') return pendingReservations;
      if (drillDownType === 'CANCELLED') return cancelledReservations;
      return [];
  };

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-neon-blue" size={48} /></div>;

  return (
    <div className="space-y-6 animate-fade-in pb-20 md:pb-0">
        <div className="flex flex-col gap-4 border-b border-slate-800 pb-6">
            <h1 className="text-3xl font-bold text-white">Financeiro</h1>

            {/* PAINEL DE FILTROS OTIMIZADO MOBILE */}
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col gap-4">
                
                {/* 1. SELETOR DE PRESETS */}
                <div>
                    <label className="text-xs text-slate-400 font-bold uppercase mb-2 block">Período de Análise</label>
                    
                    {/* MOBILE: Dropdown Nativo */}
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

                    {/* DESKTOP: Botões (Mantido pois é bom em telas grandes) */}
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

                {/* 2. INPUTS DE DATA (Grade no mobile para clique fácil) */}
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
                    {/* Botão de atualizar explicito se necessário, ou ícone informativo */}
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
                {/* GRID DE MÉTRICAS */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                    
                    {/* Faturamento */}
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

                    {/* Pendente - CLICKABLE */}
                    <div 
                        onClick={() => setDrillDownType('PENDING')}
                        className="bg-slate-800 p-4 rounded-xl border border-yellow-500/30 shadow-lg hover:border-yellow-500 transition xl:col-span-2 cursor-pointer active:scale-95 hover:bg-slate-700/50"
                    >
                         <div className="flex justify-between items-start">
                             <div>
                                 <p className="text-xs text-yellow-500 font-bold uppercase tracking-wide mb-1">A Receber / Pendente</p>
                                 <h3 className="text-2xl font-bold text-white">{pendingRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3>
                                 <p className="text-[10px] text-slate-500 mt-1 underline">Clique para ver lista</p>
                             </div>
                             <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-500"><AlertCircle size={24}/></div>
                         </div>
                    </div>

                     {/* Ticket Médio */}
                     <div className="bg-slate-800 p-4 rounded-xl border border-neon-blue/30 shadow-lg hover:border-neon-blue transition xl:col-span-2">
                         <div className="flex justify-between items-start">
                             <div>
                                 <p className="text-xs text-neon-blue font-bold uppercase tracking-wide mb-1">Ticket Médio (p/ Reserva)</p>
                                 <h3 className="text-2xl font-bold text-white">{avgTicket.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3>
                             </div>
                             <div className="p-2 bg-neon-blue/10 rounded-lg text-neon-blue"><TrendingUp size={24}/></div>
                         </div>
                    </div>

                    {/* Reservas Totais (Slots) */}
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

                    {/* Média Diária */}
                    <div className="bg-slate-800 p-4 rounded-xl border border-purple-500/30 shadow-lg hover:border-purple-500 transition xl:col-span-2">
                         <div className="flex justify-between items-start">
                             <div>
                                 <p className="text-xs text-purple-400 font-bold uppercase tracking-wide mb-1">Média Diária de Vendas</p>
                                 <h3 className="text-2xl font-bold text-white">{dailyAverage.toFixed(1)} <span className="text-sm font-normal text-slate-400">reservas/dia</span></h3>
                             </div>
                             <div className="p-2 bg-purple-500/10 rounded-lg text-purple-500"><Calculator size={24}/></div>
                         </div>
                    </div>

                    {/* Taxa de Cancelamento - CLICKABLE */}
                    <div 
                        onClick={() => setDrillDownType('CANCELLED')}
                        className="bg-slate-800 p-4 rounded-xl border border-red-500/30 shadow-lg hover:border-red-500 transition xl:col-span-2 cursor-pointer active:scale-95 hover:bg-slate-700/50"
                    >
                         <div className="flex justify-between items-start">
                             <div>
                                 <p className="text-xs text-red-400 font-bold uppercase tracking-wide mb-1">Taxa de Cancelamento</p>
                                 <h3 className="text-2xl font-bold text-white">{cancellationRate.toFixed(1)}%</h3>
                                 <p className="text-[10px] text-slate-500 mt-1 underline">Estornos de equipe (Clique para ver)</p>
                             </div>
                             <div className="p-2 bg-red-500/10 rounded-lg text-red-500"><Percent size={24}/></div>
                         </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* GRÁFICO DE RECEITA - ORDER 1 SEMPRE */}
                    <div className="lg:col-span-2 bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg order-1">
                        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2"><DollarSign size={20} className="text-green-500"/> Faturamento Diário (Realizado)</h3>
                        <div className="h-80 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={revenueChartData}>
                                    <defs>
                                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                                    <YAxis stroke="#94a3b8" fontSize={12} />
                                    <Tooltip contentStyle={{backgroundColor: '#1e293b', border: '1px solid #475569', color: '#fff'}} itemStyle={{color: '#22c55e'}} />
                                    <Area type="monotone" dataKey="value" name="Valor (R$)" stroke="#22c55e" fillOpacity={1} fill="url(#colorRevenue)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* RECEITA POR TIPO DE EVENTO - ORDER 2 (DESKTOP E MOBILE) */}
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg flex flex-col order-2">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Tag size={20} className="text-neon-blue"/> Origem da Receita</h3>
                        <div className="flex-1 min-h-[300px] relative">
                            {revenueByTypeData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={revenueByTypeData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {revenueByTypeData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="rgba(0,0,0,0.2)" />
                                            ))}
                                        </Pie>
                                        <Tooltip 
                                            contentStyle={{backgroundColor: '#1e293b', border: '1px solid #475569', color: '#fff', borderRadius: '8px'}}
                                            itemStyle={{color: '#fff'}}
                                            formatter={(value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        />
                                        <Legend 
                                            verticalAlign="bottom" 
                                            height={36}
                                            iconType="circle"
                                            formatter={(value, entry: any) => <span className="text-slate-300 text-xs ml-1">{value}</span>}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex h-full items-center justify-center text-slate-500 italic text-sm">Sem dados para o período</div>
                            )}
                        </div>
                    </div>

                    {/* NOVO GRÁFICO: HORÁRIOS DE PICO - ORDER 3 */}
                    <div className="lg:col-span-3 bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg order-3">
                        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                            <Clock size={20} className="text-neon-orange"/> Horários de Pico (Volume de Pistas)
                        </h3>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={peakHoursChartData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                    <XAxis dataKey="hour" stroke="#94a3b8" fontSize={12} />
                                    <YAxis stroke="#94a3b8" fontSize={12} />
                                    <Tooltip 
                                        contentStyle={{backgroundColor: '#1e293b', border: '1px solid #475569', color: '#fff'}} 
                                        cursor={{fill: '#334155', opacity: 0.4}}
                                    />
                                    <Bar 
                                        dataKey="count" 
                                        name="Pistas Vendidas" 
                                        fill="#f97316" 
                                        radius={[4, 4, 0, 0]} 
                                        barSize={40}
                                    />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <p className="text-xs text-slate-500 mt-2 text-center">
                            * Contabiliza o número total de pistas ocupadas por hora no período selecionado.
                        </p>
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

        {/* MODAL DE DRILL DOWN (LISTAGEM DETALHADA) */}
        {drillDownType && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                <div className="bg-slate-800 border border-slate-600 w-full max-w-2xl rounded-2xl shadow-2xl animate-scale-in flex flex-col max-h-[90vh]">
                    <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            {drillDownType === 'PENDING' ? (
                                <AlertCircle className="text-yellow-500" size={24} />
                            ) : (
                                <Ban className="text-red-500" size={24} />
                            )}
                            <div>
                                <h3 className="text-xl font-bold text-white">
                                    {drillDownType === 'PENDING' ? 'Reservas Pendentes' : 'Reservas Canceladas (Estornos)'}
                                </h3>
                                <p className="text-xs text-slate-400">
                                    {getDrillDownList().length} registros encontrados no período
                                </p>
                            </div>
                        </div>
                        <button onClick={() => setDrillDownType(null)} className="text-slate-400 hover:text-white"><X size={20}/></button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {getDrillDownList().length === 0 ? (
                            <div className="text-center py-10 text-slate-500">Nenhum registro encontrado.</div>
                        ) : (
                            getDrillDownList().map(res => (
                                <div key={res.id} className="bg-slate-900/50 border border-slate-700 p-4 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                    <div>
                                        <h4 className="font-bold text-white">{res.clientName}</h4>
                                        <div className="text-xs text-slate-400 flex items-center gap-2 mt-1">
                                            <Calendar size={12}/> {res.date.split('-').reverse().join('/')}
                                            <Clock size={12}/> {res.time}
                                        </div>
                                        {res.observations && (
                                            <p className="text-[10px] text-slate-500 mt-2 italic max-w-sm truncate">{res.observations}</p>
                                        )}
                                    </div>
                                    <div className="text-right flex flex-col items-end">
                                        <span className={`font-bold text-lg ${drillDownType === 'PENDING' ? 'text-yellow-500' : 'text-red-500'}`}>
                                            {res.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </span>
                                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase mt-1 ${
                                            res.status === 'Cancelada' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                                        }`}>
                                            {res.status}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default Financeiro;
