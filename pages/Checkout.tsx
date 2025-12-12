
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { db } from '../services/mockBackend';
import { Integrations } from '../services/integrations';
import { Reservation, ReservationStatus, FunnelStage, User, PaymentStatus } from '../types';
import { CheckCircle, CreditCard, Smartphone, Loader2, ShieldCheck, Store, Lock, QrCode, Banknote, CalendarCheck, Wallet, Hash, ArrowRight, User as UserIcon, Calendar, RefreshCw, ExternalLink } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../services/supabaseClient';

type PaymentMethodClient = 'PIX' | 'DEBIT' | 'CREDIT';
type PaymentMethodStaff = 'DINHEIRO' | 'PIX' | 'DEBITO' | 'CREDITO';

const Checkout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  
  // State for UI selection
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodClient>('PIX');
  const [staffMethod, setStaffMethod] = useState<PaymentMethodStaff>('DINHEIRO');
  
  // Staff Comanda Input
  const [comandaInput, setComandaInput] = useState('');

  // Mock Card Inputs
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  const [imgError, setImgError] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<any>(null);
  
  // Armazena os IDs das reservas criadas para monitoramento
  const [trackedReservationIds, setTrackedReservationIds] = useState<string[]>([]);

  const reservationData = location.state as any;

  useEffect(() => {
    if (!reservationData) {
      navigate('/agendamento');
      return;
    }
    const storedUser = localStorage.getItem('tonapista_auth');
    if (storedUser) {
        try { setCurrentUser(JSON.parse(storedUser)); } catch(e) {}
    }
    
    db.settings.get().then(s => setSettings(s));
    
    // Se já vier com IDs (fluxo de pagamento posterior), monitora eles
    if (reservationData.reservationIds && reservationData.reservationIds.length > 0) {
        setTrackedReservationIds(reservationData.reservationIds);
    }
  }, [reservationData, navigate]);

  // --- MONITORAMENTO EM TEMPO REAL ---
  useEffect(() => {
      if (trackedReservationIds.length === 0) return;

      console.log("Monitorando pagamento para reservas:", trackedReservationIds);

      // Listener do Supabase para mudanças nas reservas
      const channel = supabase
        .channel('checkout-payment-monitor')
        .on(
            'postgres_changes',
            { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'reservas',
                filter: `id=in.(${trackedReservationIds.join(',')})`
            },
            (payload) => {
                const newStatus = payload.new.payment_status;
                if (newStatus === PaymentStatus.PAGO) {
                    setIsSuccess(true);
                }
            }
        )
        .subscribe();

      return () => { supabase.removeChannel(channel); };
  }, [trackedReservationIds]);

  const checkPaymentStatusManual = async () => {
      if (trackedReservationIds.length === 0) return;
      setIsCheckingPayment(true);
      try {
          // Busca status atualizado do banco
          const { data } = await supabase
            .from('reservas')
            .select('payment_status')
            .in('id', trackedReservationIds);
            
          const isPaid = data?.some(r => r.payment_status === PaymentStatus.PAGO);
          if (isPaid) {
              setIsSuccess(true);
          } else {
              alert("O sistema ainda não recebeu a confirmação do banco. Se você já pagou, aguarde cerca de 30 segundos e tente novamente.");
          }
      } catch (e) {
          console.error(e);
      } finally {
          setIsCheckingPayment(false);
      }
  };

  if (!reservationData) return null;

  // --- MASCARAS DE CARTÃO ---
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let val = e.target.value.replace(/\D/g, '');
      val = val.replace(/(\d{4})/g, '$1 ').trim();
      setCardNumber(val.slice(0, 19));
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let val = e.target.value.replace(/\D/g, '');
      if (val.length >= 2) val = val.slice(0, 2) + '/' + val.slice(2, 4);
      setCardExpiry(val.slice(0, 5));
  };

  // --- PROCESSAMENTO ---
  const processPayment = async (mode: 'CLIENT_ONLINE' | 'STAFF_CONFIRM' | 'STAFF_LATER') => {
    setIsProcessing(true);

    try {
        // 1. Get or Create Client
        let client = await db.clients.getByPhone(reservationData.whatsapp);
        if (!client) {
          client = await db.clients.create({
              id: uuidv4(),
              name: reservationData.name,
              phone: reservationData.whatsapp,
              email: reservationData.email,
              tags: ['Lead novo'],
              createdAt: new Date().toISOString(),
              lastContactAt: new Date().toISOString()
          }, currentUser?.id); 
        } else {
            if (!client.tags.includes('Cliente recorrente') && client.tags.includes('Lead novo')) {
               client.tags.push('Cliente recorrente');
            }
            await db.clients.update(client, currentUser?.id);
        }

        // Se for cliente online, garantir login automático para acessar área de membros
        if (!currentUser && mode === 'CLIENT_ONLINE') {
            localStorage.setItem('tonapista_client_auth', JSON.stringify(client));
        }

        let finalStatus = ReservationStatus.PENDENTE;
        let paymentStatus = PaymentStatus.PENDENTE;
        let obsDetail = '';
        let isPayOnSite = false;

        // 2. Determine Status based on Mode
        if (mode === 'STAFF_CONFIRM') {
            finalStatus = ReservationStatus.CONFIRMADA;
            paymentStatus = PaymentStatus.PAGO;
            obsDetail = `[Pgto Confirmado pelo Staff: ${staffMethod}]`;
        } else if (mode === 'STAFF_LATER') {
            finalStatus = ReservationStatus.PENDENTE;
            paymentStatus = PaymentStatus.PENDENTE;
            obsDetail = `[Pgto no Local/Comanda: ${comandaInput}]`;
            isPayOnSite = true; // Ignora regra de 30min
        } else {
            // CLIENT_ONLINE (Simulado ou Real)
            // Se for integração real, o status só muda via webhook. Se simulado:
            if (!settings?.onlinePaymentEnabled) {
                // Simulação Visual -> Confirma
                finalStatus = ReservationStatus.CONFIRMADA;
                paymentStatus = PaymentStatus.PAGO;
                obsDetail = `[Pgto Online Simulado: ${selectedMethod === 'PIX' ? 'PIX' : 'Cartão'}]`;
            } else {
                // Integração Real -> Mantém Pendente até callback
                obsDetail = `[Aguardando Gateway: ${selectedMethod}]`;
            }
        }

        const fullObs = `${reservationData.obs || ''} ${obsDetail}`;

        // 3. Create or Update Reservations
        const existingIds = reservationData.reservationIds;
        const currentTrackedIds: string[] = [];
        let firstReservationId = '';

        if (existingIds && existingIds.length > 0) {
            const allRes = await db.reservations.getAll();
            for (const id of existingIds) {
                 currentTrackedIds.push(id);
                 const existingRes = allRes.find(r => r.id === id);
                 if (existingRes) {
                     const updatedRes = {
                         ...existingRes,
                         status: finalStatus,
                         paymentStatus: paymentStatus,
                         observations: fullObs,
                         payOnSite: isPayOnSite,
                         comandaId: comandaInput // Update comanda ID
                     };
                     await db.reservations.update(updatedRes, currentUser?.id, `Checkout: ${obsDetail}`);
                     if (!firstReservationId) firstReservationId = id;
                 }
            }
        } else {
            const blocks = reservationData.reservationBlocks || [{ time: reservationData.time, duration: reservationData.duration }];
            for (const block of blocks) {
                 const blockTotalValue = (reservationData.totalValue / (reservationData.reservationBlocks?.reduce((acc:number, b:any) => acc + b.duration, 0) || reservationData.duration)) * block.duration;

                 const newRes: Reservation = {
                    id: uuidv4(),
                    clientId: client.id,
                    clientName: reservationData.name,
                    date: reservationData.date,
                    time: block.time,
                    peopleCount: reservationData.people,
                    laneCount: reservationData.lanes,
                    duration: block.duration,
                    totalValue: blockTotalValue,
                    eventType: reservationData.type,
                    observations: fullObs,
                    status: finalStatus,
                    paymentStatus: paymentStatus, 
                    createdAt: new Date().toISOString(),
                    guests: reservationData.guests || [],
                    payOnSite: isPayOnSite,
                    comandaId: comandaInput // New Comanda ID
                 };
                 await db.reservations.create(newRes, currentUser?.id);
                 currentTrackedIds.push(newRes.id);
                 if(!firstReservationId) firstReservationId = newRes.id;
            }
        }
        
        setTrackedReservationIds(currentTrackedIds);

        // 4. Loyalty Logic (Only if paid immediately)
        if (paymentStatus === PaymentStatus.PAGO) {
            const points = Math.floor(reservationData.totalValue);
            if (points > 0) {
                await db.loyalty.addTransaction(client.id, points, `Reserva Paga (${reservationData.date})`, currentUser?.id);
            }
        }

        // 5. Funnel Update
        const funnelStage = (mode === 'STAFF_CONFIRM' || paymentStatus === PaymentStatus.PAGO) ? FunnelStage.AGENDADO : FunnelStage.NEGOCIACAO;
        await db.clients.updateStage(client.id, funnelStage);

        // 6. Handle Redirects (Integrations)
        if (mode === 'CLIENT_ONLINE' && settings?.onlinePaymentEnabled) {
             const compositeRes = { 
                 id: firstReservationId, 
                 totalValue: reservationData.totalValue,
                 clientName: reservationData.name,
                 clientEmail: reservationData.email
             } as any;
             
             // Cria a preferência no backend
             const checkoutUrl = await Integrations.createMercadoPagoPreference(compositeRes, settings);
             if (checkoutUrl) {
                 // Redireciona para o Mercado Pago
                 window.location.href = checkoutUrl;
                 return; 
             } else {
                 alert("Erro ao gerar link de pagamento. Simulando sucesso localmente.");
                 setIsSuccess(true);
             }
        } else {
            // Se não for pagamento online real, sucesso imediato (Modo Simulação)
            if (mode !== 'CLIENT_ONLINE' || !settings?.onlinePaymentEnabled) {
                setIsSuccess(true);
            }
        }

    } catch (e) {
        console.error(e);
        alert('Erro ao processar.');
    } finally {
        setIsProcessing(false);
    }
  };

  const handleFinishRedirect = () => {
      if (currentUser) {
          navigate('/agenda');
      } else {
          navigate('/minha-conta');
      }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-center p-6 relative overflow-hidden">
        {/* Background Confetti Effect */}
        <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-10 left-10 w-4 h-4 bg-neon-blue rounded-full opacity-50 animate-bounce"></div>
            <div className="absolute top-20 right-20 w-3 h-3 bg-neon-orange rounded-full opacity-50 animate-ping"></div>
            <div className="absolute bottom-10 left-1/4 w-2 h-2 bg-neon-green rounded-full opacity-50 animate-pulse"></div>
        </div>

        <div className="max-w-md w-full bg-slate-800 p-8 rounded-2xl shadow-2xl border border-neon-green animate-scale-in relative z-10">
          <div className="mx-auto w-24 h-24 bg-neon-green/20 text-neon-green rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(34,197,94,0.4)]">
            <CheckCircle size={48} strokeWidth={3} />
          </div>
          
          <h2 className="text-3xl font-bold text-white mb-2">
            {currentUser ? 'Sucesso!' : 'Parabéns!'}
          </h2>
          
          <p className="text-slate-300 mb-8 text-lg">
            {currentUser 
                ? 'A reserva foi processada e salva.' 
                : 'Seu pagamento foi confirmado e sua reserva está garantida!'}
          </p>

          <button 
            onClick={handleFinishRedirect}
            className="w-full bg-neon-green hover:bg-green-500 text-black font-bold py-4 rounded-xl flex items-center justify-center gap-3 shadow-lg transform transition hover:scale-105"
          >
            {currentUser ? (
                <><Calendar size={20}/> Voltar para Agenda</>
            ) : (
                <><UserIcon size={20}/> Acessar Minha Conta</>
            )}
            <ArrowRight size={20}/>
          </button>
          
          {!currentUser && (
              <p className="text-xs text-slate-500 mt-4">
                  Você pode ver os detalhes na sua área de cliente.
              </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col">
       <header className="bg-slate-900 p-4 shadow-md border-b border-slate-800">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
           {!imgError ? (
             <img src="/logo.png" alt="Tô Na Pista" className="h-10 md:h-14 object-contain" onError={() => setImgError(true)}/>
           ) : (
             <h1 className="text-2xl font-bold text-neon-orange font-sans tracking-tighter leading-none">TÔ NA PISTA</h1>
           )}
          <div className="text-sm font-medium text-slate-400 flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700">
            <Lock size={14} className="text-neon-green" /> Checkout Seguro
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* COLUNA DA ESQUERDA: RESUMO */}
          <div className="lg:col-span-1 order-2 lg:order-1">
             <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 sticky top-24 shadow-lg">
                <h3 className="text-lg font-bold text-white mb-4 border-b border-slate-700 pb-2">Resumo do Pedido</h3>
                
                <div className="space-y-4">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-white font-medium">{reservationData.name}</p>
                            <p className="text-xs text-slate-500">{reservationData.email}</p>
                        </div>
                    </div>
                    
                    <div className="bg-slate-800 p-3 rounded text-sm text-slate-300 space-y-1">
                        <div className="flex justify-between"><span>Data:</span> <span className="text-white">{reservationData.date.split('-').reverse().join('/')}</span></div>
                        <div className="flex justify-between"><span>Horário:</span> <span className="text-white">{reservationData.time} ({reservationData.duration}h)</span></div>
                    </div>

                    <div className="space-y-2 text-sm text-slate-400 pt-2 border-t border-slate-800">
                        <div className="flex justify-between">
                            <span>{reservationData.lanes} Pista(s)</span>
                            <span>{reservationData.lanes} x R$ {(reservationData.totalValue / reservationData.lanes).toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="border-t border-slate-700 pt-4 mt-2 flex justify-between items-center">
                        <span className="font-bold text-white text-lg">Total</span>
                        <span className="font-bold text-2xl text-neon-green">{reservationData.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                    </div>
                </div>
             </div>
          </div>

          {/* COLUNA DA DIREITA: PAGAMENTO */}
          <div className="lg:col-span-2 order-1 lg:order-2">
            
            {/* --- VISÃO DA EQUIPE (STAFF) --- */}
            {currentUser ? (
                <div className="space-y-6">
                    <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10"><Store size={64}/></div>
                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <ShieldCheck className="text-neon-blue"/> Painel de Recebimento (Equipe)
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* OPÇÃO 1: RECEBER AGORA */}
                            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700">
                                <h3 className="text-sm font-bold text-neon-green uppercase mb-4 flex items-center gap-2"><CheckCircle size={16}/> Receber Agora</h3>
                                <p className="text-xs text-slate-400 mb-4">Confirme que o cliente pagou e registre o método.</p>
                                
                                <div className="grid grid-cols-2 gap-2 mb-4">
                                    {(['DINHEIRO', 'PIX', 'DEBITO', 'CREDITO'] as PaymentMethodStaff[]).map(m => (
                                        <button 
                                            key={m}
                                            onClick={() => setStaffMethod(m)}
                                            className={`p-2 rounded text-xs font-bold border transition ${staffMethod === m ? 'bg-neon-green text-black border-neon-green' : 'bg-slate-700 text-slate-300 border-slate-600 hover:border-slate-500'}`}
                                        >
                                            {m}
                                        </button>
                                    ))}
                                </div>
                                
                                <button 
                                    onClick={() => processPayment('STAFF_CONFIRM')}
                                    disabled={isProcessing}
                                    className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 shadow-lg"
                                >
                                    {isProcessing ? <Loader2 className="animate-spin"/> : 'Confirmar Pagamento'}
                                </button>
                            </div>

                            {/* OPÇÃO 2: PAGAR DEPOIS (COMANDA) */}
                            <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 flex flex-col justify-between">
                                <div>
                                    <h3 className="text-sm font-bold text-yellow-500 uppercase mb-4 flex items-center gap-2"><CalendarCheck size={16}/> Pagar no Local / Comanda</h3>
                                    <p className="text-xs text-slate-400 mb-2">
                                        Mantém a reserva <span className="text-yellow-500">Pendente</span> mas ignora timeout.
                                    </p>
                                    <div className="mb-4">
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Número da Comanda / Mesa</label>
                                        <div className="flex items-center bg-slate-900 border border-slate-600 rounded">
                                            <div className="pl-2 text-slate-500"><Hash size={14}/></div>
                                            <input 
                                                type="text" 
                                                placeholder="Ex: 10, A12" 
                                                className="w-full bg-transparent p-2 text-white text-sm outline-none"
                                                value={comandaInput}
                                                onChange={e => setComandaInput(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => processPayment('STAFF_LATER')}
                                    disabled={isProcessing || !comandaInput}
                                    className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 border border-slate-600 disabled:opacity-50"
                                >
                                    {isProcessing ? <Loader2 className="animate-spin"/> : 'Salvar na Comanda'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                
            /* --- VISÃO DO CLIENTE --- */
            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-white">Como você prefere pagar?</h2>
                
                {/* PAYMENT METHOD SELECTION */}
                <div className="grid grid-cols-3 gap-3">
                    <button 
                        onClick={() => setSelectedMethod('PIX')}
                        className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition ${selectedMethod === 'PIX' ? 'border-neon-green bg-green-500/10 text-white' : 'border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800'}`}
                    >
                        <QrCode size={24} className={selectedMethod === 'PIX' ? 'text-neon-green' : ''} />
                        <span className="text-xs md:text-sm font-bold">PIX</span>
                    </button>
                    <button 
                        onClick={() => setSelectedMethod('DEBIT')}
                        className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition ${selectedMethod === 'DEBIT' ? 'border-neon-blue bg-blue-500/10 text-white' : 'border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800'}`}
                    >
                        <CreditCard size={24} className={selectedMethod === 'DEBIT' ? 'text-neon-blue' : ''} />
                        <span className="text-xs md:text-sm font-bold">Débito</span>
                    </button>
                    <button 
                        onClick={() => setSelectedMethod('CREDIT')}
                        className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition ${selectedMethod === 'CREDIT' ? 'border-neon-blue bg-blue-500/10 text-white' : 'border-slate-700 bg-slate-900 text-slate-400 hover:bg-slate-800'}`}
                    >
                        <Wallet size={24} className={selectedMethod === 'CREDIT' ? 'text-neon-blue' : ''} />
                        <span className="text-xs md:text-sm font-bold">Crédito (A Vista)</span>
                    </button>
                </div>

                {/* PAYMENT DETAILS CONTENT */}
                <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 shadow-lg min-h-[300px]">
                    
                    {/* PIX CONTENT */}
                    {selectedMethod === 'PIX' && (
                        <div className="flex flex-col items-center animate-fade-in text-center">
                             {!settings?.onlinePaymentEnabled ? (
                                 /* MODO SIMULAÇÃO: MOSTRA QR CODE FAKE */
                                 <>
                                     <div className="bg-white p-2 rounded-lg mb-4 relative">
                                         <div className="absolute -top-2 -right-2 bg-yellow-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">TESTE</div>
                                         <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=SimulacaoPagamentoToNaPista" alt="QR Code" className="w-48 h-48"/>
                                     </div>
                                     <p className="text-sm text-slate-300 font-bold mb-1">Escaneie o QR Code (Simulação)</p>
                                     <p className="text-xs text-slate-500 mb-6">Aprovação imediata para fins de teste</p>
                                     <button 
                                        onClick={() => processPayment('CLIENT_ONLINE')}
                                        disabled={isProcessing}
                                        className="w-full max-w-sm bg-neon-green hover:bg-green-500 text-black font-bold py-3 rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-green-500/20"
                                     >
                                         {isProcessing ? <Loader2 className="animate-spin"/> : 'Simular Confirmação'}
                                     </button>
                                 </>
                             ) : (
                                 /* MODO PRODUÇÃO: REDIRECIONA OU AGUARDA */
                                 <>
                                     <div className="p-6 bg-slate-800 rounded-lg border border-slate-700 mb-6 w-full max-w-sm">
                                         <QrCode className="w-16 h-16 text-neon-green mx-auto mb-4"/>
                                         <h3 className="text-white font-bold mb-2">Pagamento Seguro via Mercado Pago</h3>
                                         <p className="text-slate-400 text-xs mb-4">Você será redirecionado para concluir o pagamento com segurança.</p>
                                     </div>
                                     
                                     <button 
                                        onClick={() => processPayment('CLIENT_ONLINE')}
                                        disabled={isProcessing}
                                        className="w-full max-w-sm bg-neon-blue hover:bg-blue-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                                     >
                                         {isProcessing ? <Loader2 className="animate-spin"/> : <><ExternalLink size={18}/> Ir para Pagamento</>}
                                     </button>
                                 </>
                             )}

                             {/* MONITORAMENTO MANUAL (Útil se o usuário voltar da tela de pagamento) */}
                             {trackedReservationIds.length > 0 && settings?.onlinePaymentEnabled && (
                                <div className="w-full max-w-sm mt-4 pt-4 border-t border-slate-800">
                                    <p className="text-xs text-slate-500 mb-2">Já realizou o pagamento?</p>
                                    <button 
                                        onClick={checkPaymentStatusManual}
                                        disabled={isCheckingPayment}
                                        className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 border border-slate-600"
                                    >
                                        {isCheckingPayment ? <Loader2 className="animate-spin text-white" size={18}/> : <RefreshCw size={18}/>}
                                        Verificar Status Agora
                                    </button>
                                </div>
                             )}
                        </div>
                    )}

                    {/* CARD CONTENT (DEBIT OR CREDIT) */}
                    {(selectedMethod === 'DEBIT' || selectedMethod === 'CREDIT') && (
                        <div className="max-w-md mx-auto animate-fade-in space-y-4">
                            {!settings?.onlinePaymentEnabled ? (
                                /* SIMULAÇÃO DE CARTÃO */
                                <>
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-white font-bold">Simulação de Cartão</h3>
                                        <span className="text-[10px] bg-yellow-500 text-black px-2 py-1 rounded font-bold">MODO TESTE</span>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-400 mb-1">Número do Cartão</label>
                                        <div className="relative">
                                            <CreditCard className="absolute left-3 top-3 text-slate-500" size={18}/>
                                            <input 
                                                type="text" 
                                                placeholder="0000 0000 0000 0000" 
                                                maxLength={19}
                                                value={cardNumber}
                                                onChange={handleCardNumberChange}
                                                className="w-full bg-slate-800 border border-slate-600 rounded-lg py-3 pl-10 text-white focus:border-neon-blue outline-none font-mono"
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">Validade</label>
                                            <input type="text" placeholder="MM/AA" maxLength={5} value={cardExpiry} onChange={handleExpiryChange} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-3 px-4 text-white focus:border-neon-blue outline-none text-center" />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-slate-400 mb-1">CVV</label>
                                            <input type="text" placeholder="123" maxLength={4} value={cardCvv} onChange={e => setCardCvv(e.target.value.replace(/\D/g, ''))} className="w-full bg-slate-800 border border-slate-600 rounded-lg py-3 px-4 text-white focus:border-neon-blue outline-none text-center" />
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => processPayment('CLIENT_ONLINE')}
                                        disabled={isProcessing}
                                        className="w-full mt-6 bg-neon-blue hover:bg-blue-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                                    >
                                        {isProcessing ? <Loader2 className="animate-spin"/> : `Pagar ${reservationData.totalValue.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}`}
                                    </button>
                                </>
                            ) : (
                                /* PRODUÇÃO: AVISO DE REDIRECIONAMENTO */
                                <div className="text-center py-10">
                                     <CreditCard className="w-16 h-16 text-neon-blue mx-auto mb-4"/>
                                     <h3 className="text-white font-bold mb-2">Cartão de Crédito/Débito</h3>
                                     <p className="text-slate-400 text-sm mb-6">Para sua segurança, o pagamento com cartão é processado no ambiente criptografado do Mercado Pago.</p>
                                     
                                     <button 
                                        onClick={() => processPayment('CLIENT_ONLINE')}
                                        disabled={isProcessing}
                                        className="w-full bg-neon-blue hover:bg-blue-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                                     >
                                         {isProcessing ? <Loader2 className="animate-spin"/> : <><ExternalLink size={18}/> Ir para Pagamento Seguro</>}
                                     </button>
                                </div>
                            )}
                        </div>
                    )}
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
