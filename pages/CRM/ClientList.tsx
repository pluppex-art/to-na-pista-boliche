
import React, { useEffect, useState, useMemo } from 'react';
import { db, cleanPhone } from '../../services/mockBackend';
import { Client, Reservation, FunnelStageConfig, User, UserRole, ReservationStatus, LoyaltyTransaction, Interaction } from '../../types';
import { Search, Users, Loader2, LayoutList, DollarSign, Cake, ChevronDown, Crown, Star, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import ClientDetailsPanel from './ClientDetailsPanel';

type ClientTier = 'VIP' | 'FIEL' | 'NOVO';

const ClientList: React.FC = () => {
  const navigate = useNavigate();
  
  // Dados Principais
  const [clients, setClients] = useState<Client[]>([]);
  const [totalClientCount, setTotalClientCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  // Paginação e Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [loadedOffset, setLoadedOffset] = useState(0);
  const PAGE_SIZE = 50;

  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientHistory, setClientHistory] = useState<Reservation[]>([]);
  const [clientMetrics, setClientMetrics] = useState<Record<string, { count: number, tier: ClientTier }>>({});
  
  const [funnelStages, setFunnelStages] = useState<FunnelStageConfig[]>([]);
  const [loyaltyHistory, setLoyaltyHistory] = useState<LoyaltyTransaction[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loadingLoyalty, setLoadingLoyalty] = useState(false);
  const [loadingInteractions, setLoadingInteractions] = useState(false);
  const [detailTab, setDetailTab] = useState<'INFO' | 'LOYALTY' | 'NOTES'>('INFO');
  const [newNote, setNewNote] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Filtros Avançados
  const [filterStage, setFilterStage] = useState<string>('ALL');
  const [filterTier, setFilterTier] = useState<string>('ALL');
  const [showBirthdaysOnly, setShowBirthdaysOnly] = useState(false);

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

  const fetchData = async (isLoadMore = false) => {
    if (isLoadMore) setLoadingMore(true);
    else setLoading(true);

    try {
        const nextOffset = isLoadMore ? loadedOffset + PAGE_SIZE : 0;
        const { data: clientsData, count } = await db.clients.getAll(nextOffset, nextOffset + PAGE_SIZE - 1);
        const [reservationsData, stagesData] = await Promise.all([
            db.reservations.getAll(),
            db.funnelStages.getAll()
        ]);
        
        if (isLoadMore) {
            setClients(prev => [...prev, ...clientsData]);
        } else {
            setClients(clientsData);
        }

        setTotalClientCount(count);
        setLoadedOffset(nextOffset);
        setFunnelStages(stagesData.sort((a, b) => a.ordem - b.ordem));

        const metrics: Record<string, { count: number, tier: ClientTier }> = { ...clientMetrics };
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
        setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('crm-list-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, () => fetchData(false))
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

        if (detailTab === 'NOTES') {
            setLoadingInteractions(true);
            try {
                setInteractions(await db.interactions.getByClient(selectedClient.id));
            } catch(e) { console.error(e); }
            finally { setLoadingInteractions(false); }
        }
      }
    };
    fetchDetails();
  }, [selectedClient, detailTab]);

  const filteredClients = useMemo(() => {
    return clients.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             c.phone.includes(searchTerm);
        const matchesStage = filterStage === 'ALL' || c.funnelStage === filterStage;
        const matchesTier = filterTier === 'ALL' || (clientMetrics[c.id]?.tier === filterTier);
        
        let matchesBirthday = true;
        if (showBirthdaysOnly && c.birthDate) {
            const today = new Date();
            const bDay = new Date(c.birthDate);
            matchesBirthday = bDay.getMonth() === today.getMonth();
        } else if (showBirthdaysOnly && !c.birthDate) {
            matchesBirthday = false;
        }

        return matchesSearch && matchesStage && matchesTier && matchesBirthday;
    });
  }, [clients, searchTerm, filterStage, filterTier, showBirthdaysOnly, clientMetrics]);

  const handleAddNote = async () => {
      if (!selectedClient || !newNote.trim() || !currentUser) return;
      setIsSavingNote(true);
      try {
          const note = await db.interactions.create({
              clientId: selectedClient.id,
              userId: currentUser.id,
              userName: currentUser.name,
              type: 'NOTE',
              content: newNote
          });
          setInteractions(prev => [note, ...prev]);
          setNewNote('');
      } catch (e) { alert("Erro ao salvar nota."); }
      finally { setIsSavingNote(false); }
  };

  const handleDeleteNote = async (id: string) => {
      if (!window.confirm("Excluir esta nota?")) return;
      try {
          await db.interactions.delete(id);
          setInteractions(prev => prev.filter(i => i.id !== id));
      } catch (e) { alert("Erro ao excluir."); }
  };

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
      fetchData(false);
  };

  const exportToCSV = () => {
      const headers = ['Nome', 'Telefone', 'Email', 'Empresa', 'Documento', 'Data Nasc', 'Tier', 'Etapa Funil', 'Saldo Fidelidade'];
      const rows = filteredClients.map(c => [
          c.name,
          c.phone,
          c.email || '',
          c.company || '',
          c.document || '',
          c.birthDate || '',
          clientMetrics[c.id]?.tier || 'NOVO',
          c.funnelStage || 'Novo',
          c.loyaltyBalance || 0
      ]);

      const csvContent = [
          headers.join(','),
          ...rows.map(r => r.map(val => `"${val}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `clientes_crm_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleAddTag = async (tag: string) => {
      if (!selectedClient || !tag.trim() || selectedClient.tags.includes(tag)) return;
      const updatedTags = [...selectedClient.tags, tag];
      const updatedClient = { ...selectedClient, tags: updatedTags };
      await db.clients.update(updatedClient, currentUser?.id);
      setSelectedClient(updatedClient);
      fetchData(false);
  };

  const handleRemoveTag = async (tag: string) => {
      if (!selectedClient) return;
      const updatedTags = selectedClient.tags.filter(t => t !== tag);
      const updatedClient = { ...selectedClient, tags: updatedTags };
      await db.clients.update(updatedClient, currentUser?.id);
      setSelectedClient(updatedClient);
      fetchData(false);
  };

  const renderTierBadge = (clientId: string) => {
      const metric = clientMetrics[clientId] || { count: 0, tier: 'NOVO' };
      if (metric.tier === 'VIP') return <div className="flex items-center gap-1 bg-yellow-500/10 text-yellow-500 px-2 py-1 rounded-md text-[10px] font-bold border border-yellow-500/20"><Crown size={12} fill="currentColor" /><span>VIP</span></div>;
      if (metric.tier === 'FIEL') return <div className="flex items-center gap-1 bg-blue-500/10 text-blue-400 px-2 py-1 rounded-md text-[10px] font-bold border border-blue-500/20"><Star size={12} fill="currentColor" /><span>Fiel</span></div>;
      return <div className="flex items-center gap-1 bg-slate-800 text-slate-500 px-2 py-1 rounded-md text-[10px] font-bold border border-slate-700"><span>Novo</span></div>;
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden min-h-0 relative px-1">
            <div className={`flex-col overflow-hidden min-h-0 transition-all duration-300 lg:w-[400px] ${selectedClient ? 'hidden lg:flex' : 'flex'} h-full`}>
                <div className="flex flex-col bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden h-full">
                    <div className="p-4 border-b border-slate-700 bg-slate-900/50 flex-shrink-0">
                        <div className="relative mb-3">
                            <Search className="absolute left-3 top-3.5 text-slate-500" size={18} />
                            <input type="text" placeholder="Buscar por nome ou telefone..." className="w-full bg-slate-700 border border-slate-600 text-white pl-10 pr-4 py-3 rounded-xl focus:outline-none transition-all text-sm font-medium" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 mb-3">
                            <select 
                                className="bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-bold uppercase p-2 rounded-lg outline-none"
                                value={filterStage}
                                onChange={e => setFilterStage(e.target.value)}
                            >
                                <option value="ALL">Todas as Etapas</option>
                                {funnelStages.map(s => <option key={s.id} value={s.nome}>{s.nome}</option>)}
                            </select>
                            <select 
                                className="bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-bold uppercase p-2 rounded-lg outline-none"
                                value={filterTier}
                                onChange={e => setFilterTier(e.target.value)}
                            >
                                <option value="ALL">Todos os Tiers</option>
                                <option value="VIP">VIP</option>
                                <option value="FIEL">Fiel</option>
                                <option value="NOVO">Novo</option>
                            </select>
                        </div>

                        <div className="flex justify-between items-center px-1">
                            <button 
                                onClick={() => setShowBirthdaysOnly(!showBirthdaysOnly)}
                                className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 px-2 py-1 rounded-md transition-all ${showBirthdaysOnly ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                <Cake size={12} /> {showBirthdaysOnly ? 'Aniversariantes do Mês' : 'Ver Aniversariantes'}
                            </button>
                            <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">
                                {filteredClients.length} de {totalClientCount}
                            </span>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-800/20">
                    {loading && clients.length === 0 ? <div className="flex justify-center p-12"><Loader2 className="animate-spin text-neon-blue" size={32}/></div> : filteredClients.length === 0 ? <div className="text-center p-12 text-slate-500 text-sm italic">Nenhum cliente carregado</div> : (
                        <>
                            {filteredClients.map(client => (
                                <div key={client.id} onClick={() => { setSelectedClient(client); setIsEditing(false); setDetailTab('INFO'); }} className={`p-4 border-b border-slate-700/50 cursor-pointer hover:bg-slate-700/30 transition-colors group ${selectedClient?.id === client.id ? 'bg-slate-700/80 border-l-4 border-l-neon-blue shadow-inner' : ''}`}>
                                    <div className="flex justify-between items-start mb-1">
                                        <h3 className={`font-bold truncate pr-2 flex-1 text-sm ${selectedClient?.id === client.id ? 'text-neon-blue' : 'text-slate-200 group-hover:text-white'}`}>{client.name}</h3>
                                        {renderTierBadge(client.id)}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <p className="text-xs text-slate-500 font-mono">{client.phone}</p>
                                        <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                                        <p className="text-[10px] text-slate-500 font-semibold uppercase">{client.funnelStage || 'Sem Etapa'}</p>
                                    </div>
                                </div>
                            ))}

                            {clients.length < totalClientCount && (
                                <div className="p-6 text-center">
                                    <button 
                                        onClick={() => fetchData(true)}
                                        disabled={loadingMore}
                                        className="inline-flex items-center gap-2 px-8 py-3 bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95 border border-slate-600 disabled:opacity-50"
                                    >
                                        {loadingMore ? <Loader2 size={14} className="animate-spin"/> : <ChevronDown size={14}/>}
                                        Carregar Mais Contatos
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                    </div>
                </div>
            </div>

            <ClientDetailsPanel 
                selectedClient={selectedClient}
                setSelectedClient={setSelectedClient}
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
                interactions={interactions}
                loadingLoyalty={loadingLoyalty}
                loadingInteractions={loadingInteractions}
                newNote={newNote}
                setNewNote={setNewNote}
                handleAddNote={handleAddNote}
                handleDeleteNote={handleDeleteNote}
                isSavingNote={isSavingNote}
                funnelStages={funnelStages}
                updateClientStage={updateClientStage}
                isUpdatingStage={isUpdatingStage}
                handleRemoveTag={handleRemoveTag}
                handleAddTag={handleAddTag}
                openWhatsApp={openWhatsApp}
                navigate={navigate}
                viewMode="LIST"
            />
      </div>
    </div>
  );
};

export default ClientList;
