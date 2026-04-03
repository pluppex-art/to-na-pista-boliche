
import React, { useEffect, useState, useMemo } from 'react';
import { db, cleanPhone } from '../../services/mockBackend';
import { Client, Reservation, FunnelStageConfig, User, UserRole, ReservationStatus, PaymentStatus, LoyaltyTransaction, Interaction } from '../../types';
import { 
    Loader2, Settings, Crown, Star, MessageCircle, MoreHorizontal, 
    RefreshCw, Trash2, Plus, ChevronUp, ChevronDown, TrendingUp, 
    TrendingDown, Target, Users, Award, Activity, BarChart3, PieChart, X, CalendarRange, HandCoins, DollarSign
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import ClientDetailsPanel from './ClientDetailsPanel';
import { useApp } from '../../contexts/AppContext';

type ClientTier = 'VIP' | 'FIEL' | 'NOVO';

interface FunnelProps {
  viewMode: 'KANBAN' | 'DASHBOARD';
}

const Funnel: React.FC<FunnelProps> = ({ viewMode }) => {
  const navigate = useNavigate();
  const { settings } = useApp();
  
  // Dados Principais
  const [clients, setClients] = useState<Client[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientHistory, setClientHistory] = useState<Reservation[]>([]);
  const [clientMetrics, setClientMetrics] = useState<Record<string, { count: number, tier: ClientTier }>>({});
  
  const [funnelStages, setFunnelStages] = useState<FunnelStageConfig[]>([]);
  const [loyaltyHistory, setLoyaltyHistory] = useState<LoyaltyTransaction[]>([]);
  const [historicalRevenue, setHistoricalRevenue] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loadingLoyalty, setLoadingLoyalty] = useState(false);
  const [detailTab, setDetailTab] = useState<'INFO' | 'LOYALTY' | 'NOTES'>('INFO');

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Client>>({});
  const [isUpdatingStage, setIsUpdatingStage] = useState(false);
  const [showFunnelSettings, setShowFunnelSettings] = useState(false);

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  useEffect(() => {
    const stored = localStorage.getItem('tonapista_auth');
    if (stored) setCurrentUser(JSON.parse(stored));
  }, []);

  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const canEditClient = isAdmin || currentUser?.perm_edit_client;
  const canCreateReservation = isAdmin || currentUser?.perm_create_reservation;

  const [isSyncing, setIsSyncing] = useState(false);

  const performanceMetrics = useMemo(() => {
    const currentMonth = selectedMonth;
    const currentYear = selectedYear;
    
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    // 1. Carrinhos Recuperados
    const recoveredThisMonth = reservations.filter(r => {
        if (!r.recoveredAt) return false;
        const d = new Date(r.recoveredAt);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const totalRecoveredValue = recoveredThisMonth.reduce((acc, r) => acc + r.totalValue, 0);

    const recoveredLastMonth = reservations.filter(r => {
        if (!r.recoveredAt) return false;
        const d = new Date(r.recoveredAt);
        return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
    });
    const totalRecoveredValueLastMonth = recoveredLastMonth.reduce((acc, r) => acc + r.totalValue, 0);

    const recoveryGrowth = totalRecoveredValueLastMonth > 0 
        ? ((totalRecoveredValue - totalRecoveredValueLastMonth) / totalRecoveredValueLastMonth) * 100 
        : 100;

    // 2. NPS Geral
    const interactionsWithNps = interactions.filter(i => i.npsScore !== undefined && i.npsScore !== null);
    const avgNps = interactionsWithNps.length > 0 
        ? interactionsWithNps.reduce((acc, i) => acc + (i.npsScore || 0), 0) / interactionsWithNps.length 
        : 0;
    const npsCount = interactionsWithNps.length;

    // 3. Clientes Reativados
    const prospectingInteractions = interactions.filter(i => i.isProspecting);
    const reactivatedClients = new Set();
    
    prospectingInteractions.forEach(i => {
        // Busca reservas anteriores a este contato para ver se ele estava "sumido"
        const previousReservations = reservations.filter(r => 
            r.clientId === i.clientId && 
            new Date(r.date) < new Date(i.createdAt) &&
            r.status !== ReservationStatus.CANCELADA
        ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const lastVisit = previousReservations.length > 0 ? new Date(previousReservations[0].date) : null;
        const diffDays = lastVisit ? (new Date(i.createdAt).getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24) : 999;

        if (diffDays > 7) {
            const newReservations = reservations.filter(r => 
                r.clientId === i.clientId && 
                new Date(r.createdAt) > new Date(i.createdAt) &&
                r.status !== ReservationStatus.CANCELADA
            );
            if (newReservations.length > 0) {
                reactivatedClients.add(i.clientId);
            }
        }
    });

    // 4. Comparativo de Faturamento (Mês Selecionado vs Ano Anterior)
    const today = new Date();
    const isCurrentMonth = today.getMonth() === currentMonth && today.getFullYear() === currentYear;
    const currentDay = isCurrentMonth ? today.getDate() : new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    // Tenta encontrar faturamento histórico para o mês/ano selecionado (ex: se selecionou 2025)
    const currentHistoricalMatch = historicalRevenue.find(h => {
        const hMes = h.mes || h.Mes || h.month || h.Month;
        const hAno = h.ano || h.Ano || h.year || h.Year;
        return Number(hMes) === (currentMonth + 1) && Number(hAno) === currentYear;
    });
    
    let currentMonthRevenue = 0;
    
    if (currentHistoricalMatch) {
        // Se existe no histórico, usamos o valor de lá (ex: Jan-Nov 2025)
        const hValue = currentHistoricalMatch.valor_arrecadado || currentHistoricalMatch.Valor_Arrecadado || currentHistoricalMatch.valor || currentHistoricalMatch.amount;
        currentMonthRevenue = Number(hValue);
    } else {
        // Caso contrário, calculamos das reservas atuais do sistema
        const currentMonthReservations = reservations.filter(r => {
            const dateParts = r.date.split('-');
            if (dateParts.length !== 3) return false;
            const y = parseInt(dateParts[0]);
            const m = parseInt(dateParts[1]);
            const isThisMonth = (m - 1) === currentMonth && y === currentYear;
            const isRealized = r.status === ReservationStatus.CONFIRMADA || r.status === ReservationStatus.CHECK_IN;
            const isPaid = r.paymentStatus === PaymentStatus.PAGO;
            return isThisMonth && isRealized && isPaid;
        });
        currentMonthRevenue = currentMonthReservations.reduce((acc, r) => acc + r.totalValue, 0);
    }

    // Projeção: (Faturamento Atual / Dias Decorridos) * Total de Dias no Mês
    // Se for um mês passado, a projeção é o próprio faturamento realizado
    const elapsedDays = Math.max(1, currentDay);
    const revenueProjection = isCurrentMonth 
        ? (currentMonthRevenue / elapsedDays) * daysInMonth 
        : currentMonthRevenue;

    const prevYear = currentYear - 1;
    const historicalMatch = historicalRevenue.find(h => {
        const hMes = h.mes || h.Mes || h.month || h.Month;
        const hAno = h.ano || h.Ano || h.year || h.Year;
        return Number(hMes) === (currentMonth + 1) && Number(hAno) === prevYear;
    });
    
    const hPrevValue = historicalMatch ? (historicalMatch.valor_arrecadado || historicalMatch.Valor_Arrecadado || historicalMatch.valor || historicalMatch.amount) : 0;
    const previousYearRevenue = Number(hPrevValue);

    const revenueGrowth = previousYearRevenue > 0 
        ? ((currentMonthRevenue - previousYearRevenue) / previousYearRevenue) * 100 
        : 100;
    
    const projectionGrowth = previousYearRevenue > 0
        ? ((revenueProjection - previousYearRevenue) / previousYearRevenue) * 100
        : 100;

    // 5. Metas e Capacidade
    let maxCapacityHours = 0;
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(currentYear, currentMonth, d);
        const dayOfWeek = date.getDay(); // 0-6
        const config = settings.businessHours[dayOfWeek];
        if (config && config.isOpen) {
            const startH = config.start;
            const endH = config.end === 0 ? 24 : config.end;
            maxCapacityHours += (endH - startH) * settings.activeLanes;
        }
    }

    const totalSoldHours = reservations.filter(r => {
        const dateParts = r.date.split('-');
        if (dateParts.length !== 3) return false;
        const y = parseInt(dateParts[0]);
        const m = parseInt(dateParts[1]);
        return (m - 1) === currentMonth && y === currentYear && r.status !== ReservationStatus.CANCELADA;
    }).reduce((acc, r) => acc + (r.duration * r.laneCount), 0);

    const capacityPercentage = maxCapacityHours > 0 ? (totalSoldHours / maxCapacityHours) * 100 : 0;
    const goalPercentage = 70; // Meta de 70%
    const goalHours = maxCapacityHours * (goalPercentage / 100);

    // 6. Comissão Pluppex
    const revenueDiff = currentMonthRevenue - previousYearRevenue;
    const pluppexCommission = revenueDiff > 0 ? revenueDiff * 0.1 : 0;

    return {
        totalRecoveredValue,
        recoveryGrowth,
        avgNps,
        npsCount,
        reactivatedCount: reactivatedClients.size,
        currentMonthRevenue,
        previousYearRevenue,
        revenueGrowth,
        revenueProjection,
        projectionGrowth,
        revenueDiff,
        pluppexCommission,
        maxCapacityHours,
        totalSoldHours,
        capacityPercentage,
        goalPercentage,
        goalHours
    };
  }, [reservations, interactions, historicalRevenue, selectedMonth, selectedYear, settings]);

  const handleSyncFunnel = async () => {
    if (!isAdmin) return;
    if (!window.confirm(`Deseja iniciar a Sincronização Inteligente? O banco de dados processará todos os ${clients.length} contatos e milhares de reservas instantaneamente.`)) return;
    
    setIsSyncing(true);
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            alert("Sessão expirada. Por favor, faça login novamente.");
            return;
        }

        await db.clients.syncFunnel();
        alert(`Sincronização concluída com sucesso pelo servidor! O CRM foi atualizado.`);
        fetchData();
    } catch (e: any) {
        console.error("Erro ao sincronizar funil:", e);
        alert(`Erro ao sincronizar funil: ${e.message || 'Erro desconhecido'}. Verifique se a função 'sync_all_funnel_stages' existe no Supabase.`);
    } finally {
        setIsSyncing(false);
    }
  };

  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({});

  const showMore = (stageName: string) => {
    setVisibleCounts(prev => ({
      ...prev,
      [stageName]: (prev[stageName] || 50) + 100
    }));
  };

  const fetchData = async () => {
    setLoading(true);
    try {
        const { data: clientsData } = await db.clients.getAll(); 
        const [reservationsData, stagesData, interactionsData, historicalData] = await Promise.all([
            db.reservations.getAll(),
            db.funnelStages.getAll(),
            db.interactions.getAll(),
            db.historicalRevenue.getAll()
        ]);
        
        let finalStages = stagesData;
        setHistoricalRevenue(historicalData);
        const requestedStages = [
            "Novo",
            "Interesse",
            "Pendente",
            "Agendado",
            "Revisão",
            "Pós Venda",
            "7 dias depois",
            "15 dias depois",
            "30 dias depois"
        ];

        // Verifica se todas as etapas solicitadas existem
        const hasAllStages = requestedStages.every(rs => stagesData.some(s => s.nome === rs));
        
        if (stagesData.length === 0 || !hasAllStages) {
            // Limpar etapas antigas se houver divergência
            if (stagesData.length > 0) {
                for (const s of stagesData) {
                    await db.funnelStages.delete(s.id);
                }
            }
            
            // Criar as novas etapas solicitadas
            for (let i = 0; i < requestedStages.length; i++) {
                await db.funnelStages.create(requestedStages[i], i + 1);
            }
            finalStages = await db.funnelStages.getAll();
        }

        setClients(clientsData);
        setReservations(reservationsData);
        setInteractions(interactionsData);
        setFunnelStages(finalStages.sort((a, b) => a.ordem - b.ordem));

        const metrics: Record<string, { count: number, tier: ClientTier }> = {};
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

        clientsData.forEach(client => {
            const recentReservations = reservationsData.filter(r => 
                (r.clientId === client.id || (r.guests && r.guests.some(g => cleanPhone(g.phone) === cleanPhone(client.phone)))) &&
                r.status !== ReservationStatus.CANCELADA &&
                new Date(r.date) >= threeMonthsAgo
            );
            const totalSlots = recentReservations.reduce((acc, curr) => acc + (curr.laneCount * curr.duration), 0);
            let tier: ClientTier = 'NOVO';
            if (totalSlots >= 20) tier = 'VIP';
            else if (totalSlots >= 6) tier = 'FIEL';
            metrics[client.id] = { count: totalSlots, tier };
        });
        setClientMetrics(metrics);
    } catch (e: any) { 
        setLoadError(e.message || "Erro ao conectar com o banco de dados.");
    } 
    finally { 
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('crm-funnel-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const fetchDetails = async () => {
      if (selectedClient) {
        const history = await db.reservations.getByClient(selectedClient.id);
        const sortedHistory = history.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setClientHistory(sortedHistory);

        if (detailTab === 'LOYALTY') {
            setLoadingLoyalty(true);
            try {
                setLoyaltyHistory(await db.loyalty.getHistory(selectedClient.id));
            } catch(e) { console.error(e); }
            finally { setLoadingLoyalty(false); }
        }
      }
    };
    fetchDetails();
  }, [selectedClient, detailTab]);

  const openWhatsApp = (phone: string) => {
    window.open(`https://wa.me/55${phone.replace(/\D/g, '')}`, '_blank');
  };

  const updateClientStage = async (clientId: string, newStage: string) => {
    setIsUpdatingStage(true);
    try {
        await db.clients.updateStage(clientId, newStage);
        setClients(prev => prev.map(c => c.id === clientId ? { ...c, funnelStage: newStage } : c));
        if (selectedClient?.id === clientId) setSelectedClient(prev => prev ? { ...prev, funnelStage: newStage } : null);
    } catch (e) { alert("Erro ao atualizar fase."); } 
    finally { setIsUpdatingStage(false); }
  };

  const handleSaveClient = async () => {
      if (!canEditClient || !selectedClient || !editForm) return;
      const updatedClient = { ...selectedClient, ...editForm } as Client;
      await db.clients.update(updatedClient, currentUser?.id);
      setSelectedClient(updatedClient);
      setIsEditing(false);
      fetchData();
  };

  const handleAddTag = async (tag: string) => {
      if (!selectedClient || !tag.trim() || selectedClient.tags.includes(tag)) return;
      const updatedTags = [...selectedClient.tags, tag];
      const updatedClient = { ...selectedClient, tags: updatedTags };
      await db.clients.update(updatedClient, currentUser?.id);
      setSelectedClient(updatedClient);
      fetchData();
  };

  const handleRemoveTag = async (tag: string) => {
      if (!selectedClient) return;
      const updatedTags = selectedClient.tags.filter(t => t !== tag);
      const updatedClient = { ...selectedClient, tags: updatedTags };
      await db.clients.update(updatedClient, currentUser?.id);
      setSelectedClient(updatedClient);
      fetchData();
  };

  const clientsByStage = useMemo(() => {
    const grouped: Record<string, Client[]> = {};
    funnelStages.forEach(s => grouped[s.nome] = []);

    const filtered = clients.filter(c => {
        const dateToFilter = c.createdAt;
        if (!dateToFilter) return true;
        
        const clientDate = new Date(dateToFilter).getTime();
        
        if (startDate) {
            const start = new Date(startDate + 'T00:00:00').getTime();
            if (clientDate < start) return false;
        }
        
        if (endDate) {
            const end = new Date(endDate + 'T23:59:59').getTime();
            if (clientDate > end) return false;
        }
        
        return true;
    });

    filtered.forEach(client => {
        const stage = client.funnelStage || (funnelStages[0]?.nome);
        if (grouped[stage]) {
            grouped[stage].push(client);
        } else if (funnelStages.length > 0) {
            // Se a etapa do cliente não existe mais nas configurações, joga na primeira
            grouped[funnelStages[0].nome].push(client);
        }
    });

    return grouped;
  }, [clients, funnelStages, startDate, endDate]);

  const onDragStart = (e: React.DragEvent, clientId: string) => {
      e.dataTransfer.setData('clientId', clientId);
  };

  const onDragOver = (e: React.DragEvent) => {
      e.preventDefault();
  };

  const onDrop = async (e: React.DragEvent, stageName: string) => {
      const clientId = e.dataTransfer.getData('clientId');
      if (clientId) {
          await updateClientStage(clientId, stageName);
      }
  };

  const renderTierBadge = (clientId: string) => {
      const metric = clientMetrics[clientId] || { count: 0, tier: 'NOVO' };
      if (metric.tier === 'VIP') return <div className="flex items-center gap-1 bg-yellow-500/10 text-yellow-500 px-2 py-1 rounded-md text-[10px] font-bold border border-yellow-500/20"><Crown size={12} fill="currentColor" /><span>VIP</span></div>;
      if (metric.tier === 'FIEL') return <div className="flex items-center gap-1 bg-blue-500/10 text-blue-400 px-2 py-1 rounded-md text-[10px] font-bold border border-blue-500/20"><Star size={12} fill="currentColor" /><span>Fiel</span></div>;
      return <div className="flex items-center gap-1 bg-slate-800 text-slate-500 px-2 py-1 rounded-md text-[10px] font-bold border border-slate-700"><span>Novo</span></div>;
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-950/20">
      {viewMode === 'DASHBOARD' ? (
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 animate-fade-in bg-slate-950/40">
          <div className="max-w-7xl mx-auto mb-8 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-2 h-8 bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.4)]" />
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">Dashboard CRM</h2>
              </div>
              <p className="text-slate-400 text-sm sm:text-base font-medium ml-5">Análise de desempenho e conversão estratégica</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 bg-slate-900/80 p-1.5 sm:p-2 rounded-2xl border border-slate-800/50 shadow-2xl backdrop-blur-md w-full sm:w-auto">
              <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-slate-800/50 rounded-xl border border-slate-700/30 flex-1 sm:flex-none justify-center sm:justify-start">
                <CalendarRange size={14} className="text-emerald-500 shrink-0 sm:size-4" />
                <select 
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="bg-transparent text-white text-[10px] sm:text-xs font-bold outline-none cursor-pointer min-w-[80px] sm:min-w-[100px]"
                >
                  {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map((m, i) => (
                    <option key={m} value={i} className="bg-slate-900">{m}</option>
                  ))}
                </select>
              </div>

              <button 
                onClick={fetchData}
                disabled={loading}
                className="p-2 sm:p-2.5 bg-slate-800/50 hover:bg-slate-700/50 rounded-xl border border-slate-700/30 text-slate-400 hover:text-emerald-500 transition-all duration-300 group shadow-lg shrink-0"
                title="Recarregar Dados"
              >
                <RefreshCw size={16} className={`${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'} sm:size-4.5`} />
              </button>

              <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-slate-800/50 rounded-xl border border-slate-700/30 flex-1 sm:flex-none justify-center sm:justify-start">
                <select 
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="bg-transparent text-white text-[10px] sm:text-xs font-bold outline-none cursor-pointer min-w-[50px] sm:min-w-[60px]"
                >
                  {[2024, 2025, 2026].map(y => (
                    <option key={y} value={y} className="bg-slate-900">{y}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6 max-w-7xl mx-auto">
            {/* KPI 0: Faturamento vs Ano Anterior */}
            <div className="bg-slate-900/40 border border-slate-800/50 p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] shadow-2xl relative overflow-hidden group hover:border-emerald-500/40 transition-all duration-500 backdrop-blur-sm min-h-[220px] sm:min-h-[240px] flex flex-col justify-between">
              <div className="absolute -top-6 -right-6 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-700 rotate-12 group-hover:rotate-0">
                <BarChart3 size={120} className="text-emerald-500" />
              </div>
              <div className="relative z-10 h-full flex flex-col">
                <div className="flex items-center justify-between mb-3 sm:mb-6">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-9 h-9 sm:w-12 sm:h-12 bg-emerald-500/10 rounded-xl sm:rounded-2xl flex items-center justify-center border border-emerald-500/20 shadow-inner">
                      <TrendingUp size={18} className="text-emerald-500 sm:size-6" />
                    </div>
                    <div>
                      <h3 className="text-[8px] sm:text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] sm:tracking-[0.25em]">Faturamento</h3>
                      <p className="text-[9px] sm:text-[11px] font-bold text-emerald-500/80">Realizado</p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 text-[9px] sm:text-[11px] font-black px-2 sm:px-3 py-1 rounded-full border shadow-sm shrink-0 ${
                    performanceMetrics.revenueGrowth >= 0 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  }`}>
                    {performanceMetrics.revenueGrowth >= 0 ? <TrendingUp size={10} className="sm:size-3"/> : <TrendingDown size={10} className="sm:size-3"/>}
                    {Math.abs(performanceMetrics.revenueGrowth).toFixed(1)}%
                  </div>
                </div>
                
                <div className="mb-3 sm:mb-6 flex-1">
                  <span className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-black text-white tracking-tighter block mb-1 leading-none">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(performanceMetrics.currentMonthRevenue)}
                  </span>
                  <div className="flex flex-col gap-1 sm:gap-1.5 mt-2">
                    <div className="flex items-center justify-between sm:justify-start sm:gap-2">
                      <span className="text-[8px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0">vs Ano Anterior:</span>
                      <span className="text-[9px] sm:text-[10px] font-black text-slate-300">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(performanceMetrics.previousYearRevenue)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between sm:justify-start sm:gap-2">
                      <span className="text-[8px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0">Diferença:</span>
                      <span className={`text-[9px] sm:text-[10px] font-black ${performanceMetrics.revenueDiff >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {performanceMetrics.revenueDiff >= 0 ? '+' : ''}
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(performanceMetrics.revenueDiff)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 sm:pt-6 border-t border-slate-800/80 mt-auto">
                  <div className="flex items-center justify-between mb-1 sm:mb-2">
                    <span className="text-[8px] sm:text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] sm:tracking-[0.2em]">Projeção Final</span>
                    <span className={`text-[8px] sm:text-[10px] font-black px-1.5 sm:px-2 py-0.5 rounded-md ${performanceMetrics.projectionGrowth >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                      {performanceMetrics.projectionGrowth >= 0 ? '+' : ''}{performanceMetrics.projectionGrowth.toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-lg sm:text-xl lg:text-2xl font-black text-white tracking-tight">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(performanceMetrics.revenueProjection)}
                  </p>
                </div>
              </div>
            </div>

            {/* KPI 1: Comissão Pluppex */}
            <div className="bg-slate-900/40 border border-slate-800/50 p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] shadow-2xl relative overflow-hidden group hover:border-blue-500/40 transition-all duration-500 backdrop-blur-sm min-h-[220px] sm:min-h-[240px] flex flex-col justify-between">
              <div className="absolute -top-6 -right-6 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-700 rotate-12 group-hover:rotate-0">
                <HandCoins size={120} className="text-blue-500" />
              </div>
              <div className="relative z-10 h-full flex flex-col">
                <div className="flex items-center justify-between mb-3 sm:mb-6">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-9 h-9 sm:w-12 sm:h-12 bg-blue-500/10 rounded-xl sm:rounded-2xl flex items-center justify-center border border-blue-500/20 shadow-inner">
                      <HandCoins size={18} className="text-blue-500 sm:size-6" />
                    </div>
                    <div>
                      <h3 className="text-[8px] sm:text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] sm:tracking-[0.25em]">Comissão</h3>
                      <p className="text-[9px] sm:text-[11px] font-bold text-blue-500/80">Pluppex</p>
                    </div>
                  </div>
                </div>
                
                <div className="mb-3 sm:mb-6 flex-1">
                  <span className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-black text-white tracking-tighter block mb-1 leading-none">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(performanceMetrics.pluppexCommission)}
                  </span>
                  <p className="text-[8px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider leading-relaxed max-w-[140px] sm:max-w-[180px]">
                    10% sobre o crescimento real vs ano anterior
                  </p>
                </div>

                <div className="pt-3 sm:pt-6 border-t border-slate-800/80 mt-auto">
                  <div className="flex items-center justify-between mb-1 sm:mb-2">
                    <span className="text-[8px] sm:text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] sm:tracking-[0.2em]">Meta Produtiva (+70%)</span>
                    <span className={`text-[8px] sm:text-[10px] font-black ${performanceMetrics.capacityPercentage >= 70 ? 'text-emerald-500' : 'text-blue-400'}`}>
                      {performanceMetrics.capacityPercentage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 sm:h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-1000 ${performanceMetrics.capacityPercentage >= 70 ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-blue-500'}`}
                      style={{ width: `${Math.min(100, performanceMetrics.capacityPercentage)}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1.5 sm:mt-2">
                    <span className="text-[7px] sm:text-[9px] text-slate-600 font-bold uppercase tracking-tighter">Vendido: {performanceMetrics.totalSoldHours.toFixed(0)}h</span>
                    <span className="text-[7px] sm:text-[9px] text-slate-600 font-bold uppercase tracking-tighter">Meta: {performanceMetrics.goalHours.toFixed(0)}h</span>
                  </div>
                </div>
              </div>
            </div>

            {/* KPI 2: Carrinhos Recuperados */}
            <div className="bg-slate-900/40 border border-slate-800/50 p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] shadow-2xl relative overflow-hidden group hover:border-blue-500/40 transition-all duration-500 backdrop-blur-sm min-h-[220px] sm:min-h-[240px] flex flex-col justify-between">
              <div className="absolute -top-6 -right-6 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-700 rotate-12 group-hover:rotate-0">
                <RefreshCw size={120} className="text-blue-500" />
              </div>
              <div className="relative z-10 h-full flex flex-col">
                <div className="flex items-center justify-between mb-3 sm:mb-6">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-9 h-9 sm:w-12 sm:h-12 bg-blue-500/10 rounded-xl sm:rounded-2xl flex items-center justify-center border border-blue-500/20 shadow-inner">
                      <RefreshCw size={18} className="text-blue-500 sm:size-6" />
                    </div>
                    <div>
                      <h3 className="text-[8px] sm:text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] sm:tracking-[0.25em]">Recuperação</h3>
                      <p className="text-[9px] sm:text-[11px] font-bold text-blue-500/80">Carrinhos</p>
                    </div>
                  </div>
                  <div className={`flex items-center gap-1 text-[9px] sm:text-[11px] font-black px-2 sm:px-3 py-1 rounded-full border shadow-sm shrink-0 ${
                    performanceMetrics.recoveryGrowth >= 0 
                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' 
                    : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  }`}>
                    {performanceMetrics.recoveryGrowth >= 0 ? <TrendingUp size={10} className="sm:size-3"/> : <TrendingDown size={10} className="sm:size-3"/>}
                    {Math.abs(performanceMetrics.recoveryGrowth).toFixed(1)}%
                  </div>
                </div>
                
                <div className="mb-3 sm:mb-6 flex-1">
                  <span className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-black text-white tracking-tighter block mb-1 leading-none">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(performanceMetrics.totalRecoveredValue)}
                  </span>
                  <p className="text-[8px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider">Valor recuperado no período</p>
                </div>

                <div className="pt-3 sm:pt-6 border-t border-slate-800/80 mt-auto">
                  <div className="flex items-center justify-between mb-1 sm:mb-2">
                    <span className="text-[8px] sm:text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] sm:tracking-[0.2em]">Status</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-500 animate-pulse" />
                    <p className="text-[10px] sm:text-sm font-bold text-slate-300">Monitoramento Ativo</p>
                  </div>
                </div>
              </div>
            </div>

            {/* KPI 3: NPS Geral */}
            <div className="bg-slate-900/40 border border-slate-800/50 p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] shadow-2xl relative overflow-hidden group hover:border-amber-500/40 transition-all duration-500 backdrop-blur-sm min-h-[220px] sm:min-h-[240px] flex flex-col justify-between">
              <div className="absolute -top-6 -right-6 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-700 rotate-12 group-hover:rotate-0">
                <Star size={120} className="text-amber-500" />
              </div>
              <div className="relative z-10 h-full flex flex-col">
                <div className="flex items-center justify-between mb-3 sm:mb-6">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-9 h-9 sm:w-12 sm:h-12 bg-amber-500/10 rounded-xl sm:rounded-2xl flex items-center justify-center border border-amber-500/20 shadow-inner">
                      <Star size={18} className="text-amber-500 sm:size-6" />
                    </div>
                    <div>
                      <h3 className="text-[8px] sm:text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] sm:tracking-[0.25em]">Satisfação</h3>
                      <p className="text-[9px] sm:text-[11px] font-bold text-amber-500/80">NPS Geral</p>
                    </div>
                  </div>
                </div>
                
                <div className="mb-3 sm:mb-6 flex-1">
                  <span className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-black text-white tracking-tighter block mb-1">
                    {performanceMetrics.avgNps.toFixed(1)}
                  </span>
                  <div className="flex items-center gap-1">
                    {[1,2,3,4,5].map(s => (
                      <Star key={s} size={10} className={s <= Math.round(performanceMetrics.avgNps / 2) ? "fill-amber-500 text-amber-500" : "text-slate-700"} />
                    ))}
                    <span className="text-[8px] sm:text-[10px] font-bold text-slate-500 ml-1">({performanceMetrics.npsCount} avaliações)</span>
                  </div>
                </div>

                <div className="pt-3 sm:pt-6 border-t border-slate-800/80 mt-auto">
                  <div className="flex items-center justify-between mb-1 sm:mb-2">
                    <span className="text-[8px] sm:text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] sm:tracking-[0.2em]">Qualidade</span>
                  </div>
                  <p className="text-[10px] sm:text-sm font-bold text-slate-300">
                    {performanceMetrics.avgNps >= 9 ? "Excelente" : performanceMetrics.avgNps >= 7 ? "Bom" : "Pode Melhorar"}
                  </p>
                </div>
              </div>
            </div>

            {/* KPI 4: Clientes Reativados */}
            <div className="bg-slate-900/40 border border-slate-800/50 p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] shadow-2xl relative overflow-hidden group hover:border-purple-500/40 transition-all duration-500 backdrop-blur-sm min-h-[220px] sm:min-h-[240px] flex flex-col justify-between">
              <div className="absolute -top-6 -right-6 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-700 rotate-12 group-hover:rotate-0">
                <Users size={120} className="text-purple-500" />
              </div>
              <div className="relative z-10 h-full flex flex-col">
                <div className="flex items-center justify-between mb-3 sm:mb-6">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-9 h-9 sm:w-12 sm:h-12 bg-purple-500/10 rounded-xl sm:rounded-2xl flex items-center justify-center border border-purple-500/20 shadow-inner">
                      <Users size={18} className="text-purple-500 sm:size-6" />
                    </div>
                    <div>
                      <h3 className="text-[8px] sm:text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] sm:tracking-[0.25em]">Retenção</h3>
                      <p className="text-[9px] sm:text-[11px] font-bold text-purple-500/80">Reativados</p>
                    </div>
                  </div>
                </div>
                
                <div className="mb-3 sm:mb-6 flex-1">
                  <span className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-black text-white tracking-tighter block mb-1">
                    {performanceMetrics.reactivatedCount}
                  </span>
                  <p className="text-[8px] sm:text-[10px] font-bold text-slate-500 uppercase tracking-wider">Clientes que voltaram</p>
                </div>

                <div className="pt-3 sm:pt-6 border-t border-slate-800/80 mt-auto">
                  <div className="flex items-center justify-between mb-1 sm:mb-2">
                    <span className="text-[8px] sm:text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] sm:tracking-[0.2em]">Impacto</span>
                  </div>
                  <p className="text-[10px] sm:text-sm font-bold text-slate-300">Recuperação de Base</p>
                </div>
              </div>
            </div>
          </div>

          {/* Seção de Feedbacks NPS */}
          <div className="mt-8 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-neon-orange/10 rounded-2xl flex items-center justify-center border border-neon-orange/20">
                        <MessageCircle size={24} className="text-neon-orange" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-white uppercase tracking-tight">Feedbacks Pós-Venda</h2>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Observações e Notas de NPS</p>
                    </div>
                </div>
                <div className="bg-slate-900/80 border border-slate-800 px-4 py-2 rounded-2xl flex items-center gap-3 shadow-lg">
                    <div className="text-right">
                        <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest">Total Pesquisados</p>
                        <p className="text-lg font-black text-white leading-none">{performanceMetrics.npsCount}</p>
                    </div>
                    <div className="w-px h-8 bg-slate-800" />
                    <div className="text-right">
                        <p className="text-[8px] text-slate-500 font-black uppercase tracking-widest">Média NPS</p>
                        <p className="text-lg font-black text-neon-orange leading-none">{performanceMetrics.avgNps.toFixed(1)}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {interactions.filter(i => i.npsScore !== undefined && i.npsScore !== null).length > 0 ? (
                    interactions
                        .filter(i => i.npsScore !== undefined && i.npsScore !== null)
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .map(feedback => {
                            const client = clients.find(c => c.id === feedback.clientId);
                            const clientReservations = reservations.filter(r => r.clientId === feedback.clientId && r.status !== ReservationStatus.CANCELADA);
                            const lastVisit = clientReservations.length > 0 
                                ? new Date(clientReservations.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date)
                                : null;

                            return (
                                <div key={feedback.id} className="bg-slate-900/40 border border-slate-800/60 p-5 rounded-3xl hover:border-neon-orange/20 transition-all group">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 font-bold border border-slate-700">
                                                {client?.name?.charAt(0) || '?'}
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-white leading-tight">{client?.name || 'Cliente Desconhecido'}</h4>
                                                <p className="text-[10px] text-slate-500 font-medium">
                                                    Última visita: {lastVisit ? lastVisit.toLocaleDateString('pt-BR') : 'N/A'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className={`px-2 py-1 rounded-lg text-[10px] font-black border ${
                                            (feedback.npsScore || 0) >= 8 ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                            (feedback.npsScore || 0) >= 6 ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                                            'bg-red-500/10 text-red-400 border-red-500/20'
                                        }`}>
                                            NPS {(feedback.npsScore || 0).toFixed(0)}
                                        </div>
                                    </div>
                                    
                                    <div className="bg-slate-950/40 p-3 rounded-2xl border border-slate-800/50 mb-3">
                                        <p className="text-xs text-slate-300 italic leading-relaxed">
                                            "{feedback.content || 'Sem observações.'}"
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <div className={`w-2 h-2 rounded-full ${
                                                feedback.satisfactionLevel === 'EXCELENTE' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' :
                                                feedback.satisfactionLevel === 'BOM' ? 'bg-blue-500' :
                                                feedback.satisfactionLevel === 'NEUTRO' ? 'bg-yellow-500' :
                                                'bg-red-500'
                                            }`} />
                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                                {feedback.satisfactionLevel || 'NÃO INFORMADO'}
                                            </span>
                                        </div>
                                        <span className="text-[8px] font-bold text-slate-600 uppercase tracking-tighter">
                                            {new Date(feedback.createdAt).toLocaleDateString('pt-BR')}
                                        </span>
                                    </div>
                                </div>
                            );
                        })
                ) : (
                    <div className="col-span-full py-12 flex flex-col items-center justify-center bg-slate-900/20 border border-dashed border-slate-800 rounded-3xl">
                        <MessageCircle size={48} className="text-slate-700 mb-4" />
                        <p className="text-slate-500 font-bold uppercase text-xs tracking-widest">Nenhum feedback recebido ainda</p>
                    </div>
                )}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden min-h-0 relative px-1">
              <div className={`flex-1 overflow-x-auto custom-scrollbar h-full ${selectedClient ? 'hidden lg:flex' : 'flex'}`}>
                {showFunnelSettings ? (
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 max-w-4xl mx-auto shadow-2xl animate-scale-in">
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl font-bold text-white tracking-tight">Configuração das Etapas</h2>
                            <div className="flex items-center gap-4">
                                <button 
                                    onClick={handleSyncFunnel}
                                    disabled={isSyncing}
                                    className={`text-[10px] font-black uppercase tracking-widest ${isSyncing ? 'text-slate-500' : 'text-neon-blue hover:text-blue-400'} transition-colors`}
                                >
                                    {isSyncing ? 'Sincronizando...' : 'Sincronizar CRM'}
                                </button>
                                <button 
                                    onClick={async () => {
                                        if (window.confirm("Isso irá substituir suas etapas atuais pelas etapas padrão do boliche. Continuar?")) {
                                            const defaults = [
                                                "Novo Contato",
                                                "Interesse",
                                                "Agendado",
                                                "Pos vendas",
                                                "7 dias depois",
                                                "15 dias depois",
                                                "30 dias depois"
                                            ];
                                            // Deletar atuais
                                            for (const s of funnelStages) {
                                                await db.funnelStages.delete(s.id);
                                            }
                                            // Criar novas
                                            for (let i = 0; i < defaults.length; i++) {
                                                await db.funnelStages.create(defaults[i], i + 1);
                                            }
                                            fetchData();
                                        }
                                    }}
                                    className="text-[10px] font-black uppercase tracking-widest text-neon-orange hover:text-orange-400 transition-colors"
                                >
                                    Carregar Padrão Boliche
                                </button>
                                <button onClick={() => setShowFunnelSettings(false)} className="text-slate-400 hover:text-white font-bold uppercase text-[10px] tracking-widest">Fechar</button>
                            </div>
                        </div>
                        <div className="space-y-4">
                            {funnelStages.map((stage, idx) => (
                                <div key={stage.id} className="flex items-center gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-700 shadow-sm group">
                                    <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center text-slate-500 font-bold border border-slate-700">{idx + 1}</div>
                                    <input 
                                        type="text" 
                                        className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white font-bold focus:border-neon-blue outline-none transition"
                                        value={stage.nome}
                                        onChange={async (e) => {
                                            const newName = e.target.value;
                                            const updated = funnelStages.map(s => s.id === stage.id ? { ...s, nome: newName } : s);
                                            setFunnelStages(updated);
                                        }}
                                        onBlur={async () => {
                                            await db.funnelStages.update(stage.id, stage.nome, stage.ordem);
                                        }}
                                    />
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={async () => {
                                            if (idx > 0) {
                                                const prev = funnelStages[idx-1];
                                                const current = funnelStages[idx];
                                                const temp = prev.ordem;
                                                prev.ordem = current.ordem;
                                                current.ordem = temp;
                                                await Promise.all([
                                                    db.funnelStages.update(prev.id, prev.nome, prev.ordem), 
                                                    db.funnelStages.update(current.id, current.nome, current.ordem)
                                                ]);
                                                fetchData();
                                            }
                                        }} className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-white border border-slate-700" title="Mover para cima"><ChevronUp size={16}/></button>
                                        <button onClick={async () => {
                                            if (idx < funnelStages.length - 1) {
                                                const next = funnelStages[idx+1];
                                                const current = funnelStages[idx];
                                                const temp = next.ordem;
                                                next.ordem = current.ordem;
                                                current.ordem = temp;
                                                await Promise.all([
                                                    db.funnelStages.update(next.id, next.nome, next.ordem), 
                                                    db.funnelStages.update(current.id, current.nome, current.ordem)
                                                ]);
                                                fetchData();
                                            }
                                        }} className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-white border border-slate-700" title="Mover para baixo"><ChevronDown size={16}/></button>
                                        <button 
                                            onClick={async () => {
                                                if (window.confirm(`Excluir a etapa "${stage.nome}"? Clientes nesta etapa serão movidos para a primeira coluna.`)) {
                                                    await db.funnelStages.delete(stage.id);
                                                    fetchData();
                                                }
                                            }}
                                            className="p-2 bg-red-500/10 rounded-lg text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 transition-all"
                                            title="Excluir Etapa"
                                        >
                                            <Trash2 size={16}/>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-8 flex justify-center">
                            <button 
                                onClick={async () => {
                                    const nome = prompt("Nome da nova etapa:");
                                    if (nome) {
                                        await db.funnelStages.create(nome, funnelStages.length + 1);
                                        fetchData();
                                    }
                                }}
                                className="flex items-center gap-2 bg-neon-blue/10 text-neon-blue border border-neon-blue/30 px-8 py-3 rounded-xl font-bold uppercase text-xs tracking-widest hover:bg-neon-blue hover:text-white transition-all shadow-lg group"
                            >
                                <Plus size={16} className="group-hover:rotate-90 transition-transform" />
                                Adicionar Nova Etapa
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col h-full overflow-hidden">
                            <div className="flex flex-col sm:flex-row justify-end items-center gap-2 sm:gap-3 mb-4 px-2">
                                <div className="flex items-center gap-1 sm:gap-1.5 bg-slate-900/50 p-1 rounded-xl border border-slate-800 w-full sm:w-auto justify-center sm:justify-start order-2 sm:order-1">
                                <input 
                                    type="date" 
                                    value={startDate} 
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="bg-transparent text-[9px] text-white outline-none cursor-pointer transition [color-scheme:dark] px-1 min-w-[90px]"
                                />
                                <span className="text-white text-[9px] font-bold opacity-60">até</span>
                                <input 
                                    type="date" 
                                    value={endDate} 
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="bg-transparent text-[9px] text-white outline-none cursor-pointer transition [color-scheme:dark] px-1 min-w-[90px]"
                                />
                                {(startDate || endDate) && (
                                    <button 
                                        onClick={() => { setStartDate(''); setEndDate(''); }}
                                        className="ml-1 p-1 text-white hover:text-red-400 transition"
                                    >
                                        <X size={12} />
                                    </button>
                                )}
                            </div>

                                <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-end order-1 sm:order-2">
                                    {isAdmin && (
                                        <>
                                            <button 
                                                onClick={handleSyncFunnel}
                                                disabled={isSyncing}
                                                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl border transition-all text-[10px] font-black uppercase tracking-widest ${
                                                    isSyncing 
                                                    ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed' 
                                                    : 'bg-neon-blue/10 border-neon-blue/30 text-neon-blue hover:bg-neon-blue hover:text-white shadow-[0_0_15px_rgba(0,243,255,0.1)]'
                                                }`}
                                            >
                                                <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''}/>
                                                <span className="hidden sm:inline">{isSyncing ? 'Sincronizando...' : 'Sincronizar CRM'}</span>
                                                <span className="sm:hidden">{isSyncing ? 'Sincronizando...' : 'Sincronizar'}</span>
                                            </button>
                                            <button 
                                                onClick={() => setShowFunnelSettings(true)}
                                                className="p-2 bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-700 transition-all"
                                                title="Configurações do Funil"
                                            >
                                                <Settings size={20}/>
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        <div className="flex gap-4 flex-1 overflow-x-auto pb-4 custom-scrollbar">
                        {funnelStages.map(stage => {
                            const stageClients = clientsByStage[stage.nome] || [];
                            return (
                                <div 
                                    key={stage.id} 
                                    className="flex-shrink-0 w-80 flex flex-col bg-slate-900/40 rounded-2xl border border-slate-800/50 shadow-inner"
                                    onDragOver={onDragOver}
                                    onDrop={(e) => onDrop(e, stage.nome)}
                                >
                                    <div className="p-4 flex items-center justify-between border-b border-slate-800/50 bg-slate-900/60 rounded-t-2xl">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-300">{stage.nome}</h3>
                                            <span className="bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full text-[10px] font-bold border border-slate-700">{stageClients.length}</span>
                                        </div>
                                        <button className="text-slate-600 hover:text-slate-400"><MoreHorizontal size={16}/></button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                                        {stageClients.slice(0, visibleCounts[stage.nome] || 50).map(client => (
                                            <div 
                                                key={client.id} 
                                                draggable={canEditClient}
                                                onDragStart={(e) => onDragStart(e, client.id)}
                                                onClick={() => { setSelectedClient(client); setIsEditing(false); setDetailTab('INFO'); }}
                                                className={`bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg cursor-pointer hover:border-neon-blue transition-all group relative ${selectedClient?.id === client.id ? 'ring-2 ring-neon-blue border-transparent' : ''}`}
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <h4 className="text-sm font-bold text-white truncate pr-2 group-hover:text-neon-blue transition-colors">{client.name}</h4>
                                                    {renderTierBadge(client.id)}
                                                </div>
                                                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                                                    <MessageCircle size={10} className="text-green-500"/>
                                                    {client.phone}
                                                </div>
                                                {client.tags.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-3">
                                                        {client.tags.slice(0, 2).map(tag => (
                                                            <span key={tag} className="text-[8px] font-bold uppercase bg-slate-900 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">{tag}</span>
                                                        ))}
                                                        {client.tags.length > 2 && <span className="text-[8px] font-bold text-slate-600">+{client.tags.length - 2}</span>}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        
                                        {stageClients.length > (visibleCounts[stage.nome] || 50) && (
                                            <button 
                                                onClick={() => showMore(stage.nome)}
                                                className="w-full py-3 bg-slate-800/50 border border-dashed border-slate-700 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-neon-blue hover:border-neon-blue transition-all"
                                            >
                                                Carregar mais ({stageClients.length - (visibleCounts[stage.nome] || 50)} restantes)
                                            </button>
                                        )}

                                        {stageClients.length === 0 && (
                                            <div className="h-24 border-2 border-dashed border-slate-800 rounded-xl flex items-center justify-center text-slate-700 text-[10px] font-bold uppercase tracking-widest">Vazio</div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        </div>
                    </div>
                )}
            </div>

            <ClientDetailsPanel 
                selectedClient={selectedClient}
                setSelectedClient={setSelectedClient}
                currentUser={currentUser}
                isEditing={isEditing}
                setIsEditing={setIsEditing}
                editForm={editForm}
                setEditForm={setEditForm}
                handleSaveClient={handleSaveClient}
                canEditClient={canEditClient}
                canCreateReservation={canCreateReservation}
                detailTab={detailTab}
                setDetailTab={setDetailTab}
                clientHistory={clientHistory}
                loyaltyHistory={loyaltyHistory}
                loadingLoyalty={loadingLoyalty}
                funnelStages={funnelStages}
                updateClientStage={updateClientStage}
                isUpdatingStage={isUpdatingStage}
                handleRemoveTag={handleRemoveTag}
                handleAddTag={handleAddTag}
                onRefreshData={fetchData}
                openWhatsApp={openWhatsApp}
                navigate={navigate}
                viewMode={viewMode === 'KANBAN' ? 'KANBAN' : 'LIST'}
            />
          </div>
        )}
    </div>
  );
};

export default Funnel;
