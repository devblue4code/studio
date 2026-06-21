"use client"

import * as React from "react"
import { 
  Search, 
  Loader2, 
  FileText,
  User,
  Phone,
  MapPin,
  Fingerprint,
  Baby,
  Heart,
  Calendar,
  ExternalLink,
  MapPinned,
  CreditCard,
  Printer,
  X
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
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useFirestore, useCollection } from '@/firebase'
import { collection, query, orderBy } from 'firebase/firestore'

export default function DadosPerfilPage() {
  const [searchTerm, setSearchTerm] = React.useState("")
  const [searchCnh, setSearchCnh] = React.useState("")
  const [searchCity, setSearchCity] = React.useState("")
  const firestore = useFirestore()

  const employeesRef = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'employees'), orderBy('name', 'asc'));
  }, [firestore]);

  const { data: employees, loading } = useCollection(employeesRef);

  // Filtra apenas servidores que ativaram a conta (possuem UID)
  const activatedEmployees = React.useMemo(() => {
    if (!employees) return [];
    return employees.filter(emp => !!emp.uid);
  }, [employees]);

  const filteredData = React.useMemo(() => {
    const term = searchTerm.toLowerCase();
    const cnhTerm = searchCnh.toLowerCase();
    const cityTerm = searchCity.toLowerCase();

    return activatedEmployees.filter(emp => {
      const matchesGeneral = 
        emp.name?.toLowerCase().includes(term) ||
        emp.qra?.toLowerCase().includes(term) ||
        emp.matricula?.toLowerCase().includes(term);
      
      const matchesCnh = !searchCnh || emp.cnhCategory?.toLowerCase().includes(cnhTerm);
      const matchesCity = !searchCity || emp.votingCity?.toLowerCase().includes(cityTerm);

      return matchesGeneral && matchesCnh && matchesCity;
    });
  }, [activatedEmployees, searchTerm, searchCnh, searchCity]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderInfoRow = (label: string, value: any, icon?: React.ReactNode) => (
    <div className="flex flex-col space-y-1 py-2 border-b border-slate-100 last:border-0">
      <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1.5">
        {icon} {label}
      </span>
      <span className="text-[11px] font-bold uppercase text-slate-800">{value || "---"}</span>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12 print:p-0 print:space-y-0">
      {/* Estilos Globais de Impressão */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4 portrait; margin: 1.5cm; }
          
          /* Remove interface do sistema */
          header, nav, aside, footer, .print-hidden, [data-sidebar="inset"] header {
            display: none !important;
          }

          /* Ajusta container principal */
          body, main, .flex-1, [data-sidebar="inset"] {
            overflow: visible !important;
            height: auto !important;
            background: white !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
          }

          /* Remove bordas de card e sombras */
          .card-shadow, .border {
            box-shadow: none !important;
            border: none !important;
          }

          /* Tabela Profissional */
          table { width: 100% !important; border-collapse: collapse !important; }
          th { background-color: #f8fafc !important; -webkit-print-color-adjust: exact; color: black !important; border: 1px solid #e2e8f0 !important; }
          td { border: 1px solid #e2e8f0 !important; color: black !important; padding: 6px 4px !important; }
          
          /* Garante que o cabeçalho se repita em novas páginas */
          thead { display: table-header-group; }
          tr { page-break-inside: avoid; }

          /* Oculta coluna de detalhes na impressão */
          .col-actions { display: none !important; }
        }
      ` }} />

      {/* Cabeçalho de Impressão (Visível apenas no papel) */}
      <div className="hidden print:block mb-8 border-b-2 border-primary pb-4">
        <div className="flex justify-between items-end">
          <div className="space-y-1">
            <h1 className="text-2xl font-black uppercase tracking-tight text-primary leading-none">NRH - GMVV</h1>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-600">Relatório Consolidado de Fichas Funcionais</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase text-slate-900">Referência: Efetivo Ativo</p>
            <p className="text-[8px] font-mono font-bold text-muted-foreground uppercase mt-1">Gerado em: {new Date().toLocaleString('pt-BR')}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="bg-blue-50 p-2 rounded-xl">
            <FileText className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight uppercase text-primary flex items-center gap-2">
              DADOS PERFIL
              <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-blue-100 font-bold px-2 py-0.5 rounded-lg text-xs">
                {filteredData.length}
              </Badge>
            </h2>
            <p className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest">AUDITORIA DE FICHAS FUNCIONAIS ATIVAS.</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          onClick={handlePrint}
          className="gap-2 uppercase font-black text-xs h-10 border-blue-200 text-blue-700 hover:bg-blue-50"
        >
          <Printer className="h-4 w-4" />
          Gerar Relatório
        </Button>
      </div>

      <Card className="card-shadow border-primary/10 overflow-hidden rounded-xl border print:border-none">
        <CardHeader className="p-4 bg-muted/5 border-b space-y-4 print:hidden">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="relative sm:col-span-6">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="BUSCAR POR NOME, QRA OU MATRÍCULA..." 
                className="pl-8 uppercase h-9 text-[10px] border-muted/50 bg-background/50" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="relative sm:col-span-2">
              <CreditCard className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="CAT. CNH..." 
                className="pl-8 uppercase h-9 text-[10px] border-muted/50 bg-background/50" 
                value={searchCnh}
                onChange={(e) => setSearchCnh(e.target.value)}
              />
            </div>
            <div className="relative sm:col-span-4">
              <MapPinned className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="CIDADE VOTAÇÃO..." 
                className="pl-8 uppercase h-9 text-[10px] border-muted/50 bg-background/50" 
                value={searchCity}
                onChange={(e) => setSearchCity(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-between items-center pt-2">
            <div className="flex gap-2">
              { (searchTerm || searchCnh || searchCity) && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-[9px] font-bold uppercase text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => { setSearchTerm(""); setSearchCnh(""); setSearchCity(""); }}
                >
                  <X className="h-3 w-3 mr-1" /> Limpar Filtros
                </Button>
              ) }
            </div>
            <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-blue-100 font-bold px-3 py-1 rounded-lg text-xs">
              {filteredData.length} SERVIDORES ENCONTRADOS
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/20">
                <TableRow className="hover:bg-transparent border-b">
                  <TableHead className="font-bold uppercase text-[9px] min-w-[180px]">SERVIDOR / QRA</TableHead>
                  <TableHead className="font-bold uppercase text-[9px] min-w-[100px]">MATRÍCULA</TableHead>
                  <TableHead className="font-bold uppercase text-[9px] min-w-[120px]">CPF</TableHead>
                  <TableHead className="font-bold uppercase text-[9px] min-w-[130px]">TELEFONE</TableHead>
                  <TableHead className="font-bold uppercase text-[9px] min-w-[70px] text-center">CAT.</TableHead>
                  <TableHead className="font-bold uppercase text-[9px] min-w-[150px]">LOCAL VOTAÇÃO</TableHead>
                  <TableHead className="font-bold uppercase text-[9px] min-w-[150px]">CIDADE</TableHead>
                  <TableHead className="font-bold uppercase text-[9px] min-w-[80px] text-center col-actions">DETALHES</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center uppercase text-[10px] font-bold text-muted-foreground italic tracking-widest">
                      NENHUM PERFIL ENCONTRADO PARA ESTA BUSCA.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((emp) => (
                    <TableRow key={emp.id} className="hover:bg-blue-50/30 transition-colors">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold text-[11px] uppercase text-slate-800 leading-tight">{emp.name}</span>
                          <span className="text-[9px] text-primary uppercase font-bold tracking-tighter">QRA: {emp.qra} • {emp.role}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-[10px] uppercase font-bold text-slate-600">{emp.matricula}</TableCell>
                      <TableCell className="font-mono text-[10px] uppercase font-bold text-slate-600">{emp.cpf || "---"}</TableCell>
                      <TableCell className="text-[10px] font-bold text-slate-600 uppercase">{emp.phone || "---"}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-[9px] font-black uppercase border-slate-200 text-slate-700 bg-white px-2">
                          {emp.cnhCategory || "---"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-[10px] font-bold text-slate-600 uppercase block max-w-[150px] truncate">{emp.votingLocation || "---"}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-[10px] font-bold text-slate-600 uppercase">{emp.votingCity || "---"}</span>
                      </TableCell>
                      <TableCell className="text-center col-actions">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-blue-50 text-blue-600">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-[95vw] sm:max-w-3xl rounded-2xl border-none shadow-2xl p-0 overflow-hidden">
                            <DialogHeader className="bg-primary p-6 text-white">
                              <div className="flex items-center gap-4">
                                <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
                                  <User className="h-8 w-8 text-white" />
                                </div>
                                <div className="min-w-0">
                                  <DialogTitle className="text-2xl font-black uppercase tracking-tight leading-none truncate">{emp.name}</DialogTitle>
                                  <p className="text-[10px] font-bold uppercase opacity-80 tracking-widest mt-1">
                                    QRA: {emp.qra} • MAT: {emp.matricula} • {emp.status}
                                  </p>
                                </div>
                              </div>
                            </DialogHeader>
                            <ScrollArea className="max-h-[70vh]">
                              <div className="p-6 space-y-8">
                                <div className="space-y-4">
                                  <div className="flex items-center gap-2 border-b pb-2">
                                    <Fingerprint className="h-4 w-4 text-blue-600" />
                                    <h4 className="text-xs font-black uppercase text-slate-900 tracking-widest">Documentos & Pessoais</h4>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    {renderInfoRow("CPF", emp.cpf)}
                                    {renderInfoRow("Data Nascimento", emp.birthDate?.split('-').reverse().join('/'), <Calendar className="h-2.5 w-2.5" />)}
                                    {renderInfoRow("Admissão", emp.admissionDate?.split('-').reverse().join('/'), <Calendar className="h-2.5 w-2.5" />)}
                                    {renderInfoRow("CNH (Nº)", emp.cnhNumber)}
                                    {renderInfoRow("CNH (Cat)", emp.cnhCategory, <CreditCard className="h-2.5 w-2.5" />)}
                                    {renderInfoRow("CNH (Val)", emp.cnhExpiration?.split('-').reverse().join('/'))}
                                    {renderInfoRow("Título Eleitor", emp.voterId)}
                                    {renderInfoRow("Zona", emp.voterZone)}
                                    {renderInfoRow("Local Votação", emp.votingLocation)}
                                    {renderInfoRow("Cidade Votação", emp.votingCity, <MapPinned className="h-2.5 w-2.5" />)}
                                  </div>
                                </div>

                                <div className="space-y-4">
                                  <div className="flex items-center gap-2 border-b pb-2">
                                    <MapPin className="h-4 w-4 text-blue-600" />
                                    <h4 className="text-xs font-black uppercase text-slate-900 tracking-widest">Contato & Endereço</h4>
                                  </div>
                                  <div className="grid grid-cols-1 gap-4">
                                    {renderInfoRow("Endereço Completo", emp.address, <MapPin className="h-2.5 w-2.5" />)}
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                      {renderInfoRow("Telefone", emp.phone, <Phone className="h-2.5 w-2.5" />)}
                                      {renderInfoRow("Contato Emergência", emp.emergencyContactName)}
                                      {renderInfoRow("Tel. Emergência", emp.emergencyPhone, <Phone className="h-2.5 w-2.5" />)}
                                    </div>
                                  </div>
                                </div>

                                <div className="space-y-4">
                                  <div className="flex items-center gap-2 border-b pb-2">
                                    <Heart className="h-4 w-4 text-red-600" />
                                    <h4 className="text-xs font-black uppercase text-slate-900 tracking-widest">Família & Dependentes</h4>
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {renderInfoRow("Cônjuge", emp.spouseName)}
                                  </div>
                                  {emp.children && emp.children.length > 0 && (
                                    <div className="space-y-2 mt-4">
                                      <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-1.5">
                                        <Baby className="h-2.5 w-2.5" /> Filhos / Dependentes
                                      </span>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {emp.children.map((child: any, idx: number) => (
                                          <div key={idx} className="p-2 bg-slate-50 rounded-lg border border-slate-100 flex flex-col gap-1">
                                            <div className="flex justify-between items-center">
                                              <span className="text-[10px] font-bold uppercase">{child.name}</span>
                                              <Badge variant="secondary" className="text-[8px] font-black">{child.age} ANOS</Badge>
                                            </div>
                                            {child.cpf && (
                                              <span className="text-[9px] font-mono font-bold text-muted-foreground">CPF: {child.cpf}</span>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </ScrollArea>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-start gap-4 print:hidden">
        <div className="bg-white p-2 rounded-lg border shadow-sm shrink-0">
          <Printer className="h-5 w-5 text-blue-500" />
        </div>
        <div className="space-y-1">
          <p className="text-[11px] font-black uppercase text-slate-900 leading-none">Dica de Impressão</p>
          <p className="text-[10px] text-muted-foreground uppercase leading-relaxed font-bold mt-1">
            Ao gerar o relatório, o sistema ajustará a lista automaticamente para o formato A4 Retrato. Utilize os filtros de busca para imprimir listas específicas (ex: apenas motoristas ou servidores de uma cidade).
          </p>
        </div>
      </div>
    </div>
  );
}
