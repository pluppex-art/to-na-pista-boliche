
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Client, Reservation, LoyaltyTransaction, ReservationStatus, PaymentStatus } from '../types';
import { db } from '../services/mockBackend';
import { useApp } from '../contexts/AppContext';
import { 
  LogOut, 
  User, 
  Users, 
  Gift, 
  Clock, 
  Calendar, 
  Coins, 
  Loader2, 
  MessageCircle, 
  Edit, 
  Save, 
  X, 
  Camera, 
  CreditCard, 
  Trash2, 
  DollarSign, 
  Utensils, 
  LayoutGrid, 
  AlertCircle, 
  Store, 
  Tag,
  History,
  Archive
} from 'lucide-react';
import { supabase } from '../services/supabaseClient';

const ClientDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { settings } = useApp();
  const [client, setClient] = useState<Client | null>(null);
  const [history, setHistory] = useState<Reservation[]>([]);
  const [loyalty, setLoyalty] = useState<LoyaltyTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'UPCOMING' | 'HISTORY'>('UPCOMING');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', photoUrl: '' });
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
          const myRes = await db.reservations.getByClient(activeClient.id);
          setHistory(myRes);
          const pts = await db.loyalty.getHistory(activeClient.id);
          setLoyalty(pts);
      } finally { if (!isBackground) setLoading(false); }
  };

  useEffect(() => { loadData(); }, [navigate]);

  useEffect(() => {
    if (!client?.id) return;
    const channel = supabase.channel(`client-dashboard-${client.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas', filter: `client_id=eq.${client.id}` }, () => loadData(true))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'clientes', filter: `client_id=eq.${client.id}` }, () => loadData(true))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [client?.id]); 

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

  const handlePayNow = (res: Reservation) => {
      navigate('/checkout', { state: { name: client?.name, whatsapp: client?.phone, email: client?.email, date: res.date, time: res.time, people: res.peopleCount, lanes: res.laneCount, duration: res.duration, type: res.eventType, totalValue: res.totalValue, obs: res.observations, reservationIds: [res.id] } });
  };

  const getExpiresIn = (res: Reservation) => {
      if (res.status !== ReservationStatus.PENDENTE || res.payOnSite || !res.createdAt) return null;
      const expiresAt = new Date(new Date(res.createdAt).getTime() + 30 * 60000);
      const diffMs = expiresAt.getTime() - now.getTime();
      if (diffMs <= 0) return "Expirado";
      return `${Math.ceil(diffMs / 60000)} min`;
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
      return { upcomingReservations: upcoming, pastReservations: past };
  }, [history, now]);

  const displayedReservations = activeTab === 'UPCOMING' ? upcomingReservations : pastReservations;

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-neon-blue" size={48}/></div>;
  if (!client) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 pb-20 font-sans">
        <header className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-20 shadow-md">
            <div className="max-w-md mx-auto flex justify-between items-center">
                <h1 className="text-xl font-bold text-white tracking-tight">Minha Conta</h1>
                <button onClick={handleLogout} className="text-slate-400 hover:text-white p-2 transition-colors"><LogOut size={20}/></button>
            </div>
        </header>

        <main className="max-w-md mx-auto p-4 space-y-6">
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
                {!isEditing ? (
                    <div className="flex items-center gap-4 animate-fade-in">
                        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center border-2 border-slate-700 text-neon-blue overflow-hidden shadow-inner">
                            {client.photoUrl ? <img src={client.photoUrl} className="w-full h-full object-cover" /> : <User size={32}/>}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h2 className="text-lg font-bold text-white truncate tracking-tight">{client.name}</h2>
                            <p className="text-sm text-slate-500 font-medium truncate">{client.email || client.phone}</p>
                        </div>
                        <button onClick={() => setIsEditing(true)} className="p-2.5 bg-slate-800 rounded-xl text-slate-400 hover:text-neon-blue border border-slate-700 transition-all"><Edit size={18}/></button>
                    </div>
                ) : (
                    <div className="space-y-4 animate-scale-in">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-white uppercase text-xs tracking-widest text-slate-400">Editar Perfil</h3>
                            <button onClick={() => setIsEditing(false)} className="text-slate-500 hover:text-white"><X size={20}/></button>
                        </div>
                        <div className="flex justify-center py-2">
                            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center border-2 border-slate-700 overflow-hidden shadow-inner">
                                    {editForm.photoUrl ? <img src={editForm.photoUrl} className="w-full h-full object-cover" /> : <User size={32} className="text-slate-600"/>}
                                </div>
                                <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Camera size={20} className="text-white"/></div>
                                <input type="file" ref={fileInputRef} onChange={(e) => { const f = e.target.files?.[0]; if(f){ const r = new FileReader(); r.onloadend = () => setEditForm(p=>({...p, photoUrl: r.result as string})); r.readAsDataURL(f); } }} className="hidden" accept="image/*"/>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <div><label className="text-[10px] text-slate-500 font-bold uppercase mb-1 block">Nome Completo</label><input className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white text-sm focus:border-neon-blue outline-none transition-all font-medium" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} /></div>
                            <div><label className="text-[10px] text-slate-500 font-bold uppercase mb-1 block">E-mail</label><input className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white text-sm focus:border-neon-blue outline-none transition-all font-medium" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} /></div>
                        </div>
                        <button onClick={handleSaveProfile} disabled={isSaving} className="w-full bg-neon-blue hover:bg-blue-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all">{isSaving ? <Loader2 className="animate-spin" size={18}/> : <><Save size={18}/> Salvar Cadastro</>}</button>
                    </div>
                )}
            </div>

            <div className="bg-slate-900 p-6 rounded-2xl border border-neon-orange/20 shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-neon-orange/5 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-neon-orange/10 transition-colors"></div>
                <div className="relative z-10 flex justify-between items-center">
                    <div>
                        <span className="text-[10px] font-bold text-neon-orange uppercase tracking-[0.2em] mb-1 block">Saldo Fidelidade</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-5xl font-extrabold text-white tracking-tighter">{client.loyaltyBalance || 0}</span>
                            <span className="text-sm text-slate-500 font-bold uppercase">pts</span>
                        </div>
                    </div>
                    <div className="w-14 h-14 bg-neon-orange/10 rounded-2xl flex items-center justify-center text-neon-orange border border-neon-orange/20 shadow-inner group-hover:scale-110 transition-transform"><Gift size={32}/></div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <button onClick={() => navigate('/agendamento')} className="bg-neon-blue hover:bg-blue-600 text-white p-5 rounded-2xl shadow-xl flex flex-col items-center justify-center gap-2 transition-all transform active:scale-95 group"><Calendar size={24} className="group-hover:scale-110 transition-transform"/><span className="font-bold text-xs uppercase tracking-wider">Novo Agendamento</span></button>
                <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col items-center justify-center gap-2 opacity-50 grayscale"><Coins size={24} className="text-slate-500"/><span className="font-bold text-xs uppercase tracking-wider">Resgatar Pontos</span></div>
            </div>

            <div className="space-y-4">
                <div className="flex p-1 bg-slate-900 border border-slate-800 rounded-xl">
                    <button onClick={() => setActiveTab('UPCOMING')} className={`flex-1 py-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'UPCOMING' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}><Calendar size={14}/> Próximos</button>
                    <button onClick={() => setActiveTab('HISTORY')} className={`flex-1 py-3 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'HISTORY' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:text-slate-300'}`}><History size={14}/> Histórico</button>
                </div>
                
                {displayedReservations.length === 0 ? (
                    <div className="text-center p-12 bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-800 text-slate-600 flex flex-col items-center gap-3 animate-fade-in"><Calendar size={40} className="opacity-10"/><p className="text-sm font-medium uppercase tracking-widest">{activeTab === 'UPCOMING' ? 'Sem reservas ativas' : 'Histórico vazio'}</p></div>
                ) : (
                    <div className="space-y-4 animate-fade-in">{displayedReservations.map(res => {
                        const expiresIn = getExpiresIn(res);
                        let statusStyle = 'bg-slate-800 text-slate-500 border-slate-700';
                        if (res.status === ReservationStatus.CONFIRMADA) statusStyle = 'bg-green-500/10 text-green-500 border-green-500/20';
                        else if (res.status === ReservationStatus.PENDENTE) statusStyle = res.payOnSite ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
                        else if (res.status === ReservationStatus.CANCELADA) statusStyle = 'bg-red-500/10 text-red-500 border-red-500/20';

                        return (
                            <div key={res.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden group">
                                <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-3">
                                    <div className="flex items-center gap-2 text-white font-bold"><Calendar size={16} className="text-slate-500"/> {res.date.split('-').reverse().join('/')} <span className="text-slate-700 mx-1">|</span> <Clock size={16} className="text-slate-500"/> {res.time}</div>
                                    <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusStyle}`}>{res.status}</div>
                                </div>
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800"><span className="text-[9px] text-slate-500 font-bold uppercase block mb-1">Configuração</span><span className="text-xs font-bold text-white flex items-center gap-2"><LayoutGrid size={14} className="text-neon-blue"/> {res.laneCount} Pista(s) • {res.peopleCount} Pessoas</span></div>
                                    <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800"><span className="text-[9px] text-slate-500 font-bold uppercase block mb-1">Valor Total</span><span className="text-xs font-bold text-green-400 flex items-center gap-2"><DollarSign size={14}/> {res.totalValue.toLocaleString('pt-BR', {style:'currency', currency: 'BRL'})}</span></div>
                                </div>
                                {expiresIn && activeTab === 'UPCOMING' && <div className="mb-4 bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-xl text-yellow-500 text-xs flex items-center justify-between font-bold animate-pulse"><span>Pague para confirmar vaga</span><span>Expira em: {expiresIn}</span></div>}
                                {activeTab === 'UPCOMING' && res.status === ReservationStatus.PENDENTE && !res.payOnSite && <button onClick={() => handlePayNow(res)} className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-95 uppercase text-xs tracking-widest"><CreditCard size={18}/> Concluir Pagamento Agora</button>}
                            </div>
                        );
                    })}</div>
                )}
            </div>
        </main>

        {settings && (
            <a href={settings.whatsappLink} target="_blank" className="fixed bottom-6 right-6 z-50 bg-[#25D366] text-white p-4 rounded-full shadow-2xl transition-all transform hover:scale-110 border-2 border-white/10 active:scale-90"><MessageCircle size={28}/></a>
        )}
    </div>
  );
};

export default ClientDashboard;
