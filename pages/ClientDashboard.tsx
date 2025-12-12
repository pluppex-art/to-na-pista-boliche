
import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Client, Reservation, LoyaltyTransaction, ReservationStatus, PaymentStatus } from '../types';
import { db } from '../services/mockBackend';
import { useApp } from '../contexts/AppContext';
import { LogOut, User, Gift, Clock, Calendar, Coins, Loader2, MessageCircle, Edit, Save, X, Camera, CreditCard, Trash2, CheckCircle2, DollarSign, Utensils, Hash, LayoutGrid, AlertCircle, FileText } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

const ClientDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { settings, refreshUser } = useApp();
  const [client, setClient] = useState<Client | null>(null);
  const [history, setHistory] = useState<Reservation[]>([]);
  const [loyalty, setLoyalty] = useState<LoyaltyTransaction[]>([]);
  const [loading, setLoading] = useState(true);

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

          // Load History
          const allRes = await db.reservations.getAll();
          // Ordena pela DATA DE CRIAÇÃO (createdAt) decrescente - Último agendamento realizado aparece primeiro
          const myRes = allRes
              .filter(r => r.clientId === activeClient.id)
              .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
              
          setHistory(myRes);

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas' }, () => {
          loadData(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, (payload) => {
          // Check if update is for this client
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
          
          // Update Local Storage and State
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
              reservationIds: [res.id] // Pass ID to update instead of create
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

  // Helper: Check if reservation is more than 2 hours away
  const canCancel = (res: Reservation) => {
      if (res.status === ReservationStatus.CANCELADA) return false;
      const gameDate = new Date(`${res.date}T${res.time}`);
      const diffMs = gameDate.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      return diffHours >= 2;
  };

  // Helper: Get remaining time for pending reservations
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

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-neon-blue" size={48}/></div>;
  if (!client) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
        {/* Header Mobile-First */}
        <header className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-20">
            <div className="max-w-md mx-auto flex justify-between items-center">
                <h1 className="text-xl font-bold text-white">Minha Conta</h1>
                <button onClick={handleLogout} className="text-slate-400 hover:text-white"><LogOut size={20}/></button>
            </div>
        </header>

        <main className="max-w-md mx-auto p-4 space-y-6">
            
            {/* User Profile Section */}
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

            {/* Loyalty Card */}
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

            {/* Actions */}
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

            {/* History Tabs (Recent vs Loyalty) */}
            <div>
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Clock size={18} className="text-slate-400"/> Meus Agendamentos</h3>
                
                {history.length === 0 ? (
                    <div className="text-center p-8 bg-slate-900 rounded-xl border border-slate-800 border-dashed text-slate-500">
                        Nenhum agendamento ainda.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {history.map(res => {
                            const expiresIn = getExpiresIn(res);
                            const allowCancel = canCancel(res);
                            
                            // Visual State Logic
                            const isConfirmed = res.status === ReservationStatus.CONFIRMADA;
                            const isPayOnSite = res.payOnSite;
                            const isPending = res.status === ReservationStatus.PENDENTE;
                            const isPaid = res.paymentStatus === PaymentStatus.PAGO;
                            const uniqueCheckedInId = res.checkedInIds && res.checkedInIds.length > 0;
                            
                            // Determine Status Badge & Color
                            let statusText = res.status;
                            let statusClass = 'bg-slate-800 text-slate-400';
                            
                            if (uniqueCheckedInId) {
                                statusText = 'Check-in';
                                statusClass = 'bg-green-500/20 text-green-400 border border-green-500/30';
                            } else if (isConfirmed) {
                                statusText = 'Reserva Confirmada';
                                statusClass = 'bg-neon-green/20 text-neon-green border border-neon-green/30 shadow-[0_0_10px_rgba(34,197,94,0.1)]';
                            } else if (isPending && isPayOnSite) {
                                statusText = 'Confirmado (Local)';
                                statusClass = 'bg-blue-900/30 text-blue-400 border border-blue-500/20';
                            } else if (isPending) {
                                statusText = 'Pendente';
                                statusClass = 'bg-yellow-900/30 text-yellow-500';
                            }

                            return (
                                <div key={res.id} className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
                                    {/* Header Date/Status */}
                                    <div className="p-4 border-b border-slate-800 flex justify-between items-start bg-slate-900/50">
                                        <div>
                                            <p className="text-white font-bold text-lg">{new Date(res.date).toLocaleDateString('pt-BR')}</p>
                                            <p className="text-sm text-slate-400 flex items-center gap-1"><Clock size={14}/> {res.time} ({res.duration}h)</p>
                                        </div>
                                        <div className={`text-[10px] font-bold px-2 py-1 rounded uppercase flex items-center gap-1 ${statusClass}`}>
                                            {uniqueCheckedInId ? <CheckCircle2 size={12}/> : null}
                                            {statusText}
                                        </div>
                                    </div>
                                    
                                    {/* Detailed Body Grid */}
                                    <div className="p-4 grid grid-cols-2 gap-4">
                                        {/* Operational Details */}
                                        <div className="col-span-2 sm:col-span-1 space-y-3">
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase font-bold mb-1">Pistas & Jogo</p>
                                                <div className="flex items-center gap-2">
                                                    <div className="bg-slate-800 p-2 rounded text-slate-300"><LayoutGrid size={16}/></div>
                                                    <div>
                                                        <p className="text-sm text-white font-bold">
                                                            {res.lanesAssigned && res.lanesAssigned.length > 0 
                                                                ? `Pista(s): ${res.lanesAssigned.join(', ')}`
                                                                : `${res.laneCount} Pista(s)`}
                                                        </p>
                                                        <p className="text-xs text-slate-500">{res.peopleCount} Pessoas</p>
                                                    </div>
                                                </div>
                                            </div>

                                            {res.hasTableReservation && (
                                                <div>
                                                    <p className="text-xs text-slate-500 uppercase font-bold mb-1">Reserva de Mesa</p>
                                                    <div className="flex items-center gap-2">
                                                        <div className="bg-slate-800 p-2 rounded text-neon-orange"><Utensils size={16}/></div>
                                                        <div>
                                                            <p className="text-sm text-white font-bold">{res.tableSeatCount} Lugares</p>
                                                            {res.birthdayName && <p className="text-xs text-slate-500 truncate max-w-[120px]">Aniv: {res.birthdayName}</p>}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Financial Details */}
                                        <div className="col-span-2 sm:col-span-1 space-y-3">
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase font-bold mb-1">Financeiro</p>
                                                <div className="flex items-center gap-2">
                                                    <div className="bg-slate-800 p-2 rounded text-green-400"><DollarSign size={16}/></div>
                                                    <div>
                                                        <p className="text-sm text-white font-bold">{res.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                                        <p className={`text-xs font-bold ${isPaid ? 'text-green-500' : 'text-yellow-500'}`}>
                                                            {isPaid ? 'Pago' : 'Pendente / Local'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            {/* Observations (Filtered) */}
                                            {res.observations && res.observations.length > 5 && !res.observations.includes("confirmado via MP") && (
                                                <div>
                                                    <p className="text-xs text-slate-500 uppercase font-bold mb-1">Obs</p>
                                                    <div className="flex items-start gap-2 bg-slate-800/50 p-2 rounded border border-slate-800">
                                                        <FileText size={12} className="text-slate-400 mt-0.5 flex-shrink-0"/>
                                                        <p className="text-xs text-slate-400 italic line-clamp-2">{res.observations}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Warnings & Alerts */}
                                    <div className="px-4 pb-2">
                                        {isPending && !isPaid && !isPayOnSite && expiresIn && (
                                            <div className="bg-yellow-900/20 text-yellow-500 text-xs p-2 rounded border border-yellow-500/20 flex items-center gap-2 animate-pulse mb-2">
                                                <Clock size={14}/> 
                                                <span className="font-bold">Atenção:</span> Sua pré-reserva expira em {expiresIn}.
                                            </div>
                                        )}
                                        {isPending && isPayOnSite && (
                                            <div className="bg-blue-900/20 text-blue-400 text-xs p-2 rounded border border-blue-500/20 flex items-center gap-2 mb-2">
                                                <CheckCircle2 size={14}/> 
                                                <span className="font-bold">Confirmado:</span> Pagamento agendado para o local.
                                            </div>
                                        )}
                                    </div>

                                    {/* Footer Actions - DISCREET BUTTONS */}
                                    {res.status !== ReservationStatus.CANCELADA && (
                                        <div className="bg-slate-800/50 px-4 py-3 border-t border-slate-800 flex items-center justify-between">
                                            {/* Left side: Discreet actions */}
                                            <div className="flex gap-4">
                                                <button onClick={() => handleEditRequest(res)} className="text-xs text-slate-500 hover:text-white transition flex items-center gap-1">
                                                    <Edit size={12}/> Alterar
                                                </button>
                                                {allowCancel && (
                                                    <button onClick={() => handleCancelRedirect(res)} className="text-xs text-red-900 hover:text-red-500 transition flex items-center gap-1">
                                                        <Trash2 size={12}/> Cancelar
                                                    </button>
                                                )}
                                            </div>

                                            {/* Right side: Prominent Actions */}
                                            <div>
                                                {isPending && !isPaid && !isPayOnSite && (
                                                    <button 
                                                        onClick={() => handlePayNow(res)}
                                                        className="bg-green-600 hover:bg-green-500 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center justify-center gap-2 shadow-lg transition"
                                                    >
                                                        <CreditCard size={14}/> Pagar Agora
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    
                                    {!allowCancel && res.status !== ReservationStatus.CANCELADA && (
                                         <div className="bg-slate-900 p-2 text-center text-[10px] text-slate-600 italic">
                                             Alterações não permitidas menos de 2h antes.
                                         </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

        </main>

        {/* Floating WhatsApp Button */}
        {settings && (
            <a
                href={settings.whatsappLink || `https://wa.me/55${settings.phone?.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="fixed bottom-6 right-6 z-50 bg-[#25D366] hover:bg-[#128c7e] text-white p-3 md:p-4 rounded-full shadow-[0_4px_20px_rgba(37,211,102,0.4)] transition-all transform hover:scale-110 flex items-center justify-center border-2 border-white/10"
                aria-label="Fale conosco no WhatsApp"
            >
                <MessageCircle size={28} className="md:w-8 md:h-8" />
            </a>
        )}
    </div>
  );
};

export default ClientDashboard;
