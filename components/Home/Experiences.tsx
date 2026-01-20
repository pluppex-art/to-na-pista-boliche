
import React from 'react';
import { Cake, Briefcase, Users, Utensils, Info, ArrowRight, Star, ChevronRight } from 'lucide-react';

export const Experiences: React.FC = () => {
  const experiences = [
    {
      title: 'Aniversários e Festas',
      icon: <Cake className="text-pink-500" size={32} />,
      desc: 'O aniversário mais animado de Palmas! Garantimos o suporte para seu bolo e um parabéns inesquecível na pista. Diversão garantida para todas as idades com pacotes que unem boliche e gastronomia.',
      tag: 'O Favorito'
    },
    {
      title: 'Eventos de Empresa',
      icon: <Briefcase className="text-blue-500" size={32} />,
      desc: 'Fortaleça sua equipe com um Happy Hour fora de série. Nosso ambiente climatizado é ideal para networking, dinâmicas de grupo e celebrações corporativas com infraestrutura completa e buffet gourmet.',
      tag: 'Corporativo'
    },
    {
      title: 'Encontros de Família',
      icon: <Users className="text-neon-green" size={32} />,
      desc: 'Fuja da rotina e traga a família para o melhor boliche do Tocantins. Segurança, conforto térmico e um cardápio variado para que seu único trabalho seja fazer o próximo strike.',
      tag: 'Lazer VIP'
    }
  ];

  return (
    <section id="experiencias" className="py-12 md:py-24 px-4 md:px-6 scroll-mt-20">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-3xl md:text-6xl font-black text-white uppercase tracking-tighter leading-tight">
            O Destino Oficial das suas <br className="hidden md:block" /> 
            <span className="text-neon-blue text-glow">Comemorações em Palmas</span>
          </h2>
          <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px] md:text-sm max-w-2xl mx-auto leading-relaxed">
            Pistas modernas, ambiente 100% climatizado e a melhor pizzaria artesanal da capital.
          </p>
          <div className="h-1.5 w-24 bg-neon-blue mx-auto rounded-full mt-6 shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {experiences.map((exp, i) => (
            <div key={i} className="bg-slate-900/50 border border-slate-800 p-8 rounded-[2.5rem] relative overflow-hidden group hover:border-neon-blue/40 transition-all shadow-xl flex flex-col h-full hover:bg-slate-900/80">
              <div className="absolute -top-4 -right-4 w-32 h-32 bg-neon-blue/5 rounded-full blur-3xl group-hover:bg-neon-blue/10 transition-all"></div>
              
              <div className="mb-6 p-4 bg-slate-800 w-fit rounded-2xl border border-slate-700 shadow-inner group-hover:scale-110 transition-transform">
                {exp.icon}
              </div>

              <div className="mb-3">
                <span className="text-[8px] font-black text-neon-blue uppercase tracking-widest bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20 shadow-sm">
                  {exp.tag}
                </span>
              </div>

              <h3 className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter mb-4">
                {exp.title}
              </h3>

              <p className="text-sm md:text-base text-slate-400 font-medium leading-relaxed flex-1">
                {exp.desc}
              </p>
            </div>
          ))}
        </div>

        {/* INFORMATIVO DE REGRAS DE MESA - DESIGN ATUALIZADO CONFORME PRINT */}
        <div className="max-w-2xl mx-auto">
          <div className="bg-[#111827] border border-slate-800 rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative overflow-hidden text-center flex flex-col items-center">
            {/* Ícone de Talher no fundo para textura */}
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none">
              <Utensils size={300} />
            </div>

            {/* Ícone de Informação Laranja */}
            <div className="w-20 h-20 bg-orange-500/10 rounded-[1.8rem] flex items-center justify-center text-neon-orange border border-orange-500/20 shadow-inner mb-8 relative z-10">
              <Info size={40} strokeWidth={2.5} />
            </div>
            
            <p className="text-slate-400 text-sm md:text-lg leading-relaxed mb-10 relative z-10 max-w-md">
              <strong className="text-white font-black">Além das pistas, você pode solicitar a reserva de mesas e cadeiras. 
              Garantimos até <br /> <span className="text-neon-orange font-black">25 cadeiras por reserva padrão</span> para o conforto do seu grupo.
            </p>

            <div className="flex flex-col gap-3 w-full max-w-sm relative z-10">
              <div className="flex items-center gap-3 bg-slate-900/50 border border-slate-800 p-4 rounded-xl text-left transition-colors hover:bg-slate-800/80">
                <ArrowRight size={16} className="text-neon-blue shrink-0" />
                <span className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest">
                  Grupos maiores, solicitar reserve adicionais via Whatsapp.
                </span>
              </div>
              
              <div className="flex items-center gap-3 bg-slate-900/50 border border-slate-800 p-4 rounded-xl text-left transition-colors hover:bg-slate-800/80">
                <ArrowRight size={16} className="text-neon-blue shrink-0" />
                <span className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest">
                  Sujeito à disponibilidade do dia
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
