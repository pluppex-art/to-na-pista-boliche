
import React from 'react';
import { Star, Gift, Info, History } from 'lucide-react';

interface LoyaltySectionProps {
  balance: number;
}

export const LoyaltySection: React.FC<LoyaltySectionProps> = ({ balance }) => {
  return (
    <div className="space-y-6 animate-fade-in">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 rounded-[2.5rem] border border-neon-orange/20 shadow-2xl flex flex-col items-center gap-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-32 h-32 bg-neon-orange/5 rounded-full blur-3xl -ml-16 -mt-16"></div>
            <div className="w-16 h-16 bg-neon-orange/10 rounded-2xl flex items-center justify-center text-neon-orange border border-neon-orange/20 shadow-inner">
                <Star size={32} fill="currentColor" className="animate-pulse"/>
            </div>
            <div className="text-center z-10">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Seu Saldo Fidelidade</p>
                <h3 className="text-6xl font-black text-white tracking-tighter">{balance}</h3>
                <div className="flex items-center gap-1 justify-center mt-2 text-neon-orange/50">
                    <Star size={14} fill="currentColor"/><Star size={14} fill="currentColor"/><Star size={14} fill="currentColor"/><Star size={14} fill="currentColor"/><Star size={14} fill="currentColor"/>
                </div>
            </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Gift size={80} />
            </div>
            <h4 className="text-xs font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                <Info size={16} className="text-neon-blue"/> Em breve!
            </h4>
            <div className="bg-neon-blue/5 border border-neon-blue/20 p-5 rounded-2xl">
                <p className="text-xs text-slate-200 leading-relaxed">
                    Estamos preparando novidades! Em breve você poderá trocar seus pontos por <strong>horas gratuitas, descontos em reservas de pistas</strong> e itens exclusivos da nossa cozinha e bar.
                </p>
                <div className="mt-4 flex items-center gap-2 text-neon-blue text-[10px] font-black uppercase tracking-widest">
                    <History size={14} /> Aguarde as novidades
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 gap-4">
            <div className="flex items-start gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-sm">
                <div className="p-2 bg-green-500/10 text-green-500 rounded-xl"><History size={20}/></div>
                <div>
                    <p className="text-xs font-bold text-white uppercase mb-1">Ganhe Gastando</p>
                    <p className="text-[10px] text-slate-500 font-medium">Cada R$ 1,00 gasto equivale a 1 ponto fidelidade.</p>
                </div>
            </div>
        </div>
    </div>
  );
};
