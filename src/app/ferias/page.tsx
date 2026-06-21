"use client"

import * as React from "react"
import { 
  Plane, 
  CalendarDays, 
  ClipboardList, 
  ShieldCheck, 
  Save, 
  Loader2, 
  Star, 
  CheckCircle2, 
  XCircle, 
  History,
  Lock,
  MessageSquare,
  Coins,
  Scissors,
  Search,
  LayoutList,
  Printer,
  Settings2,
  CalendarX,
  Baby,
  GraduationCap,
  Clock,
  AlertCircle,
  FilterX,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { useAuth, useFirestore, useCollection, useDoc } from "@/firebase"
import { collection, addDoc, query, where, orderBy, serverTimestamp, updateDoc, doc, setDoc } from "firebase/firestore"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"

const MONTHS = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"
];

const ITEMS_PER_PAGE = 30;

const normalizeStr = (str: string) => str?.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || "";

const calculatePeriod = (day: string, month: string, year: string, duration: number) => {
  const monthIndex = MONTHS.indexOf(month);
  if (monthIndex === -1 || !year) return "SELECIONE OS DADOS";
  
  const d = parseInt(day) || 1;
  const y = parseInt(year);
  
  const startDate = new Date(y, monthIndex, d);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + (duration - 1));

  const formatDate = (date: Date) => {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  return `DE ${formatDate(startDate)} ATÉ ${formatDate(endDate)}`;
};

export default function FeriasPage() {
  const { user, employeeData } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [opt1, setOpt1] = React.useState({ year: "", month: "", startPreference: "1" });
  const [opt2, setOpt2] = React.useState({ year: "", month: "", startPreference: "1" });
  const [opt3, setOpt3] = React.useState({ year: "", month: "", startPreference: "1" });
  
  const [advance13th, setAdvance13th] = React.useState("nao");
  const [splitPattern, setSplitPattern] = React.useState("30");
  const [hasMinorChildren, setHasMinorChildren] = React.useState("nao");
  const [spouseIsTeacher, setSpouseIsTeacher] = React.useState("nao");
  
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("nova-solicitacao");
  
  const [searchTermApproved, setSearchTermApproved] = React.useState("");
  const [cronogramaFilterMonth, setCronogramaFilterMonth] = React.useState("ALL");
  const [cronogramaFilterYear, setCronogramaFilterYear] = React.useState("ALL");

  const [currentPage, setCurrentPage] = React.useState(1);

  const [isDenyModalOpen, setIsDenyModalOpen] = React.useState(false);
  const [planToDenyId, setPlanToDenyId] = React.useState<string | null>(null);
  const [denialReason, setDenialReason] = React.useState("");
  const [isProcessingDeny, setIsProcessingDeny] = React.useState(false);

  const [isEditApprovedModalOpen, setIsEditApprovedModalOpen] = React.useState(false);
  const [planToEdit, setPlanToEdit] = React.useState<any>(null);
  const [editOptions, setEditOptions] = React.useState<any[]>([]);
  const [isProcessingEdit, setIsProcessingEdit] = React.useState(false);

  const [selectionMap, setSelectionMap] = React.useState<Record<string, any[]>>({});

  const isManager = React.useMemo(() => {
    if (!employeeData) return false;
    const role = normalizeStr(employeeData.role || "");
    return ["COMANDANTE", "INSPETOR GERAL", "GESTOR DE RH"].some(r => role.includes(r));
  }, [employeeData]);

  const isHighCommand = React.useMemo(() => {
    if (!employeeData) return false;
    const role = normalizeStr(employeeData.role || "");
    return ["COMANDANTE", "INSPETOR GERAL"].some(r => role.includes(r));
  }, [employeeData]);

  const myPlansQuery = React.useMemo(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'vacationPlans'), where('employeeId', '==', user.uid), orderBy('createdAt', 'desc'));
  }, [firestore, user]);

  const allPlansQuery = React.useMemo(() => {
    if (!firestore || !isManager) return null;
    return query(collection(firestore, 'vacationPlans'), where('status', '==', 'PENDENTE'), orderBy('createdAt', 'asc'));
  }, [firestore, isManager]);

  const approvedPlansQuery = React.useMemo(() => {
    if (!firestore || !isManager) return null;
    return query(collection(firestore, 'vacationPlans'), where('status', '==', 'APROVADO'), orderBy('updatedAt', 'desc'));
  }, [firestore, isManager]);

  const vacationSettingsRef = React.useMemo(() => 
    firestore ? doc(firestore, 'settings', 'vacation') : null
  , [firestore]);

  const { data: myRequests, loading: loadingMyRequests } = useCollection(myPlansQuery);
  const { data: allPlans, loading: loadingAllPlans } = useCollection(allPlansQuery);
  const { data: approvedPlans, loading: loadingApprovedPlans } = useCollection(approvedPlansQuery);
  const { data: vacationSettings } = useDoc(vacationSettingsRef);

  const isSolicitationOpen = React.useMemo(() => {
    return vacationSettings?.isOpen ?? true;
  }, [vacationSettings]);

  const handleToggleSystem = async (checked: boolean) => {
    if (!firestore) return;
    try {
      await setDoc(doc(firestore, 'settings', 'vacation'), { isOpen: checked }, { merge: true });
      toast({ 
        title: checked ? "SISTEMA ATIVADO" : "SISTEMA BLOQUEADO", 
        description: checked ? "Os servidores agora podem enviar intenções." : "Novos envios foram desabilitados." 
      });
    } catch (e) {
      toast({ variant: "destructive", title: "ERRO AO ALTERAR STATUS" });
    }
  };

  const totalApprovedDays = React.useMemo(() => {
    if (!myRequests) return 0;
    const approved = myRequests.filter(p => p.status === "APROVADO");
    return approved.reduce((total, p) => {
      return total + (p.selectedOptions?.reduce((subTotal: number, opt: any) => subTotal + (opt.duration || 0), 0) || 0);
    }, 0);
  }, [myRequests]);

  const hasPendingPlan = React.useMemo(() => {
    return myRequests?.some(p => p.status === "PENDENTE");
  }, [myRequests]);

  const alreadyApprovedMonths = React.useMemo(() => {
    if (!myRequests) return [];
    const approved = myRequests.filter(p => p.status === "APROVADO");
    const months: string[] = [];
    approved.forEach(p => {
      (p.selectedOptions || []).forEach((opt: any) => {
        months.push(`${opt.month} / ${opt.year} (${opt.duration}d)`);
      });
    });
    return months;
  }, [myRequests]);

  const remainingDays = 30 - totalApprovedDays;

  React.useEffect(() => {
    if (totalApprovedDays > 0 && totalApprovedDays < 30) {
      setSplitPattern(remainingDays.toString());
    }
  }, [totalApprovedDays, remainingDays]);

  const hasChildrenInProfile = React.useMemo(() => !!(employeeData?.children && employeeData.children.length > 0), [employeeData]);
  const hasSpouseInProfile = React.useMemo(() => !!employeeData?.spouseName, [employeeData]);

  const deniedDates = React.useMemo(() => {
    if (!myRequests) return [];
    const dates: string[] = [];
    
    myRequests.forEach(p => {
      if (p.status === "NEGADO") {
        p.options?.forEach((o: any) => dates.push(`${o.year}-${o.month}`));
      }
      if (p.deniedOptions) {
        p.deniedOptions.forEach((o: any) => dates.push(`${o.year}-${o.month}`));
      }
    });
    
    return Array.from(new Set(dates));
  }, [myRequests]);

  const filteredApprovedPlans = React.useMemo(() => {
    if (!approvedPlans) return [];
    const term = searchTermApproved.toLowerCase();
    
    let filtered = approvedPlans.filter(p => 
      p.employeeName?.toLowerCase().includes(term) ||
      p.employeeQra?.toLowerCase().includes(term)
    );

    if (cronogramaFilterMonth !== "ALL") {
      filtered = filtered.filter(p => 
        p.selectedOptions?.some((opt: any) => opt.month === cronogramaFilterMonth)
      );
    }

    if (cronogramaFilterYear !== "ALL") {
      filtered = filtered.filter(p => 
        p.selectedOptions?.some((opt: any) => opt.year === cronogramaFilterYear)
      );
    }

    return filtered.sort((a, b) => {
      const getEarliest = (p: any) => {
        if (!p.selectedOptions?.length) return Infinity;
        const sortedOpts = [...p.selectedOptions].sort((o1, o2) => {
          if (o1.year !== o2.year) return parseInt(o1.year) - parseInt(o2.year);
          return MONTHS.indexOf(o1.month) - MONTHS.indexOf(o2.month);
        });
        const first = sortedOpts[0];
        return parseInt(first.year) * 100 + MONTHS.indexOf(first.month);
      };
      return getEarliest(a) - getEarliest(b);
    });
  }, [approvedPlans, searchTermApproved, cronogramaFilterMonth, cronogramaFilterYear]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTermApproved, cronogramaFilterMonth, cronogramaFilterYear]);

  const paginatedApprovedPlans = React.useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredApprovedPlans.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredApprovedPlans, currentPage]);

  const totalPages = Math.ceil(filteredApprovedPlans.length / ITEMS_PER_PAGE);

  const groupedPrintData = React.useMemo(() => {
    if (!filteredApprovedPlans) return [];
    
    const entries: any[] = [];
    filteredApprovedPlans.forEach(plan => {
      (plan.selectedOptions || []).forEach(opt => {
        const matchesMonth = cronogramaFilterMonth === "ALL" || opt.month === cronogramaFilterMonth;
        const matchesYear = cronogramaFilterYear === "ALL" || opt.year === cronogramaFilterYear;

        if (matchesMonth && matchesYear) {
          entries.push({
            month: opt.month,
            year: opt.year,
            startDay: opt.startDay,
            duration: opt.duration,
            employeeName: plan.employeeName,
            employeeQra: plan.employeeQra,
            employeeEscala: plan.employeeEscala,
            employeeTurno: plan.employeeTurno,
            processedByQra: plan.processedByQra,
            periodText: calculatePeriod(opt.startDay, opt.month, opt.year, opt.duration || (plan.splitVacation ? 15 : 30))
          });
        }
      });
    });

    const groups: Record<string, any[]> = {};
    entries.forEach(entry => {
      const key = `${entry.month} / ${entry.year}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(entry);
    });

    return Object.keys(groups).sort((a, b) => {
      const [mA, yA] = a.split(' / ');
      const [mB, yB] = b.split(' / ');
      if (yA !== yB) return yA.localeCompare(yB);
      return MONTHS.indexOf(mA) - MONTHS.indexOf(mB);
    }).map(key => ({
      title: key,
      members: groups[key].sort((a, b) => a.employeeName.localeCompare(b.employeeName))
    }));
  }, [filteredApprovedPlans, cronogramaFilterMonth, cronogramaFilterYear]);

  const nextYears = React.useMemo(() => {
    const currentYear = new Date().getFullYear();
    return [currentYear + 1, currentYear + 2];
  }, []);

  const handleSave = async () => {
    if (!user || !employeeData) return;
    setIsSubmitting(true);

    const payload = {
      employeeId: user.uid,
      employeeName: employeeData.name,
      employeeQra: employeeData.qra,
      employeeEscala: employeeData.escala || "N/A",
      employeeTurno: employeeData.turno || "N/A",
      advance13th: advance13th === "sim",
      splitVacation: splitPattern !== "30",
      splitPattern: splitPattern,
      hasMinorChildren: hasMinorChildren === "sim",
      spouseIsTeacher: spouseIsTeacher === "sim",
      options: remainingDays < 30 ? [opt1, opt2] : [opt1, opt2, opt3],
      status: "PENDENTE",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      await addDoc(collection(firestore, 'vacationPlans'), payload);
      toast({ title: "INTENÇÃO GRAVADA!", description: "Suas opções foram enviadas para análise do RH." });
      setOpt1({ year: "", month: "", startPreference: "1" });
      setOpt2({ year: "", month: "", startPreference: "1" });
      setOpt3({ year: "", month: "", startPreference: "1" });
      setAdvance13th("nao");
      setHasMinorChildren("nao");
      setSpouseIsTeacher("nao");
      setActiveTab("meus-pedidos");
    } catch (error) {
      toast({ variant: "destructive", title: "ERRO AO ENVIAR", description: "Tente novamente mais tarde." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProcess = async (plan: any, action: 'approve' | 'deny', selectedOpts?: any[], reason?: string) => {
    if (!firestore || !employeeData) return;
    
    try {
      const updates: any = {
        status: action === 'approve' ? "APROVADO" : "NEGADO",
        updatedAt: serverTimestamp(),
        processedByQra: (employeeData.qra || "SISTEMA").toUpperCase()
      };

      if (action === 'approve' && selectedOpts) {
        const parts = plan.splitPattern?.split('+').map(Number) || [30];
        updates.selectedOptions = selectedOpts.map((opt, idx) => ({
          ...opt,
          duration: parts[idx] || parts[0] || (plan.splitVacation ? 15 : 30)
        }));
        
        const totalDurationSelected = updates.selectedOptions.reduce((acc: number, o: any) => acc + o.duration, 0);
        const requiredDuration = plan.splitPattern === "10+20" || plan.splitPattern === "15+15" || plan.splitPattern === "20+10" ? 30 : parseInt(plan.splitPattern || "30");

        if (totalDurationSelected < requiredDuration) {
           const denied = plan.options.filter((o: any) => 
            !selectedOpts.some(s => s.year === o.year && s.month === o.month)
          );
          updates.deniedOptions = denied;
        }
      }

      if (reason) {
        updates.adminResponse = reason.toUpperCase();
      }

      await updateDoc(doc(firestore, 'vacationPlans', plan.id), updates);
      toast({ title: action === 'approve' ? "FÉRIAS HOMOLOGADAS!" : "PEDIDO INDEFERIDO" });
      
      setSelectionMap(prev => {
        const next = { ...prev };
        delete next[plan.id];
        return next;
      });
    } catch (error) {
      toast({ variant: "destructive", title: "ERRO NO PROCESSAMENTO" });
    }
  };

  const handleConfirmDeny = async () => {
    if (!planToDenyId || !denialReason.trim()) {
      toast({ variant: "destructive", title: "JUSTIFICATIVA OBRIGATÓRIA" });
      return;
    }

    const plan = allPlans.find(p => p.id === planToDenyId);
    if (!plan) return;

    setIsProcessingDeny(true);
    await handleProcess(plan, 'deny', undefined, denialReason);
    setIsProcessingDeny(false);
    setIsDenyModalOpen(false);
    setPlanToDenyId(null);
    setDenialReason("");
  };

  const handleOpenEditModal = (plan: any) => {
    setPlanToEdit(plan);
    setEditOptions(JSON.parse(JSON.stringify(plan.selectedOptions || [])));
    setIsEditApprovedModalOpen(true);
  };

  const handleUpdateApprovedPlan = async () => {
    if (!firestore || !planToEdit || !employeeData) return;
    setIsProcessingEdit(true);

    try {
      const docRef = doc(firestore, 'vacationPlans', planToEdit.id);
      await updateDoc(docRef, {
        selectedOptions: editOptions,
        processedByQra: (employeeData.qra || "SISTEMA").toUpperCase(),
        updatedAt: serverTimestamp()
      });
      toast({ title: "PLANEJAMENTO ATUALIZADO", description: "As datas foram corrigidas com sucesso." });
      setIsEditApprovedModalOpen(false);
      setPlanToEdit(null);
    } catch (error) {
      toast({ variant: "destructive", title: "ERRO NA ATUALIZAÇÃO" });
    } finally {
      setIsProcessingEdit(false);
    }
  };

  const isBlocked = (year: string, month: string) => {
    return deniedDates.includes(`${year}-${month}`);
  };

  const isCombinationTaken = (year: string, month: string, currentPriority: number) => {
    if (!year || !month) return false;
    const selections = [opt1, opt2, opt3];
    return selections.some((sel, idx) => {
      if (idx + 1 === currentPriority) return false;
      return sel.year === year && sel.month === month;
    });
  };

  const toggleOptionSelection = (planId: string, opt: any, pattern: string) => {
    const current = selectionMap[planId] || [];
    const isSelected = current.some(s => s.year === opt.year && s.month === opt.month);
    const requiredCount = (pattern === "10+20" || pattern === "15+15" || pattern === "20+10") ? 2 : 1;
    
    if (isSelected) {
      setSelectionMap({ ...selectionMap, [planId]: current.filter(s => !(s.year === opt.year && s.month === opt.month)) });
    } else {
      const newSelection = { ...opt, startDay: opt.startPreference || "1" };
      if (requiredCount === 1) {
        setSelectionMap({ ...selectionMap, [planId]: [newSelection] });
      } else {
        if (current.length < requiredCount) {
          setSelectionMap({ ...selectionMap, [planId]: [...current, newSelection] });
        } else {
          toast({ variant: "default", title: "LIMITE ATINGIDO", description: `Selecione apenas ${requiredCount} períodos conforme o modelo.` });
        }
      }
    }
  };

  const updateOptionDay = (planId: string, year: string, month: string, day: string) => {
    const current = selectionMap[planId] || [];
    const updated = current.map(s => {
      if (s.year === year && s.month === month) {
        return { ...s, startDay: day };
      }
      return s;
    });
    setSelectionMap({ ...selectionMap, [planId]: updated });
  };

  const handlePrint = () => {
    window.print();
  };

  const isFormValid = remainingDays < 30
    ? (opt1.year && opt1.month && opt2.year && opt2.month)
    : (opt1.year && opt1.month && opt2.year && opt2.month && opt3.year && opt3.month);

  const clearCronogramaFilters = () => {
    setSearchTermApproved("");
    setCronogramaFilterMonth("ALL");
    setCronogramaFilterYear("ALL");
  };

  const renderOptionRow = (
    priority: number, 
    data: { year: string, month: string, startPreference?: string }, 
    setData: (val: { year: string, month: string, startPreference: string }) => void,
    label: string
  ) => {
    const isThisBlocked = data.year && data.month && isBlocked(data.year, data.month);
    const firstDuration = splitPattern === "30" ? 30 : parseInt(splitPattern.split('+')[0]);

    return (
      <div className={cn(
        "p-4 rounded-2xl border transition-all animate-in slide-in-from-left-2 duration-300 space-y-4",
        isThisBlocked ? "bg-red-50 border-red-200" : "bg-slate-50/50 border-slate-100"
      )}>
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-1.5 rounded-lg">
              <Star className={cn("h-4 w-4", priority === 1 ? "text-amber-500 fill-amber-500" : "text-primary")} />
            </div>
            <span className="text-[11px] font-black uppercase text-slate-700 tracking-widest">{label}</span>
          </div>
          {isThisBlocked && (
            <Badge variant="destructive" className="text-[8px] font-black uppercase animate-pulse">BLOQUEADO PELO RH</Badge>
          )}
        </div>
        
        <div className="grid grid-cols-1 gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-tight">Ano</Label>
              <Select value={data.year} onValueChange={(v) => setData({ ...data, year: v, startPreference: data.startPreference || "1" })}>
                <SelectTrigger className="h-10 uppercase font-bold text-xs bg-white">
                  <SelectValue placeholder="ANO..." />
                </SelectTrigger>
                <SelectContent>
                  {nextYears.map(year => (
                    <SelectItem key={year} value={year.toString()} className="uppercase font-bold text-xs">{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-tight">Mês</Label>
              <Select value={data.month} onValueChange={(v) => setData({ ...data, month: v, startPreference: data.startPreference || "1" })}>
                <SelectTrigger className="h-10 uppercase font-bold text-xs bg-white">
                  <SelectValue placeholder="MÊS..." />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map(month => (
                    <SelectItem 
                      key={month} 
                      value={month} 
                      disabled={isCombinationTaken(data.year, month, priority) || isBlocked(data.year, month)}
                      className="uppercase font-bold text-xs"
                    >
                      {month} {isBlocked(data.year, month) ? "(INDISPONÍVEL)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-tight flex items-center gap-1.5">
              <Clock className="h-3 w-3" /> Previsão de Início
            </Label>
            <Select value={data.startPreference || "1"} onValueChange={(v) => setData({ ...data, startPreference: v })}>
              <SelectTrigger className="h-10 uppercase font-bold text-xs bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1" className="uppercase font-bold text-xs">INÍCIO DO MÊS (DIA 01)</SelectItem>
                <SelectItem value="16" className="uppercase font-bold text-xs">METADE DO MÊS (DIA 16)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="pt-2 bg-white/50 p-2 rounded-xl border border-dashed border-slate-200 text-center">
             <p className="text-[8px] font-bold text-muted-foreground uppercase">Projeção do Período</p>
             <p className="text-[10px] font-black text-primary uppercase mt-0.5">
               {calculatePeriod(data.startPreference || "1", data.month, data.year, firstDuration)}
             </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20 print:p-0">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4 portrait; margin: 1.5cm; }
          html, body, main, [data-sidebar="inset"], .flex-1 { overflow: visible !important; height: auto !important; display: block !important; background: white !important; }
          .print-hidden, header, nav, footer, aside, .tabs-list, .pagination-controls { display: none !important; }
          .printable-content { display: block !important; width: 100% !important; color: black !important; }
          .report-header { margin-bottom: 1.5rem; border-bottom: 2px solid black; padding-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: flex-end; }
          .report-header h1 { font-size: 14pt !important; }
          .month-section { margin-bottom: 1.5rem; break-inside: avoid-page; }
          .month-title { background-color: #f0f0f0 !important; -webkit-print-color-adjust: exact; padding: 4px 8px; font-size: 11pt; font-weight: 900; text-transform: uppercase; border-left: 5px solid black; margin-bottom: 0.5rem; }
          .report-table { width: 100%; border-collapse: collapse; }
          .report-table th, .report-table td { border: 1px solid #000; padding: 4px 6px; font-size: 8.5pt; text-align: left; text-transform: uppercase; }
          .report-table th { font-weight: 900; background-color: #fafafa !important; }
          .report-table td.center { text-align: center; }
          .report-table td.period-cell { font-size: 7.5pt; font-weight: 900; }
        }
      ` }} />

      <div className="hidden printable-content">
        <div className="report-header">
          <div>
            <h1 className="font-black uppercase">Cronograma Geral de Férias</h1>
            <p className="text-[8pt] font-bold text-muted-foreground uppercase tracking-widest">Núcleo de RH - GMVV</p>
          </div>
          <div className="text-right">
            <p className="text-[7pt] font-mono font-bold uppercase">Gerado em: {new Date().toLocaleString('pt-BR')}</p>
            {(cronogramaFilterMonth !== "ALL" || cronogramaFilterYear !== "ALL") && (
              <p className="text-[7pt] font-black uppercase mt-1">Filtro: {cronogramaFilterMonth !== "ALL" ? cronogramaFilterMonth : ""} {cronogramaFilterYear !== "ALL" ? cronogramaFilterYear : ""}</p>
            )}
          </div>
        </div>

        {groupedPrintData.length === 0 ? (
          <div className="text-center py-20 uppercase font-bold">Nenhum registro encontrado para o filtro selecionado.</div>
        ) : groupedPrintData.map((group, idx) => (
          <div key={idx} className="month-section">
            <div className="month-title">{group.title}</div>
            <table className="report-table">
              <thead>
                <tr>
                  <th style={{ width: '220px' }}>Servidor / QRA</th>
                  <th>Escala / Turno</th>
                  <th style={{ width: '240px' }} className="center">Período</th>
                  <th style={{ width: '90px' }} className="center">Duração</th>
                </tr>
              </thead>
              <tbody>
                {group.members.map((member, mIdx) => (
                  <tr key={mIdx}>
                    <td className="font-bold">{member.employeeName} ({member.employeeQra})</td>
                    <td>{member.employeeEscala} / {member.employeeTurno}</td>
                    <td className="center period-cell">{member.periodText}</td>
                    <td className="center font-bold">{member.duration} DIAS</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <div className="print-hidden">
        <Dialog open={isDenyModalOpen} onOpenChange={setIsDenyModalOpen}>
          <DialogContent className="rounded-2xl border-none shadow-2xl p-6 sm:p-8">
            <DialogHeader>
              <div className="bg-red-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-4">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
              <DialogTitle className="uppercase text-xl font-black">Justificar Indeferimento</DialogTitle>
              <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1 tracking-widest">Informe o motivo pelo qual as opções do servidor não podem ser atendidas.</p>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-700 tracking-tight">Parecer da Administração</Label>
                <Textarea 
                  placeholder="EX: EXCESSO DE SERVIDORES NO PERÍODO, NECESSIDADE DO SERVIÇO..." 
                  className="min-h-[120px] uppercase text-xs p-4 bg-slate-50 border-slate-200 focus:bg-white transition-all resize-none" 
                  value={denialReason}
                  onChange={(e) => setDenialReason(e.target.value.toUpperCase())}
                />
              </div>
            </div>
            <DialogFooter className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <Button variant="ghost" onClick={() => setIsDenyModalOpen(false)} className="h-12 uppercase font-black text-xs tracking-widest">Cancelar</Button>
              <Button 
                onClick={handleConfirmDeny} 
                disabled={!denialReason.trim() || isProcessingDeny}
                className="h-12 uppercase font-black text-xs tracking-widest bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-100"
              >
                {isProcessingDeny ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Confirmar Indeferimento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditApprovedModalOpen} onOpenChange={setIsEditApprovedModalOpen}>
          <DialogContent className="rounded-2xl border-none shadow-2xl p-6 sm:p-8 max-w-xl">
            <DialogHeader>
              <div className="bg-amber-50 w-12 h-12 rounded-2xl flex items-center justify-center mb-4">
                <Edit2 className="h-6 w-6 text-amber-600" />
              </div>
              <DialogTitle className="uppercase text-xl font-black">Ajustar Planejamento</DialogTitle>
              <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1 tracking-widest">Apenas o Comando e Inspetoria Geral podem ajustar períodos homologados.</p>
            </DialogHeader>
            <div className="py-6 space-y-6">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="text-sm font-black uppercase text-slate-900 leading-none">{planToEdit?.employeeName}</p>
                <p className="text-[10px] font-bold text-primary uppercase mt-1">QRA: {planToEdit?.employeeQra}</p>
              </div>

              {editOptions.map((opt, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-white space-y-4">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-[10px] font-black uppercase text-slate-600 tracking-widest">{idx + 1}º Período ({opt.duration} Dias)</span>
                    <Badge className="bg-amber-600 text-white text-[8px] font-black uppercase">Edição do Comando</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[8px] font-black uppercase text-muted-foreground">Ano</Label>
                      <Select value={opt.year} onValueChange={(v) => { const next = [...editOptions]; next[idx].year = v; setEditOptions(next); }}>
                        <SelectTrigger className="h-9 uppercase font-bold text-[10px]"><SelectValue /></SelectTrigger>
                        <SelectContent>{nextYears.map(y => <SelectItem key={y} value={y.toString()} className="uppercase font-bold text-[10px]">{y}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[8px] font-black uppercase text-muted-foreground">Mês</Label>
                      <Select value={opt.month} onValueChange={(v) => { const next = [...editOptions]; next[idx].month = v; setEditOptions(next); }}>
                        <SelectTrigger className="h-9 uppercase font-bold text-[10px]"><SelectValue /></SelectTrigger>
                        <SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m} className="uppercase font-bold text-[10px]">{m}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[8px] font-black uppercase text-muted-foreground">Dia Início</Label>
                      <Input value={opt.startDay} onChange={(e) => { const next = [...editOptions]; next[idx].startDay = e.target.value.replace(/\D/g, '').slice(0, 2); setEditOptions(next); }} className="h-9 font-black text-center text-xs" />
                    </div>
                  </div>
                  <div className="pt-2 bg-slate-50/50 p-2 rounded-lg border border-dashed text-center">
                    <span className="text-[9px] font-black text-blue-700 uppercase">{calculatePeriod(opt.startDay, opt.month, opt.year, opt.duration)}</span>
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter className="grid grid-cols-2 gap-3">
              <Button variant="ghost" onClick={() => setIsEditApprovedModalOpen(false)} className="h-12 uppercase font-black text-xs">Cancelar</Button>
              <Button onClick={handleUpdateApprovedPlan} disabled={isProcessingEdit} className="h-12 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-xs shadow-xl shadow-blue-100">
                {isProcessingEdit ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />} Salvar Ajuste
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col gap-2 print-hidden">
        <div className="flex items-center gap-3">
          <div className="bg-blue-50 p-2 rounded-xl">
            <Plane className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight uppercase text-primary">Gestão de Férias</h2>
            <p className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest">Acompanhamento e solicitação de períodos de descanso.</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full print-hidden">
        <TabsList className={cn(
          "grid w-full bg-muted/50 p-1 rounded-xl h-auto",
          isManager ? "grid-cols-4 lg:w-[850px]" : "grid-cols-2 lg:w-[400px]"
        )}>
          <TabsTrigger value="nova-solicitacao" className="rounded-lg uppercase text-[10px] font-bold flex items-center gap-2 py-2">
            <CalendarDays className="h-3.5 w-3.5" /> NOVA SOLICITAÇÃO
          </TabsTrigger>
          <TabsTrigger value="meus-pedidos" className="rounded-lg uppercase text-[10px] font-bold flex items-center gap-2 py-2">
            <History className="h-3.5 w-3.5" /> MEUS PEDIDOS
          </TabsTrigger>
          {isManager && (
            <>
              <TabsTrigger value="painel-gestao" className="rounded-lg uppercase text-[10px] font-bold flex items-center gap-2 text-primary py-2">
                <ShieldCheck className="h-3.5 w-3.5" /> PAINEL DE GESTÃO
                {allPlans?.length > 0 && (
                  <Badge className="ml-1.5 h-4 w-4 p-0 flex items-center justify-center bg-primary text-primary-foreground text-[8px] rounded-full">
                    {allPlans.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="cronograma" className="rounded-lg uppercase text-[10px] font-bold flex items-center gap-2 text-blue-600 py-2">
                <LayoutList className="h-3.5 w-3.5" /> CRONOGRAMA GERAL
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="nova-solicitacao" className="mt-6 space-y-6">
          {!isSolicitationOpen ? (
            <Card className="card-shadow border-none rounded-3xl overflow-hidden animate-in zoom-in-95 duration-500">
              <CardContent className="flex flex-col items-center justify-center p-20 text-center space-y-6 bg-slate-50/50">
                <div className="bg-red-50 p-6 rounded-full border-4 border-white shadow-xl">
                  <CalendarX className="h-16 w-16 text-red-600" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black uppercase text-slate-900 tracking-tight">Período Encerrado</h3>
                  <p className="text-muted-foreground uppercase text-xs font-bold tracking-widest max-w-md leading-relaxed">
                    O formulário para novas intenções de férias encontra-se desabilitado ou ainda não foi iniciado pela administração da unidade.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : hasPendingPlan ? (
            <Card className="card-shadow border-none rounded-3xl overflow-hidden animate-in zoom-in-95 duration-500">
              <CardContent className="flex flex-col items-center justify-center p-20 text-center space-y-6 bg-amber-50/50">
                <div className="bg-amber-100 p-6 rounded-full border-4 border-white shadow-xl">
                  <Clock className="h-16 w-16 text-amber-600" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black uppercase text-slate-900 tracking-tight">Solicitação em Análise</h3>
                  <p className="text-muted-foreground uppercase text-xs font-bold tracking-widest max-w-md leading-relaxed">
                    Você já possui uma intenção de férias enviada que aguarda processamento pelo RH. Não é possível enviar uma nova enquanto a atual estiver pendente.
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => setActiveTab("meus-pedidos")} 
                  className="uppercase font-black text-[10px] h-10 border-amber-200 text-amber-700 hover:bg-amber-50"
                >
                  VER MINHA SOLICITAÇÃO ATUAL
                </Button>
              </CardContent>
            </Card>
          ) : totalApprovedDays >= 30 ? (
             <Card className="card-shadow border-none rounded-3xl overflow-hidden animate-in zoom-in-95 duration-500">
              <CardContent className="flex flex-col items-center justify-center p-20 text-center space-y-6 bg-green-50/50">
                <div className="bg-green-100 p-6 rounded-full border-4 border-white shadow-xl">
                  <CheckCircle2 className="h-16 w-16 text-green-600" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black uppercase text-slate-900 tracking-tight">Saldo de Férias Completo</h3>
                  <p className="text-muted-foreground uppercase text-xs font-bold tracking-widest max-w-md leading-relaxed">
                    Você já possui 30 dias de férias homologados para o período atual.
                  </p>
                </div>
                <Button variant="outline" onClick={() => setActiveTab("meus-pedidos")} className="uppercase font-black text-[10px] h-10 border-green-200 text-green-700 hover:bg-green-50">VER MEU CRONOGRAMA</Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="card-shadow border-none rounded-2xl overflow-hidden">
              <CardHeader className="bg-blue-50/50 border-b p-6">
                <div className="flex items-center gap-4">
                  <div className="bg-white p-2 rounded-xl border shadow-sm">
                    <CalendarDays className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-black uppercase text-slate-900 tracking-tight">
                      {remainingDays < 30 ? `Saldo de Férias (${remainingDays} dias)` : "Intenção de Férias"}
                    </CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Escolha períodos distintos. Datas negadas anteriormente ficam bloqueadas.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 sm:p-8 space-y-8">
                {remainingDays < 30 && (
                  <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex items-start gap-4">
                    <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase text-amber-800 leading-tight">Saldo Remanescente</p>
                      <p className="text-[9px] font-bold text-amber-700 uppercase leading-relaxed">
                        Você já possui períodos homologados: <strong>{alreadyApprovedMonths.join(", ")}</strong>.
                      </p>
                      <Badge variant="outline" className="bg-white border-amber-200 text-amber-800 font-black text-[8px] uppercase">Selecione 2 novas opções para o saldo de {remainingDays} dias.</Badge>
                    </div>
                  </div>
                )}

                <div className={cn(
                  "grid grid-cols-1 gap-6",
                  remainingDays < 30 ? "md:grid-cols-2" : "md:grid-cols-3"
                )}>
                  {renderOptionRow(1, opt1, setOpt1, "1ª Prioridade")}
                  {renderOptionRow(2, opt2, setOpt2, "2ª Prioridade")}
                  {remainingDays === 30 && renderOptionRow(3, opt3, setOpt3, "3ª Prioridade")}
                </div>

                <div className="pt-6 border-t border-slate-100 space-y-6">
                  <h4 className="text-[11px] font-black uppercase text-slate-800 tracking-widest flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" /> Critérios de Prioridade (Baseado no Perfil)
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {hasChildrenInProfile && (
                      <Card className="bg-slate-50/50 border-slate-200 shadow-sm rounded-xl overflow-hidden border">
                        <CardContent className="p-4 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="bg-white p-2 rounded-lg border shadow-sm">
                              <Baby className="h-5 w-5 text-blue-600" />
                            </div>
                            <Label className="text-[10px] font-bold uppercase text-slate-700 leading-tight">
                              Tem filhos menores 18 anos, em idade escolar?
                            </Label>
                          </div>
                          <RadioGroup value={hasMinorChildren} onValueChange={setHasMinorChildren} className="flex gap-4">
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="sim" id="hmc-sim" />
                              <Label htmlFor="hmc-sim" className="text-[10px] font-bold uppercase">SIM</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="nao" id="hmc-nao" />
                              <Label htmlFor="hmc-nao" className="text-[10px] font-bold uppercase">NÃO</Label>
                            </div>
                          </RadioGroup>
                        </CardContent>
                      </Card>
                    )}

                    {hasSpouseInProfile && (
                      <Card className="bg-slate-50/50 border-slate-200 shadow-sm rounded-xl overflow-hidden border">
                        <CardContent className="p-4 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="bg-white p-2 rounded-lg border shadow-sm">
                              <GraduationCap className="h-5 w-5 text-purple-600" />
                            </div>
                            <Label className="text-[10px] font-bold uppercase text-slate-700 leading-tight">
                              Cônjuge professor(a) do Município de Vila Velha?
                            </Label>
                          </div>
                          <RadioGroup value={spouseIsTeacher} onValueChange={setSpouseIsTeacher} className="flex gap-4">
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="sim" id="sit-sim" />
                              <Label htmlFor="sit-sim" className="text-[10px] font-bold uppercase">SIM</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="nao" id="sit-nao" />
                              <Label htmlFor="sit-nao" className="text-[10px] font-bold uppercase">NÃO</Label>
                            </div>
                          </RadioGroup>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 space-y-6">
                  <h4 className="text-[11px] font-black uppercase text-slate-800 tracking-widest flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-blue-600" /> Preferências de Gozo e Pagamento
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="bg-slate-50/50 border-slate-200 shadow-sm rounded-xl overflow-hidden border">
                      <CardContent className="p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-white p-2 rounded-lg border shadow-sm">
                            <Coins className="h-5 w-5 text-amber-500" />
                          </div>
                          <Label className="text-[10px] font-bold uppercase text-slate-700 leading-tight">
                            Deseja receber o 13º antecipado (nas férias)?
                          </Label>
                        </div>
                        <RadioGroup value={advance13th} onValueChange={setAdvance13th} className="flex gap-4">
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="sim" id="a13-sim" />
                            <Label htmlFor="a13-sim" className="text-[10px] font-bold uppercase">SIM</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="nao" id="a13-nao" />
                            <Label htmlFor="a13-nao" className="text-[10px] font-bold uppercase">NÃO</Label>
                          </div>
                        </RadioGroup>
                      </CardContent>
                    </Card>

                    <Card className={cn(
                      "bg-slate-50/50 border-slate-200 shadow-sm rounded-xl overflow-hidden border",
                      remainingDays < 30 && "bg-amber-50/30 border-amber-100"
                    )}>
                      <CardContent className="p-4 flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-white p-2 rounded-lg border shadow-sm">
                            <Scissors className="h-5 w-5 text-blue-500" />
                          </div>
                          <Label className="text-[10px] font-bold uppercase text-slate-700 leading-tight">
                            {remainingDays < 30 ? `Modelo de gozo para saldo de ${remainingDays} dias` : "Modelo de gozo das férias"}
                          </Label>
                        </div>
                        
                        <Select 
                          value={splitPattern} 
                          onValueChange={setSplitPattern}
                          disabled={remainingDays < 30}
                        >
                          <SelectTrigger className="h-11 uppercase font-bold text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="30" className="uppercase font-bold text-xs">Período Integral (30 Dias)</SelectItem>
                            <SelectItem value="15+15" className="uppercase font-bold text-xs">Dois Períodos (15 + 15 Dias)</SelectItem>
                            <SelectItem value="10+20" className="uppercase font-bold text-xs">Dois Períodos (10 + 20 Dias)</SelectItem>
                            <SelectItem value="20+10" className="uppercase font-bold text-xs">Dois Períodos (20 + 10 Dias)</SelectItem>
                          </SelectContent>
                        </Select>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="bg-slate-50 border-t p-6 flex justify-end">
                <Button 
                  onClick={handleSave}
                  disabled={!isFormValid || isSubmitting}
                  className="h-12 px-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-200 transition-all active:scale-95"
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Enviar para Análise
                </Button>
              </CardFooter>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="meus-pedidos" className="mt-6 space-y-6">
          <div className="space-y-6">
            <div className="flex items-center gap-3 border-b pb-4">
              <History className="h-6 w-6 text-slate-400" />
              <h3 className="text-xl font-black uppercase text-slate-700 tracking-tight">Meu Histórico de Solicitações</h3>
            </div>
            
            {loadingMyRequests ? <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /> : (
              <div className="grid gap-4">
                {myRequests.length === 0 ? (
                  <div className="text-center py-20 border-2 border-dashed rounded-3xl uppercase text-[10px] font-bold text-muted-foreground italic tracking-widest">VOCÊ AINDA NÃO ENVIOU INTENÇÕES DE FÉRIAS.</div>
                ) : (
                  myRequests.map(plan => (
                    <Card key={plan.id} className="card-shadow border-none rounded-xl overflow-hidden group">
                      <div className="flex flex-col sm:flex-row items-stretch">
                        <div className={cn(
                          "w-full sm:w-20 flex flex-col items-center justify-center p-4 text-white",
                          plan.status === 'APROVADO' ? 'bg-green-600' : plan.status === 'NEGADO' ? 'bg-red-600' : 'bg-amber-500'
                        )}>
                          <span className="text-[10px] font-black uppercase text-center leading-tight mb-1.5">{plan.status}</span>
                          {plan.status === 'APROVADO' ? <CheckCircle2 className="h-6 w-6" /> : plan.status === 'NEGADO' ? <XCircle className="h-6 w-6" /> : <Loader2 className="h-6 w-6 animate-spin" />}
                        </div>
                        <div className="flex-1 p-4 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex-1">
                              {plan.status === 'APROVADO' ? (
                                <div className="space-y-2.5">
                                  <div className="flex items-center gap-2">
                                    <Star className="h-5 w-5 text-green-600 fill-green-600" />
                                    <p className="text-[10px] font-black uppercase text-green-800 tracking-widest">
                                      PERÍODO(S) HOMOLOGADO(S) PELO RH: {plan.processedByQra || ""}
                                    </p>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {(plan.selectedOptions || []).map((opt: any, i: number) => (
                                      <div key={i} className="bg-green-50 p-2.5 rounded-xl border border-green-100">
                                        <p className="text-xl font-black uppercase text-green-900 leading-none">
                                          {opt.startDay ? `${opt.startDay} ` : ""}{opt.month} / {opt.year} - {opt.duration} DIAS
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  {plan.options.map((opt: any, i: number) => (
                                    <div key={i} className="px-3 py-2 bg-slate-50 rounded-lg border border-slate-100 flex flex-col gap-1">
                                      <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">{i + 1}ª Opção</span>
                                        <span className="text-[11px] font-black uppercase text-slate-800">{opt.month} / {opt.year}</span>
                                      </div>
                                      <Badge variant="outline" className="text-[8px] font-black uppercase border-slate-200 text-slate-600 w-fit">
                                        {opt.startPreference === "16" ? "METADE DO MÊS" : "INÍCIO DO MÊS"}
                                      </Badge>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100">
                            <div className="flex items-center gap-1.5">
                              <Coins className="h-3 w-3 text-amber-500" />
                              <span className="text-[8px] font-black uppercase text-slate-500">13º:</span>
                              <Badge variant="outline" className="text-[7px] font-black uppercase px-1.5 h-4.5">{plan.advance13th ? "SIM" : "NÃO"}</Badge>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Scissors className="h-3 w-3 text-blue-500" />
                              <span className="text-[8px] font-black uppercase text-slate-500">Modelo:</span>
                              <Badge variant="outline" className="text-[7px] font-black uppercase px-1.5 h-4.5">{plan.splitPattern || (plan.splitVacation ? "15+15" : "30")}</Badge>
                            </div>
                            {plan.hasMinorChildren && (
                              <div className="flex items-center gap-1.5">
                                <Baby className="h-3 w-3 text-blue-600" />
                                <span className="text-[8px] font-black uppercase text-slate-500">Filhos:</span>
                                <Badge className="text-[7px] font-black uppercase bg-blue-600 text-white border-none px-1.5 h-4.5">SIM</Badge>
                              </div>
                            )}
                            {plan.spouseIsTeacher && (
                              <div className="flex items-center gap-1.5">
                                <GraduationCap className="h-3 w-3 text-purple-600" />
                                <span className="text-[8px] font-black uppercase text-slate-500">Cônjuge:</span>
                                <Badge className="text-[7px] font-black uppercase bg-purple-600 text-white border-none px-1.5 h-4.5">SIM</Badge>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1.5 border-t border-slate-100/50">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span className="text-[8px] font-black uppercase tracking-widest">Enviado em:</span>
                              <span className="text-[9px] font-mono font-bold">{plan.createdAt?.toDate ? plan.createdAt.toDate().toLocaleString('pt-BR') : '---'}</span>
                            </div>
                            {(plan.status === 'APROVADO' || plan.status === 'NEGADO') && (
                              <div className="flex items-center gap-1.5 text-blue-600">
                                <CheckCircle2 className="h-3 w-3" />
                                <span className="text-[8px] font-black uppercase tracking-widest">Processado:</span>
                                <span className="text-[9px] font-mono font-bold">{plan.updatedAt?.toDate ? plan.updatedAt.toDate().toLocaleString('pt-BR') : '---'}</span>
                              </div>
                            )}
                          </div>

                          {plan.status === 'NEGADO' && (
                            <div className="space-y-2 mt-1 animate-in slide-in-from-top-1 duration-500">
                              <div className="flex items-start gap-3 bg-red-50 p-3 rounded-xl border border-red-100">
                                <Lock className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                                <div className="space-y-1.5 flex-1">
                                  <div className="space-y-0.5">
                                    <p className="text-[10px] text-red-800 font-black uppercase tracking-tight">DATAS BLOQUEADAS PELA ADMINISTRAÇÃO</p>
                                    <p className="text-[9px] text-red-700 font-medium uppercase leading-relaxed">
                                      ESTAS OPÇÕES NÃO PODEM SER SELECIONADAS NOVAMENTE. ENVIE UM NOVO PEDIDO.
                                    </p>
                                  </div>
                                  
                                  {plan.adminResponse && (
                                    <div className="pt-1.5 border-t border-red-200/50">
                                      <p className="text-[8px] font-black uppercase text-red-500 mb-0.5">Parecer do RH: {plan.processedByQra || ""}</p>
                                      <p className="text-[10px] font-black text-red-900 uppercase leading-relaxed italic">
                                        "{plan.adminResponse}"
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            )}
          </div>
        </TabsContent>

        {isManager && (
          <>
            <TabsContent value="painel-gestao" className="mt-6 space-y-6">
              <Card className="card-shadow border-none rounded-2xl bg-white overflow-hidden animate-in slide-in-from-top-4 duration-500">
                <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "p-3 rounded-2xl border transition-colors",
                      isSolicitationOpen ? "bg-green-50 text-green-600 border-green-100" : "bg-red-50 text-red-600 border-red-100"
                    )}>
                      <Settings2 className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black uppercase text-slate-900 tracking-tight">Controle do Sistema de Férias</h4>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Habilitar ou desabilitar o envio de intenções pelo efetivo.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-slate-50 border border-slate-100">
                    <span className={cn(
                      "text-[10px] font-black uppercase tracking-widest",
                      isSolicitationOpen ? "text-green-700" : "text-red-700"
                    )}>
                      {isSolicitationOpen ? "Período Aberto" : "Período Fechado"}
                    </span>
                    <Switch 
                      checked={isSolicitationOpen} 
                      onCheckedChange={handleToggleSystem}
                      className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-red-500"
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex items-center gap-3">
                  <ShieldCheck className="h-5 w-5 text-blue-600" />
                  <p className="text-[11px] font-black uppercase text-blue-800 tracking-tight">FILA DE HOMOLOGAÇÃO: ANALISE AS INTENÇÕES DO EFETIVO.</p>
                </div>
                
                {loadingAllPlans ? <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : (
                  <div className="grid gap-4">
                    {allPlans.length === 0 ? (
                      <div className="text-center py-20 border-2 border-dashed rounded-3xl uppercase text-[10px] font-bold text-muted-foreground italic tracking-widest">NENHUMA SOLICITAÇÃO PENDENTE.</div>
                    ) : (
                      allPlans.map(plan => {
                        const currentSelections = selectionMap[plan.id] || [];
                        const pattern = plan.splitPattern || (plan.splitVacation ? "15+15" : "30");
                        const requiredCount = (pattern === "10+20" || pattern === "15+15" || pattern === "20+10") ? 2 : 1;
                        const isComplete = currentSelections.length === requiredCount;
                        const isPartialApproval = requiredCount === 2 && currentSelections.length === 1;
                        
                        const parts = pattern.split('+').map(Number);

                        return (
                          <Card key={plan.id} className="card-shadow border-none rounded-xl overflow-hidden">
                            <div className="flex flex-col lg:flex-row">
                              <div className="lg:w-64 bg-slate-50 p-6 border-b lg:border-b-0 lg:border-r space-y-3">
                                <div className="space-y-1">
                                  <p className="text-sm font-black uppercase text-slate-900 leading-tight">{plan.employeeName}</p>
                                  <Badge className="bg-primary text-white font-black text-[9px] h-5">QRA: {plan.employeeQra}</Badge>
                                  <div className="flex flex-col gap-0.5 mt-1">
                                    <p className="text-[10px] font-black uppercase text-slate-600 flex items-center gap-1">
                                      <ShieldCheck className="h-3.5 w-3.5 text-primary/70" /> {plan.employeeEscala}
                                    </p>
                                    <p className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-1">
                                      <Clock className="h-3.5 w-3.5 text-primary/70" /> {plan.employeeTurno}
                                    </p>
                                  </div>
                                </div>

                                <div className="bg-blue-100/50 p-2 rounded-lg border border-blue-200">
                                  <p className="text-[8px] font-black uppercase text-blue-800 leading-none">Modelo Solicitado</p>
                                  <p className="text-[10px] font-black text-blue-900 uppercase mt-1">{pattern} DIAS</p>
                                </div>

                                <div className="flex flex-wrap gap-2 pt-2 border-t">
                                  {plan.hasMinorChildren && (
                                    <Badge className="bg-blue-600 text-white font-black text-[8px] uppercase gap-1 px-2 h-5">
                                      <Baby className="h-2.5 w-2.5" /> Prioridade Escolar
                                    </Badge>
                                  )}
                                  {plan.spouseIsTeacher && (
                                    <Badge className="bg-purple-600 text-white font-black text-[8px] uppercase gap-1 px-2 h-5">
                                      <GraduationCap className="h-2.5 w-2.5" /> Cônjuge Prof.
                                    </Badge>
                                  )}
                                </div>

                                <div className="space-y-1.5 pt-2 border-t">
                                  <div className="flex items-center gap-2">
                                    <Coins className="h-3 w-3 text-amber-500" />
                                    <span className="text-[8px] font-black uppercase text-slate-500">13º Antecipado:</span>
                                    <Badge variant={plan.advance13th ? "default" : "outline"} className={cn("text-[7px] font-black", plan.advance13th ? "bg-amber-50" : "")}>
                                      {plan.advance13th ? "SIM" : "NÃO"}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                              <div className="flex-1 p-6 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  {plan.options.map((opt: any, idx: number) => {
                                    const selectedItem = currentSelections.find(s => s.year === opt.year && s.month === opt.month);
                                    const isSelected = !!selectedItem;
                                    const selectedIdx = currentSelections.indexOf(selectedItem);
                                    const assignedDuration = isSelected ? parts[selectedIdx] : null;
                                    
                                    return (
                                      <div 
                                        key={idx} 
                                        onClick={() => toggleOptionSelection(plan.id, opt, pattern)}
                                        className={cn(
                                          "p-4 rounded-xl border transition-all cursor-pointer space-y-3 flex flex-col items-center text-center group",
                                          isSelected ? "bg-blue-600 border-blue-600 shadow-lg shadow-blue-200" : "bg-white border-slate-100 hover:border-blue-300 shadow-sm"
                                        )}
                                      >
                                        <div className="flex flex-col gap-1 w-full">
                                          <span className={cn("text-[9px] font-black uppercase tracking-widest", isSelected ? "text-white/80" : "text-muted-foreground")}>
                                            {idx + 1}ª OPÇÃO
                                          </span>
                                          <Badge variant="outline" className={cn(
                                            "text-[7px] font-black uppercase border-none px-1.5 mx-auto",
                                            isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                                          )}>
                                            Pref: {opt.startPreference === "16" ? "DIA 16" : "DIA 01"}
                                          </Badge>
                                        </div>
                                        <div className="flex flex-col">
                                          <span className={cn("text-lg font-black uppercase leading-none", isSelected ? "text-white" : "text-primary")}>
                                            {opt.month}
                                          </span>
                                          <span className={cn("text-xs font-bold", isSelected ? "text-white/70" : "text-slate-500")}>
                                            {opt.year}
                                          </span>
                                        </div>
                                        
                                        {isSelected && (
                                          <div className="w-full space-y-2 mt-2 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                                            <div className="space-y-1">
                                              <Label className="text-[8px] font-black uppercase text-white/80">Dia de Início</Label>
                                              <Input 
                                                type="text" 
                                                maxLength={2}
                                                value={selectedItem.startDay}
                                                onChange={(e) => updateOptionDay(plan.id, opt.year, opt.month, e.target.value.replace(/\D/g, ''))}
                                                className="h-8 text-center font-black text-xs bg-white text-blue-700 border-none shadow-inner"
                                              />
                                            </div>
                                            <div className="bg-white/20 p-1.5 rounded-lg">
                                              <p className="text-[9px] font-black text-white uppercase leading-none">{assignedDuration} DIAS</p>
                                              <p className="text-[7px] text-white/70 font-bold uppercase mt-0.5">{calculatePeriod(selectedItem.startDay, opt.month, opt.year, assignedDuration || 30)}</p>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                                <div className="flex flex-col sm:flex-row justify-between items-center pt-4 border-t gap-4">
                                  <Button 
                                    variant="destructive" 
                                    size="sm" 
                                    onClick={() => { setPlanToDenyId(plan.id); setIsDenyModalOpen(true); }}
                                    className="w-full sm:w-auto h-9 px-6 uppercase font-black text-[10px] gap-2 rounded-xl"
                                  >
                                    <XCircle className="h-4 w-4" /> INDEFERIR TODAS AS OPÇÕES
                                  </Button>
                                  <Button 
                                    disabled={!isComplete && !isPartialApproval}
                                    onClick={() => handleProcess(plan, 'approve', currentSelections)}
                                    className={cn(
                                      "w-full sm:w-auto h-11 px-10 uppercase font-black text-[11px] gap-2 rounded-xl transition-all shadow-xl",
                                      (isComplete || isPartialApproval) ? "bg-green-600 hover:bg-green-700 shadow-green-100 text-white" : "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                                    )}
                                  >
                                    <CheckCircle2 className="h-5 w-5" /> 
                                    {isComplete ? `Homologar Modelo ${pattern}` : `Homologar 1ª Parcela (${parts[0]} dias)`}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </Card>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="cronograma" className="mt-6 space-y-6">
              <Card className="card-shadow border-none rounded-2xl overflow-hidden">
                <CardHeader className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-blue-50/30 border-b p-6">
                  <div>
                    <CardTitle className="text-xl font-black uppercase text-slate-900 tracking-tight">Férias Homologadas</CardTitle>
                    <CardDescription className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Cronograma consolidado de afastamentos aprovados pela unidade.</CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input 
                        placeholder="BUSCAR SERVIDOR..." 
                        className="pl-9 h-10 uppercase text-[10px] font-bold bg-white" 
                        value={searchTermApproved}
                        onChange={(e) => setSearchTermApproved(e.target.value.toUpperCase())}
                      />
                    </div>
                    
                    <Select value={cronogramaFilterMonth} onValueChange={setCronogramaFilterMonth}>
                      <SelectTrigger className="h-10 w-[140px] uppercase text-[10px] font-bold bg-white">
                        <SelectValue placeholder="MÊS" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL" className="uppercase text-[10px] font-bold">TODOS MESES</SelectItem>
                        {MONTHS.map(m => (
                          <SelectItem key={m} value={m} className="uppercase text-[10px] font-bold">{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={cronogramaFilterYear} onValueChange={setCronogramaFilterYear}>
                      <SelectTrigger className="h-10 w-[100px] uppercase text-[10px] font-bold bg-white">
                        <SelectValue placeholder="ANO" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL" className="uppercase text-[10px] font-bold">TODOS</SelectItem>
                        {nextYears.map(y => (
                          <SelectItem key={y} value={y.toString()} className="uppercase text-[10px] font-bold">{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {(cronogramaFilterMonth !== "ALL" || cronogramaFilterYear !== "ALL" || searchTermApproved) && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={clearCronogramaFilters}
                        className="h-10 w-10 text-red-600 hover:bg-red-50 hover:text-red-700"
                        title="Limpar Filtros"
                      >
                        <FilterX className="h-4 w-4" />
                      </Button>
                    )}

                    <Button 
                      variant="outline" 
                      onClick={handlePrint}
                      className="h-10 uppercase text-[10px] font-black gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
                    >
                      <Printer className="h-4 w-4" />
                      Imprimir
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {loadingApprovedPlans ? (
                    <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader className="bg-muted/20">
                            <TableRow>
                              <TableHead className="font-bold uppercase text-[10px] h-12">Servidor / QRA</TableHead>
                              <TableHead className="font-bold uppercase text-[10px] h-12">Operacional</TableHead>
                              <TableHead className="font-bold uppercase text-[10px] h-12">Período(s) Aprovado(s)</TableHead>
                              <TableHead className="font-bold uppercase text-[10px] h-12">Prioridades</TableHead>
                              <TableHead className="font-bold uppercase text-[10px] h-12">Auditor RH</TableHead>
                              <TableHead className="font-bold uppercase text-[10px] h-12 text-center">Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paginatedApprovedPlans.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={6} className="h-40 text-center uppercase text-[10px] font-bold text-muted-foreground italic tracking-widest">
                                  NENHUM REGISTRO ENCONTRADO PARA OS FILTROS APLICADOS.
                                </TableCell>
                              </TableRow>
                            ) : (
                              paginatedApprovedPlans.map((plan) => (
                                <TableRow key={plan.id} className="hover:bg-slate-50 transition-colors border-b last:border-0 group">
                                  <TableCell className="py-4">
                                    <div className="flex flex-col gap-0.5">
                                      <span className="font-black uppercase text-[13px] text-slate-900 leading-tight">{plan.employeeName}</span>
                                      <span className="text-[10px] font-bold text-primary uppercase tracking-tighter">QRA: {plan.employeeQra}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-col">
                                      <span className="text-[11px] font-black uppercase text-slate-700">{plan.employeeEscala}</span>
                                      <span className="text-[9px] font-bold text-muted-foreground uppercase">{plan.employeeTurno}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-wrap gap-2">
                                      {(plan.selectedOptions || []).map((opt: any, idx: number) => {
                                        const isMatch = (cronogramaFilterMonth === "ALL" || opt.month === cronogramaFilterMonth) && 
                                                        (cronogramaFilterYear === "ALL" || opt.year === cronogramaFilterYear);
                                        
                                        return (
                                          <Badge 
                                            key={idx} 
                                            className={cn(
                                              "font-black text-[9px] uppercase px-3",
                                              isMatch ? "bg-green-600 text-white" : "bg-slate-200 text-slate-500 opacity-50"
                                            )}
                                          >
                                            {opt.startDay ? `${opt.startDay} ` : ""}{opt.month} / {opt.year} - {opt.duration} DIAS
                                          </Badge>
                                        );
                                      })}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                      {plan.hasMinorChildren && (
                                        <Badge variant="outline" className="text-[8px] font-black uppercase border-blue-200 text-blue-600 bg-blue-50">ESCOLAR</Badge>
                                      )}
                                      {plan.spouseIsTeacher && (
                                        <Badge variant="outline" className="text-[8px] font-black uppercase border-purple-200 text-purple-600 bg-purple-50">PROFESSOR</Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1.5">
                                      <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                                      <span className="text-[10px] font-black uppercase text-slate-600">{plan.processedByQra || "SISTEMA"}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <div className="flex items-center justify-center gap-2">
                                      <div className="flex items-center gap-2 mr-2 border-r pr-2 border-slate-200">
                                        <Coins className={cn("h-3.5 w-3.5", plan.advance13th ? "text-amber-500" : "text-slate-300")} title="13º Antecipado" />
                                        <Scissors className={cn("h-3.5 w-3.5", plan.splitVacation ? "text-blue-500" : "text-slate-300")} title="Dividido" />
                                      </div>
                                      {isHighCommand && (
                                        <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          onClick={() => handleOpenEditModal(plan)}
                                          className="h-8 w-8 text-blue-600 hover:bg-blue-50 rounded-lg"
                                        >
                                          <Edit2 className="h-3.5 w-3.5" />
                                        </Button>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                      
                      {totalPages > 1 && (
                        <div className="p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted/5 pagination-controls">
                          <p className="text-[10px] font-bold uppercase text-muted-foreground">
                            Exibindo {paginatedApprovedPlans.length} de {filteredApprovedPlans.length} registros (Página {currentPage} de {totalPages})
                          </p>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={currentPage === 1}
                              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                              className="h-8 px-3 text-[10px] font-black uppercase gap-1.5"
                            >
                              <ChevronLeft className="h-3.5 w-3.5" /> Anterior
                            </Button>
                            
                            <div className="flex items-center gap-1">
                              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                let pageNum = i + 1;
                                if (totalPages > 5 && currentPage > 3) {
                                  pageNum = Math.min(currentPage - 2 + i, totalPages - 4 + i);
                                }
                                if (pageNum > totalPages || pageNum <= 0) return null;

                                return (
                                  <Button
                                    key={pageNum}
                                    variant={currentPage === pageNum ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setCurrentPage(pageNum)}
                                    className={cn(
                                      "h-8 w-8 p-0 text-[10px] font-bold",
                                      currentPage === pageNum ? "bg-primary text-white" : ""
                                    )}
                                  >
                                    {pageNum}
                                  </Button>
                                );
                              })}
                            </div>

                            <Button
                              variant="outline"
                              size="sm"
                              disabled={currentPage === totalPages}
                              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                              className="h-8 px-3 text-[10px] font-black uppercase gap-1.5"
                            >
                              Próximo <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  )
}
