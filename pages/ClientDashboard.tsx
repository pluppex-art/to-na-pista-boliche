
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Client, Reservation, LoyaltyTransaction, ReservationStatus, PaymentStatus, Feedback, Suggestion } from '../types';
import { db } from '../services/mockBackend';
import { useApp } from '../contexts/AppContext';
import { 
  LogOut, 
  User, 
  Gift, 
  Clock, 
  Calendar, 
  Loader2, 
  MessageCircle, 
  Edit, 
  Save, 
  X, 
  Camera, 
  CreditCard, 
  DollarSign, 
  LayoutGrid, 
  History,
  Coins,
  Star,
  MessageSquare,
  Lightbulb,
  ThumbsUp,
  Award,
  ChevronRight,
  TrendingUp
} from 'lucide-react';
import { supabase } from '../services/supabaseClient';

const ClientDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { settings } = useApp();
  const [client, setClient] = useState<Client | null>(null);
  const [history, setHistory] = useState<Reservation[]>([]);
  const [loyalty, setLoyalty] = useState<LoyaltyTransaction[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'HISTORY' | 'SUGGESTIONS'>('OVERVIEW');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', photoUrl: '' });
  
  // Feedback Modal
  const [feedbackTarget, setFeedbackTarget] = useState<Reservation | null>(null);
  const [feedbackForm, setFeedbackForm] = useState({ rating: 5, comment: '' });
  
  // Suggestion State
  const [suggestionForm, setSuggestionForm] = useState({ title: '', desc: '' });
  
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async (isBackground = false) => {
      const stored = localStorage.getItem('tonapista_client_auth');
      if (!stored) { navigate('/login'); return; }
      const clientData = JSON.parse(stored);
      if (!isBackground) setLoading(true);
      try {
          const freshClient = await db.clients.getById(clientData.id);
          const activeClient = freshClient || clientData;
          setClient(activeClient);
          setEditForm({ name: activeClient.name, email: activeClient.email || '', phone: activeClient.phone, photoUrl: activeClient.photoUrl || '' });
          
          const [myRes, pts, fbacks] = await Promise.all([
              db.reservations.getByClient(activeClient.id),
              db.loyalty.getHistory(activeClient.id),
              db.feedbacks.getByClient(activeClient.id)
          ]);
          
          setHistory(myRes);
          setLoyalty(pts);
          setFeedbacks(fbacks);
      } finally { if (!isBackground) setLoading(false); }
  };

  useEffect(() => { loadData(); }, [navigate]);

  const handleLogout = async () => {
      localStorage.removeItem('tonapista_client_auth');
      await db.clients.logout();
      navigate('/login');
  };

  const handleSaveProfile = async () => {
      if (!client) return;
      setIsSaving(true);
      try {
          const updatedClient = { ...client, ...editForm };
          await db.clients.update(updatedClient);
          localStorage.setItem('tonapista_client_auth', JSON.stringify(updatedClient));
          setClient(updatedClient);
          setIsEditing(false);
          alert("Perfil atualizado!");
      } catch (e) { alert("Erro ao atualizar."); } 
      finally { setIsSaving(false); }
  };

  const handleSendFeedback = async () => {
      if (!client || !feedbackTarget) return;
      setIsSaving(true);
      try {
          await db.feedbacks.create({
              reserva_id: feedbackTarget.id,
              cliente_id: client.id,
              nota: feedbackForm.rating,
              comentario: feedbackForm.comment
          });
          setFeedbackTarget(null);
          setFeedbackForm({ rating: 5, comment: '' });
          loadData(true);
          alert("Obrigado pela sua avaliação!");
      } catch (e) { alert("Erro ao enviar avaliação."); }
      finally { setIsSaving(false); }
  };

  const handleSendSuggestion = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!client || !suggestionForm.title || !suggestionForm.desc) return;
      setIsSaving(true);
      try {
          await db.suggestions.create({
              cliente_id: client.id,
              titulo: suggestionForm.title,
              descricao: suggestionForm.desc
          });
          setSuggestionForm({ title: '', desc: '' });
          alert("Sua sugestão foi enviada com sucesso! Obrigado por nos ajudar a melhorar.");
      } catch (e) { alert("Erro ao enviar sugestão."); }
      finally { setIsSaving(false); }
  };

  // Fixed the missing openWhatsAppAction function
  const openWhatsAppAction = (res: Reservation, action: string) => {
    if (!settings?.whatsappLink) return;
    const dateStr = res.date.split('-').reverse().join('/');
    const msg = `Olá! Gostaria de falar sobre minha reserva do dia ${dateStr} às ${res.time} (Ref: ${res.id.slice(0, 8)}).`;
    const url = `${settings.whatsappLink}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const getClientTier = () => {
      const visits = history.filter(r => r.status === ReservationStatus.CHECK_IN).length;
      if (visits >= 15) return { label: 'VIP PLATINUM', icon: Award, color: 'text-yellow-500', bg: 'bg-yellow-500/10' };
      if (visits >= 5) return { label: 'CLIENTE FIEL', icon: ThumbsUp, color: 'text-blue-400', bg: 'bg-blue-400/10' };
      return { label: 'MEMBRO BRONZE', icon: Star, color: 'text-slate-400', bg: 'bg-slate-400/10' };
  };

  const { upcomingReservations, pastReservations } = React.useMemo(() => {
      const upcoming: Reservation[] = [];
      const past: Reservation[] = [];
      history.forEach(res => {
          const isFinishedStatus = [ReservationStatus.CANCELADA, ReservationStatus.NO_SHOW, ReservationStatus.CHECK_IN].includes(res.status);
          const endDateTime = new Date(`${res.date}T${res.time}`);
          endDateTime.setHours(endDateTime.getHours() + res.duration);
          if (isFinishedStatus || endDateTime < now) past.push(res);
          else upcoming.push(res);
      });
      return { upcomingReservations: upcoming.sort((a,b) => a.date.localeCompare(b.date)), pastReservations: past };
  }, [history, now]);

  const tier = getClientTier();
  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-neon-orange" size={48}/></div>;
  if (!client) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 pb-20 font-sans selection:bg-neon-orange/30">
        <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 p-4 sticky top-0 z-40 shadow-xl">
            <div className="max-w-xl mx-auto flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-neon-orange/20 rounded-lg flex items-center justify-center border border-neon-orange/30">
                        <span className="text-neon-orange font-black text-xs">TP</span>
                    </div>
                    <h1 className="text-sm font-bold text-white uppercase tracking-tighter">Área do Membro</h1>
                </div>
                <button onClick={handleLogout} className="text-slate-500 hover:text-red-400 p-2 transition-colors"><LogOut size={18}/></button>
            </div>
        </header>

        <main className="max-w-xl mx-auto p-4 space-y-6">
            
            {/* PERFIL & TIER */}
            <div className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                    <tier.icon size={120} />
                </div>
                
                {!isEditing ? (
                    <div className="relative z-10 flex flex-col items-center text-center">
                        <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center border-4 border-slate-700 text-neon-blue overflow-hidden shadow-2xl mb-4">
                            {client.photoUrl ? <img src={client.photoUrl} className="w-full h-full object-cover" /> : <User size={48}/>}
                        </div>
                        <h2 className="text-2xl font-black text-white tracking-tight leading-none mb-2">{client.name}</h2>
                        <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border border-current font-black text-[10px] tracking-[0.2em] mb-6 ${tier.color} ${tier.bg}`}>
                            <tier.icon size={14} /> {tier.label}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 w-full">
                            <div className="bg-slate-950/50 p-4 rounded-3xl border border-slate-800 flex flex-col items-center justify-center">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Pontos</span>
                                <div className="flex items-center gap-1.5">
                                    <Coins size={16} className="text-neon-orange"/>
                                    <span className="text-xl font-black text-white">{client.loyaltyBalance || 0}</span>
                                </div>
                            </div>
                            <div className="bg-slate-950/50 p-4 rounded-3xl border border-slate-800 flex flex-col items-center justify-center">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Visitas</span>
                                <div className="flex items-center gap-1.5">
                                    <History size={16} className="text-neon-blue"/>
                                    <span className="text-xl font-black text-white">{history.filter(r => r.status === ReservationStatus.CHECK_IN).length}</span>
                                </div>
                            </div>
                        </div>
                        
                        <button onClick={() => setIsEditing(true)} className="mt-6 flex items-center gap-2 text-[10px] font-bold text-slate-500 hover:text-white transition uppercase tracking-widest"><Edit size={12}/> Editar Perfil</button>
                    </div>
                ) : (
                    <div className="space-y-4 animate-scale-in">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-bold text-white uppercase text-xs tracking-widest text-slate-400">Dados da Conta</h3>
                            <button onClick={() => setIsEditing(false)} className="text-slate-500 hover:text-white"><X size={20}/></button>
                        </div>
                        <div className="flex justify-center mb-4">
                            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center border-2 border-slate-700 overflow-hidden shadow-inner">
                                    {editForm.photoUrl ? <img src={editForm.photoUrl} className="w-full h-full object-cover" /> : <User size={32} className="text-slate-600"/>}
                                </div>
                                <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Camera size={20} className="text-white"/></div>
                                <input type="file" ref={fileInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f){ const r = new FileReader(); r.onloadend = () => setEditForm(p=>({...p, photoUrl: r.result as string})); r.readAsDataURL(f); } }} className="hidden" accept="image/*"/>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <input className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-white text-sm focus:border-neon-blue outline-none transition-all font-medium" placeholder="Nome Completo" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                            <input className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-white text-sm focus:border-neon-blue outline-none transition-all font-medium" placeholder="E-mail" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} />
                        </div>
                        <button onClick={handleSaveProfile} disabled={isSaving} className="w-full bg-neon-blue hover:bg-blue-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all">{isSaving ? <Loader2 className="animate-spin" size={18}/> : 'Salvar Alterações'}</button>
                    </div>
                )}
            </div>

            {/* ABAS */}
            <div className="flex p-1.5 bg-slate-900 border border-slate-800 rounded-3xl shadow-inner">
                <button onClick={() => setActiveTab('OVERVIEW')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-[0.1em] rounded-2xl transition-all flex items-center justify-center gap-2 ${activeTab === 'OVERVIEW' ? 'bg-slate-800 text-white shadow-lg border border-slate-700' : 'text-slate-500 hover:text-slate-300'}`}><LayoutGrid size={14}/> Dashboard</button>
                <button onClick={() => setActiveTab('HISTORY')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-[0.1em] rounded-2xl transition-all flex items-center justify-center gap-2 ${activeTab === 'HISTORY' ? 'bg-slate-800 text-white shadow-lg border border-slate-700' : 'text-slate-500 hover:text-slate-300'}`}><History size={14}/> Histórico</button>
                <button onClick={() => setActiveTab('SUGGESTIONS')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-[0.1em] rounded-2xl transition-all flex items-center justify-center gap-2 ${activeTab === 'SUGGESTIONS' ? 'bg-slate-800 text-white shadow-lg border border-slate-700' : 'text-slate-500 hover:text-slate-300'}`}><Lightbulb size={14}/> Sugestões</button>
            </div>

            {/* CONTEÚDO OVERVIEW */}
            {activeTab === 'OVERVIEW' && (
                <div className="space-y-6 animate-fade-in">
                    {/* PRÓXIMO AGENDAMENTO */}
                    {upcomingReservations.length > 0 ? (
                        <div className="space-y-4">
                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-2 flex items-center gap-2"><Clock size={12} className="text-neon-orange"/> Seu Próximo Jogo</h3>
                            <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-neon-orange/20 rounded-[2rem] p-6 shadow-xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-4 bg-neon-orange text-black font-black text-[9px] rounded-bl-2xl uppercase tracking-tighter shadow-xl">
                                    Confirmado
                                </div>
                                <div className="flex items-center gap-4 mb-6">
                                    <div className="w-14 h-14 bg-slate-950 rounded-2xl flex flex-col items-center justify-center border border-slate-800">
                                        <span className="text-[9px] font-bold text-slate-500 uppercase">{upcomingReservations[0].date.split('-')[1]}</span>
                                        <span className="text-xl font-black text-white leading-none">{upcomingReservations[0].date.split('-')[2]}</span>
                                    </div>
                                    <div>
                                        <p className="text-lg font-black text-white uppercase tracking-tight">{upcomingReservations[0].time} <span className="text-slate-500 text-sm">({upcomingReservations[0].duration}h)</span></p>
                                        <p className="text-xs text-slate-400 font-medium">{upcomingReservations[0].laneCount} Pista(s) • {upcomingReservations[0].peopleCount} Pessoas</p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => navigate('/agendamento')} className="flex-1 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-black py-3 rounded-xl uppercase tracking-widest transition-all">Ver Detalhes</button>
                                    <a href={settings.whatsappLink} className="w-12 bg-green-600/20 hover:bg-green-600 text-green-500 hover:text-white rounded-xl flex items-center justify-center transition-all shadow-inner"><MessageCircle size={20}/></a>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-slate-900 p-8 rounded-[2rem] border border-dashed border-slate-800 text-center space-y-4">
                            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-700">
                                <Calendar size={32}/>
                            </div>
                            <div>
                                <h3 className="text-white font-bold uppercase text-sm">Nenhum agendamento ativo</h3>
                                <p className="text-slate-500 text-xs mt-1">Que tal marcar um boliche com a galera hoje?</p>
                            </div>
                            <button onClick={() => navigate('/agendamento')} className="bg-neon-orange hover:bg-orange-600 text-white font-black text-[10px] px-8 py-3 rounded-xl uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95">Reservar Agora</button>
                        </div>
                    )}

                    {/* AVALIAÇÃO PENDENTE (Se o último jogo foi Check-in e não avaliado) */}
                    {pastReservations.filter(r => r.status === ReservationStatus.CHECK_IN && !feedbacks.find(f => f.reserva_id === r.id)).slice(0,1).map(res => (
                        <div key={res.id} className="bg-blue-600 p-6 rounded-[2rem] shadow-2xl relative overflow-hidden group">
                            <div className="absolute right-[-20px] bottom-[-20px] text-white opacity-10 group-hover:scale-110 transition-transform">
                                <MessageSquare size={120} />
                            </div>
                            <h3 className="text-white font-black text-lg uppercase tracking-tighter mb-1">Como foi seu jogo dia {res.date.split('-').reverse().join('/')}?</h3>
                            <p className="text-blue-100 text-xs font-medium mb-6">Sua avaliação nos ajuda a crescer!</p>
                            <button onClick={() => setFeedbackTarget(res)} className="bg-white text-blue-600 font-black text-[10px] px-8 py-3 rounded-xl uppercase tracking-[0.2em] shadow-xl transition-all hover:bg-blue-50 active:scale-95">Dar Feedback</button>
                        </div>
                    ))}
                </div>
            )}

            {/* CONTEÚDO HISTÓRICO */}
            {activeTab === 'HISTORY' && (
                <div className="space-y-4 animate-fade-in">
                    {history.length === 0 ? (
                        <div className="p-12 text-center text-slate-600 font-black uppercase text-[10px] tracking-widest">Sem histórico</div>
                    ) : history.map(res => (
                        <div key={res.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg flex justify-between items-center group hover:border-slate-700 transition-all">
                            <div>
                                <p className="text-white font-black text-sm uppercase tracking-tight mb-1">{res.date.split('-').reverse().join('/')} <span className="text-slate-600 mx-1">|</span> {res.time}</p>
                                <div className="flex items-center gap-3">
                                    <span className={`text-[9px] font-black uppercase tracking-widest ${res.status === 'Confirmada' ? 'text-green-500' : 'text-slate-500'}`}>{res.status}</span>
                                    {feedbacks.find(f => f.reserva_id === res.id) && (
                                        <span className="flex items-center gap-0.5 text-yellow-500"><Star size={10} fill="currentColor"/> <span className="text-[10px] font-bold">{feedbacks.find(f => f.reserva_id === res.id).nota}</span></span>
                                    )}
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-bold text-slate-400">{res.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                <button onClick={() => openWhatsAppAction(res, 'ALTERAR')} className="text-[9px] font-black text-neon-blue uppercase tracking-tighter mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Detalhes</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* CONTEÚDO SUGESTÕES */}
            {activeTab === 'SUGGESTIONS' && (
                <div className="space-y-6 animate-fade-in">
                    <form onSubmit={handleSendSuggestion} className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-2xl space-y-4">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-neon-blue/10 rounded-xl flex items-center justify-center text-neon-blue border border-neon-blue/30">
                                <Lightbulb size={20}/>
                            </div>
                            <div>
                                <h3 className="text-white font-black text-sm uppercase tracking-tighter">Mande sua ideia!</h3>
                                <p className="text-slate-500 text-[10px] uppercase font-bold">O que podemos melhorar no boliche?</p>
                            </div>
                        </div>
                        <input 
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white text-sm focus:border-neon-blue outline-none transition-all"
                            placeholder="Título da sugestão (Ex: Novos Sabores)"
                            required
                            value={suggestionForm.title}
                            onChange={e => setSuggestionForm({...suggestionForm, title: e.target.value})}
                        />
                        <textarea 
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white text-sm focus:border-neon-blue outline-none transition-all h-32"
                            placeholder="Descreva sua ideia em detalhes..."
                            required
                            value={suggestionForm.desc}
                            onChange={e => setSuggestionForm({...suggestionForm, desc: e.target.value})}
                        />
                        <button type="submit" disabled={isSaving} className="w-full bg-neon-blue hover:bg-blue-600 text-white font-black text-[10px] py-4 rounded-xl uppercase tracking-[0.2em] shadow-xl transition-all">
                            {isSaving ? <Loader2 className="animate-spin mx-auto"/> : 'Enviar Sugestão'}
                        </button>
                    </form>
                </div>
            )}
        </main>

        {/* FEEDBACK MODAL */}
        {feedbackTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 backdrop-blur-xl">
                <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-[3rem] p-10 shadow-2xl animate-scale-in">
                    <div className="text-center mb-8">
                        <div className="w-20 h-20 bg-yellow-500/10 rounded-[2rem] flex items-center justify-center mx-auto mb-6 text-yellow-500 border border-yellow-500/30">
                            <Star size={40} fill="currentColor"/>
                        </div>
                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter leading-none mb-2">Avalie sua Visita</h3>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Sua nota é secreta e nos ajuda muito</p>
                    </div>
                    
                    <div className="flex justify-center gap-3 mb-8">
                        {[1,2,3,4,5].map(n => (
                            <button 
                                key={n}
                                onClick={() => setFeedbackForm({...feedbackForm, rating: n})}
                                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${feedbackForm.rating >= n ? 'text-yellow-500' : 'text-slate-800'}`}
                            >
                                <Star size={32} fill={feedbackForm.rating >= n ? "currentColor" : "none"} />
                            </button>
                        ))}
                    </div>

                    <textarea 
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white text-sm focus:border-yellow-500 outline-none transition-all h-24 mb-6"
                        placeholder="Opcional: O que foi legal ou o que podemos mudar?"
                        value={feedbackForm.comment}
                        onChange={e => setFeedbackForm({...feedbackForm, comment: e.target.value})}
                    />

                    <div className="flex flex-col gap-3">
                        <button onClick={handleSendFeedback} disabled={isSaving} className="w-full py-4 bg-yellow-500 hover:bg-yellow-400 text-black rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl transition-all">
                            {isSaving ? <Loader2 className="animate-spin mx-auto"/> : 'Confirmar Avaliação'}
                        </button>
                        <button onClick={() => setFeedbackTarget(null)} className="w-full py-3 text-slate-500 font-bold uppercase text-[10px] tracking-widest">Depois</button>
                    </div>
                </div>
            </div>
        )}

        {settings && (
            <a href={settings.whatsappLink} target="_blank" className="fixed bottom-6 right-6 z-40 bg-[#25D366] text-white p-4 rounded-[1.5rem] shadow-2xl transition-all transform hover:scale-110 border-2 border-white/10 active:scale-90"><MessageCircle size={28}/></a>
        )}
    </div>
  );
};

export default ClientDashboard;
