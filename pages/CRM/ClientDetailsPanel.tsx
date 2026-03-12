
import React, { useState, useEffect } from 'react';
import { Client, Reservation, FunnelStageConfig, User, LoyaltyTransaction, Interaction, ReservationStatus } from '../../types';
import { X, Pencil, Store, MessageCircle, CalendarPlus, Save, FileText, Gift, Cake, Hash, Clock, Check, Trash2, Coins, ArrowUp, ArrowDown, Loader2, Plus, Star, Smile, Meh, Frown, AlertCircle, ThumbsUp, TrendingUp } from 'lucide-react';
import { db } from '../../services/mockBackend';

interface ClientDetailsPanelProps {
    selectedClient: Client | null;
    setSelectedClient: (client: Client | null) => void;
    currentUser: User | null;
    isEditing: boolean;
    setIsEditing: (editing: boolean) => void;
    editForm: Partial<Client>;
    setEditForm: (form: Partial<Client>) => void;
    handleSaveClient: () => Promise<void>;
    canEditClient: boolean;
    canCreateReservation: boolean;
    detailTab: 'INFO' | 'LOYALTY' | 'NOTES';
    setDetailTab: (tab: 'INFO' | 'LOYALTY' | 'NOTES') => void;
    clientHistory: Reservation[];
    loyaltyHistory: LoyaltyTransaction[];
    loadingLoyalty: boolean;
    funnelStages: FunnelStageConfig[];
    updateClientStage: (clientId: string, stage: string) => Promise<void>;
    isUpdatingStage: boolean;
    handleRemoveTag: (tag: string) => Promise<void>;
    handleAddTag: (tag: string) => Promise<void>;
    onRefreshData?: () => void;
    openWhatsApp: (phone: string) => void;
    navigate: (path: string, state?: any) => void;
    viewMode: 'LIST' | 'KANBAN';
}

const ClientDetailsPanel: React.FC<ClientDetailsPanelProps> = ({
    selectedClient,
    setSelectedClient,
    currentUser,
    isEditing,
    setIsEditing,
    editForm,
    setEditForm,
    handleSaveClient,
    canEditClient,
    canCreateReservation,
    detailTab,
    setDetailTab,
    clientHistory,
    loyaltyHistory,
    loadingLoyalty,
    funnelStages,
    updateClientStage,
    isUpdatingStage,
    handleRemoveTag,
    handleAddTag,
    onRefreshData,
    openWhatsApp,
    navigate,
    viewMode
}) => {
    const [interactions, setInteractions] = useState<Interaction[]>([]);
    const [loadingInteractions, setLoadingInteractions] = useState(false);
    const [newNote, setNewNote] = useState('');
    const [npsScore, setNpsScore] = useState<number | null>(null);
    const [satisfaction, setSatisfaction] = useState<Interaction['satisfactionLevel'] | null>(null);
    const [isProspecting, setIsProspecting] = useState(false);
    const [isSavingNote, setIsSavingNote] = useState(false);

    useEffect(() => {
        if (selectedClient && detailTab === 'NOTES') {
            fetchInteractions();
        }
    }, [selectedClient, detailTab]);

    const fetchInteractions = async () => {
        if (!selectedClient) return;
        setLoadingInteractions(true);
        try {
            const data = await db.interactions.getByClient(selectedClient.id);
            setInteractions(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingInteractions(false);
        }
    };

    const handleAddNote = async () => {
        if (!selectedClient || !currentUser || (!newNote.trim() && npsScore === null && !satisfaction)) return;
        setIsSavingNote(true);
        try {
            const note = await db.interactions.create({
                clientId: selectedClient.id,
                userId: currentUser.id,
                userName: currentUser.name,
                type: npsScore !== null || satisfaction ? 'SURVEY' : 'NOTE',
                content: newNote,
                npsScore: npsScore !== null ? npsScore : undefined,
                satisfactionLevel: satisfaction || undefined,
                isProspecting: isProspecting
            });
            setInteractions(prev => [note, ...prev]);
            setNewNote('');
            setNpsScore(null);
            setSatisfaction(null);
            setIsProspecting(false);
        } catch (e: any) {
            console.error("Erro ao salvar nota:", e);
            alert(`Erro ao salvar nota: ${e.message || 'Erro desconhecido'}. Verifique se as colunas 'nps_score' e 'satisfaction_level' existem na tabela 'interacoes'.`);
        } finally {
            setIsSavingNote(false);
        }
    };

    const handleDeleteNote = async (id: string) => {
        if (!window.confirm("Excluir esta nota?")) return;
        try {
            await db.interactions.delete(id);
            setInteractions(prev => prev.filter(i => i.id !== id));
        } catch (e) {
            alert("Erro ao excluir.");
        }
    };

    const handleRecoverReservation = async (res: Reservation) => {
        if (!currentUser || !selectedClient) return;
        try {
            const updatedRes = {
                ...res,
                status: ReservationStatus.CONFIRMADA,
                recoveredBy: currentUser.id,
                recoveredAt: new Date().toISOString()
            };
            await db.reservations.update(updatedRes, currentUser.id, `Recuperou carrinho abandonado de ${res.clientName}`);
            if (onRefreshData) onRefreshData();
        } catch (e) {
            console.error("Erro ao recuperar reserva:", e);
        }
    };

    if (!selectedClient) {
        if (viewMode === 'KANBAN') return null;
        
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-700 p-12 text-center h-full">
                <div className="w-24 h-24 bg-slate-800/50 rounded-full flex items-center justify-center mb-6 border border-slate-700/50 shadow-inner">
                    <X size={48} className="opacity-10" />
                </div>
                <p className="font-bold uppercase tracking-widest text-[10px] text-slate-600 max-w-xs leading-loose">Selecione um cliente no funil ou na lista para gerenciar dados e histórico</p>
            </div>
        );
    }

    return (
        <div className={`${!selectedClient ? 'hidden' : 'flex'} flex-col bg-slate-800 border lg:border-l border-slate-700 rounded-2xl lg:rounded-none lg:rounded-tr-2xl lg:rounded-br-2xl shadow-2xl overflow-hidden h-full animate-scale-in transition-all duration-300 ${viewMode === 'LIST' ? 'flex-1' : 'w-full lg:w-[550px] absolute lg:relative right-0 top-0 z-30'} min-h-0`}>
            <div className="p-4 sm:p-6 border-b border-slate-700 bg-slate-900/60 flex flex-row items-start justify-between gap-4 flex-shrink-0">
                <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-3 sm:gap-4 mb-1">
                        <button onClick={() => setSelectedClient(null)} className="p-2 bg-slate-700/50 text-slate-400 hover:text-white rounded-xl border border-slate-600 transition-colors shadow-sm flex-shrink-0 mt-0.5" title="Voltar"><X size={18}/></button>
                        <div className="min-w-0 flex-1">
                            {!isEditing ? (
                                <div className="flex flex-col">
                                    <div className="flex items-start gap-2">
                                        <h2 className="text-lg sm:text-2xl font-bold text-white tracking-tight leading-tight break-words line-clamp-2 pr-2">{selectedClient.name}</h2>
                                        {canEditClient && <button onClick={() => { setEditForm({ name: selectedClient.name, email: selectedClient.email, phone: selectedClient.phone, birthDate: selectedClient.birthDate, company: selectedClient.company, document: selectedClient.document }); setIsEditing(true); }} className="text-slate-500 hover:text-neon-blue transition-colors p-1.5 bg-slate-800/50 rounded-lg border border-slate-700 flex-shrink-0 mt-0.5"><Pencil size={12}/></button>}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1">
                                        <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate">{selectedClient.email || 'Sem e-mail cadastrado'}</p>
                                        {selectedClient.company && (
                                            <>
                                                <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                                                <p className="text-[10px] sm:text-xs text-neon-blue font-bold uppercase flex items-center gap-1"><Store size={10}/> {selectedClient.company}</p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ) : <h2 className="text-lg font-bold text-neon-blue uppercase tracking-wider">Editando Perfil</h2>}
                        </div>
                    </div>
                </div>
                {!isEditing ? (
                    <div className="flex flex-col gap-2 flex-shrink-0 w-28 sm:w-32">
                        <button onClick={() => openWhatsApp(selectedClient.phone)} className="w-full flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-500 text-white py-2 rounded-xl font-bold transition shadow-lg text-[10px] uppercase tracking-tighter">
                            <MessageCircle size={14} /> WhatsApp
                        </button>
                        {canCreateReservation && (
                            <button onClick={() => navigate('/agendamento', { state: { prefilledClient: selectedClient } })} className="w-full flex items-center justify-center gap-1.5 bg-neon-orange hover:bg-orange-600 text-white py-2 rounded-xl font-bold transition shadow-lg text-[10px] uppercase tracking-tighter">
                                <CalendarPlus size={14} /> Reservar
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col gap-2 flex-shrink-0 w-28 sm:w-32">
                        <button onClick={handleSaveClient} className="w-full bg-neon-blue text-white py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-lg text-[10px] uppercase tracking-widest"><Save size={14} /> Salvar</button>
                        <button onClick={() => setIsEditing(false)} className="w-full bg-slate-700 text-white py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest">Sair</button>
                    </div>
                )}
            </div>

            {!isEditing && (
                <div className="flex border-b border-slate-700 bg-slate-800/50 p-1 flex-shrink-0">
                    <button onClick={() => setDetailTab('INFO')} className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider transition-all rounded-xl ${detailTab === 'INFO' ? 'bg-slate-700 text-white shadow-inner border border-slate-600' : 'text-slate-500 hover:text-slate-300'}`}>Histórico</button>
                    <button onClick={() => setDetailTab('NOTES')} className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider transition-all rounded-xl flex items-center justify-center gap-2 ${detailTab === 'NOTES' ? 'bg-slate-700 text-white shadow-inner border border-slate-600' : 'text-slate-500 hover:text-slate-300'}`}><FileText size={16}/> Notas</button>
                    <button onClick={() => setDetailTab('LOYALTY')} className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider transition-all rounded-xl flex items-center justify-center gap-1 sm:gap-2 ${detailTab === 'LOYALTY' ? 'bg-slate-700 text-white shadow-inner border border-slate-600' : 'text-slate-500 hover:text-slate-300'}`}><Gift size={16}/> Fidelidade <span className="bg-slate-900 text-[10px] px-2 py-0.5 rounded-full text-neon-orange border border-neon-orange/20 font-bold">{selectedClient.loyaltyBalance || 0} pts</span></button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 custom-scrollbar bg-slate-900/10 min-h-0">
                {isEditing ? (
                    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
                        <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-700 space-y-4 shadow-xl">
                            <div><label className="block text-[10px] uppercase font-bold text-slate-500 mb-2">Nome Completo</label><input className="w-full bg-slate-800 border border-slate-600 rounded-xl p-4 text-white font-medium focus:border-neon-blue outline-none transition" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} /></div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><label className="block text-[10px] uppercase font-bold text-slate-500 mb-2">WhatsApp</label><input className="w-full bg-slate-800 border border-slate-600 rounded-xl p-4 text-white font-mono focus:border-neon-blue outline-none transition" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} /></div>
                                <div><label className="block text-[10px] uppercase font-bold text-slate-500 mb-2">E-mail</label><input className="w-full bg-slate-800 border border-slate-600 rounded-xl p-4 text-white focus:border-neon-blue outline-none transition" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} /></div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><label className="block text-[10px] uppercase font-bold text-slate-500 mb-2">Data de Nascimento</label><input type="date" className="w-full bg-slate-800 border border-slate-600 rounded-xl p-4 text-white focus:border-neon-blue outline-none transition" value={editForm.birthDate} onChange={e => setEditForm({...editForm, birthDate: e.target.value})} /></div>
                                <div><label className="block text-[10px] uppercase font-bold text-slate-500 mb-2">CPF / CNPJ</label><input className="w-full bg-slate-800 border border-slate-600 rounded-xl p-4 text-white focus:border-neon-blue outline-none transition" value={editForm.document} onChange={e => setEditForm({...editForm, document: e.target.value})} /></div>
                            </div>
                            <div><label className="block text-[10px] uppercase font-bold text-slate-500 mb-2">Empresa</label><input className="w-full bg-slate-800 border border-slate-600 rounded-xl p-4 text-white focus:border-neon-blue outline-none transition" value={editForm.company} onChange={e => setEditForm({...editForm, company: e.target.value})} /></div>
                        </div>
                    </div>
                ) : detailTab === 'INFO' ? (
                    <div className="space-y-6 sm:space-y-8 animate-fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-slate-900/30 p-4 sm:p-5 rounded-2xl border border-slate-700/50 shadow-sm"><p className="text-slate-500 text-[10px] uppercase font-bold mb-1">WhatsApp</p><p className="text-white font-mono font-bold text-base sm:text-lg flex items-center gap-3"><MessageCircle size={18} className="text-green-500"/> {selectedClient.phone}</p></div>
                            <div className="bg-slate-900/30 p-4 sm:p-5 rounded-2xl border border-slate-700/50 shadow-sm"><p className="text-slate-500 text-[10px] uppercase font-bold mb-1">Aniversário</p><p className="text-white text-base sm:text-lg font-bold flex items-center gap-3"><Cake size={18} className="text-pink-500"/> {selectedClient.birthDate ? new Date(selectedClient.birthDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'Não informado'}</p></div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-slate-900/30 p-4 sm:p-5 rounded-2xl border border-slate-700/50 shadow-sm"><p className="text-slate-500 text-[10px] uppercase font-bold mb-1">CPF / CNPJ</p><p className="text-white font-mono font-bold text-base sm:text-lg flex items-center gap-3"><Hash size={18} className="text-slate-500"/> {selectedClient.document || 'N/A'}</p></div>
                            <div className="bg-slate-900/30 p-4 sm:p-5 rounded-2xl border border-slate-700/50 shadow-sm"><p className="text-slate-500 text-[10px] uppercase font-bold mb-1">Último Contato</p><p className="text-white text-base sm:text-lg font-bold flex items-center gap-3"><Clock size={18} className="text-neon-blue"/> {selectedClient.lastContactAt ? new Date(selectedClient.lastContactAt).toLocaleDateString('pt-BR') : 'N/A'}</p></div>
                        </div>

                        <div>
                            <h3 className="text-[10px] font-bold text-slate-400 mb-4 uppercase tracking-widest flex items-center gap-2 border-l-4 border-neon-blue pl-3">Segmentação (Tags)</h3>
                            <div className="flex flex-wrap gap-2 mb-3">
                                {selectedClient.tags.map(tag => (
                                    <span key={tag} className="bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-2 border border-slate-700 group/tag">
                                        {tag}
                                        {canEditClient && <button onClick={() => handleRemoveTag(tag)} className="text-slate-600 hover:text-red-500 transition-colors"><X size={12}/></button>}
                                    </span>
                                ))}
                                {canEditClient && (
                                    <button 
                                        onClick={() => {
                                            const tag = prompt("Nova tag:");
                                            if (tag) handleAddTag(tag);
                                        }}
                                        className="bg-slate-900/50 text-slate-500 px-3 py-1.5 rounded-lg text-[10px] font-bold border border-dashed border-slate-700 hover:border-neon-blue hover:text-neon-blue transition-all"
                                    >
                                        + Adicionar Tag
                                    </button>
                                )}
                            </div>
                        </div>

                        <div>
                            <h3 className="text-[10px] font-bold text-slate-400 mb-4 uppercase tracking-widest flex items-center gap-2 border-l-4 border-neon-orange pl-3">Fase do Funil</h3>
                            <div className="flex flex-wrap gap-2">{funnelStages.map(stage => { const isActive = selectedClient.funnelStage === stage.nome; return (<button key={stage.id} disabled={!canEditClient || isUpdatingStage} onClick={() => updateClientStage(selectedClient.id, stage.nome)} className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all border shadow-sm ${isActive ? 'bg-neon-orange text-white border-neon-orange shadow-lg' : 'bg-slate-900 text-slate-500 border-slate-700 hover:border-slate-500 hover:text-slate-300'}`}>{isActive && <Check size={14} className="inline mr-1"/>}{stage.nome}</button>);})}</div>
                        </div>

                        <div>
                            <h3 className="text-[10px] font-bold text-slate-400 mb-4 uppercase tracking-widest flex items-center gap-2 border-l-4 border-neon-blue pl-3">Histórico de Visitas</h3>
                            <div className="space-y-4">
                            {clientHistory.length === 0 ? <div className="text-center py-12 bg-slate-900/20 border border-slate-700 rounded-3xl text-slate-600 text-xs font-bold uppercase">Nenhuma reserva registrada</div> : clientHistory.map(res => {
                                const isCheckedIn = res.checkedInIds && res.checkedInIds.length > 0;
                                const isNoShow = res.noShowIds && res.noShowIds.length > 0;
                                return (
                                <div key={res.id} className={`p-4 rounded-xl border shadow-lg transition ${isCheckedIn ? 'border-green-500/30 bg-slate-900' : 'border-slate-700 bg-slate-800'}`}>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-sm font-bold text-white">{res.date.split('-').reverse().join('/')}</span>
                                                <span className="text-neon-blue font-bold text-sm">{res.time}</span>
                                            </div>
                                            <div className="flex gap-2 mt-2">
                                               {isCheckedIn ? <span className="text-[9px] font-bold text-green-400 bg-green-500/20 px-1.5 py-0.5 rounded border border-green-500/30">CHECK-IN</span> : isNoShow ? <span className="text-[9px] font-bold text-red-400 bg-red-600/20 px-1.5 py-0.5 rounded border border-red-500/30">NO-SHOW</span> : <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${res.status === ReservationStatus.CONFIRMADA ? 'text-neon-blue bg-blue-900/40 border-neon-blue/30' : 'text-slate-400 bg-slate-800 border-slate-700'}`}>{res.status}</span>}
                                               {res.recoveredBy && <span className="text-[9px] font-bold text-neon-blue bg-neon-blue/10 px-1.5 py-0.5 rounded border border-neon-blue/20 flex items-center gap-1"><TrendingUp size={10}/> RECUPERADO</span>}
                                            </div>
                                            {res.status === ReservationStatus.PENDENTE && (
                                                <button 
                                                    onClick={() => handleRecoverReservation(res)}
                                                    className="mt-3 text-[10px] font-black uppercase tracking-widest text-neon-blue hover:text-blue-400 flex items-center gap-1.5 bg-neon-blue/5 px-3 py-1.5 rounded-lg border border-neon-blue/10 transition-all hover:bg-neon-blue/10"
                                                >
                                                    <TrendingUp size={12}/> Recuperar Carrinho
                                                </button>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <span className="text-base font-bold text-green-400">{res.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                        </div>
                                    </div>
                                </div>
                            )})}
                            </div>
                        </div>
                    </div>
                ) : detailTab === 'NOTES' ? (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-xl space-y-5">
                            <div className="space-y-3">
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">Pesquisa de Satisfação (NPS)</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(score => (
                                        <button 
                                            key={score}
                                            onClick={() => setNpsScore(score === npsScore ? null : score)}
                                            className={`w-8 h-8 rounded-lg text-[10px] font-bold transition-all border ${
                                                npsScore === score 
                                                ? 'bg-neon-blue text-white border-neon-blue shadow-lg scale-110' 
                                                : 'bg-slate-900 text-slate-500 border-slate-700 hover:border-slate-500'
                                            }`}
                                        >
                                            {score}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">Nível de Satisfação</label>
                                <div className="grid grid-cols-5 gap-2">
                                    {(['PESSIMO', 'RUIM', 'NEUTRO', 'BOM', 'EXCELENTE'] as const).map(level => {
                                        const Icon = level === 'EXCELENTE' ? ThumbsUp : level === 'BOM' ? Smile : level === 'NEUTRO' ? Meh : level === 'RUIM' ? Frown : AlertCircle;
                                        const color = level === 'EXCELENTE' ? 'text-green-400' : level === 'BOM' ? 'text-blue-400' : level === 'NEUTRO' ? 'text-yellow-400' : level === 'RUIM' ? 'text-orange-400' : 'text-red-400';
                                        const isActive = satisfaction === level;
                                        
                                        return (
                                            <button 
                                                key={level}
                                                onClick={() => setSatisfaction(isActive ? null : level)}
                                                className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
                                                    isActive 
                                                    ? `bg-slate-700 border-slate-500 shadow-inner ${color}` 
                                                    : 'bg-slate-900 border-slate-700 text-slate-600 hover:border-slate-600'
                                                }`}
                                            >
                                                <Icon size={18} />
                                                <span className="text-[8px] font-black uppercase tracking-tighter">{level}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">Observações / Sugestões</label>
                                <textarea 
                                    placeholder="Adicionar uma nota comercial ou registro de contato..."
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-white text-sm focus:border-neon-blue outline-none transition min-h-[100px] resize-none"
                                    value={newNote}
                                    onChange={e => setNewNote(e.target.value)}
                                />
                            </div>

                            <div className="flex items-center gap-3 bg-slate-900/50 p-3 rounded-xl border border-slate-700/50">
                                <input 
                                    type="checkbox" 
                                    id="prospecting" 
                                    checked={isProspecting} 
                                    onChange={e => setIsProspecting(e.target.checked)}
                                    className="w-5 h-5 rounded-lg border-slate-700 bg-slate-800 text-neon-blue focus:ring-neon-blue transition-all cursor-pointer"
                                />
                                <label htmlFor="prospecting" className="text-[10px] font-black uppercase tracking-widest text-slate-400 cursor-pointer select-none">
                                    Marcar como Prospecção Ativa (Contato Comercial)
                                </label>
                            </div>

                            <div className="flex justify-end pt-2">
                                <button 
                                    onClick={handleAddNote}
                                    disabled={isSavingNote || (!newNote.trim() && npsScore === null && !satisfaction)}
                                    className="bg-neon-blue hover:bg-blue-600 text-white px-8 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 disabled:opacity-50 transition-all shadow-lg active:scale-95"
                                >
                                    {isSavingNote ? <Loader2 size={14} className="animate-spin"/> : <Plus size={14}/>}
                                    Salvar Registro
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2 border-l-4 border-slate-700 pl-3">Histórico de Interações</h3>
                            {loadingInteractions ? (
                                <div className="flex justify-center py-12"><Loader2 className="animate-spin text-neon-blue" size={32}/></div>
                            ) : interactions.length === 0 ? (
                                <div className="text-center py-12 bg-slate-900/20 border border-slate-700 rounded-3xl text-slate-600 text-[10px] font-black uppercase tracking-widest">Nenhuma nota registrada</div>
                            ) : (
                                <div className="space-y-4">
                                    {interactions.map(note => (
                                        <div key={note.id} className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl relative group hover:border-slate-700 transition-all">
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-slate-800 rounded-xl flex items-center justify-center text-xs font-black text-neon-blue border border-slate-700 shadow-inner">
                                                        {note.userName.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-black text-slate-200 uppercase tracking-tight">{note.userName}</span>
                                                            <span className="bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded text-[8px] font-black uppercase border border-slate-700">{note.type}</span>
                                                            {note.isProspecting && (
                                                                <span className="bg-neon-blue/10 text-neon-blue px-1.5 py-0.5 rounded text-[8px] font-black uppercase border border-neon-blue/20">Prospecção</span>
                                                            )}
                                                        </div>
                                                        <span className="text-[9px] text-slate-600 font-bold">{new Date(note.createdAt).toLocaleString('pt-BR')}</span>
                                                    </div>
                                                </div>
                                                <button 
                                                    onClick={() => handleDeleteNote(note.id)}
                                                    className="text-slate-700 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1"
                                                >
                                                    <Trash2 size={14}/>
                                                </button>
                                            </div>
                                            
                                            {(note.npsScore !== undefined || note.satisfactionLevel) && (
                                                <div className="flex gap-3 mb-3 p-3 bg-slate-900/60 rounded-xl border border-slate-800/50">
                                                    {note.npsScore !== undefined && (
                                                        <div className="flex flex-col">
                                                            <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">NPS</span>
                                                            <span className="text-sm font-black text-neon-blue">{note.npsScore}</span>
                                                        </div>
                                                    )}
                                                    {note.satisfactionLevel && (
                                                        <div className="flex flex-col border-l border-slate-800 pl-3">
                                                            <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Satisfação</span>
                                                            <span className={`text-[10px] font-black uppercase ${
                                                                note.satisfactionLevel === 'EXCELENTE' ? 'text-green-400' : 
                                                                note.satisfactionLevel === 'BOM' ? 'text-blue-400' : 
                                                                note.satisfactionLevel === 'NEUTRO' ? 'text-yellow-400' : 
                                                                note.satisfactionLevel === 'RUIM' ? 'text-orange-400' : 'text-red-400'
                                                            }`}>{note.satisfactionLevel}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {note.content && <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap font-medium">{note.content}</p>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-10 animate-fade-in max-w-2xl mx-auto">
                        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 rounded-3xl border border-neon-orange/20 shadow-2xl flex flex-col items-center justify-center gap-6">
                            <div className="w-16 h-16 bg-neon-orange/10 rounded-2xl flex items-center justify-center text-neon-orange border border-neon-orange/20 shadow-inner"><Coins size={44}/></div>
                            <div className="text-center">
                                <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest mb-2">Saldo de Fidelidade</p>
                                <div className="flex items-baseline justify-center gap-2">
                                    <h3 className="text-5xl font-bold text-white">{selectedClient.loyaltyBalance || 0}</h3>
                                    <span className="text-sm text-neon-orange font-bold uppercase">pontos</span>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 border-l-2 border-slate-600 pl-3">Extrato Recente</h3>
                            <div className="bg-slate-900/50 rounded-2xl border border-slate-700/50 overflow-hidden shadow-xl">{loyaltyHistory.length === 0 ? (<div className="text-center py-16 text-slate-600 uppercase text-xs tracking-widest">Sem movimentações</div>) : (<div className="divide-y divide-slate-800">{loyaltyHistory.map(t => (
                                <div key={t.id} className="p-4 flex justify-between items-center hover:bg-slate-800/40 transition-colors">
                                    <div className="min-w-0 pr-4"><p className="text-white font-bold text-sm mb-1 truncate">{t.description}</p><p className="text-[10px] text-slate-500 font-bold uppercase">{new Date(t.createdAt).toLocaleDateString('pt-BR')}</p></div>
                                    <div className={`font-mono font-bold text-lg flex items-center gap-1 ${t.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>{t.amount > 0 ? <ArrowUp size={18}/> : <ArrowDown size={18}/>}{Math.abs(t.amount)}</div>
                                </div>
                            ))}</div>)}</div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClientDetailsPanel;
