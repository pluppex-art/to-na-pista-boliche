
import React, { useEffect, useState } from 'react';
import { db } from '../services/mockBackend';
import { FunnelCard, FunnelStage } from '../types';
import { FUNNEL_STAGES } from '../constants';
import { Plus, GripVertical, Loader2 } from 'lucide-react';

const Funnel: React.FC = () => {
  const [cards, setCards] = useState<FunnelCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
        setLoading(true);
        const data = await db.funnel.getAll();
        setCards(data);
        setLoading(false);
    };
    fetch();
  }, []);

  const getCardsByStage = (stage: FunnelStage) => cards.filter(c => c.stage === stage);

  const handleDragStart = (e: React.DragEvent, cardId: string) => {
    e.dataTransfer.setData('cardId', cardId);
  };

  const handleDrop = async (e: React.DragEvent, stage: FunnelStage) => {
    e.preventDefault();
    const cardId = e.dataTransfer.getData('cardId');
    const updatedCards = cards.map(c => {
      if (c.id === cardId) return { ...c, stage };
      return c;
    });
    setCards(updatedCards); // Optimistic UI
    await db.funnel.update(updatedCards);
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Funil de Prospecção</h1>
        <button className="bg-neon-orange hover:bg-orange-500 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 shadow-lg shadow-orange-500/20">
          <Plus size={18} /> Novo Card
        </button>
      </div>

      {loading ? (
          <div className="flex justify-center items-center flex-1">
              <Loader2 className="animate-spin text-neon-blue" size={48} />
          </div>
      ) : (
        <div className="flex-1 overflow-x-auto">
            <div className="flex gap-4 h-full min-w-[1200px] pb-4">
            {FUNNEL_STAGES.map((stage) => (
                <div 
                key={stage} 
                className="flex-1 min-w-[280px] bg-slate-800/50 rounded-xl border border-slate-700 flex flex-col"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage)}
                >
                {/* Column Header */}
                <div className="p-4 border-b border-slate-700 font-bold text-slate-300 flex justify-between items-center sticky top-0 bg-slate-800 rounded-t-xl z-10">
                    <span>{stage}</span>
                    <span className="bg-slate-700 text-xs px-2 py-1 rounded-full text-slate-400">
                    {getCardsByStage(stage).length}
                    </span>
                </div>

                {/* Column Content */}
                <div className="p-3 space-y-3 flex-1 overflow-y-auto">
                    {getCardsByStage(stage).map(card => (
                    <div
                        key={card.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, card.id)}
                        className="bg-slate-700 p-4 rounded-lg shadow-sm border border-slate-600 cursor-grab active:cursor-grabbing hover:border-neon-blue hover:shadow-md transition group relative"
                    >
                        <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-white">{card.clientName}</h4>
                        <GripVertical className="text-slate-500 opacity-0 group-hover:opacity-100 transition" size={16} />
                        </div>
                        <div className="text-xs text-slate-300 mb-2 bg-slate-800 inline-block px-2 py-1 rounded">
                        {card.eventType}
                        </div>
                        {card.desiredDate && (
                        <p className="text-xs text-slate-400 flex items-center gap-1">
                            📅 {new Date(card.desiredDate).toLocaleDateString('pt-BR')}
                        </p>
                        )}
                        {card.notes && (
                        <p className="text-xs text-slate-500 mt-2 border-t border-slate-600 pt-2 line-clamp-2">
                            "{card.notes}"
                        </p>
                        )}
                    </div>
                    ))}
                </div>
                </div>
            ))}
            </div>
        </div>
      )}
    </div>
  );
};

export default Funnel;
