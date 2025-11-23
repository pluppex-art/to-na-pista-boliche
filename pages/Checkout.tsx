
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { db } from '../services/mockBackend';
import { Integrations } from '../services/integrations';
import { Reservation, ReservationStatus, FunnelStage, User, PaymentStatus } from '../types';
import { CheckCircle, CreditCard, Smartphone, Loader2, ShieldCheck, Wallet, Store } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

type PaymentMethod = 'CREDIT' | 'DEBIT' | 'PIX' | 'IN_PERSON';

const Checkout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX');
  const [imgError, setImgError] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [inPersonType, setInPersonType] = useState<'DINHEIRO' | 'CARTAO' | 'PIX'>('DINHEIRO');
  const [settings, setSettings] = useState<any>(null);

  // Reservation data passed from PublicBooking
  const reservationData = location.state as any;

  useEffect(() => {
    if (!reservationData) {
      navigate('/agendamento');
    }
    const storedUser = localStorage.getItem('tonapista_auth');
    if (storedUser) {
        try { setCurrentUser(JSON.parse(storedUser)); } catch(e) {}
    }
    db.settings.get().then(setSettings);
  }, [reservationData, navigate]);

  if (!reservationData) return null;

  const handlePayment = async () => {
    setIsProcessing(true);

    try {
        // 1. Create/Update Client (Backend Service)
        const existingClients = await db.clients.getAll();
        let client = existingClients.find(c => c.phone === reservationData.whatsapp);
        
        if (!client) {
        client = await db.clients.create({
            id: uuidv4(),
            name: reservationData.name,
            phone: reservationData.whatsapp,
            email: reservationData.email,
            tags: ['Lead novo'],
            createdAt: new Date().toISOString(),
            lastContactAt: new Date().toISOString()
        });
        } else {
            // Update last contact
            client.lastContactAt = new Date().toISOString();
            await db.clients.update(client);
        }

        // 2. Determine initial status based on payment
        // If Staff is doing in-person payment, it is Confirmed immediately
        const isStaffAction = paymentMethod === 'IN_PERSON' && !!currentUser;
        
        let initialStatus = ReservationStatus.PENDENTE;
        let paymentStatus = PaymentStatus.PENDENTE;

        if (isStaffAction) {
            initialStatus = ReservationStatus.CONFIRMADA;
            paymentStatus = PaymentStatus.PAGO;
        }

        const notes = isStaffAction 
            ? `${reservationData.obs || ''} [Pgto Presencial: ${inPersonType}]` 
            : reservationData.obs;

        // 3. Create Reservation
        const newReservation: Reservation = {
            id: uuidv4(),
            clientId: client.id,
            clientName: reservationData.name,
            date: reservationData.date,
            time: reservationData.time,
            peopleCount: reservationData.people,
            laneCount: reservationData.lanes,
            duration: reservationData.duration,
            totalValue: reservationData.totalValue,
            eventType: reservationData.type,
            observations: notes,
            status: initialStatus,
            paymentStatus: paymentStatus, 
            createdAt: new Date().toISOString(),
            guests: reservationData.guests || []
        };

        await db.reservations.create(newReservation);

        // 4. Create Funnel Card
        await db.funnel.add({
            id: uuidv4(),
            clientId: client.id,
            clientName: client.name,
            stage: isStaffAction ? FunnelStage.AGENDADO : FunnelStage.NEGOCIACAO, 
            eventType: reservationData.type,
            desiredDate: reservationData.date,
            notes: `Reserva ${isStaffAction ? 'presencial' : 'online'}. ${reservationData.people} pessoas.`
        });

        // 5. Integrations
        if (settings) {
            // Google Calendar (fire and forget for this demo, usually handled by backend hook)
            Integrations.syncReservationToGoogleCalendar(newReservation, settings);
            
            // Mercado Pago
            if (!isStaffAction && settings.onlinePaymentEnabled) {
                const checkoutUrl = await Integrations.createMercadoPagoPreference(newReservation, settings);
                if (checkoutUrl) {
                    window.location.href = checkoutUrl;
                    return; // Stop here, redirecting
                }
            }
        }

        setIsSuccess(true);
    } catch (e) {
        console.error(e);
        alert('Erro ao processar reserva.');
    } finally {
        setIsProcessing(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-center p-6">
        <div className="max-w-md w-full bg-slate-800 p-8 rounded-2xl shadow-2xl border border-neon-green animate-scale-in">
          <div className="mx-auto w-20 h-20 bg-neon-green/20 text-neon-green rounded-full flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(34,197,94,0.4)]">
            <CheckCircle size={40} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Reserva Confirmada!</h2>
          <p className="text-slate-300 mb-6">
            A reserva foi criada com sucesso no sistema.
          </p>
          <div className="bg-slate-900 p-4 rounded-lg text-left mb-6 text-sm text-slate-400 border border-slate-700">
            <p className="flex justify-between"><strong className="text-slate-200">Reserva:</strong> <span>#{Math.floor(Math.random() * 10000)}</span></p>
            <p className="flex justify-between mt-2"><strong className="text-slate-200">Data:</strong> <span>{new Date(reservationData.date).toLocaleDateString('pt-BR')}</span></p>
            <p className="flex justify-between mt-2"><strong className="text-slate-200">Valor:</strong> <span className="text-neon-green font-bold">{reservationData.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></p>
          </div>
          <div className="space-y-3">
             <Link 
                to="/agendamento" 
                className="block w-full py-3 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition font-medium"
            >
                Novo Agendamento
            </Link>
            {currentUser && (
                <Link 
                    to="/dashboard" 
                    className="block w-full py-3 bg-neon-blue text-white rounded-lg hover:bg-blue-600 transition font-medium"
                >
                    Ir para Dashboard
                </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 p-4 shadow-md border-b border-slate-800">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
           {!imgError ? (
             <img 
               src="/logo.png" 
               alt="Tô Na Pista" 
               className="h-12 md:h-16 object-contain" 
               onError={() => setImgError(true)}
             />
           ) : (
             <div className="flex flex-col">
               <h1 className="text-2xl font-bold text-neon-orange font-sans tracking-tighter leading-none">TÔ NA PISTA</h1>
             </div>
           )}
          <div className="text-sm font-medium text-slate-400 flex items-center gap-2">
            <ShieldCheck size={16} className="text-neon-green" /> Ambiente Seguro
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8">
        <div className="max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Order Summary */}
          <div className="md:col-span-1 order-2 md:order-1">
             <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 sticky top-24">
                <h3 className="text-lg font-bold text-white mb-4 border-b border-slate-800 pb-2">Resumo do Pedido</h3>
                <div className="space-y-3 text-sm text-slate-300">
                   <p className="flex justify-between">
                     <span>Pistas ({reservationData.lanes})</span>
                     <span>{reservationData.lanes} x R$ 140</span>
                   </p>
                   <p className="flex justify-between">
                     <span>Horas ({reservationData.duration}h)</span>
                     <span>x {reservationData.duration}</span>
                   </p>
                   <div className="border-t border-slate-800 pt-3 mt-3 flex justify-between items-center">
                      <span className="font-bold text-white">Total a Pagar</span>
                      <span className="font-bold text-xl text-neon-green">
                        {reservationData.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                   </div>
                </div>
             </div>
          </div>

          {/* Payment Form */}
          <div className="md:col-span-2 order-1 md:order-2">
            <h2 className="text-2xl font-bold text-white mb-6">Pagamento</h2>
            
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
               {/* Payment Tabs */}
               <div className="flex border-b border-slate-800 overflow-x-auto">
                  <button 
                    onClick={() => setPaymentMethod('PIX')}
                    className={`flex-1 py-4 flex flex-col items-center gap-1 transition min-w-[100px] ${paymentMethod === 'PIX' ? 'bg-slate-800 text-neon-blue border-b-2 border-neon-blue' : 'text-slate-400 hover:bg-slate-800'}`}
                  >
                    <Smartphone size={24} />
                    <span className="text-sm font-medium">PIX</span>
                  </button>
                  <button 
                    onClick={() => setPaymentMethod('CREDIT')}
                    className={`flex-1 py-4 flex flex-col items-center gap-1 transition min-w-[100px] ${paymentMethod === 'CREDIT' ? 'bg-slate-800 text-neon-blue border-b-2 border-neon-blue' : 'text-slate-400 hover:bg-slate-800'}`}
                  >
                    <CreditCard size={24} />
                    <span className="text-sm font-medium">Cartão</span>
                  </button>
                  
                  {/* Staff Only Tab */}
                  {currentUser && (
                    <button 
                        onClick={() => setPaymentMethod('IN_PERSON')}
                        className={`flex-1 py-4 flex flex-col items-center gap-1 transition min-w-[120px] bg-slate-800/50 ${paymentMethod === 'IN_PERSON' ? 'text-neon-orange border-b-2 border-neon-orange' : 'text-slate-500 hover:text-white'}`}
                    >
                        <Store size={24} />
                        <span className="text-sm font-bold">Presencial</span>
                    </button>
                  )}
               </div>

               <div className="p-8">
                  
                  {paymentMethod === 'PIX' && (
                    <div className="text-center animate-fade-in">
                       <p className="text-slate-300 mb-6">Escaneie o QR Code abaixo para pagar instantaneamente:</p>
                       <div className="bg-white p-4 rounded-lg inline-block mb-6">
                         {/* Fake QR Code */}
                         <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=SimulacaoPagamentoToNaPista" alt="QR Code PIX" className="w-48 h-48" />
                       </div>
                       <div className="max-w-xs mx-auto bg-slate-800 p-3 rounded border border-slate-700 flex items-center justify-between">
                          <code className="text-xs text-slate-400 truncate mr-2">00020126580014br.gov.bcb.pix0136...</code>
                          <button className="text-neon-blue text-xs font-bold hover:underline">Copiar</button>
                       </div>
                    </div>
                  )}

                  {(paymentMethod === 'CREDIT' || paymentMethod === 'DEBIT') && (
                    <div className="space-y-4 animate-fade-in max-w-md mx-auto">
                       <div>
                         <label className="block text-xs text-slate-400 mb-1 uppercase font-bold">Número do Cartão</label>
                         <div className="relative">
                           <CreditCard className="absolute left-3 top-3 text-slate-500" size={18} />
                           <input type="text" placeholder="0000 0000 0000 0000" className="w-full bg-slate-800 border border-slate-600 rounded-lg py-3 pl-10 pr-4 text-white focus:border-neon-blue focus:outline-none" />
                         </div>
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs text-slate-400 mb-1 uppercase font-bold">Validade</label>
                            <input type="text" placeholder="MM/AA" className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white focus:border-neon-blue focus:outline-none" />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-400 mb-1 uppercase font-bold">CVV</label>
                            <input type="text" placeholder="123" className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white focus:border-neon-blue focus:outline-none" />
                          </div>
                       </div>
                       <div>
                         <label className="block text-xs text-slate-400 mb-1 uppercase font-bold">Nome no Cartão</label>
                         <input type="text" placeholder="COMO NO CARTÃO" className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white focus:border-neon-blue focus:outline-none" />
                       </div>
                    </div>
                  )}

                  {/* STAFF ONLY IN-PERSON */}
                  {paymentMethod === 'IN_PERSON' && currentUser && (
                      <div className="animate-fade-in space-y-6">
                          <div className="bg-neon-orange/10 border border-neon-orange/30 p-4 rounded-lg flex items-center gap-3">
                              <div className="bg-neon-orange text-white p-2 rounded-full"><Store size={20}/></div>
                              <div>
                                  <h4 className="font-bold text-white">Pagamento no Balcão</h4>
                                  <p className="text-xs text-slate-400">Registre o recebimento realizado na recepção.</p>
                              </div>
                          </div>
                          
                          <div>
                              <label className="block text-sm font-bold text-slate-300 mb-3">Forma de Pagamento:</label>
                              <div className="grid grid-cols-3 gap-3">
                                  <label className={`cursor-pointer border rounded-lg p-4 flex flex-col items-center gap-2 transition ${inPersonType === 'DINHEIRO' ? 'bg-slate-700 border-neon-green text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}>
                                      <input type="radio" name="payType" value="DINHEIRO" className="hidden" checked={inPersonType === 'DINHEIRO'} onChange={() => setInPersonType('DINHEIRO')}/>
                                      <Wallet />
                                      <span className="text-sm font-medium">Dinheiro</span>
                                  </label>
                                  <label className={`cursor-pointer border rounded-lg p-4 flex flex-col items-center gap-2 transition ${inPersonType === 'CARTAO' ? 'bg-slate-700 border-neon-blue text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}>
                                      <input type="radio" name="payType" value="CARTAO" className="hidden" checked={inPersonType === 'CARTAO'} onChange={() => setInPersonType('CARTAO')}/>
                                      <CreditCard />
                                      <span className="text-sm font-medium">Cartão (Mq)</span>
                                  </label>
                                  <label className={`cursor-pointer border rounded-lg p-4 flex flex-col items-center gap-2 transition ${inPersonType === 'PIX' ? 'bg-slate-700 border-neon-orange text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}>
                                      <input type="radio" name="payType" value="PIX" className="hidden" checked={inPersonType === 'PIX'} onChange={() => setInPersonType('PIX')}/>
                                      <Smartphone />
                                      <span className="text-sm font-medium">Pix (Loja)</span>
                                  </label>
                              </div>
                          </div>
                      </div>
                  )}

                  <div className="mt-8 pt-6 border-t border-slate-800">
                     <button 
                      onClick={handlePayment}
                      disabled={isProcessing}
                      className={`w-full py-4 text-white font-bold text-lg rounded-xl shadow-[0_0_20px_rgba(249,115,22,0.3)] transition transform hover:-translate-y-1 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-3 ${paymentMethod === 'IN_PERSON' ? 'bg-green-600 hover:bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.3)]' : 'bg-gradient-to-r from-neon-orange to-amber-500 hover:shadow-[0_0_30px_rgba(249,115,22,0.5)]'}`}
                     >
                       {isProcessing ? (
                         <>
                           <Loader2 className="animate-spin" /> Processando...
                         </>
                       ) : (
                         <>
                            {paymentMethod === 'IN_PERSON' ? 'Confirmar Recebimento ' : 'Pagar '}
                            {reservationData.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                         </>
                       )}
                     </button>
                     <p className="text-center text-xs text-slate-500 mt-4 flex items-center justify-center gap-1">
                       <ShieldCheck size={12} /> Pagamento 100% Seguro
                     </p>
                  </div>

               </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default Checkout;
