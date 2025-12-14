
// ... existing imports ...
import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { db } from '../services/mockBackend';
import { supabase } from '../services/supabaseClient';
import { Integrations } from '../services/integrations';
import { useApp } from '../contexts/AppContext';
import { generateDailySlots, checkHourCapacity } from '../utils/availability';
import { EventType, ReservationStatus, PaymentStatus, Reservation, FunnelStage, UserRole } from '../types';
import { EVENT_TYPES, INITIAL_SETTINGS } from '../constants';
import { CheckCircle, Calendar as CalendarIcon, Clock, Users, ChevronRight, DollarSign, ChevronLeft, Lock, LayoutDashboard, Loader2, UserPlus, Mail, Phone, User as UserIcon, AlertCircle, XCircle, ShieldCheck, CreditCard, ArrowRight, Cake, Utensils, MessageCircle, LogIn, AlertTriangle, Store, Settings, PenTool } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

const steps = ['Data', 'Configuração & Horário', 'Seus Dados', 'Resumo', 'Pagamento'];

const PublicBooking: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation(); // Hook para acessar state da navegação
  const { settings, user: staffUser, loading: appLoading } = useApp();
  
  // Client Authentication State
  const [clientUser, setClientUser] = useState<any>(null);
  
  // Inline Auth State (Login inside Booking)
  const [authMode, setAuthMode] = useState<'REGISTER' | 'LOGIN'>('REGISTER');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
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
  
  // Manual Mode State (Staff Only)
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualStartTime, setManualStartTime] = useState('18:00');
  const [manualEndTime, setManualEndTime] = useState('19:00');
  const [manualPrice, setManualPrice] = useState<string>('');

  // State for Inputs (Allow empty string for typing)
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
    name: '',
    whatsapp: '',
    email: '',
    password: '', 
    // Option to create account or continue as guest (default true for loyalty unless staff)
    createAccount: true, 
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
                  whatsapp: parsedClient.phone,
                  createAccount: false // Already has account
              }));
              setClientId(parsedClient.id);
          } catch (e) {
              console.error("Error parsing client auth", e);
          }
      } else {
          // If staff is booking for someone else, default createAccount to false (guest mode default)
          if (staffUser) {
              setFormData(prev => ({ ...prev, createAccount: false }));
          }
      }
  }, [staffUser]);

  // Check for prefilled client data from CRM
  useEffect(() => {
      if (location.state?.prefilledClient) {
          const c = location.state.prefilledClient;
          setFormData(prev => ({
              ...prev,
              name: c.name,
              email: c.email || '',
              whatsapp: c.phone,
              createAccount: false // Client already exists
          }));
          setClientId(c.id);
      }
  }, [location.state]);

  // Sync seatInput with formData.tableSeatCount (for when it's updated automatically)
  useEffect(() => {
      const currentVal = parseInt(seatInput) || 0;
      if (currentVal !== formData.tableSeatCount) {
          // Only update if different to avoid cursor jumping, or if empty and data is 0
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
  // Use Manual Price if mode is active and price is set, otherwise calc standard
  const totalValue = isManualMode && manualPrice ? parseFloat(manualPrice) : (currentPrice * formData.lanes * (totalDuration || 0));

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
        setIsDataLoading(true);
        try {
            // Timeout de segurança para evitar loading infinito
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error("Timeout")), 8000)
            );

            const dataPromise = db.reservations.getAll();
            
            // Corrida entre dados e timeout
            const all = await Promise.race([dataPromise, timeoutPromise]) as any[];
            
            if (isMounted) setExistingReservations(all);
        } catch (e) { 
            console.error("Erro ao carregar reservas:", e);
        } finally {
            if (isMounted) setIsDataLoading(false);
        }
    };
    fetchData();

    // --- REALTIME UPDATE FOR BOOKING ---
    // Update availability in real-time to avoid conflicts
    const channel = supabase.channel('public_booking_updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas' }, async () => {
             // Re-fetch since local cache in mockBackend is cleared by global listener
             console.log('Realtime update detected in Booking, refreshing data...');
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
      // Limite de cadeiras
      if (field === 'tableSeatCount' && typeof value === 'number') {
          // Regra base: Limite total de 25 cadeiras por reserva
          let maxAllowed = 25;
          
          // Exceção: Se o nº pessoas for maior que 25, o limite é o nº de pessoas (até 36)
          if (formData.people > 25) {
             maxAllowed = formData.people;
          }
          
          // Teto absoluto do sistema
          if (maxAllowed > 36) maxAllowed = 36;

          if (value > maxAllowed) {
              alert(`O limite máximo permitido para esta configuração é de ${maxAllowed} cadeiras.`);
              value = maxAllowed;
          }
      }

      setFormData(prev => ({ ...prev, [field]: value }));
      if (errors[field]) setErrors(prev => ({ ...prev, [field]: false }));
  };

  // --- INPUT HANDLERS (PEOPLE & LANES & SEATS) ---
  const handlePeopleChange = (val: string) => {
      setPeopleInput(val); // Atualiza o estado visual imediatamente
      if (val === '') return;
      
      const num = parseInt(val);
      if (!isNaN(num)) {
          const suggestedLanes = Math.ceil(num / 6);
          setFormData(prev => {
              let newSeatCount = prev.tableSeatCount;
              // Se numero de pessoas muda, verificar se as cadeiras excedem a nova regra
              // Regra: Base 25, ou igual a Num Pessoas se > 25.
              let maxAllowed = 25;
              if (num > 25) maxAllowed = num;
              if (maxAllowed > 36) maxAllowed = 36;

              // Ajusta cadeiras se exceder o novo maximo permitido
              if (prev.tableSeatCount > maxAllowed) {
                  newSeatCount = maxAllowed;
              }
              return { 
                  ...prev, 
                  people: num, 
                  lanes: suggestedLanes,
                  tableSeatCount: newSeatCount
              };
          });
          setLanesInput(suggestedLanes.toString());
      }
  };

  const handlePeopleBlur = () => {
      let num = parseInt(peopleInput);
      if (isNaN(num) || num < 1) num = 1;
      
      // Limite de 36 pessoas por reserva
      if (num > 36) {
          num = 36; 
          alert("Máximo de 36 pessoas por reserva.");
      }
      setPeopleInput(num.toString());
      
      const suggestedLanes = Math.ceil(num / 6);
      setFormData(prev => {
          let newSeatCount = prev.tableSeatCount;
          let maxAllowed = 25;
          if (num > 25) maxAllowed = num;
          if (maxAllowed > 36) maxAllowed = 36;

          if (prev.tableSeatCount > maxAllowed) {
              newSeatCount = maxAllowed;
          }
          return { 
              ...prev, 
              people: num, 
              lanes: suggestedLanes,
              tableSeatCount: newSeatCount
          };
      });
      setLanesInput(suggestedLanes.toString());
  };

  const handleSeatChange = (val: string) => {
      setSeatInput(val);
      if (val === '') {
          handleInputChange('tableSeatCount', 0);
          return;
      }
      const num = parseInt(val);
      if (!isNaN(num)) {
          handleInputChange('tableSeatCount', num);
      }
  };

  const handleSeatBlur = () => {
      // Opcional: Forçar valor mínimo se estiver vazio, ou deixar 0
      if (seatInput === '') {
          // setSeatInput('0');
      }
  };

  const handleLanesChange = (val: string) => {
      setLanesInput(val);
      if (val === '') return;
      
      const num = parseInt(val);
      if (!isNaN(num)) {
          setFormData(prev => ({ ...prev, lanes: num }));
          setSelectedTimes([]); 
      }
  };

  const handleLanesBlur = () => {
      let num = parseInt(lanesInput);
      if (isNaN(num) || num < 1) num = 1;
      if (settings && num > settings.activeLanes) num = settings.activeLanes;
      
      setLanesInput(num.toString());
      setFormData(prev => ({ ...prev, lanes: num }));
      setSelectedTimes([]);
  };
  // ----------------------------------------

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isValidPhone = (phone: string) => {
      const clean = phone.replace(/\D/g, '');
      return clean.length >= 10 && clean.length <= 11;
  };

  // --- AUTH HANDLERS ---
  const handleInlineLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsLoggingIn(true);
      try {
          const { client, error } = await db.clients.login(loginEmail, loginPass);
          if (error || !client) {
              alert(error || "Erro ao entrar.");
          } else {
              // Sucesso
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
              // Avança automaticamente para o resumo
              setCurrentStep(3);
          }
      } catch (err) {
          console.error(err);
          alert("Erro técnico ao realizar login.");
      } finally {
          setIsLoggingIn(false);
      }
  };

  // CHECK PERMISSIONS FOR OPTIONAL CONTACT
  const isContactOptional = staffUser && (
      staffUser.role === UserRole.ADMIN || 
      staffUser.role === UserRole.GESTOR || 
      staffUser.perm_create_reservation_no_contact
  );

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
            
            // EMAIL & PHONE VALIDATION LOGIC
            // If contact is optional (Admin/Gestor/Permitted), only validate format IF they typed something
            if (isContactOptional) {
                if (formData.email.trim() && !isValidEmail(formData.email)) newErrors.email = true;
                if (formData.whatsapp.trim() && !isValidPhone(formData.whatsapp)) newErrors.whatsapp = true;
            } else {
                // Mandatory for public and restricted staff
                if (!formData.email.trim() || !isValidEmail(formData.email)) newErrors.email = true;
                if (!formData.whatsapp.trim() || !isValidPhone(formData.whatsapp)) newErrors.whatsapp = true;
            }
            
            // Validate password ONLY if creating account AND NOT Staff
            if (!clientUser && !staffUser && formData.createAccount && !formData.password.trim()) {
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
                alert("Limite de 25 mesas esgotado para esta data. Por favor, desmarque a reserva de mesa ou escolha outra data.");
                return;
            }
        }

        if (clientUser) {
            // Logged in client -> Skip Data Step
            setCurrentStep(3); 
        } else {
            // Not logged in (or Staff) -> Go to Data Step
            setCurrentStep(c => c + 1);
        }
    } else if (currentStep === 2) {
        setIsSaving(true);
        try {
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

            // Logic Split: Create Account vs Guest
            // If clientId is already set (prefilled from CRM), skip creation
            if (clientId && staffUser) {
                 setCurrentStep(c => c + 1);
                 setIsSaving(false);
                 return;
            }

            if (formData.createAccount && !staffUser) {
                // Register with password (Client Mode - Public)
                const { client, error } = await db.clients.register(newClientData, formData.password);
                if (error) {
                    const errorMsg = typeof error === 'string' ? error : 'Erro desconhecido ao criar conta.';
                    alert(errorMsg);
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
                // Guest OR Staff Mode
                // Verifica se tem contato preenchido (Telefone ou Email)
                const phoneClean = formData.whatsapp.replace(/\D/g, '');
                const hasContact = phoneClean.length > 0 || formData.email.trim().length > 0;

                if (staffUser && !hasContact) {
                    // CASO: Staff criando reserva sem nenhum contato (Cliente Balcão/Rápido)
                    console.log("Criando reserva sem cadastro de cliente (Sem contato)");
                    setClientId(''); 
                    setCurrentStep(c => c + 1);
                } else {
                    // CASO NORMAL: Tem contato, cria ou atualiza cliente no banco
                    // Isso garante que temos um Client ID válido para usar na reserva
                    const client = await db.clients.create(newClientData, staffUser?.id); 
                    setClientId(client.id);
                    setCurrentStep(c => c + 1);
                }
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
    
    // Check specific blocked dates
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
        <div className="mt-4 flex justify-center items-center gap-4 text-xs text-slate-500">
           <div className="flex items-center gap-1"><div className="w-3 h-3 bg-slate-800 border border-slate-700 rounded"></div> Disponível</div>
           <div className="flex items-center gap-1"><div className="w-3 h-3 bg-neon-orange rounded"></div> Selecionado</div>
           <div className="flex items-center gap-1"><div className="w-3 h-3 bg-slate-900 opacity-50 rounded"></div> Fechado</div>
        </div>
      </div>
    );
  };

  // PASS STAFF STATUS TO GENERATOR FOR 5-MIN TOLERANCE
  const timeSlots = generateDailySlots(selectedDate, settings, existingReservations, undefined, !!staffUser);

  const toggleTimeSelection = (time: string) => {
      setSelectedTimes(prev => {
          if (prev.includes(time)) {
              return prev.filter(t => t !== time);
          } else {
              return [...prev, time].sort((a, b) => parseInt(a) - parseInt(b));
          }
      });
  };

  const getReservationBlocks = () => {
    if (isManualMode) {
        // Approximate Duration Calculation for Manual Mode (Just for display/save, not for slots logic)
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
          // Force fresh fetch for validation just in case
          const allRes = await db.reservations.getAll();
          
          if (isManualMode) {
              // --- MANUAL CONFLICT CHECK (SIMPLE) ---
              // Convert manual time to minutes for comparison
              const [hStart, mStart] = manualStartTime.split(':').map(Number);
              const [hEnd, mEnd] = manualEndTime.split(':').map(Number);
              const newStartMins = hStart * 60 + mStart;
              const newEndMins = hEnd * 60 + mEnd;

              if (newEndMins <= newStartMins) {
                  alert("Hora de fim deve ser maior que hora de início.");
                  setIsSaving(false); return;
              }

              // Count conflicting lanes
              const conflictingLanes = allRes.filter(r => {
                  if (r.date !== selectedDate || r.status === ReservationStatus.CANCELADA) return false;
                  
                  // Convert existing res to minutes
                  const [rH, rM] = r.time.split(':').map(Number);
                  const resStartMins = rH * 60 + rM;
                  const resEndMins = resStartMins + (r.duration * 60);

                  // Check Overlap: (StartA < EndB) and (EndA > StartB)
                  return (newStartMins < resEndMins) && (newEndMins > resStartMins);
              }).reduce((acc, curr) => acc + curr.laneCount, 0);

              const availableLanes = settings.activeLanes - conflictingLanes;
              if (availableLanes < formData.lanes) {
                  alert(`Conflito de horário! Apenas ${availableLanes} pista(s) disponível(is) neste intervalo.`);
                  setIsSaving(false); return;
              }

          } else {
              // --- STANDARD SLOT CHECK ---
              for (const block of blocks) {
                 const startH = parseInt(block.time.split(':')[0]);
                 
                 // 1. Check Reservation Count Limit (Max 2 per slot)
                 const reservationsAtStart = allRes.filter(r => 
                     r.date === selectedDate && 
                     r.time === block.time && 
                     r.status !== ReservationStatus.CANCELADA
                 );
                 
                 // 2. Check Total People Limit (Max 50 total per slot)
                 const totalPeopleAtStart = reservationsAtStart.reduce((sum, r) => sum + r.peopleCount, 0);

                 if (reservationsAtStart.length >= 2) {
                     alert(`O horário das ${block.time} atingiu o limite de reservas simultâneas.`);
                     setIsSaving(false);
                     return;
                 }

                 if (totalPeopleAtStart + formData.people > 50) {
                     alert(`O horário das ${block.time} atingiu a capacidade máxima de pessoas (Máx 50).`);
                     setIsSaving(false);
                     return;
                 }

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
          }

          const newIds: string[] = [];
          for (const block of blocks) {
             // If manual, value is already set in totalValue variable
             let blockTotalValue = isManualMode 
                ? parseFloat(manualPrice) 
                : (totalValue / (blocks.reduce((acc, b) => acc + b.duration, 0))) * block.duration;

             // PROTECTION: Ensure value is a valid number, otherwise set to 0
             if (isNaN(blockTotalValue) || !isFinite(blockTotalValue)) {
                 blockTotalValue = 0;
                 console.warn("Valor da reserva inválido (NaN), ajustado para 0.");
             }

             const res: Reservation = {
                 id: uuidv4(),
                 clientId: clientId || '', // Uses confirmed clientId from state
                 clientName: formData.name,
                 date: selectedDate,
                 time: block.time,
                 peopleCount: formData.people,
                 laneCount: formData.lanes,
                 duration: block.duration,
                 totalValue: blockTotalValue,
                 eventType: formData.type,
                 observations: formData.obs + (isManualMode ? ' [Agendamento Manual]' : ''),
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
             // Pass staffUser.id if staff is creating the reservation
             await db.reservations.create(res, staffUser?.id);
             newIds.push(res.id);
          }

          setCreatedReservationIds(newIds);
          // Update local state with fresh data including the new one
          setExistingReservations(await db.reservations.getAll());
          setCurrentStep(4);

      } catch (e: any) {
          console.error(e);
          // Melhoria na mensagem de erro para debug
          alert(`Erro ao criar agendamento: ${e.message || 'Erro de conexão ou dados inválidos.'}`);
      } finally {
          setIsSaving(false);
      }
  };

  const handlePaymentProcess = async (type: 'ONLINE' | 'CONFIRM_NOW' | 'PAY_ON_SITE') => {
      setIsSaving(true);
      try {
          if (type === 'CONFIRM_NOW') {
              // Staff confirmou pagamento total agora
              navigate('/checkout', { state: { ...formData, clientId: clientId, date: selectedDate, time: isManualMode ? manualStartTime : selectedTimes[0], totalValue, reservationBlocks, reservationIds: createdReservationIds } });
          } else if (type === 'PAY_ON_SITE') {
              // Staff marcou para pagar no local
              const allRes = await db.reservations.getAll();
              for (const id of createdReservationIds) {
                  const res = allRes.find(r => r.id === id);
                  if (res) {
                      const updatedRes = { 
                          ...res, 
                          payOnSite: true,
                          observations: (res.observations || '') + ' [Pagamento no Local]'
                      };
                      await db.reservations.update(updatedRes, staffUser?.id, 'Marcou para pagar no local');
                  }
              }
              alert("Reserva marcada para pagamento no local. O horário não será cancelado automaticamente.");
              navigate('/agenda');

          } else {
             // Fluxo Cliente (Online) -> Passa ID do cliente para garantir vínculo
             navigate('/checkout', { state: { ...formData, clientId: clientId, date: selectedDate, time: isManualMode ? manualStartTime : selectedTimes[0], totalValue, reservationBlocks, reservationIds: createdReservationIds } });
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
             settings && settings.logoUrl ? (
                <img src={settings.logoUrl} alt={settings.establishmentName} className="h-12 md:h-16 object-contain" onError={() => setImgError(true)} />
             ) : (
                <img src="/logo.png" alt="Tô Na Pista" className="h-12 md:h-16 object-contain" onError={() => setImgError(true)} />
             )
           ) : (
             <h1 className="text-2xl font-bold text-neon-orange font-sans tracking-tighter leading-none">{settings?.establishmentName || 'Boliche'}</h1>
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

      <main className="flex-1 p-4 md:p-8 relative">
        <div className="max-w-3xl mx-auto">
          {currentStep < 5 && (
            <div className="mb-8">
                <div className="flex justify-between mb-2">
                {steps.map((step, i) => {
                    // Hide 'Seus Dados' step if skipped (client logged in)
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

          {/* ... Rest of the component (Steps Logic) remains largely the same ... */}
          {/* JUST WRAPPING THE REMAINDER OF COMPONENT FOR XML VALIDITY - NO CHANGES NEEDED IN UI */}
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
                
                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 mb-6">
                    <h3 className="text-sm font-bold text-slate-300 uppercase mb-3">Detalhes do Evento</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* INPUTS */}
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Nº Pessoas</label>
                            <input 
                                type="number" 
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 focus:border-neon-orange focus:outline-none text-white" 
                                value={peopleInput} 
                                onChange={e => handlePeopleChange(e.target.value)}
                                onBlur={handlePeopleBlur} 
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Nº Pistas</label>
                            <input type="number" min="1" max={settings.activeLanes} className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 focus:border-neon-orange focus:outline-none text-white font-bold" 
                                value={lanesInput} 
                                onChange={e => handleLanesChange(e.target.value)} 
                                onBlur={handleLanesBlur}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 mb-1">Tipo</label>
                            <select className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 focus:border-neon-orange focus:outline-none text-white" value={formData.type} onChange={e => { const newType = e.target.value as EventType; setFormData(prev => ({ ...prev, type: newType })); }}>
                                {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="mt-4">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Observações</label>
                        <textarea className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 focus:border-neon-orange focus:outline-none text-white h-20" placeholder="Algum detalhe especial?" value={formData.obs} onChange={e => setFormData(prev => ({ ...prev, obs: e.target.value }))} />
                    </div>

                    <div className="mt-4 bg-slate-900/50 p-3 rounded border border-slate-700">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" className="w-4 h-4 accent-neon-orange" checked={formData.wantsTable} onChange={e => setFormData(prev => ({ ...prev, wantsTable: e.target.checked }))} />
                            <span className="text-sm font-bold text-white flex items-center gap-2"><Utensils size={16}/> Reservar Mesa no Restaurante?</span>
                        </label>
                        
                        {formData.wantsTable && (
                            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 pl-6 border-l-2 border-slate-700 animate-fade-in">
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Qtd. Lugares (Máx 25)</label>
                                    <input type="number" min="1" max="25" className={`w-full bg-slate-800 border rounded-lg p-2 text-white ${errors.tableSeatCount ? 'border-red-500' : 'border-slate-600'}`} value={seatInput} onChange={e => handleSeatChange(e.target.value)} onBlur={handleSeatBlur} />
                                </div>
                                {(formData.type === EventType.ANIVERSARIO || formData.type === EventType.FAMILIA) && (
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Nome do Aniversariante</label>
                                        <input type="text" className={`w-full bg-slate-800 border rounded-lg p-2 text-white ${errors.birthdayName ? 'border-red-500' : 'border-slate-600'}`} value={formData.birthdayName} onChange={e => handleInputChange('birthdayName', e.target.value)} />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* STAFF: MANUAL MODE TOGGLE */}
                {staffUser && (
                    <div className="mb-6 p-4 bg-slate-800 border border-neon-blue/30 rounded-lg animate-fade-in">
                        <label className="flex items-center gap-3 cursor-pointer mb-4">
                            <input 
                                type="checkbox" 
                                className="w-5 h-5 accent-neon-blue" 
                                checked={isManualMode} 
                                onChange={(e) => {
                                    setIsManualMode(e.target.checked);
                                    if (e.target.checked) setSelectedTimes([]); 
                                }} 
                            />
                            <span className="text-neon-blue font-bold flex items-center gap-2"><PenTool size={18}/> Definir manualmente horário da reserva</span>
                        </label>

                        {isManualMode && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-8 border-l-2 border-slate-700">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Hora Início</label>
                                    <input type="time" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" value={manualStartTime} onChange={e => setManualStartTime(e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Hora Fim</label>
                                    <input type="time" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" value={manualEndTime} onChange={e => setManualEndTime(e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Valor Personalizado (R$)</label>
                                    <input type="number" step="0.01" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white font-bold text-neon-green" placeholder="0,00" value={manualPrice} onChange={e => setManualPrice(e.target.value)} />
                                </div>
                                <div className="col-span-full text-xs text-slate-500 italic">
                                    Modo manual ignora regras de duração padrão. O sistema verificará conflitos exatos.
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {!isManualMode && (
                    <div className="mb-6">
                        <h3 className="text-sm font-bold text-slate-300 uppercase mb-3">Horários Disponíveis</h3>
                        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                            {timeSlots.map(slot => (
                                <button
                                    key={slot.time}
                                    disabled={!slot.available}
                                    onClick={() => toggleTimeSelection(slot.time)}
                                    className={`p-2 rounded text-xs font-bold border transition ${
                                        selectedTimes.includes(slot.time) 
                                            ? 'bg-neon-blue text-white border-neon-blue' 
                                            : !slot.available 
                                                ? 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed' 
                                                : 'bg-slate-800 text-slate-300 border-slate-600 hover:border-slate-400'
                                    }`}
                                >
                                    {slot.label}
                                </button>
                            ))}
                        </div>
                        {staffUser && timeSlots.some(s => s.isPast && s.available) && (
                            <p className="text-xs text-neon-blue mt-2 italic">* Horários recentes liberados (Tolerância Staff 5min)</p>
                        )}
                        {selectedTimes.length > 0 && (
                            <div className="mt-4 p-3 bg-neon-blue/10 border border-neon-blue/30 rounded text-neon-blue text-sm font-bold text-center">
                                {selectedTimes.length} hora(s) selecionada(s) • Total: {(currentPrice * formData.lanes * selectedTimes.length).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </div>
                        )}
                    </div>
                )}

                <div className="flex justify-between">
                    <button onClick={handleBack} className="px-6 py-3 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800">Voltar</button>
                    <button onClick={handleNext} className="px-6 py-3 bg-neon-blue text-white font-bold rounded-lg hover:bg-blue-500 shadow-lg">Continuar</button>
                </div>
              </div>
            )}

            {/* STEP 3: CLIENT DATA */}
            {currentStep === 2 && (
                <div className="animate-fade-in">
                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2"><UserIcon className="text-neon-orange" /> Seus Dados</h2>
                    
                    {!staffUser && !clientUser && (
                        <div className="flex border-b border-slate-700 mb-6">
                            <button 
                                onClick={() => setAuthMode('REGISTER')}
                                className={`flex-1 py-3 text-sm font-bold transition border-b-2 ${authMode === 'REGISTER' ? 'border-neon-blue text-white' : 'border-transparent text-slate-500 hover:text-white'}`}
                            >
                                Novo / Sem cadastro
                            </button>
                            <button 
                                onClick={() => setAuthMode('LOGIN')}
                                className={`flex-1 py-3 text-sm font-bold transition border-b-2 ${authMode === 'LOGIN' ? 'border-neon-orange text-white' : 'border-transparent text-slate-500 hover:text-white'}`}
                            >
                                Já tenho conta
                            </button>
                        </div>
                    )}

                    {authMode === 'LOGIN' && !staffUser && !clientUser ? (
                        <form onSubmit={handleInlineLogin} className="space-y-4 max-w-md mx-auto">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">E-mail Cadastrado</label>
                                <input type="email" required className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white focus:border-neon-orange outline-none" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Senha</label>
                                <input type="password" required className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-white focus:border-neon-orange outline-none" value={loginPass} onChange={e => setLoginPass(e.target.value)} />
                            </div>
                            <button type="submit" disabled={isLoggingIn} className="w-full bg-neon-orange hover:bg-orange-600 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2">
                                {isLoggingIn ? <Loader2 className="animate-spin"/> : <><LogIn size={18} /> Entrar e Continuar</>}
                            </button>
                            <p className="text-center text-xs text-slate-500 cursor-pointer hover:text-white" onClick={() => setAuthMode('REGISTER')}>Não tem senha? Preencha seus dados na outra aba.</p>
                        </form>
                    ) : (
                        <div className="space-y-4">
                            {/* Staff Mode Banner */}
                            {staffUser && (
                                <div className="bg-slate-800/50 p-3 rounded border border-slate-700 flex items-center gap-2 text-sm text-slate-300 mb-4">
                                    <ShieldCheck size={16} className="text-neon-blue"/>
                                    <span>Modo Equipe: Cadastre os dados do cliente (Senha não necessária).</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Nome Completo <span className="text-red-500">*</span></label>
                                <input type="text" className={`w-full bg-slate-800 border rounded-lg p-3 text-white ${errors.name ? 'border-red-500' : 'border-slate-600'}`} value={formData.name} onChange={e => handleInputChange('name', e.target.value)} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">
                                        WhatsApp 
                                        {!isContactOptional && <span className="text-red-500"> *</span>}
                                        {isContactOptional && <span className="text-xs text-slate-500 font-normal italic ml-1">(Opcional para Equipe)</span>}
                                    </label>
                                    <input type="tel" placeholder="(00) 00000-0000" className={`w-full bg-slate-800 border rounded-lg p-3 text-white ${errors.whatsapp ? 'border-red-500' : 'border-slate-600'}`} value={formData.whatsapp} onChange={e => handlePhoneChange(e, 'whatsapp')} />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">
                                        E-mail
                                        {!isContactOptional && <span className="text-red-500"> *</span>}
                                        {isContactOptional && <span className="text-xs text-slate-500 font-normal italic ml-1">(Opcional para Equipe)</span>}
                                    </label>
                                    <input type="email" className={`w-full bg-slate-800 border rounded-lg p-3 text-white ${errors.email ? 'border-red-500' : 'border-slate-600'}`} value={formData.email} onChange={e => handleInputChange('email', e.target.value)} />
                                </div>
                            </div>

                            {/* Password Field - Only for Public Users creating account */}
                            {!clientUser && !staffUser && (
                                <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 mt-4">
                                    <label className="flex items-center gap-2 cursor-pointer mb-3">
                                        <input type="checkbox" className="w-4 h-4 accent-neon-green" checked={formData.createAccount} onChange={e => setFormData(prev => ({ ...prev, createAccount: e.target.checked }))} />
                                        <span className="text-sm font-bold text-white">Criar conta para agilizar próximos agendamentos?</span>
                                    </label>
                                    {formData.createAccount && (
                                        <div className="animate-fade-in">
                                            <label className="block text-xs font-medium text-slate-500 mb-1">Crie uma senha</label>
                                            <input type="password" className={`w-full bg-slate-900 border rounded-lg p-3 text-white ${errors.password ? 'border-red-500' : 'border-slate-600'}`} value={formData.password} onChange={e => handleInputChange('password', e.target.value)} />
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            <div className="flex justify-between mt-8">
                                <button onClick={handleBack} className="px-6 py-3 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800">Voltar</button>
                                <button onClick={handleNext} disabled={isSaving} className="px-6 py-3 bg-neon-blue text-white font-bold rounded-lg hover:bg-blue-500 shadow-lg flex items-center gap-2">
                                    {isSaving ? <Loader2 className="animate-spin" /> : 'Continuar'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* STEP 4: RESUMO */}
            {currentStep === 3 && (
                <div className="animate-fade-in">
                    <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2"><CheckCircle className="text-neon-orange" /> Resumo do Agendamento</h2>
                    
                    {/* ALERT: 30 MIN RULE */}
                    <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-500/50 rounded-lg flex items-start gap-3">
                         <Clock className="text-yellow-500 flex-shrink-0" size={20} />
                         <div>
                             <h4 className="text-yellow-500 font-bold text-sm">Atenção: Regra de Expiração</h4>
                             <p className="text-xs text-yellow-100/80 mt-1">Após confirmar, você terá <span className="font-bold underline">30 minutos</span> para efetuar o pagamento. Caso contrário, a reserva será cancelada automaticamente e o horário liberado.</p>
                         </div>
                    </div>
                    
                    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-4">
                        <div className="flex justify-between border-b border-slate-700 pb-2">
                            <span className="text-slate-400">Data</span>
                            <span className="text-white font-bold">{formattedDateDisplay}</span>
                        </div>
                        <div className="flex justify-between border-b border-slate-700 pb-2">
                            <span className="text-slate-400">Horário(s)</span>
                            <span className="text-white font-bold text-right">
                                {reservationBlocks.map((b, i) => (
                                    <div key={i}>{b.time} ({b.duration}h)</div>
                                ))}
                            </span>
                        </div>
                        <div className="flex justify-between border-b border-slate-700 pb-2">
                            <span className="text-slate-400">Pistas / Pessoas</span>
                            <span className="text-white font-bold">{formData.lanes} Pista(s) / {formData.people} Pessoas</span>
                        </div>
                        {formData.wantsTable && (
                            <div className="flex justify-between border-b border-slate-700 pb-2">
                                <span className="text-slate-400">Mesa Reservada</span>
                                <span className="text-white font-bold">{formData.tableSeatCount} Lugares {formData.birthdayName && `(${formData.birthdayName})`}</span>
                            </div>
                        )}
                        <div className="flex justify-between items-center pt-2">
                            <span className="text-lg font-bold text-slate-300">Total</span>
                            <span className="text-2xl font-bold text-neon-green">{totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                        </div>
                    </div>

                    <div className="flex justify-between mt-8">
                        <button onClick={handleBack} className="px-6 py-3 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800">Voltar</button>
                        <button onClick={handleNext} disabled={isSaving} className="px-8 py-3 bg-neon-green text-black font-bold rounded-lg hover:bg-green-500 shadow-lg flex items-center gap-2">
                            {isSaving ? <Loader2 className="animate-spin" /> : 'Confirmar Agendamento'}
                        </button>
                    </div>
                </div>
            )}

            {/* STEP 5: PAGAMENTO */}
            {currentStep === 4 && (
                <div className="animate-fade-in text-center py-10">
                    <div className="w-20 h-20 bg-neon-green/20 rounded-full flex items-center justify-center mx-auto mb-6 text-neon-green border border-neon-green/50">
                        <CheckCircle size={40} />
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-2">Reserva Criada!</h2>
                    
                    {!staffUser && (
                        <div className="max-w-md mx-auto my-6 p-4 bg-yellow-900/20 border border-yellow-500/50 rounded-lg flex items-center gap-3 text-left">
                            <AlertTriangle className="text-yellow-500 flex-shrink-0" size={24} />
                            <div>
                                <h4 className="text-yellow-500 font-bold text-sm">Não perca sua vaga!</h4>
                                <p className="text-xs text-yellow-100/80 mt-1">Sua pré-reserva expira em 30 minutos. Realize o pagamento agora para garantir o horário.</p>
                            </div>
                        </div>
                    )}

                    {!staffUser ? (
                         <button onClick={() => handlePaymentProcess('ONLINE')} disabled={isSaving} className="w-full max-w-sm mx-auto py-4 bg-gradient-to-r from-neon-orange to-orange-600 text-white font-bold rounded-xl shadow-lg hover:shadow-orange-500/20 transition transform hover:scale-105 flex items-center justify-center gap-2">
                             {isSaving ? <Loader2 className="animate-spin" /> : <><CreditCard /> Ir para Pagamento</>}
                        </button>
                    ) : (
                        <div className="max-w-md mx-auto space-y-3">
                            <button onClick={() => handlePaymentProcess('CONFIRM_NOW')} disabled={isSaving} className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2">
                                {isSaving ? <Loader2 className="animate-spin" /> : <><CreditCard size={18}/> Confirmar Pagamento Agora</>}
                            </button>
                            <button onClick={() => handlePaymentProcess('PAY_ON_SITE')} disabled={isSaving} className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl border border-slate-700 shadow-lg transition flex items-center justify-center gap-2">
                                {isSaving ? <Loader2 className="animate-spin" /> : <><Store size={18}/> Pagar no Local (Manter Pendente)</>}
                            </button>
                            <p className="text-xs text-slate-500">
                                "Pagar no Local" mantém a reserva pendente, mas <span className="text-neon-orange">não cancela automaticamente</span> após 30 minutos.
                            </p>
                        </div>
                    )}
                </div>
            )}
          </div>
        </div>
        
        {settings && (
            <a
                href={settings.whatsappLink || `https://wa.me/55${settings.phone?.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="fixed bottom-24 md:bottom-6 right-6 z-50 bg-[#25D366] hover:bg-[#128c7e] text-white p-3 md:p-4 rounded-full shadow-[0_4px_20px_rgba(37,211,102,0.4)] transition-all transform hover:scale-110 flex items-center justify-center border-2 border-white/10"
                aria-label="Fale conosco no WhatsApp"
            >
                <MessageCircle size={28} className="md:w-8 md:h-8" />
            </a>
        )}
      </main>
    </div>
  );
};

export default PublicBooking;
