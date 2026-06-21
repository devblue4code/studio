"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  Users, 
  Clock, 
  TrendingUp, 
  FileText,
  Loader2,
  Timer,
  CalendarDays,
  ShieldCheck,
  UserMinus,
  Plane,
  Info,
  Briefcase,
  History,
  Calendar
} from "lucide-react"
import {
  PieChart,
  Pie,
  ResponsiveContainer,
  Cell,
  Tooltip
} from "recharts"
import { useFirestore, useCollection } from '@/firebase'
import { collection, query, where, updateDoc, doc, orderBy } from 'firebase/firestore'
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Utilitários de cálculo
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

const getSaoPauloDate = () => {
  const now = new Date();
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now).split('/').reverse().join('-');
};

const formatDateBR = (dateStr: string) => {
  if (!dateStr) return "---";
  return dateStr.split('-').reverse().join('/');
};

const MONTHS = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"
];

export default function Dashboard() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isAbsentModalOpen, setIsAbsentModalOpen] = React.useState(false);
  const [isAfastadosModalOpen, setIsAfastadosModalOpen] = React.useState(false);

  // Estados para o Resumo Mensal
  const [summaryMonth, setSummaryMonth] = React.useState(new Date().getMonth());
  const [summaryYear, setSummaryYear] = React.useState(new Date().getFullYear());

  const employeesRef = React.useMemo(() => collection(firestore, 'employees'), [firestore]);
  const launchesRef = React.useMemo(() => collection(firestore, 'launches'), [firestore]);
  
  const todayReportsRef = React.useMemo(() => {
    const today = getSaoPauloDate();
    return query(collection(firestore, 'dailyReports'), where('date', '==', today));
  }, [firestore]);

  const { data: employees, loading: loadingEmployees } = useCollection(employeesRef);
  const { data: launches, loading: loadingLaunches } = useCollection(launchesRef);
  const { data: todayReports, loading: loadingReports } = useCollection(todayReportsRef);

  // Automação de Reconciliação de Status
  React.useEffect(() => {
    if (!employees || !launches || loadingEmployees || loadingLaunches) return;

    const today = getSaoPauloDate();
    const syncStatus = async () => {
      let syncCount = 0;

      for (const emp of employees) {
        const activeLaunches = launches.filter(l => 
          l.employeeId === emp.id && 
          ["FERIAS", "LICENCA", "ATESTADO"].some(type => normalizeStr(l.type).includes(type))
        );

        const currentLaunch = activeLaunches.find(l => l.startDate <= today && l.endDate >= today);

        let targetStatus = "ATIVO";
        if (currentLaunch) {
          const type = normalizeStr(currentLaunch.type);
          if (type.includes("FERIAS")) targetStatus = "FÉRIAS";
          else if (type.includes("ATESTADO")) targetStatus = "ATESTADO";
          else targetStatus = "LICENÇA";
        }

        const validTransitions = ["ATIVO", "FÉRIAS", "LICENÇA", "ATESTADO"];
        if (emp.status !== targetStatus && validTransitions.includes(emp.status)) {
          await new Promise(r => setTimeout(r, 100));
          await updateDoc(doc(firestore, 'employees', emp.id), { status: targetStatus });
          syncCount++;
        }
      }

      if (syncCount > 0) {
        toast({ title: "SINCRONIZAÇÃO OPERACIONAL", description: `${syncCount} STATUS ATUALIZADOS CONFORME ESCALA.` });
      }
    };

    syncStatus();
  }, [employees, launches, loadingEmployees, loadingLaunches, firestore, toast]);

  // Estatísticas Gerais
  const stats = React.useMemo(() => {
    if (!employees) return { total: 0, active: 0, pending: 0, leave: 0, vacation: 0, medical: 0 };
    return {
      total: employees.length,
      active: employees.filter(e => e.status === "ATIVO").length,
      pending: employees.filter(e => e.status === "PENDENTE").length,
      leave: employees.filter(e => e.status === "LICENÇA").length,
      vacation: employees.filter(e => e.status === "FÉRIAS").length,
      medical: employees.filter(e => e.status === "ATESTADO").length,
    };
  }, [employees]);

  // Estatísticas de Ausentes (Hoje)
  const absentStats = React.useMemo(() => {
    const today = getSaoPauloDate();
    const summary = { total: 0, folga: 0, abono: 0, falta: 0 };

    if (launches) {
      launches.forEach(l => {
        const type = normalizeStr(l.type);
        const isActive = l.startDate <= today && l.endDate >= today;
        if (isActive) {
          if (type.includes("FOLGA") || type.includes("TRE DEBITO")) { 
            summary.folga++; 
            summary.total++; 
          } else if (type.includes("ABONO")) { 
            summary.abono++; 
            summary.total++; 
          }
        }
      });
    }

    if (todayReports) {
      const uniqueFaltaIds = new Set();
      todayReports.forEach(report => {
        (report.absences || []).forEach((abs: any) => {
          uniqueFaltaIds.add(abs.id);
        });
      });
      summary.falta = uniqueFaltaIds.size;
      summary.total += summary.falta;
    }
    
    return summary;
  }, [launches, todayReports]);

  // Resumo Mensal de Atividades
  const monthlySummary = React.useMemo(() => {
    if (!launches) return null;
    
    const filtered = launches.filter(l => {
      if (!l.date) return false;
      const d = new Date(l.date + "T00:00:00");
      return d.getMonth() === summaryMonth && d.getFullYear() === summaryYear;
    });

    const summary = {
      dias: { folgaTre: 0, faltas: 0, abono: 0 },
      lancamentos: { atestado: 0, licenca: 0 },
      escalas: { especial: 0, gse: 0 },
      horas: { credito: 0, debito: 0 }
    };

    filtered.forEach(l => {
      const type = normalizeStr(l.type || "");
      const days = Number(l.days) || 0;
      const qtdEscala = Number(l.qtdEscala) || 0;
      const minutes = hhmmToMinutes(l.hours || "00:00");

      if (type.includes("FOLGA") || type.includes("TRE DEBITO")) {
        summary.dias.folgaTre += days;
      } else if (type.includes("FALTA")) {
        summary.dias.faltas += days;
      } else if (type.includes("ABONO")) {
        summary.dias.abono += days;
      }

      if (type.includes("ATESTADO")) summary.lancamentos.atestado += 1;
      if (type.includes("LICENCA")) summary.lancamentos.licenca += 1;
      if (type.includes("ESPECIAL")) summary.escalas.especial += qtdEscala;
      if (type.includes("GSE")) summary.escalas.gse += qtdEscala;

      if (type === "BANCO DE HORAS CREDITO") {
        summary.horas.credito += minutes;
      } else if (type === "BANCO DE HORAS DEBITO" || type === "FOLGA") {
        summary.horas.debito += minutes;
      }
    });

    return summary;
  }, [launches, summaryMonth, summaryYear]);

  // Listas para os Modais
  const absentList = React.useMemo(() => {
    const today = getSaoPauloDate();
    const listFromLaunches = (launches || []).filter(l => {
      const type = normalizeStr(l.type);
      const isActive = l.startDate <= today && l.endDate >= today;
      return isActive && (type.includes("FOLGA") || type.includes("ABONO") || type.includes("TRE DEBITO"));
    });

    const uniqueFaltasMap = new Map();
    (todayReports || []).forEach(report => {
      (report.absences || []).forEach((abs: any) => {
        if (!uniqueFaltasMap.has(abs.id)) {
          uniqueFaltasMap.set(abs.id, {
            id: abs.id,
            employeeId: abs.id,
            employeeName: abs.name,
            employeeQra: abs.qra,
            type: "FALTA (RELATÓRIO)",
            escala: report.escalaName,
            turno: report.time,
            endDate: today
          });
        }
      });
    });

    return [...listFromLaunches, ...Array.from(uniqueFaltasMap.values())].sort((a, b) => 
      (a.employeeName || "").localeCompare(b.employeeName || "")
    );
  }, [launches, todayReports]);

  const afastadosList = React.useMemo(() => {
    if (!employees || !launches) return [];
    const today = getSaoPauloDate();
    const statusAfastados = ["FÉRIAS", "LICENÇA", "ATESTADO"];
    
    return employees
      .filter(e => statusAfastados.includes(e.status))
      .map(e => {
        const activeLaunch = launches.find(l => 
          l.employeeId === e.id && 
          l.startDate <= today && 
          l.endDate >= today &&
          ["FERIAS", "LICENCA", "ATESTADO"].some(type => normalizeStr(l.type).includes(type))
        );
        return { ...e, endDate: activeLaunch?.endDate || null };
      })
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [employees, launches]);

  // Estatísticas de Banco de Horas e TRE
  const operationStats = React.useMemo(() => {
    if (!launches) return { bhCredit: 0, bhDebit: 0, treCredit: 0, treDebit: 0 };
    return launches.reduce((acc, l) => {
      const type = normalizeStr(l.type);
      const minutes = hhmmToMinutes(l.hours || "00:00");
      const days = Number(l.days) || 0;
      if (type === "BANCO DE HORAS CREDITO") acc.bhCredit += minutes;
      if (type === "BANCO DE HORAS DEBITO" || type === "FOLGA") acc.bhDebit += minutes;
      if (type === "TRE CREDITO") acc.treCredit += days;
      if (type === "TRE DEBITO") acc.treDebit += days;
      return acc;
    }, { bhCredit: 0, bhDebit: 0, treCredit: 0, treDebit: 0 });
  }, [launches]);

  const personnelStats = React.useMemo(() => [
    { name: "Ativos", value: stats.active, color: "hsl(var(--primary))" },
    { name: "Licença", value: stats.leave, color: "hsl(var(--accent))" },
    { name: "Férias", value: stats.vacation, color: "hsl(var(--chart-3))" },
    { name: "Atestado", value: stats.medical, color: "hsl(var(--destructive))" },
    { name: "Pendente", value: stats.pending, color: "#94a3b8" },
  ], [stats]);

  if (loadingEmployees || loadingLaunches || loadingReports) {
    return <div className="flex h-full items-center justify-center min-h-[400px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight uppercase">VISÃO GERAL</h2>
          <p className="text-muted-foreground text-sm sm:text-base uppercase text-[10px]">PAINEL ADMINISTRATIVO EM TEMPO REAL.</p>
        </div>
        <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-2 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-green-600" />
          <span className="text-[10px] font-bold text-green-700 uppercase">Sincronização de Status Ativa</span>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {/* CARD 1: EFETIVO DISPONÍVEL */}
        <Card className="card-shadow border-primary/20 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-primary">EFETIVO DISPONÍVEL</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-primary">{stats.active}</div>
            <p className="text-[9px] text-muted-foreground uppercase mt-2 font-bold">TOTAL CADASTRADO: {stats.total}</p>
          </CardContent>
        </Card>

        {/* CARD 2: BANCO DE HORAS */}
        <Card className="card-shadow border-blue-500/20 bg-blue-50/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-bold uppercase">BANCO DE HORAS</CardTitle>
            <Timer className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-3xl font-black text-blue-700">{minutesToHHmm(operationStats.bhCredit - operationStats.bhDebit)}H</div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-blue-100">
              <div className="flex flex-col">
                <span className="text-[8px] font-black uppercase text-muted-foreground">CRÉDITO</span>
                <span className="text-[11px] font-black text-green-600">{minutesToHHmm(operationStats.bhCredit)}H</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[8px] font-black uppercase text-muted-foreground">DÉBITO</span>
                <span className="text-[11px] font-black text-red-600">-{minutesToHHmm(operationStats.bhDebit)}H</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CARD 3: TRE (SALDO) */}
        <Card className="card-shadow border-purple-500/20 bg-purple-50/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-bold uppercase">TRE (SALDO)</CardTitle>
            <CalendarDays className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-3xl font-black text-purple-700">{operationStats.treCredit - operationStats.treDebit} DIAS</div>
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-purple-100">
              <div className="flex flex-col">
                <span className="text-[8px] font-black uppercase text-muted-foreground">CRÉDITO</span>
                <span className="text-[11px] font-black text-green-600">{operationStats.treCredit}D</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[8px] font-black uppercase text-muted-foreground">DÉBITO</span>
                <span className="text-[11px] font-black text-red-600">-{operationStats.treDebit}D</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CARD 4: AUSENTES (HOJE) */}
        <Dialog open={isAbsentModalOpen} onOpenChange={setIsAbsentModalOpen}>
          <DialogTrigger asChild>
            <Card className="card-shadow border-red-500/20 bg-red-50/5 cursor-pointer hover:bg-red-50/20 transition-all active:scale-95 group relative overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-[10px] font-bold uppercase group-hover:text-red-700">AUSENTES (HOJE)</CardTitle>
                <UserMinus className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-3xl font-bold text-red-700">{absentStats.total}</div>
                  <Badge variant="outline" className="text-[7px] font-black uppercase bg-white border-red-200 text-red-600">CLIQUE PARA VER</Badge>
                </div>
                <div className="grid grid-cols-3 gap-1 pt-2 border-t border-red-100">
                  <div className="flex flex-col">
                    <span className="text-[7px] font-black uppercase text-muted-foreground">FOLGA/TRE</span>
                    <span className="text-[11px] font-black text-red-600">{absentStats.folga}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[7px] font-black uppercase text-muted-foreground">ABONO</span>
                    <span className="text-[11px] font-black text-red-600">{absentStats.abono}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[7px] font-black uppercase text-muted-foreground">FALTA</span>
                    <span className="text-[11px] font-black text-red-600">{absentStats.falta}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-6xl rounded-2xl border-none shadow-2xl p-6 sm:p-8">
            <DialogHeader>
              <div className="flex items-center gap-4">
                <div className="bg-red-50 p-3 rounded-2xl border border-red-100"><UserMinus className="h-7 w-7 text-red-600" /></div>
                <div>
                  <DialogTitle className="uppercase text-xl sm:text-2xl font-black tracking-tight">AUSENTES HOJE</DialogTitle>
                  <p className="text-xs uppercase font-bold text-muted-foreground tracking-widest mt-1">DETALHAMENTO DE SERVIDORES EM FOLGA, ABONO OU FALTA.</p>
                </div>
              </div>
            </DialogHeader>
            <ScrollArea className="h-[500px] mt-4">
               <Table>
                <TableHeader><TableRow><TableHead className="font-bold uppercase text-[11px]">QRA / NOME</TableHead><TableHead className="font-bold uppercase text-[11px]">ESCALA / TURNO</TableHead><TableHead className="font-bold uppercase text-[11px]">TIPO</TableHead></TableRow></TableHeader>
                <TableBody>
                  {absentList.map((item) => (
                    <TableRow key={item.id}><TableCell><div className="flex flex-col"><span className="font-black uppercase text-[12px]">{item.employeeQra}</span><span className="text-[10px] text-muted-foreground uppercase">{item.employeeName}</span></div></TableCell><TableCell className="text-[11px] uppercase">{item.escala} / {item.turno}</TableCell><TableCell><Badge variant="outline" className="text-[9px] uppercase font-black">{item.type}</Badge></TableCell></TableRow>
                  ))}
                </TableBody>
               </Table>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {/* CARD 5: AFASTADOS */}
        <Dialog open={isAfastadosModalOpen} onOpenChange={setIsAfastadosModalOpen}>
          <DialogTrigger asChild>
            <Card className="card-shadow border-accent/20 bg-slate-50/50 cursor-pointer hover:bg-slate-100/80 transition-all active:scale-95 group relative overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-[10px] font-bold uppercase group-hover:text-primary">AFASTADOS</CardTitle>
                <FileText className="h-4 w-4 text-accent" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-3xl font-bold">{stats.leave + stats.vacation + stats.medical}</div>
                  <Badge variant="outline" className="text-[7px] font-black uppercase bg-white border-slate-200 text-slate-600">CLIQUE PARA VER</Badge>
                </div>
                <div className="grid grid-cols-3 gap-1 pt-2 border-t border-slate-200">
                  <div className="flex flex-col">
                    <span className="text-[7px] font-black uppercase text-muted-foreground">FÉRIAS</span>
                    <span className="text-[11px] font-black text-blue-600">{stats.vacation}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[7px] font-black uppercase text-muted-foreground">LICENÇA</span>
                    <span className="text-[11px] font-black text-purple-600">{stats.leave}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[7px] font-black uppercase text-muted-foreground">ATESTADO</span>
                    <span className="text-[11px] font-black text-red-600">{stats.medical}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-6xl rounded-2xl border-none shadow-2xl p-6 sm:p-8">
            <DialogHeader>
              <div className="flex items-center gap-4">
                <div className="bg-blue-50 p-3 rounded-2xl border border-blue-100"><Plane className="h-7 w-7 text-blue-600" /></div>
                <div>
                  <DialogTitle className="uppercase text-xl sm:text-2xl font-black tracking-tight">SERVIDORES AFASTADOS</DialogTitle>
                  <p className="text-xs uppercase font-bold text-muted-foreground tracking-widest mt-1">DETALHAMENTO DE FÉRIAS, LICENÇAS E ATESTADOS MÉDICOS.</p>
                </div>
              </div>
            </DialogHeader>
            <ScrollArea className="h-[500px] mt-4">
               <Table>
                <TableHeader><TableRow><TableHead className="font-bold uppercase text-[11px]">QRA / NOME</TableHead><TableHead className="font-bold uppercase text-[11px]">SETOR / ESCALA</TableHead><TableHead className="font-bold uppercase text-[11px]">MOTIVO</TableHead><TableHead className="font-bold uppercase text-[11px]">RETORNO</TableHead></TableRow></TableHeader>
                <TableBody>
                  {afastadosList.map((item) => (
                    <TableRow key={item.id}><TableCell><div className="flex flex-col"><span className="font-black uppercase text-[12px]">{item.qra}</span><span className="text-[10px] text-muted-foreground uppercase">{item.name}</span></div></TableCell><TableCell className="text-[11px] uppercase">{item.unit} • {item.escala}</TableCell><TableCell><Badge className="text-[9px] uppercase font-black bg-blue-600">{item.status}</Badge></TableCell><TableCell className="font-mono text-[11px] font-bold">{formatDateBR(item.endDate)}</TableCell></TableRow>
                  ))}
                </TableBody>
               </Table>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
        <Card className="card-shadow border-none rounded-2xl overflow-hidden flex flex-col h-full">
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl uppercase">COMPOSIÇÃO PROPORCIONAL</CardTitle>
            <CardDescription className="text-xs sm:text-sm uppercase text-[9px]">DISTRIBUIÇÃO ATUAL DO EFETIVO DA UNIDADE.</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col justify-between">
             <div className="h-[250px] sm:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={personnelStats} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value">
                    {personnelStats.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return <div className="rounded-lg border bg-background p-2 shadow-sm text-[10px]"><div className="flex flex-col gap-1"><span className="font-black uppercase text-slate-900">{payload[0].name}</span><span className="font-bold text-primary">{payload[0].value} Integrantes</span></div></div>;
                    }
                    return null;
                  }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {personnelStats.map((stat) => (
                <div key={stat.name} className="flex flex-col items-center p-2 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="h-1.5 w-full rounded-full mb-1.5" style={{ backgroundColor: stat.color }} />
                  <span className="text-[9px] font-black uppercase text-slate-600">{stat.name}</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-base font-black text-slate-900">{stat.value}</span>
                    <span className="text-[8px] font-bold text-muted-foreground">{stats.total > 0 ? Math.round((stat.value / stats.total) * 100) : 0}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="card-shadow border-none rounded-2xl overflow-hidden flex flex-col h-full">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b bg-muted/5 p-6">
            <div className="space-y-1">
              <CardTitle className="text-lg sm:text-xl uppercase flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /> Resumo de Atividades</CardTitle>
              <CardDescription className="text-xs uppercase text-[9px] font-bold">Consolidado Mensal de Operações.</CardDescription>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Select value={summaryMonth.toString()} onValueChange={(v) => setSummaryMonth(parseInt(v))}>
                <SelectTrigger className="h-9 w-[120px] uppercase text-[10px] font-bold bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>{MONTHS.map((m, idx) => (
                  <SelectItem key={idx} value={idx.toString()} className="uppercase text-[10px] font-bold">{m}</SelectItem>
                ))}</SelectContent>
              </Select>
              <Select value={summaryYear.toString()} onValueChange={(v) => setSummaryYear(parseInt(v))}>
                <SelectTrigger className="h-9 w-[80px] uppercase text-[10px] font-bold bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>{[2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => (
                  <SelectItem key={y} value={y.toString()} className="uppercase text-[10px] font-bold">{y}</SelectItem>
                ))}</SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <ScrollArea className="h-[450px]">
              <div className="p-6 space-y-8">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 border-b pb-2"><Calendar className="h-4 w-4 text-blue-600" /><h4 className="text-[10px] font-black uppercase text-slate-900 tracking-widest">Métrica em Dias</h4></div>
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between p-3 bg-blue-50/50 rounded-xl border border-blue-100/50"><span className="text-[11px] font-bold uppercase text-slate-700">Folga & TRE Débito</span><Badge className="bg-blue-600 text-white font-mono font-black border-none">{monthlySummary?.dias.folgaTre}</Badge></div>
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100"><span className="text-[11px] font-bold uppercase text-slate-700">Faltas</span><Badge variant="secondary" className="bg-red-50 text-red-700 font-mono font-black border-none">{monthlySummary?.dias.faltas}</Badge></div>
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100"><span className="text-[11px] font-bold uppercase text-slate-700">Abono</span><Badge variant="secondary" className="bg-orange-50 text-orange-700 font-mono font-black border-none">{monthlySummary?.dias.abono}</Badge></div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 border-b pb-2"><History className="h-4 w-4 text-purple-600" /><h4 className="text-[10px] font-black uppercase text-slate-900 tracking-widest">Métrica por Lançamentos</h4></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-purple-50/30 rounded-xl border border-purple-100 flex flex-col gap-1"><span className="text-[9px] font-bold uppercase text-slate-500">Atestados</span><span className="text-xl font-black text-purple-700">{monthlySummary?.lancamentos.atestado} <small className="text-[9px] font-bold uppercase opacity-60">Reg.</small></span></div>
                    <div className="p-3 bg-purple-50/30 rounded-xl border border-purple-100 flex flex-col gap-1"><span className="text-[9px] font-bold uppercase text-slate-500">Licenças</span><span className="text-xl font-black text-purple-700">{monthlySummary?.lancamentos.licenca} <small className="text-[9px] font-bold uppercase opacity-60">Reg.</small></span></div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 border-b pb-2"><Briefcase className="h-4 w-4 text-amber-600" /><h4 className="text-[10px] font-black uppercase text-slate-900 tracking-widest">Métrica por Quantidade de Escalas</h4></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-amber-50/30 rounded-xl border border-amber-100 flex flex-col gap-1"><span className="text-[9px] font-bold uppercase text-slate-500">Escala Especial</span><span className="text-xl font-black text-amber-700">{monthlySummary?.escalas.especial} <small className="text-[9px] font-bold uppercase opacity-60">Escala</small></span></div>
                    <div className="p-3 bg-amber-50/30 rounded-xl border border-amber-100 flex flex-col gap-1"><span className="text-[9px] font-bold uppercase text-slate-500">Escala GSE</span><span className="text-xl font-black text-amber-700">{monthlySummary?.escalas.gse} <small className="text-[9px] font-bold uppercase opacity-60">Escala</small></span></div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 border-b pb-2"><Clock className="h-4 w-4 text-primary" /><h4 className="text-[10px] font-black uppercase text-slate-900 tracking-widest">Métrica em Horas</h4></div>
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between p-3 bg-green-50/30 rounded-xl border border-green-100"><span className="text-[11px] font-bold uppercase text-slate-700">BH Crédito</span><span className="text-sm font-black font-mono text-green-700">+{minutesToHHmm(monthlySummary?.horas.credito || 0)}H</span></div>
                    <div className="flex items-center justify-between p-3 bg-red-50/30 rounded-xl border border-red-100"><span className="text-[11px] font-bold uppercase text-slate-700">BH Débito</span><span className="text-sm font-black font-mono text-red-700">-{minutesToHHmm(monthlySummary?.horas.debito || 0)}H</span></div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </CardContent>
          <div className="p-4 bg-muted/5 border-t mt-auto"><div className="flex items-center justify-between text-[9px] font-bold uppercase text-muted-foreground"><span>Referência: {MONTHS[summaryMonth]} / {summaryYear}</span><div className="flex items-center gap-1"><Info className="h-3 w-3" /><span>Base: Lançamentos RH</span></div></div></div>
        </Card>
      </div>
    </div>
  )
}
