
import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { db } from '../services/mockBackend';
import { supabase } from '../services/supabaseClient';
import { Integrations } from '../services/integrations';
import { useApp } from '../contexts/AppContext';
import { generateDailySlots, checkHourCapacity } from '../utils/availability';
import { EventType, ReservationStatus, PaymentStatus, Reservation, FunnelStage, UserRole } from '../types';
import { EVENT_TYPES, INITIAL_SETTINGS } from '../constants';
import { CheckCircle, Calendar as CalendarIcon, Clock, Users, ChevronRight, DollarSign, ChevronLeft, Lock, LayoutDashboard, Loader2, UserPlus, Mail, Phone, User as UserIcon, AlertCircle, XCircle, ShieldCheck, CreditCard, ArrowRight, Cake, Utensils, MessageCircle, LogIn, AlertTriangle, Store, Settings, PenTool, Shield, ArrowLeft, Hash, Zap } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const steps = ['Data', 'Configuração', 'Identificação', 'Resumo', 'Pagamento'];

const PublicBooking: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation(); 
  const { settings, user: staffUser, loading: appLoading } = useApp();
  
  // Inicialização imediata do clientUser para evitar flicker no header
  const [clientUser, setClientUser] = useState<any>(() => {
      const stored = localStorage.getItem('tonapista_client_auth');
      return stored ? JSON.parse(stored) : null;
  });
  
  const [authMode, setAuthMode] = useState<'REGISTER' | 'LOGIN'>('LOGIN');
  const [isForgotPassMode, setIsForgotPassMode] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  
  const [currentStep, setCurrentStep] = useState(0);
  const [imgError, setImgError] = useState(false);
  
  const [existingReservations, setExistingReservations] = useState<any[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [createdReservationIds, setCreatedReservationIds] = useState<string[]>([]);
  const [clientId, setClientId] = useState<string>(clientUser?.id || '');

  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTimes, setSelectedTimes] = useState<string[]>([]);
  
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualStartTime, setManualStartTime] = useState('18:00');
  const [manualEndTime, setManualEndTime] = useState('19:00');
  const [manualPrice, setManualPrice] = useState<string>('');

  const [peopleInput, setPeopleInput] = useState<string>('6');
  const [lanesInput, setLanesInput] = useState<string>('1');
  const [seatInput, setSeatInput] = useState<string>('');

  const [formData, setFormData] = useState({
    people: 6, 
    lanes: 1,
    type: EventType.JOGO_NORMAL,
    obs: '',
    wantsTable: false,
    birthdayName: '',
    tableSeatCount: 0,
    name: clientUser?.name || '',
    whatsapp: clientUser?.phone || '',
    email: clientUser?.email || '',
    password: '', 
    createAccount: true,
    hasSecondResponsible: false,
    secondName: '',
    secondWhatsapp: '',
    secondEmail: ''
  });

  const [viewDate, setViewDate] = useState(new Date());

  // Sincroniza dados se o login mudar
  useEffect(() => {
      const storedClient = localStorage.getItem('tonapista_client_auth');
      if (storedClient) {
          const parsedClient = JSON.parse(storedClient);
          setClientUser(parsedClient);
          setClientId(parsedClient.id);
          setFormData(prev => ({
              ...prev,
              name: parsedClient.name,
              email: parsedClient.email,
              whatsapp: parsedClient.phone,
              createAccount: false 
          }));
      }
  }, []);

  useEffect(() => {
      if (location.state?.prefilledClient) {
          const c = location.state.prefilledClient;
          setFormData(prev => ({
              ...prev,
              name: c.name,
              email: c.email || '',
              whatsapp: c.phone,
              createAccount: false 
          }));
          setClientId(c.id);
      }
  }, [location.state]);

  useEffect(() => {
      const currentVal = parseInt(seatInput) || 0;
      if (currentVal !== formData.tableSeatCount) {
          setSeatInput(formData.tableSeatCount === 0 ? '' : formData.tableSeatCount.toString());
      }
  }, [formData.tableSeatCount]);

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
  const totalValue = isManualMode && manualPrice ? parseFloat(manualPrice) : (currentPrice * formData.lanes * (totalDuration || 0));

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
        setIsDataLoading(true);
        try {
            const data = await db.reservations.getAll();
            if (isMounted) setExistingReservations(data);
        } catch (e) { 
            console.error("Erro ao carregar reservas:", e);
        } finally {
            if (isMounted) setIsDataLoading(false);
        }
    };
    fetchData();

    const channel = supabase.channel('public_booking_updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas' }, async () => {
             const data = await db.reservations.getAll();
             if (isMounted) setExistingReservations(data);
        })
        .subscribe();

    return () => { 
        isMounted = false; 
        supabase.removeChannel(channel);
    };
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
      if (field === 'tableSeatCount' && typeof value === 'number') {
          let maxAllowed = 25;
          if (formData.people > 25) maxAllowed = formData.people;
          if (maxAllowed > 36) maxAllowed = 36;
          if (value > maxAllowed) {
              alert(`O limite máximo permitido para esta configuração é de ${maxAllowed} cadeiras.`);
              value = maxAllowed;
          }
      }
      setFormData(prev => ({ ...prev, [field]: value }));
      if (errors[field]) setErrors(prev => ({ ...prev, [field]: false }));
  };

  const handlePeopleChange = (val: string) => {
      setPeopleInput(val); 
      if (val === '') return;
      const num = parseInt(val);
      if (!isNaN(num)) {
          const suggestedLanes = Math.ceil(num / 6);
          setFormData(prev => {
              let newSeatCount = prev.tableSeatCount;
              let maxAllowed = 25;
              if (num > 25) maxAllowed = num;
              if (maxAllowed > 36) maxAllowed = 36;
              if (prev.tableSeatCount > maxAllowed) newSeatCount = maxAllowed;
              return { ...prev, people: num, lanes: suggestedLanes, tableSeatCount: newSeatCount };
          });
          setLanesInput(suggestedLanes.toString());
      }
  };

  const handlePeopleBlur = () => {
      let num = parseInt(peopleInput);
      if (isNaN(num) || num < 1) num = 1;
      if (num > 36) { num = 36; alert("Máximo de 36 pessoas por reserva."); }
      setPeopleInput(num.toString());
      const suggestedLanes = Math.ceil(num / 6);
      setFormData(prev => {
          let newSeatCount = prev.tableSeatCount;
          let maxAllowed = 25;
          if (num > 25) maxAllowed = num;
          if (maxAllowed > 36) maxAllowed = 36;
          if (prev.tableSeatCount > maxAllowed) newSeatCount = maxAllowed;
          return { ...prev, people: num, lanes: suggestedLanes, tableSeatCount: newSeatCount };
      });
      setLanesInput(suggestedLanes.toString());
  };

  const handleSeatChange = (val: string) => {
      setSeatInput(val);
      if (val === '') { handleInputChange('tableSeatCount', 0); return; }
      const num = parseInt(val);
      if (!isNaN(num)) handleInputChange('tableSeatCount', num);
  };

  const handleSeatBlur = () => { };

  const handleLanesChange = (val: string) => {
      setLanesInput(val);
      if (val === '') return;
      const num = parseInt(val);
      if (!isNaN(num)) { setFormData(prev => ({ ...prev, lanes: num })); setSelectedTimes([]); }
  };

  const handleLanesBlur = () => {
      let num = parseInt(lanesInput);
      if (isNaN(num) || num < 1) num = 1;
      if (settings && num > settings.activeLanes) num = settings.activeLanes;
      setLanesInput(num.toString());
      setFormData(prev => ({ ...prev, lanes: num }));
      setSelectedTimes([]);
  };

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isValidPhone = (phone: string) => {
      const clean = phone.replace(/\D/g, '');
      return clean.length >= 10 && clean.length <= 11;
  };

  const handleInlineLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsLoggingIn(true);
      try {
          const { client, error } = await db.clients.login(loginEmail, loginPass);
          if (error || !client) {
              alert(error || "Erro ao entrar.");
          } else {
              localStorage.setItem('tonapista_client_auth', JSON.stringify(client));
              setClientUser(client);
              setFormData(prev => ({
                  ...prev,
                  name: client.name,
                  email: client.email || '',
                  whatsapp: client.phone,
                  createAccount: false
              }));
              setClientId(client.id);
              setCurrentStep(3);
          }
      } catch (err) {
          console.error(err);
          alert("Erro técnico ao realizar login.");
      } finally {
          setIsLoggingIn(false);
      }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!loginEmail) { alert("Informe seu e-mail."); return; }
      setIsLoggingIn(true);
      try {
          const { error } = await db.clients.forgotPassword(loginEmail);
          if (error) alert("Erro: " + error);
          else {
              setResetSent(true);
              setTimeout(() => { setIsForgotPassMode(false); setResetSent(false); }, 6000);
          }
      } catch (e) {
          alert("Erro ao solicitar recuperação.");
      } finally {
          setIsLoggingIn(false);
      }
  };

  const isContactOptional = staffUser && (
      staffUser.role === UserRole.ADMIN || 
      staffUser.role === UserRole.GESTOR || 
      staffUser.perm_create_reservation_no_contact
  );

  const validateStep = () => {
      const newErrors: Record<string, boolean> = {};
      let isValid = true;

      if (currentStep === 0) {
          if (!selectedDate) {
              alert("Por favor, selecione uma data.");
              return false;
          }
      }

      if (currentStep === 1) { 
          if (formData.wantsTable) {
              if (formData.type === EventType.ANIVERSARIO) {
                  if (!formData.birthdayName) newErrors.birthdayName = true;
                  if (!formData.tableSeatCount) newErrors.tableSeatCount = true;
              } else {
                   if (!formData.tableSeatCount) newErrors.tableSeatCount = true;
              }
          }
          if (isManualMode) {
              if (!manualStartTime || !manualEndTime || !manualPrice) {
                  alert("Preencha horário de início, fim e valor para agendamento manual.");
                  isValid = false;
              }
          } else {
              if (selectedTimes.length === 0) {
                  alert("Por favor, selecione pelo menos um horário.");
                  isValid = false;
              }
          }
      }

      if (currentStep === 2) { 
          if (authMode === 'REGISTER') {
            if (!formData.name.trim()) newErrors.name = true;
            if (isContactOptional) {
                if (formData.email.trim() && !isValidEmail(formData.email)) newErrors.email = true;
                if (formData.whatsapp.trim() && !isValidPhone(formData.whatsapp)) newErrors.whatsapp = true;
            } else {
                if (!formData.email.trim() || !isValidEmail(formData.email)) newErrors.email = true;
                if (!formData.whatsapp.trim() || !isValidPhone(formData.whatsapp)) newErrors.whatsapp = true;
            }
            if (!clientUser && !staffUser && !formData.password.trim()) {
                newErrors.password = true;
            }
          }
      }

      setErrors(newErrors);
      if (Object.keys(newErrors).length > 0) isValid = false;
      return isValid;
  };

  const handleNext = async () => {
    if (!validateStep()) return;

    if (currentStep === 1) {
        if (formData.wantsTable) {
            const tablesOnDate = existingReservations.filter(r => 
                r.date === selectedDate && 
                r.hasTableReservation && 
                r.status !== ReservationStatus.CANCELADA
            ).length;
            if (tablesOnDate >= 25) {
                alert("Limite de 25 mesas esgotado para esta data.");
                return;
            }
        }
        if (clientUser) setCurrentStep(3); 
        else setCurrentStep(c => c + 1);
    } else if (currentStep === 2) {
        setIsSaving(true);
        try {
            const phoneClean = formData.whatsapp.replace(/\D/g, '');
            const emailClean = formData.email.trim();

            let filters = [];
            if (phoneClean) filters.push(`phone.eq.${phoneClean}`);
            if (emailClean) filters.push(`email.eq.${emailClean}`);
            
            let existingClient = null;
            if (filters.length > 0) {
                const { data } = await supabase
                    .from('clientes')
                    .select('client_id, name, email')
                    .or(filters.join(','))
                    .maybeSingle();
                existingClient = data;
            }

            if (existingClient) {
                if (staffUser) {
                    setClientId(existingClient.client_id);
                    setFormData(prev => ({ ...prev, name: existingClient.name }));
                    setCurrentStep(c => c + 1);
                    setIsSaving(false);
                    return;
                } else {
                    alert("Identificamos que você já possui cadastro! Por favor, acesse sua conta para continuar.");
                    setAuthMode('LOGIN');
                    if (existingClient.email) setLoginEmail(existingClient.email);
                    setIsSaving(false);
                    return;
                }
            }

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

            const forceAccount = !staffUser;

            if (forceAccount && !clientUser) {
                const { client, error } = await db.clients.register(newClientData, formData.password);
                if (error) {
                    alert(typeof error === 'string' ? error : 'Erro ao criar conta.');
                    setIsSaving(false);
                    return;
                }
                if (client) {
                    localStorage.setItem('tonapista_client_auth', JSON.stringify(client));
                    setClientUser(client);
                    setClientId(client.id);
                    setCurrentStep(c => c + 1);
                }
            } else {
                const hasContact = phoneClean.length > 0 || emailClean.length > 0;
                if (staffUser && !hasContact) {
                    setClientId(''); 
                    setCurrentStep(c => c + 1);
                } else {
                    const client = await db.clients.create(newClientData, staffUser?.id); 
                    setClientId(client.id);
                    setCurrentStep(c => c + 1);
                }
            }
        } catch (error) {
            console.error(error);
            alert("Erro ao processar dados. Verifique sua conexão.");
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
        setCurrentStep(1);
    } else if (currentStep > 0) {
        setCurrentStep(c => c - 1);
    }
  };

  const isDateAllowed = (date: Date) => {
    if (!settings) return false;
    const day = date.getDay();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) return false;
    const dateStr = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
    if (settings.blockedDates && settings.blockedDates.includes(dateStr)) return false;
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
          onClick={() => { setSelectedDate(dateStr); setSelectedTimes([]); setIsManualMode(false); }}
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
      </div>
    );
  };

  const timeSlots = generateDailySlots(selectedDate, settings, existingReservations, undefined, !!staffUser);

  const toggleTimeSelection = (time: string) => {
      setSelectedTimes(prev => {
          if (prev.includes(time)) return prev.filter(t => t !== time);
          else return [...prev, time].sort((a, b) => parseInt(a) - parseInt(b));
      });
  };

  const getReservationBlocks = () => {
    if (isManualMode) {
        const [h1, m1] = manualStartTime.split(':').map(Number);
        const [h2, m2] = manualEndTime.split(':').map(Number);
        const diffHours = (h2 + m2/60) - (h1 + m1/60);
        return [{ time: manualStartTime, duration: Math.max(0.5, parseFloat(diffHours.toFixed(1))) }];
    }
    if (selectedTimes.length === 0) return [];
    const sortedHours = selectedTimes.map(t => parseInt(t.split(':')[0])).sort((a,b) => a - b);
    const blocks: { time: string, duration: number }[] = [];
    let currentStart = sortedHours[0];
    let currentDuration = 1;
    for (let i = 1; i < sortedHours.length; i++) {
        if (sortedHours[i] === sortedHours[i-1] + 1) currentDuration++;
        else { blocks.push({ time: `${currentStart}:00`, duration: currentDuration }); currentStart = sortedHours[i]; currentDuration = 1; }
    }
    blocks.push({ time: `${currentStart}:00`, duration: currentDuration });
    return blocks;
  };

  const createPendingReservations = async () => {
      if (createdReservationIds.length > 0) { setCurrentStep(4); return; }
      
      setIsSaving(true);
      try {
          if (settings?.blockedDates?.includes(selectedDate)) {
              alert("Atenção: O estabelecimento está fechado nesta data devido a um fechamento excepcional. Por favor, escolha outro dia.");
              setCurrentStep(0);
              setIsSaving(false);
              return;
          }

          const blocks = getReservationBlocks();
          const allRes = await db.reservations.getAll();
          
          if (isManualMode) {
              const [hStart, mStart] = manualStartTime.split(':').map(Number);
              const [hEnd, mEnd] = manualEndTime.split(':').map(Number);
              const newStartMins = hStart * 60 + mStart;
              const newEndMins = hEnd * 60 + mEnd;
              if (newEndMins <= newStartMins) { alert("Hora de fim inválida."); setIsSaving(false); return; }
              const conflictingLanes = allRes.filter(r => {
                  if (r.date !== selectedDate || r.status === ReservationStatus.CANCELADA) return false;
                  const [rH, rM] = r.time.split(':').map(Number);
                  const resStartMins = rH * 60 + rM;
                  const resEndMins = resStartMins + (r.duration * 60);
                  return (newStartMins < resEndMins) && (newEndMins > resStartMins);
              }).reduce((acc, curr) => acc + curr.laneCount, 0);
              if ((settings.activeLanes - conflictingLanes) < formData.lanes) { alert("Conflito de horário!"); setIsSaving(false); return; }
          } else {
              for (const block of blocks) {
                 const startH = parseInt(block.time.split(':')[0]);
                 const reservationsAtStart = allRes.filter(r => r.date === selectedDate && r.time === block.time && r.status !== ReservationStatus.CANCELADA);
                 if (reservationsAtStart.length >= 2) { alert(`Limite de reservas atingido para ${block.time}.`); setIsSaving(false); return; }
                 for(let h=0; h<block.duration; h++) {
                     const { left } = checkHourCapacity(startH + h, selectedDate, allRes, settings.activeLanes);
                     if(left < formData.lanes) { alert(`Horário lotado.`); setIsSaving(false); return; }
                 }
              }
          }

          const newIds: string[] = [];
          for (const block of blocks) {
             let blockTotalValue = isManualMode ? parseFloat(manualPrice) : (totalValue / (blocks.reduce((acc, b) => acc + b.duration, 0))) * block.duration;
             if (isNaN(blockTotalValue)) blockTotalValue = 0;
             const res: Reservation = {
                 id: uuidv4(),
                 clientId: clientId || '',
                 clientName: formData.name,
                 date: selectedDate,
                 time: block.time,
                 peopleCount: formData.people,
                 laneCount: formData.lanes,
                 duration: block.duration,
                 totalValue: blockTotalValue,
                 eventType: formData.type,
                 observations: formData.obs + (isManualMode ? ' [Manual]' : ''),
                 status: ReservationStatus.PENDENTE,
                 paymentStatus: PaymentStatus.PENDENTE,
                 createdAt: new Date().toISOString(),
                 hasTableReservation: formData.wantsTable,
                 birthdayName: formData.wantsTable ? formData.birthdayName : undefined,
                 tableSeatCount: formData.wantsTable ? formData.tableSeatCount : undefined
             };
             await db.reservations.create(res, staffUser?.id);
             newIds.push(res.id);
          }
          setCreatedReservationIds(newIds);
          setExistingReservations(await db.reservations.getAll());
          setCurrentStep(4);
      } catch (e: any) { alert(`Erro: ${e.message}`); } finally { setIsSaving(false); }
  };

  const handlePaymentProcess = async (type: 'ONLINE' | 'CONFIRM_NOW' | 'PAY_ON_SITE') => {
      setIsSaving(true);
      try {
          if (type === 'CONFIRM_NOW' || type === 'ONLINE') {
              navigate('/checkout', { state: { ...formData, clientId, date: selectedDate, time: isManualMode ? manualStartTime : selectedTimes[0], totalValue, reservationBlocks, reservationIds: createdReservationIds } });
          } else if (type === 'PAY_ON_SITE') {
              const allRes = await db.reservations.getAll();
              for (const id of createdReservationIds) {
                  const res = allRes.find(r => r.id === id);
                  if (res) await db.reservations.update({ ...res, payOnSite: true, observations: (res.observations || '') + ' [Pgto Local]' }, staffUser?.id, 'Marcou para pagar no local');
              }
              navigate('/agenda');
          }
      } catch (e) { alert("Erro ao processar."); } finally { setIsSaving(false); }
  };

  const formattedDateDisplay = selectedDate ? selectedDate.split('-').reverse().join('/') : '';
  const reservationBlocks = getReservationBlocks();

  if (appLoading || isDataLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-neon-orange" size={48} /></div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col">
      <header className="bg-slate-900 p-4 shadow-md border-b border-slate-800 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          {!imgError ? (
             settings?.logoUrl ? <img src={settings.logoUrl} className="h-12 md:h-16 object-contain" onError={() => setImgError(true)} /> : <img src="/logo.png" className="h-12 md:h-16 object-contain" onError={() => setImgError(true)} />
           ) : <h1 className="text-2xl font-bold text-neon-orange">{settings?.establishmentName}</h1>}
          <div className="flex items-center gap-4">
            {/* PRIORIDADE NO HEADER: Se for cliente logado, volta para a conta do cliente */}
            {clientUser ? (
                <Link to="/minha-conta" className="text-neon-green bg-slate-800 px-3 py-2 rounded-lg text-sm border border-slate-700 flex items-center gap-2 transition hover:bg-slate-700">
                    <UserIcon size={16}/> Minha Conta
                </Link>
            ) : staffUser ? (
                <Link to="/agenda" className="text-neon-blue bg-slate-800 px-3 py-2 rounded-lg text-sm border border-slate-700 flex items-center gap-2 transition hover:bg-slate-700">
                    <LayoutDashboard size={16}/> Dashboard
                </Link>
            ) : (
                <Link to="/login" className="text-slate-600 p-2 hover:text-white transition">
                    <Lock size={18}/>
                </Link>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8 relative">
        <div className="max-w-3xl mx-auto">
          {currentStep < 5 && (
            <div className="mb-8 overflow-x-auto pb-2 no-scrollbar">
                <div className="flex justify-between min-w-[500px] mb-2 px-1">
                {steps.map((step, i) => (clientUser && i === 2) ? null : <div key={i} className={`text-[10px] md:text-xs font-bold uppercase tracking-wider ${i <= currentStep ? 'text-neon-blue' : 'text-slate-600'}`}>{step}</div>)}
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mx-1">
                <div className="h-full bg-gradient-to-r from-neon-orange to-neon-blue transition-all duration-500" style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}></div>
                </div>
            </div>
          )}

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-10 shadow-2xl min-h-[450px]">
            {currentStep === 0 && (
              <div className="animate-fade-in">
                <h2 className="text-xl md:text-2xl font-bold text-white mb-6 flex items-center gap-2 uppercase tracking-tight"><CalendarIcon className="text-neon-orange" /> Escolha a Data</h2>
                {renderCalendar()}
                <div className="mt-8 flex justify-between items-center">
                   <div className="text-slate-400 font-bold">{selectedDate ? `Data: ${formattedDateDisplay}` : 'Selecione uma data'}</div>
                   <button disabled={!selectedDate} onClick={handleNext} className="px-10 py-3 bg-neon-blue text-white font-bold rounded-xl hover:bg-blue-400 transition shadow-lg">PRÓXIMO</button>
                </div>
              </div>
            )}

            {currentStep === 1 && (
              <div className="animate-fade-in">
                <h2 className="text-xl md:text-2xl font-bold text-white mb-6 flex items-center gap-2 uppercase tracking-tight"><Clock className="text-neon-orange" /> Configuração e Horário</h2>
                <div className="bg-slate-800/50 p-5 rounded-2xl border border-slate-700 mb-6 space-y-4">
                    
                    {staffUser && (
                        <div className="flex items-center justify-between p-3 bg-neon-blue/10 border border-neon-blue/30 rounded-xl mb-2">
                            <div className="flex items-center gap-2">
                                <Zap className="text-neon-blue" size={18}/>
                                <div>
                                    <span className="text-xs font-bold text-white uppercase block">Agendamento Manual</span>
                                    <span className="text-[10px] text-slate-400 uppercase">Configurar horários e valor manualmente</span>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" className="sr-only peer" checked={isManualMode} onChange={(e) => setIsManualMode(e.target.checked)}/>
                                <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-neon-blue"></div>
                            </label>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Pessoas</label><input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white" value={peopleInput} onChange={e => handlePeopleChange(e.target.value)} onBlur={handlePeopleBlur} /></div>
                        <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Pistas</label><input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white" value={lanesInput} onChange={e => handleLanesChange(e.target.value)} onBlur={handleLanesBlur} /></div>
                        <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo de Evento</label><select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white" value={formData.type} onChange={e => handleInputChange('type', e.target.value)}>{EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                    </div>

                    {isManualMode && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-700 animate-scale-in">
                            <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Início (HH:MM)</label><input type="time" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white" value={manualStartTime} onChange={e => setManualStartTime(e.target.value)} /></div>
                            <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Fim (HH:MM)</label><input type="time" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white" value={manualEndTime} onChange={e => setManualEndTime(e.target.value)} /></div>
                            <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Valor Total (R$)</label><input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white font-bold text-neon-green" placeholder="0,00" value={manualPrice} onChange={e => setManualPrice(e.target.value)} /></div>
                        </div>
                    )}

                    <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Observações</label><textarea className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-white h-20 text-sm" value={formData.obs} onChange={e => handleInputChange('obs', e.target.value)} /></div>
                    <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700">
                        <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" className="w-5 h-5 accent-neon-orange" checked={formData.wantsTable} onChange={e => handleInputChange('wantsTable', e.target.checked)} /><span className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-tighter"><Utensils size={18} className="text-neon-orange"/> Reservar Mesa no Restaurante?</span></label>
                        {formData.wantsTable && (
                            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 pl-6 border-l-2 border-neon-orange/30 animate-scale-in">
                                <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cadeiras (Máx 25)</label><input type="number" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white" value={seatInput} onChange={e => handleSeatChange(e.target.value)} onBlur={handleSeatBlur} /></div>
                                {(formData.type === EventType.ANIVERSARIO) && (<div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nome do Aniversariante</label><input type="text" className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-white" value={formData.birthdayName} onChange={e => handleInputChange('birthdayName', e.target.value)} /></div>)}
                            </div>
                        )}
                    </div>
                </div>
                {!isManualMode && (
                    <div className="mb-8">
                        <h3 className="text-xs font-bold text-slate-500 uppercase mb-4 tracking-widest border-b border-slate-800 pb-2">Horários Disponíveis</h3>
                        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                            {timeSlots.map(slot => (
                                <button key={slot.time} disabled={!slot.available} onClick={() => toggleTimeSelection(slot.time)} className={`p-3 rounded-lg text-xs font-bold border transition-all ${selectedTimes.includes(slot.time) ? 'bg-neon-blue text-white border-neon-blue shadow-lg scale-105' : !slot.available ? 'bg-slate-900 text-slate-700 border-slate-800 cursor-not-allowed opacity-50' : 'bg-slate-800 text-slate-300 border-slate-700 hover:border-slate-500'}`}>{slot.label}</button>
                            ))}
                        </div>
                    </div>
                )}
                <div className="flex justify-between items-center pt-6 border-t border-slate-800">
                    <button onClick={handleBack} className="px-6 py-3 rounded-xl border border-slate-700 text-slate-500 font-bold hover:text-white transition uppercase text-xs">Voltar</button>
                    <button onClick={handleNext} className="px-10 py-3 bg-neon-blue text-white font-bold rounded-xl hover:bg-blue-500 shadow-xl transition uppercase text-xs">Continuar</button>
                </div>
              </div>
            )}

            {currentStep === 2 && (
                <div className="animate-fade-in">
                    <h2 className="text-xl md:text-2xl font-bold text-white mb-6 flex items-center gap-2 uppercase tracking-tight"><UserIcon className="text-neon-orange" /> Seus Dados</h2>
                    
                    {!staffUser && !clientUser && (
                        <div className="flex border-b border-slate-700 mb-8">
                            <button onClick={() => { setAuthMode('LOGIN'); setIsForgotPassMode(false); }} className={`flex-1 py-4 text-xs font-bold uppercase transition border-b-2 ${authMode === 'LOGIN' ? 'border-neon-orange text-white' : 'border-transparent text-slate-500 hover:text-white'}`}>Já tenho conta</button>
                            <button onClick={() => setAuthMode('REGISTER')} className={`flex-1 py-4 text-xs font-bold uppercase transition border-b-2 ${authMode === 'REGISTER' ? 'border-neon-blue text-white' : 'border-transparent text-slate-500 hover:text-white'}`}>Novo Cadastro</button>
                        </div>
                    )}

                    {authMode === 'LOGIN' && !staffUser && !clientUser ? (
                        !isForgotPassMode ? (
                            <form onSubmit={handleInlineLogin} className="space-y-5 max-w-md mx-auto">
                                <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">E-mail Cadastrado</label><input type="email" required className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-neon-orange outline-none" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} /></div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Senha</label>
                                    <input type="password" required className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-neon-orange outline-none" value={loginPass} onChange={e => setLoginPass(e.target.value)} />
                                    <button type="button" onClick={() => setIsForgotPassMode(true)} className="text-[10px] text-neon-blue hover:underline mt-2 font-bold uppercase">Esqueci minha senha</button>
                                </div>
                                <button type="submit" disabled={isLoggingIn} className="w-full bg-neon-orange hover:bg-orange-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg transition uppercase text-sm">{isLoggingIn ? <Loader2 className="animate-spin"/> : <LogIn size={18} />} ENTRAR</button>
                            </form>
                        ) : (
                            <form onSubmit={handleRequestReset} className="space-y-5 max-w-md mx-auto animate-fade-in">
                                <h3 className="text-white font-bold flex items-center gap-2 uppercase text-sm"><Mail size={16} className="text-neon-blue"/> Recuperar Senha</h3>
                                {resetSent ? (
                                    <div className="p-4 bg-green-500/10 border border-green-500/30 text-green-400 rounded-xl text-xs text-center font-bold">LINK ENVIADO! VERIFIQUE SEU E-MAIL.</div>
                                ) : (
                                    <>
                                        <p className="text-xs text-slate-400">Informe seu e-mail cadastrado para receber as instruções de redefinição.</p>
                                        <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">E-mail</label><input type="email" required className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:border-neon-blue outline-none" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} /></div>
                                        <div className="flex gap-3">
                                            <button type="button" onClick={() => setIsForgotPassMode(false)} className="flex-1 bg-slate-700 text-white font-bold py-3 rounded-xl uppercase text-xs">Voltar</button>
                                            <button type="submit" disabled={isLoggingIn} className="flex-[2] bg-neon-blue text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 uppercase text-xs shadow-lg">{isLoggingIn ? <Loader2 className="animate-spin"/> : 'Enviar Link'}</button>
                                        </div>
                                    </>
                                )}
                            </form>
                        )
                    ) : (
                        <div className="space-y-4">
                            <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nome Completo *</label><input type="text" className={`w-full bg-slate-800 border rounded-xl p-3 text-white outline-none focus:border-neon-blue ${errors.name ? 'border-red-500' : 'border-slate-700'}`} value={formData.name} onChange={e => handleInputChange('name', e.target.value)} /></div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">WhatsApp *</label><input type="tel" className={`w-full bg-slate-800 border rounded-xl p-3 text-white outline-none focus:border-neon-blue ${errors.whatsapp ? 'border-red-500' : 'border-slate-700'}`} value={formData.whatsapp} onChange={e => handlePhoneChange(e, 'whatsapp')} /></div>
                                <div><label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">E-mail *</label><input type="email" className={`w-full bg-slate-800 border rounded-xl p-3 text-white outline-none focus:border-neon-blue ${errors.email ? 'border-red-500' : 'border-slate-700'}`} value={formData.email} onChange={e => handleInputChange('email', e.target.value)} /></div>
                            </div>
                            
                            {!clientUser && !staffUser && (
                                <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 mt-6 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10"><Shield size={48}/></div>
                                    <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2 uppercase tracking-tighter"><Lock size={16} className="text-neon-blue"/> Crie uma senha de acesso</h4>
                                    <p className="text-[10px] text-slate-500 mb-4 font-bold uppercase">O cadastro garante sua vaga e histórico de fidelidade.</p>
                                    <input type="password" placeholder="Sua senha segura" className={`w-full bg-slate-900 border rounded-xl p-3 text-white focus:border-neon-blue outline-none transition ${errors.password ? 'border-red-500' : 'border-slate-700'}`} value={formData.password} onChange={e => handleInputChange('password', e.target.value)} />
                                </div>
                            )}

                            <div className="flex justify-between items-center mt-10 pt-6 border-t border-slate-800">
                                <button onClick={handleBack} className="px-6 py-3 rounded-xl border border-slate-700 text-slate-500 font-bold hover:text-white transition uppercase text-xs">Voltar</button>
                                <button onClick={handleNext} disabled={isSaving} className="px-10 py-3 bg-neon-blue text-white font-bold rounded-xl flex items-center gap-2 shadow-xl hover:bg-blue-500 transition uppercase text-xs">{isSaving ? <Loader2 className="animate-spin" /> : 'Continuar'}</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {currentStep === 3 && (
                <div className="animate-fade-in">
                    <h2 className="text-xl md:text-2xl font-bold text-white mb-6 flex items-center gap-2 uppercase tracking-tight"><CheckCircle className="text-neon-orange" /> Resumo Final</h2>
                    <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 space-y-5">
                        <div className="flex justify-between items-center border-b border-slate-700 pb-3"><span className="text-xs font-bold text-slate-500 uppercase">Data</span><span className="text-white font-bold">{formattedDateDisplay}</span></div>
                        <div className="flex justify-between items-start border-b border-slate-700 pb-3"><span className="text-xs font-bold text-slate-500 uppercase">Horário(s)</span><span className="text-white font-bold text-right">{reservationBlocks.map((b, i) => <div key={i}>{b.time} ({b.duration}h)</div>)}</span></div>
                        <div className="flex justify-between items-center border-b border-slate-700 pb-3"><span className="text-xs font-bold text-slate-500 uppercase">Configuração</span><span className="text-white font-bold">{formData.lanes} Pista(s) • {formData.people} Pessoas</span></div>
                        <div className="flex justify-between items-center pt-4"><span className="text-lg font-bold text-white uppercase tracking-tighter">Total a Pagar</span><span className="text-3xl font-bold text-neon-green">{totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                    </div>
                    <div className="flex justify-between items-center mt-10 pt-6 border-t border-slate-800">
                        <button onClick={handleBack} className="px-6 py-3 rounded-xl border border-slate-700 text-slate-500 font-bold hover:text-white transition uppercase text-xs">Voltar</button>
                        <button onClick={handleNext} disabled={isSaving} className="px-10 py-3 bg-neon-green text-black font-bold rounded-xl flex items-center gap-2 shadow-xl hover:bg-green-400 transition uppercase text-xs">{isSaving ? <Loader2 className="animate-spin" /> : 'CONFIRMAR AGENDAMENTO'}</button>
                    </div>
                </div>
            )}

            {currentStep === 4 && (
                <div className="animate-fade-in py-4 text-center">
                    <div className="w-20 h-20 bg-neon-green/20 rounded-full flex items-center justify-center mx-auto mb-6 text-neon-green border border-neon-green/50 shadow-[0_0_20px_rgba(34,197,94,0.3)] animate-bounce"><CheckCircle size={44} /></div>
                    <h2 className="text-3xl font-bold text-white mb-2 tracking-tight uppercase">Reserva Iniciada!</h2>
                    <p className="text-slate-400 mb-8 max-w-sm mx-auto text-sm">Quase lá! Para garantir sua pista, precisamos que conclua o pagamento abaixo.</p>

                    <div className="bg-red-500/10 border border-red-500/30 p-5 rounded-2xl mb-8 flex flex-col items-center gap-3 animate-pulse max-w-md mx-auto">
                        <AlertTriangle className="text-red-500" size={32} />
                        <div>
                            <p className="text-red-400 font-bold text-sm uppercase mb-1">Atenção: Prazo de Pagamento</p>
                            <p className="text-[11px] text-red-300 uppercase font-medium leading-relaxed">
                                Você tem <strong>30 minutos</strong> para concluir o pagamento. Caso contrário, sua reserva será cancelada e o horário liberado automaticamente.
                            </p>
                        </div>
                    </div>

                    <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl mb-8 max-w-sm mx-auto space-y-3 text-left">
                        <div className="flex items-center gap-3 text-slate-300 text-sm"><CalendarIcon size={16} className="text-neon-blue"/><span className="font-bold">{formattedDateDisplay} às {reservationBlocks[0]?.time}</span></div>
                        <div className="flex items-center gap-3 text-slate-300 text-sm"><Hash size={16} className="text-neon-blue"/><span className="font-bold">{formData.lanes} Pista(s) • {formData.people} Pessoas</span></div>
                        <div className="flex items-center gap-3 text-neon-green font-bold text-xl pt-2 border-t border-slate-700"><DollarSign size={20}/><span className="text-2xl">{totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></div>
                    </div>

                    {!staffUser ? (
                        <div className="max-w-sm mx-auto">
                            <button onClick={() => handlePaymentProcess('ONLINE')} disabled={isSaving} className="w-full py-5 bg-gradient-to-r from-neon-orange to-orange-600 text-white font-bold rounded-2xl flex items-center justify-center gap-3 shadow-2xl hover:scale-105 transition-all uppercase text-sm tracking-widest">
                                {isSaving ? <Loader2 className="animate-spin" /> : <><CreditCard /> EFETUAR PAGAMENTO AGORA</>}
                            </button>
                            <p className="mt-4 text-[10px] text-slate-500 uppercase font-bold tracking-widest flex items-center justify-center gap-2"><ShieldCheck size={14}/> Pagamento Seguro via Mercado Pago</p>
                        </div>
                    ) : (
                        <div className="max-w-sm mx-auto space-y-4">
                            <button onClick={() => handlePaymentProcess('CONFIRM_NOW')} className="w-full py-4 bg-green-600 text-white font-bold rounded-2xl shadow-lg uppercase text-xs tracking-widest">Confirmar Pagamento Agora</button>
                            <button onClick={() => handlePaymentProcess('PAY_ON_SITE')} className="w-full py-4 bg-slate-800 text-slate-300 font-bold rounded-2xl border border-slate-700 uppercase text-xs tracking-widest">Lançar na Comanda / Local</button>
                        </div>
                    )}
                </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default PublicBooking;
