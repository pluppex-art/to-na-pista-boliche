
import React, { useEffect, useState } from 'react';
import { db } from '../services/mockBackend';
import { supabase } from '../services/supabaseClient';
import { Reservation, ReservationStatus, EventType, UserRole, PaymentStatus } from '../types';
import { useApp } from '../contexts/AppContext'; 
import { generateDailySlots, checkHourCapacity } from '../utils/availability'; 
import { ChevronLeft, ChevronRight, Users, Pencil, Save, Loader2, Calendar, Check, Ban, AlertCircle, Plus, Phone, Utensils, Cake, CheckCircle2, X, AlertTriangle, MessageCircle, Clock, Store, LayoutGrid, Hash, DollarSign, FileText, ClipboardList, MousePointerClick } from 'lucide-react';
import { Link } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { EVENT_TYPES } from '../constants';

const Agenda: React.FC = () => {
  const { settings, user: currentUser } = useApp(); 
  
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  });

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [clientPhones, setClientPhones] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  
  const [metrics, setMetrics] = useState({
      totalSlots: 0, pendingSlots: 0, confirmedSlots: 0, checkInSlots: 0, noShowSlots: 0
  });

  // Modal State
  const [editingRes, setEditingRes] = useState<Reservation | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Reservation>>({});
  
  // Lane Selection State
  const [showLaneSelector, setShowLaneSelector] = useState(false);
  const [laneSelectorTargetRes, setLaneSelectorTargetRes] = useState<Reservation | null>(null);
  const [tempSelectedLanes, setTempSelectedLanes] = useState<number[]>([]);
  
  // Cancel Logic State
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  
  const [selectedEditTimes, setSelectedEditTimes] = useState<string[]>([]);
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [calculatingSlots, setCalculatingSlots] = useState<boolean>(false);

  // Expiring & Overdue Reservations State
  const [expiringReservations, setExpiringReservations] = useState<Reservation[]>([]);
  const [overduePendingReservations, setOverduePendingReservations] = useState<Reservation[]>([]);
  const [unresolvedAttendance, setUnresolvedAttendance] = useState<Reservation[]>([]);

  // Permissions Helpers
  const canCreate = currentUser?.role === UserRole.ADMIN || currentUser?.perm_create_reservation;
  const canEdit = currentUser?.role === UserRole.ADMIN || currentUser?.perm_edit_reservation;
  const canDelete = currentUser?.role === UserRole.ADMIN || currentUser?.perm_delete_reservation;

  // OPTIMIZATION: Fetch Month Range
  const getMonthRange = (dateStr: string) => {
      const [y, m] = dateStr.split('-').map(Number);
      const start = `${y}-${String(m).padStart(2, '0')}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      const end = `${y}-${String(m).padStart(2, '0')}-${lastDay}`;
      return { start, end };
  };

  const loadData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const { start, end } = getMonthRange(selectedDate);
      
      // OPTIMIZED: Fetch ONLY current month reservations
      const [monthReservations, allClients] = await Promise.all([
          db.reservations.getByDateRange(start, end),
          db.clients.getAll()
      ]);

      const phoneMap: Record<string, string> = {};
      allClients.forEach(c => { phoneMap[c.id] = c.phone; });
      setClientPhones(phoneMap);

      const dayReservations = monthReservations.filter(r => r.date === selectedDate && r.status !== ReservationStatus.CANCELADA);
      setReservations(dayReservations);

      let total = 0, pending = 0, confirmed = 0, checkIn = 0, noShow = 0;
      dayReservations.forEach(r => {
          // CORREÇÃO: Arredonda duração para cima (ex: 1.5h conta como 2 slots de tempo ocupados)
          const slotCount = (r.laneCount || 1) * Math.ceil(r.duration || 1);
          total += slotCount;
          checkIn += r.checkedInIds?.length || 0;
          noShow += r.noShowIds?.length || 0;
          
          // MÉTRICA DO DASHBOARD: Baseada puramente no status financeiro
          if (r.paymentStatus === PaymentStatus.PENDENTE) {
              pending += slotCount;
          } else {
              confirmed += slotCount;
          }
      });

      setMetrics({ totalSlots: total, pendingSlots: pending, confirmedSlots: confirmed, checkInSlots: checkIn, noShowSlots: noShow });

      // Expiring & Overdue Logic
      const now = new Date();
      const todayStr = [
        now.getFullYear(), 
        String(now.getMonth() + 1).padStart(2, '0'), 
        String(now.getDate()).padStart(2, '0')
      ].join('-');
      
      // 1. Pré-Reservas expirando (criadas há 20-30 min)
      const expiring = monthReservations.filter(r => {
          if (r.date !== selectedDate) return false; 
          if (r.payOnSite) return false; 
          if (r.status !== ReservationStatus.PENDENTE) return false;
          if (!r.createdAt) return false;
          const created = new Date(r.createdAt);
          const diffMins = (now.getTime() - created.getTime()) / 60000;
          return diffMins >= 20 && diffMins < 30; 
      });
      setExpiringReservations(expiring);

      // 2. Reservas Pendentes em Atraso (Horário do jogo já passou e ainda está pendente)
      const overdue = monthReservations.filter(r => {
          if (r.status !== ReservationStatus.PENDENTE) return false;
          // Se a data da reserva for HOJE, ignoramos o alerta de atraso para não poluir a tela.
          if (r.date === todayStr) return false;
          
          const [y, m, d] = r.date.split('-').map(Number);
          const [h, min] = r.time.split(':').map(Number);
          const resEnd = new Date(y, m - 1, d, h + r.duration, min);
          const toleranceTime = new Date(resEnd.getTime() + 15 * 60000); 
          
          return now > toleranceTime;
      });
      setOverduePendingReservations(overdue);

      // 3. LIMPEZA DE PRESENÇA (LÓGICA ATUALIZADA: 20 MINUTOS DEPOIS DO INÍCIO)
      const unresolved = monthReservations.filter(r => {
          // Apenas reservas confirmadas
          if (r.status !== ReservationStatus.CONFIRMADA) return false;
          
          // Verifica se JÁ tem check-in ou no-show (se tiver, não precisa listar)
          const hasCheckIn = r.checkedInIds && r.checkedInIds.length > 0;
          const hasNoShow = r.noShowIds && r.noShowIds.length > 0;
          if (hasCheckIn || hasNoShow) return false;

          // Constrói Data/Hora de Início da Reserva
          const [y, m, d] = r.date.split('-').map(Number);
          const [h, min] = r.time.split(':').map(Number);
          const startDateTime = new Date(y, m - 1, d, h, min);
          
          // Tolerância: 20 minutos após o início
          const toleranceTime = new Date(startDateTime.getTime() + 20 * 60000);

          // Se AGORA for maior que (Início + 20min), deve aparecer no alerta
          return now > toleranceTime;
      });
      setUnresolvedAttendance(unresolved);

    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => { 
    loadData();

    const channel = supabase
      .channel('agenda-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservas' }, (payload) => {
          const newData = payload.new as any;
          if (!newData || !newData.date) {
              loadData(true);
              return;
          }
          const { start, end } = getMonthRange(selectedDate);
          if (newData.date >= start && newData.date <= end) {
              console.log('Realtime change relevant to view, refreshing...');
              loadData(true);
          }
      })
      .subscribe();
    
    const interval = setInterval(() => loadData(true), 60000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [selectedDate]);

  // --- ACTIONS GRANULARES ---
  const handleGranularStatus = async (e: React.MouseEvent, res: Reservation, uniqueId: string, type: 'CHECK_IN' | 'NO_SHOW') => {
      e.stopPropagation(); 
      if (!canEdit) return; 

      const currentCheckedInIds = res.checkedInIds || [];
      const currentNoShowIds = res.noShowIds || [];
      let newCheckedInIds = [...currentCheckedInIds];
      let newNoShowIds = [...currentNoShowIds];

      let openLaneSelector = false;

      if (type === 'CHECK_IN') {
          if (newCheckedInIds.includes(uniqueId)) {
              newCheckedInIds = newCheckedInIds.filter(id => id !== uniqueId);
          } else { 
              newCheckedInIds.push(uniqueId); 
              newNoShowIds = newNoShowIds.filter(id => id !== uniqueId); 
              openLaneSelector = true;
          }
      } else if (type === 'NO_SHOW') {
          if (newNoShowIds.includes(uniqueId)) newNoShowIds = newNoShowIds.filter(id => id !== uniqueId);
          else { newNoShowIds.push(uniqueId); newCheckedInIds = newCheckedInIds.filter(id => id !== uniqueId); }
      }

      const updatedRes = { ...res, checkedInIds: newCheckedInIds, noShowIds: newNoShowIds };
      
      await db.reservations.update(updatedRes, currentUser?.id, `${type} em ${res.clientName}`);
      
      if (openLaneSelector) {
          setLaneSelectorTargetRes(updatedRes);
          setTempSelectedLanes(updatedRes.lanesAssigned || []);
          setShowLaneSelector(true);
      } else {
          loadData(true);
      }
  };

  const handleResolveOverdue = async (res: Reservation, action: 'CONFIRM' | 'NO_SHOW') => {
      if (!canEdit) return;
      try {
          const updatedRes = { ...res };
          if (action === 'CONFIRM') {
              updatedRes.status = ReservationStatus.CONFIRMADA;
              updatedRes.paymentStatus = PaymentStatus.PAGO;
              updatedRes.observations = (res.observations || '') + ' [Baixa Manual de Atraso]';
              const points = Math.floor(res.totalValue);
              if (points > 0 && res.clientId) {
                  try {
                      await db.loyalty.addTransaction(res.clientId, points, `Confirmação Tardia (${res.date})`, currentUser?.id);
                  } catch (loyaltyError) {
                      console.warn("Erro ao adicionar pontos de fidelidade:", loyaltyError);
                  }
              }
          } else {
              updatedRes.status = ReservationStatus.NO_SHOW;
              updatedRes.observations = (res.observations || '') + ' [No-Show por Atraso]';
          }

          await db.reservations.update(updatedRes, currentUser?.id, `Resolveu pendência atrasada: ${action}`);
          loadData(true);
      } catch (e: any) {
          console.error(e);
          alert(`Erro ao atualizar reserva: ${e.message || e}`);
      }
  };

  // --- NOVA FUNÇÃO DE RESOLUÇÃO DE PRESENÇA NO WIDGET ---
  const handleResolveAttendance = async (e: React.MouseEvent, res: Reservation, type: 'CHECK_IN' | 'NO_SHOW') => {
      e.stopPropagation(); // Previne abrir modal
      if (!canEdit) return;
      try {
          const updatedRes = { ...res };
          const startH = parseInt(res.time.split(':')[0]);
          const totalSlots = (res.laneCount || 1);
          const slotsIds = [];
          
          // Gera todos os IDs de slots para marcar tudo de uma vez
          for(let i=0; i<totalSlots; i++) {
              slotsIds.push(`${res.id}_${startH}:00_${i+1}`);
          }

          if (type === 'CHECK_IN') {
              updatedRes.status = ReservationStatus.CHECK_IN;
              updatedRes.checkedInIds = slotsIds; // Marca todos como presentes
              updatedRes.noShowIds = [];
          } else {
              updatedRes.status = ReservationStatus.NO_SHOW;
              updatedRes.noShowIds = slotsIds; // Marca todos como falta
              updatedRes.checkedInIds = [];
          }

          await db.reservations.update(updatedRes, currentUser?.id, `Resolução de Presença Tardia (Widget): ${type}`);
          
          // Se for check-in, abre seletor de pista para facilitar
          if (type === 'CHECK_IN') {
              setLaneSelectorTargetRes(updatedRes);
              setTempSelectedLanes(updatedRes.lanesAssigned || []);
              setShowLaneSelector(true);
          } else {
              loadData(true);
          }
      } catch (e: any) {
          console.error(e);
          alert(`Erro ao atualizar: ${e.message}`);
      }
  };

  // --- LANE SELECTION LOGIC ---
  const toggleLaneSelection = (laneNumber: number) => {
      setTempSelectedLanes(prev => {
          if (prev.includes(laneNumber)) return prev.filter(l => l !== laneNumber);
          return [...prev, laneNumber].sort((a,b) => a-b);
      });
  };

  const saveLaneSelection = async () => {
      if (!laneSelectorTargetRes) return;
      const updatedRes = { ...laneSelectorTargetRes, lanesAssigned: tempSelectedLanes };
      await db.reservations.update(updatedRes, currentUser?.id, 'Atualizou pistas atribuídas');
      
      if (editingRes && editingRes.id === updatedRes.id) {
          setEditingRes(updatedRes);
      }
      
      setShowLaneSelector(false);
      setLaneSelectorTargetRes(null);
      loadData(true);
  };

  const openLaneSelectorModal = (e: React.MouseEvent, res: Reservation) => {
      e.stopPropagation();
      setLaneSelectorTargetRes(res);
      setTempSelectedLanes(res.lanesAssigned || []);
      setShowLaneSelector(true);
  };

  // --- SLOT CALCULATION FOR EDIT (USING UTILS) ---
  useEffect(() => {
    const calculateSlots = async () => {
        if (!isEditMode || !editingRes) return;
        const targetDate = editForm.date || editingRes.date;
        if (!targetDate) return;

        setCalculatingSlots(true);
        const targetLanes = editForm.laneCount || editingRes.laneCount || 1;
        
        const { start, end } = getMonthRange(targetDate);
        const allRes = await db.reservations.getByDateRange(start, end);
        
        const rawSlots = generateDailySlots(targetDate, settings, allRes, editingRes.id);
        
        const slots = rawSlots.map(s => ({
            ...s,
            available: s.available && s.left >= targetLanes
        }));

        setAvailableSlots(slots);
        setCalculatingSlots(false);
    };
    calculateSlots();
  }, [isEditMode, editForm.date, editForm.laneCount, editingRes, settings]);

  const toggleEditTime = (time: string) => {
      setSelectedEditTimes(prev => {
          let newTimes;
          if (prev.includes(time)) newTimes = prev.filter(t => t !== time);
          else newTimes = [...prev, time].sort((a, b) => parseInt(a) - parseInt(b));
          setEditForm(f => ({ ...f, duration: newTimes.length }));
          return newTimes;
      });
  };

  const closeResModal = () => { 
      setEditingRes(null); 
      setIsEditMode(false); 
      setEditForm({}); 
      setIsCancelling(false);
      setCancelReason('');
  };

  const openResModal = (res: Reservation) => {
    setEditingRes(res);
    setIsEditMode(false);
    setIsCancelling(false);
    setCancelReason('');
    const times = [];
    const startHour = parseInt(res.time.split(':')[0]);
    for(let i=0; i<res.duration; i++) times.push(`${startHour + i}:00`);
    setSelectedEditTimes(times);
    setEditForm({ 
        ...res,
        hasTableReservation: res.hasTableReservation || false,
        tableSeatCount: res.tableSeatCount || 0,
        birthdayName: res.birthdayName || '',
        totalValue: res.totalValue,
        eventType: res.eventType,
        observations: res.observations || ''
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canEdit) { alert("Sem permissão."); return; }

      if(editingRes && editForm && selectedEditTimes.length > 0) {
          setLoading(true);
          try {
             const reqLanes = editForm.laneCount || editingRes.laneCount || 1;
             const reqDate = editForm.date || editingRes.date || selectedDate;
             
             const { start, end } = getMonthRange(reqDate);
             const allRes = await db.reservations.getByDateRange(start, end);

             const hasTable = editForm.hasTableReservation ?? editingRes.hasTableReservation;
             if (hasTable) {
                 const tableCount = allRes.filter(r => 
                    r.date === reqDate && 
                    r.hasTableReservation && 
                    r.status !== ReservationStatus.CANCELADA && 
                    r.id !== editingRes.id
                 ).length;
                 
                 if (tableCount >= 25) {
                     alert("Limite de 25 mesas atingido para esta data.");
                     setLoading(false);
                     return;
                 }
             }

             for (const timeStr of selectedEditTimes) {
                 const h = parseInt(timeStr.split(':')[0]);
                 const { left } = checkHourCapacity(h, reqDate, allRes, settings.activeLanes, editingRes.id);
                 if (left < reqLanes) {
                     alert(`Horário ${h}:00 lotado!`);
                     setLoading(false); return;
                 }
             }

             const sortedHours = selectedEditTimes.map(t => parseInt(t.split(':')[0])).sort((a,b) => a - b);
             const blocks: { time: string, duration: number }[] = [];
             let currentStart = sortedHours[0];
             let currentDuration = 1;
             for (let i = 1; i < sortedHours.length; i++) {
                 if (sortedHours[i] === sortedHours[i-1] + 1) currentDuration++;
                 else { blocks.push({ time: `${currentStart}:00`, duration: currentDuration }); currentStart = sortedHours[i]; currentDuration = 1; }
             }
             blocks.push({ time: `${currentStart}:00`, duration: currentDuration });

             const firstBlock = blocks[0];
             
             const updated = { 
                 ...editingRes, 
                 ...editForm, 
                 time: firstBlock.time, 
                 duration: firstBlock.duration,
                 birthdayName: editForm.hasTableReservation ? editForm.birthdayName : undefined,
                 tableSeatCount: editForm.hasTableReservation ? editForm.tableSeatCount : undefined
             };
             
             await db.reservations.update(updated, currentUser?.id, `Editou detalhes completos da reserva`);
             
             if (blocks.length > 1) {
                  for (let i = 1; i < blocks.length; i++) {
                      const newResId = uuidv4();
                      const newRes: Reservation = { 
                          ...updated, 
                          id: newResId, 
                          time: blocks[i].time, 
                          duration: blocks[i].duration, 
                          createdAt: new Date().toISOString() 
                        };
                      await db.reservations.create(newRes, currentUser?.id);
                  }
             }
             setIsEditMode(false); setEditingRes(updated); 
             loadData(true); 
          } catch (error) { console.error(error); alert("Erro ao salvar."); } finally { setLoading(false); }
      }
  };

  const handleStatusChange = async (status: ReservationStatus) => {
    if (editingRes) {
      if (status === ReservationStatus.CANCELADA) {
          setIsCancelling(true);
          return;
      }
      if (!canEdit) { alert("Sem permissão."); return; }
      
      let newPaymentStatus = editingRes.paymentStatus;

      // AUTOMAÇÃO: Se confirmar e NÃO for pagar no local/comanda, marca como PAGO
      if (status === ReservationStatus.CONFIRMADA && !editingRes.payOnSite && !editingRes.comandaId) {
          newPaymentStatus = PaymentStatus.PAGO;
      }

      if (status === ReservationStatus.CONFIRMADA && editingRes.status !== ReservationStatus.CONFIRMADA) {
          try {
              const points = Math.floor(editingRes.totalValue);
              if (points > 0) {
                  await db.loyalty.addTransaction(editingRes.clientId, points, `Confirmação Manual (${editingRes.date})`, currentUser?.id);
              }
          } catch (error) { console.error("Erro fidelidade", error); }
      }

      const updated = { ...editingRes, status, paymentStatus: newPaymentStatus };
      await db.reservations.update(updated, currentUser?.id, `Alterou status para ${status} (Pgto: ${newPaymentStatus})`);
      setEditingRes(null); 
      loadData(true); 
    }
  };

  const handleConfirmCancellation = async () => {
      if (!editingRes) return;
      if (!canDelete) { alert("Sem permissão para cancelar."); return; }
      if (!cancelReason.trim()) { alert("A justificativa é obrigatória."); return; }

      setLoading(true);
      try {
          const shouldRevertPoints = editingRes.status === ReservationStatus.CONFIRMADA || editingRes.paymentStatus === PaymentStatus.PAGO;
          if (shouldRevertPoints) {
              const points = Math.floor(editingRes.totalValue);
              if (points > 0) {
                  await db.loyalty.addTransaction(editingRes.clientId, -points, `Estorno: Cancelamento de Reserva`, currentUser?.id);
              }
          }

          const updated = { ...editingRes, status: ReservationStatus.CANCELADA };
          await db.reservations.update(updated, currentUser?.id, `CANCELADO. Motivo: ${cancelReason}`);
          setEditingRes(null);
          setIsCancelling(false);
          setCancelReason('');
          loadData(true); 
      } catch (e) {
          console.error(e);
          alert("Erro ao cancelar reserva.");
      } finally {
          setLoading(false);
      }
  };

  const changeDate = (days: number) => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const newDate = new Date(y, m - 1, d + days);
    setSelectedDate([newDate.getFullYear(), String(newDate.getMonth() + 1).padStart(2, '0'), String(newDate.getDate()).padStart(2, '0')].join('-'));
  };

  const getDailyHours = () => {
      return generateDailySlots(selectedDate, settings, []).map(s => s.time);
  };

  const getCardStyle = (status: ReservationStatus, isCheckIn: boolean, isNoShow: boolean) => {
    if (isCheckIn) return 'border-green-500 bg-slate-900 opacity-70';
    if (isNoShow) return 'border-red-500 bg-red-900/10 grayscale opacity-70';
    switch (status) {
      case ReservationStatus.CONFIRMADA: return 'border-neon-blue bg-blue-900/20';
      case ReservationStatus.PENDENTE: return 'border-yellow-500/50 bg-yellow-900/10';
      default: return 'border-slate-700 bg-slate-800';
    }
  };

  const formatDateDisplay = (dateStr: string) => dateStr.split('-').reverse().join('/');

  const sendReminder = (res: Reservation) => {
      const phone = clientPhones[res.clientId];
      if (!phone) return;
      const message = `Olá ${res.clientName}, sua reserva de hoje (${new Date(res.date).toLocaleDateString('pt-BR')} às ${res.time}) está pendente e expira em breve. Podemos confirmar o pagamento?`;
      const url = `https://wa.me/55${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
  };

  const KPI = ({ label, value, color, icon: Icon }: any) => (
      <div className={`p-3 rounded-xl border flex items-center justify-between shadow-sm bg-slate-800 border-${color}-500/30`}>
          <div className="flex items-center gap-3"><div className={`p-2 bg-${color}-500/10 rounded-lg text-${color}-500`}><Icon size={18} /></div><span className={`text-xs uppercase font-bold text-${color}-500`}>{label}</span></div>
          <span className={`text-2xl font-bold text-${color}-500`}>{loading ? '-' : value}</span>
      </div>
  );

  return (
    <div className="flex flex-col h-full space-y-6 pb-20 md:pb-0">
      
      {/* 1. ALERT: UNRESOLVED ATTENDANCE (ACTIONABLE BUTTONS) */}
      {unresolvedAttendance.length > 0 && (
          <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-xl p-4 mb-2">
              <h3 className="text-yellow-500 font-bold flex items-center gap-2 mb-2">
                  <ClipboardList size={20} /> Atenção: Confirmação de Presença
              </h3>
              <p className="text-xs text-yellow-300 mb-3">
                  Reservas que já iniciaram há mais de 20 minutos. Por favor, marque se o cliente chegou.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {unresolvedAttendance.map(r => (
                      <div 
                          key={r.id} 
                          onClick={() => openResModal(r)}
                          className="bg-slate-900/90 p-3 rounded border border-yellow-500/30 flex flex-col gap-2 cursor-pointer hover:bg-slate-800 transition relative group"
                      >
                          <div className="flex justify-between items-start">
                              <span className="text-sm font-bold text-white truncate">{r.clientName}</span>
                              <MousePointerClick size={14} className="text-slate-500 group-hover:text-yellow-500 transition"/>
                          </div>
                          <span className="text-xs text-slate-400">{r.date.split('-').reverse().join('/')} às {r.time}</span>
                          
                          {/* Botões de Ação Rápida no Card */}
                          <div className="flex gap-2 mt-1">
                              <button 
                                onClick={(e) => handleResolveAttendance(e, r, 'CHECK_IN')}
                                className="flex-1 bg-green-600 hover:bg-green-500 text-white text-[10px] font-bold py-1.5 rounded flex items-center justify-center gap-1 transition"
                              >
                                  <CheckCircle2 size={12}/> Sim, Veio
                              </button>
                              <button 
                                onClick={(e) => handleResolveAttendance(e, r, 'NO_SHOW')}
                                className="flex-1 bg-red-600/80 hover:bg-red-500 text-white text-[10px] font-bold py-1.5 rounded flex items-center justify-center gap-1 transition"
                              >
                                  <Ban size={12}/> Faltou
                              </button>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* 2. ALERT: OVERDUE PENDING */}
      {overduePendingReservations.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 animate-pulse">
              <h3 className="text-red-500 font-bold flex items-center gap-2 mb-2">
                  <AlertCircle size={20} /> Atenção: Pagamentos Pendentes em Atraso
              </h3>
              <p className="text-xs text-red-300 mb-3">
                  As reservas abaixo já aconteceram mas ainda constam como "Pendentes". 
                  Verifique se foi <strong>Pagar no Local/Comanda</strong> e confirme o pagamento.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {overduePendingReservations.map(r => (
                      <div key={r.id} className="bg-slate-900/90 p-3 rounded border border-red-500/30 flex flex-col gap-2">
                          <div className="flex justify-between items-start">
                              <div>
                                <span className="text-sm font-bold text-white block">{r.clientName}</span>
                                <span className="text-xs text-slate-400 block">{r.date.split('-').reverse().join('/')} às {r.time} ({r.duration}h)</span>
                                {r.payOnSite && <span className="text-[10px] bg-slate-700 text-white px-1 rounded mt-1 inline-block">Modo Local/Comanda</span>}
                              </div>
                              <span className="text-red-400 text-xs font-bold bg-red-900/20 px-2 py-1 rounded">Atrasado</span>
                          </div>
                          
                          <div className="flex gap-2 mt-1">
                              <button 
                                onClick={() => handleResolveOverdue(r, 'CONFIRM')}
                                disabled={!canEdit}
                                className="flex-1 bg-green-600 hover:bg-green-500 text-white text-xs font-bold py-2 rounded flex items-center justify-center gap-1 disabled:opacity-50"
                              >
                                  <Check size={12}/> Confirmar
                              </button>
                              <button 
                                onClick={() => handleResolveOverdue(r, 'NO_SHOW')}
                                disabled={!canEdit}
                                className="flex-1 bg-red-600/80 hover:bg-red-500 text-white text-xs font-bold py-2 rounded flex items-center justify-center gap-1 disabled:opacity-50"
                              >
                                  <Ban size={12}/> No-Show
                              </button>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* EXPIRING ALERT WIDGET */}
      {expiringReservations.length > 0 && (
          <div className="bg-orange-500/10 border border-orange-500/50 rounded-xl p-4">
              <h3 className="text-orange-500 font-bold flex items-center gap-2 mb-2">
                  <Clock size={20} /> Pré-Reservas Expirando (30min)
              </h3>
              <div className="flex flex-wrap gap-2">
                  {expiringReservations.map(r => (
                      <div key={r.id} className="bg-slate-900/80 p-2 rounded border border-orange-500/30 flex items-center gap-3">
                          <span className="text-sm font-bold text-white">{r.clientName}</span>
                          <span className="text-xs text-slate-400">{r.time}</span>
                          <button onClick={() => sendReminder(r)} className="text-green-500 hover:text-green-400" title="Cobrar no WhatsApp">
                              <MessageCircle size={16} />
                          </button>
                      </div>
                  ))}
              </div>
          </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-4">
        <div><h1 className="text-3xl font-bold text-white tracking-tight">Dashboard</h1><p className="text-slate-400 text-sm">Gestão de {formatDateDisplay(selectedDate)}</p></div>
        <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            <div className="flex items-center gap-4 bg-slate-800 p-2 rounded-lg border border-slate-700 shadow-sm w-full md:w-auto justify-between md:justify-start">
            <button onClick={() => changeDate(-1)} className="p-2 hover:bg-slate-700 rounded-full text-slate-300"><ChevronLeft size={20} /></button>
            <input type="date" className="bg-transparent text-white font-bold text-center focus:outline-none" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}/>
            <button onClick={() => changeDate(1)} className="p-2 hover:bg-slate-700 rounded-full text-slate-300"><ChevronRight size={20} /></button>
            </div>
            {canCreate && (<Link to="/agendamento" className="bg-neon-orange hover:bg-orange-500 text-white px-6 py-3 rounded-lg font-bold shadow-lg flex items-center justify-center gap-2 transition transform hover:scale-105 w-full sm:w-auto"><Plus size={20} /><span className="hidden sm:inline">Nova Reserva</span><span className="sm:hidden">Nova</span></Link>)}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
         <KPI label="Total" value={metrics.totalSlots} color="slate" icon={Calendar} />
         <KPI label="Pendentes" value={metrics.pendingSlots} color="yellow" icon={AlertCircle} />
         <div className="bg-green-900/20 p-3 rounded-xl border border-green-500/30 flex items-center justify-between shadow-sm"><div className="flex items-center gap-3"><div className="p-2 bg-green-500/20 rounded-lg text-green-400"><Users size={18} /></div><span className="text-xs text-green-400 uppercase font-bold">Check-in</span></div><span className="text-2xl font-bold text-green-400">{loading ? '-' : metrics.checkInSlots}</span></div>
         <div className="bg-red-900/20 p-3 rounded-xl border border-red-500/30 flex items-center justify-between shadow-sm"><div className="flex items-center gap-3"><div className="p-2 bg-red-500/20 rounded-lg text-red-400"><Ban size={18} /></div><span className="text-xs text-red-400 uppercase font-bold">No-Show</span></div><span className="text-2xl font-bold text-red-500">{loading ? '-' : metrics.noShowSlots}</span></div>
      </div>

      <div className="flex-1 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden shadow-2xl flex flex-col min-h-[500px]">
        {loading ? (<div className="flex-1 flex justify-center items-center"><Loader2 className="animate-spin text-neon-blue" size={48} /></div>) : (
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
             {getDailyHours().length === 0 ? <div className="flex flex-col items-center justify-center h-full text-slate-500"><Ban size={48} className="mb-4 opacity-20"/><p>Estabelecimento fechado neste dia.</p></div> : (
             getDailyHours().map(hour => {
               const currentHourInt = parseInt(hour.split(':')[0]);
               const hourReservations = reservations.filter(r => {
                 if (r.status === ReservationStatus.CANCELADA) return false;
                 const start = parseInt(r.time.split(':')[0]);
                 const end = start + r.duration;
                 return currentHourInt >= start && currentHourInt < end;
               });
               const lanesOccupied = hourReservations.reduce((acc, curr) => acc + curr.laneCount, 0);
               const occupancyRate = (lanesOccupied / settings.activeLanes) * 100;

               return (
                 <div key={hour} className="bg-slate-900/50 rounded-xl border border-slate-700 overflow-hidden group">
                    <div className="bg-slate-900 p-3 flex justify-between items-center border-b border-slate-700">
                       <div className="flex items-center gap-3"><span className="text-xl font-bold text-neon-blue">{hour}</span><div className="h-4 w-[1px] bg-slate-700 mx-2"></div><span className="text-sm text-slate-500">{lanesOccupied} / {settings.activeLanes} Pistas</span></div>
                       <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden"><div className={`h-full ${occupancyRate >= 100 ? 'bg-red-500' : 'bg-green-500'}`} style={{width: `${Math.min(occupancyRate, 100)}%`}}></div></div>
                    </div>
                    <div className="p-3">
                       {hourReservations.length === 0 ? <div className="py-2 px-2 text-slate-600 italic text-sm">Disponível</div> : (
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                           {hourReservations.flatMap(res => {
                             const numberOfCards = Math.max(1, res.laneCount || 1);
                             return Array.from({ length: numberOfCards }).map((_, laneIndex) => {
                               const uniqueId = `${res.id}_${currentHourInt}:00_${laneIndex+1}`;
                               const isCheckedIn = res.checkedInIds?.includes(uniqueId) || false;
                               const isNoShow = res.noShowIds?.includes(uniqueId) || false;
                               const cardStyle = getCardStyle(res.status, isCheckedIn, isNoShow);
                               
                               // CHECK PAYMENT STATUS ALERT (Even if Checked-in)
                               const isPaymentPending = res.paymentStatus === PaymentStatus.PENDENTE;
                               const needsPaymentAlert = res.paymentStatus === PaymentStatus.PENDENTE;

                               return (
                               <div key={uniqueId} onClick={() => openResModal(res)} className={`relative p-3 rounded-lg border cursor-pointer hover:bg-slate-800 transition ${cardStyle}`}>
                                  <div className="flex justify-between items-start mb-2">
                                    <div className="min-w-0 pr-2">
                                        <h4 className={`font-bold truncate text-sm flex items-center gap-2 ${isNoShow ? 'line-through text-slate-500' : 'text-white'}`}>{res.clientName}</h4>
                                        
                                        {/* PAYMENT ALERT BADGE */}
                                        {needsPaymentAlert && (
                                            <div className="mt-1 flex items-center gap-1 text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded font-bold uppercase animate-pulse w-fit">
                                                <DollarSign size={10} /> PGTO PENDENTE
                                            </div>
                                        )}

                                        <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5"><Phone size={10} /> {clientPhones[res.clientId] || 'Sem telefone'}</div>
                                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                                            {isCheckedIn ? <span className="text-[10px] font-bold text-green-400 bg-green-500/20 px-1 rounded uppercase">CHECK-IN</span> : isNoShow ? <span className="text-[10px] font-bold text-red-400 bg-red-500/20 px-1 rounded uppercase">NO-SHOW</span> : <span className={`text-[10px] font-bold px-1 rounded uppercase ${res.status === ReservationStatus.CONFIRMADA ? 'text-neon-blue bg-blue-900/40 border border-neon-blue/30' : res.status === ReservationStatus.PENDENTE ? 'text-yellow-400 bg-yellow-900/40 border border-yellow-500/30' : 'text-slate-400 bg-slate-800'}`}>{res.status}</span>}
                                            {res.payOnSite && res.status === ReservationStatus.PENDENTE && (
                                                <span className="text-[10px] font-bold text-white bg-slate-600 px-1 rounded flex items-center gap-0.5" title="Pagamento no Local"><Store size={10}/> Local</span>
                                            )}
                                            {res.comandaId && (
                                                <span className="text-[10px] font-bold text-white bg-purple-600 px-1 rounded flex items-center gap-0.5" title="Comanda"><Hash size={10}/> {res.comandaId}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <div className="flex gap-1">
                                            <button disabled={!canEdit} onClick={(e) => handleGranularStatus(e, res, uniqueId, 'CHECK_IN')} className={`w-7 h-7 flex items-center justify-center rounded border transition ${!canEdit ? 'opacity-50' : isCheckedIn ? 'bg-green-500 text-white border-green-400' : 'bg-slate-800 text-slate-500 border-slate-600 hover:text-green-400'}`}><Check size={14}/></button>
                                            <button disabled={!canEdit} onClick={(e) => handleGranularStatus(e, res, uniqueId, 'NO_SHOW')} className={`w-7 h-7 flex items-center justify-center rounded border transition ${!canEdit ? 'opacity-50' : isNoShow ? 'bg-red-500 text-white border-red-400' : 'bg-slate-800 text-slate-500 border-slate-600 hover:text-red-400'}`}><Ban size={14}/></button>
                                        </div>
                                        {isCheckedIn && (
                                            <div onClick={(e) => canEdit ? openLaneSelectorModal(e, res) : null} className={`flex items-center gap-1 ${canEdit ? 'cursor-pointer hover:opacity-80' : 'opacity-70'}`}>
                                                {res.lanesAssigned && res.lanesAssigned.length > 0 ? (
                                                    res.lanesAssigned.map(l => (
                                                        <span key={l} className="w-5 h-5 rounded-full bg-slate-900 border border-slate-600 text-[10px] flex items-center justify-center text-white font-bold">{l}</span>
                                                    ))
                                                ) : (
                                                    <div className="w-6 h-6 rounded flex items-center justify-center bg-slate-800 border border-slate-600 text-slate-400 hover:text-white hover:border-slate-400 transition" title="Atribuir Pista"><Hash size={12} /></div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                  </div>
                                  {res.hasTableReservation && <div className="mt-2 pt-2 border-t border-slate-700/50"><div className="flex flex-col gap-1"><span className="text-[10px] font-bold text-neon-orange uppercase tracking-wider flex items-center gap-1"><Utensils size={10} /> Mesa: {res.tableSeatCount} lug.</span>{res.birthdayName && <span className="text-[10px] text-neon-blue flex items-center gap-1 truncate font-bold"><Cake size={10} /> {res.birthdayName}</span>}</div></div>}
                               </div>
                             )});
                           })}
                         </div>
                       )}
                    </div>
                 </div>
               );
             }))}
          </div>
        )}
      </div>

      {editingRes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-800 border border-slate-600 w-full max-w-2xl rounded-2xl shadow-2xl animate-scale-in flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-700 flex justify-between items-center">
              <div className="flex items-center gap-3"><h3 className="text-xl font-bold text-white">Detalhes da Reserva</h3>{!isEditMode && canEdit && !isCancelling && (<button onClick={() => setIsEditMode(true)} className="p-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition"><Pencil size={14} /></button>)}</div>
              <button onClick={closeResModal} className="text-slate-400 hover:text-white"><X /></button>
            </div>
            {!isEditMode ? (
                <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-1">{editingRes.clientName}</h2>
                            <div className="flex items-center gap-2 text-slate-400 text-sm"><Phone size={14} /><span>{clientPhones[editingRes.clientId] || 'Sem telefone'}</span></div>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${editingRes.status === ReservationStatus.CONFIRMADA ? 'bg-green-500/20 text-green-400 border-green-500/30' : editingRes.status === ReservationStatus.PENDENTE ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' : 'bg-slate-700 text-slate-400 border-slate-600'}`}>{editingRes.status}</div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
                        <div><span className="text-xs text-slate-500 uppercase font-bold block mb-1">Data</span><span className="text-white font-medium flex items-center gap-2"><Calendar size={16} className="text-neon-blue"/>{editingRes.date.split('-').reverse().join('/')}</span></div>
                        <div><span className="text-xs text-slate-500 uppercase font-bold block mb-1">Horário</span><span className="text-white font-medium flex items-center gap-2"><Clock size={16} className="text-neon-blue"/>{editingRes.time} ({editingRes.duration}h)</span></div>
                        <div><span className="text-xs text-slate-500 uppercase font-bold block mb-1">Pistas / Pessoas</span><span className="text-white font-medium flex items-center gap-2"><LayoutGrid size={16} className="text-neon-blue"/>{editingRes.laneCount} / {editingRes.peopleCount}</span></div>
                        <div><span className="text-xs text-slate-500 uppercase font-bold block mb-1">Valor Total</span><span className="text-green-400 font-bold text-lg flex items-center gap-1"><DollarSign size={16}/>{editingRes.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace('R$', '').trim()}</span></div>
                    </div>
                    <div className="space-y-3">
                        {editingRes.comandaId && (<div className="flex items-center gap-3 bg-purple-900/30 p-3 rounded-lg border border-purple-500/30"><div className="bg-purple-900/50 p-2 rounded text-purple-400"><Hash size={18}/></div><div><span className="text-xs text-purple-400 block font-bold">Comanda / Mesa</span><span className="text-white text-lg font-bold">{editingRes.comandaId}</span></div></div>)}
                        <div className="flex items-center gap-3 bg-slate-800 p-3 rounded-lg border border-slate-700"><div className="bg-slate-700 p-2 rounded text-slate-300"><Cake size={18}/></div><div><span className="text-xs text-slate-400 block">Tipo de Evento</span><span className="text-white text-sm font-medium">{editingRes.eventType}</span></div></div>
                        <div className="flex items-center justify-between bg-slate-800 p-3 rounded-lg border border-slate-700">
                            <div className="flex items-center gap-3"><div className="bg-slate-700 p-2 rounded text-slate-300"><Hash size={18}/></div><div><span className="text-xs text-slate-400 block">Pistas em Uso</span><div className="flex gap-1 mt-1">{editingRes.lanesAssigned && editingRes.lanesAssigned.length > 0 ? (editingRes.lanesAssigned.map(l => (<span key={l} className="w-6 h-6 rounded-full bg-neon-blue text-white flex items-center justify-center text-xs font-bold shadow-sm shadow-blue-500/50">{l}</span>))) : (<span className="text-sm text-slate-500 italic">Não atribuídas</span>)}</div></div></div>
                            {canEdit && editingRes.checkedInIds && editingRes.checkedInIds.length > 0 && (<button onClick={() => { setLaneSelectorTargetRes(editingRes); setTempSelectedLanes(editingRes.lanesAssigned || []); setShowLaneSelector(true); }} className="text-xs font-bold text-neon-blue hover:text-white px-3 py-1.5 rounded border border-neon-blue hover:bg-neon-blue transition">Alterar Pistas</button>)}
                        </div>
                        {editingRes.hasTableReservation && (<div className="flex items-center gap-3 bg-slate-800 p-3 rounded-lg border border-slate-700"><div className="bg-slate-700 p-2 rounded text-neon-orange"><Utensils size={18}/></div><div><span className="text-xs text-slate-400 block">Reserva de Mesa</span><span className="text-white text-sm font-medium">{editingRes.tableSeatCount} lugares {editingRes.birthdayName && <span className="text-slate-400 mx-1">• Aniv: {editingRes.birthdayName}</span>}</span></div></div>)}
                    </div>
                    {editingRes.observations && (<div className="bg-slate-900/30 p-3 rounded-lg border border-slate-800"><span className="text-xs text-slate-500 font-bold mb-1 block">Observações</span><p className="text-sm text-slate-300 italic">{editingRes.observations}</p></div>)}
                    {!isCancelling ? (
                        <div className="pt-4 border-t border-slate-700 flex gap-2">
                            <button disabled={!canEdit} onClick={() => handleStatusChange(ReservationStatus.CONFIRMADA)} className={`px-4 py-2 rounded-lg text-sm font-medium flex-1 ${!canEdit ? 'opacity-50' : 'bg-green-600 hover:bg-green-500 text-white'}`}>Confirmar</button>
                            <button disabled={!canEdit} onClick={() => handleStatusChange(ReservationStatus.PENDENTE)} className={`px-4 py-2 rounded-lg text-sm font-medium flex-1 ${!canEdit ? 'opacity-50' : 'bg-yellow-600 hover:bg-yellow-500 text-white'}`}>Pendente</button>
                            <button disabled={!canDelete} onClick={() => setIsCancelling(true)} className={`px-4 py-2 rounded-lg text-sm font-medium flex-1 ${!canDelete ? 'opacity-50' : 'bg-red-600 hover:bg-red-500 text-white'}`}>Cancelar</button>
                        </div>
                    ) : (
                        <div className="pt-4 border-t border-slate-700 animate-fade-in space-y-4 bg-red-900/10 p-4 rounded-lg border border-red-500/20">
                            <div className="flex items-start gap-3"><AlertTriangle className="text-red-500 flex-shrink-0" /><div className="w-full"><h4 className="font-bold text-red-500 mb-2">Cancelar Reserva</h4><p className="text-xs text-slate-300 mb-2">Por favor, informe o motivo do cancelamento.</p><textarea autoFocus className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm focus:border-red-500 outline-none" placeholder="Justificativa (obrigatório)..." rows={2} value={cancelReason} onChange={e => setCancelReason(e.target.value)}/></div></div>
                            <div className="flex gap-2 justify-end"><button onClick={() => { setIsCancelling(false); setCancelReason(''); }} className="px-3 py-2 rounded text-sm bg-slate-700 text-slate-300 hover:text-white">Voltar</button><button onClick={handleConfirmCancellation} disabled={!cancelReason.trim()} className="px-3 py-2 rounded text-sm bg-red-600 hover:bg-red-500 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed">Confirmar Cancelamento</button></div>
                        </div>
                    )}
                </div>
            ) : (
                <form onSubmit={handleSaveEdit} className="p-6 space-y-4 animate-fade-in overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="col-span-1"><label className="text-xs text-slate-400 block mb-1">Data</label><input type="date" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} /></div>
                       <div className="col-span-1"><label className="text-xs text-slate-400 block mb-1">Duração</label><div className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white font-bold text-neon-blue">{selectedEditTimes.length}h</div></div>
                       <div className="col-span-1 md:col-span-2"><label className="text-xs text-slate-400 block mb-1">Horários</label>{calculatingSlots ? <div className="text-slate-400 text-sm"><Loader2 className="animate-spin inline mr-2"/>Calculando...</div> : (<div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-40 overflow-y-auto p-1 bg-slate-900/30 rounded border border-slate-700/50">{availableSlots.map(slot => { const isSelected = selectedEditTimes.includes(slot.time); return (<button key={slot.time} type="button" disabled={!slot.available && !isSelected} onClick={() => toggleEditTime(slot.time)} className={`p-2 rounded text-xs font-bold border transition ${isSelected ? 'bg-neon-blue text-white shadow-md' : !slot.available ? 'opacity-30 cursor-not-allowed bg-slate-900 text-slate-500' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>{slot.label}</button>)})}</div>)}</div>
                       <div className="col-span-1"><label className="text-xs text-slate-400 block mb-1">Tipo de Evento</label><select className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" value={editForm.eventType} onChange={e => setEditForm({...editForm, eventType: e.target.value as EventType})}>{EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                       <div className="col-span-1"><label className="text-xs text-slate-400 block mb-1">Valor Total (R$)</label><input type="number" step="0.01" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white font-bold text-neon-green" value={editForm.totalValue} onChange={e => setEditForm({...editForm, totalValue: parseFloat(e.target.value)})} /></div>
                       <div className="col-span-1"><label className="text-xs text-slate-400 block mb-1">Pistas</label><input type="number" min="1" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" value={editForm.laneCount} onChange={e => setEditForm({...editForm, laneCount: parseInt(e.target.value)})} /></div>
                       <div className="col-span-1"><label className="text-xs text-slate-400 block mb-1">Pessoas</label><input type="number" className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white" value={editForm.peopleCount} onChange={e => setEditForm({...editForm, peopleCount: parseInt(e.target.value)})} /></div>
                       <div className="col-span-1 md:col-span-2 bg-slate-900/50 p-3 rounded border border-slate-700"><label className="flex items-center gap-2 cursor-pointer mb-2"><input type="checkbox" className="w-4 h-4 accent-neon-orange" checked={editForm.hasTableReservation} onChange={e => setEditForm({...editForm, hasTableReservation: e.target.checked})}/><span className="text-sm font-bold text-white flex items-center gap-2"><Utensils size={14}/> Reservar Mesa no Restaurante?</span></label>{editForm.hasTableReservation && (<div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2 pl-4 border-l-2 border-slate-700 animate-fade-in"><div><label className="text-xs text-slate-500 block mb-1">Qtd. Lugares</label><input type="number" className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white" value={editForm.tableSeatCount} onChange={e => setEditForm({...editForm, tableSeatCount: parseInt(e.target.value)})} /></div>{(editForm.eventType === EventType.ANIVERSARIO) && (<div><label className="text-xs text-slate-500 block mb-1">Nome do Aniversariante</label><input type="text" className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white" value={editForm.birthdayName || ''} onChange={e => setEditForm({...editForm, birthdayName: e.target.value})} /></div>)}</div>)}</div>
                       <div className="col-span-1 md:col-span-2"><label className="text-xs text-slate-400 block mb-1">Observações</label><textarea className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white h-20 text-sm" value={editForm.observations} onChange={e => setEditForm({...editForm, observations: e.target.value})} /></div>
                    </div>
                    <div className="flex gap-3 pt-4 border-t border-slate-700"><button type="button" onClick={() => setIsEditMode(false)} className="flex-1 py-3 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition">Cancelar</button><button type="submit" disabled={loading || selectedEditTimes.length === 0} className="flex-1 py-3 bg-neon-blue hover:bg-blue-500 text-white rounded-lg font-bold shadow-lg transition">{loading ? <Loader2 className="animate-spin" /> : 'Salvar Detalhes'}</button></div>
                </form>
            )}
          </div>
        </div>
      )}

      {showLaneSelector && laneSelectorTargetRes && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="bg-slate-800 border border-slate-600 w-full max-w-sm rounded-2xl shadow-2xl animate-scale-in p-6">
                  <h3 className="text-xl font-bold text-white mb-2 text-center">Selecionar Pista(s)</h3>
                  <p className="text-sm text-slate-400 text-center mb-6">Em qual pista o cliente está jogando?</p>
                  <div className="grid grid-cols-3 gap-4 mb-6">{Array.from({ length: settings.activeLanes }).map((_, i) => { const laneNum = i + 1; const isSelected = tempSelectedLanes.includes(laneNum); return (<button key={laneNum} onClick={() => toggleLaneSelection(laneNum)} className={`h-16 rounded-xl flex items-center justify-center text-2xl font-bold transition border-2 ${isSelected ? 'bg-neon-blue border-neon-blue text-white shadow-lg scale-105' : 'bg-slate-900 border-slate-700 text-slate-500 hover:border-slate-500'}`}>{laneNum}</button>)})}</div>
                  <div className="flex gap-3"><button onClick={() => { setShowLaneSelector(false); setLaneSelectorTargetRes(null); }} className="flex-1 py-3 bg-slate-700 text-white rounded-lg font-medium">Cancelar</button><button onClick={saveLaneSelection} className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-bold">Confirmar</button></div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Agenda;
