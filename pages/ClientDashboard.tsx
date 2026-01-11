
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db } from '../services/mockBackend';
import { Reservation, ReservationStatus, PaymentStatus, Client, AppSettings } from '../types';
import { 
  User, 
  LogOut, 
  Gift,
  Star,
  MessageSquare,
  History,
  Loader2,
  Plus,
  Settings as SettingsIcon,
  X,
  Save,
  Mail,
  Phone,
  Camera
} from 'lucide-react';

// Importação dos Módulos
import { ReservationCard } from '../components/ClientDashboard/ReservationCard';
import { LoyaltySection } from '../components/ClientDashboard/LoyaltySection';
import { HistoryModal } from '../components/ClientDashboard/HistoryModal';
import { SuggestionsModal } from '../components/ClientDashboard/SuggestionsModal';

const ClientDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [clientUser, setClientUser] = useState<Client | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [history, setHistory] = useState<Reservation[]>([]);
  const [activeTab, setActiveTab] = useState<'RESERVAS' | 'FIDELIDADE'>('RESERVAS');
  const [isLoading, setIsLoading] = useState(true);
  const [imgError, setImgError] = useState(false);

  // Estados dos Modais
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [selectedResForFeedback, setSelectedResForFeedback] = useState<Reservation | null>(null);
  
  // Perfil Form
  const [profileForm, setProfileForm] = useState({ name: '', phone: '', email: '', photoUrl: '' });
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Feedback Form
  const [feedbackNota, setFeedbackNota] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');

  const fetchData = async () => {
    setIsLoading(true);
    const stored = localStorage.getItem('tonapista_client_auth');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Client;
        const [freshClient, res, config] = await Promise.all([
          db.clients.getById(parsed.id),
          db.reservations.getByClient(parsed.id),
          db.settings.get()
        ]);
        
        const clientData = freshClient || parsed;
        setClientUser(clientData);
        setHistory(res);
        setSettings(config);
        setProfileForm({
            name: clientData.name,
            phone: clientData.phone,
            email: clientData.email || '',
            photoUrl: clientData.photoUrl || ''
        });
      } catch (error) {
        console.error("Erro ao carregar dashboard:", error);
      }
    } else {
      navigate('/login');
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [navigate]);

  const handleLogout = async () => {
    localStorage.removeItem('tonapista_client_auth');
    await db.clients.logout();
    navigate('/login');
  };

  const handleSaveProfile = async () => {
      if (!clientUser) return;
      setIsSavingProfile(true);
      try {
          const updated = { ...clientUser, ...profileForm };
          await db.clients.update(updated);
          setClientUser(updated);
          localStorage.setItem('tonapista_client_auth', JSON.stringify(updated));
          setIsEditProfileOpen(false);
      } catch (e) {
          alert("Erro ao salvar.");
      } finally {
          setIsSavingProfile(false);
      }
  };

  const handleSendFeedback = async () => {
    if (!clientUser || !selectedResForFeedback) return;
    try {
      await db.feedbacks.create({
        reserva_id: selectedResForFeedback.id,
        cliente_id: clientUser.id,
        nota: feedbackNota,
        comentario: feedbackComment
      });
      setSelectedResForFeedback(null);
      setFeedbackComment('');
      fetchData(); 
    } catch (e) {
      alert("Erro ao enviar avaliação.");
    }
  };

  const { upcomingReservations, pastReservations } = useMemo(() => {
      const upcoming: Reservation[] = [];
      const past: Reservation[] = [];
      const now = new Date();
      
      history.forEach(res => {
          const startDateTime = new Date(`${res.date}T${res.time}`);
          const durationHrs = res.duration || 1;
          const endDateTime = new Date(startDateTime.getTime() + (durationHrs * 60 * 60 * 1000));
          const isFinished = [ReservationStatus.CHECK_IN, ReservationStatus.NO_SHOW, ReservationStatus.CANCELADA].includes(res.status);
          
          if (isFinished || endDateTime < now) past.push(res);
          else upcoming.push(res);
      });
      return { 
          upcomingReservations: upcoming.sort((a,b) => b.createdAt.localeCompare(a.createdAt)), 
          pastReservations: past.sort((a,b) => b.createdAt.localeCompare(a.createdAt)) 
      };
  }, [history]);

  if (isLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-neon-orange" size={48}/></div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 pb-24 selection:bg-neon-orange/30">
        <header className="bg-slate-900/80 backdrop-blur-xl sticky top-0 z-40 border-b border-slate-800 p-4 shadow-2xl">
            <div className="max-w-xl mx-auto flex justify-between items-center">
                <div className="flex items-center gap-3">
                    {settings?.logoUrl && !imgError ? (
                        <img src={settings.logoUrl} alt="Logo" className="h-8 w-auto object-contain" onError={() => setImgError(true)} />
                    ) : (
                        <Link to="/agendamento" className="text-xl font-black text-neon-orange tracking-tighter uppercase">TÔ NA PISTA</Link>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <Link to="/agendamento" className="bg-neon-orange text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition flex items-center gap-2">
                        <Plus size={14}/> Reservar
                    </Link>
                    <button onClick={handleLogout} className="text-slate-500 hover:text-red-400 transition p-2"><LogOut size={20}/></button>
                </div>
            </div>
        </header>

        <main className="max-w-xl mx-auto p-4 space-y-6">
            {/* Perfil Header */}
            {clientUser && (
                <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 shadow-2xl flex items-center gap-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none group-hover:rotate-12 transition-transform"><Star size={120} /></div>
                    <div className="relative">
                        <div className="w-20 h-20 bg-slate-800 rounded-[1.8rem] flex items-center justify-center border-2 border-slate-700 text-neon-blue shadow-inner flex-shrink-0 overflow-hidden">
                            {clientUser.photoUrl ? <img src={clientUser.photoUrl} className="w-full h-full object-cover" /> : <User size={40}/>}
                        </div>
                        <button onClick={() => setIsEditProfileOpen(true)} className="absolute -bottom-1 -right-1 bg-neon-orange p-1.5 rounded-xl border-4 border-slate-900 text-white shadow-lg hover:scale-110 transition"><SettingsIcon size={14} /></button>
                    </div>
                    <div className="min-w-0 flex-1 z-10">
                        {/* Nome do Cliente: Ajustado para não cortar em mobile (break-words + remove truncate) */}
                        <h2 className="text-xl md:text-2xl font-black text-white tracking-tight leading-tight break-words">{clientUser.name}</h2>
                        <div className="flex items-center gap-2 mt-2">
                            <span className="text-[10px] font-black text-neon-orange bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/20 flex items-center gap-1 uppercase tracking-widest shadow-sm">
                                <Gift size={12} fill="currentColor"/> {clientUser.loyaltyBalance || 0} pts
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Menu de Navegação / Ações */}
            <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setIsHistoryOpen(true)} className="bg-slate-900 border border-slate-800 p-4 rounded-3xl flex items-center justify-center gap-3 hover:bg-slate-800 transition shadow-lg group">
                    <History className="text-slate-500 group-hover:text-neon-blue transition-colors" size={18}/>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Meu Histórico</span>
                </button>
                <button onClick={() => setIsSuggestionsOpen(true)} className="bg-slate-900 border border-slate-800 p-4 rounded-3xl flex items-center justify-center gap-3 hover:bg-slate-800 transition shadow-lg group">
                    <MessageSquare className="text-slate-500 group-hover:text-neon-blue transition-colors" size={18}/>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Sugestão</span>
                </button>
            </div>

            {/* Abas Principais */}
            <div className="flex p-1.5 bg-slate-900 border border-slate-800 rounded-3xl shadow-inner gap-1">
                <button onClick={() => setActiveTab('RESERVAS')} className={`flex-1 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'RESERVAS' ? 'bg-slate-800 text-white shadow-lg border border-slate-700' : 'text-slate-500 hover:text-slate-300'}`}>Ativos</button>
                <button onClick={() => setActiveTab('FIDELIDADE')} className={`flex-1 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'FIDELIDADE' ? 'bg-slate-800 text-white shadow-lg border border-slate-700' : 'text-slate-500 hover:text-slate-300'}`}>Fidelidade</button>
            </div>

            {activeTab === 'RESERVAS' ? (
                <div className="space-y-6 animate-fade-in">
                    {upcomingReservations.filter(r => r.status !== ReservationStatus.CANCELADA).length > 0 ? (
                        upcomingReservations.filter(r => r.status !== ReservationStatus.CANCELADA).map(res => (
                            <ReservationCard 
                                key={res.id} 
                                res={res} 
                                onPay={(r) => navigate('/checkout', { state: { ...r, whatsapp: clientUser?.phone, reservationIds: [r.id], people: r.peopleCount, lanes: r.laneCount, type: r.eventType } })}
                                onRefresh={fetchData}
                                whatsappLink={settings?.whatsappLink}
                            />
                        ))
                    ) : (
                        <div className="bg-slate-900 p-8 rounded-[2.5rem] border border-dashed border-slate-800 text-center space-y-4">
                            <h3 className="text-white font-bold uppercase text-sm">Sem agendamentos ativos</h3>
                            <button onClick={() => navigate('/agendamento')} className="bg-neon-orange hover:bg-orange-600 text-white font-black text-[10px] px-8 py-3 rounded-xl uppercase tracking-[0.2em] shadow-xl transition-all">Reservar Pista Agora</button>
                        </div>
                    )}
                </div>
            ) : (
                <LoyaltySection balance={clientUser?.loyaltyBalance || 0} />
            )}
        </main>

        {/* MODAIS MODULARES */}
        {isHistoryOpen && (
            <HistoryModal 
                history={pastReservations} 
                onClose={() => setIsHistoryOpen(false)} 
                onRate={setSelectedResForFeedback} 
            />
        )}

        {isSuggestionsOpen && clientUser && (
            <SuggestionsModal 
                clientId={clientUser.id} 
                onClose={() => setIsSuggestionsOpen(false)} 
            />
        )}

        {isEditProfileOpen && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4">
                <div className="bg-slate-800 border border-slate-700 w-full max-sm rounded-[2.5rem] p-8 shadow-2xl animate-scale-in">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-black text-white uppercase tracking-tighter">Editar Perfil</h3>
                        <button onClick={() => setIsEditProfileOpen(false)} className="text-slate-500 hover:text-white transition"><X/></button>
                    </div>
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2"><User size={12}/> Nome</label>
                            <input className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-white font-bold outline-none focus:border-neon-blue transition" value={profileForm.name} onChange={e => setProfileForm({...profileForm, name: e.target.value})} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2"><Phone size={12}/> WhatsApp</label>
                            <input className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-white font-bold outline-none focus:border-neon-blue transition" value={profileForm.phone} onChange={e => setProfileForm({...profileForm, phone: e.target.value})} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2"><Mail size={12}/> E-mail</label>
                            <input className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-white font-bold outline-none focus:border-neon-blue transition" value={profileForm.email} onChange={e => setProfileForm({...profileForm, email: e.target.value})} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2"><Camera size={12}/> URL da Foto</label>
                            <input className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-white font-bold outline-none focus:border-neon-blue transition" value={profileForm.photoUrl} onChange={e => setProfileForm({...profileForm, photoUrl: e.target.value})} />
                        </div>
                        <button onClick={handleSaveProfile} disabled={isSavingProfile} className="w-full bg-neon-blue text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl flex items-center justify-center gap-2 transition active:scale-95">
                            {isSavingProfile ? <Loader2 className="animate-spin" /> : <><Save size={18}/> Salvar Dados</>}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {selectedResForFeedback && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4">
                <div className="bg-slate-800 border border-slate-700 w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl text-center">
                    <div className="w-16 h-16 bg-neon-orange/10 text-neon-orange rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner border border-neon-orange/20"><Star size={32} fill="currentColor"/></div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-1">Avaliar Experiência</h3>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-8">Jogo do dia {selectedResForFeedback.date.split('-').reverse().join('/')}</p>
                    <div className="flex justify-center gap-2 mb-8">
                        {[1,2,3,4,5].map(star => (
                            <button key={star} onClick={() => setFeedbackNota(star)} className={`transition-transform hover:scale-125 ${feedbackNota >= star ? 'text-neon-orange' : 'text-slate-700'}`}><Star size={32} fill={feedbackNota >= star ? "currentColor" : "none"} /></button>
                        ))}
                    </div>
                    <textarea className="w-full bg-slate-900 border border-slate-700 rounded-2xl p-4 text-white text-sm mb-6 outline-none focus:border-neon-orange h-24" placeholder="Comentário..." value={feedbackComment} onChange={e => setFeedbackComment(e.target.value)} />
                    <div className="flex gap-3">
                        <button onClick={() => setSelectedResForFeedback(null)} className="flex-1 py-4 bg-slate-700 text-white rounded-2xl font-black uppercase text-[10px]">Sair</button>
                        <button onClick={handleSendFeedback} className="flex-[2] py-4 bg-neon-orange text-white rounded-2xl font-black uppercase text-[10px] shadow-lg active:scale-95 transition-all">Enviar</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default ClientDashboard;
