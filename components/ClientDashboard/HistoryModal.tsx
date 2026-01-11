
import React from 'react';
import { Reservation, ReservationStatus, PaymentStatus } from '../../types';
import { X, History, Star, Clock, Calendar } from 'lucide-react';

interface HistoryModalProps {
  history: Reservation[];
  onClose: () => void;
  onRate: (res: Reservation) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ history, onClose, onRate }) => {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4">
      <div className="bg-slate-800 border border-slate-700 w-full max-w-lg rounded-[2.5rem] flex flex-col max-h-[85vh] shadow-2xl overflow-hidden animate-scale-in">
        <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
            <div className="flex items-center gap-3">
                <History className="text-neon-blue" />
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Histórico Completo</h3>
            </div>
            <button onClick={onClose} className="p-2 text-slate-500 hover:text-white"><X/></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-slate-900/20">
          {history.length === 0 ? (
            <div className="py-20 text-center text-slate-600 font-bold uppercase text-[10px] tracking-widest">Sem registros no momento</div>
          ) : history.map(res => (
            <div key={res.id} className={`bg-slate-900 border rounded-2xl p-4 flex flex-col gap-3 transition ${res.status === ReservationStatus.CANCELADA ? 'border-slate-800 opacity-60' : 'border-slate-700'}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-800 rounded-xl flex flex-col items-center justify-center border border-slate-700">
                            <span className="text-[7px] font-bold text-slate-500 uppercase">{res.date.split('-')[1]}</span>
                            <span className="text-sm font-black text-white leading-none">{res.date.split('-')[2]}</span>
                        </div>
                        <div>
                            <p className="text-xs font-black text-white">{res.time}</p>
                            <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                                res.status === ReservationStatus.CANCELADA ? 'bg-red-900/30 text-red-500' :
                                res.status === ReservationStatus.CHECK_IN ? 'bg-green-600 text-white' :
                                'bg-blue-600 text-white'
                            }`}>
                                {res.paymentStatus === PaymentStatus.REEMBOLSADO ? 'ESTORNADA' : res.status}
                            </span>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className={`text-sm font-black ${res.status === ReservationStatus.CANCELADA ? 'text-slate-500 line-through' : 'text-neon-green'}`}>
                            {res.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </p>
                        {res.status === ReservationStatus.CHECK_IN && !res.rating && (
                            <button onClick={() => onRate(res)} className="text-[8px] font-black text-neon-blue uppercase mt-1 flex items-center gap-1 hover:underline"><Star size={8} fill="currentColor"/> Avaliar Jogo</button>
                        )}
                    </div>
                </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
