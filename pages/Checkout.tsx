
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { db, cleanPhone } from '../services/mockBackend';
import { Integrations } from '../services/integrations';
import { Reservation, ReservationStatus, FunnelStage, User, PaymentStatus, EventType, PaymentDetail } from '../types';
import { CheckCircle, CreditCard, Loader2, ShieldCheck, Store, Lock, Hash, ArrowRight, User as UserIcon, Calendar, RefreshCw, ExternalLink, Shield, Plus, Trash2, AlertTriangle, CheckSquare } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../services/supabaseClient';

type PaymentMethodStaff = 'DINHEIRO' | 'PIX' | 'DEBITO' | 'CREDITO';

const METHODS: PaymentMethodStaff[] = ['DINHEIRO', 'PIX', 'DEBITO', 'CREDITO'];

const Checkout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const [staffMethod, setStaffMethod] = useState<PaymentMethodStaff>('DINHEIRO');
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [splitDetails, setSplitDetails] = useState<PaymentDetail[]>([{ method: 'DINHEIRO', amount: 0 }]);
  
  const [comandaInput, setComandaInput] = useState('');
  const [imgError, setImgError] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [trackedReservationIds, setTrackedReservationIds] = useState<string[]>([]);

  const reservationData = location.state as any;

  useEffect(() => {
    if (!reservationData) { 
        navigate('/agendamento'); 
        return; 
    }
    const storedUser = localStorage.getItem('tonapista_auth');
    if (storedUser) { 
        try { setCurrentUser(JSON.parse(storedUser)); } catch(e) { console.error("Erro user auth:", e); } 
    }
    
    db.settings.get().then(s => setSettings(s)).catch(err => console.warn("Erro ao buscar settings:", err));
    
    if (reservationData.reservationIds && reservationData.reservationIds.length > 0) {
        setTrackedReservationIds(reservationData.reservationIds);
    }

    if (reservationData.totalValue) {
        setSplitDetails([{ method: 'DINHEIRO', amount: reservationData.totalValue }]);
    }
  }, [reservationData, navigate]);

  const currentSplitTotal = splitDetails.reduce((acc, curr) => acc + curr.amount, 0);

  useEffect(() => {
    if (isSuccess && window.fbq && reservationData) {
      window.fbq('track', 'Purchase', {
        value: reservationData.totalValue || 0,
        currency: 'BRL',
        content_name: 'Reserva de Boliche',
        content_ids: trackedReservationIds,
        content_type: 'product'
      });
    }
  }, [isSuccess]);

  useEffect(() => {
      if (trackedReservationIds.length === 0) return;
      
      const channel = supabase.channel('checkout-monitor')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'reservas' }, (payload) => {
            if (trackedReservationIds.includes(payload.new.id) && payload.new.payment_status === 'Pago') {
                setIsSuccess(true);
            }
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
  }, [trackedReservationIds]);

  const addSplitRow = () => {
    setSplitDetails([...splitDetails, { method: 'PIX', amount: 0 }]);
  };

  const removeSplitRow = (index: number) => {
    setSplitDetails(splitDetails.filter((_, i) => i !== index));
  };

  const updateSplitRow = (index: number, field: keyof PaymentDetail, value: any) => {
    const newDetails = [...splitDetails];
    if (field === 'amount') {
        newDetails[index].amount = parseFloat(value) || 0;
    } else {
        newDetails[index].method = value;
    }
    setSplitDetails(newDetails);
  };

  const processPayment = async (mode: 'CLIENT_ONLINE' | 'STAFF_CONFIRM' | 'STAFF_LATER' | 'STAFF_COMANDA_PAID') => {
    if (isProcessing) return;

    if ((mode === 'STAFF_CONFIRM' || mode === 'STAFF_COMANDA_PAID') && isSplitPayment) {
        if (Math.abs(currentSplitTotal - reservationData.totalValue) > 0.01) {
            alert(`O total dos pagamentos (R$ ${currentSplitTotal.toFixed(2)}) deve ser igual ao total da reserva (R$ ${reservationData.totalValue.toFixed(2)})`);
            return;
        }
    }

    setIsProcessing(true);
    
    try {
        let client = null;
        const normalizedPhone = cleanPhone(reservationData.whatsapp);
        const emailClean = reservationData.email?.trim() || null;

        if (reservationData.clientId) {
            client = await db.clients.getById(reservationData.clientId).catch(() => null);
        }
        
        if (!client && normalizedPhone) {
            client = await db.clients.getByPhone(normalizedPhone).catch(() => null);
        }
        
        if (!client && (normalizedPhone || emailClean)) {
          try {
              client = await db.clients.create({
                  id: uuidv4(), 
                  name: reservationData.name || 'Cliente Avulso', 
                  phone: normalizedPhone, 
                  email: emailClean,
                  tags: ['Lead novo'], 
                  createdAt: new Date().toISOString(), 
                  lastContactAt: new Date().toISOString(), 
                  funnelStage: FunnelStage.NOVO
              }, currentUser?.id); 
          } catch (createErr) {
              console.warn("Não foi possível persistir cliente no CRM:", createErr);
          }
        }

        if (!currentUser && mode === 'CLIENT_ONLINE' && client) {
            localStorage.setItem('tonapista_client_auth', JSON.stringify(client));
        }

        let finalStatus = ReservationStatus.PENDENTE;
        let paymentStatus = PaymentStatus.PENDENTE;
        let finalMethod = 'PENDENTE';
        let isPayOnSite = false;
        let finalPaymentDetails: PaymentDetail[] = [];

        if (mode === 'STAFF_CONFIRM' || mode === 'STAFF_COMANDA_PAID') { 
            finalStatus = ReservationStatus.CONFIRMADA; 
            paymentStatus = PaymentStatus.PAGO;
            
            if (isSplitPayment) {
                finalMethod = 'MISTO';
                finalPaymentDetails = splitDetails;
            } else {
                finalMethod = mode === 'STAFF_COMANDA_PAID' ? 'COMANDA' : staffMethod;
                finalPaymentDetails = [{ method: finalMethod, amount: reservationData.totalValue }];
            }
        } else if (mode === 'STAFF_LATER') { 
            isPayOnSite = true;
            finalMethod = 'COMANDA';
            finalPaymentDetails = [];
        } else if (mode === 'CLIENT_ONLINE') {
            finalMethod = 'ONLINE';
        }

        const existingIds = reservationData.reservationIds || [];
        const currentTrackedIds: string[] = [];
        let firstReservationId = '';

        if (existingIds.length > 0) {
            const allRes = await db.reservations.getAll();
            for (const id of existingIds) {
                 const existingRes = allRes.find(r => r.id === id);
                 if (existingRes) {
                     await db.reservations.update({ 
                         ...existingRes, 
                         clientId: client?.id || null,
                         status: finalStatus, 
                         paymentStatus: paymentStatus, 
                         paymentMethod: finalMethod,
                         paymentDetails: finalPaymentDetails,
                         payOnSite: isPayOnSite, 
                         comandaId: comandaInput || existingRes.comandaId
                     }, currentUser?.id);
                     currentTrackedIds.push(id);
                     if (!firstReservationId) firstReservationId = id;
                 }
            }
        } else {
            const resId = uuidv4();
            const newRes: Reservation = {
                id: resId, 
                clientId: client?.id || '', 
                clientName: reservationData.name || 'Cliente Avulso', 
                date: reservationData.date, 
                time: reservationData.time,
                peopleCount: reservationData.people, 
                laneCount: reservationData.lanes, 
                duration: reservationData.duration,
                totalValue: reservationData.totalValue, 
                eventType: reservationData.type as EventType, 
                status: finalStatus,
                paymentStatus: paymentStatus,
                paymentMethod: finalMethod,
                paymentDetails: finalPaymentDetails,
                createdAt: new Date().toISOString(), 
                payOnSite: isPayOnSite, 
                comandaId: comandaInput
            };
            await db.reservations.create(newRes, currentUser?.id);
            currentTrackedIds.push(resId);
            firstReservationId = resId;
        }
        
        setTrackedReservationIds(currentTrackedIds);

        if (mode === 'CLIENT_ONLINE' && settings?.onlinePaymentEnabled) {
             const checkoutUrl = await Integrations.createMercadoPagoPreference({ id: firstReservationId }, settings);
             if (checkoutUrl) { 
                 window.location.href = checkoutUrl; 
                 return; 
             } else {
                 alert("Erro ao gerar pagamento online.");
             }
        } else {
             setIsSuccess(true); 
        }

    } catch (e: any) { 
        console.error("Erro no checkout:", e);
        const errorMsg = e.message?.includes('Failed to fetch') 
            ? "Falha de conexão: Verifique se as Edge Functions do Supabase foram publicadas ou se há internet."
            : `Erro ao processar: ${e.message || 'Erro desconhecido'}`;
        alert(errorMsg); 
    } finally { 
        setIsProcessing(false); 
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-center p-6">
        <div className="max-w-md w-full bg-slate-800 p-8 rounded-2xl border border-neon-green shadow-2xl animate-scale-in">
          <CheckCircle size={48} className="mx-auto text-neon-green mb-6" />
          <h2 className="text-3xl font-bold text-white mb-4">Sucesso!</h2>
          <p className="text-slate-300 mb-8 font-medium">A reserva foi atualizada com êxito.</p>
          <button 
            onClick={() => navigate(currentUser ? '/agenda' : '/minha-conta')} 
            className="w-full bg-neon-green hover:bg-green-500 text-black font-black py-4 rounded-xl shadow-lg transition-all active:scale-95"
          >
            VOLTAR AO PAINEL
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col">
       <header className="bg-slate-900 p-4 shadow-md border-b border-slate-800">
         <div className="max-w-6xl mx-auto flex justify-between items-center">
           {!imgError ? (
             <img src="/logo.png" className="h-10 md:h-14 object-contain" onError={() => setImgError(true)}/>
           ) : (
             <h1 className="text-2xl font-bold text-neon-orange uppercase">TÔ NA PISTA</h1>
           )}
           <div className="text-sm text-slate-400 flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700">
             <Lock size={14} className="text-neon-green" /> Checkout Seguro
           </div>
         </div>
       </header>
      <main className="flex-1 p-4 md:p-8">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 shadow-lg">
              <h3 className="text-lg font-bold text-white mb-4 border-b border-slate-700 pb-2">Resumo</h3>
              <div className="space-y-4 text-sm">
                <p className="text-white font-medium">{reservationData?.name}</p>
                <div className="flex justify-between">
                  <span>Data:</span> 
                  <span className="text-white">{reservationData?.date?.split('-').reverse().join('/')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Horário:</span> 
                  <span className="text-white">{reservationData?.time}</span>
                </div>
                <div className="border-t border-slate-700 pt-4 flex justify-between items-center">
                  <span className="font-bold text-lg">Total</span>
                  <span className="font-bold text-2xl text-neon-green">{reservationData?.totalValue?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            {currentUser ? (
                <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl shadow-lg space-y-8">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-white uppercase tracking-tighter">Painel Operacional</h2>
                        <div className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                            <UserIcon size={14} className="text-neon-blue"/>
                            <span className="text-[10px] font-bold uppercase text-slate-300">{currentUser.name}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* SEÇÃO RECEBER AGORA */}
                        <div className="bg-slate-800/50 p-5 rounded-2xl border border-slate-700 space-y-4 relative overflow-hidden">
                            <div className="flex justify-between items-center">
                                <h3 className="text-sm font-black text-neon-green uppercase tracking-widest">Receber Agora</h3>
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <span className="text-[10px] font-bold text-slate-400 group-hover:text-white transition">PAGAMENTO MISTO</span>
                                    <input type="checkbox" className="sr-only peer" checked={isSplitPayment} onChange={e => setIsSplitPayment(e.target.checked)} />
                                    <div className="w-8 h-4 bg-slate-700 rounded-full peer-checked:bg-neon-blue relative transition-all">
                                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${isSplitPayment ? 'left-4.5' : 'left-0.5'}`}></div>
                                    </div>
                                </label>
                            </div>

                            {!isSplitPayment ? (
                                <div className="grid grid-cols-2 gap-2">
                                    {METHODS.map(m => ( 
                                        <button 
                                            key={m} 
                                            onClick={() => setStaffMethod(m)} 
                                            className={`py-3 rounded-xl text-xs font-bold border transition-all ${staffMethod === m ? 'bg-neon-green text-black border-neon-green shadow-lg scale-[1.02]' : 'bg-slate-700 border-slate-600 text-slate-400 hover:border-slate-500'}`}
                                        >
                                            {m}
                                        </button> 
                                    )) }
                                </div>
                            ) : (
                                <div className="space-y-3 animate-fade-in">
                                    {splitDetails.map((detail, idx) => (
                                        <div key={idx} className="flex gap-2 items-center bg-slate-900/50 p-2 rounded-xl border border-slate-700">
                                            <select 
                                                className="bg-slate-800 border-none text-[10px] font-bold text-white rounded-lg focus:ring-0 w-24"
                                                value={detail.method}
                                                onChange={e => updateSplitRow(idx, 'method', e.target.value)}
                                            >
                                                {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                                            </select>
                                            <div className="relative flex-1">
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">R$</span>
                                                <input 
                                                    type="number"
                                                    className="w-full bg-slate-800 border-none text-xs font-bold text-white pl-7 rounded-lg focus:ring-1 focus:ring-neon-blue"
                                                    value={detail.amount || ''}
                                                    onChange={e => updateSplitRow(idx, 'amount', e.target.value)}
                                                    placeholder="0.00"
                                                />
                                            </div>
                                            {splitDetails.length > 1 && (
                                                <button onClick={() => removeSplitRow(idx)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition">
                                                    <Trash2 size={14}/>
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    <button onClick={addSplitRow} className="w-full py-2 border-2 border-dashed border-slate-700 rounded-xl text-[10px] font-bold text-slate-500 hover:border-neon-blue hover:text-neon-blue transition flex items-center justify-center gap-2">
                                        <Plus size={14}/> ADICIONAR FORMA
                                    </button>
                                    <div className={`p-3 rounded-xl border flex justify-between items-center ${Math.abs(currentSplitTotal - reservationData.totalValue) < 0.01 ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Total Lançado</span>
                                        <span className={`text-sm font-black ${Math.abs(currentSplitTotal - reservationData.totalValue) < 0.01 ? 'text-green-400' : 'text-red-400'}`}>R$ {currentSplitTotal.toFixed(2)}</span>
                                    </div>
                                </div>
                            )}

                            <button 
                                onClick={() => processPayment('STAFF_CONFIRM')} 
                                disabled={isProcessing} 
                                className="w-full bg-green-600 hover:bg-green-500 text-white font-black py-4 rounded-xl shadow-xl transition-all flex items-center justify-center gap-2 active:scale-95"
                            >
                                {isProcessing ? <Loader2 className="animate-spin" size={20}/> : <><CheckSquare size={18}/> CONFIRMAR RECEBIMENTO</>}
                            </button>
                        </div>

                        {/* SEÇÃO COMANDA / PAGAR NO LOCAL */}
                        <div className="bg-slate-800/50 p-5 rounded-2xl border border-slate-700 space-y-4">
                            <h3 className="text-sm font-black text-yellow-500 uppercase tracking-widest">Fluxo de Comanda</h3>
                            
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 tracking-widest">Nº COMANDA / MESA</label>
                                <div className="relative">
                                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={16}/>
                                    <input 
                                        type="text" 
                                        placeholder="Ex: 42" 
                                        className="w-full bg-slate-900 border border-slate-600 rounded-xl py-3 pl-10 text-white outline-none focus:border-neon-blue transition-all font-bold" 
                                        value={comandaInput} 
                                        onChange={e => setComandaInput(e.target.value)} 
                                    />
                                </div>
                            </div>

                            <div className="space-y-3 pt-2">
                                <button 
                                    onClick={() => processPayment('STAFF_LATER')} 
                                    disabled={isProcessing || !comandaInput} 
                                    className="w-full bg-slate-700 hover:bg-slate-600 text-white font-black py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Apenas vincula o débito à comanda, mantendo status como pendente."
                                >
                                    <Store size={18}/> LANÇAR NA COMANDA
                                </button>
                                
                                <div className="relative py-2 flex items-center">
                                    <div className="flex-grow border-t border-slate-700"></div>
                                    <span className="flex-shrink mx-3 text-[8px] font-bold text-slate-600 uppercase tracking-widest">Ou dar baixa agora</span>
                                    <div className="flex-grow border-t border-slate-700"></div>
                                </div>

                                <button 
                                    onClick={() => processPayment('STAFF_COMANDA_PAID')} 
                                    disabled={isProcessing || !comandaInput} 
                                    className="w-full border-2 border-yellow-500/50 text-yellow-500 hover:bg-yellow-500 hover:text-black font-black py-4 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                    title="Confirma que o cliente já pagou via sistema de comanda/PDV."
                                >
                                    <CheckCircle size={18}/> BAIXA DIRETA VIA COMANDA
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-slate-900 rounded-xl p-8 border border-slate-800 shadow-lg text-center">
                    <div className="flex flex-col items-center gap-6">
                        <ShieldCheck className="text-neon-blue w-12 h-12" />
                        <div>
                            <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-tighter">Finalizar Pagamento</h3>
                            <p className="text-slate-400 text-sm font-medium">Pague via PIX ou Cartão de forma segura.</p>
                        </div>
                        <button 
                            onClick={() => processPayment('CLIENT_ONLINE')} 
                            disabled={isProcessing} 
                            className="w-full max-w-sm bg-neon-blue hover:bg-blue-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-2xl transition-all active:scale-95 uppercase tracking-widest text-xs"
                        >
                            {isProcessing ? <Loader2 className="animate-spin"/> : <><ExternalLink size={20}/> Pagar com Mercado Pago</>}
                        </button>
                    </div>
                </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Checkout;
