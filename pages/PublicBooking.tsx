
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db } from '../services/mockBackend';
import { EventType, AppSettings, ReservationStatus, Guest, User } from '../types';
import { EVENT_TYPES, INITIAL_SETTINGS } from '../constants';
import { CheckCircle, Calendar as CalendarIcon, Clock, Users, ChevronRight, DollarSign, ChevronLeft, Lock, LayoutDashboard, Loader2 } from 'lucide-react';

const steps = ['Data', 'Horário', 'Dados', 'Resumo'];
const PRICE_PER_LANE_HOUR = 140;

const PublicBooking: React.FC = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [settings, setSettings] = useState<AppSettings>(INITIAL_SETTINGS);
  const [imgError, setImgError] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [existingReservations, setExistingReservations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form State
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    whatsapp: '',
    email: '',
    people: 6, 
    lanes: 1,
    duration: 1,
    type: EventType.JOGO_NORMAL,
    obs: '',
    optIn: true,
    guests: Array(5).fill({ name: '', phone: '' }) as Guest[]
  });

  // Calendar View State
  const [viewDate, setViewDate] = useState(new Date());

  useEffect(() => {
    const fetchData = async () => {
        setIsLoading(true);
        const s = await db.settings.get();
        setSettings(s);
        
        // Fetch reservations to calculate availability
        const all = await db.reservations.getAll();
        setExistingReservations(all);

        const storedUser = localStorage.getItem('tonapista_auth');
        if (storedUser) {
            try { setCurrentUser(JSON.parse(storedUser)); } catch (e) {}
        }
        setIsLoading(false);
    };
    fetchData();
  }, []);

  const handleNext = () => {
    if (currentStep < steps.length - 1) setCurrentStep(c => c + 1);
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(c => c - 1);
  };

  // --- Step 1: Calendar Logic ---
  const isDateAllowed = (date: Date) => {
    const day = date.getDay();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Disable past dates
    if (date < today) return false;
    
    // Closed on Mondays (1)
    if (day === 1) return false;
    
    return true;
  };

  const handleMonthChange = (offset: number) => {
    const newDate = new Date(viewDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setViewDate(newDate);
  };

  const renderCalendar = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sunday
    
    const days = [];
    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    // Header
    const header = (
      <div className="grid grid-cols-7 mb-2">
        {weekDays.map(d => (
          <div key={d} className="text-center text-sm font-bold text-slate-500 py-2">
            {d}
          </div>
        ))}
      </div>
    );

    // Empty slots
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="p-2"></div>);
    }

    // Days
    for (let d = 1; d <= daysInMonth; d++) {
      // Explicit local date construction
      const date = new Date(year, month, d);
      
      const dateStr = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0')
      ].join('-');

      const allowed = isDateAllowed(date);
      const isSelected = selectedDate === dateStr;

      days.push(
        <button
          key={d}
          disabled={!allowed}
          onClick={() => setSelectedDate(dateStr)}
          className={`
            h-12 rounded-lg flex items-center justify-center font-medium transition-all relative
            ${isSelected 
              ? 'bg-neon-orange text-white shadow-[0_0_10px_rgba(249,115,22,0.5)] z-10 scale-110' 
              : allowed 
                ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700' 
                : 'bg-slate-900/50 text-slate-600 cursor-not-allowed opacity-50'}
          `}
        >
          {d}
          {allowed && !isSelected && <span className="absolute bottom-1 w-1 h-1 bg-neon-blue rounded-full opacity-50"></span>}
        </button>
      );
    }

    return (
      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 max-w-md mx-auto">
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => handleMonthChange(-1)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white">
            <ChevronLeft size={20} />
          </button>
          <h3 className="text-lg font-bold text-white capitalize">
            {viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </h3>
          <button onClick={() => handleMonthChange(1)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white">
            <ChevronRight size={20} />
          </button>
        </div>
        {header}
        <div className="grid grid-cols-7 gap-2">
          {days}
        </div>
        <div className="mt-4 flex justify-center items-center gap-4 text-xs text-slate-500">
           <div className="flex items-center gap-1"><div className="w-3 h-3 bg-slate-800 border border-slate-700 rounded"></div> Disponível</div>
           <div className="flex items-center gap-1"><div className="w-3 h-3 bg-neon-orange rounded"></div> Selecionado</div>
           <div className="flex items-center gap-1"><div className="w-3 h-3 bg-slate-900 opacity-50 rounded"></div> Indisponível</div>
        </div>
      </div>
    );
  };

  // --- Step 2: Time Logic ---
  const checkAvailability = (timeStr: string) => {
    if (!selectedDate) return false;

    const slotDate = new Date(`${selectedDate}T${timeStr}:00`);
    const now = new Date();
    if (slotDate < now) {
      return false;
    }

    const slotHour = parseInt(timeStr.split(':')[0]);
    let occupiedLanes = 0;

    const dayReservations = existingReservations.filter(r => 
      r.date === selectedDate && r.status !== ReservationStatus.CANCELADA
    );

    dayReservations.forEach(r => {
      const startH = parseInt(r.time.split(':')[0]);
      const endH = startH + r.duration;
      
      if (slotHour >= startH && slotHour < endH) {
        occupiedLanes += r.laneCount;
      }
    });

    // Check if adding the NEW requested lanes would exceed limit
    return (occupiedLanes + formData.lanes) <= settings.activeLanes;
  };

  const generateTimeSlots = () => {
    if (!selectedDate) return [];
    // Parsing manually to ensure we get the correct day of week
    const [y, m, d] = selectedDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const day = date.getDay();
    const isWeekend = day === 0 || day === 6;

    let start = isWeekend ? settings.weekendStart : settings.weekDayStart;
    let end = isWeekend ? settings.weekendEnd : settings.weekDayEnd;

    if (end === 0) end = 24; 
    if (start >= end) { start = 18; end = 24; } 

    const slots = [];
    for (let h = start; h < end; h++) {
      const time = `${h}:00`;
      const available = checkAvailability(time);
      slots.push({ time, available });
    }
    return slots;
  };

  // --- Step 3: Guest Handling ---
  const handlePeopleChange = (num: number) => {
    const suggestedLanes = Math.ceil(num / 6);
    
    let currentGuests = [...formData.guests];
    const neededGuests = Math.max(0, num - 1); 

    if (currentGuests.length < neededGuests) {
        const toAdd = neededGuests - currentGuests.length;
        for(let i=0; i<toAdd; i++) currentGuests.push({name: '', phone: ''});
    } else if (currentGuests.length > neededGuests) {
        currentGuests = currentGuests.slice(0, neededGuests);
    }

    setFormData(prev => ({ 
        ...prev, 
        people: num, 
        lanes: suggestedLanes,
        guests: currentGuests
    }));
  };

  const updateGuest = (index: number, field: 'name' | 'phone', value: string) => {
      const newGuests = [...formData.guests];
      newGuests[index] = { ...newGuests[index], [field]: value };
      setFormData(prev => ({ ...prev, guests: newGuests }));
  };

  const hasAtLeastOneGuest = () => {
      if (formData.people <= 1) return true;
      return formData.guests.some(g => g.name.trim().length > 0);
  };

  // --- Calculation ---
  const totalValue = PRICE_PER_LANE_HOUR * formData.lanes * formData.duration;

  // --- Navigation to Checkout ---
  const handleProceedToCheckout = () => {
    const reservationData = {
      ...formData,
      date: selectedDate,
      time: selectedTime,
      totalValue
    };
    
    navigate('/checkout', { state: reservationData });
  };

  // Format date for display
  const formattedDateDisplay = selectedDate ? selectedDate.split('-').reverse().join('/') : '';

  if (isLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-neon-orange" size={48} /></div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 p-4 shadow-md border-b border-slate-800 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          {!imgError ? (
             <img 
               src="/logo.png" 
               alt="Tô Na Pista" 
               className="h-12 md:h-16 object-contain" 
               onError={() => setImgError(true)}
             />
           ) : (
             <div className="flex flex-col">
               <h1 className="text-2xl font-bold text-neon-orange font-sans tracking-tighter leading-none">TÔ NA PISTA</h1>
             </div>
           )}
          
          <div className="flex items-center gap-4">
            <div className="hidden md:block text-xs font-medium px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400">
              Agendamento Online
            </div>
            {currentUser ? (
              <Link to="/dashboard" className="flex items-center gap-2 text-neon-blue hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-lg transition font-medium text-sm border border-slate-700">
                <LayoutDashboard size={16} />
                <span className="hidden md:inline">Voltar ao Dashboard</span>
              </Link>
            ) : (
              <Link to="/login" className="text-slate-600 hover:text-neon-blue transition p-2 rounded-full hover:bg-slate-800" title="Área da Equipe">
                <Lock size={18} />
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex justify-between mb-2">
              {steps.map((step, i) => (
                <div key={i} className={`text-sm font-medium ${i <= currentStep ? 'text-neon-blue' : 'text-slate-600'}`}>
                  {step}
                </div>
              ))}
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-neon-orange to-neon-blue transition-all duration-500 ease-out"
                style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              ></div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 md:p-8 shadow-lg min-h-[400px]">
            
            {/* STEP 1: DATE */}
            {currentStep === 0 && (
              <div className="animate-fade-in">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                  <CalendarIcon className="text-neon-orange" /> Escolha a Data
                </h2>
                
                {renderCalendar()}

                <div className="mt-8 flex justify-between items-center">
                   <div className="text-slate-400">
                     {selectedDate 
                       ? `Data escolhida: ${formattedDateDisplay}` 
                       : 'Selecione uma data no calendário'}
                   </div>
                   <button 
                    disabled={!selectedDate}
                    onClick={handleNext}
                    className="px-8 py-3 bg-neon-blue text-white font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-400 transition shadow-lg shadow-blue-500/20"
                   >
                     Próximo
                   </button>
                </div>
              </div>
            )}

            {/* STEP 2: TIME */}
            {currentStep === 1 && (
              <div className="animate-fade-in">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                  <Clock className="text-neon-orange" /> Escolha o Horário
                </h2>
                <p className="text-slate-400 mb-4">Data selecionada: {formattedDateDisplay}</p>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
                  {generateTimeSlots().map(({ time, available }) => (
                    <button
                      key={time}
                      disabled={!available}
                      onClick={() => setSelectedTime(time)}
                      className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center justify-center relative overflow-hidden ${
                        !available
                          ? 'border-slate-800 bg-slate-900/50 text-slate-600 cursor-not-allowed opacity-60'
                          : selectedTime === time
                            ? 'border-neon-blue bg-neon-blue/10 text-white shadow-[0_0_10px_rgba(59,130,246,0.3)]' 
                            : 'border-slate-700 bg-slate-800 hover:border-slate-500 text-slate-300'
                      }`}
                    >
                      <div className="text-xl font-bold">{time}</div>
                      {!available && <span className="text-[10px] uppercase mt-1 text-red-500/70 font-bold">Indisponível</span>}
                      {available && selectedTime !== time && <span className="text-[10px] mt-1 text-green-500/50">Livre</span>}
                    </button>
                  ))}
                </div>
                 <div className="mt-8 flex justify-between">
                   <button onClick={handleBack} className="text-slate-400 hover:text-white font-medium">Voltar</button>
                   <button 
                    disabled={!selectedTime}
                    onClick={handleNext}
                    className="px-8 py-3 bg-neon-blue text-white font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-400 transition"
                   >
                     Próximo
                   </button>
                </div>
              </div>
            )}

            {/* STEP 3: DETAILS */}
            {currentStep === 2 && (
              <div className="animate-fade-in space-y-6">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                  <Users className="text-neon-orange" /> Seus Dados
                </h2>
                
                {/* Configuration Section */}
                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                    <h3 className="text-sm font-bold text-slate-300 uppercase mb-3">Detalhes do Evento</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Nº Pessoas</label>
                            <input 
                            type="number"
                            min={1}
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 focus:border-neon-orange focus:outline-none text-white"
                            value={formData.people}
                            onChange={e => handlePeopleChange(parseInt(e.target.value) || 1)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Nº Pistas</label>
                            <input 
                            type="number"
                            min={1}
                            max={settings.activeLanes}
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 focus:border-neon-orange focus:outline-none text-white"
                            value={formData.lanes}
                            onChange={e => setFormData({...formData, lanes: parseInt(e.target.value) || 1})}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Duração (Horas)</label>
                            <select 
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 focus:border-neon-orange focus:outline-none text-white"
                            value={formData.duration}
                            onChange={e => setFormData({...formData, duration: parseInt(e.target.value)})}
                            >
                            {[1,2,3,4,5,6].map(h => <option key={h} value={h}>{h}h</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Tipo</label>
                            <select 
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 focus:border-neon-orange focus:outline-none text-white"
                            value={formData.type}
                            onChange={e => setFormData({...formData, type: e.target.value as EventType})}
                            >
                            {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Main Contact */}
                <div>
                    <h3 className="text-sm font-bold text-slate-300 uppercase mb-3 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-neon-blue text-white flex items-center justify-center text-xs">1</span> 
                        Responsável (Obrigatório)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Nome Completo</label>
                            <input 
                            type="text"
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 focus:border-neon-orange focus:outline-none text-white"
                            value={formData.name}
                            onChange={e => setFormData({...formData, name: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">WhatsApp</label>
                            <input 
                            type="tel"
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 focus:border-neon-orange focus:outline-none text-white"
                            value={formData.whatsapp}
                            placeholder="(00) 00000-0000"
                            onChange={e => setFormData({...formData, whatsapp: e.target.value})}
                            />
                        </div>
                    </div>
                </div>

                {/* Guests */}
                {formData.guests.length > 0 && (
                    <div className="pt-4 border-t border-slate-800">
                        <h3 className="text-sm font-bold text-slate-300 uppercase mb-3">Lista de Convidados / Jogadores (Obrigatório ao menos 1)</h3>
                        <div className="space-y-4">
                            {formData.guests.map((guest, index) => (
                                <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-500 w-6 text-center">{index + 2}</span>
                                        <input 
                                            type="text"
                                            placeholder="Nome do convidado"
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 focus:border-neon-orange focus:outline-none text-white text-sm"
                                            value={guest.name}
                                            onChange={e => updateGuest(index, 'name', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <input 
                                            type="tel"
                                            placeholder="Telefone (Opcional)"
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 focus:border-neon-orange focus:outline-none text-white text-sm"
                                            value={guest.phone}
                                            onChange={e => updateGuest(index, 'phone', e.target.value)}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Observações</label>
                    <textarea 
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 focus:border-neon-orange focus:outline-none h-20 text-white"
                      value={formData.obs}
                      onChange={e => setFormData({...formData, obs: e.target.value})}
                    />
                </div>

                 <div className="mt-8 flex justify-between items-center">
                   <button onClick={handleBack} className="text-slate-400 hover:text-white font-medium">Voltar</button>
                   <div className="flex flex-col items-end gap-2">
                     {!hasAtLeastOneGuest() && (
                       <span className="text-xs text-red-400">Preencha ao menos 1 nome de convidado</span>
                     )}
                     <button 
                      disabled={!formData.name || !formData.whatsapp || !hasAtLeastOneGuest()}
                      onClick={handleNext}
                      className="px-8 py-3 bg-neon-blue text-white font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-400 transition"
                     >
                       Próximo
                     </button>
                   </div>
                </div>
              </div>
            )}

            {/* STEP 4: SUMMARY */}
            {currentStep === 3 && (
              <div className="animate-fade-in">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                  <CheckCircle className="text-neon-green" /> Resumo da Reserva
                </h2>

                <div className="bg-slate-800/50 rounded-xl p-6 space-y-4 border border-slate-700">
                  <div className="flex justify-between border-b border-slate-700 pb-2">
                     <span className="text-slate-400">Cliente</span>
                     <span className="font-bold text-white">{formData.name}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-700 pb-2">
                     <span className="text-slate-400">Contato</span>
                     <span className="font-bold text-white">{formData.whatsapp}</span>
                  </div>
                  {formData.guests.some(g => g.name) && (
                     <div className="flex justify-between border-b border-slate-700 pb-2">
                        <span className="text-slate-400">Convidados Extras</span>
                        <span className="font-bold text-white">{formData.guests.filter(g => g.name).length} nomes listados</span>
                     </div>
                  )}
                  <div className="flex justify-between border-b border-slate-700 pb-2">
                     <span className="text-slate-400">Data e Hora</span>
                     <span className="font-bold text-white">{formattedDateDisplay} às {selectedTime}</span>
                  </div>
                   <div className="flex justify-between border-b border-slate-700 pb-2">
                     <span className="text-slate-400">Detalhes</span>
                     <span className="font-bold text-white">{formData.people} pessoas / {formData.lanes} pista(s) / {formData.duration}h</span>
                  </div>
                  
                  <div className="flex justify-between items-center pt-2">
                     <span className="text-slate-400 flex items-center gap-1"><DollarSign size={16}/> Valor Total</span>
                     <span className="font-bold text-2xl text-neon-green">
                        {totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                     </span>
                  </div>
                  <p className="text-right text-xs text-slate-500">
                    ({formData.lanes} pistas x {formData.duration}h x R$ {PRICE_PER_LANE_HOUR},00)
                  </p>
                </div>

                 <div className="mt-8 flex justify-between items-center">
                   <button onClick={handleBack} className="text-slate-400 hover:text-white font-medium">Voltar e Editar</button>
                   <button 
                    onClick={handleProceedToCheckout}
                    className="px-8 py-3 bg-gradient-to-r from-neon-orange to-amber-500 text-white font-bold rounded-lg hover:shadow-[0_0_20px_rgba(249,115,22,0.4)] transition transform hover:-translate-y-1"
                   >
                     Confirmar e Pagar
                   </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </main>
    </div>
  );
};

export default PublicBooking;
