
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { db } from '../services/mockBackend';
import { Integrations } from '../services/integrations';
import { Reservation, ReservationStatus, FunnelStage, User, PaymentStatus, EventType } from '../types';
import { CheckCircle, CreditCard, Loader2, ShieldCheck, Store, Lock, Hash, ArrowRight, User as UserIcon, Calendar, RefreshCw, ExternalLink, Shield } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../services/supabaseClient';

type PaymentMethodStaff = 'DINHEIRO' | 'PIX' | 'DEBITO' | 'CREDITO';

const Checkout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const [staffMethod, setStaffMethod] = useState<PaymentMethodStaff>('DINHEIRO');
  const [comandaInput, setComandaInput] = useState('');
  const [imgError, setImgError] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [trackedReservationIds, setTrackedReservationIds] = useState<string[]>([]);

  const reservationData = location.state as any;

  useEffect(() => {
    if (!reservationData) { navigate('/agendamento'); return; }
    const storedUser = localStorage.getItem('tonapista_auth');
    if (storedUser) { try { setCurrentUser(JSON.parse(storedUser)); } catch(e) {} }
    
    db.settings.get().then(s => setSettings(s));
    
    if (reservationData.reservationIds && reservationData.reservationIds.length > 0) {
        setTrackedReservationIds(reservationData.reservationIds);
    }
  }, [reservationData, navigate]);

  useEffect(() => {
      if (trackedReservationIds.length === 0) return;
      
      // MONITORAMENTO REAL-TIME: Escuta todas as mudanças em reservas e filtra localmente
      // Isso é mais seguro que o filtro complexo "id=in.(...)" que falha em alguns brokers
      const channel = supabase.channel('checkout-monitor')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'reservas' }, (payload) => {
            if (trackedReservationIds.includes(payload.new.id) && payload.new.payment_status === 'Pago') {
                setIsSuccess(true);
            }
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
  }, [trackedReservationIds]);

  const processPayment = async (mode: 'CLIENT_ONLINE' | 'STAFF_CONFIRM' | 'STAFF_LATER') => {
    setIsProcessing(true);
    try {
        let client = null;
        if (reservationData.clientId) client = await db.clients.getById(reservationData.clientId);
        if (!client && reservationData.whatsapp) client = await db.clients.getByPhone(reservationData.whatsapp);
        if (!client) {
          client = await db.clients.create({
              id: uuidv4(), name: reservationData.name, phone: reservationData.whatsapp, email: reservationData.email,
              tags: ['Lead novo'], createdAt: new Date().toISOString(), lastContactAt: new Date().toISOString(), funnelStage: FunnelStage.NOVO
          }, currentUser?.id); 
        }

        if (!currentUser && mode === 'CLIENT_ONLINE') localStorage.setItem('tonapista_client_auth', JSON.stringify(client));

        let finalStatus = ReservationStatus.PENDENTE;
        let paymentStatus = PaymentStatus.PENDENTE;
        let isPayOnSite = false;

        if (mode === 'STAFF_CONFIRM') { finalStatus = ReservationStatus.CONFIRMADA; paymentStatus = PaymentStatus.PAGO; }
        else if (mode === 'STAFF_LATER') { isPayOnSite = true; }

        const existingIds = reservationData.reservationIds;
        const currentTrackedIds: string[] = [];
        let firstReservationId = '';

        if (existingIds && existingIds.length > 0) {
            const allRes = await db.reservations.getAll();
            for (const id of existingIds) {
                 const existingRes = allRes.find(r => r.id === id);
                 if (existingRes) {
                     // Corrigido: payment_status -> paymentStatus
                     await db.reservations.update({ ...existingRes, status: finalStatus, paymentStatus: paymentStatus, payOnSite: isPayOnSite, comandaId: comandaInput }, currentUser?.id);
                     currentTrackedIds.push(id);
                     if (!firstReservationId) firstReservationId = id;
                 }
            }
        } else {
            const resId = uuidv4();
            const newRes: Reservation = {
                id: resId, clientId: client.id, clientName: reservationData.name, date: reservationData.date, time: reservationData.time,
                peopleCount: reservationData.people, laneCount: reservationData.lanes, duration: reservationData.duration,
                totalValue: reservationData.totalValue, eventType: reservationData.type as EventType, status: finalStatus,
                paymentStatus: paymentStatus, createdAt: new Date().toISOString(), payOnSite: isPayOnSite, comandaId: comandaInput
            };
            await db.reservations.create(newRes, currentUser?.id);
            currentTrackedIds.push(resId);
            firstReservationId = resId;
        }
        
        setTrackedReservationIds(currentTrackedIds);

        if (mode === 'CLIENT_ONLINE' && settings?.onlinePaymentEnabled) {
             const checkoutUrl = await Integrations.createMercadoPagoPreference({ id: firstReservationId }, settings);
             if (checkoutUrl) { window.location.href = checkoutUrl; return; }
             else alert("Erro ao gerar pagamento online.");
        } else if (mode !== 'CLIENT_ONLINE' || !settings?.onlinePaymentEnabled) { setIsSuccess(true); }
    } catch (e: any) { alert(`Erro: ${e.message}`); } finally { setIsProcessing(false); }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-center p-6">
        <div className="max-w-md w-full bg-slate-800 p-8 rounded-2xl border border-neon-green shadow-2xl">
          <CheckCircle size={48} className="mx-auto text-neon-green mb-6" />
          <h2 className="text-3xl font-bold text-white mb-4">Sucesso!</h2>
          <p className="text-slate-300 mb-8">Reserva processada com sucesso.</p>
          <button onClick={() => navigate(currentUser ? '/agenda' : '/minha-conta')} className="w-full bg-neon-green text-black font-bold py-4 rounded-xl">OK</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col">
       <header className="bg-slate-900 p-4 shadow-md border-b border-slate-800"><div className="max-w-6xl mx-auto flex justify-between items-center">{!imgError ? (<img src="/logo.png" className="h-10 md:h-14 object-contain" onError={() => setImgError(true)}/>) : (<h1 className="text-2xl font-bold text-neon-orange uppercase">TÔ NA PISTA</h1>)}<div className="text-sm text-slate-400 flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700"><Lock size={14} className="text-neon-green" /> Checkout Seguro</div></div></header>
      <main className="flex-1 p-4 md:p-8">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1"><div className="bg-slate-900 rounded-xl p-6 border border-slate-800 shadow-lg"><h3 className="text-lg font-bold text-white mb-4 border-b border-slate-700 pb-2">Resumo</h3><div className="space-y-4 text-sm"><p className="text-white font-medium">{reservationData.name}</p><div className="flex justify-between"><span>Data:</span> <span className="text-white">{reservationData.date.split('-').reverse().join('/')}</span></div><div className="flex justify-between"><span>Horário:</span> <span className="text-white">{reservationData.time}</span></div><div className="border-t border-slate-700 pt-4 flex justify-between items-center"><span className="font-bold text-lg">Total</span><span className="font-bold text-2xl text-neon-green">{reservationData.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div></div></div></div>
          <div className="lg:col-span-2">
            {currentUser ? (
                <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl shadow-lg">
                    <h2 className="text-xl font-bold text-white mb-6">Painel Equipe</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700"><h3 className="text-sm font-bold text-neon-green mb-4 uppercase">Receber Agora</h3><div className="grid grid-cols-2 gap-2 mb-4">{(['DINHEIRO', 'PIX', 'DEBITO', 'CREDITO'] as PaymentMethodStaff[]).map(m => ( <button key={m} onClick={() => setStaffMethod(m)} className={`p-2 rounded text-xs font-bold border transition ${staffMethod === m ? 'bg-neon-green text-black border-neon-green' : 'bg-slate-700 border-slate-600'}`}>{m}</button> )) }</div><button onClick={() => processPayment('STAFF_CONFIRM')} disabled={isProcessing} className="w-full bg-green-600 text-white font-bold py-3 rounded-lg">{isProcessing ? <Loader2 className="animate-spin mx-auto"/> : 'Confirmar'}</button></div>
                        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700"><h3 className="text-sm font-bold text-yellow-500 mb-4 uppercase">Pagar no Local</h3><input type="text" placeholder="Comanda/Mesa" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white mb-4" value={comandaInput} onChange={e => setComandaInput(e.target.value)} /><button onClick={() => processPayment('STAFF_LATER')} disabled={isProcessing} className="w-full bg-slate-700 text-white font-bold py-3 rounded-lg">Salvar na Comanda</button></div>
                    </div>
                </div>
            ) : (
                <div className="bg-slate-900 rounded-xl p-8 border border-slate-800 shadow-lg text-center"><div className="flex flex-col items-center gap-6"><ShieldCheck className="text-neon-blue w-12 h-12" /><div><h3 className="text-xl font-bold text-white mb-2">Finalizar Pagamento</h3><p className="text-slate-400 text-sm">Pague via PIX ou Cartão de forma segura.</p></div><button onClick={() => processPayment('CLIENT_ONLINE')} disabled={isProcessing} className="w-full max-w-sm bg-neon-blue hover:bg-blue-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2">{isProcessing ? <Loader2 className="animate-spin"/> : <><ExternalLink size={20}/> Pagar Agora</>}</button></div></div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Checkout;
