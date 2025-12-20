
import React, { useEffect, useState } from 'react';
import { db, cleanPhone } from '../services/mockBackend';
import { FunnelStageConfig, Client, User, UserRole, Reservation, LoyaltyTransaction, ReservationStatus, PaymentStatus } from '../types';
import { Plus, GripVertical, Loader2, Pencil, Trash2, Check, X, Users, MessageCircle, Calendar, Clock, LayoutGrid, DollarSign, UserCheck, Gift, Coins, History, ArrowUp, ArrowDown, Star, Crown, Sparkles, Ban, Hash, Utensils, Cake, FileText, Store } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

const Funnel: React.FC = () => {
  const [stages, setStages] = useState<FunnelStageConfig[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Client Detail Modal State
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientHistory, setClientHistory] = useState<Reservation[]>([]);
  const [loyaltyHistory, setLoyaltyHistory] = useState<LoyaltyTransaction[]>([]);
  const [detailTab, setDetailTab] = useState<'INFO' | 'LOYALTY'>('INFO');
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Stage Editing State
  const [editingStage, setEditingStage] = useState<FunnelStageConfig | null>(null);
  const [stageForm, setStageForm] = useState({ nome: '', ordem: 0 });
  const [isSaving, setIsSaving] = useState(false);

  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const fetchData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
        const [stagesData, clientsData] = await Promise.all([
            db.funnelStages.getAll(),
            db.clients.getAll()
        ]);
        setStages(stagesData);
        setClients(clientsData);
    } catch (e) { console.error(e); }
    finally { if (!isBackground) setLoading(false); }
  };

  useEffect(() => {
    fetchData();
    const stored = localStorage.getItem('tonapista_auth');
    if (stored) setCurrentUser(JSON.parse(stored));

    const channel = supabase.channel('funnel-realtime-v4')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'etapas_funil' }, () => fetchData(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, () => fetchData(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const fetchClientDetails = async () => {
        if (!selectedClient) return;
        setLoadingDetails(true);
        try {
            const [history, loyalty] = await Promise.all([
                db.reservations.getByClient(selectedClient.id),
                db.loyalty.getHistory(selectedClient.id)
            ]);
            setClientHistory(history);
            setLoyaltyHistory(loyalty);
        } catch (e) { console.error(e); }
        finally { setLoadingDetails(false); }
    };
    fetchClientDetails();
  }, [selectedClient]);

  const isAdmin = currentUser?.role === UserRole.ADMIN;

  const handleDragStart = (e: React.DragEvent, clientId: string) => {
    e.dataTransfer.setData('clientId', clientId);
  };

  const handleDrop = async (e: React.DragEvent, stageName: string) => {
    e.preventDefault();
    const clientId = e.dataTransfer.getData('clientId');
    if (!clientId) return;
    
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, funnelStage: stageName } : c));
    
    try {
        await db.clients.updateStage(clientId, stageName);
    } catch (err) {
        fetchData(true);
        alert("Erro ao mover cliente.");
    }
  };

  const handleAddStage = async () => {
    const nome = prompt("Nome da nova etapa:");
    if (!nome) return;
    setIsSaving(true);
    try {
      const nextOrdem = stages.length > 0 ? Math.max(...stages.map(s => s.ordem)) + 1 : 1;
      await db.funnelStages.create(nome, nextOrdem);
      fetchData(true);
    } catch (e) { alert("Erro ao criar etapa."); } 
    finally { setIsSaving(false); }
  };

  const handleEditStage = (stage: FunnelStageConfig) => {
      setEditingStage(stage);
      setStageForm({ nome: stage.nome, ordem: stage.ordem });
  };

  const saveStageEdit = async () => {
      if (!editingStage || !stageForm.nome.trim()) return;
      setIsSaving(true);
      try {
          await db.funnelStages.update(editingStage.id, stageForm.nome, stageForm.ordem);
          setEditingStage(null);
          fetchData(true);
      } catch (e) { alert("Erro ao salvar etapa."); }
      finally { setIsSaving(false); }
  };

  const deleteStage = async (stage: FunnelStageConfig) => {
      const hasClients = clients.some(c => c.funnelStage === stage.nome);
      if (hasClients) {
          alert("Não é possível excluir uma etapa que possui clientes ativos.");
          return;
      }
      if (!window.confirm(`Excluir a etapa "${stage.nome}" permanentemente?`)) return;
      setIsSaving(true);
      try {
          await db.funnelStages.delete(stage.id);
          fetchData(true);
      } catch (e) { alert("Erro ao excluir."); }
      finally { setIsSaving(false); }
  };

  if (loading && stages.length === 0) return <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin text-neon-blue" size={48} /></div>;

  return (
    <div className="h-full flex flex-col pb-20 md:pb-0">
      <div className="flex justify-between items-center mb-6">
        <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Funil de Vendas</h1>
            <p className="text-slate-400 text-sm">Gerencie etapas e leads em tempo real</p>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto pb-4 custom-scrollbar">
          <div className="flex gap-4 h-full min-w-max px-2">
            {stages.map((stage) => {
                const stageClients = clients.filter(c => (c.funnelStage || '') === stage.nome);
                return (
                    <div 
                        key={stage.id} 
                        className="w-[310px] bg-slate-800/40 rounded-2xl border border-slate-700 flex flex-col transition hover:border-slate-600"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDrop(e, stage.nome)}
                    >
                        <div className="p-4 border-b border-slate-700/50 flex flex-col gap-2 sticky top-0 bg-slate-800 rounded-t-2xl z-10">
                            <div className="flex justify-between items-center">
                                <span className="font-bold text-slate-200 uppercase text-[10px] tracking-widest truncate max-w-[180px]">{stage.nome}</span>
                                <div className="flex items-center gap-1">
                                    <span className="bg-slate-700 text-[10px] px-2 py-0.5 rounded-full text-slate-400 font-bold mr-1">{stageClients.length}</span>
                                    {isAdmin && (
                                        <>
                                            <button onClick={() => handleEditStage(stage)} className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-700 rounded-lg transition"><Pencil size={14}/></button>
                                            <button onClick={() => deleteStage(stage)} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"><Trash2 size={14}/></button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-3 space-y-3 flex-1 overflow-y-auto min-h-[150px]">
                            {stageClients.length === 0 ? (
                                <div className="h-32 flex flex-col items-center justify-center border border-dashed border-slate-700/50 rounded-xl text-slate-600 text-[10px] italic uppercase tracking-widest">Arraste aqui</div>
                            ) : stageClients.map(client => (
                                <div
                                    key={client.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, client.id)}
                                    onClick={() => { setSelectedClient(client); setDetailTab('INFO'); }}
                                    className="bg-slate-700/60 p-4 rounded-xl shadow-sm border border-slate-600/50 cursor-pointer hover:border-neon-blue hover:bg-slate-700 transition group relative animate-fade-in"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-bold text-white text-sm leading-tight group-hover:text-neon-blue transition-colors truncate pr-4">{client.name}</h4>
                                        <GripVertical className="text-slate-600 opacity-0 group-hover:opacity-100 transition flex-shrink-0" size={14} />
                                    </div>
                                    <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono"><MessageCircle size={12} className="text-green-500"/> {client.phone}</div>
                                    {client.loyaltyBalance && client.loyaltyBalance > 0 ? (
                                        <div className="mt-3 flex items-center gap-1 text-[10px] text-neon-orange font-bold"><Gift size={10}/> {client.loyaltyBalance} pts</div>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}

            {isAdmin && (
                <div className="w-[100px] flex flex-col group">
                    <button 
                        onClick={handleAddStage}
                        className="h-full border-2 border-dashed border-slate-700 rounded-2xl flex flex-col items-center justify-center text-slate-500 hover:text-neon-blue hover:border-neon-blue hover:bg-neon-blue/5 transition-all group-hover:scale-[1.02]"
                        title="Adicionar Nova Etapa"
                    >
                        <Plus size={32} />
                        <span className="text-[10px] font-bold uppercase mt-2 opacity-0 group-hover:opacity-100 transition">Nova Etapa</span>
                    </button>
                </div>
            )}
          </div>
      </div>

      {/* MODAL DE DETALHES DO CLIENTE */}
      {selectedClient && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
              <div className="bg-slate-800 border border-slate-600 w-full max-w-2xl rounded-3xl shadow-2xl animate-scale-in flex flex-col max-h-[90vh] overflow-hidden">
                    <div className="p-6 md:p-8 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-slate-800 rounded-2xl flex items-center justify-center border border-slate-700 text-neon-blue overflow-hidden shadow-inner">
                                {selectedClient.photoUrl ? <img src={selectedClient.photoUrl} className="w-full h-full object-cover"/> : <Users size={28}/>}
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-white tracking-tight">{selectedClient.name}</h2>
                                <div className="flex gap-2 items-center mt-1">
                                    <span className="text-[10px] font-bold bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full uppercase tracking-tighter">{selectedClient.funnelStage || 'Sem Etapa'}</span>
                                    {selectedClient.email && <span className="text-xs text-slate-500 font-medium">{selectedClient.email}</span>}
                                </div>
                            </div>
                        </div>
                        <button onClick={() => setSelectedClient(null)} className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-xl border border-slate-700 transition"><X size={24}/></button>
                    </div>

                    <div className="flex bg-slate-800/80 border-b border-slate-700">
                        <button onClick={() => setDetailTab('INFO')} className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest border-b-2 transition flex items-center justify-center gap-2 ${detailTab === 'INFO' ? 'border-neon-blue text-white bg-slate-700/50 shadow-inner' : 'border-transparent text-slate-500 hover:text-white'}`}><History size={16}/> Histórico & Dados</button>
                        <button onClick={() => setDetailTab('LOYALTY')} className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest border-b-2 transition flex items-center justify-center gap-2 ${detailTab === 'LOYALTY' ? 'border-neon-orange text-white bg-slate-700/50 shadow-inner' : 'border-transparent text-slate-500 hover:text-white'}`}><Gift size={16}/> Pontos Fidelidade <span className="bg-slate-900 text-[10px] px-2 py-0.5 rounded-full ml-1 text-neon-orange">{selectedClient.loyaltyBalance || 0}</span></button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">
                        {loadingDetails ? (
                            <div className="flex flex-col justify-center items-center h-64 gap-4"><Loader2 className="animate-spin text-neon-blue" size={40}/><span className="text-xs text-slate-500 font-bold uppercase animate-pulse">Carregando histórico...</span></div>
                        ) : detailTab === 'INFO' ? (
                            <div className="space-y-10 animate-fade-in">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-slate-900/50 p-5 rounded-2xl border border-slate-700 group hover:border-green-500/30 transition-all"><p className="text-slate-500 text-[10px] uppercase font-bold mb-1 tracking-widest">WhatsApp Principal</p><p className="text-white font-mono font-bold text-lg flex items-center gap-3"><MessageCircle size={18} className="text-green-500 group-hover:scale-110 transition-transform"/> {selectedClient.phone}</p></div>
                                    <div className="bg-slate-900/50 p-5 rounded-2xl border border-slate-700 group hover:border-neon-blue/30 transition-all"><p className="text-slate-500 text-[10px] uppercase font-bold mb-1 tracking-widest">Última Interação</p><p className="text-white text-lg font-bold flex items-center gap-3"><Clock size={18} className="text-neon-blue group-hover:scale-110 transition-transform"/> {selectedClient.lastContactAt ? new Date(selectedClient.lastContactAt).toLocaleDateString('pt-BR') : 'N/A'}</p></div>
                                </div>
                                
                                <div>
                                    <h3 className="text-[10px] font-bold text-slate-400 mb-6 uppercase tracking-widest flex items-center gap-2 border-l-4 border-neon-blue pl-4">Histórico de Visitas (Agenda)</h3>
                                    <div className="space-y-4">
                                        {clientHistory.length === 0 ? (
                                            <div className="text-center py-16 text-slate-600 italic border-2 border-dashed border-slate-700/50 rounded-3xl flex flex-col items-center gap-4">
                                                <Calendar size={48} className="opacity-10"/>
                                                <span className="text-xs uppercase tracking-widest font-bold">Nenhuma reserva encontrada</span>
                                            </div>
                                        ) : clientHistory.map(res => {
                                            const isCheckedIn = res.checkedInIds && res.checkedInIds.length > 0;
                                            const isNoShow = res.noShowIds && res.noShowIds.length > 0;
                                            const needsPaymentAlert = res.paymentStatus === PaymentStatus.PENDENTE;
                                            
                                            let cardStyle = 'border-slate-700 bg-slate-800';
                                            if (isCheckedIn) cardStyle = 'border-green-500/50 bg-slate-900 opacity-90';
                                            else if (isNoShow) cardStyle = 'border-red-500/50 bg-red-900/10 grayscale opacity-70';
                                            else if (res.status === ReservationStatus.CONFIRMADA) cardStyle = 'border-neon-blue/50 bg-blue-900/10';
                                            else if (res.status === ReservationStatus.PENDENTE) cardStyle = 'border-yellow-500/50 bg-yellow-900/10';

                                            return (
                                                <div key={res.id} className={`p-4 md:p-5 rounded-2xl border shadow-lg transition group overflow-hidden relative ${cardStyle}`}>
                                                    <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-3">
                                                        <div className="min-w-0 pr-2">
                                                            <div className="flex items-center gap-3 mb-1.5">
                                                                <span className="text-lg font-bold text-white tracking-tight">{res.date.split('-').reverse().join('/')}</span>
                                                                <span className="w-1.5 h-1.5 rounded-full bg-slate-700"></span>
                                                                <span className="text-neon-blue font-bold text-lg">{res.time}</span>
                                                            </div>
                                                            
                                                            {needsPaymentAlert && res.status !== ReservationStatus.CANCELADA && (
                                                                <div className="mb-2 flex items-center gap-1 text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded font-bold uppercase animate-pulse w-fit">
                                                                    <DollarSign size={10} /> PGTO PENDENTE
                                                                </div>
                                                            )}

                                                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                                                                {isCheckedIn ? <span className="text-[10px] font-bold text-green-400 bg-green-500/20 px-2 py-0.5 rounded uppercase border border-green-500/30">CHECK-IN</span> : isNoShow ? <span className="text-[10px] font-bold text-red-400 bg-red-600/20 px-2 py-0.5 rounded uppercase border border-red-500/30">NO-SHOW</span> : <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase border ${res.status === ReservationStatus.CONFIRMADA ? 'text-neon-blue bg-blue-900/40 border-neon-blue/30' : res.status === ReservationStatus.PENDENTE ? 'text-yellow-400 bg-yellow-900/40 border-yellow-500/30' : 'text-slate-400 bg-slate-800 border-slate-700'}`}>{res.status}</span>}
                                                                {res.payOnSite && res.status === ReservationStatus.PENDENTE && (
                                                                    <span className="text-[10px] font-bold text-white bg-slate-600 px-2 py-0.5 rounded flex items-center gap-1.5"><Store size={10}/> Local</span>
                                                                )}
                                                                {res.comandaId && (
                                                                    <span className="text-[10px] font-bold text-white bg-purple-600 px-2 py-0.5 rounded flex items-center gap-1.5"><Hash size={10}/> {res.comandaId}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="text-left md:text-right flex flex-row md:flex-col items-center md:items-end justify-between w-full md:w-auto gap-4 md:gap-1.5 border-t md:border-t-0 border-slate-700/30 pt-3 md:pt-0">
                                                            <div className="font-bold text-green-400 text-xl group-hover:scale-105 transition-transform">{res.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                                                            <div className="flex gap-4">
                                                                <span className="text-[10px] text-slate-500 font-bold uppercase flex items-center gap-1.5"><LayoutGrid size={12} className="text-slate-600"/> {res.laneCount} Pistas</span>
                                                                <span className="text-[10px] text-slate-500 font-bold uppercase flex items-center gap-1.5"><Users size={12} className="text-slate-600"/> {res.peopleCount} Pessoas</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {isCheckedIn && res.lanesAssigned && res.lanesAssigned.length > 0 && (
                                                        <div className="flex gap-2 mb-3 p-2.5 bg-slate-900/50 rounded-xl border border-slate-700/50">
                                                            {res.lanesAssigned.map(l => (
                                                                <span key={l} className="w-7 h-7 rounded-full bg-neon-blue text-white flex items-center justify-center text-xs font-black shadow-md shadow-blue-500/40 border border-white/10">{l}</span>
                                                            ))}
                                                            <span className="text-[10px] text-slate-400 font-bold uppercase ml-2 self-center tracking-tight">Pistas atribuídas</span>
                                                        </div>
                                                    )}

                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-700/50">
                                                        <div className="flex items-center gap-2.5"><div className="p-1.5 bg-slate-700/50 rounded-lg text-slate-300"><FileText size={14}/></div><span className="text-xs text-slate-200 font-semibold">{res.eventType}</span></div>
                                                        {res.hasTableReservation && (
                                                            <div className="flex flex-col gap-1 bg-slate-900/40 p-2.5 rounded-xl border border-neon-orange/20">
                                                                <span className="text-[10px] font-bold text-neon-orange uppercase flex items-center gap-1.5"><Utensils size={12} /> Mesa: {res.tableSeatCount} lugares</span>
                                                                {res.birthdayName && <span className="text-[10px] text-neon-blue flex items-center gap-1.5 truncate font-bold"><Cake size={12} /> {res.birthdayName}</span>}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {res.observations && (
                                                        <div className="mt-4 p-3 bg-slate-950/40 rounded-xl text-[11px] text-slate-400 italic border-l-4 border-slate-700">"{res.observations}"</div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-8 animate-fade-in">
                                <div className="bg-slate-900 p-10 rounded-3xl border border-neon-orange/20 shadow-2xl flex flex-col items-center justify-center gap-6 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-neon-orange/5 rounded-full blur-3xl -mr-10 -mt-10"></div>
                                    <div className="w-20 h-20 bg-neon-orange/10 rounded-2xl flex items-center justify-center text-neon-orange border border-neon-orange/20 shadow-inner group"><Coins size={44} className="group-hover:rotate-12 transition-transform"/></div>
                                    <div className="text-center">
                                        <p className="text-slate-500 text-[10px] uppercase font-black tracking-[0.2em] mb-2">Saldo Disponível</p>
                                        <div className="flex items-baseline justify-center gap-2">
                                            <h3 className="text-6xl font-black text-white tracking-tighter">{selectedClient.loyaltyBalance || 0}</h3>
                                            <span className="text-xl text-neon-orange font-bold uppercase">pts</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-slate-900/50 rounded-2xl border border-slate-700 overflow-hidden shadow-lg">
                                    <div className="p-4 bg-slate-900 border-b border-slate-700 flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest"><History size={14}/> Extrato de Pontos</div>
                                    {loyaltyHistory.length === 0 ? (
                                        <div className="p-16 text-center text-slate-600 text-xs uppercase tracking-widest italic font-bold">Nenhuma movimentação</div>
                                    ) : (
                                        <div className="divide-y divide-slate-800">{loyaltyHistory.map(t => (
                                            <div key={t.id} className="p-5 flex justify-between items-center hover:bg-slate-800/30 transition">
                                                <div><p className="text-white font-bold text-sm leading-tight mb-1">{t.description}</p><p className="text-[10px] text-slate-500 font-bold uppercase flex items-center gap-2"><Clock size={10}/> {new Date(t.createdAt).toLocaleDateString('pt-BR')}</p></div>
                                                <div className={`font-mono font-bold text-xl flex items-center gap-1 ${t.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>{t.amount > 0 ? <ArrowUp size={16}/> : <ArrowDown size={16}/>}{Math.abs(t.amount)}</div>
                                            </div>
                                        ))}</div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
              </div>
          </div>
      )}

      {/* MODAL DE EDIÇÃO DE ETAPA */}
      {editingStage && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 p-4 backdrop-blur-xl">
              <div className="bg-slate-800 border border-slate-600 w-full max-w-sm rounded-3xl p-8 shadow-2xl animate-scale-in">
                  <div className="flex justify-between items-center mb-8">
                      <h3 className="text-xl font-bold text-white uppercase tracking-tighter flex items-center gap-2"><Pencil size={20} className="text-neon-blue"/> Configurar Etapa</h3>
                      <button onClick={() => setEditingStage(null)} className="text-slate-500 hover:text-white transition"><X/></button>
                  </div>
                  <div className="space-y-6">
                      <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2 tracking-widest">Nome da Etapa</label>
                          <input className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-4 text-white outline-none focus:border-neon-blue transition-all shadow-inner" value={stageForm.nome} onChange={e => setStageForm({...stageForm, nome: e.target.value})} placeholder="Ex: Lead Quente"/>
                      </div>
                      <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-2 tracking-widest">Posição (Ordem)</label>
                          <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-4 text-white outline-none focus:border-neon-blue transition-all shadow-inner" value={stageForm.ordem} onChange={e => setStageForm({...stageForm, ordem: parseInt(e.target.value)})} />
                      </div>
                      <div className="flex gap-4 pt-4">
                          <button onClick={() => setEditingStage(null)} className="flex-1 py-4 bg-slate-700 text-white rounded-2xl font-bold uppercase text-xs hover:bg-slate-600 transition active:scale-95">Cancelar</button>
                          <button onClick={saveStageEdit} disabled={isSaving} className="flex-1 py-4 bg-neon-blue text-white rounded-2xl font-bold uppercase text-xs shadow-lg shadow-blue-500/20 hover:bg-blue-500 transition active:scale-95">{isSaving ? <Loader2 className="animate-spin mx-auto"/> : 'Salvar Alterações'}</button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Funnel;
