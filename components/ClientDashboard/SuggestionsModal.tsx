
import React, { useState } from 'react';
import { X, Send, MessageSquare, Loader2, ThumbsUp } from 'lucide-react';
import { db } from '../../services/mockBackend';

interface SuggestionsModalProps {
  clientId: string;
  onClose: () => void;
}

export const SuggestionsModal: React.FC<SuggestionsModalProps> = ({ clientId, onClose }) => {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
        await db.suggestions.create({ cliente_id: clientId, titulo: title, descricao: desc });
        setSuccess(true);
        setTimeout(onClose, 3000);
    } catch (e) {
        alert("Erro ao enviar.");
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4">
      <div className="bg-slate-800 border border-slate-700 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl animate-scale-in">
        <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-2">
                <MessageSquare className="text-neon-blue" /> Como podemos melhorar?
            </h3>
            <button onClick={onClose} className="text-slate-500 hover:text-white transition"><X/></button>
        </div>

        {success ? (
            <div className="text-center space-y-4 py-6">
                <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto"><ThumbsUp size={32}/></div>
                <h4 className="text-white font-bold">Sugestão Enviada!</h4>
                <p className="text-xs text-slate-400">Obrigado por nos ajudar a melhorar o Tô Na Pista.</p>
            </div>
        ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-1.5 ml-1 tracking-widest">Assunto</label>
                    <input required className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3.5 text-white font-bold outline-none focus:border-neon-blue transition" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Novos sabores de pizza" />
                </div>
                <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-1.5 ml-1 tracking-widest">Sua Mensagem</label>
                    <textarea required className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3.5 text-white text-sm outline-none focus:border-neon-blue transition h-32" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Conte-nos sua ideia..." />
                </div>
                <button type="submit" disabled={loading} className="w-full py-4 bg-neon-blue text-white rounded-xl font-black uppercase text-xs tracking-widest shadow-xl flex items-center justify-center gap-3 transition active:scale-95">
                    {loading ? <Loader2 className="animate-spin" /> : <><Send size={18}/> Enviar</>}
                </button>
            </form>
        )}
      </div>
    </div>
  );
};
