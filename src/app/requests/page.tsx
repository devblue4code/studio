"use client"

import * as React from "react"
import { 
  Clock, 
  CheckCircle2, 
  Loader2,
  Send,
  Trash2,
  ShieldCheck,
  Check,
  ChevronRight,
  CalendarDays,
  FileText,
  MessageSquare,
  User,
  Plus,
  AlertCircle,
  Stethoscope,
  Archive,
  Search,
  X,
  Fingerprint,
  ChevronLeft
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useFirestore, useCollection, useAuth } from '@/firebase';
import { collection, addDoc, query, orderBy, where, serverTimestamp, updateDoc, doc, getDoc } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils"

const ITEMS_PER_PAGE = 30;

const hhmmToMinutes = (hhmm: string) => {
  if (!hhmm || !hhmm.includes(':')) return 0;
  const [h, m] = hhmm.split(':').map(Number);
  return (h * 60) + (m || 0);
};

const minutesToHHmm = (totalMinutes: number) => {
  const isNegative = totalMinutes < 0;
  const absMinutes = Math.abs(totalMinutes);
  const h = Math.floor(absMinutes / 60);
  const m = absMinutes % 60;
  return `${isNegative ? '-' : ''}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const normalizeStr = (str: string) => str?.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || "";
const formatDateBR = (dateStr: string) => dateStr ? dateStr.split('-').reverse().join('/') : "";

export default function RequestsPage() {
  const firestore = useFirestore();
  const { user, employeeData, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("new");
  const [archiveSearch, setArchiveSearch] = React.useState("");
  const [archiveCurrentPage, setArchiveCurrentPage] = React.useState(1);
  
  const [requestType, setRequestType] = React.useState<string>("");
  const [multiDates, setMultiDates] = React.useState<string[]>([""]);
  
  const [currentVacationStart, setCurrentVacationStart] = React.useState("");
  const [currentVacationEnd, setCurrentVacationEnd] = React.useState("");
  const [newVacationStart, setNewVacationStart] = React.useState("");
  const [newVacationEnd, setNewVacationEnd] = React.useState("");
  
  const [birthdayDate, setBirthdayDate] = React.useState("");
  const [abonoDate, setAbonoDate] = React.useState("");
  
  const [swapFromDate, setSwapFromDate] = React.useState("");
  const [swapToDate, setSwapToDate] = React.useState("");
  
  const [permutaMyOriginalDate, setPermutaMyOriginalDate] = React.useState("");
  const [permutaMyNewDate, setPermutaMyNewDate] = React.useState("");
  const [permutaPartnerId, setPermutaPartnerId] = React.useState("");
  const [permutaPartnerTerm, setPermutaPartnerTerm] = React.useState("");
  const [permutaPartnerShow, setPermutaPartnerShow] = React.useState(false);
  const [permutaPartnerData, setPermutaPartnerData] = React.useState<any>(null);

  const [atestadoConsultaDate, setAtestadoConsultaDate] = React.useState("");
  const [atestadoCid, setAtestadoCid] = React.useState("");
  const [atestadoQtdDias, setAtestadoQtdDias] = React.useState<number | "">("");
  const [atestadoEndDate, setAtestadoEndDate] = React.useState("");

  const [chefiaRows, setChefiaRows] = React.useState([{ id: "", uid: "", term: "", show: false }]);
  const [adminResponseDraft, setAdminResponseDraft] = React.useState<{ [key: string]: string }>({});

  React.useEffect(() => {
    if (requestType === "PERMUTA") {
      if (chefiaRows.length < 2) {
        setChefiaRows([
          { id: "c1", uid: "", term: "", show: false },
          { id: "c2", uid: "", term: "", show: false }
        ]);
      }
    }
  }, [requestType]);

  React.useEffect(() => {
    if (atestadoConsultaDate && typeof atestadoQtdDias === 'number' && atestadoQtdDias > 0) {
      const start = new Date(atestadoConsultaDate + "T00:00:00");
      const end = new Date(start);
      end.setDate(start.getDate() + (atestadoQtdDias - 1));
      setAtestadoEndDate(end.toISOString().split('T')[0]);
    } else {
      setAtestadoEndDate("");
    }
  }, [atestadoConsultaDate, atestadoQtdDias]);

  const canAccessArchive = React.useMemo(() => {
    if (!employeeData) return false;
    const role = normalizeStr(employeeData.role || "");
    return ["COMANDANTE", "INSPETOR GERAL", "GESTOR DE RH"].some(r => role.includes(r));
  }, [employeeData]);

  const requestsQuery = React.useMemo(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'requests'), where('employeeId', '==', user.uid), orderBy('createdAt', 'desc'));
  }, [firestore, user]);

  const managementQuery = React.useMemo(() => {
    if (!firestore || !user || !employeeData) return null;
    return query(collection(firestore, 'requests'), where('status', 'in', ['Pendente', 'Aguardando Parceiro', 'Aprovado pela Chefia']));
  }, [firestore, user, employeeData]);

  const archiveRequestsQuery = React.useMemo(() => {
    if (!firestore || !canAccessArchive) return null;
    return query(collection(firestore, 'requests'), where('status', 'in', ['Aprovado', 'Negado']), orderBy('updatedAt', 'desc'));
  }, [firestore, canAccessArchive]);

  const allEmployeesRef = React.useMemo(() => firestore ? collection(firestore, 'employees') : null, [firestore]);
  const myLaunchesRef = React.useMemo(() => (firestore && employeeData?.id) ? query(collection(firestore, 'launches'), where('employeeId', '==', employeeData.id)) : null, [firestore, employeeData?.id]);
  const shiftPeriodsRef = React.useMemo(() => firestore ? query(collection(firestore, 'shiftPeriods'), orderBy('escalaName', 'asc')) : null, [firestore]);

  const { data: myRequests, loading: loadingRequests } = useCollection(requestsQuery);
  const { data: managementRequests, loading: loadingManagement } = useCollection(managementQuery);
  const { data: archiveRequests, loading: loadingArchive } = useCollection(archiveRequestsQuery);
  const { data: allEmployees } = useCollection(allEmployeesRef);
  const { data: myLaunches } = useCollection(myLaunchesRef);
  const { data: shiftPeriods } = useCollection(shiftPeriodsRef);

  const filteredArchiveRequests = React.useMemo(() => {
    if (!archiveRequests) return [];
    const term = archiveSearch.toLowerCase();
    return archiveRequests.filter(req => 
      req.employeeName?.toLowerCase().includes(term) ||
      req.employeeQra?.toLowerCase().includes(term) ||
      req.type?.toLowerCase().includes(term)
    );
  }, [archiveRequests, archiveSearch]);

  React.useEffect(() => {
    setArchiveCurrentPage(1);
  }, [archiveSearch]);

  const paginatedArchiveRequests = React.useMemo(() => {
    const startIndex = (archiveCurrentPage - 1) * ITEMS_PER_PAGE;
    return filteredArchiveRequests.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredArchiveRequests, archiveCurrentPage]);

  const totalArchivePages = Math.ceil(filteredArchiveRequests.length / ITEMS_PER_PAGE);

  const myShiftPeriod = React.useMemo(() => (employeeData?.escala && shiftPeriods) ? shiftPeriods.find(p => p.escalaName === employeeData.escala) : null, [employeeData?.escala, shiftPeriods]);
  const requiredMinutesForFolga = React.useMemo(() => myShiftPeriod?.duration ? hhmmToMinutes(myShiftPeriod.duration) : 0, [myShiftPeriod]);

  React.useEffect(() => {
    if (requestType === "ABONO DE ANIVERSÁRIO" && employeeData?.birthDate) {
      const parts = employeeData.birthDate.split('-');
      if (parts.length === 3) {
        const [, month, day] = parts;
        const currentYear = new Date().getFullYear();
        setBirthdayDate(`${currentYear}-${month}-${day}`);
      }
    }
  }, [requestType, employeeData?.birthDate]);

  const reservedMinutes = React.useMemo(() => {
    if (!myRequests || !requiredMinutesForFolga) return 0;
    return myRequests.filter(req => req.status === "Pendente" && req.type === "FOLGA").reduce((acc, req) => acc + (req.date ? req.date.split(',').length * requiredMinutesForFolga : 0), 0);
  }, [myRequests, requiredMinutesForFolga]);

  const myBalanceMinutes = React.useMemo(() => {
    if (!myLaunches) return 0;
    const base = myLaunches.reduce((acc, l) => {
      const type = normalizeStr(l.type || "");
      const min = hhmmToMinutes(l.hours || "00:00");
      if (type === "BANCO DE HORAS CREDITO") return acc + min;
      if (type === "BANCO DE HORAS DEBITO" || type === "FOLGA") return acc - min;
      return acc;
    }, 0);
    return base - reservedMinutes;
  }, [myLaunches, reservedMinutes]);

  const simulatedRemainingMinutes = React.useMemo(() => {
    if (requestType !== "FOLGA") return myBalanceMinutes;
    return myBalanceMinutes - (multiDates.filter(d => d).length * requiredMinutesForFolga);
  }, [requestType, myBalanceMinutes, multiDates, requiredMinutesForFolga]);

  const reservedTreDays = React.useMemo(() => {
    if (!myRequests) return 0;
    return myRequests.filter(req => req.status === "Pendente" && req.type === "ABONO TRE").reduce((acc, req) => acc + (req.date ? req.date.split(',').length : 0), 0);
  }, [myRequests]);

  const myBalanceTreDays = React.useMemo(() => {
    if (!myLaunches) return 0;
    const base = myLaunches.reduce((acc, l) => {
      const type = normalizeStr(l.type || "");
      const days = Number(l.days) || 0;
      if (type === "TRE CREDITO") return acc + days;
      if (type === "TRE DEBITO") return acc - days;
      return acc;
    }, 0);
    return base - reservedTreDays;
  }, [myLaunches, reservedTreDays]);

  const simulatedRemainingTreDays = React.useMemo(() => {
    if (requestType !== "ABONO TRE") return myBalanceTreDays;
    return myBalanceTreDays - multiDates.filter(d => d).length;
  }, [requestType, myBalanceTreDays, multiDates]);

  const hasInvalidPermutaMonth = React.useMemo(() => {
    if (requestType === "PERMUTA" && permutaMyOriginalDate && permutaMyNewDate) {
      return permutaMyOriginalDate.substring(0, 7) !== permutaMyNewDate.substring(0, 7);
    }
    return false;
  }, [requestType, permutaMyOriginalDate, permutaMyNewDate]);

  const hasInsufficientBalance = requestType === "FOLGA" && simulatedRemainingMinutes < 0;
  const hasInsufficientTreBalance = requestType === "ABONO TRE" && simulatedRemainingTreDays < 0;
  
  const hasInvalidAbonoDate = React.useMemo(() => {
    if (requestType !== "ABONO DE ANIVERSÁRIO" || !birthdayDate || !abonoDate) return false;
    const b = new Date(birthdayDate + "T00:00:00");
    const a = new Date(abonoDate + "T00:00:00");
    const l = new Date(b);
    l.setDate(b.getDate() + 30);
    return a < b || a > l;
  }, [requestType, birthdayDate, abonoDate]);

  const isManagement = React.useMemo(() => {
    if (!employeeData) return false;
    const role = normalizeStr(employeeData.role || "");
    return ["INSPETOR GERAL", "INSPETOR", "SUBINSPETOR", "GESTOR DE RH"].includes(role);
  }, [employeeData]);

  const filteredManagementRequests = React.useMemo(() => {
    if (!managementRequests || !user || !employeeData) return [];
    const role = normalizeStr(employeeData.role || "");
    const isRH = role.includes("GESTOR DE RH");
    
    return managementRequests.filter(req => {
      if (req.status === "Aguardando Parceiro") {
        return req.partnerId === user.uid;
      }
      if (req.status === "Pendente") {
        if (req.type === "PERMUTA") {
          const isTargetChefia = req.chefiaIds?.includes(user.uid);
          const alreadyApproved = req.approvedChefiaIds?.includes(user.uid);
          return isTargetChefia && !alreadyApproved;
        }
        return req.chefiaIds?.includes(user.uid);
      }
      if (req.status === "Aprovado pela Chefia") {
        return isRH;
      }
      return false;
    });
  }, [managementRequests, user, employeeData]);

  const historyBadgeCount = React.useMemo(() => 
    myRequests?.filter(req => req.status === "Pendente" || req.status === "Em Revisão" || req.status === "Aguardando Parceiro").length || 0
  , [myRequests]);

  const managementBadgeCount = React.useMemo(() => 
    filteredManagementRequests.length
  , [filteredManagementRequests]);

  const resetForm = () => {
    setRequestType("");
    setMultiDates([""]);
    setCurrentVacationStart("");
    setCurrentVacationEnd("");
    setNewVacationStart("");
    setNewVacationEnd("");
    setBirthdayDate("");
    setAbonoDate("");
    setSwapFromDate("");
    setSwapToDate("");
    setPermutaMyOriginalDate("");
    setPermutaMyNewDate("");
    setPermutaPartnerId("");
    setPermutaPartnerTerm("");
    setPermutaPartnerData(null);
    setAtestadoConsultaDate("");
    setAtestadoCid("");
    setAtestadoQtdDias("");
    setAtestadoEndDate("");
    setChefiaRows([{ id: Math.random().toString(), uid: "", term: "", show: false }]);
  };

  const addChefiaRow = () => setChefiaRows([...chefiaRows, { id: Math.random().toString(), uid: "", term: "", show: false }]);
  const removeChefiaRow = (index: number) => {
    if (requestType === "PERMUTA" && chefiaRows.length <= 2) {
      toast({ variant: "destructive", title: "OBRIGATÓRIO", description: "A PERMUTA EXIGE DUAS CHEFIAS." });
      return;
    }
    const newRows = chefiaRows.filter((_, i) => i !== index);
    setChefiaRows(newRows.length ? newRows : [{ id: Math.random().toString(), uid: "", term: "", show: false }]);
  };
  const updateChefiaRow = (index: number, updates: Partial<{id: string, uid: string, term: string, show: boolean}>) => {
    setChefiaRows(prev => {
      const newRows = [...prev];
      newRows[index] = { ...newRows[index], ...updates };
      return newRows;
    });
  };

  async function handleSendRequest(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!firestore || !user) return;

    const selectedChefias = chefiaRows.filter(r => r.uid);
    if (requestType === "PERMUTA" && selectedChefias.length < 2) {
      toast({ variant: "destructive", title: "ATENÇÃO", description: "SELECIONE AS DUAS CHEFIAS (SOLICITANTE E PARCEIRO)." });
      return;
    }

    if (selectedChefias.length === 0) {
      toast({ variant: "destructive", title: "ATENÇÃO", description: "SELECIONE AO MENOS UMA CHEFIA." });
      return;
    }

    const uids = selectedChefias.map(c => c.uid);
    const hasDuplicateChefia = new Set(uids).size !== uids.length;
    if (hasDuplicateChefia) {
      toast({ variant: "destructive", title: "CHEFIA DUPLICADA", description: "SELECIONE CHEFIAS DIFERENTES PARA CADA UNIDADE." });
      return;
    }

    if (hasInvalidPermutaMonth) {
      toast({ variant: "destructive", title: "ATENÇÃO", description: "A PERMUTA DEVE SER NO MESMO MÊS." });
      return;
    }

    if (requestType === "PERMUTA" && !permutaPartnerId) {
      toast({ variant: "destructive", title: "ERRO", description: "SELECIONE O PARCEIRO DA PERMUTA." });
      return;
    }

    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const description = (formData.get('description') as string || "").toUpperCase();
    
    let finalDate = "";
    if (["FOLGA", "ABONO TRE", "ESCALA ESPECIAL"].includes(requestType)) {
      finalDate = multiDates.filter(d => d).map(d => formatDateBR(d)).join(", ");
    } else if (requestType === "REPROGRAMAÇÃO DE FÉRIAS") {
      finalDate = `AGENDADO: ${formatDateBR(currentVacationStart)} À ${formatDateBR(currentVacationEnd)} | NOVO: ${formatDateBR(newVacationStart)} À ${formatDateBR(newVacationEnd)}`;
    } else if (requestType === "ABONO DE ANIVERSÁRIO") {
      finalDate = `ANIV: ${formatDateBR(birthdayDate)} | FOLGA: ${formatDateBR(abonoDate)}`;
    } else if (requestType === "TROCA DE ESCALA") {
      finalDate = `DE: ${formatDateBR(swapFromDate)} | PARA: ${formatDateBR(swapToDate)}`;
    } else if (requestType === "PERMUTA") {
      finalDate = `EU: ${formatDateBR(permutaMyOriginalDate)}->${formatDateBR(permutaMyNewDate)} | PERMUTA COM ${permutaPartnerData?.name || "N/A"}: ${formatDateBR(permutaMyNewDate)}->${formatDateBR(permutaMyOriginalDate)}`;
    } else if (requestType === "ATESTADO MÉDICO") {
      finalDate = `CONSULTA: ${formatDateBR(atestadoConsultaDate)} - ${atestadoQtdDias} DIAS | PERÍODO: ${formatDateBR(atestadoConsultaDate)} À ${formatDateBR(atestadoEndDate)} | CID: ${atestadoCid || 'N/I'}`;
    } else {
      finalDate = formatDateBR(formData.get('date') as string || "");
    }

    const newRequest = {
      employeeId: user.uid,
      employeeName: (employeeData?.name || "USUÁRIO").toUpperCase(),
      employeeQra: (employeeData?.qra || "N/A").toUpperCase(),
      matricula: (employeeData?.matricula || "N/A").toUpperCase(),
      escala: (employeeData?.escala || "N/A").toUpperCase(),
      turno: (employeeData?.turno || "N/A").toUpperCase(),
      type: requestType,
      date: finalDate,
      description: description,
      status: requestType === "PERMUTA" ? "Aguardando Parceiro" : "Pendente",
      partnerId: requestType === "PERMUTA" ? permutaPartnerId : null,
      partnerName: requestType === "PERMUTA" ? (permutaPartnerData?.name || null) : null,
      chefiaImediata: selectedChefias.map(c => c.term).join(" / "),
      chefiaIds: selectedChefias.map(c => c.uid),
      approvedChefiaIds: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      await addDoc(collection(firestore, 'requests'), newRequest);
      toast({ title: "SOLICITAÇÃO ENVIADA!" });
      setActiveTab("history");
      resetForm();
    } catch (err) {
      toast({ variant: "destructive", title: "ERRO AO ENVIAR" });
    } finally {
      setLoading(false);
    }
  }

  async function handleProcessRequest(request: any, action: 'approve' | 'deny') {
    if (!firestore || !user) return;

    if (action === 'deny' && !adminResponseDraft[request.id]?.trim()) {
      toast({ variant: "destructive", title: "JUSTIFICATIVA OBRIGATÓRIA", description: "INFORME O MOTIVO DO INDEFERIMENTO." });
      return;
    }
    
    let nextStatus = "";
    let actorPrefix = "";
    let newApprovedList = request.approvedChefiaIds || [];
    const userQra = (employeeData?.qra || "SISTEMA").toLowerCase();
    
    if (request.status === "Aguardando Parceiro") actorPrefix = `PARCEIRO (${userQra})`;
    else if (request.status === "Pendente") actorPrefix = `CHEFIA (${userQra})`;
    else if (request.status === "Aprovado pela Chefia") actorPrefix = `RH (${userQra})`;

    if (action === 'deny') nextStatus = "Negado";
    else {
      if (request.status === "Aguardando Parceiro") nextStatus = "Pendente";
      else if (request.status === "Pendente") {
        if (request.type === "PERMUTA") {
          if (!newApprovedList.includes(user.uid)) newApprovedList.push(user.uid);
          if (newApprovedList.length >= (request.chefiaIds?.length || 2)) nextStatus = "Aprovado pela Chefia";
          else nextStatus = "Pendente";
        } else nextStatus = "Aprovado pela Chefia";
      } else if (request.status === "Aprovado pela Chefia") nextStatus = "Aprovado";
    }
    
    if (!nextStatus) return;

    try {
      const docRef = doc(firestore, 'requests', request.id);
      const docSnap = await getDoc(docRef);
      const currentData = docSnap.exists() ? docSnap.data() : request;
      
      const today = new Date();
      const formattedDate = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }).format(today);

      const currentResponse = currentData.adminResponse || "";
      const rawNewResponse = adminResponseDraft[request.id] || "CIENTE/DE ACORDO";
      const formattedNewResponse = `${formattedDate} - ${actorPrefix}: ${rawNewResponse.toUpperCase().trim()}`;
      
      const finalResponse = currentResponse ? `${currentResponse} | ${formattedNewResponse}` : formattedNewResponse;

      const updates: any = { status: nextStatus, adminResponse: finalResponse, updatedAt: serverTimestamp() };
      if (request.type === "PERMUTA") updates.approvedChefiaIds = newApprovedList;

      await updateDoc(docRef, updates);
      setAdminResponseDraft(prev => { const next = { ...prev }; delete next[request.id]; return next; });
      toast({ title: "SOLICITAÇÃO PROCESSSADA" });
    } catch (err) {
      toast({ variant: "destructive", title: "ERRO AO PROCESSSAR" });
    }
  }

  if (authLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-bold tracking-tight uppercase text-primary">REQUERIMENTOS</h2>
        <p className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest">CENTRAL DE SOLICITAÇÕES OPERACIONAIS GMVV.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={cn(
          "grid w-full bg-muted/50 p-1 rounded-xl h-auto",
          canAccessArchive ? "grid-cols-4 lg:w-[850px]" : isManagement ? "grid-cols-3 lg:w-[650px]" : "grid-cols-2 lg:w-[450px]"
        )}>
          <TabsTrigger value="new" className="rounded-lg uppercase text-[10px] font-bold py-2">NOVA SOLICITAÇÃO</TabsTrigger>
          <TabsTrigger value="history" className="rounded-lg uppercase text-[10px] font-bold flex items-center justify-center gap-2 py-2">
            HISTÓRICO
            {historyBadgeCount > 0 && <Badge variant="secondary" className="h-4 w-4 p-0 flex items-center justify-center text-[8px] bg-blue-600 text-white border-none rounded-full">{historyBadgeCount}</Badge>}
          </TabsTrigger>
          {(isManagement || filteredManagementRequests.length > 0) && (
            <TabsTrigger value="management" className="rounded-lg uppercase text-[10px] font-bold text-primary flex items-center justify-center gap-2 py-2">
              GESTÃO
              {managementBadgeCount > 0 && <Badge className="h-4 w-4 p-0 flex items-center justify-center text-[8px] bg-primary text-primary-foreground border-none rounded-full">{managementBadgeCount}</Badge>}
            </TabsTrigger>
          )}
          {canAccessArchive && (
            <TabsTrigger value="archive" className="rounded-lg uppercase text-[10px] font-bold text-blue-600 flex items-center justify-center gap-2 py-2">
              <Archive className="h-3.5 w-3.5" /> ARQUIVO
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="new" className="mt-6">
           <Card className="card-shadow border-none rounded-2xl overflow-hidden">
            <form onSubmit={handleSendRequest}>
              <CardHeader className="bg-primary/5 border-b py-3 px-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                   <div className="flex items-center gap-3">
                    <div className="bg-white p-2 rounded-xl border shadow-sm shrink-0"><User className="h-6 w-6 text-primary" /></div>
                    <div>
                      <span className="text-2xl sm:text-3xl font-black uppercase text-slate-900 tracking-tighter block leading-none">{employeeData?.name} ({employeeData?.qra})</span>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Identificação Funcional NRH</p>
                    </div>
                   </div>
                   <div className="bg-white/50 px-4 py-1.5 rounded-xl border border-primary/10 flex items-center gap-3">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <div className="text-right">
                      <span className="text-base sm:text-lg font-black uppercase text-primary tracking-tight leading-none block">{employeeData?.escala}</span>
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{employeeData?.turno}</span>
                    </div>
                   </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 pt-5 px-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="grid gap-1.5">
                    <Label className="text-[9px] font-bold uppercase text-muted-foreground tracking-tight">Tipo de Solicitação</Label>
                    <Select value={requestType} onValueChange={setRequestType} required>
                      <SelectTrigger className="h-10 uppercase text-[10px] font-bold"><SelectValue placeholder="SELECIONE..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FOLGA" className="uppercase text-[10px]">FOLGA (BANCO DE HORAS)</SelectItem>
                        <SelectItem value="ABONO DE ANIVERSÁRIO" className="uppercase text-[10px]">ABONO DE ANIVERSÁRIO</SelectItem>
                        <SelectItem value="ABONO TRE" className="uppercase text-[10px]">ABONO TRE</SelectItem>
                        <SelectItem value="ATESTADO MÉDICO" className="uppercase text-[10px]">ATESTADO MÉDICO</SelectItem>
                        <SelectItem value="REPROGRAMAÇÃO DE FÉRIAS" className="uppercase text-[10px]">REPROGRAMAÇÃO DE FÉRIAS</SelectItem>
                        <SelectItem value="ESCALA ESPECIAL" className="uppercase text-[10px]">ESCALA ESPECIAL</SelectItem>
                        <SelectItem value="TROCA DE ESCALA" className="uppercase text-[10px]">TROCA DE ESCALA</SelectItem>
                        <SelectItem value="PERMUTA" className="uppercase text-[10px]">PERMUTA</SelectItem>
                        <SelectItem value="OUTROS" className="uppercase text-[10px]">OUTROS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {requestType === "FOLGA" && (
                    <div className="grid gap-1.5 animate-in fade-in duration-300">
                      <Label className="text-[9px] font-bold uppercase text-muted-foreground tracking-tight">Saldo Banco de Horas</Label>
                      <div className={cn("h-10 flex items-center px-4 rounded-lg border font-black text-[10px] uppercase", hasInsufficientBalance ? "bg-red-50 border-red-200 text-red-700" : "bg-green-50 border-green-200 text-green-700")}>{minutesToHHmm(myBalanceMinutes)}H DISPONÍVEIS</div>
                    </div>
                  )}
                  {requestType === "ABONO TRE" && (
                    <div className="grid gap-1.5 animate-in fade-in duration-300">
                      <Label className="text-[9px] font-bold uppercase text-muted-foreground tracking-tight">Saldo TRE</Label>
                      <div className={cn("h-10 flex items-center px-4 rounded-lg border font-black text-[10px] uppercase", hasInsufficientTreBalance ? "bg-red-50 border-red-200 text-red-700" : "bg-green-50 border-green-200 text-green-700")}>{myBalanceTreDays} DIAS DISPONÍVEIS</div>
                    </div>
                  )}
                </div>
                {requestType === "ATESTADO MÉDICO" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3 bg-slate-50 border rounded-xl animate-in slide-in-from-top-2 duration-300">
                    <div className="grid gap-1"><Label className="text-[9px] font-bold uppercase text-muted-foreground flex items-center gap-1.5"><CalendarDays className="h-3 w-3" /> Data da Consulta</Label><Input type="date" value={atestadoConsultaDate} onChange={(e) => setAtestadoConsultaDate(e.target.value)} required className="h-9 text-[10px] font-bold bg-white" /></div>
                    <div className="grid gap-1"><Label className="text-[9px] font-bold uppercase text-muted-foreground flex items-center gap-1.5"><Stethoscope className="h-3 w-3" /> CID (Opcional)</Label><Input placeholder="EX: Z00" value={atestadoCid} onChange={(e) => setAtestadoCid(e.target.value.toUpperCase())} className="h-9 text-[10px] font-bold bg-white uppercase" /></div>
                    <div className="grid gap-1"><Label className="text-[9px] font-bold uppercase text-muted-foreground">Qtd. Dias</Label><Input type="number" min="1" value={atestadoQtdDias} onChange={(e) => setAtestadoQtdDias(e.target.value === "" ? "" : Number(e.target.value))} required className="h-9 text-[10px] font-bold bg-white" /></div>
                    <div className="grid gap-1"><Label className="text-[9px] font-bold uppercase text-muted-foreground">Data Final</Label><Input type="date" value={atestadoEndDate} readOnly className="h-9 text-[10px] font-bold bg-muted/30 cursor-not-allowed" /></div>
                  </div>
                )}
                {requestType === "REPROGRAMAÇÃO DE FÉRIAS" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 border rounded-xl animate-in slide-in-from-top-2 duration-300">
                    <div className="space-y-2"><p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest border-b pb-1">Agendamento Atual</p><div className="grid grid-cols-2 gap-2"><div className="grid gap-1"><Label className="text-[8px] font-bold uppercase text-muted-foreground">Início</Label><Input type="date" value={currentVacationStart} onChange={(e) => setCurrentVacationStart(e.target.value)} required className="h-9 text-[10px] font-bold bg-white" /></div><div className="grid gap-1"><Label className="text-[8px] font-bold uppercase text-muted-foreground">Fim</Label><Input type="date" value={currentVacationEnd} onChange={(e) => setCurrentVacationEnd(e.target.value)} required className="h-9 text-[10px] font-bold bg-white" /></div></div></div>
                    <div className="space-y-2"><p className="text-[8px] font-black uppercase text-blue-600 tracking-widest border-b border-blue-100 pb-1">Novo Período</p><div className="grid grid-cols-2 gap-2"><div className="grid gap-1"><Label className="text-[8px] font-bold uppercase text-muted-foreground">Início</Label><Input type="date" value={newVacationStart} onChange={(e) => setNewVacationStart(e.target.value)} required className="h-9 text-[10px] font-bold bg-white border-blue-200" /></div><div className="grid gap-1"><Label className="text-[8px] font-bold uppercase text-muted-foreground">Fim</Label><Input type="date" value={newVacationEnd} onChange={(e) => setNewVacationEnd(e.target.value)} required className="h-9 text-[10px] font-bold bg-white border-blue-200" /></div></div></div>
                  </div>
                )}
                {requestType === "ABONO DE ANIVERSÁRIO" && (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border rounded-xl animate-in slide-in-from-top-2 duration-300">
                    <div className="grid gap-1"><Label className="text-[9px] font-bold uppercase text-muted-foreground">Data Aniversário</Label><Input type="date" value={birthdayDate} onChange={(e) => setBirthdayDate(e.target.value)} required className="h-9 text-[10px] font-bold bg-white" /></div>
                    <div className="grid gap-1 relative"><Label className="text-[9px] font-bold uppercase text-muted-foreground">Data da Folga</Label><Input type="date" value={abonoDate} onChange={(e) => setAbonoDate(e.target.value)} required className="h-9 text-[10px] font-bold bg-white" />{birthdayDate && abonoDate && hasInvalidAbonoDate && <p className="text-[8px] text-destructive font-black uppercase absolute mt-9 whitespace-nowrap">{abonoDate < birthdayDate ? "A folga deve ser após o aniversário." : "LIMITE DE 30 DIAS EXCEDIDO."}</p>}</div>
                  </div>
                )}
                {requestType === "PERMUTA" && (
                  <div className="space-y-4 p-4 bg-slate-50 border rounded-xl animate-in slide-in-from-top-2 duration-300">
                    <div className="space-y-2"><Label className="text-[9px] font-black uppercase text-blue-800 tracking-widest block border-b pb-1">Minha Escala</Label><div className="grid grid-cols-2 gap-3"><div className="grid gap-1"><Label className="text-[8px] font-bold uppercase text-muted-foreground">De (Data Original)</Label><Input type="date" value={permutaMyOriginalDate} onChange={(e) => setPermutaMyOriginalDate(e.target.value)} required className="h-9 text-[10px] font-bold bg-white border-blue-200" /></div><div className="grid gap-1"><Label className="text-[8px] font-bold uppercase text-muted-foreground">Para (Nova Data)</Label><Input type="date" value={permutaMyNewDate} onChange={(e) => setPermutaMyNewDate(e.target.value)} required className="h-9 text-[10px] font-bold bg-white border-blue-200" /></div></div></div>
                    <div className="grid gap-1.5 relative"><Label className="text-[9px] font-black uppercase text-slate-800 tracking-widest block border-b pb-1">Parceiro da Troca</Label><div className="relative mt-1"><Input placeholder="BUSCAR NOME OU QRA..." value={permutaPartnerTerm} onChange={(e) => { setPermutaPartnerTerm(e.target.value.toUpperCase()); setPermutaPartnerShow(true); setPermutaPartnerId(""); setPermutaPartnerData(null); }} onFocus={() => setPermutaPartnerShow(true)} className="h-9 border-muted uppercase text-[10px] font-bold bg-white pr-8" />{permutaPartnerId && <Check className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-green-600" />}{permutaPartnerShow && permutaPartnerTerm && <div className="absolute z-[65] left-0 right-0 top-full mt-1 bg-background border rounded-lg shadow-2xl max-h-40 overflow-y-auto">{allEmployees?.filter(e => e.uid !== user?.uid && (normalizeStr(e.name).includes(permutaPartnerTerm) || normalizeStr(e.qra).includes(permutaPartnerTerm))).map(c => (<button key={c.id} type="button" onMouseDown={() => { setPermutaPartnerId(c.uid); setPermutaPartnerData(c); setPermutaPartnerTerm(`${c.name} (${c.qra})`); setPermutaPartnerShow(false); }} className="w-full px-3 py-2 text-left hover:bg-blue-50 text-[9px] uppercase border-b last:border-0 flex flex-col"><span className="font-black">{c.name} ({c.qra})</span><span className="text-muted-foreground">{c.escala} / {c.turno}</span></button>))}</div>}</div></div>
                    <div className="space-y-2 pt-2"><Label className="text-[9px] font-black uppercase text-purple-700 tracking-widest block border-b pb-1">Escala do Parceiro (Automático)</Label><div className="grid grid-cols-2 gap-3 opacity-80"><div className="grid gap-1"><Label className="text-[8px] font-bold uppercase text-muted-foreground">De (Data Original)</Label><Input type="date" value={permutaMyNewDate} readOnly className="h-9 text-[10px] font-bold bg-purple-50 border-purple-100 cursor-not-allowed" /></div><div className="grid gap-1"><Label className="text-[8px] font-bold uppercase text-muted-foreground">Para (Nova Data)</Label><Input type="date" value={permutaMyOriginalDate} readOnly className="h-9 text-[10px] font-bold bg-purple-50 border-purple-100 cursor-not-allowed" /></div></div></div>
                    {hasInvalidPermutaMonth && <div className="bg-red-50 border border-red-100 rounded-lg p-2.5 flex items-center gap-2 animate-in zoom-in-95"><AlertCircle className="h-4 w-4 text-red-600 shrink-0" /><p className="text-[10px] font-black uppercase text-red-700">ERRO: A permuta deve ocorrer dentro do mesmo mês calendário.</p></div>}
                  </div>
                )}
                {["FOLGA", "ABONO TRE", "ESCALA ESPECIAL"].includes(requestType) && (
                   <div className="space-y-2 p-3 bg-muted/10 border rounded-xl"><div className="flex items-center justify-between mb-1"><Label className="text-[9px] font-bold uppercase text-muted-foreground">Datas Desejadas ({multiDates.filter(d => d).length})</Label><Button type="button" variant="ghost" size="sm" onClick={() => setMultiDates([...multiDates, ""])} className="h-5 text-[8px] font-black uppercase text-primary px-2 hover:bg-primary/10"><Plus className="h-3 w-3 mr-1" /> ADICIONAR</Button></div><div className="grid gap-2 grid-cols-2 sm:grid-cols-4">{multiDates.map((date, index) => (<div key={index} className="flex gap-1 group"><Input type="date" value={date} onChange={(e) => { const nd = [...multiDates]; nd[index] = e.target.value; setMultiDates(nd); }} required className="h-8 text-[10px] font-bold" />{multiDates.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => setMultiDates(multiDates.filter((_, i) => i !== index))} className="h-8 w-8 text-destructive/50 hover:text-destructive"><Trash2 className="h-3 w-3" /></Button>}</div>))}</div></div>
                )}
                {requestType === "TROCA DE ESCALA" && (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border rounded-xl animate-in slide-in-from-top-2 duration-300"><div className="grid gap-1"><Label className="text-[9px] font-bold uppercase text-muted-foreground">De (Data Original)</Label><Input type="date" value={swapFromDate} onChange={(e) => setSwapFromDate(e.target.value)} required className="h-9 text-[10px] font-bold bg-white" /></div><div className="grid gap-1"><Label className="text-[9px] font-bold uppercase text-muted-foreground">Para (Nova Data)</Label><Input type="date" value={swapToDate} onChange={(e) => setSwapToDate(e.target.value)} required className="h-9 text-[10px] font-bold bg-white" /></div></div>
                )}
                <div className="grid gap-1.5"><Label className="text-[9px] font-bold uppercase text-muted-foreground tracking-tight">Justificativa / Observações</Label><Textarea name="description" placeholder="DETALHE O MOTIVO DA SOLICITAÇÃO..." className="min-h-[60px] uppercase text-[11px] p-3 rounded-xl bg-muted/5 border-muted focus:bg-white transition-colors" required /></div>
                <div className="pt-3 border-t space-y-2"><div className="flex items-center justify-between"><Label className="text-[9px] font-black uppercase text-primary tracking-widest flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> {requestType === "PERMUTA" ? "As duas Chefias Imediatas (Solicitante e Parceiro)" : "Chefia Imediata (Ciência)"}</Label>{requestType !== "PERMUTA" && <Button type="button" variant="ghost" size="sm" onClick={addChefiaRow} className="h-5 text-[8px] font-black uppercase text-primary px-2 hover:bg-primary/5"><Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Outra</Button>}</div><div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{chefiaRows.map((row, index) => (<div key={row.id} className="flex gap-1.5 relative"><div className="relative flex-1"><Label className="text-[7px] font-black uppercase text-muted-foreground absolute -top-2 left-2 bg-background px-1 z-10">{requestType === "PERMUTA" ? (index === 0 ? "Chefia Solicitante" : "Chefia Parceiro") : `Chefia ${index + 1}`}</Label><Input placeholder="BUSCAR CHEFIA..." value={row.term} onChange={(e) => updateChefiaRow(index, { term: e.target.value.toUpperCase(), uid: "" })} onFocus={() => updateChefiaRow(index, { show: true })} className="h-8 border-muted uppercase text-[9px] font-bold pr-8" />{row.uid && <Check className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-green-600" />}{row.show && row.term && <div className="absolute z-[60] left-0 right-0 top-full mt-1 bg-background border rounded-lg shadow-xl max-h-32 overflow-y-auto">{allEmployees?.filter(e => ["INSPETOR", "SUBINSPETOR", "INSPETOR GERAL", "COMANDANTE"].includes(normalizeStr(e.role || "")) && (normalizeStr(e.name).includes(row.term) || normalizeStr(e.qra).includes(row.term)) && !chefiaRows.some((r, i) => i !== index && r.uid === e.uid)).map(c => (<button key={c.id} type="button" onMouseDown={() => updateChefiaRow(index, { uid: c.uid, term: `${c.name} (${c.qra})`, show: false })} className="w-full px-3 py-1.5 text-left hover:bg-muted text-[9px] uppercase border-b last:border-0">{c.name} ({c.qra})</button>))}</div>}</div>{requestType !== "PERMUTA" && chefiaRows.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => removeChefiaRow(index)} className="h-8 w-8 text-destructive/50 hover:text-destructive"><Trash2 className="h-3 w-3" /></Button>}</div>))}</div></div>
              </CardContent>
              <CardFooter className="border-t p-4 bg-muted/5"><Button type="submit" disabled={loading || hasInsufficientBalance || hasInsufficientTreBalance || hasInvalidAbonoDate || hasInvalidPermutaMonth} className="w-full h-11 uppercase font-black text-xs tracking-widest shadow-xl shadow-blue-100 transition-all active:scale-[0.98]">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-2" />} Finalizar e Enviar Solicitação</Button></CardFooter>
            </form>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-6 space-y-4">
          {loadingRequests ? <div className="flex h-32 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : (
            <div className="grid gap-4">
              {myRequests?.length === 0 ? <div className="text-center py-20 uppercase text-[10px] font-bold text-muted-foreground italic tracking-widest">NENHUMA SOLICITAÇÃO ENCONTRADA.</div> : myRequests?.map(req => {
                const isApproved = req.status === 'Aprovado';
                const isDenied = req.status === 'Negado';
                const isAwaitingRH = req.status === 'Aprovado pela Chefia';
                const isAwaitingPartner = req.status === 'Aguardando Parceiro';
                const isFolga = req.type === "FOLGA";
                const isTre = req.type === "ABONO TRE";
                const dateCount = req.date ? req.date.split(',').length : 0;
                const isSpecialType = ["REPROGRAMAÇÃO DE FÉRIAS", "PERMUTA", "TROCA DE ESCALA", "ATESTADO MÉDICO"].includes(req.type);

                return (
                  <Card key={req.id} className="card-shadow border-none rounded-xl overflow-hidden hover:shadow-md transition-all group">
                    <div className="flex flex-col sm:flex-row min-h-[100px]">
                      <div className={cn("w-full sm:w-28 flex flex-col items-center justify-center p-4 shrink-0 text-white", isApproved ? 'bg-green-600' : isDenied ? 'bg-red-600' : isAwaitingRH ? 'bg-blue-600' : isAwaitingPartner ? 'bg-indigo-500' : 'bg-orange-500')}><span className="font-black uppercase text-base tracking-tight text-center leading-tight mb-2">{req.status}</span>{isApproved ? <CheckCircle2 className="h-7 w-7" /> : <Clock className="h-7 w-7" />}</div>
                      <CardContent className="flex-1 p-4 space-y-2.5">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                          <div className="space-y-1 w-full"><div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-wrap"><div className="flex items-center gap-2 h-6"><h4 className="font-black uppercase text-base text-slate-900 leading-none">{req.type}</h4><span className="text-slate-400 font-bold">-</span></div>{isSpecialType ? <div className="flex flex-col gap-1.5 w-full sm:w-auto pt-0.5">{req.date.split('|').map((part: string, i: number) => (<div key={i} className="bg-blue-50 px-2 py-1 rounded border border-blue-100 w-fit"><span className="text-[10px] font-black text-blue-700 uppercase">- {part.trim()}</span></div>))}</div> : <div className="bg-blue-50 px-2 py-0.5 rounded border border-blue-100 h-fit self-center"><span className="text-[10px] font-black text-blue-700 uppercase">{req.date}</span></div>}</div><div className="flex items-center gap-2 mt-1"><ShieldCheck className="h-3 w-3 text-muted-foreground" /><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{req.escala || "---"} / {req.turno || "---"}</p>{(isFolga || isTre) && <><span className="text-slate-300">•</span><p className="text-[10px] font-black text-red-600 uppercase tracking-widest">DÉBITO: {isFolga ? `${minutesToHHmm(dateCount * requiredMinutesForFolga)}H` : `${dateCount} DIAS`}</p></>}</div></div>
                        </div>
                        <div className="bg-slate-50/50 p-2.5 rounded-lg border border-slate-100"><Label className="text-[8px] font-black uppercase text-muted-foreground mb-1 block">Justificativa Enviada:</Label><p className="text-[11px] text-slate-600 uppercase leading-relaxed italic">"{req.description}"</p></div>
                        {req.adminResponse && <div className="bg-blue-50/30 p-2.5 rounded-lg border-l-4 border-primary animate-in slide-in-from-left-1"><p className="text-[9px] font-black uppercase text-primary mb-1">Histórico de Respostas:</p><div className="space-y-1.5">{req.adminResponse.split('|').map((resp: string, i: number) => (<p key={i} className="text-[11px] uppercase font-bold text-slate-800 leading-snug border-b border-blue-100/50 last:border-0 pb-1 last:pb-0">{resp.trim()}</p>))}</div></div>}
                        <div className="flex items-center gap-1.5 pt-1.5 mt-1 border-t border-slate-100/50">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">Solicitado em:</span>
                          <span className="text-[9px] font-mono font-bold text-slate-500">
                            {req.createdAt?.toDate ? req.createdAt.toDate().toLocaleString('pt-BR') : '---'}
                          </span>
                        </div>
                      </CardContent>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="management" className="mt-6 space-y-3">
          {loadingManagement ? <div className="flex h-32 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : (
            <div className="grid gap-4">
              <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-blue-600" /><p className="text-[11px] font-bold uppercase text-blue-800 tracking-tight">PEDIDOS AGUARDANDO SEU PARECER OU DECISÃO DO RH.</p></div>
              {filteredManagementRequests?.length === 0 ? <div className="text-center py-16 uppercase text-[10px] font-bold text-muted-foreground italic tracking-widest border-2 border-dashed rounded-2xl">SUA FILA DE GESTÃO ESTÁ VAZIA.</div> : filteredManagementRequests?.map(req => {
                const isAwaitingPartner = req.status === "Aguardando Parceiro";
                const isPending = req.status === "Pendente";
                const isAwaitingRH = req.status === "Aprovado pela Chefia";
                let label = isAwaitingPartner ? "ACEITAR PERMUTA" : isPending ? (req.type === "PERMUTA" ? ((req.approvedChefiaIds?.length || 0) === 0 ? "1ª APROVAÇÃO (CHEFIA)" : "2ª APROVAÇÃO (CHEFIA)") : "DAR PARECER (CHEFIA)") : "HOMOLOGAR (RH)";

                return (
                  <Card key={req.id} className="card-shadow border-primary/10 rounded-xl overflow-hidden"><div className="flex flex-col sm:flex-row"><div className="sm:w-56 bg-muted/5 p-4 border-b sm:border-b-0 sm:border-r space-y-4 shrink-0"><div className="space-y-1"><p className="text-sm font-black uppercase text-slate-900 leading-tight">{req.employeeName}</p><p className="text-[11px] font-bold text-primary uppercase">QRA: {req.employeeQra}</p></div><div className="space-y-2"><Badge variant="outline" className="text-[9px] uppercase font-bold border-primary/20 text-primary bg-primary/5 px-2 py-0.5">{req.type}</Badge><p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">{req.escala} / {req.turno}</p></div><Badge className={cn("w-full justify-center border-none uppercase text-[9px] font-black h-6", isAwaitingPartner ? "bg-indigo-100 text-indigo-700" : "bg-amber-100 text-amber-700")}>{req.status}</Badge>{req.type === "PERMUTA" && req.status === "Pendente" && <div className="space-y-1 mt-2"><p className="text-[8px] font-black uppercase text-muted-foreground">Aprovação Dupla:</p><div className="flex gap-1"><div className={cn("h-1.5 flex-1 rounded-full", (req.approvedChefiaIds?.length || 0) >= 1 ? "bg-green-500" : "bg-slate-200")} /><div className={cn("h-1.5 flex-1 rounded-full", (req.approvedChefiaIds?.length || 0) >= 2 ? "bg-green-500" : "bg-slate-200")} /></div></div>}<div className="space-y-1 pt-2 border-t border-slate-200/50"><p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest">Criado em:</p><div className="flex items-center gap-1.5"><Clock className="h-3 w-3 text-slate-400" /><span className="text-[10px] font-mono font-bold text-slate-600">{req.createdAt?.toDate ? req.createdAt.toDate().toLocaleString('pt-BR') : '---'}</span></div></div></div><div className="flex-1 flex flex-col min-w-0"><CardContent className="p-4 flex-1 space-y-4"><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div className="space-y-1"><Label className="text-[10px] font-black text-blue-700 uppercase tracking-widest flex items-center gap-1.5"><CalendarDays className="h-3 w-3" /> Detalhes</Label><div className="space-y-1 mt-1">{req.date.split('|').map((part: string, i: number) => (<p key={i} className="text-[11px] font-black uppercase text-blue-900 leading-tight">{part.trim()}</p>))}</div></div><div className="space-y-1"><Label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5"><ShieldCheck className="h-3 w-3" /> Envolvidos</Label><p className="text-[10px] font-bold uppercase text-slate-700 leading-relaxed">{req.chefiaImediata}</p>{req.partnerName && <p className="text-[10px] font-black uppercase text-indigo-600 mt-1">PARCEIRO: {req.partnerName}</p>}</div></div><div className="bg-slate-50 p-3 rounded-lg border border-slate-100"><Label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-1.5 mb-1"><FileText className="h-3 w-3" /> Justificativa</Label><p className="text-[10px] uppercase text-slate-600 leading-relaxed italic">"{req.description}"</p></div>{req.adminResponse && <div className="bg-blue-50/20 p-2 rounded-lg border border-blue-100"><Label className="text-[8px] font-black uppercase text-primary mb-1 block">Pareceres:</Label><div className="space-y-1">{req.adminResponse.split('|').map((resp: string, i: number) => (<p key={i} className="text-[10px] uppercase font-bold text-slate-700 leading-tight">{resp.trim()}</p>))}</div></div>}<div className="pt-2 border-t"><Label className="text-[10px] font-black uppercase text-primary flex items-center gap-1.5 mb-2"><MessageSquare className="h-3 w-3" /> Seu Parecer</Label><Textarea value={adminResponseDraft[req.id] || ""} onChange={(e) => setAdminResponseDraft(prev => ({ ...prev, [req.id]: e.target.value }))} placeholder="DIGITE O PARECER..." className="min-h-[50px] uppercase text-[10px] p-2 rounded-lg bg-blue-50/10 border-blue-100 resize-none leading-relaxed" /></div></CardContent><CardFooter className="bg-muted/5 p-3 border-t flex items-center justify-end gap-3"><Button variant="ghost" size="sm" className="uppercase text-[10px] font-black text-red-600 h-8 px-4 hover:bg-red-50" onClick={() => handleProcessRequest(req, 'deny')}>NEGAR</Button><Button size="sm" className="uppercase text-[10px] font-black h-8 px-6 bg-blue-600 hover:bg-blue-700 shadow-md transition-all active:scale-95" onClick={() => handleProcessRequest(req, 'approve')}>{label} <ChevronRight className="ml-1 h-3 w-3" /></Button></CardFooter></div></div></Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {canAccessArchive && (
          <TabsContent value="archive" className="mt-6 space-y-4">
            <Card className="card-shadow border-none rounded-2xl overflow-hidden">
              <CardHeader className="bg-blue-50/30 border-b p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-black uppercase text-slate-900 flex items-center gap-2">
                      <Archive className="h-5 w-5 text-blue-600" /> Arquivo Geral de Requerimentos
                    </CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">
                      Histórico consolidado de despachos deferidos e indeferidos.
                    </CardDescription>
                  </div>
                  <div className="relative w-full sm:w-80">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="BUSCAR POR SERVIDOR OU TIPO..." 
                      className="pl-8 h-10 uppercase text-[10px] font-bold bg-white" 
                      value={archiveSearch}
                      onChange={(e) => setArchiveSearch(e.target.value.toUpperCase())}
                    />
                    {archiveSearch && (
                      <button onClick={() => setArchiveSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-slate-900"><X className="h-4 w-4" /></button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loadingArchive ? (
                  <div className="flex h-48 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-muted/20">
                          <TableRow>
                            <TableHead className="font-bold uppercase text-[9px] px-6">Servidor / QRA</TableHead>
                            <TableHead className="font-bold uppercase text-[9px]">Solicitação</TableHead>
                            <TableHead className="font-bold uppercase text-[9px]">Matrícula / Escala</TableHead>
                            <TableHead className="font-bold uppercase text-[9px]">Status / Despacho</TableHead>
                            <TableHead className="font-bold uppercase text-[9px] text-right px-6">Data Decisão</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedArchiveRequests.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="h-32 text-center uppercase text-[10px] font-bold text-muted-foreground italic tracking-widest">
                                NENHUM REGISTRO ENCONTRADO NO ARQUIVO.
                              </TableCell>
                            </TableRow>
                          ) : (
                            paginatedArchiveRequests.map((req) => (
                              <TableRow key={req.id} className="hover:bg-slate-50 transition-colors border-b last:border-0 group">
                                <TableCell className="px-6 py-4">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="font-black uppercase text-[12px] text-slate-900 leading-tight">{req.employeeName}</span>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <Badge className="bg-primary h-4 px-1.5 font-black text-[8px] uppercase">QRA: {req.employeeQra}</Badge>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-col gap-1">
                                    <span className="text-[11px] font-black uppercase text-blue-700">{req.type}</span>
                                    <div className="flex flex-wrap gap-1 max-w-[250px]">
                                      {req.date.split('|').map((d: string, i: number) => (
                                        <span key={i} className="text-[8px] font-bold text-slate-500 uppercase">{d.trim()}</span>
                                      ))}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-col">
                                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-700 uppercase">
                                      <Fingerprint className="h-3 w-3 text-slate-400" /> {req.matricula || "---"}
                                    </div>
                                    <span className="text-[9px] font-medium text-muted-foreground uppercase">{req.escala} / {req.turno}</span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="space-y-1.5">
                                    <Badge className={cn(
                                      "text-[8px] font-black uppercase border-none px-2 h-5",
                                      req.status === 'Aprovado' ? "bg-green-600 text-white" : "bg-red-600 text-white"
                                    )}>
                                      {req.status}
                                    </Badge>
                                    {req.adminResponse && (
                                      <p className="text-[9px] text-slate-500 uppercase italic max-w-[200px] truncate group-hover:whitespace-normal group-hover:overflow-visible" title={req.adminResponse}>
                                        {req.adminResponse.split('|').pop()?.trim()}
                                      </p>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right px-6">
                                  <span className="text-[10px] font-mono font-bold text-slate-600">
                                    {req.updatedAt ? new Date(req.updatedAt.seconds * 1000).toLocaleString('pt-BR') : "---"}
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>

                    {totalArchivePages > 1 && (
                      <div className="p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted/5">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">
                          Exibindo {paginatedArchiveRequests.length} de {filteredArchiveRequests.length} registros
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={archiveCurrentPage === 1}
                            onClick={() => setArchiveCurrentPage(prev => Math.max(prev - 1, 1))}
                            className="h-8 px-3 text-[10px] font-black uppercase gap-1.5"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" /> Anterior
                          </Button>
                          
                          <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(totalArchivePages, 5) }, (_, i) => {
                              let pageNum = i + 1;
                              if (totalArchivePages > 5 && archiveCurrentPage > 3) {
                                pageNum = Math.min(archiveCurrentPage - 2 + i, totalArchivePages - 4 + i);
                              }
                              if (pageNum > totalArchivePages || pageNum <= 0) return null;

                              return (
                                <Button
                                  key={pageNum}
                                  variant={archiveCurrentPage === pageNum ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => setArchiveCurrentPage(pageNum)}
                                  className={cn(
                                    "h-8 w-8 p-0 text-[10px] font-bold",
                                    archiveCurrentPage === pageNum ? "bg-primary text-white" : ""
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
                            disabled={archiveCurrentPage === totalArchivePages}
                            onClick={() => setArchiveCurrentPage(prev => Math.min(prev + 1, totalArchivePages))}
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
        )}
      </Tabs>
    </div>
  )
}
