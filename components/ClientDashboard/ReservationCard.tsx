
import React from 'react';
import { Reservation, ReservationStatus, PaymentStatus } from '../../types';
import { Clock, Users, AlertTriangle, CreditCard, RefreshCw, MessageCircle } from 'lucide-react';
import { PaymentCountdown } from './PaymentCountdown';

interface ReservationCardProps {
  res: Reservation;
  onPay: (res: Reservation) => void;
  onRefresh: () => void;
  whatsappLink?: string;
}

export const ReservationCard: React.FC<ReservationCardProps> = ({ res, onPay, onRefresh, whatsappLink }) => {
  const isRefunded = res.paymentStatus === PaymentStatus.REEMBOLSADO;
  const isPendingRefund = res.paymentStatus === PaymentStatus.PENDENTE_ESTORNO;

  const helpMessage = encodeURIComponent(`Olá! Gostaria de solicitar a alteração ou cancelamento da minha reserva do dia ${res.date.split('-').reverse().join('/')} às ${res.time}.`);
  const finalLink = whatsappLink ? `${whatsappLink}${whatsappLink.includes('?') ? '&' : '?'}text=${helpMessage}` : `https://wa.me/55?text=${helpMessage}`;

  return (
    <div className={`bg-slate-900 border rounded-[2rem] p-6 shadow-2xl space-y-6 relative overflow-hidden group transition-all ${isRefunded || isPendingRefund ? 'border-red-500/40 opacity-90' : 'border-slate-800 hover:border-slate-700'}`}>
      
      <div className={`absolute top-0 right-0 p-3.5 font-black text-[9px] rounded-bl-2xl uppercase tracking-tighter shadow-xl z-10 ${
        isRefunded ? 'bg-red-600 text-white' : 
        isPendingRefund ? 'bg-orange-600 text-white animate-pulse' :
        res.status === ReservationStatus.CONFIRMADA ? 'bg-green-600 text-white' : 'bg-neon-orange text-black animate-pulse'
      }`}>
        {isRefunded ? 'ESTORNADO' : isPendingRefund ? 'PROCESSANDO ESTORNO' : res.status}
      </div>

      <div className="flex items-center gap-5">
        <div className="w-14 h-14 bg-slate-950 rounded-2xl flex flex-col items-center justify-center border-2 border-slate-800 shadow-inner">
          <span className="text-[9px] font-bold text-slate-500 uppercase">{res.date.split('-')[1]}</span>
          <span className="text-xl font-black text-white leading-none">{res.date.split('-')[2]}</span>
        </div>
        <div>
          <p className="text-xl font-black text-white uppercase tracking-tighter leading-none mb-1">{res.time}</p>
          <div className="flex items-center gap-3 text-[10px] text-slate-500 font-bold uppercase tracking-tight">
            <span className="flex items-center gap-1"><Clock size={12}/> {res.duration}h</span>
            <span className="w-1 h-1 rounded-full bg-slate-700"></span>
            <span className="flex items-center gap-1"><Users size={12}/> {res.peopleCount} Jog.</span>
          </div>
        </div>
      </div>

      {(isRefunded || isPendingRefund) && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl">
          <p className="text-[10px] text-slate-300 leading-relaxed">
            <AlertTriangle size={14} className="text-red-500 inline mr-1 mb-0.5"/> 
            Pagamento fora do prazo. A vaga foi liberada e seu dinheiro <strong>devolvido automaticamente.</strong>
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800">
            <p className="text-[8px] font-bold text-slate-500 uppercase mb-0.5 tracking-widest">Modalidade</p>
            <p className="text-[10px] font-bold text-slate-300 uppercase">{res.eventType}</p>
        </div>
        <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-800 text-right">
            <p className="text-[8px] font-bold text-slate-500 uppercase mb-0.5 tracking-widest">Investimento</p>
            <p className={`text-base font-black ${isRefunded ? 'text-slate-500 line-through' : 'text-neon-green'}`}>
                {res.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
        </div>
      </div>

      {res.status === ReservationStatus.PENDENTE && !isRefunded && !isPendingRefund && (
        <div className="space-y-3">
          {res.createdAt && <PaymentCountdown createdAt={res.createdAt} onExpire={onRefresh} />}
          <button onClick={() => onPay(res)} className="w-full bg-green-600 hover:bg-green-500 text-white font-black py-3.5 rounded-xl uppercase text-[10px] tracking-[0.2em] shadow-xl flex items-center justify-center gap-2 transition active:scale-95">
            <CreditCard size={16}/> EFETUAR PAGAMENTO
          </button>
        </div>
      )}

      {/* Botão discreto de suporte */}
      <div className="pt-2 text-center">
        <a 
          href={finalLink} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-[10px] font-bold text-slate-600 hover:text-slate-400 transition-colors uppercase tracking-widest decoration-slate-800 underline-offset-4 hover:underline"
        >
          Alterar ou cancelar reserva
        </a>
      </div>
    </div>
  );
};
