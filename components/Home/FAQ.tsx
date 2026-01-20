
import React from 'react';
import { Plus } from 'lucide-react';

export const FAQ: React.FC = () => {
  const faqItems = [
    { q: 'Preciso levar sapato especial?', a: 'Não é necessário. Você pode jogar com seu próprio calçado confortável (tênis/sapato fechado recomendado).' },
    { q: 'Crianças podem jogar?', a: 'Sim! O boliche é diversão para todas as idades. Famílias são muito bem-vindas!' },
    { q: 'A reserva é obrigatória?', a: 'Não é obrigatória, mas é fortemente recomendada devido à alta demanda, especialmente em finais de semana.' },
    { q: 'Posso reservar para mais de 1 hora?', a: 'Sim! Você pode reservar quantas horas desejar, de acordo com a disponibilidade.' },
    { q: 'O que acontece se eu não pagar em 30 minutos?', a: 'O pré-agendamento é automaticamente cancelado e a pista volta a ficar disponível para outros clientes.' },
    { q: 'Vocês abrem na segunda-feira?', a: 'Não. Segundas-feiras estamos fechados para manutenção das pistas e equipamentos.' },
    { q: 'Quantas pessoas podem jogar por pista?', a: 'Cada pista comporta no máximo 6 pessoas.' },
    { q: 'Preciso reservar com muita antecedência?', a: 'Recomendamos reservar com antecedência, especialmente para sexta a domingo quando a demanda é maior.' },
    { q: 'Qual o horário de funcionamento?', a: 'Funcionamos de terça a domingo. Segundas-feiras estamos fechados para manutenção.' },
    { q: 'Posso dividir o valor com meus amigos?', a: 'Sim! O valor pode ser dividido entre todos os participantes.' },
    { q: 'Qual a diferença de preço entre os dias?', a: 'Terça a quinta o valor é R$ 99,90 por hora. Sexta a domingo o valor é R$ 140,00 por hora.' }
  ];

  return (
    <section className="py-12 md:py-24 px-4 md:px-6 bg-slate-950/40 scroll-mt-20">
      <div className="max-w-4xl mx-auto space-y-12 md:space-y-16">
          <div className="text-center space-y-2">
              <h2 className="text-3xl md:text-6xl font-black text-white uppercase tracking-tighter leading-none">Dúvidas Frequentes</h2>
              <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[8px] md:text-xs">Tudo o que você precisa saber antes do Strike</p>
              <div className="h-1.5 w-16 bg-neon-orange mx-auto rounded-full mt-4"></div>
          </div>

          <div className="grid grid-cols-1 gap-3">
              {faqItems.map((item, i) => (
                  <details key={i} className="group bg-slate-900 border border-slate-800 rounded-2xl p-5 md:p-6 cursor-pointer hover:border-slate-700 transition-all shadow-lg">
                      <summary className="flex justify-between items-center font-black text-white uppercase tracking-tight text-xs md:text-lg list-none">
                          {item.q}
                          <div className="bg-slate-800 p-1.5 rounded-lg group-open:rotate-45 transition-transform">
                              <Plus size={16} className="text-neon-orange" />
                          </div>
                      </summary>
                      <div className="mt-4 text-slate-500 font-medium leading-relaxed text-xs md:text-base border-t border-slate-800 pt-4 animate-fade-in">
                          {item.a}
                      </div>
                  </details>
              ))}
          </div>
      </div>
    </section>
  );
};
