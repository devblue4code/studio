"use client"

import * as React from "react"
import { 
  Search, 
  MoreHorizontal, 
  UserPlus, 
  Edit, 
  Trash2, 
  Loader2, 
  Upload, 
  Trash, 
  Filter, 
  X, 
  RefreshCw, 
  Users, 
  CheckCircle2, 
  Clock, 
  UserCheck, 
  ShieldCheck, 
  AlertCircle,
  Plane,
  FileText,
  Stethoscope,
  ChevronDown
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useFirestore, useCollection, useAuth } from '@/firebase';
import { collection, addDoc, doc, deleteDoc, query, orderBy, updateDoc, limit } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import * as XLSX from 'xlsx';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { cn } from "@/lib/utils"

const normalizeStr = (str: string) => str?.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || "";

function generateValidationCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export default function EfetivoPage() {
  const [isAddOpen, setIsAddOpen] = React.useState(false)
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = React.useState(false)
  const [isBatchDeleteAlertOpen, setIsBatchDeleteAlertOpen] = React.useState(false)
  const [selectedEmployee, setSelectedEmployee] = React.useState<any>(null)
  const [employeeToDelete, setEmployeeToDelete] = React.useState<string | null>(null)
  const [selectedIds, setSelectedIds] = React.useState<string[]>([])
  const [searchTerm, setSearchTerm] = React.useState("")
  const [loadingImport, setLoadingImport] = React.useState(false)
  const [generatedCode, setGeneratedCode] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [limitCount, setLimitCount] = React.useState(100)
  
  const [filters, setFilters] = React.useState({
    qra: "",
    name: "",
    escala: "",
    turno: "",
    role: "",
    unit: "",
    status: ""
  })

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const firestore = useFirestore();
  const { toast } = useToast();
  const { employeeData } = useAuth();

  // Query para a tabela (com limite dinâmico)
  const employeesRef = React.useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'employees'), orderBy('qra', 'asc'), limit(limitCount));
  }, [firestore, limitCount]);

  // Query para estatísticas (sem limite)
  const allEmployeesRef = React.useMemo(() => {
    if (!firestore) return null;
    return collection(firestore, 'employees');
  }, [firestore]);

  const schedulesRef = React.useMemo(() => firestore ? query(collection(firestore, 'schedules'), orderBy('name', 'asc')) : null, [firestore]);
  const shiftsRef = React.useMemo(() => firestore ? query(collection(firestore, 'shifts'), orderBy('name', 'asc')) : null, [firestore]);
  const rolesRef = React.useMemo(() => firestore ? query(collection(firestore, 'roles'), orderBy('name', 'asc')) : null, [firestore]);
  const unitsRef = React.useMemo(() => firestore ? query(collection(firestore, 'units'), orderBy('name', 'asc')) : null, [firestore]);

  const { data: employees, loading: loadingCollection } = useCollection(employeesRef);
  const { data: allEmployees } = useCollection(allEmployeesRef);
  const { data: schedules } = useCollection(schedulesRef);
  const { data: shifts } = useCollection(shiftsRef);
  const { data: roles } = useCollection(rolesRef);
  const { data: units } = useCollection(unitsRef);

  // Lógica de Filtragem de Cargos baseada na hierarquia
  const filteredRolesForForm = React.useMemo(() => {
    if (!roles) return [];
    if (!employeeData) return roles;

    const currentUserRole = normalizeStr(employeeData.role || "");
    const isHighCommand = ["COMANDANTE", "INSPETOR GERAL"].some(r => currentUserRole.includes(r));

    // Comandante e Inspetor Geral veem tudo
    if (isHighCommand) return roles;

    // Outros perfis (como Gestor de RH) não podem atribuir cargos de alto comando
    return roles.filter((role: any) => {
      const roleName = normalizeStr(role.name);
      const isRestricted = ["COMANDANTE", "INSPETOR GERAL"].some(r => roleName.includes(r));
      
      // Mantém visível apenas se for o cargo atual do servidor que está sendo editado
      if (selectedEmployee && normalizeStr(selectedEmployee.role) === roleName) {
        return true;
      }

      return !isRestricted;
    });
  }, [roles, employeeData, selectedEmployee]);

  // Estatísticas baseadas no total geral (allEmployees)
  const stats = React.useMemo(() => {
    if (!allEmployees) return { total: 0, active: 0, pending: 0, vacation: 0, leave: 0, medical: 0 };
    return {
      total: allEmployees.length,
      active: allEmployees.filter(e => e.status === "ATIVO").length,
      pending: allEmployees.filter(e => e.status === "PENDENTE").length,
      vacation: allEmployees.filter(e => e.status === "FÉRIAS").length,
      leave: allEmployees.filter(e => e.status === "LICENÇA").length,
      medical: allEmployees.filter(e => e.status === "ATESTADO").length
    };
  }, [allEmployees]);

  React.useEffect(() => {
    if (isAddOpen) {
      setGeneratedCode(generateValidationCode());
    }
  }, [isAddOpen]);

  const filteredEmployees = React.useMemo(() => {
    if (!employees) return [];
    const term = searchTerm.toLowerCase();
    
    return employees.filter(emp => {
      const matchesSearch = !searchTerm || (
        emp.name?.toLowerCase().includes(term) ||
        emp.qra?.toLowerCase().includes(term) ||
        emp.matricula?.toLowerCase().includes(term) ||
        emp.unit?.toLowerCase().includes(term)
      );

      const matchesQra = !filters.qra || emp.qra?.toLowerCase().includes(filters.qra.toLowerCase());
      const matchesName = !filters.name || emp.name?.toLowerCase().includes(filters.name.toLowerCase());
      const matchesEscala = !filters.escala || emp.escala === filters.escala;
      const matchesTurno = !filters.turno || emp.turno === filters.turno;
      const matchesRole = !filters.role || emp.role === filters.role;
      const matchesUnit = !filters.unit || emp.unit === filters.unit;
      const matchesStatus = !filters.status || emp.status === filters.status;

      return matchesSearch && matchesQra && matchesName && matchesEscala && matchesTurno && matchesRole && matchesUnit && matchesStatus;
    });
  }, [employees, searchTerm, filters]);

  function handleAddEmployee(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!firestore) return;

    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const newEmployee = {
      name: (formData.get('name') as string).toUpperCase(),
      email: (formData.get('email') as string || "").toUpperCase(),
      matricula: (formData.get('matricula') as string).toUpperCase(),
      validationCode: (formData.get('validationCode') as string || generatedCode).toUpperCase(),
      escala: (formData.get('escala') as string).toUpperCase(),
      turno: (formData.get('turno') as string).toUpperCase(),
      role: (formData.get('role') as string).toUpperCase(),
      unit: (formData.get('unit') as string).toUpperCase(),
      qra: (formData.get('qra') as string || "").toUpperCase(),
      status: "PENDENTE",
      avatar: `https://picsum.photos/seed/${Math.random()}/100/100`,
      admissionDate: new Date().toISOString().split('T')[0]
    };

    addDoc(collection(firestore, 'employees'), newEmployee)
      .then(() => {
        toast({ title: "SUCESSO!", description: "REGISTRO CRIADO." });
        setIsAddOpen(false);
      })
      .catch((err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: 'employees',
          operation: 'create',
          requestResourceData: newEmployee
        }));
      })
      .finally(() => setIsSubmitting(false));
  }

  function handleUpdateEmployee(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!firestore || !selectedEmployee) return;

    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const updates: any = {
      name: (formData.get('name') as string).toUpperCase(),
      matricula: (formData.get('matricula') as string).toUpperCase(),
      validationCode: (formData.get('validationCode') as string || "").toUpperCase(),
      escala: (formData.get('escala') as string).toUpperCase(),
      turno: (formData.get('turno') as string).toUpperCase(),
      role: (formData.get('role') as string).toUpperCase(),
      unit: (formData.get('unit') as string).toUpperCase(),
      qra: (formData.get('qra') as string || "").toUpperCase(),
      status: (formData.get('status') as string).toUpperCase(),
    };

    const docRef = doc(firestore, 'employees', selectedEmployee.id);
    updateDoc(docRef, updates)
      .then(() => {
        toast({ title: "SUCESSO!", description: "REGISTRO ATUALIZADO." });
        setIsEditOpen(false);
        setSelectedEmployee(null);
      })
      .catch((err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: docRef.path,
          operation: 'update',
          requestResourceData: updates
        }));
      })
      .finally(() => setIsSubmitting(false));
  }

  function handleImportExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !firestore) return;

    setLoadingImport(true);
    const reader = new FileReader();

    reader.onload = (evt) => {
      setTimeout(() => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const data = XLSX.utils.sheet_to_json(ws) as any[];

          data.forEach((row) => {
            const name = (row['SERVIDOR'] || "").toString().toUpperCase();
            const qra = (row['QRAs'] || row['QRA'] || "").toString().toUpperCase();
            const matricula = (row['MATRICULA'] || row['MATRÍCULA'] || "").toString().toUpperCase();
            const validationCode = (row['CÓD. VALIDAÇÃO'] || row['VALIDACAO'] || generateValidationCode()).toString().toUpperCase();
            const escala = (row['ESCALA'] || "").toString().toUpperCase();
            const turno = (row['TURNO'] || "").toString().toUpperCase();
            const role = (row['CARGO'] || "").toString().toUpperCase();
            const unit = (row['SETOR'] || "").toString().toUpperCase();

            if (name && matricula) {
              const payload = {
                name, qra, matricula, validationCode, escala, turno, role, unit,
                status: "PENDENTE",
                avatar: `https://picsum.photos/seed/${Math.random()}/100/100`,
                admissionDate: new Date().toISOString().split('T')[0],
                email: ""
              };
              addDoc(collection(firestore, 'employees'), payload);
            }
          });

          toast({ title: "IMPORTAÇÃO CONCLUÍDA", description: `${data.length} REGISTROS PROCESSADOS.` });
        } catch (error) {
          toast({ variant: "destructive", title: "ERRO NA IMPORTAÇÃO" });
        } finally {
          setLoadingImport(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      }, 50);
    };
    reader.readAsBinaryString(file);
  }

  function confirmDelete() {
    if (!firestore || !employeeToDelete) return;
    const docRef = doc(firestore, 'employees', employeeToDelete);
    setEmployeeToDelete(null);
    setIsDeleteAlertOpen(false);
    deleteDoc(docRef)
      .then(() => toast({ title: "REGISTRO REMOVIDO" }))
      .catch((err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: docRef.path,
          operation: 'delete'
        }));
      });
  }

  function handleBatchDelete() {
    if (!firestore || selectedIds.length === 0) return;
    const idsToRemove = [...selectedIds];
    setSelectedIds([]);
    setIsBatchDeleteAlertOpen(false);
    idsToRemove.forEach(id => {
      const docRef = doc(firestore, 'employees', id);
      deleteDoc(docRef).catch((err) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: docRef.path,
          operation: 'delete'
        }));
      });
    });
    toast({ title: "EXCLUSÃO EM LOTE", description: `${idsToRemove.length} REGISTROS REMOVIDOS.` });
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredEmployees.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredEmployees.map(emp => emp.id));
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  }

  const clearFilters = () => setFilters({ qra: "", name: "", escala: "", turno: "", role: "", unit: "", status: "" });
  const hasActiveFilters = Object.values(filters).some(v => v !== "");

  const handleQuickFilter = (status: string) => {
    setFilters(prev => ({ ...prev, status }));
    toast({ title: "FILTRO ATIVADO", description: status ? `EXIBINDO APENAS: ${status}` : "EXIBINDO TODO O EFETIVO" });
  };

  const renderFormFields = (isEdit: boolean) => (
    <div className="space-y-4 py-4 px-2">
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-center gap-3">
        <div className="bg-white rounded-full p-1 border border-blue-200 shadow-sm">
          <ShieldCheck className="h-4 w-4 text-blue-500" />
        </div>
        <span className="text-blue-600 text-[10px] font-medium uppercase tracking-tight">
          Todos os dados devem ser preenchidos conforme os registros oficiais.
        </span>
      </div>

      <div className="space-y-4">
        <div className="grid gap-1.5">
          <Label htmlFor="name" className="uppercase text-[10px] font-bold text-muted-foreground tracking-wide">NOME COMPLETO</Label>
          <Input id="name" name="name" defaultValue={isEdit ? selectedEmployee?.name : ""} required className="h-11 uppercase text-[11px] bg-background/50" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="qra" className="uppercase text-[10px] font-bold text-muted-foreground tracking-wide">QRA</Label>
            <Input id="qra" name="qra" defaultValue={isEdit ? selectedEmployee?.qra : ""} required className="h-11 uppercase text-[11px] bg-background/50" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="matricula" className="uppercase text-[10px] font-bold text-muted-foreground tracking-wide">MATRÍCULA</Label>
            <Input id="matricula" name="matricula" defaultValue={isEdit ? selectedEmployee?.matricula : ""} required className="h-11 uppercase text-[11px] bg-background/50" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="validationCode" className="uppercase text-[10px] font-bold text-muted-foreground tracking-wide">CÓDIGO DE VALIDAÇÃO</Label>
            <div className="flex gap-2">
              <Input 
                id="validationCode" 
                name="validationCode" 
                value={isEdit ? selectedEmployee?.validationCode : generatedCode} 
                readOnly={!isEdit}
                onChange={(e) => !isEdit && setGeneratedCode(e.target.value.toUpperCase())}
                className="h-11 uppercase font-mono font-bold text-primary bg-muted/30" 
              />
              {!isEdit && (
                <Button type="button" variant="outline" size="icon" className="h-11 w-11" onClick={() => setGeneratedCode(generateValidationCode())}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="status" className="uppercase text-[10px] font-bold text-muted-foreground tracking-wide">STATUS OPERACIONAL</Label>
            <Select name="status" defaultValue={isEdit ? selectedEmployee?.status : "PENDENTE"} disabled={!isEdit}>
              <SelectTrigger className={cn(
                "h-11 uppercase text-[11px] font-bold",
                isEdit && "bg-amber-50 border-amber-200 text-amber-900"
              )}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDENTE" className="uppercase text-[11px] font-bold text-slate-500">PENDENTE (PAG. RH)</SelectItem>
                <SelectItem value="ATIVO" className="uppercase text-[11px] font-bold text-green-600">ATIVO (EM SERVIÇO)</SelectItem>
                <SelectItem value="FÉRIAS" className="uppercase text-[11px] font-bold text-blue-600">FÉRIAS</SelectItem>
                <SelectItem value="LICENÇA" className="uppercase text-[11px] font-bold text-purple-600">LICENÇA</SelectItem>
                <SelectItem value="ATESTADO" className="uppercase text-[11px] font-bold text-red-600">ATESTADO MÉDICO</SelectItem>
                <SelectItem value="INATIVO" className="uppercase text-[11px] font-bold text-slate-600">INATIVO</SelectItem>
              </SelectContent>
            </Select>
            {isEdit && (
              <p className="text-[9px] text-amber-600 font-bold uppercase flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> Alteração manual de status habilitada.
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="grid gap-1.5">
            <Label className="uppercase text-[10px] font-bold text-muted-foreground tracking-wide">SETOR</Label>
            <Select name="unit" defaultValue={isEdit ? selectedEmployee?.unit : undefined} required>
              <SelectTrigger className="h-11 uppercase text-[11px] bg-background/50">
                <SelectValue placeholder="SELECIONE..." />
              </SelectTrigger>
              <SelectContent>
                {units?.map((u: any) => <SelectItem key={u.id} value={u.name} className="uppercase text-[11px]">{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="uppercase text-[10px] font-bold text-muted-foreground tracking-wide">ESCALA</Label>
            <Select name="escala" defaultValue={isEdit ? selectedEmployee?.escala : undefined} required>
              <SelectTrigger className="h-11 uppercase text-[11px] bg-background/50">
                <SelectValue placeholder="SELECIONE..." />
              </SelectTrigger>
              <SelectContent>
                {schedules?.map((s: any) => <SelectItem key={s.id} value={s.name} className="uppercase text-[11px]">{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="turno" className="uppercase text-[10px] font-bold text-muted-foreground tracking-wide">TURNO</Label>
            <Select name="turno" defaultValue={isEdit ? selectedEmployee?.turno : undefined} required>
              <SelectTrigger className="h-11 uppercase text-[11px] bg-background/50">
                <SelectValue placeholder="SELECIONE..." />
              </SelectTrigger>
              <SelectContent>
                {shifts?.map((s: any) => <SelectItem key={s.id} value={s.name} className="uppercase text-[11px]">{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="role" className="uppercase text-[10px] font-bold text-muted-foreground tracking-wide">CARGO</Label>
            <Select name="role" defaultValue={isEdit ? selectedEmployee?.role : undefined} required>
              <SelectTrigger className="h-11 uppercase text-[11px] bg-background/50">
                <SelectValue placeholder="SELECIONE..." />
              </SelectTrigger>
              <SelectContent>
                {filteredRolesForForm?.map((r: any) => <SelectItem key={r.id} value={r.name} className="uppercase text-[11px]">{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight uppercase text-primary">EFETIVO</h2>
          <p className="text-muted-foreground uppercase text-[10px]">GESTÃO INTEGRADA DA UNIDADE.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {selectedIds.length > 0 && (
            <Button 
              variant="destructive" 
              size="sm"
              className="gap-2 uppercase font-bold text-xs h-9 shadow-lg shadow-red-100 animate-in fade-in zoom-in duration-200"
              onClick={() => setIsBatchDeleteAlertOpen(true)}
            >
              <Trash className="h-4 w-4" />
              EXCLUIR ({selectedIds.length})
            </Button>
          )}
          <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputRef} onChange={handleImportExcel} />
          <Button variant="outline" size="sm" className="gap-2 h-9 uppercase font-bold text-xs border-muted/50" onClick={() => fileInputRef.current?.click()} disabled={loadingImport}>
            {loadingImport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            IMPORTAR
          </Button>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2 uppercase font-bold text-xs h-9 shadow-md"><UserPlus className="h-4 w-4" /> NOVO REGISTRO</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] max-h-[95vh] flex flex-col p-0 overflow-hidden rounded-2xl shadow-2xl border-none">
              <form onSubmit={handleAddEmployee} className="flex flex-col h-full">
                <DialogHeader className="p-6 pb-2 border-b flex flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-50 p-1.5 rounded-lg">
                      <UserPlus className="h-5 w-5 text-blue-600" />
                    </div>
                    <DialogTitle className="uppercase text-lg font-bold tracking-tight">Cadastrar Integrante</DialogTitle>
                  </div>
                  <DialogClose className="rounded-full h-8 w-8 flex items-center justify-center bg-muted/30 hover:bg-muted/50 transition-colors">
                    <X className="h-4 w-4" />
                  </DialogClose>
                </DialogHeader>
                <ScrollArea className="flex-1 p-4 sm:p-6">
                  {renderFormFields(false)}
                </ScrollArea>
                <DialogFooter className="p-6 pt-4 border-t grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button variant="secondary" type="button" onClick={() => setIsAddOpen(false)} className="uppercase text-xs font-bold h-11 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 border-none">
                    CANCELAR
                  </Button>
                  <Button type="submit" disabled={isSubmitting} className="uppercase text-xs font-bold h-11 rounded-xl bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all active:scale-95">
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gravar Registro"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-6">
        <Card 
          className={cn(
            "card-shadow border-primary/10 bg-primary/5 rounded-xl cursor-pointer transition-all hover:scale-[1.02] active:scale-95",
            filters.status === "" && "ring-2 ring-primary ring-offset-2"
          )}
          onClick={() => handleQuickFilter("")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-primary">EFETIVO TOTAL</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-[9px] text-muted-foreground uppercase">SERVIDORES CADASTRADOS</p>
          </CardContent>
        </Card>
        <Card 
          className={cn(
            "card-shadow border-green-500/10 bg-green-50/50 rounded-xl cursor-pointer transition-all hover:scale-[1.02] active:scale-95",
            filters.status === "ATIVO" && "ring-2 ring-green-600 ring-offset-2"
          )}
          onClick={() => handleQuickFilter("ATIVO")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-green-600">ATIVOS</CardTitle>
            <UserCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            <p className="text-[9px] text-muted-foreground uppercase">EM SERVIÇO</p>
          </CardContent>
        </Card>
        <Card 
          className={cn(
            "card-shadow border-orange-500/10 bg-orange-50/50 rounded-xl cursor-pointer transition-all hover:scale-[1.02] active:scale-95",
            filters.status === "PENDENTE" && "ring-2 ring-orange-600 ring-offset-2"
          )}
          onClick={() => handleQuickFilter("PENDENTE")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-orange-600">PENDENTES</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.pending}</div>
            <p className="text-[9px] text-muted-foreground uppercase">AGUARDANDO ATIVAÇÃO</p>
          </CardContent>
        </Card>
        <Card 
          className={cn(
            "card-shadow border-blue-500/10 bg-blue-50/50 rounded-xl cursor-pointer transition-all hover:scale-[1.02] active:scale-95",
            filters.status === "FÉRIAS" && "ring-2 ring-blue-600 ring-offset-2"
          )}
          onClick={() => handleQuickFilter("FÉRIAS")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-blue-600">FÉRIAS</CardTitle>
            <Plane className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.vacation}</div>
            <p className="text-[9px] text-muted-foreground uppercase">EM GOZO DE FÉRIAS</p>
          </CardContent>
        </Card>
        <Card 
          className={cn(
            "card-shadow border-purple-500/10 bg-purple-50/50 rounded-xl cursor-pointer transition-all hover:scale-[1.02] active:scale-95",
            filters.status === "LICENÇA" && "ring-2 ring-purple-600 ring-offset-2"
          )}
          onClick={() => handleQuickFilter("LICENÇA")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-purple-600">LICENÇA</CardTitle>
            <FileText className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats.leave}</div>
            <p className="text-[9px] text-muted-foreground uppercase">LICENÇA ESPECIAL/OUTRAS</p>
          </CardContent>
        </Card>
        <Card 
          className={cn(
            "card-shadow border-red-500/10 bg-red-50/50 rounded-xl cursor-pointer transition-all hover:scale-[1.02] active:scale-95",
            filters.status === "ATESTADO" && "ring-2 ring-red-600 ring-offset-2"
          )}
          onClick={() => handleQuickFilter("ATESTADO")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-[10px] font-bold uppercase text-red-600">ATESTADO</CardTitle>
            <Stethoscope className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.medical}</div>
            <p className="text-[9px] text-muted-foreground uppercase">AFASTAMENTO MÉDICO</p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[95vh] flex flex-col p-0 overflow-hidden rounded-2xl shadow-2xl border-none">
          {selectedEmployee && (
            <form onSubmit={handleUpdateEmployee} className="flex flex-col h-full">
              <DialogHeader className="p-6 pb-2 border-b flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-50 p-1.5 rounded-lg">
                    <Edit className="h-5 w-5 text-blue-600" />
                  </div>
                  <DialogTitle className="uppercase text-lg font-bold tracking-tight">Editar Servidor</DialogTitle>
                </div>
                <DialogClose className="rounded-full h-8 w-8 flex items-center justify-center bg-muted/30 hover:bg-muted/50 transition-colors">
                  <X className="h-4 w-4" />
                </DialogClose>
              </DialogHeader>
              <ScrollArea className="flex-1 p-4 sm:p-6">
                {renderFormFields(true)}
              </ScrollArea>
              <DialogFooter className="p-6 pt-4 border-t grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button variant="secondary" type="button" onClick={() => setIsEditOpen(false)} className="uppercase text-xs font-bold h-11 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 border-none">
                  CANCELAR
                </Button>
                <Button type="submit" disabled={isSubmitting} className="uppercase text-xs font-bold h-11 rounded-xl bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar Alterações"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent className="max-w-[90vw] sm:max-w-lg rounded-2xl border-none shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="uppercase text-lg font-bold">Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription className="uppercase text-[10px] font-medium text-muted-foreground">AÇÃO IRREVERSÍVEL. O REGISTRO SERÁ REMOVIDO PERMANENTEMENTE.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel className="uppercase text-xs font-bold rounded-xl h-11 border-none bg-slate-100 text-slate-600 hover:bg-slate-200">CANCELAR</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90 uppercase text-xs font-bold rounded-xl h-11 shadow-lg shadow-red-100">EXCLUIR AGORA</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isBatchDeleteAlertOpen} onOpenChange={setIsBatchDeleteAlertOpen}>
        <AlertDialogContent className="max-w-[90vw] sm:max-w-lg rounded-2xl border-none shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="uppercase text-lg font-bold">Excluir {selectedIds.length} Registros?</AlertDialogTitle>
            <AlertDialogDescription className="uppercase text-[10px] font-medium text-muted-foreground">ESTA AÇÃO É IRREVERSÍVEL E REMOVERÁ TODOS OS ITENS SELECIONADOS.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel className="uppercase text-xs font-bold rounded-xl h-11 border-none bg-slate-100 text-slate-600 hover:bg-slate-200">CANCELAR</AlertDialogCancel>
            <AlertDialogAction onClick={handleBatchDelete} className="bg-destructive hover:bg-destructive/90 uppercase text-xs font-bold rounded-xl h-11 shadow-lg shadow-red-100">EXCLUIR SELECIONADOS</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="card-shadow border-primary/10 overflow-hidden rounded-xl border">
        <CardHeader className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 space-y-0 p-4 bg-muted/5 border-b">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="BUSCAR POR SERVIDOR, MATRÍCULA OU QRA..." className="pl-8 uppercase h-9 text-[10px] border-muted/50 bg-background/50" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
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
                  <h4 className="font-bold uppercase text-[10px] tracking-widest text-primary">FILTROS AVANÇADOS</h4>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearFilters}><X className="h-4 w-4" /></Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label className="text-[9px] uppercase font-bold text-muted-foreground">QRA</Label>
                    <Input className="h-8 text-[10px] uppercase bg-muted/30 border-none" value={filters.qra} onChange={(e) => setFilters({...filters, qra: e.target.value})} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-[9px] uppercase font-bold text-muted-foreground">NOME</Label>
                    <Input className="h-8 text-[10px] uppercase bg-muted/30 border-none" value={filters.name} onChange={(e) => setFilters({...filters, name: e.target.value})} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-[9px] uppercase font-bold text-muted-foreground">STATUS</Label>
                    <Select value={filters.status} onValueChange={(v) => setFilters({...filters, status: v === "ALL" ? "" : v})}>
                      <SelectTrigger className="h-8 text-[10px] uppercase bg-muted/30 border-none">
                        <SelectValue placeholder="TODOS" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL" className="uppercase text-[10px]">TODOS</SelectItem>
                        <SelectItem value="ATIVO" className="uppercase text-[10px]">ATIVO</SelectItem>
                        <SelectItem value="PENDENTE" className="uppercase text-[10px]">PENDENTE</SelectItem>
                        <SelectItem value="FÉRIAS" className="uppercase text-[10px]">FÉRIAS</SelectItem>
                        <SelectItem value="LICENÇA" className="uppercase text-[10px]">LICENÇA</SelectItem>
                        <SelectItem value="ATESTADO" className="uppercase text-[10px]">ATESTADO</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-[9px] uppercase font-bold text-muted-foreground">ESCALA</Label>
                    <Select value={filters.escala} onValueChange={(v) => setFilters({...filters, escala: v === "ALL" ? "" : v})}>
                      <SelectTrigger className="h-8 text-[10px] uppercase bg-muted/30 border-none">
                        <SelectValue placeholder="TODOS" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL" className="uppercase text-[10px]">TODOS</SelectItem>
                        {schedules?.map((s: any) => <SelectItem key={s.id} value={s.name} className="uppercase text-[10px]">{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-[9px] uppercase font-bold text-muted-foreground">TURNO</Label>
                    <Select value={filters.turno} onValueChange={(v) => setFilters({...filters, turno: v === "ALL" ? "" : v})}>
                      <SelectTrigger className="h-8 text-[10px] uppercase bg-muted/30 border-none">
                        <SelectValue placeholder="TODOS" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL" className="uppercase text-[10px]">TODOS</SelectItem>
                        {shifts?.map((s: any) => <SelectItem key={s.id} value={s.name} className="uppercase text-[10px]">{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-[9px] uppercase font-bold text-muted-foreground">CARGO</Label>
                    <Select value={filters.role} onValueChange={(v) => setFilters({...filters, role: v === "ALL" ? "" : v})}>
                      <SelectTrigger className="h-8 text-[10px] uppercase bg-muted/30 border-none">
                        <SelectValue placeholder="TODOS" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL" className="uppercase text-[10px]">TODOS</SelectItem>
                        {roles?.map((r: any) => <SelectItem key={r.id} value={r.name} className="uppercase text-[10px]">{r.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-[9px] uppercase font-bold text-muted-foreground">SETOR</Label>
                    <Select value={filters.unit} onValueChange={(v) => setFilters({...filters, unit: v === "ALL" ? "" : v})}>
                      <SelectTrigger className="h-8 text-[10px] uppercase bg-muted/30 border-none">
                        <SelectValue placeholder="TODOS" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL" className="uppercase text-[10px]">TODOS</SelectItem>
                        {units?.map((u: any) => <SelectItem key={u.id} value={u.name} className="uppercase text-[10px]">{u.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </CardHeader>
        <CardContent className="p-0">
          {loadingCollection ? (
            <div className="flex h-32 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/20">
                    <TableRow className="hover:bg-transparent border-b">
                      <TableHead className="w-[40px] px-4"><Checkbox checked={filteredEmployees.length > 0 && selectedIds.length === filteredEmployees.length} onCheckedChange={toggleSelectAll} /></TableHead>
                      <TableHead className="w-[50px] font-bold uppercase text-[9px] px-2">Nº</TableHead>
                      <TableHead className="font-bold uppercase text-[9px] min-w-[80px]">QRAs</TableHead>
                      <TableHead className="font-bold uppercase text-[9px] min-w-[150px]">SERVIDOR</TableHead>
                      <TableHead className="font-bold uppercase text-[9px] min-w-[100px]">MATRÍCULA</TableHead>
                      <TableHead className="font-bold uppercase text-[9px] min-w-[80px]">ESCALA</TableHead>
                      <TableHead className="font-bold uppercase text-[9px] min-w-[80px]">TURNO</TableHead>
                      <TableHead className="font-bold uppercase text-[9px] min-w-[100px]">CARGO</TableHead>
                      <TableHead className="font-bold uppercase text-[9px] min-w-[80px]">SETOR</TableHead>
                      <TableHead className="font-bold uppercase text-[9px] min-w-[100px]">CÓD. VALIDAÇÃO</TableHead>
                      <TableHead className="font-bold uppercase text-[9px] min-w-[100px]">STATUS</TableHead>
                      <TableHead className="text-right font-bold uppercase text-[9px] min-w-[80px] pr-4">AÇÕES</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEmployees.map((employee, index) => (
                      <TableRow key={employee.id} className="hover:bg-blue-50/30 transition-colors">
                        <TableCell className="px-4"><Checkbox checked={selectedIds.includes(employee.id)} onCheckedChange={() => toggleSelect(employee.id)} /></TableCell>
                        <TableCell className="font-mono text-[9px] text-muted-foreground px-2">{index + 1}</TableCell>
                        <TableCell className="font-bold text-[11px] uppercase text-slate-800">{employee.qra}</TableCell>
                        <TableCell className="font-bold text-[11px] uppercase whitespace-nowrap">{employee.name}</TableCell>
                        <TableCell className="font-mono text-[10px] uppercase whitespace-nowrap text-muted-foreground">{employee.matricula}</TableCell>
                        <TableCell className="text-[10px] uppercase whitespace-nowrap font-medium">{employee.escala}</TableCell>
                        <TableCell className="text-[10px] uppercase whitespace-nowrap font-medium">{employee.turno}</TableCell>
                        <TableCell className="text-[10px] uppercase whitespace-nowrap font-medium">{employee.role}</TableCell>
                        <TableCell><Badge variant="secondary" className="uppercase text-[8px] whitespace-nowrap font-bold bg-muted/50">{employee.unit}</Badge></TableCell>
                        <TableCell className="text-[10px] uppercase font-mono font-bold text-primary">{employee.validationCode || "---"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(
                            "uppercase text-[8px] font-bold whitespace-nowrap",
                            employee.status === "PENDENTE" ? "border-slate-200 text-slate-500 bg-slate-50" : 
                            employee.status === "FÉRIAS" ? "bg-blue-600 text-white border-none" :
                            employee.status === "LICENÇA" ? "bg-purple-600 text-white border-none" :
                            employee.status === "ATESTADO" ? "bg-red-600 text-white border-none" :
                            employee.status === "ATIVO" ? "bg-green-600 text-white border-none" : "bg-slate-400 text-white border-none"
                          )}>
                            {employee.status || "PENDENTE"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl shadow-xl border-muted/50">
                              <DropdownMenuItem onSelect={() => { setSelectedEmployee(employee); setTimeout(() => setIsEditOpen(true), 150); }} className="uppercase text-[10px] py-2 px-3 focus:bg-blue-50 cursor-pointer"><Edit className="mr-2 h-3.5 w-3.5 text-blue-600" /> EDITAR</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onSelect={() => { setEmployeeToDelete(employee.id); setTimeout(() => setIsDeleteAlertOpen(true), 150); }} className="text-destructive uppercase text-[10px] py-2 px-3 focus:bg-red-50 cursor-pointer"><Trash2 className="mr-2 h-3.5 w-3.5" /> EXCLUIR</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {allEmployees && allEmployees.length > employees.length && (
                <div className="p-4 border-t flex justify-center bg-muted/5">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-2 uppercase font-bold text-[10px] h-8 border-primary/20 hover:bg-primary/5 text-primary"
                    onClick={() => setLimitCount(prev => prev + 100)}
                  >
                    <ChevronDown className="h-4 w-4" />
                    CARREGAR MAIS (+100)
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
