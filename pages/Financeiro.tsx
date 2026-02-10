
import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/mockBackend';
import { Reservation, ReservationStatus, User, PaymentStatus, EventType } from '../types';
import { Loader2, CalendarRange, X, CreditCard, ChevronDown, TrendingUp, RefreshCw, Check, Filter, Maximize2, Minimize2 } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { useApp } from '../contexts/AppContext';

// Componentes Individuais
import { SummaryCards } from '../components/Financeiro/SummaryCards';
import { OccupancyCharts } from '../components/Financeiro/OccupancyCharts';
import { RevenueEvolutionChart } from '../components/Financeiro/RevenueEvolutionChart';
import { RevenueByOriginChart } from '../components/Financeiro/RevenueByOriginChart';
import { RevenueByMethodChart } from '../components/Financeiro/RevenueByMethodChart';
import { RevenueByTypeChart } from '../components/Financeiro/RevenueByTypeChart';
import { EngagementFunnelChart } from '../components/Financeiro/EngagementFunnelChart';

const DATE_PRESETS = [
    { id: 'HOJE', label: 'HOJE' },
    { id: 'ONTEM', label: 'ONTEM' },
    { id: '7D', label: 'ÚLTIMOS 7 DIAS' },
    { id: '30D', label: 'ÚLTIMOS 30 DIAS' },
    { id: '60D', label: 'ÚLTIMOS 60 DIAS' },
    { id: '90D', label: 'ÚLTIMOS 90 DIAS' },
    { id: 'WEEK', label: 'ESTA SEMANA' },
    { id: 'MONTH', label: 'ESSE MÊS' },
    { id: 'YEAR', label: 'ESSE ANO' }
];

const Financeiro: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [backgroundLoading, setBackgroundLoading] = useState(false);
  const [rawReservations, setRawReservations] = useState<Reservation[]>([]);
  const [analyticsData, setAnalyticsData] = useState({ visits: 0, clicks: 0, bookingStarts: 0, conversions: 0 });
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [currentPreset, setCurrentPreset] = useState<string>('MONTH');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('ALL');
  const [drillDownType, setDrillDownType] = useState<'PENDING' | 'CANCELLED' | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const { settings } = useApp();

  const toLocalISO = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    if (!dateRange.start) {
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        setDateRange({ start: toLocalISO(firstDay), end: toLocalISO(lastDay) });
    }
  }, []);

  const refreshData = async (isSilent = false) => {
    if (!dateRange.start || !dateRange.end) return;
    
    if (rawReservations.length === 0) setLoading(true);
    else if (!isSilent) setBackgroundLoading(true);

    try {
        const startTimestamp = `${dateRange.start}T00:00:00`;
        const endTimestamp = `${dateRange.end}T23:59:59`;

        const [resData, usersData, visitsCount, clicksCount] = await Promise.all([
            db.reservations.getByDateRange(dateRange.start, dateRange.end),
            db.users.getAll(),
            // Agregações de Analytics
            supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('event_name', 'visit_home').gte('created_at', startTimestamp).lte('created_at', endTimestamp),
            supabase.from('analytics_events').select('*', { count: 'exact', head: true }).eq('event_name', 'click_reserve_cta').gte('created_at', startTimestamp).lte('created_at', endTimestamp),
        ]);

        // NOVA LÓGICA DO FUNIL:
        // Passo 3: Contar quantas reservas foram criadas pelo site (sem createdBy) no período.
        const createdOnSite = (resData || []).filter(r => !r.createdBy).length;
        
        // Passo 4: Contar quantas dessas reservas do site foram pagas.
        const conversions = (resData || []).filter(r => !r.createdBy && r.status !== ReservationStatus.CANCELADA && r.paymentStatus === PaymentStatus.PAGO).length;

        setRawReservations(resData || []);
        setAllUsers(usersData || []);
        setAnalyticsData({
            visits: visitsCount.count || 0,
            clicks: clicksCount.count || 0,
            bookingStarts: createdOnSite, // Agora representa ações reais de criação
            conversions: conversions
        });
    } finally { 
        setLoading(false); 
        setBackgroundLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
    const channel = supabase.channel('financeiro-focus')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas' }, () => refreshData(true))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'analytics_events' }, () => refreshData(true))
        .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [dateRange]);

  const handlePresetChange = (presetId: string) => {
    setCurrentPreset(presetId);
    const today = new Date();
    let start = new Date();
    let end = new Date();
    
    switch(presetId) {
        case 'HOJE': break;
        case 'ONTEM': start.setDate(today.getDate() - 1); end.setDate(today.getDate() - 1); break;
        case '7D': start.setDate(today.getDate() - 6); break;
        case '30D': start.setDate(today.getDate() - 29); break;
        case '60D': start.setDate(today.getDate() - 59); break;
        case '90D': start.setDate(today.getDate() - 89); break;
        case 'WEEK': start.setDate(today.getDate() - today.getDay()); break;
        case 'MONTH': start = new Date(today.getFullYear(), today.getMonth(), 1); end = new Date(today.getFullYear(), today.getMonth() + 1, 0); break;
        case 'YEAR': start = new Date(today.getFullYear(), 0, 1); end = new Date(today.getFullYear(), 11, 31); break;
    }
    setDateRange({ start: toLocalISO(start), end: toLocalISO(end) });
  };

  const realizedReservations = useMemo(() => {
      return rawReservations.filter(r => {
          const isRealized = r.status === ReservationStatus.CONFIRMADA || r.status === ReservationStatus.CHECK_IN;
          const isPaid = r.paymentStatus === PaymentStatus.PAGO;
          const matchesMethod = paymentMethodFilter === 'ALL' || r.paymentMethod === paymentMethodFilter;
          return isRealized && isPaid && matchesMethod;
      });
  }, [rawReservations, paymentMethodFilter]);

  const metrics = useMemo(() => {
    const totalRev = realizedReservations.reduce((acc, r) => acc + r.totalValue, 0);
    const pendingRev = rawReservations.filter(r => r.status === ReservationStatus.PENDENTE || (r.status !== ReservationStatus.CANCELADA && r.paymentStatus !== PaymentStatus.PAGO)).reduce((acc, r) => acc + r.totalValue, 0);
    const totalHrs = realizedReservations.reduce((acc, r) => acc + (r.laneCount * r.duration), 0);
    const startDate = new Date(dateRange.start + 'T00:00:00');
    const endDate = new Date(dateRange.end + 'T00:00:00');
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    const cancelledLossReservations = rawReservations.filter(r => r.status === ReservationStatus.CANCELADA && (r.createdBy || r.paymentStatus === PaymentStatus.REEMBOLSADO));
    const cancelledCount = cancelledLossReservations.length;
    const totalMeaningfulReservations = rawReservations.length || 1;
    
    return { 
        totalRev, pendingRev, totalHrs, 
        avgTicket: totalHrs > 0 ? totalRev / totalHrs : 0, 
        avgDaily: diffDays > 0 ? totalHrs / diffDays : 0,
        cancelRate: (cancelledCount / totalMeaningfulReservations) * 100 
    };
  }, [realizedReservations, rawReservations, dateRange]);

  const occupancyStats = useMemo(() => {
    if (!dateRange.start || !dateRange.end || !settings) return { totalCapacity: 0, occupiedTotal: 0, percentage: 0, byDay: [], byHour: [] };
    let totalCapacity = 0;
    const capacityByDay = new Array(7).fill(0);
    const occupiedByDay = new Array(7).fill(0);
    const capByHour = new Map<number, number>();
    const occByHour = new Map<number, number>();
    const start = new Date(dateRange.start + 'T00:00:00');
    const end = new Date(dateRange.end + 'T23:59:59');
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dayIdx = d.getDay();
        const config = settings.businessHours[dayIdx];
        if (config.isOpen) {
            let startH = Number(config.start);
            let endH = Number(config.end) === 0 ? 24 : Number(config.end);
            for (let h = startH; h < endH; h++) {
                const key = h % 24;
                capByHour.set(key, (capByHour.get(key) || 0) + settings.activeLanes);
                totalCapacity += settings.activeLanes;
                capacityByDay[dayIdx] += settings.activeLanes;
            }
        }
    }
    realizedReservations.forEach(r => {
        const dayIdx = new Date(r.date + 'T00:00:00').getDay();
        const startH = parseInt(r.time.split(':')[0]);
        occupiedByDay[dayIdx] += (r.laneCount * r.duration);
        for (let i = 0; i < r.duration; i++) {
            const h = (startH + i) % 24;
            occByHour.set(h, (occByHour.get(h) || 0) + r.laneCount);
        }
    });
    return { 
        totalCapacity, occupiedTotal: realizedReservations.reduce((acc, r) => acc + (r.laneCount * r.duration), 0), 
        percentage: totalCapacity > 0 ? (realizedReservations.reduce((acc, r) => acc + (r.laneCount * r.duration), 0) / totalCapacity) * 100 : 0, 
        byDay: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((name, i) => ({ name, porcentagem: capacityByDay[i] > 0 ? Math.round((occupiedByDay[i] / capacityByDay[i]) * 100) : 0 })), 
        byHour: Array.from(capByHour.keys()).sort((a,b) => a-b).map(h => ({ hora: `${String(h).padStart(2,'0')}:00`, porcentagem: Math.round(((occByHour.get(h) || 0) / capByHour.get(h)!) * 100) })) 
    };
  }, [dateRange, settings, realizedReservations]);

  const financialData = useMemo(() => {
    const trendMap = new Map<string, number>();
    const originMap = new Map<string, number>();
    const methodMap = new Map<string, number>();
    const typeMap = new Map<string, number>();
    realizedReservations.forEach(r => {
        const dateKey = r.date.split('-').slice(1).reverse().join('/');
        trendMap.set(dateKey, (trendMap.get(dateKey) || 0) + r.totalValue);
        const origin = r.createdBy ? (allUsers.find(u => u.id === r.createdBy)?.name.toUpperCase() || "EQUIPE") : "SITE";
        originMap.set(origin, (originMap.get(origin) || 0) + r.totalValue);
        methodMap.set(r.paymentMethod || 'OUTRO', (methodMap.get(r.paymentMethod || 'OUTRO') || 0) + r.totalValue);
        typeMap.set(r.eventType || 'N/I', (typeMap.get(r.eventType || 'N/I') || 0) + r.totalValue);
    });
    return { trend: Array.from(trendMap.entries()).map(([date, value]) => ({ date, value })).sort((a,b) => a.date.localeCompare(b.date)), origin: Array.from(originMap.entries()).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value), method: Array.from(methodMap.entries()).map(([name, value]) => ({ name, value })), type: Array.from(typeMap.entries()).map(([name, value]) => ({ name, value })) };
  }, [realizedReservations, allUsers]);

  const toggleFullScreen = () => {
    if (!isFullScreen) {
      document.documentElement.requestFullscreen().catch(err => console.warn(err));
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
    setIsFullScreen(!isFullScreen);
  };

  useEffect(() => {
    const handleFsChange = () => {
      if (!document.fullscreenElement) setIsFullScreen(false);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-neon-blue" size={48} /></div>;

  return (
    <div className={isFullScreen ? "fixed inset-0 z-[200] bg-neon-bg p-6 md:p-10 overflow-y-auto custom-scrollbar animate-fade-in" : "space-y-8 animate-fade-in pb-20 md:pb-0"}>
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 border-b border-slate-800 pb-8">
            <div className="flex items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                        <TrendingUp className="text-neon-green"/> Dashboard Financeiro
                    </h1>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Gestão de Receita e Ocupação</p>
                </div>
                {backgroundLoading && <RefreshCw size={20} className="text-neon-blue animate-spin mt-2" />}
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                {/* Botão de Modo Foco */}
                <button 
                  onClick={toggleFullScreen}
                  className="w-full sm:w-auto bg-slate-900 border border-slate-700 rounded-2xl p-3 flex items-center justify-center gap-3 hover:border-neon-green transition group shadow-xl"
                  title={isFullScreen ? "Sair" : "Ativar"}
                >
                    <div className={`p-2 rounded-lg ${isFullScreen ? 'bg-neon-green/20 text-neon-green' : 'bg-slate-800 text-slate-400'} group-hover:bg-neon-green group-hover:text-white transition-all`}>
                      {isFullScreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    </div>
                    <span className="text-white font-black text-[10px] uppercase tracking-widest">{isFullScreen ? 'Sair' : ''}</span>
                </button>

                <button onClick={() => setIsDateModalOpen(true)} className="w-full sm:w-auto bg-slate-900 border border-slate-700 rounded-2xl p-3 flex items-center justify-between gap-6 hover:border-neon-blue transition group shadow-xl">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-neon-blue/10 rounded-lg text-neon-blue group-hover:bg-neon-blue group-hover:text-white transition-all"><CalendarRange size={16} /></div>
                        <div className="text-left">
                            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Período</p>
                            <p className="text-white font-black text-[10px] uppercase truncate">{dateRange.start.split('-').reverse().join('/')} - {dateRange.end.split('-').reverse().join('/')}</p>
                        </div>
                    </div>
                    <ChevronDown size={14} className="text-slate-500" />
                </button>

                <div className="w-full sm:w-auto bg-slate-900 border border-slate-700 rounded-2xl p-1.5 flex items-center shadow-xl">
                    <div className="pl-3 pr-1 flex items-center gap-2 text-neon-green"><CreditCard size={16} /></div>
                    <select value={paymentMethodFilter} onChange={e => setPaymentMethodFilter(e.target.value)} className="bg-transparent text-white font-black uppercase text-[8px] outline-none cursor-pointer p-2 pr-8 appearance-none">
                        <option value="ALL">TODOS OS MEIOS</option>
                        <option value="PIX">PIX</option>
                        <option value="CREDITO">CRÉDITO</option>
                        <option value="DEBITO">DÉBITO</option>
                        <option value="DINHEIRO">DINHEIRO</option>
                        <option value="ONLINE">SITE (MP)</option>
                        <option value="COMANDA">COMANDA</option>
                    </select>
                    <div className="relative -ml-6 pointer-events-none pr-2"><ChevronDown size={12} className="text-slate-500" /></div>
                </div>
            </div>
        </div>

        <div className="space-y-12 animate-fade-in relative">
            <SummaryCards totalRevenue={metrics.totalRev} pendingRevenue={metrics.pendingRev} avgTicket={metrics.avgTicket} avgDaily={metrics.avgDaily} totalHours={metrics.totalHrs} cancellationRate={metrics.cancelRate} onDrillDown={setDrillDownType} />
            
            <OccupancyCharts stats={occupancyStats} />
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-12"><RevenueByOriginChart data={financialData.origin} /></div>
                <div className="lg:col-span-6"><RevenueByMethodChart data={financialData.method} colors={['#22c55e', '#3b82f6', '#f97316', '#a855f7', '#ef4444', '#eab308']} /></div>
                <div className="lg:col-span-6"><RevenueByTypeChart data={financialData.type} typeColors={{'Jogo normal': '#3b82f6', 'Aniversário': '#f97316', 'Empresa': '#a855f7', 'Família': '#22c55e'}} fallbackColors={['#22c55e', '#3b82f6']} /></div>
            </div>

            {/* Funil e Evolução por último */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <EngagementFunnelChart data={analyticsData} />
                <RevenueEvolutionChart data={financialData.trend} />
            </div>
        </div>

        {isDateModalOpen && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
                <div className="bg-slate-800 border border-slate-600 w-full max-w-lg rounded-[2.5rem] shadow-2xl animate-scale-in flex flex-col overflow-hidden">
                    <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
                        <h3 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-3"><CalendarRange className="text-neon-blue" /> Selecionar Período</h3>
                        <button onClick={() => setIsDateModalOpen(false)} className="text-slate-400 hover:text-white transition"><X size={24}/></button>
                    </div>
                    <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Atalhos Rápidos</label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {DATE_PRESETS.map(preset => (
                                    <button key={preset.id} onClick={() => handlePresetChange(preset.id)} className={`p-3 rounded-xl text-[10px] font-black uppercase transition-all border ${currentPreset === preset.id ? 'bg-neon-blue border-neon-blue text-white shadow-lg' : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500'}`}>{preset.label}</button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-4 pt-6 border-t border-slate-700/50">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] ml-1">Intervalo Personalizado</label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5"><label className="text-[9px] font-bold text-slate-600 uppercase ml-1">De:</label><input type="date" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3.5 text-white font-bold text-xs" value={dateRange.start} onChange={e => { setCurrentPreset('CUSTOM'); setDateRange(prev => ({...prev, start: e.target.value})); }} /></div>
                                <div className="space-y-1.5"><label className="text-[9px] font-bold text-slate-600 uppercase ml-1">Até:</label><input type="date" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3.5 text-white font-bold text-xs" value={dateRange.end} onChange={e => { setCurrentPreset('CUSTOM'); setDateRange(prev => ({...prev, end: e.target.value})); }} /></div>
                            </div>
                        </div>
                    </div>
                    <div className="p-6 bg-slate-900/50 border-t border-slate-700"><button onClick={() => setIsDateModalOpen(false)} className="w-full py-4 bg-neon-blue hover:bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl transition flex items-center justify-center gap-2"><Check size={18}/> APLICAR FILTRO</button></div>
                </div>
            </div>
        )}
    </div>
  );
};

export default Financeiro;
