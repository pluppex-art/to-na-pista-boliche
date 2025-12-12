
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { db } from '../services/mockBackend';
import { Integrations } from '../services/integrations';
import { Reservation, ReservationStatus, FunnelStage, User, PaymentStatus } from '../types';
import { CheckCircle, CreditCard, Loader2, ShieldCheck, Store, Lock, Hash, ArrowRight, User as UserIcon, Calendar, RefreshCw, ExternalLink, Shield } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../services/supabaseClient';

type PaymentMethodStaff = 'DINHEIRO' | 'PIX' | 'DEBITO' | 'CREDITO';

const Checkout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  
  // Staff Selection State
  const [staffMethod, setStaffMethod] = useState<PaymentMethodStaff>('DINHEIRO');
  
  // Staff Comanda Input
  const [comandaInput, setComandaInput] = useState('');

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
                obsDetail = `[Pgto Online Simulado]`;
            } else {
                // Integração Real -> Mantém Pendente até callback
                obsDetail = `[Aguardando Gateway de Pagamento]`;
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
            // Se não for pagamento online real, sucesso imediato (Modo Simulação ou Staff)
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
                                    <h3 className="text-sm font-bold text-yellow-500 uppercase mb-4 flex items-center gap-2"><Calendar size={16}/> Pagar no Local / Comanda</h3>
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
                
            /* --- VISÃO DO CLIENTE UNIFICADA --- */
            <div className="space-y-6 animate-fade-in">
                <h2 className="text-2xl font-bold text-white mb-4">Pagamento Seguro</h2>
                
                <div className="bg-slate-900 rounded-xl p-8 border border-slate-800 shadow-lg text-center">
                    
                    {!settings?.onlinePaymentEnabled ? (
                         /* MODO SIMULAÇÃO */
                         <div className="flex flex-col items-center gap-6">
                            <div className="w-20 h-20 bg-yellow-500/10 rounded-full flex items-center justify-center border border-yellow-500/30">
                                <Shield className="text-yellow-500 w-10 h-10" />
                            </div>
                            
                            <div>
                                <div className="inline-block bg-yellow-500 text-black text-[10px] font-bold px-2 py-1 rounded mb-2">MODO SIMULAÇÃO</div>
                                <h3 className="text-xl font-bold text-white mb-2">Ambiente de Teste</h3>
                                <p className="text-slate-400 text-sm max-w-md mx-auto">
                                    O pagamento online ainda não foi ativado pelo estabelecimento.
                                    Clique abaixo para simular uma confirmação imediata.
                                </p>
                            </div>

                            <button 
                                onClick={() => processPayment('CLIENT_ONLINE')}
                                disabled={isProcessing}
                                className="w-full max-w-sm bg-neon-green hover:bg-green-500 text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-green-500/20 transform hover:scale-105 transition"
                            >
                                {isProcessing ? <Loader2 className="animate-spin"/> : 'Simular Pagamento Aprovado'}
                            </button>
                         </div>
                    ) : (
                         /* MODO PRODUÇÃO (MERCADO PAGO) */
                         <div className="flex flex-col items-center gap-6">
                            <div className="w-20 h-20 bg-neon-blue/10 rounded-full flex items-center justify-center border border-neon-blue/30 relative">
                                <ShieldCheck className="text-neon-blue w-10 h-10" />
                                <div className="absolute -bottom-2 bg-slate-900 border border-slate-700 px-2 py-0.5 rounded text-[10px] text-slate-400 font-bold">SSL SEGURO</div>
                            </div>

                            <div>
                                <h3 className="text-xl font-bold text-white mb-2">Finalizar Pagamento</h3>
                                <p className="text-slate-400 text-sm max-w-md mx-auto mb-4">
                                    Você será redirecionado para o ambiente seguro do Mercado Pago.
                                    Lá você poderá escolher pagar com:
                                </p>
                                <div className="flex justify-center gap-3 text-xs font-bold text-slate-300">
                                    <span className="bg-slate-800 px-3 py-1 rounded border border-slate-700">PIX</span>
                                    <span className="bg-slate-800 px-3 py-1 rounded border border-slate-700">Cartão de Crédito</span>
                                    <span className="bg-slate-800 px-3 py-1 rounded border border-slate-700">Débito</span>
                                </div>
                            </div>

                            <button 
                                onClick={() => processPayment('CLIENT_ONLINE')}
                                disabled={isProcessing}
                                className="w-full max-w-sm bg-neon-blue hover:bg-blue-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transform hover:scale-105 transition"
                            >
                                {isProcessing ? <Loader2 className="animate-spin"/> : <><ExternalLink size={20}/> Ir para Pagamento Seguro</>}
                            </button>
                            
                            {/* MONITORAMENTO MANUAL */}
                            {trackedReservationIds.length > 0 && (
                                <div className="w-full max-w-sm pt-6 border-t border-slate-800 mt-2">
                                    <p className="text-xs text-slate-500 mb-3">Já realizou o pagamento na outra aba?</p>
                                    <button 
                                        onClick={checkPaymentStatusManual}
                                        disabled={isCheckingPayment}
                                        className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 rounded-lg flex items-center justify-center gap-2 border border-slate-600 text-sm"
                                    >
                                        {isCheckingPayment ? <Loader2 className="animate-spin" size={16}/> : <RefreshCw size={16}/>}
                                        Verificar Status do Pagamento
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
