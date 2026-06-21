"use client"

import * as React from "react"
import { 
  CalendarCheck, 
  Search, 
  Loader2, 
  Download,
  CalendarDays,
  Printer,
  FileText
} from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useFirestore, useCollection } from '@/firebase'
import { collection, query, orderBy } from 'firebase/firestore'

const MONTHS = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"
];

const normalizeStr = (str: string) => str?.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || "";

export default function FrequenciaPage() {
  const [searchTerm, setSearchTerm] = React.useState("")
  const [selectedMonth, setSelectedMonth] = React.useState(new Date().getMonth())
  const [selectedYear, setSelectedYear] = React.useState(new Date().getFullYear())
  
  const firestore = useFirestore()

  // Consultas ao Firestore
  const employeesRef = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'employees'), orderBy('name', 'asc'));
  }, [firestore]);

  const launchesRef = React.useMemo(() => {
    if (!firestore) return null;
    return collection(firestore, 'launches');
  }, [firestore]);

  const { data: employees, loading: loadingEmployees } = useCollection(employeesRef);
  const { data: launches, loading: loadingLaunches } = useCollection(launchesRef);

  // Busca nomes das autoridades para assinatura
  const authorities = React.useMemo(() => {
    if (!employees) return { comandante: "NOME NÃO LOCALIZADO", inspetorGeral: "NOME NÃO LOCALIZADO" };
    
    const comandante = employees.find(e => normalizeStr(e.role).includes("COMANDANTE"))?.name || "NOME NÃO LOCALIZADO";
    const inspetorGeral = employees.find(e => normalizeStr(e.role).includes("INSPETOR GERAL"))?.name || "NOME NÃO LOCALIZADO";
    
    return { comandante, inspetorGeral };
  }, [employees]);

  // Cálculo de dias no mês selecionado
  const daysInMonthCount = React.useMemo(() => {
    return new Date(selectedYear, selectedMonth + 1, 0).getDate();
  }, [selectedMonth, selectedYear]);

  // Anos para o seletor (2024 até 2030)
  const years = React.useMemo(() => {
    const startYear = 2024;
    const endYear = 2030;
    const list = [];
    for (let i = startYear; i <= endYear; i++) list.push(i);
    return list;
  }, []);

  // Lógica de filtragem por Nome, Matrícula ou QRA
  const filteredData = React.useMemo(() => {
    if (!employees) return [];
    const term = searchTerm.toLowerCase();
    return employees.filter(emp => 
      emp.name?.toLowerCase().includes(term) ||
      emp.matricula?.toLowerCase().includes(term) ||
      emp.qra?.toLowerCase().includes(term)
    );
  }, [employees, searchTerm]);

  // Função para calcular interseção de dias entre o lançamento e o mês selecionado
  const calculateIntersectionDays = (startDateStr: string, endDateStr: string) => {
    if (!startDateStr || !endDateStr) return 0;

    const monthStart = new Date(selectedYear, selectedMonth, 1, 0, 0, 0);
    const monthEnd = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);
    
    const launchStart = new Date(startDateStr + "T00:00:00");
    const launchEnd = new Date(endDateStr + "T23:59:59");

    const overlapStart = launchStart > monthStart ? launchStart : monthStart;
    const overlapEnd = launchEnd < monthEnd ? launchEnd : monthEnd;

    if (overlapStart <= overlapEnd) {
      const diffTime = Math.abs(overlapEnd.getTime() - overlapStart.getTime());
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    return 0;
  };

  const handlePrint = () => {
    window.print();
  };

  if (loadingEmployees || loadingLaunches) {
    return (
      <div className="flex h-full items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12 print:p-0 print:space-y-4">
      {/* Configurações de Impressão via Style Tag */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4 portrait; margin: 1.5cm; }
          
          /* Forçar visibilidade total dos containers pais */
          html, body, main, [data-sidebar="inset"], .flex-1 { 
            overflow: visible !important; 
            height: auto !important; 
            display: block !important;
            background: white !important;
          }

          .card-shadow { box-shadow: none !important; border: 1px solid #e2e8f0 !important; }
          
          /* Remove barras de rolagem e containers de scroll */
          .overflow-x-auto { overflow: visible !important; }
          ::-webkit-scrollbar { display: none !important; }
          * { -ms-overflow-style: none !important; scrollbar-width: none !important; }

          /* Garante que o conteúdo ocupe a largura total sem scroll */
          .print-w-full { width: 100% !important; }
          table { width: 100% !important; table-layout: auto !important; }

          /* Estilo explícito para o bloco de assinatura aparecer mais abaixo */
          .signature-block {
            display: flex !important;
            visibility: visible !important;
            margin-top: 10rem !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          /* Nova Página para o Detalhamento */
          .print-new-page {
            break-before: page !important;
            margin-top: 2cm !important;
          }
        }
      ` }} />

      {/* Cabeçalho de Impressão (Visível apenas na folha) */}
      <div className="hidden print:block mb-6">
        <div className="flex justify-between items-end border-b-2 border-primary pb-4">
          <div>
            <h1 className="text-2xl font-black uppercase text-primary tracking-tight">Mapa de Frequência</h1>
            <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Referência: {MONTHS[selectedMonth]} / {selectedYear}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase text-slate-900 tracking-tight">Núcleo de RH - GMVV</p>
            <p className="text-[8px] font-mono font-bold text-muted-foreground uppercase">Gerado em: {new Date().toLocaleString('pt-BR')}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-xl">
            <CalendarCheck className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight uppercase text-primary">MAPA DE FREQUÊNCIA</h2>
            <p className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest">CONSOLIDADO ESTRATÉGICO DA UNIDADE.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="h-9 uppercase font-bold text-[10px] gap-2 border-primary/20 hover:bg-primary/5 text-primary"
            onClick={handlePrint}
          >
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
          <Button variant="outline" size="sm" className="h-9 uppercase font-bold text-[10px] gap-2 border-primary/20 hover:bg-primary/5 text-primary">
            <Download className="h-4 w-4" /> Exportar
          </Button>
        </div>
      </div>

      <Card className="card-shadow border-primary/10 overflow-hidden rounded-xl border">
        <CardHeader className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4 p-4 bg-muted/5 border-b print:hidden">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="BUSCAR POR NOME, QRA OU MATRÍCULA..." 
              className="pl-8 uppercase h-9 text-[11px] border-muted/50 bg-background/50 focus:bg-background transition-colors" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                <SelectTrigger className="h-9 w-[140px] uppercase text-[11px] font-bold bg-background/50">
                  <SelectValue placeholder="MÊS" />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month, idx) => (
                    <SelectItem key={idx} value={idx.toString()} className="uppercase text-[11px] font-bold">
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="h-9 w-[100px] uppercase text-[11px] font-bold bg-background/50">
                <SelectValue placeholder="ANO" />
              </SelectTrigger>
              <SelectContent>
                {years.map(year => (
                  <SelectItem key={year} value={year.toString()} className="uppercase text-[11px] font-bold">
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-blue-100 font-bold px-3 py-1 rounded-lg text-[11px] h-9 whitespace-nowrap">
              {filteredData.length} SERVIDORES
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/20 print:bg-slate-100">
                <TableRow className="hover:bg-transparent border-b">
                  <TableHead className="font-bold uppercase text-[11px] w-[50px] text-center print:text-black">Nº</TableHead>
                  <TableHead className="font-bold uppercase text-[11px] min-w-[80px] print:text-black">MATRÍCULA</TableHead>
                  <TableHead className="font-bold uppercase text-[11px] min-w-[200px] print:text-black">NOME COMPLETO</TableHead>
                  <TableHead className="font-bold uppercase text-[11px] text-center bg-blue-50/50 text-blue-700 print:text-black print:bg-transparent">PRESENÇA</TableHead>
                  <TableHead className="font-bold uppercase text-[11px] text-center print:text-black">ESPECIAL</TableHead>
                  <TableHead className="font-bold uppercase text-[11px] text-center print:text-black">FOLGA/TRE</TableHead>
                  <TableHead className="font-bold uppercase text-[11px] text-center print:text-black">FÉRIAS</TableHead>
                  <TableHead className="font-bold uppercase text-[11px] text-center print:text-black">ATESTADO</TableHead>
                  <TableHead className="font-bold uppercase text-[11px] text-center print:text-black">ABONO</TableHead>
                  <TableHead className="font-bold uppercase text-[11px] text-center print:text-black">FALTA</TableHead>
                  <TableHead className="font-bold uppercase text-[11px] text-center print:text-black">LICENÇA</TableHead>
                  <TableHead className="font-bold uppercase text-[11px] text-center bg-muted/30 print:text-black print:bg-transparent">TOTAL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="h-32 text-center uppercase text-[12px] font-bold text-muted-foreground italic tracking-widest">
                      NENHUM SERVIDOR ENCONTRADO PARA OS FILTROS APLICADOS.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((emp, index) => {
                    const employeeLaunches = (launches || []).filter(l => l.employeeId === emp.id);

                    let special = 0;
                    let folga = 0;
                    let ferias = 0;
                    let atestado = 0;
                    let abono = 0;
                    let falta = 0;
                    let licenca = 0;

                    employeeLaunches.forEach(l => {
                      const type = normalizeStr(l.type || "");
                      
                      if (type === "ESCALA ESPECIAL") {
                        const start = new Date(l.startDate + "T00:00:00");
                        if (start.getMonth() === selectedMonth && start.getFullYear() === selectedYear) {
                          special += (Number(l.qtdEscala) || 0);
                        }
                      } 
                      else {
                        const intersectionDays = calculateIntersectionDays(l.startDate, l.endDate);
                        
                        if (intersectionDays > 0) {
                          if (type.includes("FOLGA") || type.includes("TRE DEBITO")) {
                            folga += intersectionDays;
                          } else if (type.includes("FERIAS")) {
                            ferias += intersectionDays;
                          } else if (type.includes("ATESTADO")) {
                            atestado += intersectionDays;
                          } else if (type.includes("ABONO") && !type.includes("PREV. SAUDE")) {
                            abono += intersectionDays;
                          } else if (type.includes("FALTA")) {
                            falta += intersectionDays;
                          } else if (type.includes("LICENCA")) {
                            licenca += intersectionDays;
                          }
                        }
                      }
                    });

                    const totalAbsences = folga + ferias + atestado + abono + falta + licenca;
                    const presence = daysInMonthCount - totalAbsences;
                    const finalTotal = presence + totalAbsences;

                    return (
                      <TableRow key={emp.id} className="hover:bg-blue-50/30 transition-colors border-b print:hover:bg-transparent">
                        <TableCell className="font-mono text-[11px] text-center text-muted-foreground print:text-black">{index + 1}</TableCell>
                        <TableCell className="font-mono text-[12px] uppercase font-bold text-slate-600 print:text-black">{emp.matricula}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-bold text-[13px] uppercase text-slate-800 leading-tight print:text-black">{emp.name}</span>
                            <span className="text-[10px] text-primary uppercase font-bold tracking-tighter print:text-slate-500">QRA: {emp.qra}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-mono text-[14px] font-black text-blue-700 bg-blue-50/20 print:text-black print:bg-transparent">{presence}</TableCell>
                        <TableCell className="text-center font-mono text-[15px] font-bold text-amber-600 print:text-black">
                          {special > 0 ? `${(special * 22.5).toString().replace('.', ',')}%` : "0%"}
                        </TableCell>
                        <TableCell className="text-center font-mono text-[15px] print:text-black">{folga || "0"}</TableCell>
                        <TableCell className="text-center font-mono text-[15px] print:text-black">{ferias || "0"}</TableCell>
                        <TableCell className="text-center font-mono text-[15px] print:text-black">{atestado || "0"}</TableCell>
                        <TableCell className="text-center font-mono text-[15px] print:text-black">{abono || "0"}</TableCell>
                        <TableCell className="text-center font-mono text-[15px] text-red-600 font-bold print:text-black">{falta || "0"}</TableCell>
                        <TableCell className="text-center font-mono text-[15px] print:text-black">{licenca || "0"}</TableCell>
                        <TableCell className="text-center font-mono text-[14px] font-black bg-muted/5 print:text-black print:bg-transparent">{finalTotal}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Rodapé de Assinaturas (Configurado para sempre aparecer no papel) */}
      <div className="hidden print:flex signature-block mt-20 justify-around gap-12 text-center px-4" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
        <div className="flex flex-col items-center gap-1 w-full max-w-[320px]">
          <div className="border-t border-slate-900 w-full mb-3"></div>
          <p className="text-[13px] font-black uppercase text-slate-900 leading-tight tracking-tight">{authorities.comandante}</p>
          <p className="text-[11px] font-bold uppercase text-muted-foreground tracking-widest">COMANDANTE - GMVV</p>
        </div>
        <div className="flex flex-col items-center gap-1 w-full max-w-[320px]">
          <div className="border-t border-slate-900 w-full mb-3"></div>
          <p className="text-[13px] font-black uppercase text-slate-900 leading-tight tracking-tight">{authorities.inspetorGeral}</p>
          <p className="text-[11px] font-bold uppercase text-muted-foreground tracking-widest">INSPETOR GERAL - GMVV</p>
        </div>
      </div>

      {/* RELATÓRIO DETALHADO (VISÍVEL APENAS NA IMPRESSÃO - NOVA PÁGINA) */}
      <div className="hidden print:block print-new-page space-y-8">
        <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-slate-900" />
            <div>
              <h2 className="text-xl font-black uppercase text-slate-900 tracking-tight">Detalhamento por Servidor</h2>
              <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Discriminativo de Afastamentos e Escalas Especiais</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase">{MONTHS[selectedMonth]} / {selectedYear}</p>
          </div>
        </div>

        <div className="space-y-6">
          {filteredData.filter(emp => {
            const empLaunches = (launches || []).filter(l => l.employeeId === emp.id);
            return empLaunches.some(l => {
              const type = normalizeStr(l.type || "");
              if (type.includes("PREV. SAUDE")) return false;
              if (type === "ESCALA ESPECIAL") {
                const start = new Date(l.startDate + "T00:00:00");
                return start.getMonth() === selectedMonth && start.getFullYear() === selectedYear;
              }
              return calculateIntersectionDays(l.startDate, l.endDate) > 0;
            });
          }).map(emp => {
            // Refiltragem dos lançamentos para garantir que apenas os do mês atual apareçam no detalhamento
            const empLaunches = (launches || []).filter(l => {
              if (l.employeeId !== emp.id) return false;
              const type = normalizeStr(l.type || "");
              if (type.includes("PREV. SAUDE")) return false;
              if (type === "ESCALA ESPECIAL") {
                const start = new Date(l.startDate + "T00:00:00");
                return start.getMonth() === selectedMonth && start.getFullYear() === selectedYear;
              }
              return calculateIntersectionDays(l.startDate, l.endDate) > 0;
            }).sort((a, b) => a.startDate.localeCompare(b.startDate));
            
            return (
              <div key={emp.id} className="p-4 border border-slate-200 rounded-xl space-y-3 bg-slate-50/10" style={{ breakInside: 'avoid' }}>
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-sm font-black uppercase text-slate-900">{emp.name} (QRA {emp.qra})</span>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">MAT: {emp.matricula}</span>
                </div>
                
                <div className="grid grid-cols-1 gap-2">
                  {empLaunches.map((l, idx) => {
                    const type = normalizeStr(l.type || "");
                    const isExtraScale = type.includes("ESCALA ESPECIAL") || type.includes("ESCALA GSE");
                    let displayInfo = "";

                    if (isExtraScale) {
                      displayInfo = `DATA: ${l.startDate.split('-').reverse().join('/')} | QTD: ${l.qtdEscala || 0} UNID.`;
                    } else {
                      const intersection = calculateIntersectionDays(l.startDate, l.endDate);
                      displayInfo = `PERÍODO: ${l.startDate.split('-').reverse().join('/')} À ${l.endDate.split('-').reverse().join('/')} | ${intersection} DIA(S) NO MÊS`;
                    }

                    return (
                      <div key={idx} className="flex items-start gap-2 text-[11px]">
                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                        <div className="flex-1">
                          <span className="font-black uppercase text-slate-700">{l.type}:</span>
                          <span className="ml-2 font-medium text-slate-600 uppercase">{displayInfo}</span>
                          {l.observations && (
                            <p className="text-[9px] text-muted-foreground italic mt-0.5 leading-tight">OBS: {l.observations}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
