
import React from 'react';
import { Zap, ChevronRight, ArrowDown, Star, Trophy, Users } from 'lucide-react';

interface HeroProps {
  onReserve: (label: string) => void;
}

export const Hero: React.FC<HeroProps> = ({ onReserve }) => {
  return (
    <section id="hero" className="relative min-h-screen flex items-center justify-center pt-20 pb-12 px-4 overflow-hidden">
      {/* Camada 1: Background Base */}
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1538356111083-7481997bb019?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-10 md:opacity-20 scale-105"></div>
      
      {/* Camada 2: Gradientes de Profundidade */}
      <div className="absolute inset-0 bg-gradient-to-b from-neon-bg via-transparent to-neon-bg"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#0f172a_90%)]"></div>

      {/* Camada 3: Marca d'água de Fundo (Visível em Mobile e Desktop) */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.03] md:opacity-[0.04] pointer-events-none select-none animate-float">
        <svg width="400" height="600" viewBox="0 0 240 320" fill="none" xmlns="http://www.w3.org/2000/svg" className="md:w-[600px] md:h-[800px]">
          <path d="M120 20C100 20 85 35 85 60C85 85 95 100 95 130C95 160 60 210 60 260C60 290 80 300 120 300C160 300 180 290 180 260C180 210 145 160 145 130C145 100 155 85 155 60C155 35 140 20 120 20Z" fill="white" />
        </svg>
      </div>

      {/* Marca d'água "TP" (Somente Desktop para não poluir mobile) */}
      <div className="absolute -right-20 top-1/2 -translate-y-1/2 opacity-[0.02] pointer-events-none select-none hidden lg:block">
        <h2 className="text-[45rem] font-black leading-none text-white tracking-tighter">TP</h2>
      </div>

      {/* Camada 4: Elementos de Brilho (Glows) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 md:w-[500px] md:h-[500px] bg-neon-orange/20 rounded-full blur-[80px] md:blur-[120px] animate-pulse"></div>

      <div className="relative max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center z-10">
        
        {/* CONTEÚDO PRINCIPAL */}
        <div className="text-center lg:text-left space-y-6 md:space-y-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 bg-neon-orange/10 border border-neon-orange/20 px-4 py-2 rounded-full mb-2 mx-auto lg:mx-0 backdrop-blur-sm">
            <Zap size={14} className="text-neon-orange animate-pulse" />
            <span className="text-[8px] md:text-xs font-black text-neon-orange uppercase tracking-[0.3em]">A Melhor diversão em Palmas-TO</span>
          </div>
          
          <div className="space-y-4">
            <h1 className="text-4xl md:text-8xl font-black text-white leading-[1.1] md:leading-[1.05] tracking-tighter uppercase">
              A melhor diversão <br/> 
              <span className="text-neon-orange drop-shadow-[0_0_15px_rgba(249,115,22,0.4)]">de Palmas te espera</span>
            </h1>
            
            <p className="text-xs md:text-xl text-slate-300 max-w-md md:max-w-xl mx-auto lg:mx-0 font-medium leading-relaxed">
              Reserve sua pista agora e garanta momentos inesquecíveis, ambiente <strong>100% climatizado</strong> e a melhor pizzaria da capital.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-2 md:pt-4">
            <button 
              onClick={() => onReserve('Hero Primary')} 
              className="group relative px-8 md:px-12 py-5 md:py-6 bg-neon-orange hover:bg-orange-500 text-white rounded-2xl font-black uppercase text-[10px] md:text-sm tracking-[0.2em] shadow-[0_15px_40px_rgba(249,115,22,0.3)] transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-4"
            >
               RESERVA MINHA PISTA AGORA <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Badges de Prova Social */}
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 md:gap-6 pt-6 md:pt-8 border-t border-slate-800/50">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {[1,2,3].map(i => (
                  <div key={i} className="w-7 h-7 md:w-8 md:h-8 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center overflow-hidden shadow-lg">
                    <img src={`https://i.pravatar.cc/100?img=${i+20}`} alt="Jogador" />
                  </div>
                ))}
              </div>
              <span className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">+10.000 Jogadores</span>
            </div>
            <div className="h-4 w-px bg-slate-800 hidden sm:block"></div>
            <div className="flex items-center gap-1.5">
              <Star size={14} className="text-yellow-500" fill="currentColor" />
              <span className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">4.8 no Google</span>
            </div>
          </div>
        </div>

        {/* LADO DIREITO (DESKTOP) E ELEMENTOS DECORATIVOS (MOBILE) */}
        <div className="relative justify-center items-center flex">
          {/* Elemento que aparece apenas no desktop como bloco */}
          <div className="hidden lg:flex flex-col items-center relative animate-float">
            <div className="bg-slate-900/40 backdrop-blur-md border border-white/10 p-12 rounded-[4rem] shadow-2xl relative">
              <div className="absolute -top-6 -left-6 bg-neon-blue p-5 rounded-3xl shadow-xl shadow-blue-500/30 animate-bounce">
                <Trophy size={32} className="text-white" />
              </div>
              
              <svg width="240" height="320" viewBox="0 0 240 320" fill="none" xmlns="http://www.w3.org/2000/svg" className="drop-shadow-[0_0_30px_rgba(255,255,255,0.3)]">
                <path d="M120 20C100 20 85 35 85 60C85 85 95 100 95 130C95 160 60 210 60 260C60 290 80 300 120 300C160 300 180 290 180 260C180 210 145 160 145 130C145 100 155 85 155 60C155 35 140 20 120 20Z" fill="white" />
                <path d="M88 65H152V75H88V65Z" fill="#EF4444" />
                <path d="M90 85H150V95H90V85Z" fill="#EF4444" />
                <circle cx="180" cy="240" r="55" fill="#f97316" className="animate-pulse" />
                <circle cx="165" cy="225" r="6" fill="#0f172a" />
                <circle cx="182" cy="218" r="6" fill="#0f172a" />
                <circle cx="198" cy="225" r="6" fill="#0f172a" />
              </svg>
            </div>

            <div className="absolute top-1/3 -right-12 bg-slate-800 border border-slate-700 p-4 rounded-2xl shadow-2xl animate-float-delayed flex items-center gap-3">
              <div className="bg-neon-blue/10 p-2 rounded-lg text-neon-blue">
                <Users size={20} />
              </div>
              <div className="pr-2">
                <p className="text-[8px] font-black text-slate-500 uppercase leading-none">Pistas</p>
                <p className="text-[10px] font-black text-white uppercase">Disponíveis</p>
              </div>
            </div>
          </div>

          {/* Versão simplificada flutuante para Mobile */}
          <div className="lg:hidden absolute top-[-10%] right-0 opacity-20 animate-float-delayed">
             <Trophy size={40} className="text-neon-orange" />
          </div>
          <div className="lg:hidden absolute bottom-0 left-[-5%] opacity-20 animate-float">
             <Star size={40} className="text-neon-blue" fill="currentColor" />
          </div>
        </div>
      </div>
      
      {/* Indicador de Scroll */}
      <div className="absolute bottom-6 md:bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-30">
        <span className="text-[7px] md:text-[8px] font-black uppercase tracking-[0.4em] text-slate-500">Deslizar</span>
        <div className="animate-bounce">
          <ArrowDown size={16} className="text-slate-500" />
        </div>
      </div>
    </section>
  );
};
