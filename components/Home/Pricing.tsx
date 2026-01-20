
import React from 'react';
import { AlertTriangle, Calendar, CheckCircle2, Calculator, Clock, CreditCard, Gamepad2, ArrowRight } from 'lucide-react';

interface PricingProps {
  onReserve: (label: string) => void;
}

export const Pricing: React.FC<PricingProps> = ({ onReserve }) => {
  const steps = [
    {
      step: '1',
      icon: <Calendar className="text-neon-orange" size={24} />,
      title: 'Escolha a Data',
      desc: 'Selecione o dia e horário que melhor se encaixa na sua agenda'
    },
    {
      step: '2',
      icon: <CreditCard className="text-neon-blue" size={24} />,
      title: 'Pague Online',
      desc: 'Finalize o pagamento de forma rápida e segura pelo nosso sistema'
    },
    {
      step: '3',
      icon: <Gamepad2 className="text-neon-green" size={24} />,
      title: 'Jogue!',
      desc: 'Chegue no horário reservado e aproveite sua diversão garantida'
    }
  ];

  return (
    <section id="precos" className="py-12 md:py-24 px-4 md:px-6 scroll-mt-20">
      <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 space-y-4">
              <h2 className="text-3xl md:text-6xl font-black text-white uppercase tracking-tighter leading-none">Escolha Seu Dia e Reserve</h2>
              <div className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-1.5 rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest animate-pulse">
                  <AlertTriangle size={14}/> Segundas-feiras: FECHADO
              </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-16">
              {/* TERÇA A QUINTA */}
              <div className="bg-slate-900 border-2 border-slate-800 rounded-[2.5rem] p-8 md:p-12 relative group hover:border-neon-orange transition-all shadow-2xl overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 opacity-5 -rotate-12 group-hover:rotate-0 transition-transform"><Calendar size={120}/></div>
                  <div className="flex justify-between items-start mb-8">
                      <div>
                          <span className="text-neon-orange font-black uppercase text-xs tracking-widest">Terça a Quinta</span>
                          <h3 className="text-2xl md:text-4xl font-black text-white uppercase tracking-tighter mt-2">Dia Útil</h3>
                      </div>
                      <div className="bg-neon-orange/10 text-neon-orange px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-neon-orange/20">Melhor custo-benefício!</div>
                  </div>
                  <div className="space-y-6 mb-10">
                      <div className="flex items-baseline gap-2">
                          <span className="text-4xl md:text-6xl font-black text-white">R$ 99,90</span>
                          <span className="text-slate-500 font-bold uppercase text-xs">/ Hora</span>
                      </div>
                      <ul className="space-y-3 text-slate-400 font-bold uppercase text-[10px] tracking-widest">
                          <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-neon-orange"/> Até 6 pessoas por pista</li>
                          <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-neon-orange"/> Todos os equipamentos inclusos</li>
                          <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-neon-orange"/> Ambiente 100% Climatizado</li>
                      </ul>
                  </div>
                  <button onClick={() => onReserve('Price Weekday')} className="w-full py-5 bg-white text-black hover:bg-neon-orange hover:text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] transition-all shadow-xl">RESERVAR TERÇA A QUINTA</button>
              </div>

              {/* SEXTA A DOMINGO */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-neon-blue rounded-[2.5rem] p-8 md:p-12 relative group shadow-[0_0_60px_rgba(59,130,246,0.15)] overflow-hidden">
                  <div className="flex justify-between items-start mb-8">
                      <div>
                          <span className="text-neon-blue font-black uppercase text-xs tracking-widest">Sexta a Domingo</span>
                          <h3 className="text-2xl md:text-4xl font-black text-white uppercase tracking-tighter mt-2">Fim de Semana</h3>
                      </div>
                  </div>
                  <div className="space-y-6 mb-10">
                      <div className="flex items-baseline gap-2">
                          <span className="text-4xl md:text-6xl font-black text-white">R$ 140,00</span>
                          <span className="text-slate-500 font-bold uppercase text-xs">/ Hora</span>
                      </div>
                      <ul className="space-y-3 text-slate-300 font-bold uppercase text-[10px] tracking-widest">
                          <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-neon-blue"/> Até 6 pessoas por pista</li>
                          <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-neon-blue"/> Todos os equipamentos inclusos</li>
                          <li className="flex items-center gap-2"><CheckCircle2 size={16} className="text-neon-blue"/> Diversão máxima garantida</li>
                      </ul>
                  </div>
                  <button onClick={() => onReserve('Price Weekend')} className="w-full py-5 bg-neon-blue hover:bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] transition-all shadow-xl">RESERVAR FIM DE SEMANA</button>
              </div>
          </div>

          {/* COMO FUNCIONA - 3 PASSOS SIMPLES */}
          <div className="mb-20">
            <div className="text-center mb-10">
                <h3 className="text-2xl md:text-4xl font-black text-white uppercase tracking-tighter mb-2">Reserve em 3 Passos Simples</h3>
                <div className="h-1 w-16 bg-neon-blue mx-auto rounded-full"></div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-4 relative">
                {/* Linha conectora desktop */}
                <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-0.5 bg-slate-800 z-0"></div>
                
                {steps.map((s, i) => (
                    <div key={i} className="relative z-10 flex flex-col items-center text-center group">
                        <div className="w-20 h-20 bg-slate-900 border-4 border-slate-800 rounded-3xl flex items-center justify-center mb-6 group-hover:border-neon-blue transition-colors shadow-2xl relative">
                            <span className="absolute -top-3 -right-3 w-8 h-8 bg-neon-orange text-white rounded-full flex items-center justify-center font-black text-xs shadow-lg">{s.step}</span>
                            {s.icon}
                        </div>
                        <h4 className="text-white font-black uppercase text-sm md:text-lg mb-2 tracking-tight">{s.title}</h4>
                        <p className="text-slate-500 text-xs md:text-sm font-medium leading-relaxed max-w-[200px]">
                            {s.desc}
                        </p>
                    </div>
                ))}
            </div>
          </div>

          {/* INFO BOX: DIVISÃO DE VALORES */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-[2rem] p-6 md:p-10 flex flex-col md:flex-row items-center gap-6 md:gap-10 shadow-inner">
              <div className="w-16 h-16 bg-neon-green/10 rounded-2xl flex items-center justify-center text-neon-green shrink-0 border border-neon-green/20"><Calculator size={32}/></div>
              <div className="space-y-2 flex-1 text-center md:text-left">
                  <h4 className="text-xl font-black text-white uppercase tracking-tight">O valor pode ser dividido entre os participantes!</h4>
                  <p className="text-slate-400 font-medium text-sm md:text-base">Junte a galera e economize no seu strike.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full md:w-auto">
                  <div className="bg-slate-900 p-4 rounded-2xl border border-slate-700">
                      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Terça a Quinta</p>
                      <p className="text-white font-black text-lg">R$ 16,65 <span className="text-[10px] text-neon-green">/ pessoa</span></p>
                  </div>
                  <div className="bg-slate-900 p-4 rounded-2xl border border-slate-700">
                      <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Sexta a Domingo</p>
                      <p className="text-white font-black text-lg">R$ 23,33 <span className="text-[10px] text-neon-blue">/ pessoa</span></p>
                  </div>
              </div>
          </div>
      </div>
    </section>
  );
};
