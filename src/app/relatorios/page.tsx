"use client"

import * as React from "react"
import { 
  FileText, 
  User, 
  Calendar, 
  Clock, 
  Send,
  Loader2,
  Check,
  ShieldCheck,
  Briefcase,
  Plus,
  Trash2,
  UserX,
  ChevronDown,
  ChevronUp,
  History,
  Star,
  Timer,
  Users,
  Car,
  Save,
  MessageSquare,
  ClipboardList,
  Archive,
  Eye,
  CheckCircle2,
  X,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  Plane,
  Stethoscope,
  Info,
  TrendingUp,
  Printer,
  Search,
  ChevronLeft,
  ChevronRight
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { useFirestore, useCollection, useAuth } from '@/firebase'
import { 
  collection, 
  query, 
  orderBy, 
  where, 
  addDoc, 
  serverTimestamp, 
  updateDoc, 
  doc, 
  arrayUnion,
  deleteDoc 
} from 'firebase/firestore'
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Textarea } from "@/components/ui/textarea"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogClose,
  DialogFooter
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

const normalizeStr = (str: string) => str?.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || "";

const getSaoPauloDate = () => {
  const now = new Date();
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now).split('/').reverse().join('-');
};

const getSaoPauloTime = () => {
  const now = new Date();
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(now);
};

const formatDateBR = (dateStr: string) => {
  if (!dateStr) return "---";
  return dateStr.split('-').reverse().join('/');
};

const generateId = () => Math.random().toString(36).substr(2, 9);

const applyTimeMask = (value: string) => {
  let v = value.replace(/\D/g, "");
  if (v.length > 4) v = v.slice(0, 4);
  if (v.length <= 2) return v;
  return `${v.slice(0, 2)}:${v.slice(2)}`;
};

const calculateTimeDuration = (start: string, end: string) => {
  if (!start || !end || start.length !== 5 || end.length !== 5) return "";
  const [h1, m1] = start.split(':').map(Number);
  const [h2, m2] = end.split(':').map(Number);
  if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return "";
  
  let totalMinutesStart = h1 * 60 + m1;
  let totalMinutesEnd = h2 * 60 + m2;
  
  if (totalMinutesEnd <= totalMinutesStart) totalMinutesEnd += 24 * 60;
  
  const diffMinutes = totalMinutesEnd - totalMinutesStart;
  const h = Math.floor(diffMinutes / 60);
  const m = diffMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const ITEMS_PER_PAGE = 50;

export default function RelatoriosPage() {
  const { toast } = useToast()
  const firestore = useFirestore()
  const { user: currentUser, employeeData } = useAuth()
  
  const [loading, setLoading] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState("new")
  const [editingReportId, setEditingReportId] = React.useState<string | null>(null)
  const [reportToPrint, setReportToPrint] = React.useState<any>(null)

  const [isSubTeamOpen, setIsSubTeamOpen] = React.useState(false)
  const [isAbsencesOpen, setIsAbsencesOpen] = React.useState(false)
  const [isAfastadosOpen, setIsAfastadosOpen] = React.useState(false)
  const [isEspecialOpen, setIsEspecialOpen] = React.useState(false)
  const [isOvertimeOpen, setIsOvertimeOpen] = React.useState(false)
  const [isTeamOpen, setIsTeamOpen] = React.useState(false)

  const [defaultDate, setDefaultDate] = React.useState("")
  const [defaultTime, setDefaultTime] = React.useState("")
  const [selectedEscalaId, setSelectedEscalaId] = React.useState("")
  const [observations, setObservations] = React.useState("")

  const [isReturnDialogOpen, setIsReturnDialogOpen] = React.useState(false)
  const [reportToReturn, setReportToReturn] = React.useState<any>(null)
  const [returnReason, setReturnReason] = React.useState("")

  const [isDraftDialogOpen, setIsDraftDialogOpen] = React.useState(false)
  const [tempDraft, setTempDraft] = React.useState<any>(null)

  const [archiveSearch, setArchiveSearch] = React.useState("");
  const [archiveCurrentPage, setArchiveCurrentPage] = React.useState(1);

  const [isFormItemDeleteDialogOpen, setIsFormItemDeleteDialogOpen] = React.useState(false)
  const [formItemToDelete, setFormItemToDelete] = React.useState<{ type: string; label: string; payload: any } | null>(null)

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false)
  const [reportToDelete, setReportToDelete] = React.useState<any>(null)

  // Limites de Data (Retroagir no máximo 3 dias e bloquear futuro)
  const dateLimits = React.useMemo(() => {
    const today = new Date();
    const minDateObj = new Date(today);
    minDateObj.setDate(today.getDate() - 3);

    const formatDate = (date: Date) => {
      return new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(date).split('/').reverse().join('-');
    };

    return {
      min: formatDate(minDateObj),
      max: formatDate(today)
    };
  }, []);

  const canManageAudit = React.useMemo(() => {
    if (!employeeData) return false;
    const role = normalizeStr(employeeData.role || "");
    return ["INSPETOR GERAL", "COMANDANTE", "GESTOR DE RH"].some(r => role.includes(r));
  }, [employeeData]);

  const canDeleteArchived = React.useMemo(() => {
    if (!employeeData) return false;
    const role = normalizeStr(employeeData.role || "");
    return ["INSPETOR GERAL", "COMANDANTE"].some(r => role.includes(r));
  }, [employeeData]);

  React.useEffect(() => {
    setDefaultDate(getSaoPauloDate());
    setDefaultTime(getSaoPauloTime());

    const saved = localStorage.getItem('nrg_relatorio_draft');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setTempDraft(parsed);
        setIsDraftDialogOpen(true);
      } catch (e) {
        console.error("Erro ao ler rascunho", e);
      }
    }
  }, []);

  const [inspetorTerm, setInspetorTerm] = React.useState("")
  const [inspetorId, setInspetorId] = React.useState("")
  const [inspetorInfo, setInspetorInfo] = React.useState("")
  const [showInspetorSuggestions, setShowInspetorSuggestions] = React.useState(false)

  const [subinspetorRows, setSubinspetorRows] = React.useState([
    { id: generateId(), term: "", info: "", show: false, empId: "" }
  ]);

  const [faltaRows, setFaltaRows] = React.useState([
    { id: generateId(), term: "", info: "", show: false, empId: "" }
  ]);

  const [especialRows, setEspecialRows] = React.useState([
    { id: generateId(), term: "", info: "", show: false, periodId: "", empId: "" }
  ]);

  const [overtimeRows, setOvertimeRows] = React.useState([
    { id: generateId(), term: "", empId: "", show: false, shiftEnd: "", overtimeEnd: "", total: "" }
  ]);

  const [sectorBlocks, setSectorBlocks] = React.useState<any[]>([
    {
      id: generateId(),
      sectorType: "",
      chiefData: { id: "", term: "", info: "", show: false },
      posts: [
        {
          id: generateId(),
          type: "",
          vtrNumber: "",
          members: [
            { id: generateId(), empId: "", term: "", show: false }
          ]
        }
      ]
    }
  ]);

  const resetForm = () => {
    setEditingReportId(null);
    setObservations("");
    setInspetorId("");
    setInspetorTerm("");
    setInspetorInfo("");
    setDefaultDate(getSaoPauloDate());
    setDefaultTime(getSaoPauloTime());
    setSelectedEscalaId("");
    setSubinspetorRows([{ id: generateId(), term: "", info: "", show: false, empId: "" }]);
    setFaltaRows([{ id: generateId(), term: "", info: "", show: false, empId: "" }]);
    setEspecialRows([{ id: generateId(), term: "", info: "", show: false, periodId: "", empId: "" }]);
    setOvertimeRows([{ id: generateId(), term: "", empId: "", show: false, shiftEnd: "", overtimeEnd: "", total: "" }]);
    setSectorBlocks([{ id: generateId(), sectorType: "", chiefData: { id: "", term: "", info: "", show: false }, posts: [{ id: generateId(), type: "", vtrNumber: "", members: [{ id: generateId(), empId: "", term: "", show: false }] }] }]);
    localStorage.removeItem('nrg_relatorio_draft');
  };

  const loadReportForCorrection = (report: any) => {
    setEditingReportId(report.id);
    setDefaultDate(report.date);
    setDefaultTime(report.time);
    setSelectedEscalaId(report.escalaId);
    setObservations(report.observations);
    
    setInspetorId(report.inspector.id);
    setInspetorTerm(`${report.inspector.name} (${report.inspector.qra})`);
    setInspetorInfo(report.inspector.info);

    setSubinspetorRows(report.subinspectors?.length ? report.subinspectors.map((s: any) => ({
      id: generateId(), term: `${s.name} (${s.qra})`, info: s.info, show: false, empId: s.id
    })) : [{ id: generateId(), term: "", info: "", show: false, empId: "" }]);

    setFaltaRows(report.absences?.length ? report.absences.map((f: any) => ({
      id: generateId(), term: `${f.name} (${f.qra})`, info: f.info, show: false, empId: f.id
    })) : [{ id: generateId(), term: "", info: "", show: false, empId: "" }]);

    setEspecialRows(report.specialSchedule?.length ? report.specialSchedule.map((e: any) => ({
      id: generateId(), term: `${e.name} (${e.qra})`, info: e.info, show: false, periodId: e.periodId, empId: e.id
    })) : [{ id: generateId(), term: "", info: "", show: false, periodId: "", empId: "" }]);

    setOvertimeRows(report.overtime?.length ? report.overtime.map((o: any) => ({
      id: generateId(), term: `${o.name} (${o.qra})`, empId: o.id, show: false, shiftEnd: o.shiftEnd, overtimeEnd: o.overtimeEnd, total: o.total
    })) : [{ id: generateId(), term: "", empId: "", show: false, shiftEnd: "", overtimeEnd: "", total: "" }]);

    setSectorBlocks(report.sectors?.map((s: any) => ({
      id: s.id || generateId(),
      sectorType: s.sectorType,
      chiefData: { id: s.chief.id, term: `${s.chief.name} (${s.chief.qra})`, info: "", show: false },
      posts: s.posts.map((p: any) => ({
        id: p.id || generateId(),
        type: p.type,
        vtrNumber: p.vtrNumber,
        members: p.members.map((m: any) => ({ id: generateId(), empId: m.id, term: m.qra, show: false }))
      }))
    })) || [{ id: generateId(), sectorType: "", chiefData: { id: "", term: "", info: "", show: false }, posts: [{ id: generateId(), type: "", vtrNumber: "", members: [{ id: generateId(), empId: "", term: "", show: false }] }] }]);

    setActiveTab("new");
    toast({ title: "RELATÓRIO CARREGADO", description: "Corrija os dados conforme solicitado pelo RH." });
  };

  const handlePrintReport = (report: any) => {
    setReportToPrint(report);
    setTimeout(() => {
      window.print();
      setReportToPrint(null);
    }, 200);
  };

  const handleDeleteReport = async () => {
    if (!firestore || !reportToDelete) return;
    try {
      await deleteDoc(doc(firestore, 'dailyReports', reportToDelete.id));
      toast({ title: "RELATÓRIO EXCLUÍDO", description: "O registro foi removido permanentemente da base de dados." });
      setIsDeleteDialogOpen(false);
      setReportToDelete(null);
    } catch (err) {
      toast({ variant: "destructive", title: "ERRO AO EXCLUIR", description: "Não foi possível remover o registro." });
    }
  };

  const confirmFormItemDelete = (type: string, label: string, payload: any) => {
    setFormItemToDelete({ type, label, payload });
    setIsFormItemDeleteDialogOpen(true);
  };

  const executeFormItemDelete = () => {
    if (!formItemToDelete) return;
    const { type, payload } = formItemToDelete;

    if (type === 'subinspetor') {
      const newRows = subinspetorRows.filter((_, i) => i !== payload.index);
      setSubinspetorRows(newRows.length ? newRows : [{ id: generateId(), term: "", info: "", show: false, empId: "" }]);
    } else if (type === 'falta') {
      const newRows = faltaRows.filter((_, i) => i !== payload.index);
      setFaltaRows(newRows.length ? newRows : [{ id: generateId(), term: "", info: "", show: false, empId: "" }]);
    } else if (type === 'especial') {
      const newRows = especialRows.filter((_, i) => i !== payload.index);
      setEspecialRows(newRows.length ? newRows : [{ id: generateId(), term: "", info: "", show: false, periodId: "", empId: "" }]);
    } else if (type === 'overtime') {
      const newRows = overtimeRows.filter((_, i) => i !== payload.index);
      setOvertimeRows(newRows.length ? newRows : [{ id: generateId(), term: "", empId: "", show: false, shiftEnd: "", overtimeEnd: "", total: "" }]);
    } else if (type === 'sector') {
      const newBlocks = sectorBlocks.filter((_, i) => i !== payload.index);
      setSectorBlocks(newBlocks.length ? newBlocks : []);
    } else if (type === 'post') {
      const newBlocks = [...sectorBlocks];
      newBlocks[payload.sectorIndex].posts = newBlocks[payload.sectorIndex].posts.filter((_: any, i: number) => i !== payload.postIndex);
      setSectorBlocks(newBlocks);
    } else if (type === 'member') {
      const newBlocks = [...sectorBlocks];
      newBlocks[payload.sectorIndex].posts[payload.postIndex].members = newBlocks[payload.sectorIndex].posts[payload.postIndex].members.filter((_: any, i: number) => i !== payload.memberIndex);
      setSectorBlocks(newBlocks);
    }

    setIsFormItemDeleteDialogOpen(false);
    setFormItemToDelete(null);
    toast({ title: "REMOVIDO", description: "O item foi removido do relatório." });
  };

  const employeesRef = React.useMemo(() => firestore ? query(collection(firestore, 'employees'), orderBy('name', 'asc')) : null, [firestore]);
  const shiftPeriodsRef = React.useMemo(() => firestore ? query(collection(firestore, 'shiftPeriods'), orderBy('escalaName', 'asc')) : null, [firestore]);
  const servicePostsRef = React.useMemo(() => firestore ? query(collection(firestore, 'servicePosts'), orderBy('name', 'asc')) : null, [firestore]);
  const allLaunchesRef = React.useMemo(() => {
    if (!firestore || !defaultDate) return null;
    return query(collection(firestore, 'launches'), where('startDate', '<=', defaultDate));
  }, [firestore, defaultDate]);

  const pendingReportsRef = React.useMemo(() => firestore ? query(collection(firestore, 'dailyReports'), where('status', '==', 'PENDENTE'), orderBy('createdAt', 'desc')) : null, [firestore]);
  
  const archivedReportsRef = React.useMemo(() => {
    if (!firestore || !currentUser || !employeeData) return null;
    
    const baseQuery = collection(firestore, 'dailyReports');
    if (canManageAudit) {
      return query(baseQuery, where('status', '==', 'ARQUIVADO'), orderBy('createdAt', 'desc'));
    } else {
      return query(
        baseQuery, 
        where('status', '==', 'ARQUIVADO'), 
        where('createdBy', '==', currentUser.uid),
        orderBy('createdAt', 'desc')
      );
    }
  }, [firestore, currentUser, employeeData, canManageAudit]);

  const inReviewReportsRef = React.useMemo(() => firestore ? query(collection(firestore, 'dailyReports'), where('status', '==', 'EM REVISÃO'), orderBy('createdAt', 'desc')) : null, [firestore]);

  const { data: allEmployees, loading: loadingEmployees } = useCollection(employeesRef);
  const { data: shiftPeriods } = useCollection(shiftPeriodsRef);
  const { data: servicePosts } = useCollection(servicePostsRef);
  const { data: allLaunches } = useCollection(allLaunchesRef);
  const { data: pendingReports } = useCollection(pendingReportsRef);
  const { data: archivedReports } = useCollection(archivedReportsRef);
  const { data: inReviewReports } = useCollection(inReviewReportsRef);

  const chefiaList = React.useMemo(() => {
    if (!allEmployees) return [];
    const allowedRoles = ["INSPETOR", "SUBINSPETOR", "INSPETOR GERAL", "COMANDANTE"];
    return allEmployees.filter(emp => allowedRoles.includes(normalizeStr(emp.role || "")));
  }, [allEmployees]);

  const specialPeriodsList = React.useMemo(() => {
    if (!shiftPeriods) return [];
    return shiftPeriods
      .filter(p => normalizeStr(p.escalaName).includes("ESCALA ESPECIAL"))
      .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));
  }, [shiftPeriods]);

  const regularPeriodsList = React.useMemo(() => {
    if (!shiftPeriods) return [];
    return shiftPeriods
      .filter(p => !normalizeStr(p.escalaName).includes("ESCALA ESPECIAL"))
      .sort((a, b) => (a.escalaName || "").localeCompare(b.escalaName || ""));
  }, [shiftPeriods]);

  const getEmployeeShiftInfo = (id: string) => {
    const emp = allEmployees?.find(e => e.id === id);
    if (!emp) return "";
    return ` [${emp.escala} / ${emp.turno}]`;
  };

  const filteredArchivedReports = React.useMemo(() => {
    if (!archivedReports) return [];
    const term = archiveSearch.toLowerCase();
    return archivedReports.filter(report => 
      report.inspector?.name?.toLowerCase().includes(term) ||
      report.inspector?.qra?.toLowerCase().includes(term) ||
      report.escalaName?.toLowerCase().includes(term) ||
      report.date?.includes(term)
    );
  }, [archivedReports, archiveSearch]);

  const paginatedArchivedReports = React.useMemo(() => {
    const startIndex = (archiveCurrentPage - 1) * ITEMS_PER_PAGE;
    return filteredArchivedReports.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredArchivedReports, archiveCurrentPage]);

  const totalArchivePages = Math.ceil(filteredArchivedReports.length / ITEMS_PER_PAGE);

  React.useEffect(() => {
    setArchiveCurrentPage(1);
  }, [archiveSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !currentUser || !employeeData) return;

    if (!inspetorId || !selectedEscalaId) {
      toast({ variant: "destructive", title: "DADOS INCOMPLETOS", description: "SELECIONE O INSPETOR E A ESCALA." });
      return;
    }

    setLoading(true);

    const reportPayload: any = {
      date: defaultDate,
      time: defaultTime,
      escalaId: selectedEscalaId,
      escalaName: shiftPeriods?.find((p: any) => p.id === selectedEscalaId)?.escalaName || "N/A",
      inspector: {
        id: inspetorId,
        name: inspetorTerm.split(' (')[0],
        qra: inspetorTerm.match(/\(([^)]+)\)/)?.[1] || inspetorTerm,
        info: inspetorInfo
      },
      subinspectors: subinspetorRows.filter(r => !!r.empId).map(r => ({
        id: r.empId,
        name: r.term.split(' (')[0],
        qra: r.term.match(/\(([^)]+)\)/)?.[1] || r.term,
        info: r.info
      })),
      absences: faltaRows.filter(r => !!r.empId).map(r => ({
        id: r.empId,
        name: r.term.split(' (')[0],
        qra: r.term.match(/\(([^)]+)\)/)?.[1] || r.term,
        info: r.info
      })),
      absentTodayList: absentTodayList.map(l => ({
        id: l.employeeId,
        name: l.employeeName,
        qra: l.employeeQra,
        type: l.type,
        startDate: l.startDate,
        endDate: l.endDate,
        escala: l.escala,
        turno: l.turno
      })),
      specialSchedule: especialRows.filter(r => !!r.empId).map(r => {
        const period = specialPeriodsList.find((p: any) => p.id === r.periodId);
        return {
          id: r.empId,
          name: r.term.split(' (')[0],
          qra: r.term.match(/\(([^)]+)\)/)?.[1] || r.term,
          info: r.info,
          periodId: r.periodId,
          periodName: period ? `ESCALA ESPECIAL ${period.startTime} AS ${period.endTime}` : "N/A"
        };
      }),
      overtime: overtimeRows.filter(r => !!r.empId).map(r => ({
        id: r.empId,
        name: r.term.split(' (')[0],
        qra: r.term.match(/\(([^)]+)\)/)?.[1] || r.term,
        shiftEnd: r.shiftEnd,
        overtimeEnd: r.overtimeEnd,
        total: r.total
      })),
      sectors: sectorBlocks.map(s => ({
        id: s.id,
        sectorType: s.sectorType,
        chief: {
          id: s.chiefData.id,
          name: s.chiefData.term.split(' (')[0],
          qra: s.chiefData.term.match(/\(([^)]+)\)/)?.[1] || s.chiefData.term
        },
        posts: s.posts.map((p: any) => ({
          id: p.id,
          type: p.type,
          vtrNumber: p.vtrNumber,
          members: p.members.filter((m: any) => !!m.empId).map((m: any) => ({
            id: m.empId,
            qra: m.term
          }))
        }))
      })),
      observations: observations,
      status: "PENDENTE",
      updatedAt: serverTimestamp()
    };

    const auditEntry = {
      timestamp: new Date().toISOString(),
      action: editingReportId ? "Relatório Re-enviado para Correção" : "Novo Relatório Enviado",
      user: employeeData.name,
      qra: employeeData.qra,
      notes: editingReportId ? "Correção realizada conforme solicitado." : "Primeira submissão."
    };

    try {
      if (editingReportId) {
        await updateDoc(doc(firestore, 'dailyReports', editingReportId), {
          ...reportPayload,
          auditHistory: arrayUnion(auditEntry)
        });
        toast({ title: "REVISÃO ENVIADA", description: "O relatório foi devolvido para a fila de auditoria." });
      } else {
        await addDoc(collection(firestore, 'dailyReports'), {
          ...reportPayload,
          createdBy: currentUser.uid,
          createdAt: serverTimestamp(),
          auditHistory: [auditEntry]
        });
        toast({ title: "RELATÓRIO ENVIADO", description: "O registro foi salvo e aguarda conferência do RH." });
      }
      resetForm();
    } catch (err) {
      toast({ variant: "destructive", title: "ERRO AO SALVAR", description: "Verifique sua conexão." });
    } finally {
      setLoading(false);
    }
  };

  const handleArchiveReport = async (reportId: string) => {
    if (!firestore || !employeeData) return;
    try {
      await updateDoc(doc(firestore, 'dailyReports', reportId), {
        status: 'ARQUIVADO',
        auditHistory: arrayUnion({
          timestamp: new Date().toISOString(),
          action: "Relatório Homologado e Arquivado",
          user: employeeData.name,
          qra: employeeData.qra,
          notes: "Relatório validado sem pendências."
        })
      });
      toast({ title: "RELATÓRIO ARQUIVADO", description: "Auditoria finalizada com sucesso." });
    } catch (err) {
      toast({ variant: "destructive", title: "ERRO AO ARQUIVAR" });
    }
  };

  const handleReturnReport = async () => {
    if (!firestore || !reportToReturn || !returnReason || !employeeData) return;
    try {
      await updateDoc(doc(firestore, 'dailyReports', reportToReturn.id), {
        status: 'EM REVISÃO',
        lastReturnReason: returnReason.toUpperCase(),
        auditHistory: arrayUnion({
          timestamp: new Date().toISOString(),
          action: "Devolvido para Correção",
          user: employeeData.name,
          qra: employeeData.qra,
          notes: returnReason.toUpperCase()
        })
      });
      setIsReturnDialogOpen(false);
      setReturnReason("");
      toast({ title: "RELATÓRIO DEVOLVIDO", description: "O usuário receberá o aviso para correção." });
    } catch (err) {
      toast({ variant: "destructive", title: "ERRO AO DEVOLVER" });
    }
  };

  const absentTodayList = React.useMemo(() => {
    if (!allLaunches || !allEmployees || !inspetorId || !defaultDate) return [];
    const selectedInspetor = allEmployees.find(e => e.id === inspetorId);
    if (!selectedInspetor) return [];
    const targetDate = defaultDate;
    const types = ["FOLGA", "ABONO TRE", "FERIAS", "LICENCA", "ATESTADO", "TRE DEBITO"];
    return allLaunches.filter(l => {
      const normType = normalizeStr(l.type || "");
      const isActive = l.startDate <= targetDate && l.endDate >= targetDate;
      if (!isActive || !types.some(t => normType.includes(t))) return false;
      const emp = allEmployees.find(e => e.id === l.employeeId);
      if (!emp) return false;
      const isSameShiftAndSchedule = emp.escala === selectedInspetor.escala && emp.turno === selectedInspetor.turno;
      const isOrdinario = normalizeStr(emp.escala || "") === "ORDINARIO";
      return isSameShiftAndSchedule || isOrdinario;
    }).map(l => {
      const emp = allEmployees.find(e => e.id === l.employeeId);
      return { 
        ...l, 
        unit: emp?.unit || "N/A",
        escala: emp?.escala || "N/A",
        turno: emp?.turno || "N/A"
      }
    })
      .sort((a, b) => (a.employeeName || "").localeCompare(b.employeeName || ""));
  }, [allLaunches, allEmployees, inspetorId, defaultDate]);

  const trulyAbsentIds = React.useMemo(() => {
    const ids = faltaRows.map(r => r.empId).filter(Boolean);
    absentTodayList.forEach(l => ids.push(l.employeeId));
    return Array.from(new Set(ids));
  }, [faltaRows, absentTodayList]);

  const subTeamIds = React.useMemo(() => {
    const ids = [inspetorId, ...subinspetorRows.map(r => r.empId)].filter(Boolean);
    return Array.from(new Set(ids));
  }, [inspetorId, subinspetorRows]);

  const teamMemberIds = React.useMemo(() => {
    const ids: string[] = [];
    sectorBlocks.forEach(s => s.posts.forEach((p: any) => p.members.forEach((m: any) => { if (m.empId) ids.push(m.empId); })));
    return Array.from(new Set(ids));
  }, [sectorBlocks]);

  const availableChiefsForSectors = React.useMemo(() => {
    if (!allEmployees) return [];
    return allEmployees.filter(emp => subTeamIds.includes(emp.id));
  }, [allEmployees, subTeamIds]);

  const subTeamFilled = subinspetorRows.some(r => !!r.empId);
  const absencesFilled = faltaRows.some(r => !!r.empId);
  const especialFilled = especialRows.some(r => !!r.empId);
  const overtimeFilled = overtimeRows.some(r => !!r.empId);
  const teamFilled = sectorBlocks.some(s => s.sectorType && s.posts.some((p: any) => p.members.some((m: any) => !!m.empId)));
  const afastadosFilled = absentTodayList.length > 0;

  const addSubinspetorRow = () => setSubinspetorRows([...subinspetorRows, { id: generateId(), term: "", info: "", show: false, empId: "" }]);
  const updateSubinspetorRow = (index: number, updates: any) => {
    setSubinspetorRows(prev => { const newRows = [...prev]; newRows[index] = { ...newRows[index], ...updates }; return newRows; });
  };

  const addFaltaRow = () => setFaltaRows([...faltaRows, { id: generateId(), term: "", info: "", show: false, empId: "" }]);
  const updateFaltaRow = (index: number, updates: any) => {
    setFaltaRows(prev => { const newRows = [...prev]; newRows[index] = { ...newRows[index], ...updates }; return newRows; });
  };

  const addEspecialRow = () => setEspecialRows([...especialRows, { id: generateId(), term: "", info: "", show: false, periodId: "", empId: "" }]);
  const updateEspecialRow = (index: number, updates: any) => {
    setEspecialRows(prev => { const newRows = [...prev]; newRows[index] = { ...newRows[index], ...updates }; return newRows; });
  };

  const addOvertimeRow = () => setOvertimeRows([...overtimeRows, { id: generateId(), term: "", empId: "", show: false, shiftEnd: "", overtimeEnd: "", total: "" }]);
  const updateOvertimeRow = (index: number, updates: any) => {
    setOvertimeRows(prev => {
      const newRows = [...prev];
      const updatedRow = { ...newRows[index], ...updates };
      if (updates.shiftEnd !== undefined || updates.overtimeEnd !== undefined) {
        updatedRow.total = calculateTimeDuration(updatedRow.shiftEnd, updatedRow.overtimeEnd);
      }
      newRows[index] = updatedRow;
      return newRows;
    });
  };

  const addSectorBlock = () => setSectorBlocks([...sectorBlocks, { id: generateId(), sectorType: "", chiefData: { id: "", term: "", info: "", show: false }, posts: [{ id: generateId(), type: "", vtrNumber: "", members: [{ id: generateId(), empId: "", term: "", show: false }] }] }]);
  
  const updateSectorBlock = (index: number, updates: any) => { 
    setSectorBlocks(prev => { 
      const newBlocks = [...prev]; 
      newBlocks[index] = { ...newBlocks[index], ...updates }; 
      return newBlocks; 
    }); 
  };

  const updateSectorChiefData = (index: number, updates: any) => { 
    setSectorBlocks(prev => { 
      const newBlocks = [...prev]; 
      if (!newBlocks[index]) return prev; 
      newBlocks[index] = { 
        ...newBlocks[index], 
        chiefData: { ...newBlocks[index].chiefData, ...updates } 
      }; 
      return newBlocks; 
    });
  };

  const addPostToSector = (sectorIndex: number) => { const newBlocks = [...sectorBlocks]; newBlocks[sectorIndex].posts.push({ id: generateId(), type: "", vtrNumber: "", members: [{ id: generateId(), empId: "", term: "", show: false }] }); setSectorBlocks(newBlocks); };
  const addMemberToPost = (sectorIndex: number, postIndex: number) => {
    const newBlocks = [...sectorBlocks]; 
    const post = newBlocks[sectorIndex].posts[postIndex]; 
    const type = normalizeStr(post.type);
    const isVTR = type.includes("VTR"); 
    const isSmallVehicle = type.includes("MOTO") || type.includes("QUADRI");
    
    let limit = 15;
    if (isVTR) limit = 5;
    else if (isSmallVehicle) limit = 2;

    if (post.members.length >= limit) { toast({ variant: "destructive", title: "LIMITE ATINGIDO", description: `MÁXIMO DE ${limit} INTEGRANTES PARA ESTE POSTO.` }); return; }
    post.members.push({ id: generateId(), empId: "", term: "", show: false }); setSectorBlocks(newBlocks);
  };
  const updateMemberInPost = (sectorIndex: number, postIndex: number, memberIndex: number, updates: any) => { setSectorBlocks(prev => { const newBlocks = [...prev]; const sector = { ...newBlocks[sectorIndex] }; const posts = [...sector.posts]; const post = { ...posts[postIndex] }; const members = [...post.members]; members[memberIndex] = { ...members[memberIndex], ...updates }; post.members = members; posts[postIndex] = post; sector.posts = posts; newBlocks[sectorIndex] = sector; return newBlocks; }); };

  const renderAutocomplete = (label: string, term: string, setTerm: (v: string) => void, setId: (v: string) => void, id: string, show: boolean, setShow: (v: boolean) => void, setInfo: (v: string) => void, sourceList: any[], excludeIds: string[] = [], isOptional?: boolean, displayType: 'full' | 'qra' = 'full') => {
    const filtered = sourceList.filter(e => (normalizeStr(e.name).includes(normalizeStr(term)) || normalizeStr(e.qra).includes(normalizeStr(term))) && (!excludeIds.includes(e.id) || e.id === id));
    return (
      <div className="space-y-1 relative flex-1">
        <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-2"><User className="h-3 w-3" /> {label}</Label>
        <div className="relative">
          <Input placeholder={`BUSCAR...`} className="h-11 uppercase font-bold text-xs bg-slate-50/50 focus:bg-white transition-colors border rounded-md px-3 outline-none w-full" value={term} onChange={(e) => { const val = e.target.value.toUpperCase(); setTerm(val); setShow(true); if (!val) { setId(""); setInfo(""); } }} onFocus={() => setShow(true)} required={!isOptional} />
          {id && <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5"><div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" /><Check className="h-4 w-4 text-green-600" /></div>}
        </div>
        {show && term && (
          <div className="absolute z-[100] left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-48 overflow-y-auto overflow-x-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            {filtered.length > 0 ? filtered.map(emp => (
              <button key={emp.id} type="button" onClick={() => { setTerm(displayType === 'qra' ? emp.qra : `${emp.name} (${emp.qra})`); setId(emp.id); setInfo(`${emp.escala} / ${emp.turno}`); setShow(false); }} className="w-full px-4 py-3 text-left hover:bg-blue-50 flex flex-col border-b border-slate-100 last:border-0 transition-colors">
                <span className="text-[11px] font-black text-slate-900 uppercase">{emp.name}</span>
                <div className="flex items-center gap-2 mt-0.5"><Badge variant="secondary" className="text-[8px] font-bold bg-blue-50 text-blue-700 border-blue-100 uppercase">{emp.role}</Badge><span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">QRA: {emp.qra}</span></div>
              </button>
            )) : <div className="px-4 py-4 text-[10px] text-muted-foreground italic uppercase text-center font-bold">NENHUM REGISTRO ENCONTRADO.</div>}
          </div>
        )}
        {show && <div className="fixed inset-0 z-[90]" onClick={() => setShow(false)} />}
      </div>
    );
  };

  const renderAuditHistory = (history: any[]) => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b pb-2">
        <History className="h-4 w-4 text-primary" />
        <h4 className="text-xs font-black uppercase text-slate-900 tracking-widest">LINHA DO TEMPO (AUDITORIA)</h4>
      </div>
      <div className="relative space-y-6 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
        {history?.map((entry, idx) => (
          <div key={idx} className="relative flex items-start gap-6 animate-in fade-in slide-in-from-left-2 duration-300">
            <div className="flex items-center justify-center shrink-0 w-10 h-10 rounded-full bg-white border-2 border-slate-100 shadow-sm z-10">
              <div className="w-2.5 h-2.5 rounded-full bg-primary" />
            </div>
            <div className="flex-1 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] font-black uppercase text-primary">{entry.action}</span>
                <span className="text-[9px] font-mono font-bold text-muted-foreground">{new Date(entry.timestamp).toLocaleString('pt-BR')}</span>
              </div>
              <p className="text-[11px] font-bold uppercase text-slate-700 leading-tight">{entry.user} ({entry.qra})</p>
              {entry.notes && (
                <div className="mt-2 pt-2 border-t border-slate-200/50 italic text-[10px] text-slate-500 uppercase leading-relaxed">
                  "{entry.notes}"
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderReportList = (reports: any[], emptyMessage: string, canManage?: boolean, canDelete?: boolean) => (
    <div className="grid gap-4">
      {reports.length === 0 ? (
        <div className="text-center py-20 uppercase text-[10px] font-bold text-muted-foreground italic tracking-widest border-2 border-dashed rounded-2xl">
          {emptyMessage}
        </div>
      ) : (
        reports.map(report => (
          <Card key={report.id} className="card-shadow border-none rounded-xl overflow-hidden hover:shadow-md transition-all group">
            <div className="flex flex-col sm:flex-row items-stretch">
              <div className={cn(
                "w-full sm:w-16 flex flex-col items-center justify-center p-4 shrink-0 text-white transition-colors",
                report.status === 'ARQUIVADO' ? 'bg-green-600' : report.status === 'EM REVISÃO' ? 'bg-amber-500' : 'bg-blue-600'
              )}>
                <FileText className="h-6 w-6" />
              </div>
              <div className="flex-1 p-4 grid grid-cols-1 sm:grid-cols-4 gap-4 items-center">
                <div>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Data / Turno</p>
                  <p className="text-[11px] font-black uppercase text-slate-900">{formatDateBR(report.date)} - {report.time}</p>
                  <Badge variant="secondary" className="text-[8px] uppercase font-bold mt-1">{report.escalaName}</Badge>
                </div>
                <div>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase">Inspetor Responsável</p>
                  <p className="text-[11px] font-black uppercase text-slate-900">{report.inspector?.name}</p>
                  <p className="text-[9px] font-bold text-primary uppercase">QRA: {report.inspector?.qra}</p>
                  <p className="text-[8px] font-medium text-muted-foreground uppercase mt-0.5">{report.inspector?.info}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-[8px] uppercase font-bold">{report.sectors?.length} Setores</Badge>
                  <Badge variant="outline" className="text-[8px] uppercase font-bold">{report.specialSchedule?.length} Esc. Especial</Badge>
                  <Badge variant="outline" className="text-[8px] uppercase font-bold">{report.overtime?.length} Horas Exc.</Badge>
                </div>
                <div className="flex items-center justify-end gap-2">
                  {report.status === 'EM REVISÃO' && report.createdBy === currentUser?.uid && (
                    <Button onClick={() => loadReportForCorrection(report)} size="sm" className="h-9 px-4 bg-amber-600 hover:bg-amber-700 text-white font-black uppercase text-[10px] gap-2 rounded-xl">
                      <RotateCcw className="h-4 w-4" /> Corrigir
                    </Button>
                  )}
                  {report.status === 'ARQUIVADO' && (
                    <Button variant="ghost" size="sm" onClick={() => handlePrintReport(report)} className="h-9 w-9 p-0 text-slate-600 hover:bg-slate-50">
                      <Printer className="h-4 w-4" />
                    </Button>
                  )}
                  {canDelete && report.status === 'ARQUIVADO' && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => { setReportToDelete(report); setIsDeleteDialogOpen(true); }} 
                      className="h-9 w-9 p-0 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-blue-600 hover:bg-blue-50">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
                      <DialogHeader className="bg-primary p-6 text-white shrink-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm"><FileText className="h-6 w-6" /></div>
                            <div>
                              <DialogTitle className="text-xl font-black uppercase tracking-tight leading-none">Detalhamento Operacional</DialogTitle>
                              <p className="text-[10px] font-bold uppercase opacity-80 tracking-widest mt-1">DATA: {formatDateBR(report.date)} • {report.escalaName} • STATUS: {report.status}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {canManage && report.status === 'PENDENTE' && (
                              <>
                                <Button onClick={() => { setReportToReturn(report); setIsReturnDialogOpen(true); }} size="sm" variant="ghost" className="text-white hover:bg-white/10 font-black uppercase text-[10px] h-9 border border-white/20">
                                  <ArrowRight className="h-4 w-4 mr-2" /> Devolver
                                </Button>
                                <Button onClick={() => handleArchiveReport(report.id)} size="sm" className="bg-green-500 hover:bg-green-600 text-white font-black uppercase text-[10px] h-9 gap-2 shadow-lg shadow-green-900/20">
                                  <CheckCircle2 className="h-4 w-4" /> Homologar
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </DialogHeader>
                      <ScrollArea className="max-h-[70vh]">
                        <div className="p-6 space-y-8 pb-12">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Inspetor / Responsável</Label>
                              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <p className="text-sm font-black uppercase">{report.inspector?.name} ({report.inspector?.qra})</p>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase mt-0.5">{report.inspector?.info}</p>
                              </div>
                            </div>
                            {report.subinspectors?.length > 0 && (
                              <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Subinspetoria</Label>
                                <div className="space-y-2">
                                  {report.subinspectors.map((sub: any, idx: number) => (
                                    <div key={idx} className="p-2 bg-slate-50/50 rounded-lg border border-slate-100 flex justify-between items-center">
                                      <span className="text-[11px] font-black uppercase">{sub.name} ({sub.qra})</span>
                                      <Badge variant="outline" className="text-[8px] font-bold">{sub.info}</Badge>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="space-y-4">
                            <div className="flex items-center gap-2 border-b pb-2">
                              <Users className="h-4 w-4 text-blue-600" />
                              <h4 className="text-xs font-black uppercase text-slate-900 tracking-widest">COMPOSIÇÃO DAS GUARNIÇÕES</h4>
                            </div>
                            <div className="space-y-6">
                              {report.sectors?.map((sector: any, sIdx: number) => (
                                <div key={sIdx} className="space-y-3 bg-slate-50/30 p-4 rounded-2xl border border-slate-100 shadow-inner">
                                  <div className="flex items-center justify-between">
                                    <Badge className="bg-blue-600 text-white font-black uppercase text-[10px] px-3">{sector.sectorType}</Badge>
                                    <span className="text-[10px] font-black uppercase text-slate-600">CHEFE: {sector.chief?.name} ({sector.chief?.qra})</span>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {sector.posts?.map((post: any, pIdx: number) => (
                                      <div key={pIdx} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm space-y-2">
                                        <div className="flex items-center justify-between border-b pb-1">
                                          <span className="text-[9px] font-black uppercase text-slate-500">{post.type} {post.vtrNumber ? `• VTR ${post.vtrNumber}` : ""}</span>
                                          <Badge variant="outline" className="text-[8px] font-bold">{post.members?.length} INTEGRANTES</Badge>
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                          {post.members?.map((m: any, mIdx: number) => (
                                            <Badge key={mIdx} variant="secondary" className="text-[9px] font-bold bg-slate-100 text-slate-700 uppercase">{m.qra}</Badge>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                              <div className="flex items-center gap-2 border-b pb-2">
                                <UserX className="h-4 w-4 text-red-600" />
                                <h4 className="text-xs font-black uppercase text-slate-900 tracking-widest">AUSÊNCIAS E FALTAS</h4>
                              </div>
                              <div className="space-y-2">
                                {report.absentTodayList?.map((aus: any, idx: number) => (
                                  <div key={`af-${idx}`} className="p-2 bg-slate-50 rounded-lg border border-slate-100 flex justify-between items-center">
                                    <div className="flex flex-col">
                                      <span className="text-[11px] font-black uppercase text-slate-900">{aus.name} ({aus.qra})</span>
                                      <span className="text-[9px] font-bold text-muted-foreground uppercase">{aus.escala} / {aus.turno}</span>
                                      {aus.startDate && aus.endDate && (
                                        <span className="text-[8px] font-black text-blue-600 uppercase mt-0.5">
                                          Período: {formatDateBR(aus.startDate)} à {formatDateBR(aus.endDate)}
                                        </span>
                                      )}
                                    </div>
                                    <Badge variant="secondary" className="text-[8px] font-bold uppercase">{aus.type}</Badge>
                                  </div>
                                ))}
                                {report.absences?.map((aus: any, idx: number) => (
                                  <div key={`ms-${idx}`} className="p-2 bg-red-50/30 rounded-lg border border-red-100 flex justify-between items-center">
                                    <div className="flex flex-col">
                                      <span className="text-[11px] font-black uppercase text-red-900">{aus.name} ({aus.qra})</span>
                                      <span className="text-[9px] font-bold text-red-700/70 uppercase">{aus.info}</span>
                                    </div>
                                    <Badge variant="outline" className="text-[8px] border-red-200 text-red-700 font-bold">FALTA</Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="space-y-8">
                              {report.specialSchedule?.length > 0 && (
                                <div className="space-y-4">
                                  <div className="flex items-center gap-2 border-b pb-2">
                                    <Star className="h-4 w-4 text-amber-600" />
                                    <h4 className="text-xs font-black uppercase text-slate-900 tracking-widest">ESCALA ESPECIAL</h4>
                                  </div>
                                  <div className="space-y-2">
                                    {report.specialSchedule.map((esp: any, idx: number) => (
                                      <div key={idx} className="p-2 bg-amber-50/30 rounded-lg border border-amber-100 flex justify-between items-center">
                                        <div className="flex flex-col">
                                          <span className="text-[11px] font-black uppercase text-slate-900">{esp.name} ({esp.qra})</span>
                                          <span className="text-[9px] font-bold text-muted-foreground uppercase">{esp.info}</span>
                                          <span className="text-[10px] font-black text-amber-600 uppercase mt-1">{esp.periodName}</span>
                                        </div>
                                        <Badge variant="outline" className="text-[8px] border-amber-200 text-amber-700 font-bold">ESPECIAL</Badge>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {report.overtime?.length > 0 && (
                                <div className="space-y-4">
                                  <div className="flex items-center gap-2 border-b pb-2">
                                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                                    <h4 className="text-xs font-black uppercase text-slate-900 tracking-widest">HORAS EXCEDENTES</h4>
                                  </div>
                                  <div className="space-y-2">
                                    {report.overtime.map((o: any, idx: number) => (
                                      <div key={idx} className="p-2 bg-emerald-50 rounded-lg border border-emerald-100 flex justify-between items-center">
                                        <div className="flex flex-col">
                                          <span className="text-[11px] font-black uppercase text-emerald-900">{o.name} ({o.qra})</span>
                                          <span className="text-[8px] font-bold text-emerald-600 uppercase">PERÍODO: {o.shiftEnd} AS {o.overtimeEnd}</span>
                                        </div>
                                        <Badge className="bg-emerald-600 text-white font-mono font-black text-[10px]">{o.total}H</Badge>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {renderAuditHistory(report.auditHistory || [])}

                          <div className="space-y-4">
                            <div className="flex items-center gap-2 border-b pb-2">
                              <MessageSquare className="h-4 w-4 text-slate-600" />
                              <h4 className="text-xs font-black uppercase text-slate-900 tracking-widest">RELATO DE OCORRÊNCIAS</h4>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 italic text-[11px] text-slate-700 uppercase leading-relaxed whitespace-pre-wrap">
                              {report.observations || "NENHUMA OCORRÊNCIA REGISTRADA."}
                            </div>
                          </div>
                        </div>
                      </ScrollArea>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12 print:p-0">
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4 portrait; margin: 1.5cm; }
          
          body, main, [data-sidebar="inset"], .flex-1 { 
            overflow: visible !important; 
            height: auto !important; 
            display: block !important;
            background: white !important;
          }

          .print-hidden, .print-hidden *, header, nav, footer, button, .tabs-list {
            display: none !important;
          }

          .printable-report {
            display: block !important;
            width: 100% !important;
            color: black !important;
          }

          .report-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 1rem;
          }

          .report-table th, .report-table td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
            font-size: 10px;
            text-transform: uppercase;
          }

          .report-table th {
            background-color: #f8f9fa !important;
            -webkit-print-color-adjust: exact;
            font-weight: bold;
          }

          .signature-section {
            margin-top: 5cm !important;
            display: flex !important;
            justify-content: space-around !important;
            page-break-inside: avoid !important;
            clear: both !important;
          }

          .sig-box {
            text-align: center;
            width: 250px;
            border-top: 1px solid black !important;
            padding-top: 8px;
            font-size: 10px;
            font-weight: bold;
            text-transform: uppercase;
          }

          .section-title {
            background-color: #eee !important;
            -webkit-print-color-adjust: exact;
            padding: 4px 8px;
            font-weight: black;
            font-size: 11px;
            text-transform: uppercase;
            margin: 1rem 0 0.5rem 0;
            border-left: 4px solid #000;
          }
        }
      ` }} />

      <div className="hidden printable-report">
        {reportToPrint && (
          <div className="space-y-6">
            <div className="flex justify-between items-end border-b-2 border-black pb-4">
              <div>
                <h1 className="text-xl font-black uppercase tracking-tight">GUARDA MUNICIPAL DE VILA VELHA</h1>
                <p className="text-sm font-bold uppercase">NÚCLEO DE RECURSOS HUMANOS - NRH</p>
                <h2 className="text-lg font-black uppercase mt-2">Relatório Operacional Diário</h2>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase">Data: {formatDateBR(reportToPrint.date)}</p>
                <p className="text-[10px] font-bold uppercase">Hora: {reportToPrint.time}</p>
                <p className="text-[10px] font-bold uppercase">Escala: {reportToPrint.escalaName}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border p-3 rounded">
              <div>
                <p className="text-[9px] font-bold text-slate-500 uppercase">Inspetor Responsável</p>
                <p className="text-xs font-black uppercase">{reportToPrint.inspector?.name} ({reportToPrint.inspector?.qra})</p>
                <p className="text-[10px] font-medium uppercase">{reportToPrint.inspector?.info}</p>
              </div>
              <div>
                <p className="text-[9px] font-bold text-slate-500 uppercase">Subinspetoria</p>
                {reportToPrint.subinspectors?.map((s: any, i: number) => (
                  <p key={i} className="text-xs font-bold uppercase">{s.name} ({s.qra})</p>
                ))}
              </div>
            </div>

            <div>
              <div className="section-title">Composição de Guarnições</div>
              {reportToPrint.sectors?.map((sector: any, sIdx: number) => (
                <div key={sIdx} className="mb-4 border rounded p-2">
                  <div className="flex justify-between border-b pb-1 mb-2">
                    <span className="text-[10px] font-black uppercase">{sector.sectorType}</span>
                    <span className="text-[10px] font-bold uppercase">Chefe: {sector.chief?.name} ({sector.chief?.qra})</span>
                  </div>
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th className="w-1/3">Posto / Serviço</th>
                        <th>Integrantes (QRA)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sector.posts?.map((post: any, pIdx: number) => (
                        <tr key={pIdx}>
                          <td>{post.type} {post.vtrNumber ? `• VTR ${post.vtrNumber}` : ""}</td>
                          <td>{post.members?.map((m: any) => m.qra).join(", ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="section-title">Ausências e Faltas</div>
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Servidor</th>
                      <th>Tipo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportToPrint.absentTodayList?.map((aus: any, i: number) => (
                      <tr key={i}>
                        <td>
                          <div className="font-black">{aus.name} ({aus.qra}){getEmployeeShiftInfo(aus.id)}</div>
                          {aus.startDate && aus.endDate && (
                            <div className="text-[8px] mt-0.5 opacity-70">
                              PERÍODO: {formatDateBR(aus.startDate)} À {formatDateBR(aus.endDate)}
                            </div>
                          )}
                        </td>
                        <td>{aus.type}</td>
                      </tr>
                    ))}
                    {reportToPrint.absences?.map((aus: any, i: number) => (
                      <tr key={i}>
                        <td>{aus.name} ({aus.qra}){getEmployeeShiftInfo(aus.id)}</td>
                        <td>FALTA</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <div className="section-title">Escala Especial / Horas Exc.</div>
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>Servidor</th>
                      <th>Informação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportToPrint.specialSchedule?.map((esp: any, i: number) => (
                      <tr key={i}>
                        <td>{esp.name} ({esp.qra}){getEmployeeShiftInfo(esp.id)}</td>
                        <td>{esp.periodName}</td>
                      </tr>
                    ))}
                    {reportToPrint.overtime?.map((o: any, i: number) => (
                      <tr key={i}>
                        <td>{o.name} ({o.qra}){getEmployeeShiftInfo(o.id)}</td>
                        <td>EXCEDENTE: {o.total}H</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <div className="section-title">Relato de Ocorrências</div>
              <div className="p-3 border rounded text-[10px] uppercase italic whitespace-pre-wrap leading-relaxed">
                {reportToPrint.observations || "NENHUMA OCORRÊNCIA REGISTRADA."}
              </div>
            </div>

            <div className="signature-section">
              <div className="sig-box">
                <p>{reportToPrint.inspector?.name}</p>
                <p>Inspetor do Turno</p>
              </div>
              <div className="sig-box">
                <p>NÚCLEO DE RH - GMVV</p>
                <p>Homologação / Conferência</p>
              </div>
            </div>

            <div className="mt-8 text-[8px] text-slate-400 uppercase text-center border-t pt-2">
              Gerado pelo Sistema NRH-GMVV em {new Date().toLocaleString('pt-BR')}
            </div>
          </div>
        )}
      </div>

      <div className="print-hidden">
        <Dialog open={isDraftDialogOpen} onOpenChange={setIsDraftDialogOpen}>
          <DialogContent className="rounded-2xl border-none shadow-2xl">
            <DialogHeader>
              <div className="bg-amber-50 w-12 h-12 rounded-full flex items-center justify-center mb-4"><History className="h-6 w-6 text-amber-600" /></div>
              <DialogTitle className="uppercase text-xl font-black">Rascunho Identificado</DialogTitle>
              <DialogDescription className="uppercase text-[10px] font-bold text-muted-foreground leading-relaxed">EXISTE UM RELATÓRIO SALVO NO NAVEGADOR. DESEJA CARREGAR OU INICIAR UM NOVO?</DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-6 gap-2">
              <AlertDialogCancel onClick={() => { localStorage.removeItem('nrg_relatorio_draft'); setIsDraftDialogOpen(false); }} className="h-12 uppercase font-black text-xs tracking-widest border-red-100 text-red-600 hover:bg-red-50">DESCARTAR</AlertDialogCancel>
              <AlertDialogAction onClick={() => { 
                if (tempDraft) {
                  setDefaultDate(tempDraft.defaultDate); setDefaultTime(tempDraft.defaultTime); setSelectedEscalaId(tempDraft.selectedEscalaId);
                  setInspetorTerm(tempDraft.inspetorTerm); setInspetorId(tempDraft.inspetorId); setInspetorInfo(tempDraft.inspetorInfo);
                  setSubinspetorRows(tempDraft.subinspetorRows); setFaltaRows(tempDraft.faltaRows); setEspecialRows(tempDraft.especialRows);
                  setOvertimeRows(tempDraft.overtimeRows || [{ id: generateId(), term: "", empId: "", show: false, shiftEnd: "", overtimeEnd: "", total: "" }]);
                  setSectorBlocks(tempDraft.sectorBlocks); setObservations(tempDraft.observations); setIsDraftDialogOpen(false);
                }
              }} className="h-12 uppercase font-black text-xs tracking-widest bg-amber-600 hover:bg-amber-700 shadow-xl shadow-amber-100">CARREGAR</AlertDialogAction>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent className="rounded-2xl border-none shadow-2xl">
            <AlertDialogHeader>
              <div className="bg-red-50 w-12 h-12 rounded-full flex items-center justify-center mb-4"><Trash2 className="h-6 w-6 text-red-600" /></div>
              <AlertDialogTitle className="uppercase text-xl font-black">Excluir Relatório?</AlertDialogTitle>
              <AlertDialogDescription className="uppercase text-[10px] font-bold text-muted-foreground leading-relaxed">ESTA AÇÃO É IRREVERSÍVEL. O RELATÓRIO SERÁ REMOVIDO PERMANENTEMENTE DO ARQUIVO HISTÓRICO.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-6 gap-2">
              <AlertDialogCancel onClick={() => { setIsDeleteDialogOpen(false); setReportToDelete(null); }} className="h-12 uppercase font-black text-xs tracking-widest">CANCELAR</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteReport} className="h-12 uppercase font-black text-xs tracking-widest bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-100">EXCLUIR PERMANENTEMENTE</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={isFormItemDeleteDialogOpen} onOpenChange={setIsFormItemDeleteDialogOpen}>
          <AlertDialogContent className="rounded-2xl border-none shadow-2xl">
            <AlertDialogHeader>
              <div className="bg-red-50 w-12 h-12 rounded-full flex items-center justify-center mb-4"><Trash2 className="h-6 w-6 text-red-600" /></div>
              <AlertDialogTitle className="uppercase text-xl font-black">Confirmar Remoção</AlertDialogTitle>
              <AlertDialogDescription className="uppercase text-[10px] font-bold text-muted-foreground leading-relaxed">
                VOCÊ TEM CERTEZA QUE DESEJA REMOVER {formItemToDelete?.label}? OS DADOS INFORMADOS SERÃO PERDIDOS.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-6 gap-2">
              <AlertDialogCancel className="uppercase text-xs font-bold rounded-xl h-11 border-none bg-slate-100 text-slate-600 hover:bg-slate-200">CANCELAR</AlertDialogCancel>
              <AlertDialogAction onClick={executeFormItemDelete} className="h-12 uppercase font-black text-xs tracking-widest bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-100">REMOVER ITEM</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={isReturnDialogOpen} onOpenChange={setIsReturnDialogOpen}>
          <DialogContent className="rounded-2xl border-none shadow-2xl p-6">
            <DialogHeader>
              <div className="bg-red-50 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                <RotateCcw className="h-6 w-6 text-red-600" />
              </div>
              <DialogTitle className="uppercase text-xl font-black">Devolver para Correção</DialogTitle>
              <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Informe o motivo da devolução para que o servidor possa realizar os acertos.</p>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-700">Observação de Auditoria</Label>
                <Textarea 
                  placeholder="EX: FALTA INTEGRANTE NA VTR 001, ESCALA ESPECIAL INCORRETA..." 
                  className="min-h-[120px] uppercase text-xs p-4 bg-slate-50 border-slate-200" 
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value.toUpperCase())}
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button variant="ghost" onClick={() => setIsReturnDialogOpen(false)} className="h-12 uppercase font-black text-xs tracking-widest flex-1">Cancelar</Button>
              <Button onClick={handleReturnReport} disabled={!returnReason} className="h-12 uppercase font-black text-xs tracking-widest bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-100 flex-1">Confirmar Devolução</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col gap-2 print-hidden">
        <div className="flex items-center gap-3">
          <div className="bg-blue-50 p-2 rounded-xl"><FileText className="h-6 w-6 text-blue-600" /></div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight uppercase text-primary">AUDITORIA DE TURNOS</h2>
            <p className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest">GESTÃO INTEGRAL DE RELATÓRIOS OPERACIONAIS.</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full print-hidden">
        <TabsList className="grid w-full grid-cols-3 lg:w-[600px] h-12 bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="new" className="rounded-lg uppercase text-[10px] font-bold flex items-center gap-2">
            {editingReportId ? <RotateCcw className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />} 
            {editingReportId ? "CORRIGIR RELATÓRIO" : "NOVO RELATÓRIO"}
          </TabsTrigger>
          <TabsTrigger value="sent" className="rounded-lg uppercase text-[10px] font-bold flex items-center gap-2">
            <ClipboardList className="h-3.5 w-3.5" /> ENVIADOS
            {pendingReports?.length > 0 && <Badge className="ml-1.5 h-4 w-4 p-0 flex items-center justify-center bg-primary text-primary-foreground text-[8px] rounded-full">{pendingReports.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="archived" className="rounded-lg uppercase text-[10px] font-bold flex items-center gap-2">
            <Archive className="h-3.5 w-3.5" /> ARQUIVO
            {archivedReports?.length > 0 && (
              <Badge className="ml-1.5 h-4 w-4 p-0 flex items-center justify-center bg-green-600 text-white text-[8px] rounded-full">
                {archivedReports.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="mt-6 space-y-6">
          {inReviewReports?.filter(r => r.createdBy === currentUser?.uid).map(report => (
            <Card key={report.id} className="border-amber-200 bg-amber-50/50 shadow-sm rounded-2xl animate-in zoom-in-95 duration-300">
              <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="bg-amber-100 p-2 rounded-xl border border-amber-200"><AlertTriangle className="h-5 w-5 text-amber-600" /></div>
                  <div>
                    <p className="text-[11px] font-black uppercase text-amber-900 tracking-tight leading-none">Relatório Devolvido para Ajustes</p>
                    <p className="text-[10px] font-bold text-amber-700 uppercase mt-1 leading-relaxed">MOTIVO: {report.lastReturnReason}</p>
                  </div>
                </div>
                <Button onClick={() => loadReportForCorrection(report)} size="sm" className="h-10 bg-amber-600 hover:bg-amber-700 text-white font-black uppercase text-[10px] gap-2 rounded-xl px-6 shadow-lg shadow-amber-900/10">
                  <RotateCcw className="h-4 w-4" /> CARREGAR PARA CORREÇÃO
                </Button>
              </CardContent>
            </Card>
          ))}

          <Card className="card-shadow border-none rounded-2xl overflow-hidden">
            <form onSubmit={handleSubmit}>
              <CardHeader className={cn("border-b p-6 transition-colors", editingReportId ? "bg-amber-50/50" : "bg-primary/5")}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl font-black uppercase text-slate-900 tracking-tight">{editingReportId ? "CORREÇÃO DE RELATÓRIO" : "RELATÓRIO OPERACIONAL"}</CardTitle>
                    <CardDescription className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Preenchimento integral para conferência do RH.</CardDescription>
                  </div>
                  {editingReportId && (
                    <Button type="button" variant="outline" onClick={resetForm} className="h-9 uppercase text-[10px] font-black border-amber-200 text-amber-700 hover:bg-amber-50">
                      <X className="h-4 w-4 mr-2" /> Cancelar Correção
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                      <Calendar className="h-3 w-3" /> Data
                    </Label>
                    <input 
                      type="date" 
                      value={defaultDate} 
                      min={editingReportId ? undefined : dateLimits.min}
                      max={dateLimits.max}
                      onChange={(e) => setDefaultDate(e.target.value)} 
                      className="h-11 font-bold text-xs bg-slate-50/50 focus:bg-white transition-colors border rounded-md px-3 outline-none w-full" 
                      required 
                    />
                  </div>
                  <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-2"><Clock className="h-3 w-3" /> Horário</Label><input type="time" value={defaultTime} onChange={(e) => setDefaultTime(e.target.value)} className="h-11 font-bold text-xs bg-slate-50/50 focus:bg-white transition-colors border rounded-md px-3 outline-none w-full" required /></div>
                  <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest flex items-center gap-2"><Briefcase className="h-3 w-3" /> Escala de Serviço</Label>
                    <Select value={selectedEscalaId} onValueChange={setSelectedEscalaId} required><SelectTrigger className="h-11 uppercase text-xs font-bold bg-slate-50/50"><SelectValue placeholder="SELECIONE..." /></SelectTrigger>
                      <SelectContent>{regularPeriodsList?.map((p: any) => (<SelectItem key={p.id} value={p.id} className="uppercase text-xs font-bold">{p.escalaName} ({p.startTime} AS {p.endTime})</SelectItem>))}</SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {renderAutocomplete("Inspetor / Responsável", inspetorTerm, setInspetorTerm, setInspetorId, inspetorId, showInspetorSuggestions, setShowInspetorSuggestions, setInspetorInfo, chefiaList, [...trulyAbsentIds, ...subTeamIds.filter(id => id !== inspetorId)])}
                  <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Escala e Turno (Inspetor)</Label><Input value={inspetorInfo} readOnly placeholder="--" className="h-11 uppercase font-bold text-xs bg-muted/30 border-dashed cursor-not-allowed text-primary" /></div>
                </div>

                <Collapsible open={isSubTeamOpen} onOpenChange={setIsSubTeamOpen} className="space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                      <CollapsibleTrigger asChild><button type="button" className={cn("p-2 rounded-xl transition-colors border shadow-sm", subTeamFilled ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-red-50 text-red-500 border-red-100")}><User className="h-5 w-5" /></button></CollapsibleTrigger>
                      <div className="flex flex-col"><h4 className="text-sm font-black uppercase text-slate-700 tracking-widest leading-none">Subinspetoria</h4><span className="text-[9px] font-bold text-muted-foreground uppercase mt-1 tracking-tighter">{subTeamFilled ? "SESSÃO PREENCHIDA" : "AGUARDANDO DADOS"}</span></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={addSubinspetorRow} className="h-8 text-[10px] font-black uppercase gap-1.5 rounded-xl border-primary/20 text-primary hover:bg-primary/5"><Plus className="h-3.5 w-3.5" /> ADICIONAR</Button>
                      <CollapsibleTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">{isSubTeamOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</Button></CollapsibleTrigger>
                    </div>
                  </div>
                  <CollapsibleContent className="space-y-4">
                    {subinspetorRows.map((row, index) => (
                      <div key={row.id} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-4 items-end animate-in fade-in slide-in-from-top-2 duration-300">
                        {renderAutocomplete("Subinspetor", row.term, (v) => updateSubinspetorRow(index, { term: v }), (v) => updateSubinspetorRow(index, { empId: v }), row.empId, row.show, (v) => updateSubinspetorRow(index, { show: v }), (v) => updateSubinspetorRow(index, { info: v }), chefiaList, [...trulyAbsentIds, ...subTeamIds.filter(id => id !== row.empId)])}
                        <div className="w-full space-y-1.5"><Label className="text-[10px] font-bold uppercase text-muted-foreground">Escala e Turno</Label><Input value={row.info} readOnly placeholder="--" className="h-11 uppercase font-bold text-xs bg-muted/30 border-dashed cursor-not-allowed text-primary" /></div>
                        <Button type="button" variant="ghost" size="icon" onClick={() => confirmFormItemDelete('subinspetor', 'ESTE SUBINSPETOR', { index })} className="h-11 w-11 text-destructive hover:bg-red-50 rounded-xl"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>

                <Collapsible open={isAfastadosOpen} onOpenChange={setIsAfastadosOpen} className="space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                      <CollapsibleTrigger asChild><button type="button" className={cn("p-2 rounded-xl transition-colors border shadow-sm", afastadosFilled ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-slate-50 text-slate-400 border-slate-100")}><ShieldCheck className="h-5 w-5" /></button></CollapsibleTrigger>
                      <div className="flex flex-col"><h4 className="text-sm font-black uppercase text-slate-700 tracking-widest leading-none">Servidores Ausentes (Oficial)</h4><span className="text-[9px] font-bold text-muted-foreground uppercase mt-1 tracking-tighter">{absentTodayList.length} SERVIDORES LANÇADOS NO SISTEMA RH.</span></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <CollapsibleTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">{isAfastadosOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</Button></CollapsibleTrigger>
                    </div>
                  </div>
                  <CollapsibleContent className="animate-in slide-in-from-top-4 duration-500">
                    {absentTodayList.length === 0 ? (
                      <div className="p-8 border-2 border-dashed rounded-2xl text-center bg-slate-50/30">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold italic">Nenhuma ausência oficial para esta data/turno.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {absentTodayList.map((aus, idx) => {
                          const type = normalizeStr(aus.type);
                          const isVacation = type.includes("FERIAS");
                          const isMedical = type.includes("ATESTADO");
                          const isLeave = type.includes("LICENCA");
                          
                          return (
                            <div key={idx} className="p-3 rounded-xl border border-slate-100 bg-white shadow-sm flex items-center gap-3">
                              <div className={cn(
                                "p-2 rounded-lg shrink-0",
                                isVacation ? "bg-blue-50 text-blue-600" :
                                isMedical ? "bg-red-50 text-red-600" :
                                isLeave ? "bg-purple-50 text-purple-600" : "bg-orange-50 text-orange-600"
                              )}>
                                {isVacation ? <Plane className="h-4 w-4" /> : isMedical ? <Stethoscope className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-black uppercase text-slate-900 truncate">{aus.employeeName}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[9px] font-bold text-muted-foreground uppercase">QRA: {aus.employeeQra}</span>
                                  <Badge variant="outline" className={cn(
                                    "text-[8px] font-black uppercase px-1.5 h-4 border-none",
                                    isVacation ? "bg-blue-600 text-white" :
                                    isMedical ? "bg-red-600 text-white" :
                                    isLeave ? "bg-purple-600 text-white" :
                                    "bg-orange-50 text-white"
                                  )}>{aus.type}</Badge>
                                </div>
                                <div className="flex flex-col mt-1">
                                  <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter leading-tight">
                                    {aus.escala} / {aus.turno}
                                  </span>
                                  {aus.startDate && aus.endDate && (
                                    <span className="text-[8px] font-black text-blue-600 uppercase mt-0.5 leading-tight">
                                      Período: {formatDateBR(aus.startDate)} à {formatDateBR(aus.endDate)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div className="mt-4 bg-blue-50/50 p-3 rounded-xl border border-blue-100 flex items-start gap-3">
                      <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                      <p className="text-[10px] text-blue-800 font-medium uppercase leading-relaxed">Estes dados são extraídos automaticamente da escala oficial de RH. Servidores nesta lista não podem ser escalados no turno.</p>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Collapsible open={isAbsencesOpen} onOpenChange={setIsAbsencesOpen} className="space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                      <CollapsibleTrigger asChild><button type="button" className={cn("p-2 rounded-xl transition-colors border shadow-sm", absencesFilled ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-red-50 text-red-500 border-red-100")}><UserX className="h-5 w-5" /></button></CollapsibleTrigger>
                      <div className="flex flex-col"><h4 className="text-sm font-black uppercase text-slate-700 tracking-widest leading-none">Faltas do Turno</h4><span className="text-[9px] font-bold text-muted-foreground uppercase mt-1 tracking-tighter">{absencesFilled ? "SESSÃO PREENCHIDA" : "NENHUMA FALTA"}</span></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={addFaltaRow} className="h-8 text-[10px] font-black uppercase gap-1.5 rounded-xl border-red-200 text-red-600 hover:bg-red-50"><Plus className="h-3.5 w-3.5" /> ADICIONAR</Button>
                      <CollapsibleTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">{isAbsencesOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</Button></CollapsibleTrigger>
                    </div>
                  </div>
                  <CollapsibleContent className="space-y-4">
                    {faltaRows.map((row, index) => (
                      <div key={row.id} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-4 items-end animate-in fade-in slide-in-from-top-2 duration-300">
                        {renderAutocomplete("Servidor (Falta)", row.term, (v) => updateFaltaRow(index, { term: v }), (v) => updateFaltaRow(index, { empId: v }), row.empId, row.show, (v) => updateFaltaRow(index, { show: v }), (v) => updateFaltaRow(index, { info: v }), allEmployees || [], [...trulyAbsentIds.filter(id => id !== row.empId), ...subTeamIds, ...teamMemberIds])}
                        <div className="w-full space-y-1.5"><Label className="text-[10px] font-bold uppercase text-muted-foreground">Escala e Turno</Label><Input value={row.info} readOnly placeholder="--" className="h-11 uppercase font-bold text-xs bg-muted/30 border-dashed cursor-not-allowed text-primary" /></div>
                        <Button type="button" variant="ghost" size="icon" onClick={() => confirmFormItemDelete('falta', 'ESTE REGISTRO DE FALTA', { index })} className="h-11 w-11 text-destructive hover:bg-red-50 rounded-xl"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>

                <Collapsible open={isEspecialOpen} onOpenChange={setIsEspecialOpen} className="space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                      <CollapsibleTrigger asChild><button type="button" className={cn("p-2 rounded-xl transition-colors border shadow-sm", especialFilled ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-red-50 text-red-500 border-red-100")}><Star className="h-5 w-5" /></button></CollapsibleTrigger>
                      <div className="flex flex-col"><h4 className="text-sm font-black uppercase text-slate-700 tracking-widest leading-none">Escala Especial</h4><span className="text-[9px] font-bold text-muted-foreground uppercase mt-1 tracking-tighter">{especialFilled ? "SESSÃO PREENCHIDA" : "NENHUM SERVIDOR"}</span></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={addEspecialRow} className="h-8 text-[10px] font-black uppercase gap-1.5 rounded-xl border-primary/20 text-primary hover:bg-primary/5"><Plus className="h-3.5 w-3.5" /> ADICIONAR</Button>
                      <CollapsibleTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">{isEspecialOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</Button></CollapsibleTrigger>
                    </div>
                  </div>
                  <CollapsibleContent className="space-y-6">
                    {especialRows.map((row, index) => (
                      <div key={row.id} className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_auto] gap-4 items-end bg-slate-50/30 p-4 rounded-xl border border-dashed border-slate-200">
                        {renderAutocomplete("Servidor", row.term, (v) => updateEspecialRow(index, { term: v }), (v) => updateEspecialRow(index, { empId: v }), row.empId, row.show, (v) => updateEspecialRow(index, { show: v }), (v) => updateEspecialRow(index, { info: v }), allEmployees || [], [...trulyAbsentIds, ...especialRows.map(r => r.empId).filter(id => id !== row.empId)])}
                        <div className="w-full space-y-1.5"><Label className="text-[10px] font-bold uppercase text-muted-foreground">Escala e Turno</Label><Input value={row.info} readOnly placeholder="--" className="h-11 uppercase font-bold text-xs bg-white border-dashed cursor-not-allowed" /></div>
                        <div className="w-full space-y-1.5"><Label className="text-[10px] font-bold uppercase text-muted-foreground flex items-center gap-2"><Timer className="h-3 w-3" /> Horário Especial</Label>
                          <Select value={row.periodId} onValueChange={(v) => updateEspecialRow(index, { periodId: v })}><SelectTrigger className="h-11 uppercase text-[9px] font-bold bg-white"><SelectValue placeholder="SELECIONE..." /></SelectTrigger>
                            <SelectContent>{specialPeriodsList.map((p: any) => (<SelectItem key={p.id} value={p.id} className="uppercase text-[9px] font-bold">{p.escalaName} ({p.startTime} AS {p.endTime})</SelectItem>))}</SelectContent>
                          </Select>
                        </div>
                        <Button type="button" variant="ghost" size="icon" onClick={() => confirmFormItemDelete('especial', 'ESTE REGISTRO DE ESCALA ESPECIAL', { index })} className="h-11 w-11 text-destructive hover:bg-red-50 rounded-xl"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>

                <Collapsible open={isOvertimeOpen} onOpenChange={setIsOvertimeOpen} className="space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                      <CollapsibleTrigger asChild><button type="button" className={cn("p-2 rounded-xl transition-colors border shadow-sm", overtimeFilled ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-red-50 text-red-500 border-red-100")}><TrendingUp className="h-5 w-5" /></button></CollapsibleTrigger>
                      <div className="flex flex-col"><h4 className="text-sm font-black uppercase text-slate-700 tracking-widest leading-none">Horas Excedentes</h4><span className="text-[9px] font-bold text-muted-foreground uppercase mt-1 tracking-tighter">{overtimeFilled ? "SESSÃO PREENCHIDA" : "NENHUM LANÇAMENTO"}</span></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={addOvertimeRow} className="h-8 text-[10px] font-black uppercase gap-1.5 rounded-xl border-primary/20 text-primary hover:bg-primary/5"><Plus className="h-3.5 w-3.5" /> ADICIONAR</Button>
                      <CollapsibleTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">{isOvertimeOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</Button></CollapsibleTrigger>
                    </div>
                  </div>
                  <CollapsibleContent className="space-y-4">
                    {overtimeRows.map((row, index) => (
                      <div key={row.id} className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 items-end bg-slate-50/20 p-4 rounded-xl border border-dashed border-slate-200 animate-in fade-in slide-in-from-top-2 duration-300">
                        {renderAutocomplete("Servidor", row.term, (v) => updateOvertimeRow(index, { term: v }), (v) => updateOvertimeRow(index, { empId: v }), row.empId, row.show, (v) => updateOvertimeRow(index, { show: v }), () => {}, allEmployees || [], [...trulyAbsentIds, ...overtimeRows.map(r => r.empId).filter(id => id !== row.empId)])}
                        
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold uppercase text-muted-foreground">Fim Escala</Label>
                          <Input 
                            placeholder="00:00" 
                            className="h-11 text-center font-mono font-bold bg-white" 
                            value={row.shiftEnd} 
                            onChange={(e) => updateOvertimeRow(index, { shiftEnd: applyTimeMask(e.target.value) })}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold uppercase text-muted-foreground">Fim Excedente</Label>
                          <Input 
                            placeholder="00:00" 
                            className="h-11 text-center font-mono font-bold bg-white" 
                            value={row.overtimeEnd} 
                            onChange={(e) => updateOvertimeRow(index, { overtimeEnd: applyTimeMask(e.target.value) })}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold uppercase text-muted-foreground">Total</Label>
                          <div className="h-11 flex items-center justify-center px-3 rounded-md border bg-blue-50 text-blue-700 font-mono font-black text-xs">
                            {row.total ? `${row.total}H` : "--:--"}
                          </div>
                        </div>

                        <Button type="button" variant="ghost" size="icon" onClick={() => confirmFormItemDelete('overtime', 'ESTE REGISTRO DE HORA EXCEDENTE', { index })} className="h-11 w-11 text-destructive hover:bg-red-50 rounded-xl"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>

                <Collapsible open={isTeamOpen} onOpenChange={setIsTeamOpen} className="space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-3">
                      <CollapsibleTrigger asChild><button type="button" className={cn("p-2 rounded-xl transition-colors border shadow-sm", teamFilled ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-red-50 text-red-500 border-red-100")}><Users className="h-5 w-5" /></button></CollapsibleTrigger>
                      <div className="flex flex-col"><h4 className="text-sm font-black uppercase text-slate-700 tracking-widest leading-none">Equipe do Turno</h4><span className="text-[9px] font-bold text-muted-foreground uppercase mt-1 tracking-tighter">{teamFilled ? "SESSÃO PREENCHIDA" : "AGUARDANDO DADOS"}</span></div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={addSectorBlock} className="h-8 text-[10px] font-black uppercase gap-1.5 rounded-xl border-primary/20 text-primary hover:bg-primary/5"><Plus className="h-3.5 w-3.5" /> ADICIONAR GUARNIÇÃO</Button>
                      <CollapsibleTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">{isTeamOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</Button></CollapsibleTrigger>
                    </div>
                  </div>
                  <CollapsibleContent className="space-y-6">
                    {sectorBlocks.map((sector, sIdx) => (
                      <div key={sector.id} className="relative p-3 rounded-xl border-2 border-slate-100 bg-slate-50/20 space-y-4 animate-in zoom-in-95 duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-4 bg-white p-3 rounded-xl border border-dashed items-end">
                          <div className="space-y-1.5"><Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Setor</Label>
                            <Select value={sector.sectorType} onValueChange={(v) => updateSectorBlock(sIdx, { sectorType: v })}><SelectTrigger className="h-11 uppercase text-xs font-bold bg-slate-50/50"><SelectValue placeholder="SELECIONE..." /></SelectTrigger>
                              <SelectContent><SelectItem value="SETOR 1" className="uppercase text-xs font-bold">SETOR 1</SelectItem><SelectItem value="SETOR 2" className="uppercase text-xs font-bold">SETOR 2</SelectItem><SelectItem value="SETOR 3" className="uppercase text-xs font-bold">SETOR 3</SelectItem><SelectItem value="COVV" className="uppercase text-xs font-bold">COVV</SelectItem></SelectContent>
                            </Select>
                          </div>
                          <div className="w-full">{renderAutocomplete("Chefia Responsável", sector.chiefData.term, (v) => updateSectorChiefData(sIdx, { term: v }), (v) => updateSectorChiefData(sIdx, { id: v }), sector.chiefData.id, sector.chiefData.show, (v) => updateSectorChiefData(sIdx, { show: v }), (v) => updateSectorChiefData(sIdx, { info: v }), availableChiefsForSectors, [])}</div>
                          <Button type="button" variant="ghost" size="icon" onClick={() => confirmFormItemDelete('sector', 'ESTA GUARNIÇÃO COMPLETA', { index: sIdx })} className="h-11 w-11 text-destructive hover:bg-red-50 rounded-xl"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                        <div className="space-y-2">
                          {sector.posts.map((post: any, pIdx: number) => {
                            const normType = normalizeStr(post.type);
                            const isVTR = normType.includes("VTR");
                            const isSmall = normType.includes("MOTO") || normType.includes("QUADRI");
                            const isVehicle = isVTR || isSmall;
                            
                            let limit = 15;
                            if (isVTR) limit = 5;
                            else if (isSmall) limit = 2;

                            return (
                              <div key={post.id} className="space-y-2 bg-white/50 p-3 rounded-xl border border-slate-100 shadow-sm">
                                <div className="flex flex-col md:flex-row items-stretch md:items-end gap-4">
                                  <div className="flex-1 space-y-1.5"><Label className="text-[9px] font-bold uppercase text-muted-foreground">Posto / Serviço</Label>
                                    <Select value={post.type} onValueChange={(v) => { 
                                      const newBlocks = [...sectorBlocks]; 
                                      const p = newBlocks[sIdx].posts[pIdx];
                                      p.type = v; 
                                      const nv = normalizeStr(v);
                                      const checkVTR = nv.includes("VTR");
                                      const checkSmall = nv.includes("MOTO") || nv.includes("QUADRI");
                                      
                                      if (checkSmall && p.members.length > 2) p.members = p.members.slice(0, 2);
                                      else if (checkVTR && p.members.length > 5) p.members = p.members.slice(0, 5); 
                                      
                                      setSectorBlocks(newBlocks); 
                                    }}><SelectTrigger className="h-10 uppercase text-xs font-bold bg-slate-50/50"><SelectValue placeholder="SELECIONE..." /></SelectTrigger>
                                      <SelectContent>
                                        {servicePosts?.map((p: any) => (
                                          <SelectItem key={p.id} value={p.name} className="uppercase text-xs font-bold">
                                            {p.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Button type="button" variant="outline" size="sm" onClick={() => addMemberToPost(sIdx, pIdx)} className="h-10 text-[9px] font-black uppercase border-dashed border-primary/30 text-primary hover:bg-primary/5"><Plus className="h-3.5 w-3.5 mr-1" /> SERVIDOR ({post.members.length}/{limit})</Button>
                                    {sector.posts.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => confirmFormItemDelete('post', 'ESTE POSTO DE SERVIÇO', { sectorIndex: sIdx, postIndex: pIdx })} className="h-10 w-10 text-destructive hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>}
                                  </div>
                                </div>
                                <div className={cn("grid gap-2 pt-1", isVTR ? "grid-cols-1 md:grid-cols-5" : isSmall ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3")}>
                                  {isVehicle && (
                                    <div className="space-y-1.5"><Label className="text-[9px] font-black uppercase text-blue-600 tracking-widest flex items-center gap-1.5"><Car className="h-3 w-3" /> Prefixo nº</Label><Input placeholder="001" className="h-11 uppercase font-bold text-xs bg-blue-50/30 border-blue-100 focus:bg-white" value={post.vtrNumber || ""} onChange={(e) => { const newPosts = [...sector.posts]; newPosts[pIdx].vtrNumber = e.target.value.toUpperCase(); updateSectorBlock(sIdx, { posts: newPosts }); }} /></div>
                                  )}
                                  {post.members.map((member: any, mIdx: number) => (
                                    <div key={member.id} className={cn("flex flex-col gap-2 p-2 rounded-lg border border-slate-100 bg-white/80 shadow-sm", isVehicle && "border-blue-100")}>
                                      <div className="flex gap-2 items-end">
                                        <div className="flex-1">{renderAutocomplete(`Integrante ${mIdx + 1}`, member.term, (v) => updateMemberInPost(sIdx, pIdx, mIdx, { term: v }), (v) => updateMemberInPost(sIdx, pIdx, mIdx, { empId: v }), member.empId, member.show, (v) => updateMemberInPost(sIdx, pIdx, mIdx, { show: v }), () => {}, allEmployees || [], [...trulyAbsentIds, ...teamMemberIds.filter(id => id !== member.empId)], false, 'qra')}</div>
                                        {post.members.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => confirmFormItemDelete('member', 'ESTE INTEGRANTE DA GUARNIÇÃO', { sectorIndex: sIdx, postIndex: pIdx, memberIndex: mIdx })} className="h-11 w-11 text-destructive/50 hover:text-destructive rounded-xl"><Trash2 className="h-3.5 w-3.5" /></Button>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                          <div className="flex justify-start"><Button type="button" variant="ghost" size="sm" onClick={() => addPostToSector(sIdx)} className="h-6 text-[9px] font-black uppercase text-primary gap-1.5 hover:bg-primary/5"><Plus className="h-3.5 w-3.5" /> ADICIONAR POSTO</Button></div>
                        </div>
                      </div>
                    ))}
                  </CollapsibleContent>
                </Collapsible>

                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="bg-amber-50 p-2 rounded-xl border border-amber-100 shadow-sm"><MessageSquare className="h-5 w-5 text-amber-600" /></div>
                    <div className="flex flex-col"><h4 className="text-sm font-black uppercase text-slate-700 tracking-widest leading-none">Observações Finais</h4><span className="text-[9px] font-bold text-muted-foreground uppercase mt-1 tracking-tighter">RELATO DE OCORRÊNCIAS DO TURNO.</span></div>
                  </div>
                  <Textarea placeholder="DESCREVA AS OCORRÊNCIAS DO TURNO..." className="min-h-[150px] uppercase text-xs p-4 rounded-xl bg-slate-50/30 border-slate-200 focus:bg-white transition-all resize-none leading-relaxed" value={observations} onChange={(e) => setObservations(e.target.value.toUpperCase())} />
                </div>
              </CardContent>
              <CardFooter className="bg-slate-50 border-t p-6 flex flex-col sm:flex-row gap-4">
                <Button type="button" variant="outline" onClick={() => { localStorage.setItem('nrg_relatorio_draft', JSON.stringify({ defaultDate, defaultTime, selectedEscalaId, inspetorTerm, inspetorId, inspetorInfo, subinspetorRows, faltaRows, especialRows, overtimeRows, sectorBlocks, observations })); toast({ title: "RASCUNHO SALVO LOCALMENTE" }); }} className="w-full sm:w-auto h-14 uppercase font-black text-xs tracking-widest border-primary/20 text-primary hover:bg-primary/5"><Save className="h-5 w-5 mr-2" /> Salvar Rascunho</Button>
                <Button type="submit" disabled={loading || loadingEmployees} className="flex-1 h-14 uppercase font-black text-xs tracking-widest bg-primary hover:bg-primary/90 shadow-xl shadow-blue-200 transition-all active:scale-95">{loading ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Send className="h-5 w-5 mr-2" />} {editingReportId ? "Enviar Correção" : "Enviar Relatório"}</Button>
              </CardFooter>
            </form>
          </Card>
        </TabsContent>

        <TabsContent value="sent" className="mt-6">
          {renderReportList(pendingReports || [], "Nenhum relatório aguardando auditoria no momento.", canManageAudit)}
        </TabsContent>

        <TabsContent value="archived" className="mt-6 space-y-6">
          <Card className="card-shadow border-none rounded-2xl overflow-hidden bg-slate-50/50">
            <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="BUSCAR NO ARQUIVO (INSPETOR, QRA OU DATA)..." 
                  className="pl-9 h-10 uppercase text-[10px] font-bold bg-white" 
                  value={archiveSearch}
                  onChange={(e) => setArchiveSearch(e.target.value.toUpperCase())}
                />
                {archiveSearch && (
                  <button onClick={() => setArchiveSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-slate-900 transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Badge variant="outline" className="h-10 px-4 bg-white font-black text-[10px] uppercase border-slate-200">
                {filteredArchivedReports.length} RELATÓRIOS
              </Badge>
            </CardContent>
          </Card>

          {renderReportList(paginatedArchivedReports, "Arquivo histórico vazio.", false, canDeleteArchived)}

          {totalArchivePages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-muted/5 rounded-xl border border-dashed border-slate-200">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">
                Exibindo {paginatedArchivedReports.length} de {filteredArchivedReports.length} relatórios (Página {archiveCurrentPage} de {totalArchivePages})
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
        </TabsContent>
      </Tabs>
    </div>
  )
}
