

import React, { useEffect, useState, useMemo } from 'react';
import { db, cleanPhone } from '../services/mockBackend';
import { Client, Reservation, FunnelStage, User, UserRole, ReservationStatus } from '../types';
import { FUNNEL_STAGES } from '../constants';
import { Search, MessageCircle, Calendar, Tag, Plus, Users, Loader2, LayoutList, Kanban as KanbanIcon, GripVertical, Pencil, Save, X, Crown, Star, Sparkles, Clock, LayoutGrid } from 'lucide-react';

// Tipos de Classificação
type ClientTier = 'VIP' | 'FIEL' | 'NOVO';

const CRM: React.FC = () => {
  const [viewMode, setViewMode] = useState<'LIST' | 'KANBAN'>('LIST');
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientHistory, setClientHistory] = useState<Reservation[]>([]);
  const [clientMetrics, setClientMetrics] = useState<Record<string, { count: number, tier: ClientTier }>>({});
  const [loading, setLoading] = useState(true);
  
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

  const fetchData = async () => {
    setLoading(true);
    try {
        const [clientsData, reservationsData] = await Promise.all([
            db.clients.getAll(),
            db.reservations.getAll()
        ]);

        setClients(clientsData);

        // --- LÓGICA DE CLASSIFICAÇÃO (Últimos 3 meses) ---
        // ALTERADO: Agora conta SLOTS (Pistas * Horas) e não apenas IDs de reserva
        const metrics: Record<string, { count: number, tier: ClientTier }> = {};
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

        clientsData.forEach(client => {
            // Filtra reservas do cliente nos ultimos 3 meses (excluindo canceladas)
            const recentReservations = reservationsData.filter(r => 
                (r.clientId === client.id || (r.guests && r.guests.some(g => cleanPhone(g.phone) === cleanPhone(client.phone)))) &&
                r.status !== ReservationStatus.CANCELADA &&
                new Date(r.date) >= threeMonthsAgo
            );

            // Soma: Quantidade de Pistas * Duração em Horas
            const totalSlots = recentReservations.reduce((acc, curr) => {
                return acc + (curr.laneCount * curr.duration);
            }, 0);

            let tier: ClientTier = 'NOVO';
            // Ajuste dos critérios baseado em Slots (Volume)
            // Ex: 1 festa de 6 pistas x 4 horas = 24 slots -> Já vira VIP
            // Ex: 3 jogos normais de 1 pista x 2 horas = 6 slots -> Vira FIEL
            if (totalSlots >= 20) {
                tier = 'VIP';
            } else if (totalSlots >= 6) {
                tier = 'FIEL';
            }

            metrics[client.id] = { count: totalSlots, tier };
        });

        setClientMetrics(metrics);

    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const fetchHistory = async () => {
      if (selectedClient) {
        const allRes = await db.reservations.getAll();
        
        // Filter: Client is MAIN responsible OR Client is listed in GUESTS/Second Responsible
        const history = allRes.filter(r => {
            const isMain = r.clientId === selectedClient.id;
            const isGuest = r.guests?.some(g => cleanPhone(g.phone) === cleanPhone(selectedClient.phone));
            return isMain || isGuest;
        });

        // Ordena por data (mais recente primeiro)
        const sortedHistory = history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setClientHistory(sortedHistory);
      }
    };
    fetchHistory();
  }, [selectedClient]);

  // Lista Filtrada e Ordenada (A-Z)
  const filteredAndSortedClients = useMemo(() => {
    const filtered = clients.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone.includes(searchTerm) ||
        c.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // Ordenação A-Z
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [clients, searchTerm]);

  const openWhatsApp = (phone: string) => {
    const clean = phone.replace(/\D/g, '');
    window.open(`https://wa.me/55${clean}`, '_blank');
  };

  // --- KANBAN LOGIC ---
  const handleDragStart = (e: React.DragEvent, clientId: string) => {
    if (!canEditClient) return;
    e.dataTransfer.setData('clientId', clientId);
  };

  const handleDrop = async (e: React.DragEvent, newStage: FunnelStage) => {
    e.preventDefault();
    if (!canEditClient) {
        alert("Sem permissão para editar status do cliente.");
        return;
    }

    const clientId = e.dataTransfer.getData('clientId');
    if (!clientId) return;

    // Otimistic Update
    const updatedClients = clients.map(c => {
        if (c.id === clientId) return { ...c, funnelStage: newStage };
        return c;
    });
    setClients(updatedClients);

    // DB Update
    await db.clients.updateStage(clientId, newStage);
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  
  const getClientsByStage = (stage: FunnelStage) => {
      return filteredAndSortedClients.filter(c => (c.funnelStage || FunnelStage.NOVO) === stage);
  };

  // --- EDIT LOGIC ---
  const startEditing = () => {
      if (!canEditClient) return;
      if (!selectedClient) return;
      setEditForm({
          name: selectedClient.name,
          email: selectedClient.email,
          phone: selectedClient.phone,
          tags: selectedClient.tags // Keep as array
      });
      setIsEditing(true);
  };

  const handleSaveClient = async () => {
      if (!canEditClient) return;
      if (!selectedClient || !editForm) return;
      
      const updatedClient = {
          ...selectedClient,
          ...editForm
      };

      await db.clients.update(updatedClient);
      
      // Refresh local state
      setSelectedClient(updatedClient);
      fetchData(); // Refresh list to update metrics/names
      setIsEditing(false);
  };

  // Render Helpers
  const renderTierBadge = (clientId: string) => {
      const metric = clientMetrics[clientId] || { count: 0, tier: 'NOVO' };
      
      switch (metric.tier) {
          case 'VIP':
              return (
                  <div className="flex items-center gap-1 bg-yellow-500/10 text-yellow-500 px-2 py-1 rounded-md text-[10px] font-bold border border-yellow-500/20 shadow-[0_0_10px_rgba(234,179,8,0.1)]">
                      <Crown size={12} fill="currentColor" />
                      <span>VIP</span>
                  </div>
              );
          case 'FIEL':
              return (
                  <div className="flex items-center gap-1 bg-blue-500/10 text-blue-400 px-2 py-1 rounded-md text-[10px] font-bold border border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.1)]">
                      <Star size={12} fill="currentColor" />
                      <span>Fiel</span>
                  </div>
              );
          default:
               // Novo / Ocasional (Agora explícito, sem funil)
               return (
                  <div className="flex items-center gap-1 bg-slate-800 text-slate-500 px-2 py-1 rounded-md text-[10px] font-bold border border-slate-700">
                      <span>Novo</span>
                  </div>
               );
      }
  };

  // Cálculo do total de slots do histórico atual
  const totalHistorySlots = clientHistory.reduce((acc, h) => acc + (h.laneCount * h.duration), 0);

  return (
    <div className="h-full flex flex-col pb-20 md:pb-0">
      
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <h1 className="text-2xl md:text-3xl font-bold text-white">Gestão de Clientes</h1>
            <span className="bg-slate-800 border border-slate-700 text-neon-blue px-3 py-1 rounded-full text-sm font-bold shadow-sm flex items-center gap-1">
               <Users size={14} />
               {loading ? '...' : clients.length}
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
          // --- VIEW: LIST ---
          // Alterado para lg:flex-row. Em Tablet (md), fica flex-col (empilhado)
          <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden min-h-0">
                {/* Contact List */}
                <div className={`${selectedClient ? 'hidden lg:flex' : 'flex'} flex-col w-full lg:w-1/3 bg-slate-800 border border-slate-700 rounded-xl shadow-lg overflow-hidden lg:max-h-[850px] max-h-[500px]`}>
                    <div className="p-4 border-b border-slate-700 bg-slate-900/50">
                    <div className="relative">
                        <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                        <input 
                        type="text" 
                        placeholder="Buscar cliente..."
                        className="w-full bg-slate-700 text-white pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-neon-blue"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    </div>
                    {/* LISTA COM SCROLL LIMITADO EM DESKTOP (~10 ITENS) */}
                    <div className="flex-1 overflow-y-auto max-h-[400px] lg:max-h-full">
                    {loading ? (
                        <div className="flex justify-center p-8"><Loader2 className="animate-spin text-neon-blue"/></div>
                    ) : filteredAndSortedClients.map(client => (
                        <div 
                        key={client.id}
                        onClick={() => { setSelectedClient(client); setIsEditing(false); }}
                        className={`p-4 border-b border-slate-700 cursor-pointer hover:bg-slate-700/50 transition ${selectedClient?.id === client.id ? 'bg-slate-700/80 border-l-4 border-l-neon-blue' : ''}`}
                        >
                        <div className="flex justify-between items-start">
                            <h3 className="font-bold text-white truncate pr-2 flex-1 text-sm md:text-base">{client.name}</h3>
                            {renderTierBadge(client.id)}
                        </div>
                        <div className="flex justify-between items-center mt-1">
                             <p className="text-xs md:text-sm text-slate-400">{client.phone}</p>
                        </div>
                        </div>
                    ))}
                    </div>
                </div>

                {/* Detail View */}
                {/* Em Tablet (md), se estiver selecionado, aparece abaixo da lista (empilhado) ou ocupa tela toda se mobile logic */}
                <div className={`${!selectedClient ? 'hidden lg:flex' : 'flex'} flex-1 flex-col bg-slate-800 border border-slate-700 rounded-xl shadow-lg overflow-hidden`}>
                    {selectedClient ? (
                    <>
                        {/* Detail Header */}
                        <div className="p-4 md:p-6 border-b border-slate-700 bg-slate-900/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <button onClick={() => setSelectedClient(null)} className="lg:hidden text-slate-400 text-sm mb-2 flex items-center gap-1"><X size={14}/> Fechar Detalhes</button>
                                {!isEditing ? (
                                    <>
                                        <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-1">
                                            <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
                                                {selectedClient.name}
                                            </h2>
                                            {/* Tier Badge Large */}
                                            {clientMetrics[selectedClient.id]?.tier === 'VIP' && (
                                                <div className="flex items-center gap-1 bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded-full text-xs font-bold border border-yellow-500/30">
                                                    <Crown size={12} fill="currentColor"/> VIP
                                                </div>
                                            )}
                                            {clientMetrics[selectedClient.id]?.tier === 'FIEL' && (
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
                                <button 
                                    onClick={() => openWhatsApp(selectedClient.phone)}
                                    className="w-full sm:w-auto flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-medium transition shadow-[0_0_10px_rgba(34,197,94,0.3)]"
                                >
                                    <MessageCircle size={18} /> <span>WhatsApp</span>
                                </button>
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

                        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 md:space-y-8">
                            
                            {isEditing ? (
                                // --- EDIT FORM ---
                                <div className="space-y-4 animate-fade-in bg-slate-900/30 p-4 rounded-lg border border-slate-700">
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">Nome Completo</label>
                                        <input 
                                            className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white"
                                            value={editForm.name}
                                            onChange={e => setEditForm({...editForm, name: e.target.value})}
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">Telefone</label>
                                            <input 
                                                className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white"
                                                value={editForm.phone}
                                                onChange={e => setEditForm({...editForm, phone: e.target.value})}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">E-mail</label>
                                            <input 
                                                className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white"
                                                value={editForm.email}
                                                onChange={e => setEditForm({...editForm, email: e.target.value})}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">Tags (separadas por vírgula)</label>
                                        <input 
                                            className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white"
                                            value={editForm.tags?.join(', ')}
                                            onChange={e => setEditForm({...editForm, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)})}
                                            placeholder="Ex: VIP, Empresa, Aniversário"
                                        />
                                    </div>
                                </div>
                            ) : (
                                // --- VIEW DETAILS ---
                                <>
                                    {/* Grid ajustado para Tablet: sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-3 para adaptar ao painel lateral */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        <div className="bg-slate-900 p-4 rounded-lg border border-slate-700">
                                            <p className="text-slate-500 text-xs uppercase font-bold">Telefone</p>
                                            <p className="text-white font-mono text-sm md:text-base">{selectedClient.phone}</p>
                                        </div>
                                        <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 relative overflow-hidden">
                                            <p className="text-slate-500 text-xs uppercase font-bold relative z-10">Classificação (3 meses)</p>
                                            <div className="relative z-10 mt-1 flex items-center gap-2">
                                                {clientMetrics[selectedClient.id]?.tier === 'VIP' ? (
                                                    <span className="text-yellow-500 font-bold flex items-center gap-1 text-sm md:text-base"><Crown size={16} fill="currentColor"/> VIP ({clientMetrics[selectedClient.id].count} slots)</span>
                                                ) : clientMetrics[selectedClient.id]?.tier === 'FIEL' ? (
                                                    <span className="text-blue-400 font-bold flex items-center gap-1 text-sm md:text-base"><Star size={16} fill="currentColor"/> FIEL ({clientMetrics[selectedClient.id].count} slots)</span>
                                                ) : (
                                                    <span className="text-slate-400 font-bold flex items-center gap-1 text-sm md:text-base"><Sparkles size={16}/> NOVO / OCASIONAL</span>
                                                )}
                                            </div>
                                            {/* Background glow based on tier */}
                                            {clientMetrics[selectedClient.id]?.tier === 'VIP' && <div className="absolute right-[-10px] bottom-[-10px] w-20 h-20 bg-yellow-500/20 blur-xl rounded-full"></div>}
                                            {clientMetrics[selectedClient.id]?.tier === 'FIEL' && <div className="absolute right-[-10px] bottom-[-10px] w-20 h-20 bg-blue-500/20 blur-xl rounded-full"></div>}
                                        </div>
                                        <div className="bg-slate-900 p-4 rounded-lg border border-slate-700 sm:col-span-2 lg:col-span-1">
                                            <p className="text-slate-500 text-xs uppercase font-bold">Último contato</p>
                                            <p className="text-white text-sm md:text-base">{new Date(selectedClient.lastContactAt).toLocaleDateString('pt-BR')}</p>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-base md:text-lg font-bold text-white mb-3 flex items-center gap-2"><Tag size={18} className="text-neon-blue"/> Tags</h3>
                                        <div className="flex flex-wrap gap-2">
                                        {selectedClient.tags.map(t => (
                                            <span key={t} className="bg-neon-blue/10 text-neon-blue border border-neon-blue/30 px-3 py-1 rounded-full text-xs md:text-sm">
                                            {t}
                                            </span>
                                        ))}
                                        {selectedClient.tags.length === 0 && <span className="text-slate-500 italic text-sm">Sem tags.</span>}
                                        </div>
                                    </div>
                                </>
                            )}

                            <div>
                                <h3 className="text-base md:text-lg font-bold text-white mb-3 flex items-center gap-2">
                                    <Calendar size={18} className="text-neon-orange"/> Histórico 
                                    <span className="text-xs md:text-sm font-normal text-slate-400 ml-2">
                                        ({clientHistory.length} pedidos / {totalHistorySlots} horas totais)
                                    </span>
                                </h3>
                                <div className="space-y-2">
                                {clientHistory.length === 0 ? (
                                    <p className="text-slate-500 italic">Nenhuma reserva encontrada.</p>
                                ) : (
                                    clientHistory.map(h => {
                                        const isMain = h.clientId === selectedClient.id;
                                        const slotCount = h.laneCount * h.duration;
                                        
                                        return (
                                            <div key={h.id} className="flex flex-col md:flex-row md:items-center justify-between bg-slate-700/30 p-3 rounded-lg border border-slate-700 gap-2">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-white font-medium text-sm md:text-base">{new Date(h.date).toLocaleDateString('pt-BR')}</span>
                                                        <span className="text-slate-400">|</span>
                                                        <span className="text-slate-300 text-sm">{h.eventType}</span>
                                                    </div>
                                                    {!isMain && (
                                                        <span className="text-[10px] uppercase text-neon-blue font-bold bg-neon-blue/10 px-1 rounded mt-1 inline-block">Segundo Responsável</span>
                                                    )}
                                                </div>
                                                
                                                <div className="flex flex-wrap items-center gap-2 md:gap-4 md:justify-end">
                                                     {/* Visualizador de Volume/Reservas */}
                                                     <div className="flex items-center gap-2 text-[10px] md:text-xs text-slate-400 bg-slate-800/50 px-2 py-1 rounded border border-slate-600">
                                                        <span className="flex items-center gap-1"><LayoutGrid size={12}/> {h.laneCount} Pista(s)</span>
                                                        <span className="text-slate-600">x</span>
                                                        <span className="flex items-center gap-1"><Clock size={12}/> {h.duration}h</span>
                                                        <span className="text-slate-600">=</span>
                                                        <span className="text-white font-bold">{slotCount} Slots</span>
                                                     </div>

                                                    <div className="text-right">
                                                        <span className={`text-[10px] md:text-xs px-2 py-1 rounded block ${h.status === 'Confirmada' ? 'bg-green-500/20 text-green-400' : 'bg-slate-600 text-slate-300'}`}>
                                                            {h.status}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                                </div>
                            </div>

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
          // --- VIEW: KANBAN ---
          <div className="flex-1 overflow-x-auto overflow-y-hidden">
                {loading ? (
                    <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin text-neon-blue" size={48} /></div>
                ) : (
                    <div className="flex gap-4 h-full min-w-[1200px] pb-4 px-4 lg:px-0">
                        {FUNNEL_STAGES.map((stage) => {
                            const stageClients = getClientsByStage(stage);
                            return (
                                <div 
                                    key={stage} 
                                    className="flex-1 min-w-[280px] bg-slate-800/50 rounded-xl border border-slate-700 flex flex-col"
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, stage)}
                                >
                                    {/* Column Header */}
                                    <div className="p-4 border-b border-slate-700 font-bold text-slate-300 flex justify-between items-center sticky top-0 bg-slate-800 rounded-t-xl z-10">
                                        <span>{stage}</span>
                                        <span className="bg-slate-700 text-xs px-2 py-1 rounded-full text-slate-400">
                                            {stageClients.length}
                                        </span>
                                    </div>

                                    {/* Column Content */}
                                    <div className="p-3 space-y-3 flex-1 overflow-y-auto">
                                        {stageClients.map(client => (
                                        <div
                                            key={client.id}
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, client.id)}
                                            className={`bg-slate-700 p-4 rounded-lg shadow-sm border border-slate-600 transition group relative ${canEditClient ? 'cursor-grab active:cursor-grabbing hover:border-neon-blue hover:shadow-md' : 'cursor-default'}`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <h4 className="font-bold text-white text-sm md:text-base">{client.name}</h4>
                                                {canEditClient && (
                                                    <GripVertical className="text-slate-500 opacity-0 group-hover:opacity-100 transition" size={16} />
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-400">{client.phone}</p>
                                            
                                            {/* Kanban Tier Badge */}
                                            {clientMetrics[client.id]?.tier !== 'NOVO' && (
                                                <div className="mt-2">
                                                    {clientMetrics[client.id]?.tier === 'VIP' ? (
                                                        <span className="text-[10px] bg-yellow-500/10 text-yellow-500 px-1.5 py-0.5 rounded border border-yellow-500/20 font-bold flex items-center gap-1 w-fit">
                                                            <Crown size={8}/> VIP
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20 font-bold flex items-center gap-1 w-fit">
                                                            <Star size={8}/> FIEL
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            <p className="text-[10px] md:text-xs text-slate-500 mt-2">
                                                Último: {new Date(client.lastContactAt).toLocaleDateString('pt-BR')}
                                            </p>
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
