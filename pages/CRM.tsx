
import React, { useEffect, useState, useRef } from 'react';
import { db, cleanPhone } from '../services/mockBackend';
import { Client, Reservation, FunnelStage, User, UserRole, ReservationStatus, LoyaltyTransaction } from '../types';
import { FUNNEL_STAGES } from '../constants';
import { Search, MessageCircle, Calendar, Tag, Plus, Users, Loader2, LayoutList, Kanban as KanbanIcon, GripVertical, Pencil, Save, X, Crown, Star, Sparkles, Clock, LayoutGrid, Gift, Coins, History, ArrowDown, ArrowUp, CalendarPlus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';

const CRM: React.FC = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'LIST' | 'KANBAN'>('LIST');
  const [clients, setClients] = useState<Client[]>([]);
  
  // Server-side Pagination & Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize] = useState(50);
  const searchTimeoutRef = useRef<any>(null);

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientHistory, setClientHistory] = useState<Reservation[]>([]);
  
  // Métricas simplificadas (apenas para o cliente selecionado)
  const [selectedClientTier, setSelectedClientTier] = useState<'VIP' | 'FIEL' | 'NOVO'>('NOVO');
  
  const [loading, setLoading] = useState(true);
  
  // Loyalty State
  const [loyaltyHistory, setLoyaltyHistory] = useState<LoyaltyTransaction[]>([]);
  const [loadingLoyalty, setLoadingLoyalty] = useState(false);
  const [adjustPoints, setAdjustPoints] = useState<string>('');
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [detailTab, setDetailTab] = useState<'INFO' | 'LOYALTY'>('INFO');

  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Editing State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Client>>({});

  useEffect(() => {
    const stored = localStorage.getItem('tonapista_auth');
    if (stored) setCurrentUser(JSON.parse(stored));
  }, []);

  // Permission Check
  const canEditClient = currentUser?.role === UserRole.ADMIN || currentUser?.perm_edit_client;
  const canCreateReservation = currentUser?.role === UserRole.ADMIN || currentUser?.perm_create_reservation;

  const fetchClients = async (page: number, search: string) => {
    setLoading(true);
    try {
        const { data, count } = await db.clients.list(page, pageSize, search);
        setClients(data);
        setTotalCount(count);
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
      fetchClients(currentPage, searchTerm);
  }, [currentPage]);

  // Debounced Search
  const handleSearch = (val: string) => {
      setSearchTerm(val);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = setTimeout(() => {
          setCurrentPage(1); // Reset page on new search
          fetchClients(1, val);
      }, 600);
  };

  // Load Client Details (History & Loyalty) ONLY when selected
  useEffect(() => {
    const fetchDetails = async () => {
      if (selectedClient) {
        // CORREÇÃO DE PERFORMANCE: Usar getByClientId em vez de getAll + filter
        // Isso evita baixar milhares de reservas de outros clientes
        const history = await db.reservations.getByClientId(selectedClient.id);
        
        const sortedHistory = history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setClientHistory(sortedHistory);

        // Calculate Tier
        const recentReservations = history.filter(r => r.status !== ReservationStatus.CANCELADA);
        const totalSlots = recentReservations.reduce((acc, curr) => acc + (curr.laneCount * curr.duration), 0);
        
        let tier: 'VIP' | 'FIEL' | 'NOVO' = 'NOVO';
        if (totalSlots >= 20) tier = 'VIP';
        else if (totalSlots >= 6) tier = 'FIEL';
        setSelectedClientTier(tier);

        // Loyalty History
        if (detailTab === 'LOYALTY') {
            setLoadingLoyalty(true);
            try {
                const loyalty = await db.loyalty.getHistory(selectedClient.id);
                setLoyaltyHistory(loyalty);
            } catch(e) { console.error(e); }
            finally { setLoadingLoyalty(false); }
        }
      }
    };
    fetchDetails();
  }, [selectedClient, detailTab]);

  const openWhatsApp = (phone: string) => {
    const clean = phone.replace(/\D/g, '');
    window.open(`https://wa.me/55${clean}`, '_blank');
  };

  const handleDragStart = (e: React.DragEvent, clientId: string) => {
    if (!canEditClient) return;
    e.dataTransfer.setData('clientId', clientId);
  };

  const handleDrop = async (e: React.DragEvent, newStage: FunnelStage) => {
    e.preventDefault();
    if (!canEditClient) { alert("Sem permissão."); return; }
    const clientId = e.dataTransfer.getData('clientId');
    if (!clientId) return;

    // Optimistic update
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, funnelStage: newStage } : c));
    await db.clients.updateStage(clientId, newStage);
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  
  // Used only for Kanban view - Note: Kanban only shows loaded clients (current page)
  const getClientsByStage = (stage: FunnelStage) => {
      return clients.filter(c => (c.funnelStage || FunnelStage.NOVO) === stage);
  };

  const startEditing = () => {
      if (!canEditClient) return;
      if (!selectedClient) return;
      setEditForm({
          name: selectedClient.name,
          email: selectedClient.email,
          phone: selectedClient.phone,
          tags: selectedClient.tags 
      });
      setIsEditing(true);
  };

  const handleSaveClient = async () => {
      if (!canEditClient) return;
      if (!selectedClient || !editForm) return;
      
      const updatedClient = { ...selectedClient, ...editForm };
      await db.clients.update(updatedClient);
      
      setSelectedClient(updatedClient);
      // Update local list
      setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));
      setIsEditing(false);
  };

  const handleAdjustPoints = async () => {
      if (!selectedClient || !adjustPoints || !adjustReason) return;
      const amount = parseInt(adjustPoints);
      if (isNaN(amount) || amount === 0) return;

      try {
          await db.loyalty.addTransaction(selectedClient.id, amount, adjustReason, currentUser?.id);
          const updatedClient = await db.clients.getById(selectedClient.id);
          if (updatedClient) {
            setSelectedClient(updatedClient);
            setClients(prev => prev.map(c => c.id === updatedClient.id ? updatedClient : c));
          }
          const loyalty = await db.loyalty.getHistory(selectedClient.id);
          setLoyaltyHistory(loyalty);
          setAdjustPoints('');
          setAdjustReason('');
          alert("Pontos atualizados!");
      } catch (e) {
          console.error(e);
          alert("Erro ao atualizar pontos.");
      }
  };

  const handleNewReservationForClient = () => {
      if (!selectedClient) return;
      navigate('/agendamento', { state: { prefilledClient: selectedClient } });
  };

  const totalHistorySlots = clientHistory.reduce((acc, h) => acc + (h.laneCount * h.duration), 0);
  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="h-full flex flex-col pb-20 md:pb-0">
      
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <h1 className="text-2xl md:text-3xl font-bold text-white">Gestão de Clientes</h1>
            <span className="bg-slate-800 border border-slate-700 text-neon-blue px-3 py-1 rounded-full text-sm font-bold shadow-sm flex items-center gap-1">
               <Users size={14} />
               {totalCount} total
            </span>
          </div>
          
          <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700 w-full md:w-auto justify-center md:justify-end">
             <button 
               onClick={() => setViewMode('LIST')}
               className={`flex-1 md:flex-none px-4 py-2 rounded flex items-center justify-center gap-2 text-sm font-bold transition ${viewMode === 'LIST' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}
             >
                <LayoutList size={18} /> Lista
             </button>
             <button 
               onClick={() => setViewMode('KANBAN')}
               className={`flex-1 md:flex-none px-4 py-2 rounded flex items-center justify-center gap-2 text-sm font-bold transition ${viewMode === 'KANBAN' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'}`}
             >
                <KanbanIcon size={18} /> Funil
             </button>
          </div>
      </div>

      {viewMode === 'LIST' ? (
          <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden min-h-0">
                <div className={`${selectedClient ? 'hidden lg:flex' : 'flex'} flex-col w-full lg:w-1/3 bg-slate-800 border border-slate-700 rounded-xl shadow-lg overflow-hidden lg:max-h-[850px] max-h-[500px]`}>
                    <div className="p-4 border-b border-slate-700 bg-slate-900/50">
                        <div className="relative">
                            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                            <input 
                            type="text" 
                            placeholder="Buscar por nome ou telefone..."
                            className="w-full bg-slate-700 text-white pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-neon-blue"
                            value={searchTerm}
                            onChange={e => handleSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto max-h-[400px] lg:max-h-full">
                    {loading ? (
                        <div className="flex justify-center p-8"><Loader2 className="animate-spin text-neon-blue"/></div>
                    ) : clients.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">Nenhum cliente encontrado.</div>
                    ) : clients.map(client => (
                        <div 
                        key={client.id}
                        onClick={() => { setSelectedClient(client); setIsEditing(false); setDetailTab('INFO'); }}
                        className={`p-4 border-b border-slate-700 cursor-pointer hover:bg-slate-700/50 transition ${selectedClient?.id === client.id ? 'bg-slate-700/80 border-l-4 border-l-neon-blue' : ''}`}
                        >
                        <div className="flex justify-between items-start">
                            <h3 className="font-bold text-white truncate pr-2 flex-1 text-sm md:text-base">{client.name}</h3>
                            {client.loyaltyBalance ? <span className="text-[10px] bg-slate-900 px-1.5 py-0.5 rounded text-neon-orange border border-slate-700">{client.loyaltyBalance} pts</span> : null}
                        </div>
                        <div className="flex justify-between items-center mt-1">
                             <p className="text-xs md:text-sm text-slate-400">{client.phone}</p>
                        </div>
                        </div>
                    ))}
                    </div>
                    {/* PAGINATION CONTROLS */}
                    <div className="p-3 border-t border-slate-700 bg-slate-900/50 flex justify-between items-center">
                        <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="p-2 bg-slate-700 rounded hover:bg-slate-600 disabled:opacity-50"><ChevronLeft size={16}/></button>
                        <span className="text-xs text-slate-400">Pág {currentPage} de {totalPages || 1}</span>
                        <button disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-2 bg-slate-700 rounded hover:bg-slate-600 disabled:opacity-50"><ChevronRight size={16}/></button>
                    </div>
                </div>

                <div className={`${!selectedClient ? 'hidden lg:flex' : 'flex'} flex-1 flex-col bg-slate-800 border border-slate-700 rounded-xl shadow-lg overflow-hidden`}>
                    {selectedClient ? (
                    <>
                        <div className="p-4 md:p-6 border-b border-slate-700 bg-slate-900/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <button onClick={() => setSelectedClient(null)} className="lg:hidden text-slate-400 text-sm mb-2 flex items-center gap-1"><X size={14}/> Fechar Detalhes</button>
                                {!isEditing ? (
                                    <>
                                        <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-1">
                                            <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
                                                {selectedClient.name}
                                            </h2>
                                            {selectedClientTier === 'VIP' && (
                                                <div className="flex items-center gap-1 bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded-full text-xs font-bold border border-yellow-500/30">
                                                    <Crown size={12} fill="currentColor"/> VIP
                                                </div>
                                            )}
                                            {selectedClientTier === 'FIEL' && (
                                                <div className="flex items-center gap-1 bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full text-xs font-bold border border-blue-500/30">
                                                    <Star size={12} fill="currentColor"/> Fiel
                                                </div>
                                            )}

                                            {canEditClient && (
                                                <button onClick={startEditing} className="text-slate-500 hover:text-white transition p-1 ml-1 bg-slate-800 rounded-full"><Pencil size={14}/></button>
                                            )}
                                        </div>
                                        <p className="text-sm text-slate-400">{selectedClient.email || 'Sem e-mail'}</p>
                                    </>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-xl font-bold text-white">Editando Cliente</h2>
                                    </div>
                                )}
                            </div>
                            
                            {!isEditing ? (
                                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                                    <button 
                                        onClick={() => openWhatsApp(selectedClient.phone)}
                                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-medium transition shadow-[0_0_10px_rgba(34,197,94,0.3)]"
                                    >
                                        <MessageCircle size={18} /> <span className="hidden xl:inline">WhatsApp</span>
                                    </button>
                                    {canCreateReservation && (
                                        <button 
                                            onClick={handleNewReservationForClient}
                                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-neon-orange hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium transition shadow-lg"
                                        >
                                            <CalendarPlus size={18} /> <span>Nova Reserva</span>
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="flex gap-2 w-full sm:w-auto">
                                    <button 
                                        onClick={() => setIsEditing(false)} 
                                        className="flex-1 sm:flex-none bg-slate-700 text-white px-3 py-2 rounded hover:bg-slate-600"
                                    >
                                        <X size={18} />
                                    </button>
                                    <button 
                                        disabled={!canEditClient}
                                        onClick={handleSaveClient} 
                                        className="flex-1 sm:flex-none bg-neon-blue text-white px-3 py-2 rounded hover:bg-blue-600 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Save size={18} /> Salvar
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* TABS DE DETALHE */}
                        {!isEditing && (
                            <div className="flex border-b border-slate-700 bg-slate-800">
                                <button 
                                    onClick={() => setDetailTab('INFO')}
                                    className={`flex-1 py-3 text-sm font-bold border-b-2 transition ${detailTab === 'INFO' ? 'border-neon-blue text-white bg-slate-700/50' : 'border-transparent text-slate-400 hover:text-white'}`}
                                >
                                    Dados e Histórico
                                </button>
                                <button 
                                    onClick={() => setDetailTab('LOYALTY')}
                                    className={`flex-1 py-3 text-sm font-bold border-b-2 transition flex items-center justify-center gap-2 ${detailTab === 'LOYALTY' ? 'border-neon-orange text-white bg-slate-700/50' : 'border-transparent text-slate-400 hover:text-white'}`}
                                >
                                    <Gift size={16}/> Fidelidade 
                                    <span className="bg-slate-900 text-[10px] px-1.5 rounded-full text-slate-300">{selectedClient.loyaltyBalance || 0}</span>
                                </button>
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 md:space-y-8">
                            
                            {isEditing ? (
                                <div className="space-y-4 animate-fade-in bg-slate-900/30 p-4 rounded-lg border border-slate-700">
                                    <div><label className="block text-xs text-slate-400 mb-1">Nome Completo</label><input className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} /></div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div><label className="block text-xs text-slate-400 mb-1">Telefone</label><input className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} /></div>
                                        <div><label className="block text-xs text-slate-400 mb-1">E-mail</label><input className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} /></div>
                                    </div>
                                    <div><label className="block text-xs text-slate-400 mb-1">Tags (separadas por vírgula)</label><input className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white" value={editForm.tags?.join(', ')} onChange={e => setEditForm({...editForm, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)})} placeholder="Ex: VIP, Empresa, Aniversário" /></div>
                                </div>
                            ) : detailTab === 'INFO' ? (
                                <>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
                                            <p className="text-slate-500 text-xs uppercase font-bold">Telefone</p>
                                            <p className="text-white font-mono text-sm md:text-base">{selectedClient.phone}</p>
                                        </div>
                                        <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 relative overflow-hidden">
                                            <p className="text-slate-500 text-xs uppercase font-bold relative z-10">Classificação</p>
                                            <div className="relative z-10 mt-1 flex items-center gap-2">
                                                {selectedClientTier === 'VIP' ? <span className="text-yellow-500 font-bold flex items-center gap-1 text-sm md:text-base"><Crown size={16} fill="currentColor"/> VIP</span> : selectedClientTier === 'FIEL' ? <span className="text-blue-400 font-bold flex items-center gap-1 text-sm md:text-base"><Star size={16} fill="currentColor"/> FIEL</span> : <span className="text-slate-400 font-bold flex items-center gap-1 text-sm md:text-base"><Sparkles size={16}/> NOVO / OCASIONAL</span>}
                                            </div>
                                        </div>
                                        <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 sm:col-span-2 lg:col-span-1">
                                            <p className="text-slate-500 text-xs uppercase font-bold">Último contato</p>
                                            <p className="text-white text-sm md:text-base">{new Date(selectedClient.lastContactAt).toLocaleDateString('pt-BR')}</p>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-base md:text-lg font-bold text-white mb-3 flex items-center gap-2"><Tag size={18} className="text-neon-blue"/> Tags</h3>
                                        <div className="flex flex-wrap gap-2">{selectedClient.tags.map(t => <span key={t} className="bg-neon-blue/10 text-neon-blue border border-neon-blue/30 px-3 py-1 rounded-full text-xs md:text-sm">{t}</span>)}{selectedClient.tags.length === 0 && <span className="text-slate-500 italic text-sm">Sem tags.</span>}</div>
                                    </div>

                                    <div>
                                        <h3 className="text-base md:text-lg font-bold text-white mb-3 flex items-center gap-2"><Calendar size={18} className="text-neon-orange"/> Histórico <span className="text-xs md:text-sm font-normal text-slate-400 ml-2">({clientHistory.length} pedidos / {totalHistorySlots} horas totais)</span></h3>
                                        <div className="space-y-2">
                                        {clientHistory.length === 0 ? <p className="text-slate-500 italic">Nenhuma reserva encontrada.</p> : clientHistory.map(h => (
                                            <div key={h.id} className="flex flex-col md:flex-row md:items-center justify-between bg-slate-700/30 p-3 rounded-lg border border-slate-700 gap-2">
                                                <div>
                                                    <div className="flex items-center gap-2"><span className="text-white font-medium text-sm md:text-base">{new Date(h.date).toLocaleDateString('pt-BR')}</span><span className="text-slate-400">|</span><span className="text-slate-300 text-sm">{h.eventType}</span></div>
                                                    {h.clientId !== selectedClient.id && <span className="text-[10px] uppercase text-neon-blue font-bold bg-neon-blue/10 px-1 rounded mt-1 inline-block">Segundo Responsável</span>}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2 md:gap-4 md:justify-end">
                                                     <div className="flex items-center gap-2 text-[10px] md:text-xs text-slate-400 bg-slate-800/50 px-2 py-1 rounded border border-slate-600"><span className="flex items-center gap-1"><LayoutGrid size={12}/> {h.laneCount}</span><span>x</span><span className="flex items-center gap-1"><Clock size={12}/> {h.duration}h</span><span>=</span><span className="text-white font-bold">{(h.laneCount * h.duration)} reserva(s)</span></div>
                                                    <div className="text-right"><span className={`text-[10px] md:text-xs px-2 py-1 rounded block ${h.status === 'Confirmada' ? 'bg-green-500/20 text-green-400' : 'bg-slate-600 text-slate-300'}`}>{h.status}</span></div>
                                                </div>
                                            </div>
                                        ))}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                // --- FIDELIDADE TAB ---
                                <div className="space-y-6 animate-fade-in">
                                    <div className="bg-slate-900 p-6 rounded-xl border border-neon-orange/30 shadow-lg flex flex-col md:flex-row items-center justify-between gap-6">
                                        <div className="flex items-center gap-4">
                                            <div className="w-16 h-16 bg-neon-orange/20 rounded-full flex items-center justify-center text-neon-orange border border-neon-orange/50">
                                                <Coins size={32}/>
                                            </div>
                                            <div>
                                                <p className="text-slate-400 text-sm uppercase font-bold tracking-wider">Saldo Atual</p>
                                                <h3 className="text-4xl font-bold text-white">{selectedClient.loyaltyBalance || 0} <span className="text-lg text-neon-orange">pts</span></h3>
                                            </div>
                                        </div>
                                        
                                        {canEditClient && (
                                            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 flex flex-col gap-2 w-full md:w-auto">
                                                <p className="text-xs text-slate-400 font-bold mb-1">Ajuste Manual</p>
                                                <div className="flex gap-2">
                                                    <input 
                                                        type="number" 
                                                        className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white w-20 text-sm" 
                                                        placeholder="+/-"
                                                        value={adjustPoints}
                                                        onChange={e => setAdjustPoints(e.target.value)}
                                                    />
                                                    <input 
                                                        type="text" 
                                                        className="bg-slate-900 border border-slate-600 rounded px-2 py-1 text-white w-32 text-sm" 
                                                        placeholder="Motivo"
                                                        value={adjustReason}
                                                        onChange={e => setAdjustReason(e.target.value)}
                                                    />
                                                    <button onClick={handleAdjustPoints} className="bg-slate-700 hover:bg-slate-600 text-white px-3 rounded text-sm"><Save size={14}/></button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><History size={20} className="text-slate-400"/> Extrato de Pontos</h3>
                                        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden min-h-[200px]">
                                            {loadingLoyalty ? (
                                                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-neon-orange"/></div>
                                            ) : loyaltyHistory.length === 0 ? (
                                                <div className="text-center py-8 text-slate-500 italic">Nenhuma transação encontrada.</div>
                                            ) : (
                                                <div className="divide-y divide-slate-700">
                                                    {loyaltyHistory.map(t => (
                                                        <div key={t.id} className="p-4 flex justify-between items-center hover:bg-slate-700/30">
                                                            <div>
                                                                <p className="text-white font-medium">{t.description}</p>
                                                                <p className="text-xs text-slate-500">{new Date(t.createdAt).toLocaleString('pt-BR')}</p>
                                                            </div>
                                                            <div className={`font-bold font-mono text-lg flex items-center gap-1 ${t.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                                {t.amount > 0 ? <ArrowUp size={16}/> : <ArrowDown size={16}/>}
                                                                {t.amount > 0 ? '+' : ''}{t.amount}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>
                    </>
                    ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8">
                        <Users size={64} className="mb-4 opacity-20" />
                        <p>Selecione um cliente para ver detalhes</p>
                    </div>
                    )}
                </div>
          </div>
      ) : (
          <div className="flex-1 overflow-x-auto overflow-y-hidden">
                <div className="p-4 text-center text-slate-500 bg-slate-900/50 rounded-lg border border-slate-800 mx-4">
                    <p className="mb-2">A visualização Kanban exibe apenas os clientes carregados na página atual.</p>
                    <p className="text-xs">Use a visualização em Lista para buscar clientes específicos.</p>
                </div>
                {loading ? (
                    <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin text-neon-blue" size={48} /></div>
                ) : (
                    <div className="flex gap-4 h-full min-w-[1200px] pb-4 px-4 lg:px-0 pt-4">
                        {FUNNEL_STAGES.map((stage) => {
                            const stageClients = getClientsByStage(stage);
                            return (
                                <div key={stage} className="flex-1 min-w-[280px] bg-slate-800/50 rounded-xl border border-slate-700 flex flex-col" onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, stage)}>
                                    <div className="p-4 border-b border-slate-700 font-bold text-slate-300 flex justify-between items-center sticky top-0 bg-slate-800 rounded-t-xl z-10"><span>{stage}</span><span className="bg-slate-700 text-xs px-2 py-1 rounded-full text-slate-400">{stageClients.length}</span></div>
                                    <div className="p-3 space-y-3 flex-1 overflow-y-auto">
                                        {stageClients.map(client => (
                                        <div key={client.id} draggable onDragStart={(e) => handleDragStart(e, client.id)} className={`bg-slate-700 p-4 rounded-lg shadow-sm border border-slate-600 transition group relative ${canEditClient ? 'cursor-grab active:cursor-grabbing hover:border-neon-blue hover:shadow-md' : 'cursor-default'}`}>
                                            <div className="flex justify-between items-start mb-2"><h4 className="font-bold text-white text-sm md:text-base">{client.name}</h4>{canEditClient && (<GripVertical className="text-slate-500 opacity-0 group-hover:opacity-100 transition" size={16} />)}</div>
                                            <p className="text-xs text-slate-400">{client.phone}</p>
                                            <p className="text-[10px] md:text-xs text-slate-500 mt-2">Último: {new Date(client.lastContactAt).toLocaleDateString('pt-BR')}</p>
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
  );
};

export default CRM;
