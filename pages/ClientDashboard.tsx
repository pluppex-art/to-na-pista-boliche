
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

  // Tab State: 'UPCOMING' (Ativos) vs 'HISTORY' (Finalizados/Cancelados)
  const [activeTab, setActiveTab] = useState<'UPCOMING' | 'HISTORY'>('UPCOMING');

  // Edit Profile State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '', photoUrl: '' });
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clock for countdowns
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    // Update "now" every minute for countdowns
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async (isBackground = false) => {
      const stored = localStorage.getItem('tonapista_client_auth');
      if (!stored) {
        navigate('/login');
        return;
      }
      const clientData = JSON.parse(stored);

      if (!isBackground) setLoading(true);
      try {
          // Refresh client data
          const freshClient = await db.clients.getById(clientData.id);
          const activeClient = freshClient || clientData;
          
          setClient(activeClient);
          setEditForm({
              name: activeClient.name,
              email: activeClient.email || '',
              phone: activeClient.phone,
              photoUrl: activeClient.photoUrl || ''
          });

          // Load History (OTIMIZADO)
          // Em vez de baixar tudo, baixa só o deste cliente
          const myRes = await db.reservations.getByClientId(activeClient.id);
          const sorted = myRes.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
              
          setHistory(sorted);

          // Load Loyalty
          const pts = await db.loyalty.getHistory(activeClient.id);
          setLoyalty(pts);
      } finally {
          if (!isBackground) setLoading(false);
      }
  };

  useEffect(() => {
    loadData();

    // Subscribe to updates relevant to this client
    const channel = supabase
      .channel('client-dashboard-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas' }, (payload) => {
          if (client && payload.new && (payload.new as any).client_id === client.id) {
              loadData(true);
          }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, (payload) => {
          if (client && payload.new && (payload.new as any).client_id === client.id) {
              loadData(true);
          }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [navigate]); 

  const handleLogout = () => {
      localStorage.removeItem('tonapista_client_auth');
      navigate('/login');
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024 * 2) {
          alert("Imagem muito grande. Máximo 2MB.");
          return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditForm(prev => ({ ...prev, photoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProfile = async () => {
      if (!client) return;
      setIsSaving(true);
      try {
          const updatedClient = {
              ...client,
              name: editForm.name,
              email: editForm.email,
              phone: editForm.phone,
              photoUrl: editForm.photoUrl
          };
          
          await db.clients.update(updatedClient);
          
          localStorage.setItem('tonapista_client_auth', JSON.stringify(updatedClient));
          setClient(updatedClient);
          setIsEditing(false);
          alert("Perfil atualizado com sucesso!");
      } catch (e) {
          console.error(e);
          alert("Erro ao atualizar perfil.");
      } finally {
          setIsSaving(false);
      }
  };

  const handlePayNow = (res: Reservation) => {
      navigate('/checkout', { 
          state: {
              name: client?.name,
              whatsapp: client?.phone,
              email: client?.email,
              date: res.date,
              time: res.time,
              people: res.peopleCount,
              lanes: res.laneCount,
              duration: res.duration,
              type: res.eventType,
              totalValue: res.totalValue,
              obs: res.observations,
              reservationIds: [res.id]
          } 
      });
  };

  const handleEditRequest = (res: Reservation) => {
      const message = `Olá, gostaria de alterar minha reserva (ID: ${res.id.slice(0,5)}) para o dia ${new Date(res.date).toLocaleDateString('pt-BR')}.`;
      const whatsappUrl = `https://wa.me/55${settings.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
  };

  const handleCancelRedirect = (res: Reservation) => {
      const message = `Olá, gostaria de cancelar minha reserva (ID: ${res.id.slice(0,5)}) do dia ${new Date(res.date).toLocaleDateString('pt-BR')} às ${res.time}.`;
      const whatsappUrl = `https://wa.me/55${settings.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
  };

  const canCancel = (res: Reservation) => {
      if (res.status === ReservationStatus.CANCELADA) return false;
      const gameDate = new Date(`${res.date}T${res.time}`);
      const diffMs = gameDate.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      return diffHours >= 2;
  };

  const getExpiresIn = (res: Reservation) => {
      if (res.status !== ReservationStatus.PENDENTE) return null;
      if (!res.createdAt) return null;
      
      const created = new Date(res.createdAt);
      const expiresAt = new Date(created.getTime() + 30 * 60000); // 30 mins later
      const diffMs = expiresAt.getTime() - now.getTime();
      
      if (diffMs <= 0) return "Expirado";
      
      const mins = Math.ceil(diffMs / 60000);
      return `${mins} min`;
  };

  const getCleanCancellationReason = (obs: string | undefined) => {
      if (!obs) return 'Cancelado pelo estabelecimento.';
      
      if (obs.includes('Tempo de confirmação excedido')) return 'Tempo limite de pagamento excedido (30 min).';
      
      if (obs.includes('Motivo:')) {
          const parts = obs.split('Motivo:');
          if (parts.length > 1 && parts[1].trim()) return parts[1].trim();
      }

      if (obs.includes('Pagamento PIX') || obs.includes('confirmado via MP')) {
          return 'Cancelado pela equipe.';
      }

      return obs.length < 50 ? obs : 'Cancelamento administrativo.';
  };

  // --- FILTRAGEM DE RESERVAS ---
  const { upcomingReservations, pastReservations } = React.useMemo(() => {
      const upcoming: Reservation[] = [];
      const past: Reservation[] = [];

      history.forEach(res => {
          // Status finalizados vão direto para histórico
          const isFinishedStatus = [ReservationStatus.CANCELADA, ReservationStatus.NO_SHOW, ReservationStatus.CHECK_IN].includes(res.status);
          
          if (isFinishedStatus) {
              past.push(res);
              return;
          }

          // Para Pendentes e Confirmadas, verifica se a data já passou
          const endDateTime = new Date(`${res.date}T${res.time}`);
          endDateTime.setHours(endDateTime.getHours() + res.duration);
          
          if (endDateTime < now) {
              // Se já passou do horário de término, considera histórico (mesmo se esqueceram de dar check-in)
              past.push(res);
          } else {
              upcoming.push(res);
          }
      });

      return { upcomingReservations: upcoming, pastReservations: past };
  }, [history, now]);

  const displayedReservations = activeTab === 'UPCOMING' ? upcomingReservations : pastReservations;

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-neon-blue" size={48}/></div>;
  if (!client) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 pb-20">
        <header className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-20">
            <div className="max-w-md mx-auto flex justify-between items-center">
                <h1 className="text-xl font-bold text-white">Minha Conta</h1>
                <button onClick={handleLogout} className="text-slate-400 hover:text-white"><LogOut size={20}/></button>
            </div>
        </header>

        <main className="max-w-md mx-auto p-4 space-y-6">
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 relative">
                {!isEditing ? (
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center border-2 border-slate-700 text-neon-blue overflow-hidden relative">
                            {client.photoUrl ? (
                                <img src={client.photoUrl} alt="Perfil" className="w-full h-full object-cover" />
                            ) : (
                                <User size={32}/>
                            )}
                        </div>
                        <div className="flex-1">
                            <h2 className="text-lg font-bold text-white">{client.name}</h2>
                            <p className="text-sm text-slate-400">{client.email || client.phone}</p>
                        </div>
                        <button onClick={() => setIsEditing(true)} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white border border-slate-700">
                            <Edit size={18}/>
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4 animate-fade-in">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-bold text-white">Editar Perfil</h3>
                            <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-white"><X size={20}/></button>
                        </div>
                        
                        <div className="flex justify-center mb-4">
                            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center border-2 border-slate-600 overflow-hidden">
                                    {editForm.photoUrl ? (
                                        <img src={editForm.photoUrl} className="w-full h-full object-cover" />
                                    ) : (
                                        <User size={32} className="text-slate-500"/>
                                    )}
                                </div>
                                <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                                    <Camera size={20} className="text-white"/>
                                </div>
                                <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} className="hidden" accept="image/*"/>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs text-slate-500 block mb-1">Nome Completo</label>
                            <input className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white text-sm focus:border-neon-blue outline-none" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 block mb-1">E-mail</label>
                            <input className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white text-sm focus:border-neon-blue outline-none" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-xs text-slate-500 block mb-1">Telefone</label>
                            <input className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white text-sm focus:border-neon-blue outline-none" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
                        </div>

                        <button onClick={handleSaveProfile} disabled={isSaving} className="w-full bg-neon-blue hover:bg-blue-600 text-white font-bold py-2 rounded-lg flex items-center justify-center gap-2">
                            {isSaving ? <Loader2 className="animate-spin" size={18}/> : <><Save size={18}/> Salvar Alterações</>}
                        </button>
                    </div>
                )}
            </div>

            <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-2xl border border-neon-orange/30 shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-neon-orange/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-4">
                        <span className="text-xs font-bold text-neon-orange uppercase tracking-wider bg-orange-900/20 px-2 py-1 rounded">Fidelidade</span>
                        <Gift className="text-neon-orange" size={24}/>
                    </div>
                    <div className="mb-2">
                        <span className="text-4xl font-bold text-white">{client.loyaltyBalance || 0}</span>
                        <span className="text-sm text-slate-400 ml-1">pontos</span>
                    </div>
                    <p className="text-xs text-slate-500">Cada R$ 1,00 gasto vale 1 ponto.</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <button onClick={() => navigate('/agendamento')} className="bg-neon-blue hover:bg-blue-600 text-white p-4 rounded-xl shadow-lg flex flex-col items-center justify-center gap-2 transition">
                    <Calendar size={24}/>
                    <span className="font-bold text-sm">Novo Agendamento</span>
                </button>
                <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl flex flex-col items-center justify-center gap-2 opacity-75">
                    <Coins size={24} className="text-slate-500"/>
                    <span className="font-bold text-sm text-slate-400">Trocar Pontos</span>
                    <span className="text-[10px] text-slate-500">Em breve</span>
                </div>
            </div>

            <div>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Clock size={18} className="text-slate-400"/> Meus Agendamentos
                    </h3>
                </div>

                {/* TABS DE NAVEGAÇÃO */}
                <div className="flex p-1 bg-slate-900 border border-slate-800 rounded-lg mb-4">
                    <button 
                        onClick={() => setActiveTab('UPCOMING')}
                        className={`flex-1 py-2 text-sm font-bold rounded-md transition flex items-center justify-center gap-2 ${activeTab === 'UPCOMING' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <Calendar size={14}/> Próximos
                    </button>
                    <button 
                        onClick={() => setActiveTab('HISTORY')}
                        className={`flex-1 py-2 text-sm font-bold rounded-md transition flex items-center justify-center gap-2 ${activeTab === 'HISTORY' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <History size={14}/> Histórico
                    </button>
                </div>
                
                {displayedReservations.length === 0 ? (
                    <div className="text-center p-8 bg-slate-900 rounded-xl border border-slate-800 border-dashed text-slate-500 flex flex-col items-center gap-2 animate-fade-in">
                        {activeTab === 'UPCOMING' ? (
                            <>
                                <Calendar size={32} className="opacity-20"/>
                                <p>Nenhum agendamento ativo.</p>
                                <button onClick={() => navigate('/agendamento')} className="text-neon-blue text-sm font-bold hover:underline mt-1">Fazer uma reserva</button>
                            </>
                        ) : (
                            <>
                                <Archive size={32} className="opacity-20"/>
                                <p>Nenhum histórico encontrado.</p>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4 animate-fade-in">
                        {displayedReservations.map(res => {
                            const expiresIn = getExpiresIn(res);
                            const allowCancel = canCancel(res);
                            
                            let statusColor = 'bg-slate-800 text-slate-400 border-slate-700';
                            let statusLabel: string = res.status;

                            if (res.status === ReservationStatus.CONFIRMADA) {
                                statusColor = 'bg-green-500/20 text-green-400 border-green-500/30';
                                statusLabel = 'CONFIRMADA';
                            } else if (res.status === ReservationStatus.PENDENTE) {
                                if (res.payOnSite) {
                                    statusColor = 'bg-blue-500/20 text-blue-400 border-blue-500/30';
                                    statusLabel = 'PENDENTE';
                                } else {
                                    statusColor = 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
                                    statusLabel = 'PENDENTE';
                                }
                            } else if (res.status === ReservationStatus.CANCELADA) {
                                statusColor = 'bg-red-500/20 text-red-400 border-red-500/30';
                                statusLabel = 'CANCELADA';
                            } else if (res.status === ReservationStatus.CHECK_IN) {
                                statusColor = 'bg-purple-500/20 text-purple-400 border-purple-500/30';
                                statusLabel = 'FINALIZADA';
                            } else if (res.status === ReservationStatus.NO_SHOW) {
                                statusColor = 'bg-red-900/20 text-red-500 border-red-500/30';
                                statusLabel = 'FALTA';
                            }

                            const cancellationReason = res.status === ReservationStatus.CANCELADA 
                                ? getCleanCancellationReason(res.observations) 
                                : null;

                            return (
                                <div key={res.id} className={`relative p-4 rounded-xl border mb-4 shadow-sm ${statusColor.replace('bg-', 'bg-opacity-10 ')} border-opacity-50`}>
                                    <div className="flex justify-between items-start mb-3 border-b border-white/5 pb-2">
                                        <div className="text-lg font-bold text-white flex items-center gap-2">
                                            <Calendar size={18} className="text-slate-400"/>
                                            {new Date(res.date).toLocaleDateString('pt-BR')}
                                            <span className="text-slate-600">|</span>
                                            <Clock size={18} className="text-slate-400"/>
                                            {res.time} <span className="text-xs text-slate-500">({res.duration}h)</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 text-sm text-slate-300 mb-4 bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                                        <div className="col-span-2 sm:col-span-1">
                                            <span className="block text-xs text-slate-500 font-bold uppercase">Tipo</span>
                                            <span className="font-bold text-white flex items-center gap-2">
                                                <Tag size={14} className="text-neon-orange"/>
                                                {res.eventType}
                                            </span>
                                        </div>

                                        <div>
                                            <span className="block text-xs text-slate-500 font-bold uppercase">Pistas</span>
                                            <span className="font-bold text-white flex items-center gap-2">
                                                <LayoutGrid size={14} className="text-neon-blue"/>
                                                {res.lanesAssigned && res.lanesAssigned.length > 0 
                                                    ? res.lanesAssigned.join(', ')
                                                    : "A definir"
                                                }
                                            </span>
                                        </div>
                                        <div>
                                            <span className="block text-xs text-slate-500 font-bold uppercase">Pessoas</span>
                                            <span className="font-bold text-white flex items-center gap-2">
                                                <Users size={14} className="text-neon-blue"/>
                                                {res.peopleCount}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="block text-xs text-slate-500 font-bold uppercase">Valor</span>
                                            <span className="font-bold text-white flex items-center gap-2">
                                                <DollarSign size={14} className="text-green-400"/>
                                                {res.totalValue.toLocaleString('pt-BR', {style:'currency', currency: 'BRL'})}
                                            </span>
                                        </div>
                                        {res.hasTableReservation && (
                                            <div>
                                                <span className="block text-xs text-slate-500 font-bold uppercase">Mesa</span>
                                                <span className="font-bold text-white flex items-center gap-2">
                                                    <Utensils size={14} className="text-neon-orange"/>
                                                    {res.tableSeatCount} lug.
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* ALERTS FOR PENDING */}
                                    {activeTab === 'UPCOMING' && res.status === ReservationStatus.PENDENTE && !res.payOnSite && expiresIn && (
                                        <div className="mb-4 bg-yellow-900/20 border border-yellow-500/30 p-2 rounded text-yellow-500 text-xs flex items-center gap-2 animate-pulse">
                                            <Clock size={14} />
                                            <span className="font-bold">Expira em: {expiresIn}</span>
                                            <span className="ml-auto text-[10px] opacity-75">Pague para confirmar</span>
                                        </div>
                                    )}

                                    {activeTab === 'UPCOMING' && res.status === ReservationStatus.PENDENTE && res.payOnSite && (
                                        <div className="mb-4 bg-blue-900/20 border border-blue-500/30 p-2 rounded text-blue-400 text-xs flex items-center gap-2">
                                            <Store size={14} />
                                            <span className="font-bold">Pagamento no Local</span>
                                            <span className="ml-auto text-[10px] opacity-75">Reserva Garantida</span>
                                        </div>
                                    )}

                                    {/* CANCELLATION REASON */}
                                    {res.status === ReservationStatus.CANCELADA && (
                                        <div className="mb-4 bg-red-900/20 border border-red-500/30 p-3 rounded text-red-400 text-xs">
                                            <div className="font-bold flex items-center gap-2 mb-1"><AlertCircle size={14}/> Motivo do Cancelamento:</div>
                                            <div className="opacity-90 italic">
                                                {cancellationReason}
                                            </div>
                                        </div>
                                    )}

                                    <div className={`mb-3 py-2 px-3 rounded text-center text-xs font-bold uppercase border tracking-wider ${statusColor}`}>
                                        {statusLabel}
                                    </div>

                                    {/* ACTIONS - Only for Active/Upcoming Reservations */}
                                    {activeTab === 'UPCOMING' && res.status !== ReservationStatus.CANCELADA && (
                                        <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-800">
                                            <div className="flex gap-4">
                                                <button onClick={() => handleEditRequest(res)} className="text-xs text-slate-500 hover:text-white transition flex items-center gap-1">
                                                    <Edit size={12}/> Alterar
                                                </button>
                                                {allowCancel && (
                                                    <button onClick={() => handleCancelRedirect(res)} className="text-xs text-slate-500 hover:text-red-400 transition flex items-center gap-1">
                                                        <Trash2 size={12}/> Cancelar
                                                    </button>
                                                )}
                                            </div>

                                            {res.status === ReservationStatus.PENDENTE && !res.payOnSite && res.paymentStatus !== PaymentStatus.PAGO && (
                                                <button 
                                                    onClick={() => handlePayNow(res)}
                                                    className="bg-green-600 hover:bg-green-500 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 transition transform hover:scale-105"
                                                >
                                                    <CreditCard size={14}/> Pagar Agora
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </main>

        {settings && (
            <a
                href={settings.whatsappLink || `https://wa.me/55${settings.phone?.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="fixed bottom-24 md:bottom-6 right-6 z-50 bg-[#25D366] hover:bg-[#128c7e] text-white p-3 md:p-4 rounded-full shadow-[0_4px_20px_rgba(37,211,102,0.4)] transition-all transform hover:scale-110 flex items-center justify-center border-2 border-white/10"
                aria-label="Fale conosco no WhatsApp"
            >
                <MessageCircle size={28} className="md:w-8 md:h-8" />
            </a>
        )}
    </div>
  );
};

export default ClientDashboard;
