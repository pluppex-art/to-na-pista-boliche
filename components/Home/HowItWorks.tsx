
import React from 'react';
import { Target, Clock, Users, CreditCard, Zap, Gamepad2, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const HowItWorks: React.FC = () => {
  const navigate = useNavigate();

  const infoCards = [
    {
      icon: <Target className="text-neon-orange" size={28} />,
      title: 'Reserva Recomendada',
      desc: 'A reserva não é obrigatória, mas devido à alta demanda é fortemente recomendada para garantir sua vaga no horário desejado.'
    },
    {
      icon: <Clock className="text-neon-blue" size={28} />,
      title: 'Reserva por Hora',
      desc: 'Cada reserva tem duração de 1 hora. Você pode contratar pacotes de 2 ou 3 horas consecutivas conforme a disponibilidade.'
    },
    {
      icon: <Users className="text-neon-green" size={28} />,
      title: 'Capacidade da Pista',
      desc: 'Máximo de 6 pessoas por pista. O valor pode ser dividido entre todos os participantes para um custo-benefício imbatível.'
    },
    {
      icon: <CreditCard className="text-purple-500" size={28} />,
      title: 'Confirmação de Pagamento',
      desc: 'A reserva só será confirmada mediante pagamento antecipado através do sistema seguro via PIX ou Cartão.'
    },
    {
      icon: <Zap className="text-yellow-500" size={28} />,
      title: 'Prazo de Pagamento',
      desc: 'O sistema trava sua pista por 30 minutos. Após esse período sem confirmação, o horário é liberado automaticamente para outros clientes.'
    },
    {
      icon: <Gamepad2 className="text-pink-500" size={28} />,
      title: 'Equipamentos Inclusos',
      desc: 'Todos os equipamentos necessários estão disponíveis no local para sua diversão.'
    }
  ];

  const handleReserve = () => {
    if (window.fbq) {
      window.fbq('track', 'Contact', { content_name: 'Info Section CTA' });
    }
    navigate('/agendamento');
  };

  return (
    <section id="como-funciona" className="py-12 md:py-24 px-4 md:px-6 bg-slate-950/20 scroll-mt-20">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16 space-y-4">
          <span className="text-[10px] md:text-xs font-black text-neon-blue uppercase tracking-[0.4em] block mb-2">Garanta sua Pista em Segundos</span>
          <h2 className="text-3xl md:text-6xl font-black text-white uppercase tracking-tighter leading-none">
            O Que Você <span className="text-neon-orange">Precisa Saber</span>
          </h2>
          <div className="h-1.5 w-20 bg-slate-800 mx-auto rounded-full mt-6"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {infoCards.map((card, i) => (
            <div 
              key={i} 
              className="bg-slate-900/50 border border-slate-800 p-8 rounded-[2.5rem] space-y-4 hover:border-slate-700 hover:bg-slate-900 transition-all group shadow-xl flex flex-col"
            >
              <div className="p-4 bg-slate-800 w-fit rounded-2xl border border-slate-700 shadow-inner group-hover:scale-110 transition-transform group-hover:border-slate-600">
                {card.icon}
              </div>
              <h3 className="text-lg md:text-xl font-black text-white uppercase tracking-tight">
                {card.title}
              </h3>
              <p className="text-sm md:text-base text-slate-500 font-medium leading-relaxed flex-1">
                {card.desc}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center gap-6">
          <button 
            onClick={handleReserve}
            className="group relative px-12 py-5 md:py-6 bg-white text-black hover:bg-neon-blue hover:text-white rounded-[2rem] font-black uppercase text-xs md:text-sm tracking-[0.2em] shadow-2xl transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-3"
          >
            ENTENDI, QUERO RESERVAR <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>
          <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest text-center">
            Pague via PIX ou Cartão • Confirmação Instantânea
          </p>
        </div>
      </div>
    </section>
  );
};
