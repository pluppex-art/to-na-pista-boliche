
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { X, Calendar } from 'lucide-react';

// Importação das Seções Modulares
import { Navbar } from '../components/Home/Navbar';
import { Hero } from '../components/Home/Hero';
import { Pricing } from '../components/Home/Pricing';
import { HowItWorks } from '../components/Home/HowItWorks';
import { FAQ } from '../components/Home/FAQ';
import { Experiences } from '../components/Home/Experiences';
import { Menu } from '../components/Home/Menu';

// Importação de componentes que permanecem internos ou pequenos
import { MapPin, Phone, ArrowRight, MessageCircle, Instagram } from 'lucide-react';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { settings } = useApp();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [clientUser, setClientUser] = useState<any>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    const stored = localStorage.getItem('tonapista_client_auth');
    if (stored) setClientUser(JSON.parse(stored));
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    setIsMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      const offset = 80; 
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;
      window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
    }
  };

  const trackCta = (label: string) => {
    if (window.fbq) {
      window.fbq('track', 'Contact', { content_name: label });
    }
    navigate('/agendamento');
  };

  return (
    <div className="bg-neon-bg min-h-screen font-sans text-slate-200 overflow-x-hidden selection:bg-neon-orange selection:text-white">
      
      <Navbar 
        scrolled={scrolled} 
        settings={settings} 
        clientUser={clientUser} 
        onScrollTo={scrollToSection} 
        onOpenMenu={() => setIsMenuOpen(true)}
      />

      {/* MOBILE MENU */}
      <div className={`fixed inset-0 z-[110] bg-neon-bg transition-all duration-500 flex flex-col p-6 ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex justify-between items-center mb-10">
            <span className="text-sm font-black text-neon-orange uppercase tracking-[0.2em]">MENU PRINCIPAL</span>
            <button onClick={() => setIsMenuOpen(false)} className="p-2 text-slate-400" aria-label="Fechar Menu"><X size={24}/></button>
        </div>
        <div className="flex flex-col gap-6">
            <button onClick={() => scrollToSection('hero')} className="text-2xl font-black uppercase tracking-tighter text-white text-left">Início</button>
            <button onClick={() => scrollToSection('precos')} className="text-2xl font-black uppercase tracking-tighter text-white text-left">Preços</button>
            <button onClick={() => scrollToSection('cardapio')} className="text-2xl font-black uppercase tracking-tighter text-white text-left">Menu</button>
            <button onClick={() => trackCta('Menu Mobile')} className="w-full py-4 bg-neon-orange text-white rounded-2xl font-black uppercase tracking-widest shadow-2xl mt-6 text-xs">RESERVAR AGORA</button>
        </div>
      </div>

      <Hero onReserve={trackCta} />

      <Experiences />

      <HowItWorks />

      <Pricing onReserve={trackCta} />

      <Menu />

      {/* LOCALIZAÇÃO */}
      <section id="localizacao" className="py-12 md:py-24 px-4 md:px-6 scroll-mt-20">
        <div className="max-w-7xl mx-auto">
            <div className="flex flex-col lg:flex-row gap-10 md:gap-20 items-center">
                <div className="lg:w-1/2 space-y-8 order-2 lg:order-1 w-full">
                    <div className="h-[300px] md:h-[500px] w-full bg-slate-900 rounded-[2.5rem] border border-slate-800 shadow-2xl overflow-hidden group">
                        <iframe 
                            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3827.0863071339893!2d-48.33703392393394!3d-10.180637708573215!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x9324cb7beaea9879%3A0x58096cb62b9c45ec!2zVMO0IE5hIFBpc3RhIEJvbGljaGU!5e1!3m2!1spt-BR!2sbr!4v1737344583210!5m2!1spt-BR!2sbr" 
                            width="100%" height="100%" style={{ border: 0 }} allowFullScreen loading="lazy" title="Localização"
                            className="w-full h-full"
                        ></iframe>
                    </div>
                </div>
                <div className="lg:w-1/2 space-y-8 text-center md:text-left order-1 lg:order-2">
                    <div className="space-y-3">
                        <h2 className="text-3xl md:text-7xl font-black text-white uppercase tracking-tighter leading-none">O Ponto de Encontro em <span className="text-neon-orange">Palmas</span></h2>
                        <p className="text-slate-500 font-medium text-sm md:text-xl">Ambiente climatizado no coração da capital.</p>
                    </div>
                    <div className="space-y-4">
                        <div className="flex items-center gap-5 p-5 bg-slate-900/50 border border-slate-800 rounded-[1.5rem] shadow-xl text-left hover:border-neon-orange/30 transition-all">
                            <div className="p-3 bg-neon-orange/10 text-neon-orange rounded-xl"><MapPin size={24}/></div>
                            <div>
                                <p className="text-[8px] text-slate-600 font-black uppercase tracking-widest mb-1">Endereço</p>
                                <p className="text-white font-black uppercase text-xs md:text-lg leading-tight">Av. Juscelino Kubitschek, 103 Norte - Segundo estacionamento - Centro, Palmas - TO</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-5 p-5 bg-slate-900/50 border border-slate-800 rounded-[1.5rem] shadow-xl text-left hover:border-neon-blue/30 transition-all">
                            <div className="p-3 bg-neon-blue/10 text-neon-blue rounded-xl"><Phone size={24}/></div>
                            <div>
                                <p className="text-[8px] text-slate-600 font-black uppercase tracking-widest mb-1">Reservas & Info</p>
                                <p className="text-white font-black uppercase text-xs md:text-lg leading-tight">(63) 99117-8242</p>
                            </div>
                        </div>
                    </div>
                    <a href="https://www.google.com/maps?q=T%C3%B4+Na+Pista+Boliche+-+Av+Juscelino+Kubitschek+103+Norte+-+Segundo+estacionamento+-+Centro,+Palmas+-+TO,+77001-014" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-4 bg-white text-black px-10 py-5 rounded-2xl font-black uppercase text-xs tracking-[0.3em] hover:bg-neon-orange hover:text-white transition-all shadow-xl">
                        ABRIR NO GOOGLE MAPS <ArrowRight size={18}/>
                    </a>
                </div>
            </div>
        </div>
      </section>

      <FAQ />

      {/* FOOTER */}
      <footer className="py-12 md:py-20 px-4 md:px-6 bg-neon-bg border-t border-slate-800">
        <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
                <div className="md:col-span-2 space-y-6 text-center md:text-left">
                    <h4 className="text-2xl md:text-4xl font-black text-neon-orange uppercase tracking-tighter leading-none">TÔ NA PISTA</h4>
                    <p className="text-slate-600 font-medium max-w-sm mx-auto md:mx-0 text-xs md:text-sm leading-relaxed">A maior referência em entretenimento e gastronomia no melhor boliche do Tocantins. Ambiente modernizado, familiar e 100% climatizado.</p>
                </div>
                <div className="space-y-4 text-center md:text-left">
                    <h5 className="text-white font-black uppercase text-[8px] md:text-[10px] tracking-[0.4em]">Explorar</h5>
                    <div className="flex flex-col gap-2">
                        <button onClick={() => scrollToSection('hero')} className="text-slate-600 hover:text-white transition text-xs font-bold uppercase tracking-widest">Início</button>
                        <button onClick={() => scrollToSection('precos')} className="text-slate-600 hover:text-white transition text-xs font-bold uppercase tracking-widest">Tarifas</button>
                        <button onClick={() => scrollToSection('cardapio')} className="text-slate-600 hover:text-white transition text-xs font-bold uppercase tracking-widest">Cardápio</button>
                    </div>
                </div>
                <div className="space-y-4 text-center md:text-left">
                    <h5 className="text-white font-black uppercase text-[8px] md:text-[10px] tracking-[0.4em]">Siga-nos</h5>
                    <div className="flex justify-center md:justify-start gap-4">
                        <a href="https://instagram.com/tonapistaboliche63" target="_blank" className="p-3.5 bg-slate-800 rounded-xl text-slate-500 hover:text-neon-orange transition-all"><Instagram size={20}/></a>
                        <a href="https://wa.me/5563991178242" target="_blank" className="p-3.5 bg-slate-800 rounded-xl text-slate-500 hover:text-green-500 transition-all"><MessageCircle size={20}/></a>
                    </div>
                </div>
            </div>
            <div className="pt-8 border-t border-slate-800/50 flex flex-col md:flex-row justify-between items-center gap-4 text-[8px] md:text-[10px] font-black text-slate-700 uppercase tracking-[0.3em] text-center">
                <p>© 2026 TÔ NA PISTA BOLICHE - PALMAS-TO</p>
                <p>O melhor lazer do Tocantins.</p>
            </div>
        </div>
      </footer>

      {/* FLOATING CTA BUTTON MOBILE */}
      <div className="fixed bottom-8 right-8 lg:hidden z-[90]">
        <button onClick={() => trackCta('Floating CTA')} className="w-14 h-14 bg-neon-orange text-white rounded-full shadow-[0_15px_35px_rgba(249,115,22,0.4)] flex items-center justify-center animate-pulse" aria-label="Reservar agora">
            <Calendar size={24}/>
        </button>
      </div>

    </div>
  );
};

export default Home;
