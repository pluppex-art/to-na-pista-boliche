
import React from 'react';
import { Pizza, Beer, Utensils, ArrowRight, Star, Flame, Trophy, Beef } from 'lucide-react';

export const Menu: React.FC = () => {
  const features = [
    {
      title: 'Pizza Tô Na Pista',
      desc: 'Massa artesanal, presunto, mussarela, bacon em cubos, palmito, ervilha fresca, cebola e catupiry.',
      icon: <Pizza className="text-orange-500" size={28} />,
      tag: 'Assinatura',
      price: 'R$ 85,00',
      image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?q=80&w=500&auto=format&fit=crop'
    },
    {
      title: 'Hambúrguer X-Strike',
      desc: 'Pão brioche, burger 120g, provolone, bacon, cebola caramelizada, geléia de abacaxi apimentada e fritas.',
      icon: <Utensils className="text-blue-500" size={28} />,
      tag: 'Mais Pedido',
      price: 'R$ 32,00',
      image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=500&auto=format&fit=crop'
    },
    {
      title: 'Batata Tô Na Pista',
      desc: '400g de batata sequinha com bacon em cubos, catupiry ou cheddar quente e ketchup artesanal.',
      icon: <Trophy className="text-yellow-500" size={28} />,
      tag: 'Especialidade',
      price: 'R$ 40,00',
      image: 'https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?q=80&w=500&auto=format&fit=crop'
    },
    {
      title: 'Carne de Sol c/ Mandioca',
      desc: 'Tiras de carne de sol na manteiga com cebola, acompanha palitos de mandioca frita e farofa.',
      icon: <Beef className="text-red-500" size={28} />,
      tag: 'Regional',
      price: 'R$ 58,00',
      image: 'https://images.unsplash.com/photo-1603360946369-dc9bb6258143?q=80&w=500&auto=format&fit=crop'
    }
  ];

  return (
    <section id="cardapio" className="py-12 md:py-24 px-4 md:px-6 bg-slate-950/40 scroll-mt-20">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16 space-y-4">
          <div className="w-16 h-16 bg-neon-orange/10 rounded-2xl flex items-center justify-center mx-auto mb-6 text-neon-orange border border-neon-orange/20 shadow-inner">
            <Utensils size={32} />
          </div>
          <h2 className="text-3xl md:text-6xl font-black text-white uppercase tracking-tighter leading-none">
            Sabor de <span className="text-neon-orange">Campeão</span>
          </h2>
          <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px] md:text-sm max-w-2xl mx-auto">
            Confira os favoritos do nosso cardápio oficial
          </p>
          <div className="h-1.5 w-20 bg-neon-orange mx-auto rounded-full mt-6"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {features.map((item, i) => (
            <div key={i} className="group bg-slate-900/80 border border-slate-800 rounded-[2rem] overflow-hidden hover:border-neon-orange/40 transition-all shadow-xl flex flex-col">
              <div className="h-48 overflow-hidden relative bg-slate-800">
                <img 
                  src={item.image} 
                  alt={item.title} 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-70 group-hover:opacity-100" 
                  loading="lazy"
                />
                <div className="absolute top-4 left-4">
                  <span className="bg-neon-orange text-white text-[8px] font-black uppercase px-3 py-1 rounded-full shadow-lg flex items-center gap-1">
                    <Flame size={10} fill="currentColor"/> {item.tag}
                  </span>
                </div>
              </div>
              
              <div className="p-6 space-y-3 flex-1 flex flex-col">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-800 rounded-lg border border-slate-700">
                    {item.icon}
                  </div>
                  <h3 className="text-lg font-black text-white uppercase tracking-tight">{item.title}</h3>
                </div>
                <p className="text-xs text-slate-400 font-medium leading-relaxed flex-1">
                  {item.desc}
                </p>
                <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                  <span className="text-[10px] font-black text-neon-green uppercase tracking-widest">{item.price}</span>
                  <Star size={14} className="text-slate-700" fill="currentColor"/>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA CARDAPIO COMPLETO */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-800 p-8 md:p-14 rounded-[3rem] flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-10 opacity-5 -rotate-12 pointer-events-none group-hover:rotate-0 transition-transform duration-1000">
            <Beer size={150} className="hidden md:block text-white" />
          </div>
          
          <div className="space-y-3 relative z-10 text-center md:text-left">
            <h4 className="text-2xl md:text-4xl font-black text-white uppercase tracking-tighter leading-none">
              Cardápio Completo
            </h4>
            <p className="text-slate-500 font-bold uppercase text-[10px] md:text-sm tracking-widest">
              Explore todas as nossas Pizzas, Burgers, Drinques e Porções.
            </p>
          </div>

          <a 
            href="https://drive.google.com/file/d/1E0Ll4HRz8qmoxenrr3R09vv_iPWMwqkG/view" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="w-full md:w-auto bg-white text-black px-10 py-5 rounded-2xl font-black uppercase text-xs tracking-[0.3em] hover:bg-neon-orange hover:text-white transition-all shadow-xl relative z-10 text-center flex items-center justify-center gap-3 group"
          >
            VER MENU DIGITAL <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </a>
        </div>
      </div>
    </section>
  );
};
