
import React from 'react';
import { Reservation, ReservationStatus, PaymentStatus } from '../../types';
import { 
  X, Info, CalendarPlus, Pencil, Layout, User as UserIcon, 
  MessageCircle, Monitor, DollarSign, Hash, FileText, 
  Clock, CheckCircle, Ban, Globe, CreditCard
} from 'lucide-react';

interface InfoModalProps {
  res: Reservation;
  phone: string;
  canEdit: boolean;
  canCreate: boolean;
  staffName?: string;
  onClose: () => void;
  onEdit: () => void;
  onNewBooking: () => void;
  onStatusChange: (status: ReservationStatus) => void;
  onCancel: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ 
  res, phone, canEdit, canCreate, staffName, onClose, onEdit, onNewBooking, onStatusChange, onCancel 
}) => {
  const openWhatsApp = () => {
    if(!phone) return;
    window.open(`https://wa.me/55${phone.replace(/\D/g, '')}`, '_blank');
  };

  const isFromStaff = !!res.createdBy;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl p-2 md:p-4 overflow-y-auto">
      <div className="bg-slate-800 border border-slate-600 w-full max-w-4xl rounded-[1.5rem] md:rounded-[2.5rem] shadow-2xl animate-scale-in flex flex-col my-auto overflow-hidden">
        
        {/* Header */}
        <div className="p-4 md:p-8 border-b border-slate-700 flex justify-between items-start bg-slate-900/50 sticky top-0 z-10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-neon-blue/10 rounded-xl flex items-center justify-center text-neon-blue border border-neon-blue/30 shadow-inner flex-shrink-0"><Info size={24}/></div>
            <div>
              <h3 className="text-xl md:text-2xl font-black text-white tracking-tight uppercase leading-tight">{res.clientName}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Reserva #{res.id.slice(0,8)}</span>
                <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase ${res.status === ReservationStatus.CONFIRMADA ? 'bg-green-600 text-white' : 'bg-yellow-500 text-black'}`}>{res.status}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canCreate && (
              <button onClick={onNewBooking} className="flex items-center gap-2 bg-neon-orange hover:bg-orange-600 text-white px-4 py-2 rounded-xl font-bold transition shadow-lg text-[10px] uppercase tracking-widest"><CalendarPlus size={16}/> Nova Reserva</button>
            )}
            {canEdit && (
              <button onClick={onEdit} className="p-3 rounded-xl border border-slate-700 text-slate-400 hover:text-white bg-slate-800 transition-all"><Pencil size={20}/></button>
            )}
            <button onClick={onClose} className="text-slate-400 hover:text-white p-3 bg-slate-800 rounded-xl border border-slate-700"><X size={24}/></button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 bg-slate-800 custom-scrollbar">
          <div className="bg-slate-900/40 p-6 rounded-3xl border border-slate-700 shadow-inner">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><Layout size={14}/> Logística da Reserva</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/50"><p className="text-[7px] text-slate-500 font-bold uppercase mb-1">Data</p><p className="text-white font-bold text-sm">{res.date.split('-').reverse().join('/')}</p></div>
              <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/50"><p className="text-[7px] text-slate-500 font-bold uppercase mb-1">Horário</p><p className="text-neon-blue text-lg font-black">{res.time}</p></div>
              <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/50"><p className="text-[7px] text-slate-500 font-bold uppercase mb-1">Duração</p><p className="text-white font-bold text-sm">{res.duration} Horas</p></div>
              <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/50"><p className="text-[7px] text-slate-500 font-bold uppercase mb-1">Recursos</p><p className="text-white font-bold text-xs uppercase">{res.laneCount} Pistas • {res.peopleCount} Jog.</p></div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-900/40 p-6 rounded-3xl border border-slate-700 shadow-inner">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><UserIcon size={14}/> Identificação e Contato</h4>
              <div className="flex items-center justify-between bg-slate-800 p-4 rounded-2xl border border-slate-700">
                <div className="flex flex-col">
                  <span className="text-[7px] text-slate-500 font-bold uppercase mb-0.5">WhatsApp</span>
                  <span className="text-white font-mono font-bold text-sm">{phone || '---'}</span>
                </div>
                {phone && <button onClick={openWhatsApp} className="p-3 bg-green-600/20 text-green-500 hover:bg-green-600 hover:text-white rounded-xl transition-all"><MessageCircle size={20}/></button>}
              </div>
            </div>
            <div className="bg-slate-900/40 p-6 rounded-3xl border border-slate-700 shadow-inner">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><Monitor size={14}/> Canal de Origem</h4>
              <div className={`flex items-center gap-4 bg-slate-800 p-4 rounded-2xl border ${isFromStaff ? 'border-purple-500/30' : 'border-blue-500/30'}`}>
                <div className={`p-2 rounded-lg ${isFromStaff ? 'bg-purple-900/20 text-purple-400' : 'bg-blue-900/20 text-blue-400'}`}>
                  {isFromStaff ? <UserIcon size={20}/> : <Globe size={20}/>}
                </div>
                <div className="flex flex-col">
                  <span className="text-[7px] text-slate-500 font-bold uppercase mb-0.5">Origem da Reserva</span>
                  <span className={`font-black text-[10px] uppercase ${isFromStaff ? 'text-purple-400' : 'text-blue-400'}`}>
                    {isFromStaff ? `EQUIPE: ${staffName || 'NÃO IDENTIFICADO'}` : 'RESERVA ONLINE (SITE)'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/40 p-6 rounded-3xl border border-slate-700 shadow-inner">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><DollarSign size={14}/> Financeiro e Pagamento</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/50"><p className="text-[7px] text-slate-500 font-bold uppercase mb-1">Valor</p><p className="text-neon-green text-xl font-black">{res.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p></div>
              <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/50"><p className="text-[7px] text-slate-500 font-bold uppercase mb-1">Status Pagamento</p><span className={`text-[8px] font-black uppercase px-2 py-1 rounded w-fit inline-block ${res.paymentStatus === PaymentStatus.PAGO ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>{res.paymentStatus}</span></div>
              <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/50"><p className="text-[7px] text-slate-500 font-bold uppercase mb-1">Forma</p><p className="text-white font-black text-[11px] uppercase flex items-center gap-2"><CreditCard size={14} className="text-slate-500"/> {res.paymentMethod || 'PENDENTE'}</p></div>
              <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/50"><p className="text-[7px] text-slate-500 font-bold uppercase mb-1">Comanda</p><p className="text-white font-black text-sm uppercase flex items-center gap-2"><Hash size={14} className="text-slate-500"/> {res.comandaId || 'Sem Comanda'}</p></div>
            </div>
          </div>

          <div className="bg-slate-900/40 p-6 rounded-3xl border border-slate-700 shadow-inner">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><FileText size={14}/> Observações Internas</h4>
            <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/50 min-h-[60px]"><p className="text-slate-200 text-sm italic">{res.observations || 'Nenhuma observação técnica.'}</p></div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 md:p-8 bg-slate-900 border-t border-slate-700 sticky bottom-0 z-10">
          <div className="flex flex-col gap-4">
            <button onClick={() => onStatusChange(ReservationStatus.CONFIRMADA)} className="w-full py-5 bg-green-600 hover:bg-green-500 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl flex items-center justify-center gap-3 transition-all active:scale-95 group">
              <CheckCircle size={20} className="group-hover:scale-110 transition-transform" /> Confirmar Reserva e Vaga
            </button>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => onStatusChange(ReservationStatus.PENDENTE)} className="py-4 bg-slate-800 border border-slate-700 text-slate-400 hover:text-white rounded-2xl font-black uppercase text-xs tracking-widest transition-all flex items-center justify-center gap-2"><Clock size={16}/> Pendente</button>
              <button onClick={onCancel} className="py-4 bg-red-600/10 border border-red-500/20 text-red-500 hover:bg-red-600 hover:text-white rounded-2xl font-black uppercase text-xs tracking-widest transition-all flex items-center justify-center gap-2"><Ban size={16}/> Cancelar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
