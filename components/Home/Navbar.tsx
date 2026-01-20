
import React from 'react';
import { Link } from 'react-router-dom';
import { Menu as MenuIcon, Users, X } from 'lucide-react';

interface NavbarProps {
  scrolled: boolean;
  settings: any;
  clientUser: any;
  onScrollTo: (id: string) => void;
  onOpenMenu: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ scrolled, settings, clientUser, onScrollTo, onOpenMenu }) => {
  return (
    <nav className={`fixed top-0 w-full z-[100] transition-all duration-500 border-b ${scrolled ? 'bg-neon-surface/95 backdrop-blur-md border-slate-700 py-2 md:py-3 shadow-2xl' : 'bg-transparent border-transparent py-4 md:py-6'}`}>
      <div className="max-w-7xl mx-auto px-4 md:px-6 flex justify-between items-center">
        <div className="flex items-center gap-2">
          {settings.logoUrl ? (
            <img src={settings.logoUrl} className="h-7 md:h-11 w-auto object-contain drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]" alt="Logo Tô Na Pista" />
          ) : (
            <h1 className="text-lg md:text-2xl font-black text-neon-orange tracking-tighter uppercase leading-none">TÔ NA PISTA</h1>
          )}
        </div>

        <div className="hidden lg:flex items-center gap-6">
          <button onClick={() => onScrollTo('hero')} className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-white transition">Início</button>
          <button onClick={() => onScrollTo('experiencias')} className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-white transition">Experiência</button>
          <button onClick={() => onScrollTo('precos')} className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-white transition">Valores</button>
          <button onClick={() => onScrollTo('cardapio')} className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-white transition">Cardápio</button>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          {clientUser ? (
            <Link to="/minha-conta" className="bg-slate-800 text-white px-3 md:px-5 py-2 rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest border border-slate-700 hover:bg-slate-700 transition flex items-center gap-2">
              <Users size={12}/> Minha Conta
            </Link>
          ) : (
            <Link to="/login" className="bg-slate-800 text-white px-3 md:px-5 py-2 rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest border border-slate-700 hover:bg-slate-700 transition">
              Entrar
            </Link>
          )}
          <button onClick={onOpenMenu} className="lg:hidden p-1 text-white" aria-label="Abrir Menu">
            <MenuIcon size={22} />
          </button>
        </div>
      </div>
    </nav>
  );
};
