"use client"

import * as React from "react"
import { 
  BellRing, 
  Send, 
  Trash2, 
  Loader2, 
  Plus, 
  ShieldCheck, 
  User, 
  Users, 
  Check, 
  Search,
  AlertCircle,
  Megaphone,
  History,
  X,
  Info,
  CheckCircle2,
  Eye,
  FilterX,
  ChevronDown,
  ChevronLeft,
  ChevronRight
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
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
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { useFirestore, useCollection, useAuth } from '@/firebase'
import { collection, query, orderBy, addDoc, deleteDoc, doc, serverTimestamp, updateDoc, where } from 'firebase/firestore'
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

const MONTHS = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"
];

const ITEMS_PER_PAGE = 30;

const normalizeStr = (str: string) => str?.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || "";

export default function NotificationsPage() {
  const { user, employeeData } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = React.useState("mural");
  const [isNotifyModalOpen, setIsNotifyModalOpen] = React.useState(false);
  const [isSendingNotify, setIsSendingNotify] = React.useState(false);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  // Estados para Exclusão
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = React.useState(false);
  const [idToDelete, setIdToDelete] = React.useState<string | null>(null);

  // Estados do Formulário de Envio
  const [notifyPriority, setNotifyPriority] = React.useState("NORMAL");
  const [notifyTargetType, setNotifyTargetType] = React.useState("TODOS");
  const [notifyTargetId, setNotifyTargetId] = React.useState("");
  const [notifyTargetLabel, setNotifyTargetLabel] = React.useState("");
  const [notifySearchTerm, setNotifySearchTerm] = React.useState("");
  const [notifyTitle, setNotifyTitle] = React.useState("");
  const [notifyMessage, setNotifyMessage] = React.useState("");
  const [showTargetSuggestions, setShowTargetSuggestions] = React.useState(false);

  // Estados de Filtro da Gestão
  const [mgmtSearchTerm, setMgmtSearchTerm] = React.useState("");
  const [mgmtFilterMonth, setMgmtFilterMonth] = React.useState("ALL");
  const [mgmtFilterYear, setMgmtFilterYear] = React.useState("ALL");

  // Estado de Paginação da Gestão
  const [mgmtCurrentPage, setMgmtCurrentPage] = React.useState(1);

  // Consulta: Notificações do Servidor (Mural)
  const myNotificationsRef = React.useMemo(() => {
    if (!firestore || !user || !employeeData) return null;
    return query(collection(firestore, 'notifications'), orderBy('createdAt', 'desc'));
  }, [firestore, user, employeeData]);

  const { data: myNotifications, loading: loadingMy } = useCollection(myNotificationsRef);
  
  const rolesQuery = React.useMemo(() => firestore ? collection(firestore, 'roles') : null, [firestore]);
  const { data: roles } = useCollection(rolesQuery);

  // Filtragem das notificações para o Mural do Servidor
  const filteredMyNotifications = React.useMemo(() => {
    if (!myNotifications || !user || !employeeData) return [];
    const userRole = normalizeStr(employeeData.role || "");
    
    return myNotifications.filter(n => {
      if (n.targetType === "TODOS") return true;
      if (n.targetType === "CARGO") {
        const targetRole = roles?.find(r => r.id === n.targetId)?.name || "";
        return normalizeStr(targetRole) === userRole;
      }
      if (n.targetType === "INDIVIDUAL") return n.targetId === user.uid;
      return false;
    });
  }, [myNotifications, user, employeeData, roles]);

  // Gatilho de Ciência Individual
  React.useEffect(() => {
    if (activeTab === "mural" && employeeData?.id && firestore && filteredMyNotifications.length > 0) {
      const markAsRead = async () => {
        const receipts = employeeData.readReceipts || {};
        const updates: any = {};
        let hasChanges = false;
        
        filteredMyNotifications.forEach(n => {
          if (!receipts[n.id]) {
            updates[`readReceipts.${n.id}`] = serverTimestamp();
            hasChanges = true;
          }
        });

        const newestNotifDate = filteredMyNotifications.reduce((acc, n) => {
          const d = n.createdAt?.toDate?.() || new Date(0);
          return d > acc ? d : acc;
        }, new Date(0));
        
        const lastVisitDate = employeeData.lastMuralVisit?.toDate?.() || new Date(0);
        
        if (hasChanges || newestNotifDate > lastVisitDate) {
          updates.lastMuralVisit = serverTimestamp();
          try {
            await updateDoc(doc(firestore, 'employees', employeeData.id), updates);
          } catch (e) {
            console.error("Erro ao gravar recibos de leitura:", e);
          }
        }
      };
      
      const timer = setTimeout(markAsRead, 1000);
      return () => clearTimeout(timer);
    }
  }, [activeTab, employeeData?.id, firestore, filteredMyNotifications]);

  // Lógica de Permissão de Gestão
  const canManageMural = React.useMemo(() => {
    if (!employeeData) return false;
    const role = normalizeStr(employeeData.role || "");
    return ["COMANDANTE", "INSPETOR GERAL", "GESTOR DE RH"].some(r => role.includes(r));
  }, [employeeData]);

  // Consulta: Todas as notificações (para gestão)
  const allNotificationsRef = React.useMemo(() => {
    if (!firestore || !canManageMural) return null;
    return query(collection(firestore, 'notifications'), orderBy('createdAt', 'desc'));
  }, [firestore, canManageMural]);

  const { data: allNotifications, loading: loadingAll } = useCollection(allNotificationsRef);
  const employeesRef = React.useMemo(() => firestore ? query(collection(firestore, 'employees'), orderBy('name', 'asc')) : null, [firestore]);
  const { data: employees } = useCollection(employeesRef);

  // Lógica de Filtragem da Gestão
  const filteredMgmtNotifications = React.useMemo(() => {
    if (!allNotifications) return [];
    const term = mgmtSearchTerm.toLowerCase();
    
    return allNotifications.filter(n => {
      const matchesText = !mgmtSearchTerm || (
        n.title?.toLowerCase().includes(term) ||
        n.message?.toLowerCase().includes(term) ||
        n.authorQra?.toLowerCase().includes(term)
      );

      if (!matchesText) return false;

      if (mgmtFilterMonth === "ALL" && mgmtFilterYear === "ALL") return true;

      const createdAt = n.createdAt?.toDate?.() || new Date(0);
      const matchesMonth = mgmtFilterMonth === "ALL" || createdAt.getMonth() === parseInt(mgmtFilterMonth);
      const matchesYear = mgmtFilterYear === "ALL" || createdAt.getFullYear() === parseInt(mgmtFilterYear);

      return matchesMonth && matchesYear;
    });
  }, [allNotifications, mgmtSearchTerm, mgmtFilterMonth, mgmtFilterYear]);

  // Reset de página quando os filtros mudam
  React.useEffect(() => {
    setMgmtCurrentPage(1);
  }, [mgmtSearchTerm, mgmtFilterMonth, mgmtFilterYear]);

  const paginatedMgmtNotifications = React.useMemo(() => {
    const startIndex = (mgmtCurrentPage - 1) * ITEMS_PER_PAGE;
    return filteredMgmtNotifications.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredMgmtNotifications, mgmtCurrentPage]);

  const totalMgmtPages = Math.ceil(filteredMgmtNotifications.length / ITEMS_PER_PAGE);

  // Cálculo de estatísticas de leitura para o gestor
  const notificationStats = React.useMemo(() => {
    if (!employees || !allNotifications) return {};
    
    const results: Record<string, { read: number; total: number }> = {};
    
    allNotifications.forEach(n => {
      let totalCount = 0;
      let readCount = 0;

      if (n.targetType === "TODOS") {
        totalCount = employees.length;
      } else if (n.targetType === "CARGO") {
        const roleName = roles?.find(r => r.id === n.targetId)?.name || "";
        const normRole = normalizeStr(roleName);
        totalCount = employees.filter(e => normalizeStr(e.role) === normRole).length;
      } else if (n.targetType === "INDIVIDUAL") {
        totalCount = 1;
      }

      readCount = employees.filter(e => e.readReceipts && e.readReceipts[n.id]).length;
      results[n.id] = { read: readCount, total: totalCount };
    });

    return results;
  }, [employees, allNotifications, roles]);

  const resetNotifyForm = (clearAll = true) => {
    setNotifyTargetId("");
    setNotifyTargetLabel("");
    setNotifySearchTerm("");
    if (clearAll) {
      setNotifyPriority("NORMAL");
      setNotifyTargetType("TODOS");
      setNotifyTitle("");
      setNotifyMessage("");
    }
  };

  const clearMgmtFilters = () => {
    setMgmtSearchTerm("");
    setMgmtFilterMonth("ALL");
    setMgmtFilterYear("ALL");
  };

  async function handleSendNotification(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!firestore || !employeeData) return;

    if (notifyTargetType !== "TODOS" && !notifyTargetId) {
      toast({ variant: "destructive", title: "DESTINATÁRIO AUSENTE", description: "SELECIONE O GRUPO OU SERVIDOR." });
      return;
    }

    if (!notifyTitle.trim() || !notifyMessage.trim()) {
      toast({ variant: "destructive", title: "CAMPOS VAZIOS", description: "PREENCHA TÍTULO E MENSAGEM." });
      return;
    }

    setIsSendingNotify(true);

    const payload = {
      title: notifyTitle.toUpperCase().trim(),
      message: notifyMessage.toUpperCase().trim(),
      priority: notifyPriority,
      targetType: notifyTargetType,
      targetId: notifyTargetId,
      targetLabel: notifyTargetType === "TODOS" ? "TODOS OS SERVIDORES" : notifyTargetLabel,
      authorQra: (employeeData.qra || "SISTEMA").toUpperCase(),
      authorName: (employeeData.name || "SISTEMA").toUpperCase(),
      createdAt: serverTimestamp()
    };

    try {
      await addDoc(collection(firestore, 'notifications'), payload);
      toast({ title: "COMUNICADO PUBLICADO!", description: "O aviso já está disponível para os destinatários." });
      
      if (notifyTargetType === "INDIVIDUAL") {
        resetNotifyForm(false);
      } else {
        setIsNotifyModalOpen(false);
        resetNotifyForm(true);
      }
    } catch (err) {
      toast({ variant: "destructive", title: "ERRO AO PUBLICAR" });
    } finally {
      setIsSendingNotify(false);
    }
  }

  async function handleDeleteNotification(id: string) {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'notifications', id));
      toast({ title: "AVISO REMOVIDO", description: "O comunicado foi excluído do mural." });
    } catch (err) {
      toast({ variant: "destructive", title: "ERRO AO EXCLUIR" });
    }
  }

  const filteredEmployeesForSelection = React.useMemo(() => {
    if (!employees || !notifySearchTerm) return [];
    const term = notifySearchTerm.toLowerCase();
    return employees.filter(emp => 
      emp.name?.toLowerCase().includes(term) || 
      emp.qra?.toLowerCase().includes(term)
    ).slice(0, 5);
  }, [employees, notifySearchTerm]);

  if (loadingMy) {
    return <div className="flex h-full items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const hasActiveMgmtFilters = mgmtSearchTerm !== "" || mgmtFilterMonth !== "ALL" || mgmtFilterYear !== "ALL";

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="bg-blue-50 p-2 rounded-xl">
            <BellRing className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight uppercase text-primary">Mural de Avisos</h2>
            <p className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest">Comunicados Oficiais e Ordens de Serviço.</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={cn(
          "grid w-full bg-muted/50 p-1 rounded-xl h-auto",
          canManageMural ? "grid-cols-2 lg:w-[400px]" : "grid-cols-1 lg:w-[200px]"
        )}>
          <TabsTrigger value="mural" className="rounded-lg uppercase text-[10px] font-bold flex items-center gap-2 py-2">
            <Megaphone className="h-3.5 w-3.5" /> COMUNICADOS
          </TabsTrigger>
          {canManageMural && (
            <TabsTrigger value="gestao" className="rounded-lg uppercase text-[10px] font-bold flex items-center gap-2 py-2 text-primary">
              <ShieldCheck className="h-3.5 w-3.5" /> GERENCIAR MURAL
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="mural" className="mt-6 space-y-4">
          {filteredMyNotifications.length === 0 ? (
            <Card className="border-dashed border-2 bg-muted/5 rounded-3xl">
              <CardContent className="flex flex-col items-center justify-center p-20 text-center space-y-4">
                <BellRing className="h-12 w-12 text-muted-foreground/20" />
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest italic">Nenhum aviso no momento.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredMyNotifications.map(n => {
                const readAtTimestamp = employeeData?.readReceipts?.[n.id];
                const readAt = readAtTimestamp?.toDate?.() || null;
                const isNew = !readAt;
                const viewTimeStr = readAt ? readAt.toLocaleString('pt-BR') : '---';

                return (
                  <Card key={n.id} className={cn(
                    "card-shadow border-none rounded-xl overflow-hidden transition-all animate-in slide-in-from-bottom-2 duration-500",
                    n.priority === "URGENTE" ? "ring-2 ring-red-500 bg-red-50/10" : 
                    n.priority === "ALERTA" ? "ring-2 ring-amber-400 bg-amber-50/10" : "bg-white",
                    isNew && "shadow-lg shadow-blue-100/50 ring-1 ring-blue-400"
                  )}>
                    <div className="flex flex-col">
                      <div className={cn(
                        "p-1.5 flex items-center justify-between border-b",
                        n.priority === "URGENTE" ? "bg-red-600 text-white" : 
                        n.priority === "ALERTA" ? "bg-amber-500 text-white" : "bg-blue-600 text-white"
                      )}>
                        <div className="flex items-center gap-2">
                          {n.priority === "URGENTE" ? <AlertCircle className="h-3 w-3 animate-pulse" /> : <Info className="h-3 w-3" />}
                          <span className="text-[8px] font-black uppercase tracking-widest">{n.priority}</span>
                        </div>
                        <span className="text-[8px] font-mono font-bold opacity-80">
                          POSTADO: {n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString('pt-BR') : '---'}
                        </span>
                      </div>
                      <CardContent className="p-3 space-y-1">
                        <h3 className="text-[12px] font-black uppercase text-slate-900 leading-tight">{n.title}</h3>
                        <p className="text-[11px] font-medium uppercase text-slate-700 leading-relaxed whitespace-pre-wrap">{n.message}</p>
                      </CardContent>
                      <CardFooter className="bg-slate-50 p-1 border-t flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[7px] font-black uppercase border-slate-200 text-slate-500 bg-white h-5">
                            DE: {n.authorQra}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {isNew ? (
                            <Badge className="bg-blue-600 text-white text-[7px] font-black uppercase animate-pulse h-5">NOVO</Badge>
                          ) : (
                            <div className="flex items-center gap-1 opacity-60">
                              <CheckCircle2 className="h-3 w-3 text-green-600" />
                              <span className="text-[7px] font-bold text-muted-foreground uppercase">
                                Visualizado em: {viewTimeStr}
                              </span>
                            </div>
                          )}
                        </div>
                      </CardFooter>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="gestao" className="mt-6 space-y-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <Card className="flex-1 border-none shadow-sm rounded-xl overflow-hidden bg-slate-50">
              <CardContent className="p-3 flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="BUSCAR AVISO OU AUTOR..." 
                    value={mgmtSearchTerm}
                    onChange={(e) => setMgmtSearchTerm(e.target.value.toUpperCase())}
                    className="pl-8 h-9 text-[10px] uppercase font-bold bg-white"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Select value={mgmtFilterMonth} onValueChange={setMgmtFilterMonth}>
                    <SelectTrigger className="h-9 w-[120px] uppercase text-[10px] font-bold bg-white">
                      <SelectValue placeholder="MÊS" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL" className="uppercase text-[10px] font-bold">TODOS MESES</SelectItem>
                      {MONTHS.map((m, idx) => (
                        <SelectItem key={idx} value={idx.toString()} className="uppercase text-[10px] font-bold">{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={mgmtFilterYear} onValueChange={setMgmtFilterYear}>
                    <SelectTrigger className="h-9 w-[90px] uppercase text-[10px] font-bold bg-white">
                      <SelectValue placeholder="ANO" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL" className="uppercase text-[10px] font-bold">TODOS</SelectItem>
                      {[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => (
                        <SelectItem key={y} value={y.toString()} className="uppercase text-[10px] font-bold">{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {hasActiveMgmtFilters && (
                    <Button variant="ghost" size="icon" onClick={clearMgmtFilters} className="h-9 w-9 text-red-600 hover:bg-red-50">
                      <FilterX className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Dialog open={isNotifyModalOpen} onOpenChange={(open) => { setIsNotifyModalOpen(open); if (!open) resetNotifyForm(true); }}>
              <DialogTrigger asChild>
                <Button size="lg" className="h-12 px-8 uppercase font-black text-xs tracking-widest shadow-xl bg-primary hover:bg-primary/90">
                  <Plus className="h-4 w-4 mr-2" /> Publicar Novo Aviso
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px] rounded-2xl border-none shadow-2xl p-0 overflow-hidden">
                <form onSubmit={handleSendNotification}>
                  <DialogHeader className="bg-amber-600 p-6 text-white">
                    <div className="flex items-center gap-4">
                      <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm"><BellRing className="h-6 w-6 text-white" /></div>
                      <div>
                        <DialogTitle className="uppercase text-xl font-black tracking-tight leading-none">Publicar no Mural</DialogTitle>
                        <p className="text-[10px] font-bold uppercase opacity-80 tracking-widest mt-1">COMUNICAÇÃO OFICIAL DA UNIDADE.</p>
                      </div>
                    </div>
                  </DialogHeader>
                  <div className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-700">Prioridade</Label>
                        <Select value={notifyPriority} onValueChange={setNotifyPriority}>
                          <SelectTrigger className="h-10 uppercase text-[10px] font-bold"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="NORMAL" className="uppercase text-[10px]">NORMAL (INFORMATIVO)</SelectItem>
                            <SelectItem value="ALERTA" className="uppercase text-[10px] text-orange-600 font-black">ALERTA (ATENÇÃO)</SelectItem>
                            <SelectItem value="URGENTE" className="uppercase text-[10px] text-red-600 font-black">URGENTE (IMEDIATO)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-700">Destinatário</Label>
                        <Select value={notifyTargetType} onValueChange={(v) => { setNotifyTargetType(v); setNotifyTargetId(""); setNotifyTargetLabel(""); }}>
                          <SelectTrigger className="h-10 uppercase text-[10px] font-bold"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="TODOS" className="uppercase text-[10px]">TODOS OS SERVIDORES</SelectItem>
                            <SelectItem value="CARGO" className="uppercase text-[10px]">POR GRUPO (CARGO)</SelectItem>
                            <SelectItem value="INDIVIDUAL" className="uppercase text-[10px]">SERVIDOR INDIVIDUAL</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {notifyTargetType === "CARGO" && (
                      <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-300">
                        <Label className="text-[10px] font-black uppercase text-slate-700">Selecionar Grupo</Label>
                        <Select value={notifyTargetId} onValueChange={(v) => { setNotifyTargetId(v); setNotifyTargetLabel(roles?.find((r: any) => r.id === v)?.name || "GRUPO"); }}>
                          <SelectTrigger className="h-10 uppercase text-[10px] font-bold"><SelectValue placeholder="SELECIONE THE CARGO..." /></SelectTrigger>
                          <SelectContent>
                            {roles?.map((r: any) => <SelectItem key={r.id} value={r.id} className="uppercase text-[10px]">{r.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {notifyTargetType === "INDIVIDUAL" && (
                      <div className="space-y-1.5 relative animate-in slide-in-from-top-2 duration-300">
                        <Label className="text-[10px] font-black uppercase text-slate-700">Buscar Servidor</Label>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <Input 
                            placeholder="NOME OU QRA..." 
                            value={notifySearchTerm} 
                            onChange={(e) => { setNotifySearchTerm(e.target.value.toUpperCase()); setShowTargetSuggestions(true); }}
                            onFocus={() => setShowTargetSuggestions(true)}
                            className="pl-9 h-10 uppercase text-[10px] font-bold"
                          />
                          {notifyTargetId && <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-600" />}
                        </div>
                        {showTargetSuggestions && notifySearchTerm && (
                          <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border rounded-xl shadow-2xl overflow-hidden">
                            {filteredEmployeesForSelection.map(emp => (
                              <button key={emp.id} type="button" onClick={() => { setNotifyTargetId(emp.uid || emp.id); setNotifyTargetLabel(`${emp.name} (${emp.qra})`); setNotifySearchTerm(`${emp.name} (${emp.qra})`); setShowTargetSuggestions(false); }} className="w-full px-4 py-3 text-left hover:bg-amber-50 flex flex-col border-b last:border-0">
                                <span className="text-[10px] font-black uppercase">{emp.name}</span>
                                <span className="text-[8px] font-bold text-muted-foreground uppercase">QRA: {emp.qra} • {emp.role}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-700">Título do Aviso</Label>
                        <Input 
                          value={notifyTitle}
                          onChange={(e) => setNotifyTitle(e.target.value.toUpperCase())}
                          required 
                          placeholder="EX: CONVOCAÇÃO PARA TREINAMENTO" 
                          className="h-11 uppercase font-bold text-xs" 
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-slate-700">Mensagem</Label>
                        <Textarea 
                          value={notifyMessage}
                          onChange={(e) => setNotifyMessage(e.target.value.toUpperCase())}
                          required 
                          placeholder="DIGITE O CONTEÚDO DO COMUNICADO..." 
                          className="min-h-[120px] uppercase text-xs p-4 resize-none leading-relaxed" 
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter className="bg-slate-50 p-4 border-t gap-3">
                    <DialogClose asChild><Button variant="ghost" className="uppercase text-[10px] font-black">Cancelar</Button></DialogClose>
                    <Button type="submit" disabled={isSendingNotify} className="h-11 px-8 uppercase font-black text-xs tracking-widest bg-amber-600 hover:bg-amber-700 shadow-lg shadow-amber-100">
                      {isSendingNotify ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />} Publicar Agora
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b pb-2">
              <History className="h-4 w-4 text-slate-500" />
              <h4 className="text-xs font-black uppercase text-slate-700 tracking-widest">Histórico de Publicações ({filteredMgmtNotifications.length})</h4>
            </div>
            
            {loadingAll ? <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : (
              <div className="grid gap-3">
                {paginatedMgmtNotifications.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground uppercase font-bold italic text-center py-10">Nenhum histórico encontrado para os filtros aplicados.</p>
                ) : (
                  <>
                    {paginatedMgmtNotifications.map(n => {
                      const stats = notificationStats[n.id] || { read: 0, total: 0 };
                      const isComplete = stats.read >= stats.total && stats.total > 0;
                      const isExpanded = expandedId === n.id;

                      return (
                        <Card key={n.id} className={cn(
                          "border border-slate-100 transition-all group overflow-hidden",
                          isExpanded ? "bg-white ring-1 ring-primary/20 shadow-md" : "bg-slate-50/50 hover:bg-white"
                        )}>
                          <div 
                            className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4 cursor-pointer select-none"
                            onClick={() => setExpandedId(isExpanded ? null : n.id)}
                          >
                            <div className="flex items-center gap-4 flex-1 min-w-0">
                              <div className={cn(
                                "w-1.5 h-10 rounded-full shrink-0",
                                n.priority === "URGENTE" ? "bg-red-500" : n.priority === "ALERTA" ? "bg-amber-500" : "bg-blue-500"
                              )} />
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-black uppercase text-slate-900 leading-tight truncate">{n.title}</p>
                                <div className="flex flex-col gap-1 mt-1">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-[7px] font-black uppercase h-4 px-1.5 shrink-0">{n.targetType}: {n.targetLabel}</Badge>
                                    <span className="text-[8px] font-mono text-muted-foreground uppercase truncate">
                                      Postado: {n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString('pt-BR') : '---'}
                                    </span>
                                  </div>
                                  <p className="text-[7px] font-bold text-primary uppercase tracking-widest leading-none">
                                    ENVIADO POR: {n.authorQra}
                                  </p>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-4 shrink-0">
                              <div className={cn(
                                "flex items-center gap-3 px-3 py-1.5 rounded-lg border",
                                isComplete ? "bg-green-50 border-green-200" : "bg-blue-50 border-blue-100"
                              )}>
                                <div className="flex items-center gap-1.5">
                                  <Eye className={cn("h-3.5 w-3.5", isComplete ? "text-green-600" : "text-blue-600")} />
                                  <span className={cn("text-[11px] font-black", isComplete ? "text-green-700" : "text-blue-700")}>{stats.read}</span>
                                </div>
                                <Separator orientation="vertical" className="h-3" />
                                <div className="flex items-center gap-1.5">
                                  <Users className="h-3.5 w-3.5 text-slate-400" />
                                  <span className="text-[11px] font-black text-slate-600">{stats.total}</span>
                                </div>
                                {isComplete && <CheckCircle2 className="h-3 w-3 text-green-600 ml-1" />}
                              </div>

                              <ChevronDown className={cn(
                                "h-4 w-4 text-slate-400 transition-transform duration-300",
                                isExpanded && "rotate-180 text-primary"
                              )} />
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-300">
                              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100/50 mb-4">
                                <p className="text-[11px] font-medium uppercase text-slate-700 leading-relaxed whitespace-pre-wrap">
                                  {n.message}
                                </p>
                              </div>
                              <div className="flex justify-end pt-2 border-t border-slate-100/50">
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setIdToDelete(n.id);
                                    setIsDeleteAlertOpen(true);
                                  }}
                                  className="h-8 px-4 text-red-600 hover:bg-red-50 uppercase text-[10px] font-black gap-2"
                                >
                                  <Trash2 className="h-3.5 w-3.5" /> Excluir Comunicado
                                </Button>
                              </div>
                            </div>
                          )}
                        </Card>
                      );
                    })}

                    {totalMgmtPages > 1 && (
                      <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-muted/5 rounded-xl border border-dashed border-slate-200">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">
                          Exibindo {paginatedMgmtNotifications.length} de {filteredMgmtNotifications.length} comunicados
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={mgmtCurrentPage === 1}
                            onClick={() => setMgmtCurrentPage(prev => Math.max(prev - 1, 1))}
                            className="h-8 px-3 text-[10px] font-black uppercase gap-1.5"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" /> Anterior
                          </Button>
                          
                          <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(totalMgmtPages, 5) }, (_, i) => {
                              let pageNum = i + 1;
                              if (totalMgmtPages > 5 && mgmtCurrentPage > 3) {
                                pageNum = Math.min(mgmtCurrentPage - 2 + i, totalMgmtPages - 4 + i);
                              }
                              if (pageNum > totalMgmtPages || pageNum <= 0) return null;

                              return (
                                <Button
                                  key={pageNum}
                                  variant={mgmtCurrentPage === pageNum ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => setMgmtCurrentPage(pageNum)}
                                  className={cn(
                                    "h-8 w-8 p-0 text-[10px] font-bold",
                                    mgmtCurrentPage === pageNum ? "bg-primary text-white" : ""
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
                            disabled={mgmtCurrentPage === totalMgmtPages}
                            onClick={() => setMgmtCurrentPage(prev => Math.min(prev + 1, totalMgmtPages))}
                            className="h-8 px-3 text-[10px] font-black uppercase gap-1.5"
                          >
                            Próximo <ChevronRight className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent className="max-w-[90vw] sm:max-w-lg rounded-2xl border-none shadow-2xl">
          <AlertDialogHeader>
            <div className="bg-red-50 w-12 h-12 rounded-full flex items-center justify-center mb-4">
              <Trash2 className="h-6 w-6 text-red-600" />
            </div>
            <AlertDialogTitle className="uppercase text-lg font-bold">Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription className="uppercase text-[10px] font-medium text-muted-foreground tracking-wide">
              ESTA AÇÃO É IRREVERSÍVEL. O COMUNICADO SERÁ REMOVIDO PERMANENTEMENTE DO MURAL.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 gap-2">
            <AlertDialogCancel className="uppercase text-xs font-bold rounded-xl h-11 border-none bg-slate-100 text-slate-600 hover:bg-slate-200">CANCELAR</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (idToDelete) {
                  handleDeleteNotification(idToDelete);
                  setIdToDelete(null);
                }
              }} 
              className="bg-destructive hover:bg-destructive/90 uppercase text-xs font-bold rounded-xl h-11 shadow-lg shadow-red-100"
            >
              EXCLUIR AGORA
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
