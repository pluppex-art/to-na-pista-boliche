
import React, { useEffect, useState, useMemo } from 'react';
import { db, cleanPhone } from '../services/mockBackend';
import { Client, Reservation, FunnelStage, FunnelStageConfig, User, UserRole, ReservationStatus, LoyaltyTransaction, PaymentStatus } from '../types';
import { Search, MessageCircle, Calendar, Plus, Users, Loader2, LayoutList, Kanban as KanbanIcon, GripVertical, Pencil, Save, X, Crown, Star, Sparkles, Clock, LayoutGrid, Gift, Coins, History, ArrowDown, ArrowUp, CalendarPlus, Check, DollarSign, CheckCircle2, Ban, AlertCircle, MapPin, Cake, UserCheck, Utensils, Trash2, Hash, FileText, Store } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';

type ClientTier = 'VIP' | 'FIEL' | 'NOVO';

const CRM: React.FC = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'LIST' | 'KANBAN'>('LIST');
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientHistory, setClientHistory] = useState<Reservation[]>([]);
  const [clientMetrics, setClientMetrics] = useState<Record<string, { count: number, tier: ClientTier }>>({});
  const [loading, setLoading] = useState(true);
  
  const [funnelStages, setFunnelStages] = useState<FunnelStageConfig[]>([]);
  const [editingStage, setEditingStage] = useState<FunnelStageConfig | null>(null);
  const [stageForm, setStageForm] = useState({ nome: '', ordem: 0 });
  const [isSavingStage, setIsSavingStage] = useState(false);

  const [loyaltyHistory, setLoyaltyHistory] = useState<LoyaltyTransaction[]>([]);
  const [loadingLoyalty, setLoadingLoyalty] = useState(false);
  const [detailTab, setDetailTab] = useState<'INFO' | 'LOYALTY'>('INFO');

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Client>>({});
  const [isUpdatingStage, setIsUpdatingStage] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('tonapista_auth');
    if (stored) setCurrentUser(JSON.parse(stored));
  }, []);

  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const canEditClient = isAdmin || currentUser?.perm_edit_client;
  const canCreateReservation = isAdmin || currentUser?.perm_create_reservation;

  const fetchData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
        const [clientsData, reservationsData, stagesData] = await Promise.all([
            db.clients.getAll(),
            db.reservations.getAll(),
            db.funnelStages.getAll()
        ]);
        setClients(clientsData);
        // Garante que as etapas fiquem na ordem correta da automação (1 a 5)
        setFunnelStages(stagesData.sort((a, b) => a.ordem - b.ordem));

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
    } catch (e) { console.error(e); } 
    finally { if (!isBackground) setLoading(false); }
  };

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('crm-v13-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, () => fetchData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas' }, () => fetchData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'etapas_funil' }, () => fetchData(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const fetchDetails = async () => {
      if (selectedClient) {
        const history = await db.reservations.getByClient(selectedClient.id);
        const sortedHistory = history.sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
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

  const filteredAndSortedClients = useMemo(() => {
    const filtered = clients.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone.includes(searchTerm)
    );
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [clients, searchTerm]);

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
      await db.clients.update(updatedClient);
      setSelectedClient(updatedClient);
      setIsEditing(false);
      fetchData(true);
  };

  const handleAddStage = async () => {
    const nome = prompt("Nome da nova etapa:");
    if (!nome) return;
    setIsSavingStage(true);
    try {
      const nextOrdem = funnelStages.length > 0 ? Math.max(...funnelStages.map(s => s.ordem)) + 1 : 1;
      await db.funnelStages.create(nome, nextOrdem);
      fetchData(true);
    } catch (e) { alert("Erro ao criar etapa."); } 
    finally { setIsSavingStage(false); }
  };

  const handleEditStage = (stage: FunnelStageConfig) => {
    setEditingStage(stage);
    setStageForm({ nome: stage.nome, ordem: stage.ordem });
  };

  const saveStageEdit = async () => {
    if (!editingStage || !stageForm.nome.trim()) return;
    setIsSavingStage(true);
    try {
      await db.funnelStages.update(editingStage.id, stageForm.nome, stageForm.ordem);
      setEditingStage(null);
      fetchData(true);
    } catch (e) { alert("Erro ao salvar etapa."); }
    finally { setIsSavingStage(false); }
  };

  const deleteStage = async (stage: FunnelStageConfig) => {
    const hasClients = clients.some(c => c.funnelStage === stage.nome);
    if (hasClients) {
      alert("Não é possível excluir uma etapa que possui clientes ativos.");
      return;
    }
    if (!window.confirm(`Excluir a etapa "${stage.nome}" permanentemente?`)) return;
    setIsSavingStage(true);
    try {
      await db.funnelStages.delete(stage.id);
      fetchData(true);
    } catch (e) { alert("Erro ao excluir."); }
    finally { setIsSavingStage(false); }
  };

  const renderTierBadge = (clientId: string) => {
      const metric = clientMetrics[clientId] || { count: 0, tier: 'NOVO' };
      if (metric.tier === 'VIP') return <div className="flex items-center gap-1 bg-yellow-500/10 text-yellow-500 px-2 py-1 rounded-md text-[10px] font-bold border border-yellow-500/20"><Crown size={12} fill="currentColor" /><span>VIP ({metric.count})</span></div>;
      if (metric.tier === 'FIEL') return <div className="flex items-center gap-1 bg-blue-500/10 text-blue-400 px-2 py-1 rounded-md text-[10px] font-bold border border-blue-500/20"><Star size={12} fill="currentColor" /><span>Fiel ({metric.count})</span></div>;
      return <div className="flex items-center gap-1 bg-slate-800 text-slate-500 px-2 py-1 rounded-md text-[10px] font-bold border border-slate-700"><span>Novo</span></div>;
  };

  return (
    <div className="h-[calc(100vh-100px)] md:h-[calc(100vh-140px)] flex flex-col font-sans overflow-hidden">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 flex-shrink-0 px-1">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Gestão de Clientes</h1>
            <div className="bg-slate-800 border border-slate-700 text-neon-blue px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-2 shadow-inner"><Users size={14} /><span>{loading ? '...' : clients.length} cadastrados</span></div>
          </div>
          <div className="flex bg-slate-900 p-1.5 rounded-xl border border-slate-700 w-full md:w-auto shadow-lg">
             <button onClick={() => { setViewMode('LIST'); setSelectedClient(null); }} className={`flex-1 md:flex-none px-6 py-2 rounded-lg flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider transition-all ${viewMode === 'LIST' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}><LayoutList size={16} /> Lista</button>
             <button onClick={() => { setViewMode('KANBAN'); setSelectedClient(null); }} className={`flex-1 md:flex-none px-6 py-2 rounded-lg flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider transition-all ${viewMode === 'KANBAN' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}><KanbanIcon size={16} /> Funil</button>
          </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden min-h-0 relative px-1">
            <div className={`flex-col overflow-hidden min-h-0 transition-all duration-300 ${viewMode === 'LIST' ? 'lg:w-[400px]' : 'flex-1'} ${selectedClient ? 'hidden lg:flex' : 'flex'} h-full`}>
                {viewMode === 'LIST' ? (
                    <div className="flex flex-col bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden h-full">
                        <div className="p-4 border-b border-slate-700 bg-slate-900/50 flex-shrink-0">
                            <div className="relative">
                                <Search className="absolute left-3 top-3.5 text-slate-500" size={18} />
                                <input type="text" placeholder="Buscar por nome ou fone..." className="w-full bg-slate-700 border border-slate-600 text-white pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-neon-blue/20 transition-all text-sm font-medium" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-800/20">
                        {loading ? <div className="flex justify-center p-12"><Loader2 className="animate-spin text-neon-blue" size={32}/></div> : filteredAndSortedClients.length === 0 ? <div className="text-center p-12 text-slate-500 text-sm italic">Nenhum cliente encontrado</div> : filteredAndSortedClients.map(client => (
                            <div key={client.id} onClick={() => { setSelectedClient(client); setIsEditing(false); setDetailTab('INFO'); }} className={`p-4 border-b border-slate-700/50 cursor-pointer hover:bg-slate-700/30 transition-colors group ${selectedClient?.id === client.id ? 'bg-slate-700/80 border-l-4 border-l-neon-blue shadow-inner' : ''}`}>
                                <div className="flex justify-between items-start mb-1">
                                    <h3 className={`font-bold truncate pr-2 flex-1 text-sm ${selectedClient?.id === client.id ? 'text-neon-blue' : 'text-slate-200 group-hover:text-white'}`}>{client.name}</h3>
                                    {renderTierBadge(client.id)}
                                </div>
                                <div className="flex items-center gap-2">
                                    <p className="text-xs text-slate-500 font-mono">{client.phone}</p>
                                    <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-tight">{client.funnelStage || 'Sem Etapa'}</p>
                                </div>
                            </div>
                        ))}
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 overflow-x-auto custom-scrollbar h-full bg-slate-900/10 rounded-2xl border border-slate-800/50">
                        {loading ? <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin text-neon-blue" size={48} /></div> : (
                            <div className="flex gap-4 h-full min-w-max pb-4 px-2">
                                {funnelStages.map((stage) => {
                                    const stageClients = filteredAndSortedClients.filter(c => (c.funnelStage || '') === stage.nome);
                                    return (
                                        <div key={stage.id} onDragOver={(e) => e.preventDefault()} onDrop={async (e) => { e.preventDefault(); const id = e.dataTransfer.getData('clientId'); if(id) await updateClientStage(id, stage.nome); }} className={`w-[300px] bg-slate-800/40 rounded-2xl border border-slate-700 flex flex-col transition-all hover:border-slate-600 shadow-sm ${selectedClient?.funnelStage === stage.nome ? 'ring-2 ring-neon-blue/20 bg-slate-800/60' : ''}`}>
                                            <div className="p-4 border-b border-slate-700/50 flex justify-between items-center sticky top-0 bg-slate-800 rounded-t-2xl z-10">
                                                <div className="flex flex-col min-w-0">
                                                    <span className="font-bold text-slate-200 uppercase text-[10px] tracking-widest truncate">{stage.nome}</span>
                                                    <span className="text-[9px] text-slate-500 font-semibold uppercase">{stageClients.length} leads</span>
                                                </div>
                                                {isAdmin && (
                                                    <div className="flex items-center gap-1">
                                                        <button onClick={() => handleEditStage(stage)} className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"><Pencil size={12}/></button>
                                                        <button onClick={() => deleteStage(stage)} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 size={12}/></button>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="p-3 space-y-3 flex-1 overflow-y-auto custom-scrollbar min-h-[200px]">
                                                {stageClients.length === 0 ? <div className="h-20 flex items-center justify-center border-2 border-dashed border-slate-700/30 rounded-xl text-[10px] text-slate-600 uppercase font-bold tracking-widest">Vazio</div> : stageClients.map(client => (
                                                <div key={client.id} draggable onDragStart={(e) => { e.dataTransfer.setData('clientId', client.id); }} onClick={() => { setSelectedClient(client); setIsEditing(false); setDetailTab('INFO'); }} className={`bg-slate-700/80 p-4 rounded-xl shadow-md border transition-all group relative cursor-pointer ${selectedClient?.id === client.id ? 'border-neon-blue ring-2 ring-neon-blue/20 bg-slate-700' : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700'}`}>
                                                    <div className="flex justify-between items-start mb-1 gap-2">
                                                        <h4 className={`font-bold text-sm truncate leading-tight flex-1 ${selectedClient?.id === client.id ? 'text-neon-blue' : 'text-white'}`}>{client.name}</h4>
                                                        <GripVertical className="text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" size={14} />
                                                    </div>
                                                    <p className="text-[11px] text-slate-400 font-mono">{client.phone}</p>
                                                </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className={`${!selectedClient ? 'hidden' : 'flex'} flex-col bg-slate-800 border lg:border-l border-slate-700 rounded-2xl lg:rounded-none lg:rounded-tr-2xl lg:rounded-br-2xl shadow-2xl overflow-hidden h-full animate-scale-in transition-all duration-300 ${viewMode === 'LIST' ? 'flex-1' : 'w-full lg:w-[550px] absolute lg:relative right-0 top-0 z-30'} min-h-0`}>
                {selectedClient ? (
                <>
                    <div className="p-4 sm:p-6 md:p-8 border-b border-slate-700 bg-slate-900/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-6 flex-shrink-0">
                        <div className="flex-1 min-w-0 w-full">
                            <div className="flex items-center gap-3 sm:gap-4 mb-3">
                                <button onClick={() => setSelectedClient(null)} className="p-2 bg-slate-700/50 text-slate-400 hover:text-white rounded-xl border border-slate-600 transition-colors shadow-sm flex-shrink-0" title="Voltar"><X size={20}/></button>
                                <div className="h-10 w-[1px] bg-slate-700 mx-1 hidden sm:block"></div>
                                <div className="min-w-0">
                                    {!isEditing ? (
                                        <>
                                            <div className="flex items-center gap-2">
                                                <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white truncate tracking-tight">{selectedClient.name}</h2>
                                                {canEditClient && <button onClick={() => { setEditForm({ name: selectedClient.name, email: selectedClient.email, phone: selectedClient.phone }); setIsEditing(true); }} className="text-slate-500 hover:text-neon-blue transition-colors p-1.5 bg-slate-800/50 rounded-lg border border-slate-700 flex-shrink-0"><Pencil size={14}/></button>}
                                            </div>
                                            <p className="text-xs sm:text-sm text-slate-400 font-medium truncate">{selectedClient.email || 'Sem e-mail'}</p>
                                        </>
                                    ) : <h2 className="text-lg sm:text-xl font-bold text-white uppercase tracking-wider text-neon-blue">Editando Cadastro</h2>}
                                </div>
                            </div>
                        </div>
                        {!isEditing ? (
                            <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
                                <button onClick={() => openWhatsApp(selectedClient.phone)} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl font-bold transition shadow-lg text-xs sm:text-sm"><MessageCircle size={18} /> WhatsApp</button>
                                {canCreateReservation && <button onClick={() => navigate('/agendamento', { state: { prefilledClient: selectedClient } })} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-neon-orange hover:bg-orange-600 text-white px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl font-bold transition shadow-lg text-xs sm:text-sm"><CalendarPlus size={18} /> Reservar</button>}
                            </div>
                        ) : (
                            <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
                                <button onClick={() => setIsEditing(false)} className="flex-1 sm:flex-none bg-slate-700 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm uppercase">Cancelar</button>
                                <button onClick={handleSaveClient} className="flex-1 sm:flex-none bg-neon-blue text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg text-xs sm:text-sm uppercase"><Save size={18} /> Salvar</button>
                            </div>
                        )}
                    </div>

                    {!isEditing && (
                        <div className="flex border-b border-slate-700 bg-slate-800/50 p-1 flex-shrink-0">
                            <button onClick={() => setDetailTab('INFO')} className={`flex-1 py-3 sm:py-4 text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all rounded-xl ${detailTab === 'INFO' ? 'bg-slate-700 text-white shadow-inner border border-slate-600' : 'text-slate-500 hover:text-slate-300'}`}>Histórico & Dados</button>
                            <button onClick={() => setDetailTab('LOYALTY')} className={`flex-1 py-3 sm:py-4 text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all rounded-xl flex items-center justify-center gap-1 sm:gap-2 ${detailTab === 'LOYALTY' ? 'bg-slate-700 text-white shadow-inner border border-slate-600' : 'text-slate-500 hover:text-slate-300'}`}><Gift size={16}/> Fidelidade <span className="bg-slate-900 text-[10px] px-2 py-0.5 rounded-full text-neon-orange border border-neon-orange/20 font-bold">{selectedClient.loyaltyBalance || 0} pts</span></button>
                        </div>
                    )}

                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 custom-scrollbar bg-slate-900/10 min-h-0">
                        {isEditing ? (
                            <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
                                <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-700 space-y-4">
                                    <div><label className="block text-[10px] uppercase font-bold text-slate-500 mb-2">Nome Completo</label><input className="w-full bg-slate-800 border border-slate-600 rounded-xl p-4 text-white outline-none focus:ring-2 focus:ring-neon-blue/30 transition-all font-medium" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} /></div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div><label className="block text-[10px] uppercase font-bold text-slate-500 mb-2">WhatsApp / Fone</label><input className="w-full bg-slate-800 border border-slate-600 rounded-xl p-4 text-white outline-none focus:ring-2 focus:ring-neon-blue/30 transition-all font-mono" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} /></div>
                                        <div><label className="block text-[10px] uppercase font-bold text-slate-500 mb-2">E-mail</label><input className="w-full bg-slate-800 border border-slate-600 rounded-xl p-4 text-white outline-none focus:ring-2 focus:ring-neon-blue/30 transition-all font-medium" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} /></div>
                                    </div>
                                </div>
                            </div>
                        ) : detailTab === 'INFO' ? (
                            <div className="space-y-6 sm:space-y-8 animate-fade-in">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-slate-900/30 p-4 sm:p-5 rounded-2xl border border-slate-700/50 shadow-sm"><p className="text-slate-500 text-[10px] uppercase font-bold mb-1">WhatsApp Principal</p><p className="text-white font-mono font-bold text-base sm:text-lg flex items-center gap-3"><MessageCircle size={18} className="text-green-500"/> {selectedClient.phone}</p></div>
                                    <div className="bg-slate-900/30 p-4 sm:p-5 rounded-2xl border border-slate-700/50 shadow-sm"><p className="text-slate-500 text-[10px] uppercase font-bold mb-1">Última Interação</p><p className="text-white text-base sm:text-lg font-bold flex items-center gap-3"><Clock size={18} className="text-neon-blue"/> {selectedClient.lastContactAt ? new Date(selectedClient.lastContactAt).toLocaleDateString('pt-BR') : 'N/A'}</p></div>
                                </div>

                                <div>
                                    <h3 className="text-[10px] font-bold text-slate-400 mb-4 uppercase tracking-widest flex items-center gap-2 border-l-4 border-neon-orange pl-3">Fase no Funil de Vendas</h3>
                                    <div className="flex flex-wrap gap-2">{funnelStages.map(stage => { const isActive = selectedClient.funnelStage === stage.nome; return (<button key={stage.id} disabled={!canEditClient || isUpdatingStage} onClick={() => updateClientStage(selectedClient.id, stage.nome)} className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border shadow-sm ${isActive ? 'bg-neon-orange text-white border-neon-orange shadow-orange-900/20' : 'bg-slate-900 text-slate-500 border-slate-700 hover:border-slate-500 hover:text-slate-300'} ${!canEditClient ? 'opacity-50' : 'active:scale-95'}`}>{isActive && <Check size={14} className="inline mr-1"/>}{stage.nome}</button>);})}</div>
                                </div>

                                <div>
                                    <h3 className="text-[10px] font-bold text-slate-400 mb-4 uppercase tracking-widest flex items-center gap-2 border-l-4 border-neon-blue pl-3">Histórico de Visitas (Agenda)</h3>
                                    <div className="space-y-4">
                                    {clientHistory.length === 0 ? <div className="text-center py-12 bg-slate-900/20 border-2 border-dashed border-slate-700 rounded-3xl text-slate-600 italic font-medium uppercase text-[10px] tracking-widest">Nenhuma reserva registrada</div> : clientHistory.map(res => {
                                        const isCheckedIn = res.checkedInIds && res.checkedInIds.length > 0;
                                        const isNoShow = res.noShowIds && res.noShowIds.length > 0;
                                        const needsPaymentAlert = res.paymentStatus === PaymentStatus.PENDENTE;

                                        let cardStyle = 'border-slate-700 bg-slate-800';
                                        if (isCheckedIn) cardStyle = 'border-green-500/50 bg-slate-900 opacity-90';
                                        else if (isNoShow) cardStyle = 'border-red-500/50 bg-red-900/10 grayscale opacity-70';
                                        else if (res.status === ReservationStatus.CONFIRMADA) cardStyle = 'border-neon-blue/50 bg-blue-900/10';
                                        else if (res.status === ReservationStatus.PENDENTE) cardStyle = 'border-yellow-500/50 bg-yellow-900/10';

                                        return (
                                        <div key={res.id} className={`p-4 rounded-xl border shadow-lg transition overflow-hidden group ${cardStyle}`}>
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="min-w-0 pr-2">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-sm font-bold text-white tracking-tight">{res.date.split('-').reverse().join('/')}</span>
                                                        <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                                                        <span className="text-neon-blue font-bold text-sm">{res.time}</span>
                                                    </div>
                                                    
                                                    {needsPaymentAlert && res.status !== ReservationStatus.CANCELADA && (
                                                        <div className="mt-1 flex items-center gap-1 text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded font-bold uppercase animate-pulse w-fit">
                                                            <DollarSign size={10} /> PGTO PENDENTE
                                                        </div>
                                                    )}

                                                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                                                        {isCheckedIn ? <span className="text-[9px] font-bold text-green-400 bg-green-500/20 px-1.5 py-0.5 rounded uppercase border border-green-500/30">CHECK-IN</span> : isNoShow ? <span className="text-[9px] font-bold text-red-400 bg-red-600/20 px-1.5 py-0.5 rounded uppercase border border-red-500/30">NO-SHOW</span> : <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase border ${res.status === ReservationStatus.CONFIRMADA ? 'text-neon-blue bg-blue-900/40 border-neon-blue/30' : res.status === ReservationStatus.PENDENTE ? 'text-yellow-400 bg-yellow-900/40 border-yellow-500/30' : 'text-slate-400 bg-slate-800 border-slate-700'}`}>{res.status}</span>}
                                                        {res.payOnSite && res.status === ReservationStatus.PENDENTE && (
                                                            <span className="text-[9px] font-bold text-white bg-slate-600 px-1.5 py-0.5 rounded flex items-center gap-1"><Store size={10}/> Local</span>
                                                        )}
                                                        {res.comandaId && (
                                                            <span className="text-[9px] font-bold text-white bg-purple-600 px-1.5 py-0.5 rounded flex items-center gap-1"><Hash size={10}/> {res.comandaId}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-base font-bold text-green-400">{res.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                                    <div className="flex flex-col gap-1 mt-1">
                                                        <span className="text-[9px] text-slate-500 font-bold uppercase flex items-center justify-end gap-1"><LayoutGrid size={10}/> {res.laneCount} Pistas</span>
                                                        <span className="text-[9px] text-slate-500 font-bold uppercase flex items-center justify-end gap-1"><Users size={10}/> {res.peopleCount} Pessoas</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {isCheckedIn && res.lanesAssigned && res.lanesAssigned.length > 0 && (
                                                <div className="flex gap-1.5 mb-3 p-2 bg-slate-900/50 rounded-lg border border-slate-700/50">
                                                    {res.lanesAssigned.map(l => (
                                                        <span key={l} className="w-6 h-6 rounded-full bg-neon-blue text-white flex items-center justify-center text-[10px] font-black shadow-sm shadow-blue-500/50 border border-white/10">{l}</span>
                                                    ))}
                                                    <span className="text-[9px] text-slate-500 font-bold uppercase ml-1 self-center">Pistas em Uso</span>
                                                </div>
                                            )}

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-700/50">
                                                <div className="flex items-center gap-2"><div className="p-1 bg-slate-700/50 rounded text-slate-400"><FileText size={12}/></div><span className="text-[10px] text-slate-300 font-medium truncate">{res.eventType}</span></div>
                                                {res.hasTableReservation && (
                                                    <div className="flex flex-col gap-1 bg-slate-900/30 p-2 rounded-lg border border-neon-orange/10">
                                                        <span className="text-[9px] font-bold text-neon-orange uppercase flex items-center gap-1"><Utensils size={10} /> Mesa: {res.tableSeatCount} lug.</span>
                                                        {res.birthdayName && <span className="text-[9px] text-neon-blue flex items-center gap-1 truncate font-bold"><Cake size={10} /> {res.birthdayName}</span>}
                                                    </div>
                                                )}
                                            </div>

                                            {res.observations && (
                                                <div className="mt-3 p-2 bg-slate-950/30 rounded text-[10px] text-slate-400 italic border-l-2 border-slate-700">"{res.observations}"</div>
                                            )}
                                        </div>
                                    )})}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-10 animate-fade-in max-w-2xl mx-auto">
                                <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 sm:p-10 rounded-3xl border border-neon-orange/20 shadow-2xl flex flex-col items-center justify-center gap-6 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-neon-orange/5 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-neon-orange/10 transition-colors"></div>
                                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-neon-orange/10 rounded-2xl flex items-center justify-center text-neon-orange border border-neon-orange/20 shadow-inner group-hover:rotate-6 transition-transform"><Coins size={44}/></div>
                                    <div className="text-center relative z-10 font-sans">
                                        <p className="text-slate-500 text-[10px] sm:text-xs uppercase font-bold tracking-widest mb-2 opacity-70">Saldo Atualizado</p>
                                        <div className="flex items-baseline justify-center gap-2">
                                            <h3 className="text-5xl sm:text-6xl font-extrabold text-white tracking-tighter">{selectedClient.loyaltyBalance || 0}</h3>
                                            <span className="text-lg sm:text-xl text-neon-orange font-bold uppercase tracking-wider">pts</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 border-l-2 border-slate-600 pl-3">Extrato de Movimentações</h3>
                                    <div className="bg-slate-900/50 rounded-2xl border border-slate-700/50 overflow-hidden shadow-sm">{loadingLoyalty ? (<div className="flex justify-center py-20"><Loader2 className="animate-spin text-neon-orange" size={32}/></div>) : loyaltyHistory.length === 0 ? (<div className="text-center py-16 text-slate-600 italic font-medium uppercase text-xs tracking-widest">Sem movimentações</div>) : (<div className="divide-y divide-slate-800">{loyaltyHistory.map(t => (
                                        <div key={t.id} className="p-4 sm:p-5 flex justify-between items-center hover:bg-slate-800/40 transition-colors group">
                                            <div className="min-w-0 pr-4"><p className="text-white font-bold text-sm mb-1 group-hover:text-neon-orange transition-colors truncate">{t.description}</p><p className="text-[10px] text-slate-500 font-bold uppercase flex items-center gap-2"><Clock size={12}/> {new Date(t.createdAt).toLocaleDateString('pt-BR')}</p></div>
                                            <div className={`font-mono font-bold text-lg sm:text-xl flex items-center gap-1 flex-shrink-0 ${t.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>{t.amount > 0 ? <ArrowUp size={18}/> : <ArrowDown size={18}/>}{Math.abs(t.amount)}</div>
                                        </div>
                                    ))}</div>)}</div>
                                </div>
                            </div>
                        )}
                    </div>
                </>
                ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-700 p-12 text-center font-sans h-full">
                    <div className="w-24 h-24 bg-slate-800/50 rounded-full flex items-center justify-center mb-6 border border-slate-700/50">
                        <Users size={48} className="opacity-10" />
                    </div>
                    <p className="font-bold uppercase tracking-widest text-xs text-slate-600 max-w-xs leading-loose">Selecione um cliente para visualizar perfil completo e histórico</p>
                </div>
                )}
            </div>
      </div>
    </div>
  );
};

export default CRM;
