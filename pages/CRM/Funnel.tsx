
import React, { useEffect, useState, useMemo } from 'react';
import { db, cleanPhone } from '../../services/mockBackend';
import { Client, Reservation, FunnelStageConfig, User, UserRole, ReservationStatus, PaymentStatus, LoyaltyTransaction, Interaction } from '../../types';
import { 
    Loader2, Settings, Crown, Star, MessageCircle, MoreHorizontal, 
    RefreshCw, Trash2, Plus, ChevronUp, ChevronDown, TrendingUp, 
    TrendingDown, Target, Users, Award, Activity, BarChart3, PieChart 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import ClientDetailsPanel from './ClientDetailsPanel';

type ClientTier = 'VIP' | 'FIEL' | 'NOVO';

interface FunnelProps {
  viewMode: 'KANBAN' | 'DASHBOARD';
}

const Funnel: React.FC<FunnelProps> = ({ viewMode }) => {
  const navigate = useNavigate();
  
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
  const [loadingLoyalty, setLoadingLoyalty] = useState(false);
  const [detailTab, setDetailTab] = useState<'INFO' | 'LOYALTY' | 'NOTES'>('INFO');

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Client>>({});
  const [isUpdatingStage, setIsUpdatingStage] = useState(false);
  const [showFunnelSettings, setShowFunnelSettings] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('tonapista_auth');
    if (stored) setCurrentUser(JSON.parse(stored));
  }, []);

  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const canEditClient = isAdmin || currentUser?.perm_edit_client;
  const canCreateReservation = isAdmin || currentUser?.perm_create_reservation;

  const [isSyncing, setIsSyncing] = useState(false);

  const performanceMetrics = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
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

    return {
        totalRecoveredValue,
        recoveryGrowth,
        avgNps,
        reactivatedCount: reactivatedClients.size
    };
  }, [reservations, interactions]);

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
        const [reservationsData, stagesData, interactionsData] = await Promise.all([
            db.reservations.getAll(),
            db.funnelStages.getAll(),
            db.interactions.getAll()
        ]);
        
        let finalStages = stagesData;
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

    clients.forEach(client => {
        const stage = client.funnelStage || (funnelStages[0]?.nome);
        if (grouped[stage]) {
            grouped[stage].push(client);
        } else if (funnelStages.length > 0) {
            // Se a etapa do cliente não existe mais nas configurações, joga na primeira
            grouped[funnelStages[0].nome].push(client);
        }
    });

    return grouped;
  }, [clients, funnelStages]);

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
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 max-w-7xl mx-auto">
            {/* KPI 1: Carrinhos Recuperados */}
            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-3xl shadow-xl relative overflow-hidden group hover:border-neon-blue/30 transition-all duration-500">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <BarChart3 size={64} className="text-neon-blue" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-10 h-10 bg-neon-blue/10 rounded-xl flex items-center justify-center border border-neon-blue/20">
                    <TrendingUp size={20} className="text-neon-blue" />
                  </div>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Carrinhos Recuperados</h3>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-4xl font-black text-white tracking-tighter">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(performanceMetrics.totalRecoveredValue)}
                  </span>
                  <div className={`flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    performanceMetrics.recoveryGrowth >= 0 
                    ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                    : 'bg-red-500/10 text-red-400 border-red-500/20'
                  }`}>
                    {performanceMetrics.recoveryGrowth >= 0 ? <TrendingUp size={10}/> : <TrendingDown size={10}/>}
                    {Math.abs(performanceMetrics.recoveryGrowth).toFixed(1)}%
                  </div>
                </div>
                <p className="text-[9px] text-slate-500 font-bold mt-2 uppercase tracking-wider">Performance vs mês anterior</p>
              </div>
            </div>

            {/* KPI 2: NPS Geral */}
            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-3xl shadow-xl relative overflow-hidden group hover:border-neon-orange/30 transition-all duration-500">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Target size={64} className="text-neon-orange" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-10 h-10 bg-neon-orange/10 rounded-xl flex items-center justify-center border border-neon-orange/20">
                    <Activity size={20} className="text-neon-orange" />
                  </div>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">NPS Geral (Satisfação)</h3>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-4xl sm:text-6xl font-black text-white tracking-tighter">
                    {performanceMetrics.avgNps.toFixed(1)}
                  </span>
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700 p-0.5">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ${
                          performanceMetrics.avgNps >= 8 ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : 
                          performanceMetrics.avgNps >= 6 ? 'bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]' : 
                          'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'
                        }`}
                        style={{ width: `${performanceMetrics.avgNps * 10}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[8px] font-black text-slate-600 uppercase tracking-tighter">
                      <span>Crítico</span>
                      <span>Neutro</span>
                      <span>Excelente</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* KPI 3: Clientes Reativados */}
            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-3xl shadow-xl relative overflow-hidden group hover:border-green-500/30 transition-all duration-500">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Users size={64} className="text-green-500" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-10 h-10 bg-green-500/10 rounded-xl flex items-center justify-center border border-green-500/20">
                    <RefreshCw size={20} className="text-green-500" />
                  </div>
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Clientes Reativados</h3>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-4xl sm:text-6xl font-black text-white tracking-tighter">
                    {performanceMetrics.reactivatedCount}
                  </span>
                  <div className="bg-green-500/10 text-green-400 px-3 py-1 rounded-xl border border-green-500/20 text-[10px] font-black uppercase tracking-widest">
                    Novas Reservas
                  </div>
                </div>
                <p className="text-[9px] text-slate-500 font-bold mt-2 uppercase tracking-wider">Via prospecção ativa este mês</p>
              </div>
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
                            <div className="flex justify-end items-center gap-3 mb-4 px-2">
                                {isAdmin && (
                                    <>
                                        <button 
                                            onClick={handleSyncFunnel}
                                            disabled={isSyncing}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all text-[10px] font-black uppercase tracking-widest ${
                                                isSyncing 
                                                ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed' 
                                                : 'bg-neon-blue/10 border-neon-blue/30 text-neon-blue hover:bg-neon-blue hover:text-white shadow-[0_0_15px_rgba(0,243,255,0.1)]'
                                            }`}
                                        >
                                            <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''}/>
                                            {isSyncing ? 'Sincronizando...' : 'Sincronizar CRM'}
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
