"use client"

import * as React from "react"
import { 
  History, 
  Timer, 
  CalendarDays, 
  Loader2,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  Briefcase,
  Filter,
  X,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Printer
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useFirestore, useCollection, useAuth } from '@/firebase'
import { collection, query, where, orderBy } from 'firebase/firestore'
import { cn } from "@/lib/utils"

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

const formatDate = (dateStr: string) => {
  if (!dateStr) return "-";
  return dateStr.split('-').reverse().join('/');
};

const ITEMS_PER_PAGE = 50;

export default function MeusLancamentosPage() {
  const { employeeData, loading: loadingAuth } = useAuth();
  const firestore = useFirestore();
  
  // Estados de Filtro
  const [searchTerm, setSearchTerm] = React.useState("");
  const [filterType, setFilterType] = React.useState("");
  const [filterStartDate, setFilterStartDate] = React.useState("");
  const [filterEndDate, setFilterEndDate] = React.useState("");

  // Estado de Paginação
  const [currentPage, setCurrentPage] = React.useState(1);

  // Busca apenas os lançamentos do servidor logado, ordenados pelo mais recente
  const myLaunchesRef = React.useMemo(() => {
    if (!firestore || !employeeData?.id) return null;
    return query(
      collection(firestore, 'launches'), 
      where('employeeId', '==', employeeData.id),
      orderBy('date', 'desc')
    );
  }, [firestore, employeeData?.id]);

  const launchTypesRef = React.useMemo(() => firestore ? query(collection(firestore, 'launchTypes'), orderBy('name', 'asc')) : null, [firestore]);

  const { data: myLaunches, loading: loadingLaunches } = useCollection(myLaunchesRef);
  const { data: launchTypes } = useCollection(launchTypesRef);

  // Filtragem dos dados (Tabela) com ordenação por launchNumber decrescente
  const filteredLaunches = React.useMemo(() => {
    if (!myLaunches) return [];
    const term = searchTerm.toLowerCase();
    
    return myLaunches.filter(l => {
      const matchesSearch = !searchTerm || (
        l.type?.toLowerCase().includes(term) ||
        l.launchNumber?.toString().includes(term) ||
        l.observations?.toLowerCase().includes(term)
      );

      const matchesType = !filterType || l.type === filterType;
      
      // Lógica de Filtro por Período Operacional (Início/Fim)
      const lStart = l.startDate || l.date;
      const lEnd = l.endDate || l.startDate || l.date;

      const matchesDate = (
        (!filterStartDate || lEnd >= filterStartDate) &&
        (!filterEndDate || lStart <= filterEndDate)
      );

      return matchesSearch && matchesType && matchesDate;
    }).sort((a, b) => (b.launchNumber || 0) - (a.launchNumber || 0));
  }, [myLaunches, searchTerm, filterType, filterStartDate, filterEndDate]);

  // Reseta para a primeira página quando os filtros mudam
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType, filterStartDate, filterEndDate]);

  // Dados paginados
  const paginatedLaunches = React.useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredLaunches.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredLaunches, currentPage]);

  const totalPages = Math.ceil(filteredLaunches.length / ITEMS_PER_PAGE);

  // Cálculo de Saldos Individuais (Agora reflete o resultado dos filtros)
  const myStats = React.useMemo(() => {
    if (!filteredLaunches) return { bhCredit: 0, bhDebit: 0, treCredit: 0, treDebit: 0, gseTotal: 0, especialTotal: 0 };
    
    return filteredLaunches.reduce((acc, l) => {
      const type = normalizeStr(l.type || "");
      const minutes = hhmmToMinutes(l.hours || "00:00");
      const days = Number(l.days) || 0;
      const qtdEscala = Number(l.qtdEscala) || 0;

      if (type === "BANCO DE HORAS CREDITO") acc.bhCredit += minutes;
      if (type === "BANCO DE HORAS DEBITO" || type === "FOLGA") acc.bhDebit += minutes;
      if (type === "TRE CREDITO") acc.treCredit += days;
      if (type === "TRE DEBITO") acc.treDebit += days;
      
      // Contagem de Escalas Extras
      if (type.includes("GSE")) acc.gseTotal += qtdEscala;
      if (type.includes("ESPECIAL")) acc.especialTotal += qtdEscala;
      
      return acc;
    }, { bhCredit: 0, bhDebit: 0, treCredit: 0, treDebit: 0, gseTotal: 0, especialTotal: 0 });
  }, [filteredLaunches]);

  const clearFilters = () => {
    setFilterType("");
    setFilterStartDate("");
    setFilterEndDate("");
    setSearchTerm("");
  };

  const handlePrint = () => {
    window.print();
  };

  const hasActiveFilters = filterType !== "" || filterStartDate !== "" || filterEndDate !== "";

  if (loadingAuth || loadingLaunches) {
    return (
      <div className="flex h-full items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const bhTotalMinutes = myStats.bhCredit - myStats.bhDebit;
  const treTotalDays = myStats.treCredit - myStats.treDebit;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12 print:p-0">
      {/* Estilos de Impressão */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4 portrait; margin: 1.5cm; }
          
          html, body, main, [data-sidebar="inset"], .flex-1 { 
            overflow: visible !important; 
            height: auto !important; 
            display: block !important;
            background: white !important;
          }

          .print-hidden, header, nav, footer, aside, .sidebar-provider, .tabs-list, .pagination-controls, .nota-conferencia, .filters-container, .dashboard-stats-cards {
            display: none !important;
          }

          .printable-content {
            display: block !important;
            width: 100% !important;
            color: black !important;
          }

          .report-header {
            margin-bottom: 2rem;
            border-bottom: 2px solid black;
            padding-bottom: 1rem;
          }

          .report-header h1 {
            font-size: 18pt;
            font-weight: 900;
            text-transform: uppercase;
            margin-bottom: 0.5rem;
          }

          .server-info-grid {
            display: grid;
            grid-template-cols: 1fr 1fr;
            gap: 0.5rem;
            font-size: 10pt;
            text-transform: uppercase;
            font-weight: bold;
          }

          .report-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 1rem;
          }

          .report-table th, .report-table td {
            border: 1px solid #000;
            padding: 6px 4px;
            font-size: 8.5pt;
            text-align: center;
            text-transform: uppercase;
          }

          .report-table th {
            background-color: #f0f0f0 !important;
            -webkit-print-color-adjust: exact;
            font-weight: 900;
          }

          .report-table td.observations {
            text-align: left;
            font-size: 7.5pt;
            font-style: italic;
          }
        }
      ` }} />

      {/* ÁREA DE IMPRESSÃO EXCLUSIVA */}
      <div className="hidden printable-content">
        <div className="report-header">
          <h1>Extrato Individual de Lançamentos</h1>
          <div className="server-info-grid">
            <div><span className="opacity-60">Servidor:</span> {employeeData?.name}</div>
            <div><span className="opacity-60">QRA:</span> {employeeData?.qra}</div>
            <div><span className="opacity-60">Matrícula:</span> {employeeData?.matricula}</div>
            <div><span className="opacity-60">Escala:</span> {employeeData?.escala}</div>
            <div><span className="opacity-60">Turno:</span> {employeeData?.turno}</div>
            <div><span className="opacity-60">Gerado em:</span> {new Date().toLocaleString('pt-BR')}</div>
          </div>
        </div>

        <table className="report-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}>Nº</th>
              <th style={{ width: '80px' }}>Data</th>
              <th>Tipo</th>
              <th style={{ width: '50px' }}>Esc.</th>
              <th style={{ width: '50px' }}>Dias</th>
              <th style={{ width: '60px' }}>Horas</th>
              <th>Período</th>
              <th>Observações</th>
            </tr>
          </thead>
          <tbody>
            {filteredLaunches.map((launch) => (
              <tr key={launch.id}>
                <td style={{ fontWeight: 'bold' }}>{launch.launchNumber || "-"}</td>
                <td>{formatDate(launch.date)}</td>
                <td>{launch.type}</td>
                <td>{launch.qtdEscala || "0"}</td>
                <td>{launch.days || "0"}</td>
                <td style={{ fontWeight: 'bold' }}>{launch.hours || "00:00"}</td>
                <td>{launch.startDate ? `${formatDate(launch.startDate)} À ${formatDate(launch.endDate)}` : "-"}</td>
                <td className="observations">{launch.observations || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 print-hidden">
        <div className="flex items-center gap-3">
          <div className="bg-blue-50 p-2 rounded-xl">
            <History className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight uppercase text-primary flex items-center gap-2">
              MEUS LANÇAMENTOS
              <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-blue-100 font-bold px-2 py-0.5 rounded-lg text-xs">
                {filteredLaunches.length}
              </Badge>
            </h2>
            <p className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest">CONSULTA INDIVIDUAL DE REGISTROS E SALDOS NO PERÍODO.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 print-hidden dashboard-stats-cards">
        {/* 1. BANCO DE HORAS INDIVIDUAL */}
        <Card className="card-shadow border-blue-500/20 bg-blue-50/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-bold uppercase">MOVIMENTAÇÃO BANCO DE HORAS</CardTitle>
            <Timer className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-3xl font-black",
              bhTotalMinutes < 0 ? "text-red-600" : "text-blue-700"
            )}>
              {minutesToHHmm(bhTotalMinutes)}H
            </div>
            <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-blue-100">
              <div>
                <p className="text-[8px] font-bold text-muted-foreground uppercase">CRÉDITOS NO FILTRO</p>
                <div className="flex items-center gap-1">
                  <ArrowUpRight className="h-3 w-3 text-green-600" />
                  <p className="text-xs font-bold text-green-600">{minutesToHHmm(myStats.bhCredit)}H</p>
                </div>
              </div>
              <div>
                <p className="text-[8px] font-bold text-muted-foreground uppercase">DÉBITOS NO FILTRO</p>
                <div className="flex items-center gap-1">
                  <ArrowDownRight className="h-3 w-3 text-red-600" />
                  <p className="text-xs font-bold text-red-600">-{minutesToHHmm(myStats.bhDebit)}H</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. TRE INDIVIDUAL (SALDO) */}
        <Card className="card-shadow border-purple-500/20 bg-purple-50/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-bold uppercase">SALDO TRE NO FILTRO</CardTitle>
            <CalendarDays className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-3xl font-black",
              treTotalDays < 0 ? "text-red-600" : "text-purple-700"
            )}>
              {treTotalDays} DIAS
            </div>
            <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-purple-100">
              <div>
                <p className="text-[8px] font-bold text-muted-foreground uppercase">CRÉDITOS</p>
                <div className="flex items-center gap-1">
                  <ArrowUpRight className="h-3 w-3 text-green-600" />
                  <p className="text-xs font-bold text-green-600">{myStats.treCredit}D</p>
                </div>
              </div>
              <div>
                <p className="text-[8px] font-bold text-muted-foreground uppercase">DÉBITOS</p>
                <div className="flex items-center gap-1">
                  <ArrowDownRight className="h-3 w-3 text-red-600" />
                  <p className="text-xs font-bold text-red-600">-{minutesToHHmm(myStats.treDebit)}D</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. ESCALAS EXTRAS INDIVIDUAL */}
        <Card className="card-shadow border-orange-500/20 bg-orange-50/10">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-bold uppercase">ESCALAS EXTRAS NO FILTRO</CardTitle>
            <Briefcase className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-orange-700">
              {myStats.gseTotal + myStats.especialTotal} UNID.
            </div>
            <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-orange-100">
              <div>
                <p className="text-[8px] font-bold text-muted-foreground uppercase">ESCALA GSE</p>
                <p className="text-xs font-bold text-orange-600">{myStats.gseTotal}</p>
              </div>
              <div>
                <p className="text-[8px] font-bold text-muted-foreground uppercase">ESCALA ESPECIAL</p>
                <p className="text-xs font-bold text-orange-600">{myStats.especialTotal}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="card-shadow border-primary/10 overflow-hidden rounded-xl border print:border-none">
        <CardHeader className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 p-4 bg-muted/5 border-b print-hidden filters-container">
          <div className="space-y-1 flex-1">
            <CardTitle className="text-lg font-bold uppercase">Extrato Detalhado</CardTitle>
            <CardDescription className="text-[9px] uppercase font-bold text-muted-foreground">
              Histórico oficial de registros lançados pelo RH.
            </CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="BUSCAR POR Nº OU TIPO..." 
                className="pl-8 uppercase h-9 text-[10px] border-muted/50 bg-background/50" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handlePrint}
                className="gap-2 h-9 font-bold text-xs uppercase border-muted/50 text-slate-600"
              >
                <Printer className="h-4 w-4" />
                IMPRIMIR
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={hasActiveFilters ? "default" : "outline"} size="sm" className="gap-2 h-9 font-bold text-xs uppercase border-muted/50">
                    <Filter className="h-4 w-4" /> 
                    FILTROS
                    {hasActiveFilters && <Badge variant="secondary" className="ml-1 h-4 w-4 p-0 flex items-center justify-center rounded-full text-[8px] bg-white text-primary">!</Badge>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[400px] p-4 rounded-xl shadow-2xl border-muted/20" align="end">
                  <div className="grid gap-4">
                    <div className="flex items-center justify-between border-b pb-2">
                      <h4 className="font-bold uppercase text-[10px] tracking-widest text-primary">FILTROS DE PESQUISA</h4>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearFilters}><X className="h-4 w-4" /></Button>
                    </div>
                    <div className="grid gap-4">
                      <div className="grid gap-1.5">
                        <Label className="text-[9px] uppercase font-bold text-muted-foreground flex items-center gap-2">
                          <CalendarIcon className="h-3 w-3" /> PERÍODO (DE / ATÉ)
                        </Label>
                        <div className="grid grid-cols-2 gap-2">
                          <Input type="date" value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} className="h-9 text-[10px] bg-muted/30 border-none" />
                          <Input type="date" value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} className="h-9 text-[10px] bg-muted/30 border-none" />
                        </div>
                      </div>
                      <div className="grid gap-1.5">
                        <Label className="text-[9px] uppercase font-bold text-muted-foreground">TIPO DE LANÇAMENTO</Label>
                        <Select value={filterType} onValueChange={setFilterType}>
                          <SelectTrigger className="h-9 text-[10px] uppercase bg-muted/30 border-none">
                            <SelectValue placeholder="TODOS OS TIPOS" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ALL" className="uppercase text-[10px]">TODOS OS TIPOS</SelectItem>
                            {launchTypes?.map((t: any) => <SelectItem key={t.id} value={t.name} className="uppercase text-[10px]">{t.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button size="sm" className="w-full uppercase text-[10px] font-bold" onClick={clearFilters}>LIMPAR TUDO</Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto print-hidden">
            <Table>
              <TableHeader className="bg-muted/20">
                <TableRow className="hover:bg-transparent border-b">
                  <TableHead className="w-[60px] font-bold uppercase text-[9px] px-4">Nº</TableHead>
                  <TableHead className="font-bold uppercase text-[9px] min-w-[90px]">DATA</TableHead>
                  <TableHead className="font-bold uppercase text-[9px] min-w-[120px]">TIPO</TableHead>
                  <TableHead className="font-bold uppercase text-[9px] text-center">QTD ESCALAS</TableHead>
                  <TableHead className="font-bold uppercase text-[9px] text-center">DIAS</TableHead>
                  <TableHead className="font-bold uppercase text-[9px] text-center">HORAS</TableHead>
                  <TableHead className="font-bold uppercase text-[9px] min-w-[180px]">PERÍODO (INÍCIO - FIM)</TableHead>
                  <TableHead className="font-bold uppercase text-[9px] min-w-[150px]">OBSERVAÇÕES</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLaunches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center uppercase text-[10px] font-bold text-muted-foreground italic">
                      Nenhum registro encontrado para os filtros aplicados.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedLaunches.map((launch) => {
                    const normType = normalizeStr(launch.type || "");
                    const isBhDebit = normType === "BANCO DE HORAS DEBITO" || normType === "FOLGA";
                    const isTreDebit = normType === "TRE DEBITO";
                    
                    const isVacation = normType.includes("FERIAS");
                    const isMedical = normType.includes("ATESTADO");
                    const isLeave = normType.includes("LICENCA");

                    return (
                      <TableRow key={launch.id} className="hover:bg-blue-50/30 transition-colors">
                        <TableCell className="font-mono font-bold text-[10px] px-4 text-primary">
                          {launch.launchNumber || "-"}
                        </TableCell>
                        <TableCell className="text-[11px] whitespace-nowrap font-medium">
                          {formatDate(launch.date)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(
                            "text-[9px] uppercase font-bold",
                            isVacation ? "bg-blue-600 text-white border-none" :
                            isMedical ? "bg-red-600 text-white border-none" :
                            isLeave ? "bg-purple-600 text-white border-none" :
                            isBhDebit || isTreDebit ? "text-red-700 bg-red-50/50 border-red-200" : "text-blue-700 bg-blue-50/50 border-blue-200"
                          )}>
                            {launch.type || "-"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[11px] font-medium text-center">{launch.qtdEscala || "-"}</TableCell>
                        <TableCell className={cn("text-[11px] font-bold text-center", isTreDebit && "text-red-600")}>
                          {launch.days ? `${isTreDebit ? '-' : ''}${launch.days}` : "-"}
                        </TableCell>
                        <TableCell className={cn("text-[11px] font-black text-center", isBhDebit ? "text-red-600" : "text-blue-600")}>
                          {launch.hours ? `${isBhDebit ? '-' : ''}${launch.hours}H` : "-"}
                        </TableCell>
                        <TableCell className="text-[10px] whitespace-nowrap font-medium">
                          {launch.startDate ? `${formatDate(launch.startDate)} À ${formatDate(launch.endDate)}` : "-"}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-[10px] uppercase text-muted-foreground italic">
                          {launch.observations || "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          
          {totalPages > 1 && (
            <div className="p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted/5 print-hidden pagination-controls">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">
                Exibindo {paginatedLaunches.length} de {filteredLaunches.length} registros (Página {currentPage} de {totalPages})
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
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
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start gap-4 shadow-sm animate-in slide-in-from-bottom-4 duration-700 print-hidden nota-conferencia">
        <div className="bg-white p-2 rounded-lg border shadow-sm shrink-0">
          <Info className="h-5 w-5 text-blue-500" />
        </div>
        <div className="space-y-1">
          <p className="text-[11px] font-black uppercase tracking-tight text-slate-900">Nota de Conferência</p>
          <p className="text-[10px] text-muted-foreground uppercase leading-relaxed font-medium">
          As informações apresentadas são extraídas diretamente do sistema oficial de Recursos Humanos. Caso identifique qualquer inconsistência, favor solicitar a regularização através do e-mail: nrhgm@vilavelha.es.gov.br.
          </p>
        </div>
      </div>
    </div>
  )
}
