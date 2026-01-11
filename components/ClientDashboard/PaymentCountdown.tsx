
import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface PaymentCountdownProps {
  createdAt: string;
  onExpire: () => void;
}

export const PaymentCountdown: React.FC<PaymentCountdownProps> = ({ createdAt, onExpire }) => {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const calculateTime = () => {
      const created = new Date(createdAt).getTime();
      const expires = created + 30 * 60 * 1000;
      const now = new Date().getTime();
      const diff = Math.max(0, Math.floor((expires - now) / 1000));
      setTimeLeft(diff);
      if (diff === 0) onExpire();
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, [createdAt, onExpire]);

  if (timeLeft <= 0) return null;

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  return (
    <div className="bg-orange-500/10 border border-orange-500/30 p-3 rounded-xl flex items-center justify-between animate-pulse">
      <div className="flex items-center gap-2 text-orange-500 text-[10px] font-black uppercase tracking-widest">
        <Clock size={14}/> Expira em:
      </div>
      <span className="text-white font-mono font-bold text-sm">{String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}</span>
    </div>
  );
};
