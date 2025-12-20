
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Client, Reservation, LoyaltyTransaction, ReservationStatus, PaymentStatus, Feedback, Suggestion, EventType } from '../types';
import { db } from '../services/mockBackend';
import { useApp } from '../contexts/AppContext';
import { 
  LogOut, 
  User, 
  Users,
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
  Lightbulb,
  ThumbsUp,
  Award,
  ChevronRight,
  MapPin,
  Phone,
  Mail,
  Zap,
  RefreshCw,
  Ban,
  Trash2,
  ArrowRight,
  CheckCircle,
  AlertTriangle,
  Timer
} from 'lucide-react';

// Subcomponente para o Contador de Pagamento (30 minutos)
const PaymentCountdown: React.FC<{ createdAt: string }> = ({ createdAt }) => {
    const [timeLeft, setTimeLeft] = useState<string>("");

    useEffect(() => {
        const updateTimer = () => {
            const created = new Date(createdAt).getTime();
            const expires = created + 30 * 60 * 1000; // 30 minutos
            const now = new Date().getTime();
            const diff = expires - now;

            if (diff <= 0) {
                setTimeLeft("EXPIRADO");
                return;
            }

            const mins = Math.floor(diff / 60000);
            const secs = Math.floor((diff % 60000) / 1000);
            setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [createdAt]);

    if (timeLeft === "EXPIRADO") {
        return (
            <div className="flex items-center gap-1 text-[10px] font-black text-red-500 uppercase bg-red-500/10 px-2 py-1 rounded-lg border border-red-500/20">
                Tempo de reserva esgotado
            </div>
        );
    }

    return (
        <div className="flex items-center gap-1.5 text-[10px] font-black text-neon-orange uppercase bg-neon-orange/10 px-3 py-1.5 rounded-xl border border-neon-orange/20 animate-pulse">
            <Timer size={12}/> Expira em {timeLeft}
        </div>
    );
};

const ClientDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { settings } = useApp();
  const [client, setClient] = useState<Client | null>(null);
  const [history, setHistory] = useState<Reservation[]>([]);
  const [loyalty, setLoyalty] = useState<LoyaltyTransaction[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [imgError, setImgError] = useState(false);

  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'HISTORY' | 'SUGGESTIONS'>('OVERVIEW');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', photoUrl: '', address: '' });
  
  // Feedback Modal
  const [feedbackTarget, setFeedbackTarget] = useState<Reservation | null>(null);
  const [feedbackForm, setFeedbackForm] = useState({ rating: 5, comment: '' });
  
  // Suggestion State
  const [suggestionForm, setSuggestionForm] = useState({ title: '', desc: '' });
  
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
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
          setEditForm({ 
            name: activeClient.name, 
            email: activeClient.email || '', 
            phone: activeClient.phone, 
            photoUrl: activeClient.photoUrl || '',
            address: activeClient.address || ''
          });
          
          const [myRes, pts, fbacks] = await Promise.all([
              db.reservations.getByClient(activeClient.id),
              db.loyalty.getHistory(activeClient.id),
              db.feedbacks.getByClient(activeClient.id)
          ]);
          
          setHistory(myRes);
          setLoyalty(pts);
          setFeedbacks(fbacks);
      } catch (e) {
          console.error("Erro ao carregar dados:", e);
      } finally { 
          if (!isBackground) setLoading(false); 
      }
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
          alert("Perfil atualizado com sucesso!");
      } catch (e) { 
          alert("Erro ao atualizar perfil."); 
      } finally { 
          setIsSaving(false); 
      }
  };

  const openFeedbackModal = (res: Reservation) => {
    const existing = feedbacks.find(f => f.reserva_id === res.id);
    if (existing) {
        setFeedbackForm({ rating: existing.nota, comment: existing.comentario || '' });
    } else {
        setFeedbackForm({ rating: 5, comment: '' });
    }
    setFeedbackTarget(res);
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
          await loadData(true);
          alert("Sua avaliação foi salva! Obrigado!");
      } catch (e: any) { 
          console.error(e);
          alert("Erro ao enviar avaliação: " + (e.message || "Tente novamente.")); 
      }
      finally { setIsSaving(false); }
  };

  const handleSendSuggestion = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!client || isSaving) return;
      
      const title = suggestionForm.title.trim();
      const desc = suggestionForm.desc.trim();

      if (!title || !desc) {
          alert("Preencha título e descrição da sua ideia.");
          return;
      }

      setIsSaving(true);
      try {
          await db.suggestions.create({
              cliente_id: client.id,
              titulo: title,
              descricao: desc
          });
          setSuggestionForm({ title: '', desc: '' });
          alert("Sua ideia foi enviada com sucesso! Obrigado por nos ajudar a melhorar.");
      } catch (e: any) { 
          console.error("Erro técnico detalhado:", e);
          
          // Formata a mensagem de erro para não exibir [object Object]
          const errorMsg = e.message || JSON.stringify(e);
          
          if (e.code === '42501' || errorMsg.includes('security policy')) {
              alert("ERRO DE PERMISSÃO (RLS): O banco de dados recusou o envio. Certifique-se de executar o NOVO SQL (que remove referências a sequências inexistentes) no painel do Supabase.");
          } else {
              alert(`Erro ao enviar sugestão: ${errorMsg}`);
          }
      }
      finally { setIsSaving(false); }
  };

  const handlePayNow = (res: Reservation) => {
      navigate('/checkout', { 
          state: { 
              clientId: res.clientId,
              name: res.clientName,
              whatsapp: client?.phone || '',
              date: res.date,
              time: res.time,
              people: res.peopleCount,
              lanes: res.laneCount,
              duration: res.duration,
              type: res.eventType,
              totalValue: res.totalValue,
              reservationIds: [res.id]
          } 
      });
  };

  const openWhatsAppAction = (res: Reservation, action: 'ALTERAR' | 'CANCELAR' | 'CONTATO') => {
    if (!settings?.whatsappLink) return;
    const dateStr = res.date.split('-').reverse().join('/');
    let msg = "";
    if (action === 'ALTERAR') {
        msg = `Olá! Gostaria de ALTERAR minha reserva do dia ${dateStr} às ${res.time}. (Ref: ${res.id.slice(0,8)})`;
    } else if (action === 'CANCELAR') {
        msg = `Olá! Preciso CANCELAR minha reserva do dia ${dateStr} às ${res.time}. (Ref: ${res.id.slice(0,8)})`;
    } else {
        msg = `Olá! Tenho uma dúvida sobre minha reserva do dia ${dateStr} às ${res.time}.`;
    }
    const url = `${settings.whatsappLink}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const getClientTier = () => {
      const visits = history.filter(r => r.status === ReservationStatus.CHECK_IN).length;
      if (visits >= 15) return { label: 'VIP PLATINUM', icon: Award, color: 'text-yellow-500', bg: 'bg-yellow-500/10' };
      if (visits >= 5) return { label: 'CLIENTE FIEL', icon: ThumbsUp, color: 'text-blue-400', bg: 'bg-blue-400/10' };
      return { label: 'MEMBRO BRONZE', icon: Star, color: 'text-slate-400', bg: 'bg-slate-400/10' };
  };

  const { upcomingReservations, pastReservations } = useMemo(() => {
      const upcoming: Reservation[] = [];
      const past: Reservation[] = [];
      history.forEach(res => {
          if (res.status === ReservationStatus.CANCELADA) return;

          const startDateTime = new Date(`${res.date}T${res.time}`);
          const endDateTime = new Date(startDateTime.getTime() + (res.duration * 60 * 60 * 1000));
          
          const isFinishedStatus = [ReservationStatus.CHECK_IN, ReservationStatus.NO_SHOW].includes(res.status);

          if (isFinishedStatus || endDateTime < now) {
              past.push(res);
          } else {
              upcoming.push(res);
          }
      });
      return { 
        upcomingReservations: upcoming.sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)), 
        pastReservations: past.sort((a,b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time)) 
      };
  }, [history, now]);

  const getCountdown = (res: Reservation) => {
    const target = new Date(`${res.date}T${res.time}`);
    const diff = target.getTime() - now.getTime();
    if (diff <= 0) return "O jogo começou!";
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (days > 0) return `Faltam ${days}d ${hours}h`;
    return `Faltam ${hours}h ${mins}m`;
  };

  const tier = getClientTier();
  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-neon-orange" size={48}/></div>;
  if (!client) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 pb-24 font-sans selection:bg-neon-orange/30">
        <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 p-4 sticky top-0 z-40 shadow-xl">
            <div className="max-w-xl mx-auto flex justify-between items-center">
                <div className="flex items-center gap-3">
                    {settings.logoUrl && !imgError ? (
                        <img 
                            src={settings.logoUrl} 
                            alt={settings.establishmentName} 
                            className="h-8 w-auto object-contain drop-shadow-[0_0_8px_rgba(249,115,22,0.3)]"
                            onError={() => setImgError(true)}
                        />
                    ) : (
                        <span className="text-neon-orange font-black text-xs uppercase tracking-widest">Tô Na Pista</span>
                    )}
                    <h1 className="text-sm font-bold text-white uppercase tracking-tighter">Minha Conta</h1>
                </div>
                <button onClick={handleLogout} className="text-slate-500 hover:text-red-400 p-2 transition-colors"><LogOut size={18}/></button>
            </div>
        </header>

        <main className="max-w-xl mx-auto p-4 space-y-6">
            
            {/* PERFIL & TIER */}
            <div className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl relative overflow-hidden group">
                {!isEditing ? (
                    <div className="relative z-10 flex flex-col items-center text-center">
                        <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center border-4 border-slate-700 text-neon-blue overflow-hidden shadow-2xl mb-4 relative">
                            {client.photoUrl ? <img src={client.photoUrl} className="w-full h-full object-cover" /> : <Users size={48}/>}
                        </div>
                        <h2 className="text-2xl font-black text-white tracking-tight mb-2">{client.name}</h2>
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
                    <div className="space-y-4 animate-fade-in">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-bold text-white uppercase text-xs tracking-widest text-slate-400">Dados da Conta</h3>
                            <button onClick={() => setIsEditing(false)} className="text-slate-500 hover:text-white p-2 bg-slate-800 rounded-full transition-colors"><X size={20}/></button>
                        </div>
                        
                        {/* Foto Upload */}
                        <div className="flex flex-col items-center mb-4">
                            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                <div className="w-20 h-20 bg-slate-800 rounded-full border-2 border-slate-700 overflow-hidden flex items-center justify-center">
                                    {editForm.photoUrl ? <img src={editForm.photoUrl} className="w-full h-full object-cover" /> : <Users size={32} className="text-slate-600"/>}
                                </div>
                                <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                                    <Camera size={20} className="text-white"/>
                                </div>
                            </div>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                accept="image/*" 
                                onChange={(e) => { 
                                    const file = e.target.files?.[0]; 
                                    if(file){ 
                                        const reader = new FileReader(); 
                                        reader.onloadend = () => setEditForm(prev => ({...prev, photoUrl: reader.result as string})); 
                                        reader.readAsDataURL(file); 
                                    } 
                                }}
                            />
                            <p className="text-[9px] text-slate-500 font-bold uppercase mt-2">Toque para mudar a foto</p>
                        </div>

                        <div className="space-y-3">
                            <div className="relative">
                                <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16}/>
                                <input className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 pl-12 text-white text-sm focus:border-neon-blue outline-none transition-all font-medium" placeholder="Nome Completo" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                            </div>
                            <div className="relative">
                                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16}/>
                                <input className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 pl-12 text-white text-sm focus:border-neon-blue outline-none transition-all font-medium font-mono" placeholder="WhatsApp" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
                            </div>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16}/>
                                <input className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 pl-12 text-white text-sm focus:border-neon-blue outline-none transition-all font-medium" placeholder="E-mail" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} />
                            </div>
                            <div className="relative">
                                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16}/>
                                <input className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 pl-12 text-white text-sm focus:border-neon-blue outline-none transition-all font-medium" placeholder="Endereço (opcional)" value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} />
                            </div>
                        </div>
                        <button onClick={handleSaveProfile} disabled={isSaving} className="w-full bg-neon-blue hover:bg-blue-600 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all">
                            {isSaving ? <Loader2 className="animate-spin" size={18}/> : 'Salvar Alterações'}
                        </button>
                    </div>
                )}
            </div>

            {/* ABAS */}
            <div className="flex p-1.5 bg-slate-900 border border-slate-800 rounded-3xl shadow-inner">
                <button onClick={() => setActiveTab('OVERVIEW')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-[0.1em] rounded-2xl transition-all ${activeTab === 'OVERVIEW' ? 'bg-slate-800 text-white shadow-lg border border-slate-700' : 'text-slate-500 hover:text-slate-300'}`}>Dashboard</button>
                <button onClick={() => setActiveTab('HISTORY')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-[0.1em] rounded-2xl transition-all ${activeTab === 'HISTORY' ? 'bg-slate-800 text-white shadow-lg border border-slate-700' : 'text-slate-500 hover:text-slate-300'}`}>Histórico</button>
                <button onClick={() => setActiveTab('SUGGESTIONS')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-[0.1em] rounded-2xl transition-all ${activeTab === 'SUGGESTIONS' ? 'bg-slate-800 text-white shadow-lg border border-slate-700' : 'text-slate-500 hover:text-slate-300'}`}>Sugestões</button>
            </div>

            {/* CONTEÚDO OVERVIEW */}
            {activeTab === 'OVERVIEW' && (
                <div className="space-y-6 animate-fade-in">
                    {upcomingReservations.length > 0 ? upcomingReservations.map(res => (
                        <div key={res.id} className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 shadow-2xl space-y-6 relative overflow-hidden group">
                            {/* Status Badge */}
                            <div className={`absolute top-0 right-0 p-4 font-black text-[9px] rounded-bl-2xl uppercase tracking-tighter shadow-xl ${res.status === ReservationStatus.CONFIRMADA ? 'bg-green-600 text-white' : 'bg-neon-orange text-black animate-pulse'}`}>
                                {res.status}
                            </div>

                            {/* Date & Time Header */}
                            <div className="flex items-center gap-5">
                                <div className="w-16 h-16 bg-slate-950 rounded-[1.5rem] flex flex-col items-center justify-center border-2 border-slate-800 shadow-inner">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">{res.date.split('-')[1]}</span>
                                    <span className="text-2xl font-black text-white leading-none">{res.date.split('-')[2]}</span>
                                </div>
                                <div>
                                    <p className="text-2xl font-black text-white uppercase tracking-tighter leading-none mb-1">{res.time}</p>
                                    <div className="flex items-center gap-3 text-xs text-slate-500 font-bold uppercase tracking-tight">
                                        <span className="flex items-center gap-1"><Clock size={12}/> {res.duration}h</span>
                                        <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                                        <span className="flex items-center gap-1"><LayoutGrid size={12}/> {res.laneCount} Pistas</span>
                                        <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                                        <span className="flex items-center gap-1"><Users size={12}/> {res.peopleCount} Pessoas</span>
                                    </div>
                                </div>
                            </div>

                            {/* Full Info Grid */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
                                    <p className="text-[9px] font-bold text-slate-500 uppercase mb-0.5">Tipo de Jogo</p>
                                    <p className="text-xs font-bold text-slate-300">{res.eventType}</p>
                                </div>
                                <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-800 text-right">
                                    <p className="text-[9px] font-bold text-slate-500 uppercase mb-0.5">Valor Total</p>
                                    <p className="text-lg font-black text-neon-green">{res.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                </div>
                                {res.hasTableReservation && (
                                    <div className="col-span-2 bg-slate-950/50 p-4 rounded-2xl border border-slate-800 flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 bg-orange-900/20 rounded-lg text-orange-400"><MapPin size={14}/></div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mesa Reservada</span>
                                        </div>
                                        <span className="text-xs font-bold text-orange-400">{res.tableSeatCount} Lugares</span>
                                    </div>
                                )}
                            </div>

                            {/* Action Buttons & Countdown */}
                            <div className="flex flex-col gap-3">
                                {res.status === ReservationStatus.PENDENTE && (
                                    <div className="space-y-3">
                                        {/* CONTAGEM DOS 30 MINUTOS */}
                                        {res.createdAt && <PaymentCountdown createdAt={res.createdAt} />}
                                        
                                        <button 
                                            onClick={() => handlePayNow(res)} 
                                            className="w-full bg-green-600 hover:bg-green-500 text-white font-black py-4 rounded-2xl uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-green-900/10 flex items-center justify-center gap-2 transition active:scale-95"
                                        >
                                            <CreditCard size={18}/> PAGAR RESERVA
                                        </button>
                                    </div>
                                )}
                                
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => openWhatsAppAction(res, 'ALTERAR')} 
                                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white py-3 rounded-xl text-[9px] font-black uppercase transition flex items-center justify-center gap-1.5 border border-slate-700"
                                    >
                                        <RefreshCw size={12}/> Alterar
                                    </button>
                                    <button 
                                        onClick={() => openWhatsAppAction(res, 'CANCELAR')} 
                                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-red-400 py-3 rounded-xl text-[9px] font-black uppercase transition flex items-center justify-center gap-1.5 border border-slate-700"
                                    >
                                        <Ban size={12}/> Cancelar
                                    </button>
                                    <button 
                                        onClick={() => openWhatsAppAction(res, 'CONTATO')} 
                                        className="w-12 bg-neon-blue/10 hover:bg-neon-blue text-neon-blue hover:text-white rounded-xl flex items-center justify-center transition border border-neon-blue/20"
                                    >
                                        <MessageCircle size={20}/>
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-center gap-2 pt-2 text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                                <Zap size={10} className="text-neon-blue"/> {getCountdown(res)} para o jogo
                            </div>
                        </div>
                    )) : (
                        <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-dashed border-slate-800 text-center space-y-4">
                            <h3 className="text-white font-bold uppercase text-sm">Nenhum agendamento ativo</h3>
                            <button onClick={() => navigate('/agendamento')} className="bg-neon-orange hover:bg-orange-600 text-white font-black text-[10px] px-8 py-3 rounded-xl uppercase tracking-[0.2em] shadow-xl transition-all">Reservar Agora</button>
                        </div>
                    )}

                    {/* SEÇÃO DE AVALIAÇÃO - RESTAURADA PARA TODOS JOGOS PASSADOS QUE AINDA NÃO FORAM AVALIADOS */}
                    {pastReservations.filter(r => !feedbacks.some(f => f.reserva_id === r.id)).slice(0, 1).map(res => (
                        <div key={res.id} className="bg-gradient-to-br from-indigo-600 to-blue-700 p-6 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
                            <div className="absolute right-[-20px] top-[-20px] opacity-10 rotate-12 group-hover:scale-110 transition-transform">
                                <Star size={140} fill="white"/>
                            </div>
                            <div className="relative z-10">
                                <h3 className="text-white font-black text-xl uppercase tracking-tighter mb-2">
                                    Como foi seu jogo?
                                </h3>
                                <p className="text-blue-100 text-xs font-bold uppercase tracking-widest mb-6 opacity-80">
                                    Visita em {res.date.split('-').reverse().join('/')} às {res.time}
                                </p>
                                <button 
                                    onClick={() => openFeedbackModal(res)} 
                                    className="bg-white text-blue-600 font-black text-[10px] px-10 py-4 rounded-2xl uppercase tracking-[0.2em] shadow-xl transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                                >
                                    <Star size={14} fill="currentColor"/> Dar Feedback Agora
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* CONTEÚDO HISTÓRICO */}
            {activeTab === 'HISTORY' && (
                <div className="space-y-4 animate-fade-in">
                    {history.length === 0 ? (
                        <div className="p-12 text-center text-slate-600 font-black uppercase text-[10px] tracking-widest">Sem histórico</div>
                    ) : history.map(res => {
                        const feedback = feedbacks.find(f => f.reserva_id === res.id);
                        return (
                            <div key={res.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-lg flex justify-between items-center group">
                                <div>
                                    <p className="text-white font-black text-sm uppercase tracking-tight mb-1">{res.date.split('-').reverse().join('/')} | {res.time}</p>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[9px] font-black uppercase tracking-widest ${res.status === 'Confirmada' || res.status === 'Check-in' ? 'text-green-500' : 'text-slate-500'}`}>{res.status}</span>
                                        {feedback && (
                                            <span className="flex items-center gap-0.5 text-yellow-500"><Star size={10} fill="currentColor"/> <span className="text-[10px] font-bold">{feedback.nota}</span></span>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-bold text-slate-400">{res.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                    {res.status === ReservationStatus.CHECK_IN && !feedback && (
                                        <button onClick={() => openFeedbackModal(res)} className="text-[9px] font-black text-neon-blue uppercase mt-1 flex items-center justify-end gap-1 hover:underline">
                                            <Star size={10}/> Avaliar
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* CONTEÚDO SUGESTÕES */}
            {activeTab === 'SUGGESTIONS' && (
                <div className="space-y-6 animate-fade-in">
                    <form onSubmit={handleSendSuggestion} className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl space-y-4">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-neon-blue/10 rounded-xl flex items-center justify-center text-neon-blue border border-neon-blue/30">
                                <Lightbulb size={20}/>
                            </div>
                            <div>
                                <h3 className="text-white font-black text-sm uppercase tracking-tighter">Mande sua ideia!</h3>
                                <p className="text-slate-500 text-[10px] uppercase font-bold">O que podemos melhorar?</p>
                            </div>
                        </div>
                        <input 
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white text-sm focus:border-neon-blue outline-none transition-all"
                            placeholder="Título da sugestão"
                            required
                            disabled={isSaving}
                            value={suggestionForm.title}
                            onChange={e => setSuggestionForm(prev => ({...prev, title: e.target.value}))}
                        />
                        <textarea 
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white text-sm focus:border-neon-blue outline-none transition-all h-32"
                            placeholder="Descreva sua ideia em detalhes..."
                            required
                            disabled={isSaving}
                            value={suggestionForm.desc}
                            onChange={e => setSuggestionForm(prev => ({...prev, desc: e.target.value}))}
                        />
                        <button 
                            type="submit" 
                            disabled={isSaving} 
                            className="w-full bg-neon-blue hover:bg-blue-600 text-white font-black text-[10px] py-5 rounded-2xl uppercase tracking-[0.2em] shadow-xl transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 disabled:grayscale"
                        >
                            {isSaving ? <Loader2 className="animate-spin" size={18}/> : <><Save size={18}/> Enviar Sugestão</>}
                        </button>
                    </form>
                </div>
            )}
        </main>

        {/* FEEDBACK MODAL */}
        {feedbackTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 backdrop-blur-xl">
                <div className="bg-slate-800 border border-slate-700 w-full max-w-sm rounded-[3rem] p-10 shadow-2xl animate-scale-in">
                    <div className="text-center mb-8">
                        <div className="w-20 h-20 bg-yellow-500/10 rounded-[2rem] flex items-center justify-center mx-auto mb-6 text-yellow-500 border border-yellow-500/30">
                            <Star size={40} fill="currentColor"/>
                        </div>
                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter leading-none mb-2">
                           {feedbacks.find(f => f.reserva_id === feedbackTarget.id) ? 'Editar Avaliação' : 'Avalie sua Visita'}
                        </h3>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Sua nota nos ajuda a crescer</p>
                    </div>
                    
                    <div className="flex justify-center gap-3 mb-8">
                        {[1,2,3,4,5].map(n => (
                            <button 
                                key={n}
                                type="button"
                                onClick={() => setFeedbackForm(prev => ({...prev, rating: n}))}
                                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all border-2 ${feedbackForm.rating >= n ? 'text-yellow-500 border-yellow-500/30 bg-yellow-500/5' : 'text-slate-600 border-slate-700 hover:border-slate-500'}`}
                            >
                                <Star 
                                    size={36} 
                                    fill={feedbackForm.rating >= n ? "currentColor" : "none"} 
                                    strokeWidth={2}
                                    stroke="currentColor"
                                />
                            </button>
                        ))}
                    </div>

                    <textarea 
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white text-sm focus:border-yellow-500 outline-none transition-all h-24 mb-6"
                        placeholder="O que achou?"
                        value={feedbackForm.comment}
                        onChange={e => setFeedbackForm(prev => ({...prev, comment: e.target.value}))}
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
    </div>
  );
};

export default ClientDashboard;
