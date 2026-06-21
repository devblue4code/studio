
"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { 
  Loader2, 
  Phone, 
  MapPin,
  ShieldCheck,
  Save,
  Plus,
  Trash2,
  Heart,
  Baby,
  Fingerprint,
  Info,
  User,
  Lock,
  RefreshCw,
  Eye
} from "lucide-react"
import { useAuth, useFirestore } from "@/firebase"
import { doc, updateDoc } from "firebase/firestore"
import { updatePassword } from "firebase/auth"
import { useToast } from "@/hooks/use-toast"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

const applyCpfMask = (value: string) => {
  const digits = value.replace(/\D/g, "");
  const limited = digits.slice(0, 11);
  if (limited.length <= 3) return limited;
  if (limited.length <= 6) return `${limited.slice(0, 3)}.${limited.slice(3)}`;
  if (limited.length <= 9) return `${limited.slice(0, 3)}.${limited.slice(3, 6)}.${limited.slice(6)}`;
  return `${limited.slice(0, 3)}.${limited.slice(3, 6)}.${limited.slice(6, 9)}-${limited.slice(9)}`;
};

const isValidCpf = (cpf: string) => {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return false;
  
  // Rejeita sequências conhecidas de números iguais
  if (/^(\d)\1{10}$/.test(digits)) return false;

  let sum = 0;
  let remainder;

  // Validação do 1º dígito verificador
  for (let i = 1; i <= 9; i++) {
    sum = sum + parseInt(digits.substring(i - 1, i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(digits.substring(9, 10))) return false;

  // Validação do 2º dígito verificador
  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum = sum + parseInt(digits.substring(i - 1, i)) * (12 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(digits.substring(10, 11))) return false;

  return true;
};

const applyPhoneMask = (value: string) => {
  const digits = value.replace(/\D/g, "");
  const limited = digits.slice(0, 11);
  if (limited.length <= 2) return limited;
  if (limited.length <= 6) return `(${limited.slice(0, 2)}) ${limited.slice(2)}`;
  if (limited.length <= 10) return `(${limited.slice(0, 2)}) ${limited.slice(2, 6)}-${limited.slice(6)}`;
  return `(${limited.slice(0, 2)}) ${limited.slice(2, 7)}-${limited.slice(7)}`;
};

export default function ProfilePage() {
  const { auth, user, employeeData, loading: authLoading } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [isSaving, setIsSaving] = React.useState(false);
  const [isChangingPassword, setIsChangingPassword] = React.useState(false);
  const [showNewPass, setShowNewPass] = React.useState(false);
  const [showConfirmPass, setShowConfirmPass] = React.useState(false);

  // Estados dos campos cadastrais
  const [phone, setPhone] = React.useState("");
  const [emergencyContactName, setEmergencyContactName] = React.useState("");
  const [emergencyPhone, setEmergencyPhone] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [city, setCity] = React.useState("");
  const [state, setState] = React.useState("");
  const [spouseName, setSpouseName] = React.useState("");
  const [voterId, setVoterId] = React.useState("");
  const [voterZone, setVoterZone] = React.useState("");
  const [votingLocation, setVotingLocation] = React.useState("");
  const [votingCity, setVotingCity] = React.useState("");
  const [birthDate, setBirthDate] = React.useState("");
  const [admissionDate, setAdmissionDate] = React.useState("");
  const [cpf, setCpf] = React.useState("");
  const [cnhNumber, setCnhNumber] = React.useState("");
  const [cnhCategory, setCnhCategory] = React.useState("");
  const [cnhExpiration, setCnhExpiration] = React.useState("");
  const [children, setChildren] = React.useState<{ name: string; age: string; cpf?: string }[]>([]);

  // Estados de Senha
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");

  // Inicializa estados com dados do Firestore
  React.useEffect(() => {
    if (employeeData) {
      setPhone(employeeData.phone || "");
      setEmergencyContactName((employeeData.emergencyContactName || "").toUpperCase());
      setEmergencyPhone(employeeData.emergencyPhone || "");
      setAddress((employeeData.address || "").toUpperCase());
      setCity((employeeData.city || "").toUpperCase());
      setState((employeeData.state || "").toUpperCase());
      setSpouseName((employeeData.spouseName || "").toUpperCase());
      setVoterId((employeeData.voterId || "").toUpperCase());
      setVoterZone((employeeData.voterZone || "").toUpperCase());
      setVotingLocation((employeeData.votingLocation || "").toUpperCase());
      setVotingCity((employeeData.votingCity || "").toUpperCase());
      setBirthDate(employeeData.birthDate || "");
      setAdmissionDate(employeeData.admissionDate || "");
      setCpf(employeeData.cpf || "");
      setCnhNumber((employeeData.cnhNumber || "").toUpperCase());
      setCnhCategory((employeeData.cnhCategory || "").toUpperCase());
      setCnhExpiration(employeeData.cnhExpiration || "");
      setChildren(employeeData.children || []);
    }
  }, [employeeData]);

  const validatePasswordComplexity = (password: string) => {
    const minLength = password.length >= 8;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    return minLength && hasUpper && hasLower && hasSpecial;
  };

  const handleAddChild = () => {
    setChildren([...children, { name: "", age: "", cpf: "" }]);
  };

  const handleUpdateChild = (index: number, field: "name" | "age" | "cpf", value: string) => {
    const newChildren = [...children];
    if (field === "cpf") {
      newChildren[index][field] = applyCpfMask(value);
    } else {
      newChildren[index][field] = value.toUpperCase();
    }
    setChildren(newChildren);
  };

  const handleRemoveChild = (index: number) => {
    setChildren(children.filter((_, i) => i !== index));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeData?.id || !firestore) return;

    // Validação matemática do CPF do Titular
    if (cpf && !isValidCpf(cpf)) {
      toast({ 
        variant: "destructive", 
        title: "CPF INVÁLIDO", 
        description: "O CPF informado para o titular não é um documento válido." 
      });
      return;
    }

    // Validação matemática do CPF dos Dependentes
    for (const child of children) {
      if (child.cpf && !isValidCpf(child.cpf)) {
        toast({ 
          variant: "destructive", 
          title: "CPF DE DEPENDENTE INVÁLIDO", 
          description: `O CPF informado para o dependente ${child.name || '(Sem nome)'} não é válido.` 
        });
        return;
      }
    }

    setIsSaving(true);
    const updates = {
      phone: phone.toUpperCase(),
      emergencyContactName: emergencyContactName.toUpperCase(),
      emergencyPhone: emergencyPhone.toUpperCase(),
      address: address.toUpperCase(),
      city: city.toUpperCase(),
      state: state.toUpperCase(),
      spouseName: spouseName.toUpperCase(),
      voterId: voterId.toUpperCase(),
      voterZone: voterZone.toUpperCase(),
      votingLocation: votingLocation.toUpperCase(),
      votingCity: votingCity.toUpperCase(),
      birthDate,
      admissionDate,
      cpf: cpf.toUpperCase(),
      cnhNumber: cnhNumber.toUpperCase(),
      cnhCategory: cnhCategory.toUpperCase(),
      cnhExpiration,
      children: children.filter(c => c.name.trim() !== ""),
    };

    try {
      await updateDoc(doc(firestore, "employees", employeeData.id), updates);
      toast({ title: "SUCESSO!", description: "FICHA FUNCIONAL ATUALIZADA." });
    } catch (error) {
      toast({ variant: "destructive", title: "ERRO AO SALVAR", description: "Tente novamente mais tarde." });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!user) return;
    
    if (!validatePasswordComplexity(newPassword)) {
      toast({ 
        variant: "destructive", 
        title: "SENHA INVÁLIDA", 
        description: "A SENHA DEVE TER NO MÍNIMO 8 CARACTERES, INCLUINDO LETRAS MAIÚSCULAS, MINÚSCULAS E SÍMBOLOS." 
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({ variant: "destructive", title: "SENHAS DIFERENTES", description: "A confirmação de senha não confere." });
      return;
    }

    setIsChangingPassword(true);
    try {
      await updatePassword(user, newPassword);
      toast({ title: "SUCESSO!", description: "SUA SENHA FOI ATUALIZADA." });
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') {
        toast({ 
          variant: "destructive", 
          title: "AÇÃO NECESSÁRIA", 
          description: "Por segurança, saia do sistema e entre novamente para trocar sua senha." 
        });
      } else {
        toast({ variant: "destructive", title: "ERRO AO TROCAR SENHA", description: "Tente novamente." });
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-full items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!employeeData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-4">
        <ShieldCheck className="h-12 w-12 text-muted-foreground opacity-20" />
        <p className="text-muted-foreground uppercase text-xs font-bold tracking-widest">REGISTRO NÃO LOCALIZADO NO SISTEMA.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight uppercase text-primary">FICHA FUNCIONAL</h2>
        <p className="text-muted-foreground uppercase text-[10px] font-bold tracking-widest">CADASTRO UNIFICADO DO SERVIDOR.</p>
      </div>

      <div className="space-y-6">
        <Card className="card-shadow border-none rounded-2xl overflow-hidden bg-card">
          <div className="bg-primary/5 border-b p-6 sm:p-8">
            <div className="space-y-4">
              <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tighter text-slate-900 leading-none">
                {employeeData.name}
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono text-[10px] font-bold uppercase border-primary/20 text-primary bg-white px-3 h-6">
                  QRA: {employeeData.qra}
                </Badge>
                <Badge variant="outline" className="font-mono text-[10px] font-bold uppercase border-slate-200 text-slate-600 bg-white px-3 h-6">
                  MATRÍCULA: {employeeData.matricula}
                </Badge>
                <Badge className="bg-green-600 text-white border-none text-[9px] uppercase font-bold px-3 h-6">
                  {employeeData.status}
                </Badge>
              </div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                {employeeData.role} • {employeeData.unit}
              </p>
            </div>
          </div>

          <CardContent className="p-6 sm:p-8 space-y-10">
            {/* SEÇÃO 1: DADOS PESSOAIS & DOCUMENTOS */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="bg-blue-50 p-2 rounded-lg border border-blue-100">
                  <Fingerprint className="h-5 w-5 text-blue-600" />
                </div>
                <h4 className="text-sm uppercase font-black tracking-widest text-slate-800">Dados Pessoais & Documentos</h4>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Data de Admissão</Label>
                  <Input type="date" value={admissionDate} onChange={(e) => setAdmissionDate(e.target.value)} className="font-bold text-xs h-11 bg-slate-50/50" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">CPF</Label>
                  <Input 
                    value={cpf} 
                    onChange={(e) => setCpf(applyCpfMask(e.target.value))} 
                    placeholder="000.000.000-00" 
                    className={cn(
                      "uppercase font-bold text-xs h-11 bg-slate-50/50",
                      cpf && !isValidCpf(cpf) && "border-red-500 bg-red-50"
                    )} 
                  />
                  {cpf && !isValidCpf(cpf) && <span className="text-[8px] font-black text-red-600 uppercase">CPF titular inválido</span>}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Data de Nascimento</Label>
                  <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="font-bold text-xs h-11 bg-slate-50/50" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">CNH (Nº)</Label>
                  <Input 
                    value={cnhNumber} 
                    onChange={(e) => setCnhNumber(e.target.value)} 
                    placeholder="Nº REGISTRO" 
                    className="uppercase font-bold text-xs h-11 bg-slate-50/50" 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">CNH (Categoria)</Label>
                  <Input 
                    value={cnhCategory} 
                    onChange={(e) => setCnhCategory(e.target.value.toUpperCase())} 
                    placeholder="EX: AB" 
                    className="uppercase font-bold text-xs h-11 bg-slate-50/50 text-center" 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">CNH (Validade)</Label>
                  <Input 
                    type="date" 
                    value={cnhExpiration} 
                    onChange={(e) => setCnhExpiration(e.target.value)} 
                    className="font-bold text-xs h-11 bg-slate-50/50" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Título de Eleitor (Nº)</Label>
                  <Input 
                    value={voterId} 
                    onChange={(e) => setVoterId(e.target.value)} 
                    placeholder="0000 0000 0000" 
                    className="uppercase font-bold text-xs h-11 bg-slate-50/50" 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Zona Eleitoral</Label>
                  <Input 
                    value={voterZone} 
                    onChange={(e) => setVoterZone(e.target.value.replace(/\D/g, "").slice(0, 4))} 
                    placeholder="0000" 
                    maxLength={4}
                    className="uppercase font-bold text-xs h-11 bg-slate-50/50 text-center" 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Local de Votação (Escola)</Label>
                  <Input value={votingLocation} onChange={(e) => setVotingLocation(e.target.value.toUpperCase())} placeholder="NOME DA ESCOLA..." className="uppercase font-bold text-xs h-11 bg-slate-50/50" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Cidade onde vota</Label>
                  <Input value={votingCity} onChange={(e) => setVotingCity(e.target.value.toUpperCase())} placeholder="CIDADE" className="uppercase font-bold text-xs h-11 bg-slate-50/50" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Email Institucional</Label>
                <Input value={employeeData.email || ""} readOnly className="bg-muted/30 uppercase font-bold text-xs h-11 cursor-not-allowed border-dashed" />
              </div>
            </div>

            <Separator className="bg-slate-100" />

            {/* SEÇÃO 2: CONTATO E ENDEREÇO */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="bg-blue-50 p-2 rounded-lg border border-blue-100">
                  <MapPin className="h-5 w-5 text-blue-600" />
                </div>
                <h4 className="text-sm uppercase font-black tracking-widest text-slate-800">Contato & Localização</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-2 space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <MapPin className="h-3 w-3" /> Endereço Residencial
                  </Label>
                  <Input 
                    value={address} 
                    onChange={(e) => setAddress(e.target.value.toUpperCase())} 
                    placeholder="RUA, NÚMERO, BAIRRO..." 
                    className="uppercase font-bold text-xs h-11 bg-slate-50/50" 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Cidade</Label>
                  <Input 
                    value={city} 
                    onChange={(e) => setCity(e.target.value.toUpperCase())} 
                    placeholder="CIDADE" 
                    className="uppercase font-bold text-xs h-11 bg-slate-50/50" 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">UF</Label>
                  <Input 
                    value={state} 
                    onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))} 
                    placeholder="UF" 
                    maxLength={2}
                    className="uppercase font-bold text-xs h-11 bg-slate-50/50 text-center" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <Phone className="h-3 w-3" /> Telefone Principal
                  </Label>
                  <Input 
                    value={phone} 
                    onChange={(e) => setPhone(applyPhoneMask(e.target.value))} 
                    placeholder="(27) 99999-9999" 
                    className="uppercase font-bold text-xs h-11 bg-slate-50/50" 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <User className="h-3 w-3" /> Contato de Emergência (Nome/Parentesco)
                  </Label>
                  <Input 
                    value={emergencyContactName} 
                    onChange={(e) => setEmergencyContactName(e.target.value.toUpperCase())} 
                    placeholder="NOME DO CONTATO" 
                    className="uppercase font-bold text-xs h-11 bg-slate-50/50" 
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <Phone className="h-3 w-3" /> Telefone de Emergência
                  </Label>
                  <Input 
                    value={emergencyPhone} 
                    onChange={(e) => setEmergencyPhone(applyPhoneMask(e.target.value))} 
                    placeholder="(27) 99999-9999" 
                    className="uppercase font-bold text-xs h-11 bg-slate-50/50" 
                  />
                </div>
              </div>
            </div>

            <Separator className="bg-slate-100" />

            {/* SEÇÃO 3: FAMÍLIA E DEPENDENTES */}
            <div className="space-y-8">
              <div className="flex items-center gap-3">
                <div className="bg-red-50 p-2 rounded-lg border border-red-100">
                  <Heart className="h-5 w-5 text-red-600" />
                </div>
                <h4 className="text-sm uppercase font-black tracking-widest text-slate-800">Família & Dependentes</h4>
              </div>

              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-3 space-y-1.5">
                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Nome do Cônjuge</Label>
                    <Input value={spouseName} onChange={(e) => setSpouseName(e.target.value.toUpperCase())} className="uppercase font-bold text-xs h-11 bg-slate-50/50" />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Baby className="h-4 w-4 text-primary" />
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Filhos (Dependentes)</Label>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={handleAddChild} className="h-8 text-[9px] font-bold uppercase gap-2 rounded-xl">
                      <Plus className="h-3 w-3" /> ADICIONAR FILHO
                    </Button>
                  </div>

                  {children.length === 0 ? (
                    <div className="p-8 border-2 border-dashed rounded-2xl text-center bg-slate-50/30">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold italic">Nenhum filho cadastrado.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {children.map((child, index) => (
                        <div key={index} className="flex gap-2 items-end p-3 border rounded-xl bg-slate-50/50 animate-in zoom-in-95 duration-200">
                          <div className="flex-1 space-y-1.5">
                            <Label className="text-[8px] font-bold uppercase text-muted-foreground">Nome Completo</Label>
                            <Input value={child.name} onChange={(e) => handleUpdateChild(index, "name", e.target.value)} className="h-9 uppercase text-xs font-bold bg-white" />
                          </div>
                          <div className="w-48 space-y-1.5">
                            <Label className="text-[8px] font-bold uppercase text-muted-foreground">CPF</Label>
                            <Input 
                              value={child.cpf || ""} 
                              onChange={(e) => handleUpdateChild(index, "cpf", e.target.value)} 
                              placeholder="000.000.000-00" 
                              className={cn(
                                "h-9 text-center text-xs font-bold bg-white",
                                child.cpf && !isValidCpf(child.cpf) && "border-red-500 bg-red-50"
                              )} 
                            />
                            {child.cpf && !isValidCpf(child.cpf) && <span className="text-[7px] font-black text-red-600 uppercase block text-center">CPF inválido</span>}
                          </div>
                          <div className="w-20 space-y-1.5">
                            <Label className="text-[8px] font-bold uppercase text-muted-foreground">Idade</Label>
                            <Input value={child.age} onChange={(e) => handleUpdateChild(index, "age", e.target.value)} className="h-9 text-center text-xs font-bold bg-white" />
                          </div>
                          <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveChild(index)} className="h-9 w-9 text-destructive hover:bg-red-50">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Separator className="bg-slate-100" />

            {/* SEÇÃO 4: SEGURANÇA & ACESSO (TROCA DE SENHA) */}
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="bg-amber-50 p-2 rounded-lg border border-amber-100">
                  <Lock className="h-5 w-5 text-amber-600" />
                </div>
                <h4 className="text-sm uppercase font-black tracking-widest text-slate-800">Segurança & Acesso</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Nova Senha</Label>
                  <div className="relative">
                    <Input 
                      type={showNewPass ? "text" : "password"} 
                      value={newPassword} 
                      onChange={(e) => setNewPassword(e.target.value)} 
                      placeholder="8+ CHARS + SÍMBOLOS"
                      className="h-11 bg-slate-50/50 pr-10 transition-all" 
                    />
                    <button
                      type="button"
                      onMouseDown={() => setShowNewPass(true)}
                      onMouseUp={() => setShowNewPass(false)}
                      onMouseLeave={() => setShowNewPass(false)}
                      onTouchStart={(e) => { e.preventDefault(); setShowNewPass(true); }}
                      onTouchEnd={() => setShowNewPass(false)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
                      title="Mantenha pressionado para ver a senha"
                    >
                      <Eye className={cn("h-4 w-4", showNewPass && "text-primary")} />
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Confirmar Nova Senha</Label>
                  <div className="relative">
                    <Input 
                      type={showConfirmPass ? "text" : "password"} 
                      value={confirmPassword} 
                      onChange={(e) => setConfirmPassword(e.target.value)} 
                      placeholder="REPITA A SENHA"
                      className="h-11 bg-slate-50/50 pr-10 transition-all" 
                    />
                    <button
                      type="button"
                      onMouseDown={() => setShowConfirmPass(true)}
                      onMouseUp={() => setShowConfirmPass(false)}
                      onMouseLeave={() => setShowConfirmPass(false)}
                      onTouchStart={(e) => { e.preventDefault(); setShowConfirmPass(true); }}
                      onTouchEnd={() => setShowConfirmPass(false)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
                      title="Mantenha pressionado para ver a senha"
                    >
                      <Eye className={cn("h-4 w-4", showConfirmPass && "text-primary")} />
                    </button>
                  </div>
                </div>
                <Button 
                  type="button" 
                  disabled={isChangingPassword || !newPassword || !confirmPassword}
                  onClick={handlePasswordChange}
                  className="h-11 uppercase font-black text-xs tracking-widest bg-slate-800 hover:bg-slate-900 shadow-lg shadow-slate-200"
                >
                  {isChangingPassword ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Atualizar Senha
                </Button>
              </div>
              
              <div className="flex items-start gap-2 bg-amber-50/50 p-3 rounded-xl border border-amber-100">
                <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[10px] text-amber-800 font-medium leading-relaxed uppercase">
                  Requisitos de segurança: No mínimo 8 caracteres, contendo letras maiúsculas, minúsculas e um caractere especial (!@#$...).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* NOTA DE RODAPÉ E BOTÃO SALVAR GERAL */}
        <div className="flex flex-col-reverse md:flex-row items-center justify-between gap-6 p-6 sm:p-8 bg-slate-100 border border-slate-200 rounded-3xl">
          <div className="flex items-start gap-4 max-w-xl">
            <div className="bg-white p-2 rounded-xl border shadow-sm shrink-0">
              <Info className="h-5 w-5 text-blue-500" />
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-black uppercase text-slate-900 tracking-tight leading-none">Compromisso com a Veracidade</p>
              <p className="text-[9px] text-muted-foreground uppercase leading-relaxed font-bold mt-1">
                Ao gravar estas informações, você declara que os dados fornecidos foram conferidos e assume a responsabilidade por qualquer inconsistência. Os dados oficiais de Matrícula e Admissão são mantidos pelo RH.
              </p>
            </div>
          </div>
          
          <Button 
            onClick={handleSave}
            type="button" 
            disabled={isSaving} 
            className="w-full md:w-auto h-14 px-12 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-200 transition-all active:scale-95"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2" />}
            GRAVAR ATUALIZAÇÃO CADASTRAL
          </Button>
        </div>
      </div>
    </div>
  )
}
