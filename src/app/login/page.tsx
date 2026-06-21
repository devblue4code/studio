'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  doc 
} from 'firebase/firestore';
import { useAuth } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose
} from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { Loader2, Lock, ShieldCheck, UserCheck, Eye, Mail } from 'lucide-react';
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const [loading, setLoading] = React.useState(false);
  const [resetLoading, setResetLoading] = React.useState(false);
  const [showLoginPass, setShowLoginPass] = React.useState(false);
  const [showRegisterPass, setShowRegisterPass] = React.useState(false);
  const [resetEmail, setResetEmail] = React.useState("");
  const [isResetOpen, setIsResetOpen] = React.useState(false);
  
  const router = useRouter();
  const { toast } = useToast();
  const { auth, firestore, user } = useAuth();

  // Redireciona se já estiver logado
  React.useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  const validatePasswordComplexity = (password: string) => {
    const minLength = password.length >= 8;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    return minLength && hasUpper && hasLower && hasSpecial;
  };

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const qraInput = (formData.get('qra') as string).toUpperCase();
    const password = formData.get('password') as string;

    try {
      // 1. Busca o servidor pelo QRA
      const q = query(collection(firestore, 'employees'), where('qra', '==', qraInput));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast({
          variant: 'destructive',
          title: 'ACESSO NEGADO',
          description: 'QRA NÃO ENCONTRADO NO SISTEMA.',
        });
        setLoading(false);
        return;
      }

      const employeeDoc = querySnapshot.docs[0];
      const employeeData = employeeDoc.data();

      if (!employeeData.email) {
        toast({
          variant: 'destructive',
          title: 'PENDÊNCIA DE CADASTRO',
          description: 'PRIMEIRO ACESSO NECESSÁRIO PARA VINCULAR E-MAIL.',
        });
        setLoading(false);
        return;
      }

      // 2. Login com o e-mail encontrado
      await signInWithEmailAndPassword(auth, employeeData.email, password);
      
      toast({
        title: 'BEM-VINDO!',
        description: `ACESSO AUTORIZADO PARA ${employeeData.name}.`,
      });
      router.push('/dashboard');
    } catch (error: any) {
      console.error(error);
      let message = 'ERRO AO REALIZAR LOGIN.';
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        message = 'SENHA INCORRETA.';
      } else if (error.code === 'auth/user-not-found') {
        message = 'USUÁRIO NÃO ENCONTRADO.';
      }
      toast({
        variant: 'destructive',
        title: 'FALHA NA AUTENTICAÇÃO',
        description: message,
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const qraInput = (formData.get('qra') as string).toUpperCase();
    const valCode = (formData.get('valCode') as string).toUpperCase();
    const email = (formData.get('email') as string).toUpperCase();
    const password = formData.get('password') as string;

    // Validação de complexidade de senha
    if (!validatePasswordComplexity(password)) {
      toast({
        variant: 'destructive',
        title: 'SENHA FRACA',
        description: 'A SENHA DEVE CONTER: MÍNIMO 8 CARACTERES, LETRAS MAIÚSCULAS, MINÚSCULAS E UM SÍMBOLO.',
      });
      setLoading(false);
      return;
    }

    try {
      // 1. Valida QRA e Código
      const q = query(
        collection(firestore, 'employees'), 
        where('qra', '==', qraInput),
        where('validationCode', '==', valCode)
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast({
          variant: 'destructive',
          title: 'VALIDAÇÃO FALHOU',
          description: 'QRA OU CÓDIGO DE ATIVAÇÃO INCORRETOS.',
        });
        setLoading(false);
        return;
      }

      const employeeDoc = querySnapshot.docs[0];
      const employeeData = employeeDoc.data();

      if (employeeData.uid) {
        toast({
          variant: 'destructive',
          title: 'ERRO',
          description: 'ESTE QRA JÁ POSSUI UM USUÁRIO VINCULADO.',
        });
        setLoading(false);
        return;
      }

      // 2. Cria usuário no Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;

      // 3. Atualiza perfil do usuário
      await updateProfile(newUser, { displayName: employeeData.name });

      // 4. Vincula UID e Email ao documento do Firestore
      await updateDoc(doc(firestore, 'employees', employeeDoc.id), {
        uid: newUser.uid,
        email: email,
        status: 'ATIVO' // Ativa automaticamente no primeiro acesso
      });

      toast({
        title: 'CADASTRO CONCLUÍDO!',
        description: 'BEM-VINDO AO SISTEMA NRH.',
      });
      router.push('/dashboard');
    } catch (error: any) {
      console.error(error);
      let message = 'NÃO FOI POSSÍVEL REALIZAR O CADASTRO.';
      if (error.code === 'auth/email-already-in-use') {
        message = 'ESTE E-MAIL JÁ ESTÁ SENDO UTILIZADO.';
      } else if (error.code === 'auth/weak-password') {
        message = 'A SENHA É CONSIDERADA FRACA PELO SISTEMA.';
      }
      toast({
        variant: 'destructive',
        title: 'ERRO NO PRIMEIRO ACESSO',
        description: message,
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    if (!resetEmail) {
      toast({ variant: 'destructive', title: 'ATENÇÃO', description: 'INFORME SEU E-MAIL CADASTRADO.' });
      return;
    }

    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail.toUpperCase());
      toast({
        title: 'E-MAIL ENVIADO!',
        description: 'VERIFIQUE SUA CAIXA DE ENTRADA PARA REDEFINIR A SENHA.',
      });
      setIsResetOpen(false);
      setResetEmail("");
    } catch (error: any) {
      console.error(error);
      let message = 'ERRO AO ENVIAR E-MAIL DE RECUPERAÇÃO.';
      if (error.code === 'auth/user-not-found') {
        message = 'USUÁRIO NÃO ENCONTRADO COM ESTE E-MAIL.';
      } else if (error.code === 'auth/invalid-email') {
        message = 'FORMATO DE E-MAIL INVÁLIDO.';
      }
      toast({
        variant: 'destructive',
        title: 'FALHA NA RECUPERAÇÃO',
        description: message,
      });
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 sm:p-6 lg:p-8 animate-in fade-in duration-700">
      <div className="w-full max-w-[450px] space-y-8">
        <div className="flex flex-col items-center text-center gap-2">
          <div className="bg-primary h-16 w-16 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-200">
            <ShieldCheck className="h-10 w-10" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tighter text-slate-900 uppercase">NRH - GMVV</h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">SISTEMA DE GESTÃO OPERACIONAL</p>
          </div>
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-12 rounded-xl bg-slate-200/50 p-1">
            <TabsTrigger value="login" className="rounded-lg uppercase text-[10px] font-bold tracking-widest">LOGIN</TabsTrigger>
            <TabsTrigger value="first" className="rounded-lg uppercase text-[10px] font-bold tracking-widest">PRIMEIRO ACESSO</TabsTrigger>
          </TabsList>
          
          <TabsContent value="login" className="mt-6">
            <Card className="border-none shadow-2xl shadow-slate-200 rounded-3xl overflow-hidden">
              <form onSubmit={handleLogin}>
                <CardHeader className="space-y-1 pb-4">
                  <CardTitle className="text-xl font-bold uppercase tracking-tight">Acesso ao Sistema</CardTitle>
                  <CardDescription className="uppercase text-[9px] font-bold text-muted-foreground tracking-widest">INFORME SUAS CREDENCIAIS OPERACIONAIS.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="qra-login" className="uppercase text-[10px] font-bold text-slate-500">QRA</Label>
                    <div className="relative">
                      <UserCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input id="qra-login" name="qra" placeholder="EX: SANTOS" required className="pl-10 h-12 uppercase font-bold text-xs bg-slate-50 border-slate-200 focus:bg-white" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pass-login" className="uppercase text-[10px] font-bold text-slate-500">SENHA</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input 
                        id="pass-login" 
                        name="password" 
                        type={showLoginPass ? "text" : "password"} 
                        placeholder="••••••••" 
                        required 
                        className="pl-10 pr-10 h-12 bg-slate-50 border-slate-200 focus:bg-white transition-all" 
                      />
                      <button
                        type="button"
                        onMouseDown={() => setShowLoginPass(true)}
                        onMouseUp={() => setShowLoginPass(false)}
                        onMouseLeave={() => setShowLoginPass(false)}
                        onTouchStart={(e) => { e.preventDefault(); setShowLoginPass(true); }}
                        onTouchEnd={() => setShowLoginPass(false)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
                        title="Mantenha pressionado para ver a senha"
                      >
                        <Eye className={cn("h-4 w-4", showLoginPass && "text-primary")} />
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
                      <DialogTrigger asChild>
                        <Button variant="link" type="button" className="text-[10px] font-bold uppercase text-primary h-auto p-0 opacity-70 hover:opacity-100">
                          Esqueci minha senha
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[400px] rounded-2xl border-none shadow-2xl">
                        <DialogHeader>
                          <div className="bg-primary/10 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                            <Mail className="h-6 w-6 text-primary" />
                          </div>
                          <DialogTitle className="uppercase text-lg font-black tracking-tight">Recuperar Senha</DialogTitle>
                          <DialogDescription className="text-xs uppercase font-bold text-muted-foreground mt-1">
                            Informe seu e-mail cadastrado no sistema para receber o link de redefinição.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                          <Label className="text-[10px] font-black uppercase text-slate-500 mb-1.5 block">E-mail de Cadastro</Label>
                          <Input 
                            placeholder="EX@GMAIL.COM" 
                            className="h-12 uppercase font-bold text-xs" 
                            value={resetEmail}
                            onChange={(e) => setResetEmail(e.target.value)}
                          />
                        </div>
                        <DialogFooter className="flex flex-col gap-2 sm:flex-row">
                          <DialogClose asChild>
                            <Button variant="ghost" className="uppercase font-black text-[10px] h-11 flex-1">Cancelar</Button>
                          </DialogClose>
                          <Button 
                            onClick={handleResetPassword} 
                            disabled={resetLoading}
                            className="uppercase font-black text-[10px] h-11 flex-1 bg-primary shadow-lg shadow-blue-200"
                          >
                            {resetLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar Link"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
                <CardFooter className="pt-2 pb-6">
                  <Button type="submit" className="w-full h-12 rounded-xl uppercase font-black text-xs tracking-widest shadow-lg shadow-blue-200 transition-all active:scale-[0.98]" disabled={loading}>
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "ENTRAR NO SISTEMA"}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>

          <TabsContent value="first" className="mt-6">
            <Card className="border-none shadow-2xl shadow-slate-200 rounded-3xl overflow-hidden">
              <form onSubmit={handleRegister}>
                <CardHeader className="space-y-1 pb-4">
                  <CardTitle className="text-xl font-bold uppercase tracking-tight">Ativar Registro</CardTitle>
                  <CardDescription className="uppercase text-[9px] font-bold text-muted-foreground tracking-widest">VINCULE SEU E-MAIL E CRIE UMA SENHA.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="qra-reg" className="uppercase text-[10px] font-bold text-slate-500">QRA</Label>
                      <Input id="qra-reg" name="qra" placeholder="QRA" required className="h-12 uppercase font-bold text-xs bg-slate-50" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="code-reg" className="uppercase text-[10px] font-bold text-slate-500">CÓD. ATIVAÇÃO</Label>
                      <Input id="code-reg" name="valCode" placeholder="ABC123" required className="h-12 uppercase font-mono font-bold text-xs bg-slate-50" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email-reg" className="uppercase text-[10px] font-bold text-slate-500">E-MAIL</Label>
                    <Input id="email-reg" name="email" type="email" placeholder="EX@GMAIL.COM" required className="h-12 uppercase font-bold text-xs bg-slate-50" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pass-reg" className="uppercase text-[10px] font-bold text-slate-500">CRIAR SENHA</Label>
                    <div className="relative">
                      <Input 
                        id="pass-reg" 
                        name="password" 
                        type={showRegisterPass ? "text" : "password"} 
                        placeholder="••••••••" 
                        required 
                        className="pr-10 h-12 bg-slate-50 border-slate-200 focus:bg-white transition-all" 
                      />
                      <button
                        type="button"
                        onMouseDown={() => setShowRegisterPass(true)}
                        onMouseUp={() => setShowRegisterPass(false)}
                        onMouseLeave={() => setShowRegisterPass(false)}
                        onTouchStart={(e) => { e.preventDefault(); setShowRegisterPass(true); }}
                        onTouchEnd={() => setShowRegisterPass(false)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
                        title="Mantenha pressionado para ver a senha"
                      >
                        <Eye className={cn("h-4 w-4", showRegisterPass && "text-primary")} />
                      </button>
                    </div>
                    <p className="text-[9px] text-muted-foreground font-medium uppercase leading-tight">
                      Requisitos: Mínimo 8 caracteres, letras maiúsculas, minúsculas e um símbolo.
                    </p>
                  </div>
                </CardContent>
                <CardFooter className="pt-2 pb-6">
                  <Button type="submit" className="w-full h-12 rounded-xl bg-green-600 hover:bg-green-700 uppercase font-black text-xs tracking-widest shadow-lg shadow-green-200 transition-all active:scale-[0.98]" disabled={loading}>
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "CONCLUIR ATIVAÇÃO"}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </TabsContent>
        </Tabs>

        <p className="text-center text-[9px] text-slate-400 font-bold uppercase tracking-widest">
          © 2026 GUARDA MUNICIPAL DE VILA VELHA • NÚCLEO DE RH
        </p>
      </div>
    </div>
  );
}
