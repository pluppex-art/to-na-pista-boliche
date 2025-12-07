import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { db } from '../services/mockBackend';
import { Integrations } from '../services/integrations';
import { useApp } from '../contexts/AppContext';
import { generateDailySlots, checkHourCapacity } from '../utils/availability';
import { EventType, ReservationStatus, PaymentStatus, Reservation, FunnelStage } from '../types';
import { EVENT_TYPES, INITIAL_SETTINGS } from '../constants';
import { CheckCircle, Calendar as CalendarIcon, Clock, Users, ChevronRight, DollarSign, ChevronLeft, Lock, LayoutDashboard, Loader2, UserPlus, Mail, Phone, User as UserIcon, AlertCircle, XCircle, ShieldCheck, CreditCard, ArrowRight, Cake, Utensils } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const steps = ['Data', 'Configuração & Horário', 'Seus Dados', 'Resumo', 'Pagamento'];

const PublicBooking: React.FC = () => {
  const navigate = useNavigate();
  const { settings, user: staffUser, loading: appLoading } = useApp();
  
  // Client Authentication State
  const [clientUser, setClientUser] = useState<any>(null);
  
  const [currentStep, setCurrentStep] = useState(0);
  const [imgError, setImgError] = useState(false);
  
  const [existingReservations, setExistingReservations] = useState<any[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [createdReservationIds, setCreatedReservationIds] = useState<string[]>([]);
  const [clientId, setClientId] = useState<string>('');

  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  
  const [formData, setFormData] = useState({
    people: 6, 
    lanes: 1,
    type: EventType.JOGO_NORMAL,
    obs: '',
    wantsTable: false,
    birthdayName: '',
    tableSeatCount: 0,
    name: '',
    whatsapp: '',
    email: '',
    password: '', // New field for registration
    hasSecondResponsible: false,
    secondName: '',
    secondWhatsapp: '',
    secondEmail: ''
  });

  const [viewDate, setViewDate] = useState(new Date());

  // Check for logged in client on mount
  useEffect(() => {
      const storedClient = localStorage.getItem('tonapista_client_auth');
      if (storedClient) {
          try {
              const parsedClient = JSON.parse(storedClient);
              setClientUser(parsedClient);
              setFormData(prev => ({
                  ...prev,
                  name: parsedClient.name,
                  email: parsedClient.email,
                  whatsapp: parsedClient.phone
              }));
              setClientId(parsedClient.id);
          } catch (e) {
              console.error("Error parsing client auth", e);
          }
      }
  }, []);

  const getPricePerHour = () => {
      if (!selectedDate || !settings) return INITIAL_SETTINGS.weekdayPrice;
      const [y, m, d] = selectedDate.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      const day = date.getDay();
      if (day === 0 || day === 5 || day === 6) {
          return settings.weekendPrice;
      }
      return settings.weekdayPrice;
  };

  const currentPrice = getPricePerHour();
  const totalDuration = selectedTimes.length;
  const totalValue = currentPrice * formData.lanes * (totalDuration || 0);

  useEffect(() => {
    const fetchData = async () => {
        setIsDataLoading(true);
        try {
            const all = await db.reservations.getAll();
            setExistingReservations(all);
        } catch (e) { console.error(e); }
        setIsDataLoading(false);
    };
    fetchData();
  }, []);

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 2) return numbers;
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>, field: 'whatsapp' | 'secondWhatsapp') => {
      const formatted = formatPhone(e.target.value);
      setFormData(prev => ({ ...prev, [field]: formatted }));
      if (errors[field]) setErrors(prev => ({ ...prev, [field]: false }));
  };

  const handleInputChange = (field: string, value: any) => {
      setFormData(prev => ({ ...prev, [field]: value }));
      if (errors[field]) setErrors(prev => ({ ...prev, [field]: false }));
  };

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isValidPhone = (phone: string) => {
      const clean = phone.replace(/\D/g, '');
      return clean.length >= 10 && clean.length <= 11;
  };

  const validateStep = () => {
      const newErrors: Record<string, boolean> = {};
      let isValid = true;

      if (currentStep === 1) { 
          if (formData.wantsTable) {
              if (formData.type === EventType.ANIVERSARIO) {
                  if (!formData.birthdayName) newErrors.birthdayName = true;
                  if (!formData.tableSeatCount) newErrors.tableSeatCount = true;
              } else {
                   if (!formData.tableSeatCount) newErrors.tableSeatCount = true;
              }
          }
          if (selectedTimes.length === 0) {
              alert("Por favor, selecione pelo menos um horário.");
              isValid = false;
          }
      }

      if (currentStep === 2) { 
          if (!formData.name.trim()) newErrors.name = true;
          if (!formData.email.trim() || !isValidEmail(formData.email)) newErrors.email = true;
          if (!formData.whatsapp.trim() || !isValidPhone(formData.whatsapp)) newErrors.whatsapp = true;
          
          // Validate password if not logged in
          if (!clientUser && !formData.password.trim()) {
              newErrors.password = true;
          }
      }

      setErrors(newErrors);
      if (Object.keys(newErrors).length > 0) isValid = false;
      return isValid;
  };

  const handleNext = async () => {
    if (!validateStep()) return;

    if (currentStep === 1) {
        // Skip Data Step if logged in
        if (clientUser) {
            setCurrentStep(3); // Go straight to Summary
        } else {
            setCurrentStep(c => c + 1);
        }
    } else if (currentStep === 2) {
        setIsSaving(true);
        try {
            // Register/Update Client Logic
            // If user is here, they are NOT logged in (skipped otherwise)
            // So we try to register or find existing
            
            const newClientData = {
                id: uuidv4(),
                name: formData.name,
                phone: formData.whatsapp,
                email: formData.email,
                tags: ['Lead'], 
                createdAt: new Date().toISOString(),
                lastContactAt: new Date().toISOString(),
                funnelStage: FunnelStage.NOVO
            };

            const { client, error } = await db.clients.register(newClientData, formData.password);

            if (error) {
                alert(error);
                setIsSaving(false);
                return;
            }

            if (client) {
                // Auto-login logic
                localStorage.setItem('tonapista_client_auth', JSON.stringify(client));
                setClientUser(client);
                setClientId(client.id);
                setCurrentStep(c => c + 1);
            }
        } catch (error) {
            console.error(error);
            alert("Erro ao processar dados. Tente novamente.");
        } finally {
            setIsSaving(false);
        }
    } else if (currentStep === 3) {
        await createPendingReservations();
    } else if (currentStep < steps.length - 1) {
        setCurrentStep(c => c + 1);
    }
  };

  const handleBack = () => {
    if (currentStep === 3 && clientUser) {
        // If logged in, going back from Summary goes to Settings (skip data)
        setCurrentStep(1);
    } else if (currentStep > 0) {
        setCurrentStep(c => c - 1);
    }
  };

  const isDateAllowed = (date: Date) => {
    const day = date.getDay();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) return false;
    const dayConfig = settings.businessHours[day];
    if (!dayConfig || !dayConfig.isOpen) return false;
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
    const firstDay = new Date(year, month, 1).getDay();
    const days = [];
    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    const header = (
      <div className="grid grid-cols-7 mb-2">
        {weekDays.map(d => (
          <div key={d} className="text-center text-sm font-bold text-slate-500 py-2">{d}</div>
        ))}
      </div>
    );

    for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`} className="p-2"></div>);

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const dateStr = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
      const allowed = isDateAllowed(date);
      const isSelected = selectedDate === dateStr;

      days.push(
        <button
          key={d}
          disabled={!allowed}
          onClick={() => { setSelectedDate(dateStr); setSelectedTimes([]); }}
          className={`h-12 rounded-lg flex items-center justify-center font-medium transition-all relative ${isSelected ? 'bg-neon-orange text-white shadow-[0_0_10px_rgba(249,115,22,0.5)] z-10 scale-110' : allowed ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700' : 'bg-slate-900/50 text-slate-600 cursor-not-allowed opacity-50'}`}
        >
          {d}
          {allowed && !isSelected && <span className="absolute bottom-1 w-1 h-1 bg-neon-blue rounded-full opacity-50"></span>}
        </button>
      );
    }

    return (
      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 max-w-md mx-auto">
        <div className="flex justify-between items-center mb-6">
          <button onClick={() => handleMonthChange(-1)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white"><ChevronLeft size={20} /></button>
          <h3 className="text-lg font-bold text-white capitalize">{viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h3>
          <button onClick={() => handleMonthChange(1)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white"><ChevronRight size={20} /></button>
        </div>
        {header}
        <div className="grid grid-cols-7 gap-2">{days}</div>
        <div className="mt-4 flex justify-center items-center gap-4 text-xs text-slate-500">
           <div className="flex items-center gap-1"><div className="w-3 h-3 bg-slate-800 border border-slate-700 rounded"></div> Disponível</div>
           <div className="flex items-center gap-1"><div className="w-3 h-3 bg-neon-orange rounded"></div> Selecionado</div>
           <div className="flex items-center gap-1"><div className="w-3 h-3 bg-slate-900 opacity-50 rounded"></div> Fechado</div>
        </div>
      </div>
    );
  };

  const timeSlots = generateDailySlots(selectedDate, settings, existingReservations);

  const toggleTimeSelection = (time: string) => {
      setSelectedTimes(prev => {
          if (prev.includes(time)) {
              return prev.filter(t => t !== time);
          } else {
              return [...prev, time].sort((a, b) => parseInt(a) - parseInt(b));
          }
      });
  };

  const handlePeopleChange = (num: number) => {
    const suggestedLanes = Math.ceil(num / 6);
    setFormData(prev => ({ ...prev, people: num, lanes: suggestedLanes }));
  };

  const getReservationBlocks = () => {
    if (selectedTimes.length === 0) return [];
    const sortedHours = selectedTimes.map(t => parseInt(t.split(':')[0])).sort((a,b) => a - b);
    const blocks: { time: string, duration: number }[] = [];
    
    let currentStart = sortedHours[0];
    let currentDuration = 1;

    for (let i = 1; i < sortedHours.length; i++) {
        if (sortedHours[i] === sortedHours[i-1] + 1) {
            currentDuration++;
        } else {
            blocks.push({ time: `${currentStart}:00`, duration: currentDuration });
            currentStart = sortedHours[i];
            currentDuration = 1;
        }
    }
    blocks.push({ time: `${currentStart}:00`, duration: currentDuration });
    return blocks;
  };

  const createPendingReservations = async () => {
      if (createdReservationIds.length > 0) {
          setCurrentStep(4);
          return;
      }

      setIsSaving(true);
      try {
          const blocks = getReservationBlocks();
          const allRes = await db.reservations.getAll();
          
          for (const block of blocks) {
             const startH = parseInt(block.time.split(':')[0]);
             for(let h=0; h<block.duration; h++) {
                 const checkH = startH + h;
                 const { left } = checkHourCapacity(checkH, selectedDate, allRes, settings.activeLanes);
                 if(left < formData.lanes) {
                     alert(`O horário das ${checkH}:00 acabou de ser ocupado.`);
                     setIsSaving(false);
                     return;
                 }
             }
          }

          if (!clientId) throw new Error("ID do cliente não encontrado");

          const newIds: string[] = [];
          for (const block of blocks) {
             const blockTotalValue = (totalValue / (blocks.reduce((acc, b) => acc + b.duration, 0))) * block.duration;
             const res: Reservation = {
                 id: uuidv4(),
                 clientId: clientId,
                 clientName: formData.name,
                 date: selectedDate,
                 time: block.time,
                 peopleCount: formData.people,
                 laneCount: formData.lanes,
                 duration: block.duration,
                 totalValue: blockTotalValue,
                 eventType: formData.type,
                 observations: formData.obs,
                 status: ReservationStatus.PENDENTE,
                 paymentStatus: PaymentStatus.PENDENTE,
                 createdAt: new Date().toISOString(),
                 guests: [],
                 lanes: [],
                 checkedInIds: [],
                 noShowIds: [],
                 hasTableReservation: formData.wantsTable,
                 birthdayName: formData.wantsTable ? formData.birthdayName : undefined,
                 tableSeatCount: formData.wantsTable ? formData.tableSeatCount : undefined
             };
             await db.reservations.create(res);
             newIds.push(res.id);
          }

          setCreatedReservationIds(newIds);
          setExistingReservations(await db.reservations.getAll());
          setCurrentStep(4);

      } catch (e) {
          console.error(e);
          alert("Erro ao criar agendamento.");
      } finally {
          setIsSaving(false);
      }
  };

  const handlePaymentProcess = async (staffOverride: boolean = false) => {
      setIsSaving(true);
      try {
          if (settings.onlinePaymentEnabled && !staffOverride) {
              const compositeRes = { 
                  id: createdReservationIds[0], 
                  totalValue: totalValue,
                  clientName: formData.name,
                  clientEmail: formData.email
              } as any;
              
              const checkoutUrl = await Integrations.createMercadoPagoPreference(compositeRes, settings);
              if (checkoutUrl) {
                  window.location.href = checkoutUrl;
                  return; 
              } else {
                  alert("Erro no banco. Redirecionando para manual.");
                  navigate('/checkout', { state: { ...formData, date: selectedDate, time: selectedTimes[0], totalValue, reservationBlocks, reservationIds: createdReservationIds } });
              }
          } else {
             navigate('/checkout', { state: { ...formData, date: selectedDate, time: selectedTimes[0], totalValue, reservationBlocks, reservationIds: createdReservationIds } });
          }
      } catch (e) {
          console.error(e);
          alert("Erro ao processar pagamento.");
      } finally {
          setIsSaving(false);
      }
  };

  const formattedDateDisplay = selectedDate ? selectedDate.split('-').reverse().join('/') : '';
  const reservationBlocks = getReservationBlocks();

  if (appLoading || isDataLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-neon-orange" size={48} /></div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col">
      <header className="bg-slate-900 p-4 shadow-md border-b border-slate-800 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          {!imgError ? (
             settings.logoUrl ? (
                <img src={settings.logoUrl} alt={settings.establishmentName} className="h-12 md:h-16 object-contain" onError={() => setImgError(true)} />
             ) : (
                <img src="/logo.png" alt="Tô Na Pista" className="h-12 md:h-16 object-contain" onError={() => setImgError(true)} />
             )
           ) : (
             <h1 className="text-2xl font-bold text-neon-orange font-sans tracking-tighter leading-none">{settings.establishmentName}</h1>
           )}
          
          <div className="flex items-center gap-4">
            <div className="hidden md:block text-xs font-medium px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400">Agendamento Online</div>
            {staffUser ? (
              <Link to="/dashboard" className="flex items-center gap-2 text-neon-blue hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-lg transition font-medium text-sm border border-slate-700">
                <LayoutDashboard size={16} /><span className="hidden md:inline">Voltar ao Dashboard</span>
              </Link>
            ) : clientUser ? (
                <Link to="/minha-conta" className="flex items-center gap-2 text-neon-green hover:text-white bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-lg transition font-medium text-sm border border-slate-700">
                    <UserIcon size={16} /><span className="hidden md:inline">Minha Conta</span>
                </Link>
            ) : (
              <Link to="/login" className="text-slate-600 hover:text-neon-blue transition p-2 rounded-full hover:bg-slate-800" title="Área da Equipe"><Lock size={18} /></Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          {currentStep < 5 && (
            <div className="mb-8">
                <div className="flex justify-between mb-2">
                {steps.map((step, i) => {
                    // Logic to hide 'Seus Dados' step if skipped
                    if (clientUser && i === 2) return null;
                    return (
                        <div key={i} className={`text-[10px] md:text-sm font-medium ${i <= currentStep ? 'text-neon-blue' : 'text-slate-600'}`}>{step}</div>
                    );
                })}
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-neon-orange to-neon-blue transition-all duration-500 ease-out" style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}></div>
                </div>
            </div>
          )}

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 md:p-8 shadow-lg min-h-[400px]">
            {/* STEP 1: DATE */}
            {currentStep === 0 && (
              <div className="animate-fade-in">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2"><CalendarIcon className="text-neon-orange" /> Escolha a Data</h2>
                {renderCalendar()}
                <div className="mt-8 flex justify-between items-center">
                   <div className="text-slate-400">{selectedDate ? `Data escolhida: ${formattedDateDisplay}` : 'Selecione uma data no calendário'}</div>
                   <button disabled={!selectedDate} onClick={handleNext} className="px-8 py-3 bg-neon-blue text-white font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-400 transition shadow-lg">Próximo</button>
                </div>
              </div>
            )}

            {/* STEP 2: TIME & CONFIGURATION */}
            {currentStep === 1 && (
              <div className="animate-fade-in">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2"><Clock className="text-neon-orange" /> Configuração e Horário</h2>
                
                {/* ... (Mesmo código de configuração de antes) ... */}
                {/* Por brevidade, mantendo o bloco de configuração igual */}
                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 mb-6">
                    {/* ... Inputs de Pessoas, Pistas, Tipo ... */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Nº Pessoas</label>
                            <input type="number" min={1} className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 focus:border-neon-orange focus:outline-none text-white" value={formData.people} onChange={e => handlePeopleChange(parseInt(e.target.value) || 1)} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Nº Pistas</label>
                            <input type="number" min={1} max={settings.activeLanes} className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 focus:border-neon-orange focus:outline-none text-white font-bold" value={formData.lanes} onChange={e => { const count = parseInt(e.target.value) || 1; setFormData(prev => ({...prev, lanes: count})); setSelectedTimes([]); }} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Tipo</label>
                            <select className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 focus:border-neon-orange focus:outline-none text-white" value={formData.type} onChange={e => { const newType = e.target.value as EventType; setFormData(prev => ({ ...prev, type: newType, wantsTable: false, birthdayName: '', tableSeatCount: 0 })); }}>
                            {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>
                    {/* ... Checkbox Mesa ... */}
                    {formData.type !== EventType.JOGO_NORMAL && (
                        <div className="mt-4 pt-4 border-t border-slate-700 animate-fade-in">
                            <label className="flex items-center gap-3 cursor-pointer group mb-4">
                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition ${formData.wantsTable ? 'bg-neon-blue border-neon-blue' : 'border-slate-600 group-hover:border-slate-400'}`}>
                                    {formData.wantsTable && <CheckCircle size={14} className="text-white" />}
                                </div>
                                <input type="checkbox" className="hidden" checked={formData.wantsTable} onChange={e => handleInputChange('wantsTable', e.target.checked)} />
                                <span className="font-bold text-slate-300 group-hover:text-white transition flex items-center gap-2"><Utensils size={16}/> Reservar Mesa?</span>
                            </label>

                            {formData.wantsTable && (
                                <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700 grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                                    {formData.type === EventType.ANIVERSARIO && (
                                        <div>
                                            <label className={`block text-xs font-medium mb-1 ${errors.birthdayName ? 'text-red-500' : 'text-slate-400'}`}>Nome do Aniversariante *</label>
                                            <div className="relative"><Cake size={14} className="absolute left-3 top-3 text-slate-500"/><input type="text" className={`w-full bg-slate-800 border rounded-lg p-2 pl-9 focus:outline-none text-white ${errors.birthdayName ? 'border-red-500' : 'border-slate-600 focus:border-neon-orange'}`} value={formData.birthdayName} onChange={e => handleInputChange('birthdayName', e.target.value)} placeholder="Nome do aniversariante"/></div>
                                        </div>
                                    )}
                                    <div className={formData.type === EventType.ANIVERSARIO ? "" : "md:col-span-2"}>
                                        <label className={`block text-xs font-medium mb-1 ${errors.tableSeatCount ? 'text-red-500' : 'text-slate-400'}`}>{formData.type === EventType.ANIVERSARIO ? 'Qtd. Convidados (Cadeiras) *' : 'Qtd. Pessoas (Cadeiras) *'}</label>
                                        <input type="number" min={1} className={`w-full bg-slate-800 border rounded-lg p-2 focus:outline-none text-white ${errors.tableSeatCount ? 'border-red-500' : 'border-slate-600 focus:border-neon-orange'}`} value={formData.tableSeatCount} onChange={e => handleInputChange('tableSeatCount', parseInt(e.target.value) || 0)} placeholder="Ex: 10"/>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    {/* ... Price Summary ... */}
                    <div className="mt-4 pt-4 border-t border-slate-700 flex flex-col md:flex-row justify-between items-end md:items-center gap-2">
                        <div className="text-sm text-slate-300"><span className="text-slate-500">Total Horas Selecionadas:</span> <strong className="text-white bg-slate-900 px-2 py-1 rounded border border-slate-700">{totalDuration}h</strong></div>
                        <div className="text-right">
                            <div className="text-[10px] sm:text-xs text-slate-500 font-mono mb-1">{currentPrice.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})} x {formData.lanes} pista(s) x {totalDuration} hora(s)</div>
                            <span className="text-sm text-slate-400">Total Estimado: <strong className="text-xl text-neon-green ml-1">{totalValue.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</strong></span>
                        </div>
                    </div>
                </div>

                <p className="text-slate-400 mb-4">Selecione os horários desejados. <br/><span className="text-xs italic opacity-70">Você pode selecionar horários alternados (ex: 18:00 e 22:00).</span></p>

                <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                  {timeSlots.length === 0 ? <div className="col-span-3 md:col-span-5 text-center text-slate-500 py-4 italic">Fechado nesta data.</div> : (
                    timeSlots.map(({ time, label, available, left, isPast }) => {
                        const isSelected = selectedTimes.includes(time);
                        const isDisabled = (!available && !isSelected) || (available && left < formData.lanes && !isSelected); 
                        return (
                            <button key={time} disabled={isDisabled} onClick={() => toggleTimeSelection(time)} className={`p-3 rounded-xl border transition-all flex flex-col items-center justify-center relative overflow-hidden ${isSelected ? 'bg-neon-blue text-white border-neon-blue shadow-[0_0_15px_rgba(59,130,246,0.5)] transform scale-105 z-10' : isDisabled ? 'border-slate-800 bg-slate-900/50 text-slate-600 cursor-not-allowed opacity-60' : 'border-slate-700 bg-slate-800 hover:border-slate-500 text-slate-300 hover:bg-slate-700'}`}>
                            <div className="text-sm md:text-base font-bold">{label}</div>
                            {isDisabled && !isSelected ? <span className="text-[9px] uppercase mt-1 text-red-500/70 font-bold">{isPast ? 'Encerrado' : 'Esgotado'}</span> : (
                                <div className="flex flex-col items-center">{isSelected ? <span className="text-[10px] mt-1 text-white font-bold">Selecionado</span> : <span className="text-[9px] text-slate-500 mt-1">Restam {left}</span>}</div>
                            )}
                            </button>
                        );
                    })
                  )}
                </div>
                 <div className="mt-8 flex justify-between">
                   <button onClick={handleBack} className="text-slate-400 hover:text-white font-medium">Voltar</button>
                   <button disabled={selectedTimes.length === 0} onClick={handleNext} className="px-8 py-3 bg-neon-blue text-white font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-400 transition">Próximo</button>
                </div>
              </div>
            )}

            {/* STEP 3: DETAILS (Modified for Registration) */}
            {currentStep === 2 && (
              <div className="animate-fade-in space-y-6">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2"><Users className="text-neon-orange" /> Seus Dados</h2>
                
                <div className="bg-slate-800/50 p-4 rounded-xl border border-neon-blue/30 mb-6">
                    <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2"><Lock size={18} className="text-neon-green"/> Criar Conta Rápida</h3>
                    <p className="text-sm text-slate-400 mb-4">Para sua segurança e acesso ao clube de fidelidade, criaremos uma conta automaticamente.</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={`block text-xs font-medium mb-1 ${errors.name ? 'text-red-500' : 'text-slate-500'}`}>Nome Completo <span className="text-neon-orange">*</span></label>
                            <input type="text" className={`w-full bg-slate-800 border rounded-lg p-3 text-white ${errors.name ? 'border-red-500' : 'border-slate-600 focus:border-neon-orange'}`} value={formData.name} onChange={e => handleInputChange('name', e.target.value)} />
                        </div>
                        <div>
                            <label className={`block text-xs font-medium mb-1 ${errors.whatsapp ? 'text-red-500' : 'text-slate-500'}`}>WhatsApp <span className="text-neon-orange">*</span></label>
                            <input type="tel" className={`w-full bg-slate-800 border rounded-lg p-3 text-white ${errors.whatsapp ? 'border-red-500' : 'border-slate-600 focus:border-neon-orange'}`} value={formData.whatsapp} onChange={e => handlePhoneChange(e, 'whatsapp')} placeholder="(00) 00000-0000"/>
                        </div>
                        <div>
                            <label className={`block text-xs font-medium mb-1 ${errors.email ? 'text-red-500' : 'text-slate-500'}`}>E-mail <span className="text-neon-orange">*</span></label>
                            <input type="email" className={`w-full bg-slate-800 border rounded-lg p-3 text-white ${errors.email ? 'border-red-500' : 'border-slate-600 focus:border-neon-orange'}`} value={formData.email} onChange={e => handleInputChange('email', e.target.value)} />
                        </div>
                        <div>
                            <label className={`block text-xs font-medium mb-1 ${errors.password ? 'text-red-500' : 'text-slate-500'}`}>Crie uma Senha <span className="text-neon-orange">*</span></label>
                            <input type="password" className={`w-full bg-slate-800 border rounded-lg p-3 text-white ${errors.password ? 'border-red-500' : 'border-slate-600 focus:border-neon-orange'}`} value={formData.password} onChange={e => handleInputChange('password', e.target.value)} placeholder="Mínimo 6 caracteres"/>
                        </div>
                    </div>
                </div>

                <div className="pt-4 border-t border-slate-800">
                    <label className="flex items-center gap-3 cursor-pointer group"><div className={`w-6 h-6 rounded border flex items-center justify-center transition ${formData.hasSecondResponsible ? 'bg-neon-blue border-neon-blue' : 'border-slate-600 group-hover:border-slate-400'}`}>{formData.hasSecondResponsible && <CheckCircle size={16} className="text-white" />}</div><input type="checkbox" className="hidden" checked={formData.hasSecondResponsible} onChange={e => handleInputChange('hasSecondResponsible', e.target.checked)} /><span className="font-bold text-slate-300 group-hover:text-white transition">Adicionar Segundo Responsável? <span className="text-xs font-normal text-slate-500">(Opcional)</span></span></label>
                    {formData.hasSecondResponsible && (<div className="mt-4 animate-fade-in p-4 bg-slate-800/30 rounded-lg border border-slate-700/50"><h3 className="text-sm font-bold text-slate-300 uppercase mb-3 flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-slate-700 text-white flex items-center justify-center text-xs">2</span> Segundo Responsável</h3><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"><div><label className="block text-xs font-medium text-slate-500 mb-1">Nome Completo</label><input type="text" className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 focus:border-neon-orange focus:outline-none text-white" value={formData.secondName} onChange={e => handleInputChange('secondName', e.target.value)} /></div><div><label className="block text-xs font-medium text-slate-500 mb-1">WhatsApp</label><input type="tel" maxLength={15} placeholder="(00) 00000-0000" className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 focus:border-neon-orange focus:outline-none text-white" value={formData.secondWhatsapp} onChange={e => handlePhoneChange(e, 'secondWhatsapp')} /></div><div className="md:col-span-2 lg:col-span-1"><label className="block text-xs font-medium text-slate-500 mb-1">E-mail (Opcional)</label><input type="email" className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 focus:border-neon-orange focus:outline-none text-white" value={formData.secondEmail} onChange={e => handleInputChange('secondEmail', e.target.value)} /></div></div></div>)}
                </div>
                <div><label className="block text-sm font-medium text-slate-400 mb-1">Observações</label><textarea className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 focus:border-neon-orange focus:outline-none h-20 text-white" value={formData.obs} onChange={e => handleInputChange('obs', e.target.value)} /></div>
                 
                 <div className="mt-8 flex justify-between items-center"><button onClick={handleBack} className="text-slate-400 hover:text-white font-medium">Voltar</button><div className="flex flex-col items-end gap-2"><button disabled={isSaving} onClick={handleNext} className="px-8 py-3 bg-neon-blue text-white font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-400 transition flex items-center gap-2">{isSaving ? <Loader2 className="animate-spin" size={20} /> : 'Próximo'}</button></div></div>
              </div>
            )}

            {/* STEP 4: SUMMARY */}
            {currentStep === 3 && (
              <div className="animate-fade-in">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2"><CheckCircle className="text-neon-green" /> Resumo da Reserva</h2>
                <div className="bg-slate-800/50 rounded-xl p-6 space-y-4 border border-slate-700">
                  <div className="flex justify-between border-b border-slate-700 pb-2"><span className="text-slate-400">Responsável</span><div className="text-right"><span className="font-bold text-white block">{formData.name}</span><span className="text-xs text-slate-500 block">{formData.whatsapp}</span></div></div>
                  <div className="flex justify-between border-b border-slate-700 pb-2"><span className="text-slate-400">Data</span><span className="font-bold text-white">{formattedDateDisplay}</span></div>
                  <div className="border-b border-slate-700 pb-2"><span className="text-slate-400 block mb-2">Horários</span><div className="space-y-2">{reservationBlocks.map((block, idx) => (<div key={idx} className="flex justify-between items-center bg-slate-900/50 p-2 rounded"><span className="font-bold text-white">{block.time}</span><span className="text-xs text-slate-400">{block.duration} hora(s)</span></div>))}</div></div>
                   <div className="flex justify-between border-b border-slate-700 pb-2"><span className="text-slate-400">Detalhes</span><div className="text-right"><span className="font-bold text-white block">{formData.people} pessoas / {formData.lanes} pista(s)</span><span className="text-xs text-neon-orange font-bold uppercase">{formData.type}</span></div></div>
                  <div className="flex justify-between items-center pt-2"><span className="text-slate-400 flex items-center gap-1"><DollarSign size={16}/> Valor Total</span><span className="font-bold text-2xl text-neon-green">{totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                </div>
                 <div className="mt-8 flex justify-between items-center"><button onClick={handleBack} className="text-slate-400 hover:text-white font-medium">Voltar e Editar</button><button onClick={handleNext} disabled={isSaving} className="px-8 py-3 bg-neon-blue text-white font-bold rounded-lg hover:bg-blue-500 transition flex items-center gap-2">{isSaving ? <Loader2 className="animate-spin" /> : <>Avançar <ChevronRight size={18}/></>}</button></div>
              </div>
            )}
            
            {/* STEP 5: PRE-BOOKING & PAYMENT */}
            {currentStep === 4 && (
                <div className="animate-fade-in text-center pt-8">
                     <div className="w-20 h-20 bg-neon-blue/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(59,130,246,0.3)]"><Lock size={40} className="text-neon-blue" /></div>
                     <h2 className="text-3xl font-bold text-white mb-4">Pré agendamento realizado</h2>
                     <p className="text-slate-300 max-w-lg mx-auto mb-8 text-lg">Seu horário foi reservado temporariamente! <br/><span className="text-neon-orange font-bold">Atenção:</span> Para confirmar definitivamente, é necessário efetuar o pagamento.</p>
                     <div className="bg-slate-800 p-4 rounded-lg max-w-md mx-auto mb-8 border border-slate-700"><p className="text-sm text-slate-400 mb-1">Valor Total</p><p className="text-3xl font-bold text-neon-green">{totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p></div>
                     <div className="flex flex-col gap-4 max-w-sm mx-auto">
                      <button disabled={isSaving} onClick={() => handlePaymentProcess(false)} className={`w-full py-4 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-3 transition transform hover:-translate-y-1 bg-gradient-to-r from-neon-green to-emerald-600`}>
                          {isSaving ? <><Loader2 className="animate-spin" /> Processando...</> : <><ShieldCheck size={24}/> Pagar Agora</>}
                      </button>
                        <p className="text-xs text-slate-500 mt-1">Redirecionamento seguro para Mercado Pago.</p>
                        {staffUser && (<button disabled={isSaving} onClick={() => handlePaymentProcess(true)} className="mt-4 w-full py-3 bg-slate-800 border border-slate-700 text-slate-300 font-bold rounded-lg hover:bg-slate-700 hover:text-white transition flex items-center justify-center gap-2"><CreditCard size={18}/> Pagar no Local (Equipe)</button>)}
                        <button onClick={handleBack} className="mt-4 text-slate-500 hover:text-white text-sm">Voltar</button>
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