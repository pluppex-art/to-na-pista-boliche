
import React, { useRef, useState, useEffect } from 'react';
import { Zap, ChevronRight, ArrowDown, Star, Volume2, VolumeX } from 'lucide-react';

interface HeroProps {
  onReserve: (label: string) => void;
}

export const Hero: React.FC<HeroProps> = ({ onReserve }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Inicia mutado para garantir compatibilidade total com autoplay
  const [isMuted, setIsMuted] = useState(true);
  
  const [progress, setProgress] = useState(0);
  const [isDesktopView, setIsDesktopView] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);

  // Monitora redimensionamento para alternar entre layouts mobile/desktop
  useEffect(() => {
    const handleResize = () => {
      const isNowDesktop = window.innerWidth >= 1024;
      if (isNowDesktop !== isDesktopView) {
        setIsDesktopView(isNowDesktop);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isDesktopView]);

  // Função para controlar áudio
  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (videoRef.current) {
      videoRef.current.muted = newMuted;
    }
  };

  // Atualiza a barra de progresso baseada no tempo real do vídeo
  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    if (!video.duration || isNaN(video.duration)) return;
    const u = video.currentTime / video.duration; 
    
    // Mapeamento visual para a barra de progresso
    let visualProgress = u <= 0.5 ? u * 1.6 : 0.8 + (u - 0.5) * 0.4;
    setProgress(Math.min(visualProgress * 100, 100));
  };

  // Tenta reproduzir o vídeo após a montagem
  useEffect(() => {
    const attemptPlay = async () => {
      if (videoRef.current) {
        try {
          videoRef.current.muted = true; // Sempre inicia mutado para o autoplay não falhar
          await videoRef.current.play();
        } catch (err) {
          console.warn("Autoplay falhou:", err);
        }
      }
    };
    const timer = setTimeout(attemptPlay, 300);
    return () => clearTimeout(timer);
  }, [isDesktopView]);

  // JSX do Player de Vídeo Centralizado
  const videoElementJSX = (
    <div className="relative w-full h-full group/player animate-fade-in overflow-hidden">
      <video 
        ref={videoRef}
        onTimeUpdate={handleTimeUpdate}
        src="https://rmirkhebjgvsqqenszts.supabase.co/storage/v1/object/public/public-assets/apresentacao.mp4"
        className="w-full h-full object-cover pointer-events-none"
        autoPlay 
        loop
        muted={isMuted}
        playsInline
        preload="auto"
      />
      
      {/* Botão de Som e Indicador Visual */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-3">
        {/* Tooltip Chamativa (Só aparece se estiver mudo) */}
        {isMuted && (
          <div className="animate-bounce bg-neon-orange text-white text-[8px] md:text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-xl shadow-[0_0_15px_rgba(249,115,22,0.6)] border border-white/20 flex items-center gap-2 pointer-events-none">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
            Ativar Som
          </div>
        )}

        <button 
          onClick={toggleMute}
          className="p-3 bg-black/40 backdrop-blur-md rounded-full text-white border border-white/10 hover:bg-black/60 transition-all active:scale-90 shadow-xl"
        >
          {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>

      {/* Barra de Progresso Inferior */}
      <div className="absolute bottom-0 left-0 w-full h-1.5 bg-white/10 overflow-hidden">
         <div 
           className="h-full bg-neon-orange transition-all duration-300 ease-linear shadow-[0_0_15px_#f97316]"
           style={{ width: `${progress}%` }}
         />
      </div>
    </div>
  );

  return (
    <section id="hero" className="relative min-h-screen flex items-center justify-center pt-20 pb-12 px-4 overflow-hidden">
      {/* Camadas de Estética Background */}
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1538356111083-7481997bb019?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-10 md:opacity-20 scale-105"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-neon-bg via-transparent to-neon-bg"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#0f172a_90%)]"></div>

      <div className="relative max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center z-10 w-full">
        
        {/* Lado Esquerdo: Conteúdo Textual */}
        <div className="text-center lg:text-left space-y-6 md:space-y-8 animate-fade-in w-full order-1">
          <div className="flex justify-center lg:justify-start">
            <div className="inline-flex items-center gap-2 bg-neon-orange/10 border border-neon-orange/20 px-4 py-2 rounded-full backdrop-blur-sm shadow-inner">
              <Zap size={14} className="text-neon-orange animate-pulse" />
              <span className="text-[8px] md:text-xs font-black text-neon-orange uppercase tracking-[0.3em]">A noite perfeita começa aqui</span>
            </div>
          </div>

          {/* VÍDEO MOBILE (Condicional por JS para evitar duplicidade de áudio) */}
          {!isDesktopView && (
            <div className="lg:hidden">
              <div className="bg-slate-900 border border-white/10 shadow-2xl overflow-hidden aspect-[9/16] rounded-[2.5rem] w-full max-w-[280px] mx-auto my-6">
                 {videoElementJSX}
              </div>
            </div>
          )}
          
          <div className="space-y-4">
            <h1 className="text-2xl md:text-6xl font-black text-white leading-[1.1] md:leading-[1.05] tracking-tighter uppercase">
              Sua noite perfeita começa <br/> 
              <span className="text-neon-orange drop-shadow-[0_0_15px_rgba(249,115,22,0.4)]">com uma pista reservada</span>
            </h1>
            
            <p className="text-xs md:text-xl text-slate-300 max-w-md md:max-w-xl mx-auto lg:mx-0 font-medium leading-relaxed">
              Reserve sua pista agora e garanta momentos inesquecíveis, ambiente <strong>100% climatizado</strong> e a melhor pizza da capital.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-2 md:pt-4">
            <button 
              onClick={() => onReserve('Hero Primary')} 
              className="group relative px-8 md:px-12 py-5 md:py-6 bg-neon-orange hover:bg-orange-500 text-white rounded-2xl font-black uppercase text-[10px] md:text-sm tracking-[0.2em] shadow-[0_15px_40px_rgba(249,115,22,0.3)] transition-all transform hover:scale-105 active:scale-95 flex items-center justify-center gap-4"
            >
               Ver horários disponíveis agora <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          {/* Prova Social */}
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 md:gap-6 pt-6 md:pt-8 border-t border-slate-800/50">
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {[1,2,3].map(i => (
                  <div key={i} className="w-7 h-7 md:w-8 md:h-8 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center overflow-hidden shadow-lg">
                    <img src={`https://i.pravatar.cc/100?img=${i+25}`} alt="Jogador" />
                  </div>
                ))}
              </div>
              <span className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">+10.000 Jogadores</span>
            </div>
            <div className="h-4 w-px bg-slate-800 hidden sm:block"></div>
            <div className="flex items-center gap-1.5">
              <Star size={14} className="text-yellow-500" fill="currentColor" />
              <span className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">4.8</span>
            </div>
          </div>
        </div>

        {/* VÍDEO DESKTOP (Condicional por JS para evitar duplicidade de áudio) */}
        {isDesktopView && (
          <div className="hidden lg:flex justify-center items-center order-2">
              <div className="bg-slate-900 border border-white/10 shadow-2xl overflow-hidden aspect-[9/16] rounded-[4rem] w-full max-w-md animate-float">
                 {videoElementJSX}
              </div>
          </div>
        )}
      </div>
      
      {/* Indicador de Deslizar */}
      <div className="absolute bottom-6 md:bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-30">
        <span className="text-[7px] md:text-[8px] font-black uppercase tracking-[0.4em] text-slate-500">Deslizar</span>
        <div className="animate-bounce">
          <ArrowDown size={16} className="text-slate-500" />
        </div>
      </div>
    </section>
  );
};
