
"use client"

import * as React from "react"
import { 
  Plus, 
  Trash2, 
  Loader2, 
  Settings2, 
  Calendar, 
  Clock, 
  Briefcase, 
  FilePlus, 
  LayoutGrid, 
  X,
  History,
  Timer,
  Edit2,
  Check,
  AlertTriangle,
  MapPin
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useFirestore, useCollection } from '@/firebase'
import { collection, addDoc, deleteDoc, doc, query, orderBy, updateDoc } from 'firebase/firestore'
import { useToast } from "@/hooks/use-toast"
import { Separator } from "@/components/ui/separator"
import { errorEmitter } from '@/firebase/error-emitter'
import { FirestorePermissionError } from '@/firebase/errors'
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type Category = 'schedules' | 'shifts' | 'roles' | 'launchTypes' | 'units' | 'shiftPeriods' | 'servicePosts';

const applyTimeMask = (value: string) => {
  let v = value.replace(/\D/g, "");
  if (v.length > 4) v = v.slice(0, 4);
  if (v.length <= 2) return v;
  return `${v.slice(0, 2)}:${v.slice(2)}`;
};

const calculateDuration = (start: string, end: string) => {
  if (start.length !== 5 || end.length !== 5) return "";
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

export default function SettingsPage() {
  const [newValue, setNewValue] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [itemToDelete, setItemToDelete] = React.useState<{ id: string, category: Category } | null>(null)
  
  const [periodData, setPeriodData] = React.useState({
    escalaId: "",
    startTime: "",
    endTime: "",
    duration: ""
  })

  const firestore = useFirestore()
  const { toast } = useToast()

  const schedulesQuery = React.useMemo(() => firestore ? query(collection(firestore, 'schedules'), orderBy('name', 'asc')) : null, [firestore])
  const shiftsQuery = React.useMemo(() => firestore ? query(collection(firestore, 'shifts'), orderBy('name', 'asc')) : null, [firestore])
  const rolesQuery = React.useMemo(() => firestore ? query(collection(firestore, 'roles'), orderBy('name', 'asc')) : null, [firestore])
  const launchTypesQuery = React.useMemo(() => firestore ? query(collection(firestore, 'launchTypes'), orderBy('name', 'asc')) : null, [firestore])
  const unitsQuery = React.useMemo(() => firestore ? query(collection(firestore, 'units'), orderBy('name', 'asc')) : null, [firestore])
  const shiftPeriodsQuery = React.useMemo(() => firestore ? query(collection(firestore, 'shiftPeriods'), orderBy('escalaName', 'asc')) : null, [firestore])
  const servicePostsQuery = React.useMemo(() => firestore ? query(collection(firestore, 'servicePosts'), orderBy('name', 'asc')) : null, [firestore])

  const { data: schedules, loading: loadingSchedules } = useCollection(schedulesQuery)
  const { data: shifts, loading: loadingShifts } = useCollection(shiftsQuery)
  const { data: roles, loading: loadingRoles } = useCollection(rolesQuery)
  const { data: launchTypes, loading: loadingLaunchTypes } = useCollection(launchTypesQuery)
  const { data: units, loading: loadingUnits } = useCollection(unitsQuery)
  const { data: shiftPeriods, loading: loadingShiftPeriods } = useCollection(shiftPeriodsQuery)
  const { data: servicePosts, loading: loadingServicePosts } = useCollection(servicePostsQuery)

  React.useEffect(() => {
    if (periodData.startTime.length === 5 && periodData.endTime.length === 5) {
      const duration = calculateDuration(periodData.startTime, periodData.endTime);
      setPeriodData(prev => ({ ...prev, duration }));
    } else {
      setPeriodData(prev => ({ ...prev, duration: "" }));
    }
  }, [periodData.startTime, periodData.endTime]);

  const handleCancelEdit = () => {
    setEditingId(null)
    setNewValue("")
    setPeriodData({ escalaId: "", startTime: "", endTime: "", duration: "" })
  }

  const handleEditItem = (item: any, category: Category) => {
    setEditingId(item.id)
    if (category === 'shiftPeriods') {
      setPeriodData({
        escalaId: item.escalaId,
        startTime: item.startTime,
        endTime: item.endTime,
        duration: item.duration
      })
    } else {
      setNewValue(item.name)
    }
  }

  const handleAddItem = async (category: Category) => {
    if (!firestore) return
    if (category !== 'shiftPeriods' && !newValue.trim()) return;
    if (category === 'shiftPeriods' && (!periodData.escalaId || !periodData.duration)) {
      toast({ variant: "destructive", title: "ERRO", description: "PREENCHA TODOS OS CAMPOS DO PERÍODO." });
      return;
    }

    setIsSubmitting(true)
    let payload: any = {};
    if (category === 'shiftPeriods') {
      const escala = (schedules as any[]).find((s: any) => s.id === periodData.escalaId);
      payload = {
        escalaId: periodData.escalaId,
        escalaName: escala?.name || "N/A",
        startTime: periodData.startTime,
        endTime: periodData.endTime,
        duration: periodData.duration
      };
    } else {
      payload = { name: newValue.toUpperCase().trim() };
    }

    const docRef = editingId ? doc(firestore, category, editingId) : null;
    const action = editingId ? updateDoc(docRef!, payload) : addDoc(collection(firestore, category), payload);

    action
      .then(() => {
        handleCancelEdit()
        toast({ title: "SUCESSO", description: editingId ? "REGISTRO ATUALIZADO." : "ITEM ADICIONADO." })
      })
      .catch((error: any) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: editingId ? docRef!.path : category,
          operation: editingId ? 'update' : 'create',
          requestResourceData: payload
        }));
      })
      .finally(() => setIsSubmitting(false))
  }

  const triggerDelete = (id: string, category: Category) => {
    setItemToDelete({ id, category });
    setDeleteDialogOpen(true);
  }

  const confirmDelete = async () => {
    if (!firestore || !itemToDelete) return
    const { id, category } = itemToDelete;
    if (editingId === id) handleCancelEdit();
    
    const docRef = doc(firestore, category, id);
    deleteDoc(docRef)
      .then(() => toast({ title: "REMOVIDO", description: "ITEM EXCLUÍDO COM SUCESSO." }))
      .catch((error: any) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: docRef.path,
          operation: 'delete'
        }));
      })
      .finally(() => {
        setDeleteDialogOpen(false);
        setItemToDelete(null);
      });
  }

  const renderSimpleCategoryForm = (category: Category, placeholder: string) => (
    <div className={cn("flex flex-col sm:flex-row gap-3 p-4 rounded-xl border transition-all", editingId ? "bg-amber-50 border-amber-200" : "bg-transparent border-transparent")}>
      <Input 
        placeholder={placeholder} 
        value={newValue}
        onChange={(e) => setNewValue(e.target.value.toUpperCase())}
        onKeyDown={(e) => e.key === 'Enter' && handleAddItem(category)}
        className="uppercase font-semibold text-xs h-11 bg-background/50 focus:bg-background transition-all border-muted"
      />
      <Button 
        onClick={() => handleAddItem(category)} 
        disabled={isSubmitting || !newValue.trim()}
        className={cn("gap-2 w-full sm:w-auto h-11 px-6 uppercase font-bold text-xs shadow-lg rounded-xl transition-all", editingId ? "bg-amber-600 hover:bg-amber-700 shadow-amber-100" : "bg-blue-600 hover:bg-blue-700 shadow-blue-100")}
      >
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        {editingId ? "SALVAR" : "ADICIONAR"}
      </Button>
    </div>
  )

  const renderShiftPeriodsForm = () => (
    <div className={cn("grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-xl border transition-all", editingId ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-100")}>
      <div className="space-y-1.5">
        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Escala</Label>
        <Select value={periodData.escalaId} onValueChange={(v) => setPeriodData(p => ({ ...p, escalaId: v }))}>
          <SelectTrigger className="h-11 uppercase text-xs font-bold bg-white">
            <SelectValue placeholder="SELECIONE..." />
          </SelectTrigger>
          <SelectContent>
            {schedules?.map((s: any) => <SelectItem key={s.id} value={s.id} className="uppercase text-xs font-bold">{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Início</Label>
        <Input placeholder="07:00" value={periodData.startTime} onChange={(e) => setPeriodData(p => ({ ...p, startTime: applyTimeMask(e.target.value) }))} className="h-11 text-center font-mono font-bold bg-white" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Fim</Label>
        <Input placeholder="21:00" value={periodData.endTime} onChange={(e) => setPeriodData(p => ({ ...p, endTime: applyTimeMask(e.target.value) }))} className="h-11 text-center font-mono font-bold bg-white" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Duração</Label>
        <div className="flex gap-2">
          <Input readOnly value={periodData.duration ? `${periodData.duration}H` : ""} placeholder="--" className="h-11 text-center font-mono font-bold bg-blue-50 text-blue-600 border-blue-200 cursor-not-allowed" />
          <Button onClick={() => handleAddItem('shiftPeriods')} disabled={isSubmitting || !periodData.escalaId || !periodData.duration} className={cn("h-11 w-11 p-0 rounded-xl shadow-lg transition-all", editingId ? "bg-amber-600 hover:bg-amber-700 shadow-amber-100" : "bg-blue-600 hover:bg-blue-700 shadow-blue-100")}>
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? <Check className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
          </Button>
        </div>
      </div>
    </div>
  )

  const renderCategoryContent = (category: Category, title: string, description: string, items: any[], loading: boolean, placeholder: string) => (
    <Card className="card-shadow border-none rounded-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
      <CardHeader className="p-6 pb-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl font-bold uppercase flex items-center gap-3">
              {title}
              <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-blue-100 font-bold px-2 py-0.5 rounded-lg text-xs">{items.length}</Badge>
            </CardTitle>
            <CardDescription className="uppercase text-[10px] font-medium tracking-wide text-muted-foreground">{description}</CardDescription>
          </div>
          {editingId && <Button variant="ghost" size="sm" onClick={handleCancelEdit} className="text-muted-foreground uppercase text-[10px] font-bold h-8 hover:bg-muted/50"><X className="h-3 w-3 mr-1" /> CANCELAR EDIÇÃO</Button>}
        </div>
      </CardHeader>
      <CardContent className="p-6 pt-0 space-y-6">
        {category === 'shiftPeriods' ? renderShiftPeriodsForm() : renderSimpleCategoryForm(category, placeholder)}
        <Separator className="bg-muted/50" />
        {loading ? <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" /></div> : items.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-muted/50 rounded-2xl uppercase text-[10px] text-muted-foreground font-bold italic tracking-widest">NENHUM ITEM CADASTRADO.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {items.map((item: any) => (
              <div key={item.id} className={cn("flex items-center justify-between p-4 rounded-xl border bg-background hover:bg-slate-50 transition-all group animate-in fade-in slide-in-from-bottom-2 duration-300", editingId === item.id ? "border-amber-500 bg-amber-50/30" : "border-muted")}>
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-xs uppercase tracking-tight text-slate-700">{category === 'shiftPeriods' ? item.escalaName : item.name}</span>
                  {category === 'shiftPeriods' && (
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-bold uppercase">
                      <Clock className="h-3 w-3" /> {item.startTime} ÀS {item.endTime} <Separator orientation="vertical" className="h-3" /> <Timer className="h-3 w-3 text-primary" /> <span className="text-primary">{item.duration}H</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50 rounded-lg" onClick={() => handleEditItem(item, category)}><Edit2 className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-red-50 rounded-lg transition-colors" onClick={() => triggerDelete(item.id, category)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="flex items-center gap-3">
        <div className="bg-blue-50 p-2 rounded-xl"><Settings2 className="h-6 w-6 text-blue-600" /></div>
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight uppercase text-primary">CONFIGURAÇÃO</h2>
          <p className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest">GERENCIE AS DEFINIÇÕES GERAIS DO SISTEMA.</p>
        </div>
      </div>

      <Tabs defaultValue="launchTypes" className="w-full" onValueChange={() => handleCancelEdit()}>
        <TabsList className="flex flex-wrap items-center justify-start bg-muted/40 p-1.5 rounded-2xl h-auto gap-1">
          <TabsTrigger value="launchTypes" className="flex-1 gap-2 uppercase text-[10px] font-bold py-2.5 rounded-xl transition-all whitespace-nowrap"><FilePlus className="h-4 w-4" /> LANÇAMENTOS</TabsTrigger>
          <TabsTrigger value="shiftPeriods" className="flex-1 gap-2 uppercase text-[10px] font-bold py-2.5 rounded-xl transition-all whitespace-nowrap"><History className="h-4 w-4" /> PERÍODOS</TabsTrigger>
          <TabsTrigger value="servicePosts" className="flex-1 gap-2 uppercase text-[10px] font-bold py-2.5 rounded-xl transition-all whitespace-nowrap"><MapPin className="h-4 w-4" /> POSTOS</TabsTrigger>
          <TabsTrigger value="schedules" className="flex-1 gap-2 uppercase text-[10px] font-bold py-2.5 rounded-xl transition-all whitespace-nowrap"><Calendar className="h-4 w-4" /> ESCALAS</TabsTrigger>
          <TabsTrigger value="shifts" className="flex-1 gap-2 uppercase text-[10px] font-bold py-2.5 rounded-xl transition-all whitespace-nowrap"><Clock className="h-4 w-4" /> TURNOS</TabsTrigger>
          <TabsTrigger value="roles" className="flex-1 gap-2 uppercase text-[10px] font-bold py-2.5 rounded-xl transition-all whitespace-nowrap"><Briefcase className="h-4 w-4" /> CARGOS</TabsTrigger>
          <TabsTrigger value="units" className="flex-1 gap-2 uppercase text-[10px] font-bold py-2.5 rounded-xl transition-all whitespace-nowrap"><LayoutGrid className="h-4 w-4" /> SETORES</TabsTrigger>
        </TabsList>

        <div className="mt-8">
          <TabsContent value="launchTypes">{renderCategoryContent('launchTypes', 'Lançamentos', 'DEFINIÇÕES PARA O BANCO DE HORAS.', launchTypes || [], loadingLaunchTypes, 'EX: OPERAÇÃO, EXTRA, COMPENSAÇÃO...')}</TabsContent>
          <TabsContent value="shiftPeriods">{renderCategoryContent('shiftPeriods', 'Períodos', 'DEFINA OS HORÁRIOS PADRÃO DAS ESCALAS.', shiftPeriods || [], loadingShiftPeriods, '')}</TabsContent>
          <TabsContent value="servicePosts">{renderCategoryContent('servicePosts', 'Postos de Serviço', 'NOMENCLATURAS PARA GUARNIÇÕES E POSTOS FIXOS.', servicePosts || [], loadingServicePosts, 'EX: VTR 001, PB CENTRO, SENTINELA...')}</TabsContent>
          <TabsContent value="schedules">{renderCategoryContent('schedules', 'Escalas', 'DEFINIÇÕES DE ESCALAS DE SERVIÇO.', schedules || [], loadingSchedules, 'EX: 12X36, ADMINISTRATIVA...')}</TabsContent>
          <TabsContent value="shifts">{renderCategoryContent('shifts', 'Turnos', 'DEFINIÇÕES DE TURNOS DE TRABALHO.', shifts || [], loadingShifts, 'EX: DIURNO, ALFA, BRAVO...')}</TabsContent>
          <TabsContent value="roles">{renderCategoryContent('roles', 'Cargos', 'DEFINIÇÕES DE CARGOS NA UNIDADE.', roles || [], loadingRoles, 'EX: INSPETOR, AGENTE...')}</TabsContent>
          <TabsContent value="units">{renderCategoryContent('units', 'Setores', 'DEFINIÇÕES DE SETORES E UNIDADES.', units || [], loadingUnits, 'EX: UNIDADE CENTRO, ADM...')}</TabsContent>
        </div>
      </Tabs>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-[90vw] sm:max-w-lg rounded-2xl border-none shadow-2xl">
          <AlertDialogHeader>
            <div className="bg-red-50 w-12 h-12 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <AlertDialogTitle className="uppercase text-lg font-bold">Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription className="uppercase text-[10px] font-medium text-muted-foreground tracking-wide">
              VOCÊ TEM CERTEZA QUE DESEJA REMOVER ESTE ITEM? ESTA AÇÃO É IRREVERSÍVEL E PODE AFETAR LANÇAMENTOS EXISTENTES.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 gap-2">
            <AlertDialogCancel className="uppercase text-xs font-bold rounded-xl h-11 border-none bg-slate-100 text-slate-600 hover:bg-slate-200">CANCELAR</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive hover:bg-destructive/90 uppercase text-xs font-bold rounded-xl h-11 shadow-lg shadow-red-100">EXCLUIR AGORA</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
