
"use client"

import * as React from "react"
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  UserCircle,
  LogOut,
  Settings,
  FilePlus,
  BarChart3,
  History,
  ShieldCheck,
  FileText,
  CalendarCheck,
  Plane,
  BellRing,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth, useCollection } from "@/firebase"
import { collection, query, where, orderBy } from "firebase/firestore"

const navigation = [
  { name: "Painel", href: "/dashboard", icon: LayoutDashboard },
  { name: "Lançamentos", href: "/lancamentos", icon: FilePlus },
  { name: "Efetivo", href: "/efetivo", icon: Users },
  { name: "Frequência", href: "/frequencia", icon: CalendarCheck },
  { name: "Relatórios", href: "/relatorios", icon: BarChart3 },
  { name: "Meus Lançamentos", href: "/meus-lancamentos", icon: History },
  { name: "Minhas Solicitações", href: "/requests", icon: ClipboardList },
  { name: "Mural de Avisos", href: "/notifications", icon: BellRing },
  { name: "Meu Perfil", href: "/profile", icon: UserCircle },
  { name: "Férias", href: "/ferias", icon: Plane },
  { name: "Dados Perfil", href: "/dados-perfil", icon: FileText },
  { name: "Configuração", href: "/settings", icon: Settings },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { logout, loading, employeeData, user, firestore } = useAuth()
  const { state } = useSidebar()
  
  const [connectionStatus, setConnectionStatus] = React.useState<'connected' | 'stable' | 'disconnected'>('stable')

  const normalizeStr = (str: string) => str?.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || "";

  // Filtra navegação com base no cargo (RBAC)
  const filteredNavigation = React.useMemo(() => {
    if (!employeeData) return [];
    const role = normalizeStr(employeeData.role || "");
    
    let result = navigation;

    if (role === "AGENTE") {
      // Agentes veem apenas os itens de autoatendimento + Mural
      result = navigation.filter(item => 
        ["/notifications", "/meus-lancamentos", "/requests", "/profile", "/ferias"].includes(item.href)
      );
    } else if (role === "INSPETOR" || role === "SUBINSPETOR") {
      // Inspetores e Subinspetores veem Relatórios + Autoatendimento + Mural
      result = navigation.filter(item => 
        ["/notifications", "/relatorios", "/meus-lancamentos", "/requests", "/profile", "/ferias"].includes(item.href)
      );
    }
    
    // Regra adicional: Configurações APENAS para Comandante e Inspetor Geral
    const isHighRank = ["COMANDANTE", "INSPETOR GERAL"].some(r => role.includes(r));
    if (!isHighRank) {
      result = result.filter(item => item.href !== "/settings");
    }

    return result;
  }, [employeeData]);

  // Lógica de monitoramento de requerimentos pendentes
  const managementRequestsQuery = React.useMemo(() => {
    if (!firestore || !user || !employeeData) return null;
    return query(collection(firestore, 'requests'), where('status', 'in', ['Pendente', 'Aguardando Parceiro', 'Aprovado pela Chefia']));
  }, [firestore, user, employeeData]);

  const { data: managementRequests } = useCollection(managementRequestsQuery);

  const pendingActionCount = React.useMemo(() => {
    if (!managementRequests || !user || !employeeData) return 0;
    const role = normalizeStr(employeeData.role || "");
    const isRH = role.includes("GESTOR DE RH");
    
    return managementRequests.filter(req => {
      if (req.status === "Aguardando Parceiro") return req.partnerId === user.uid;
      if (req.status === "Pendente") return req.chefiaIds?.includes(user.uid);
      if (req.status === "Aprovado pela Chefia") return isRH;
      return false;
    }).length;
  }, [managementRequests, user, employeeData]);

  // Lógica de Monitoramento do Mural (Novos Avisos)
  const muralNotificationsQuery = React.useMemo(() => {
    if (!firestore || !user || !employeeData) return null;
    return query(collection(firestore, 'notifications'), orderBy('createdAt', 'desc'));
  }, [firestore, user, employeeData]);

  const rolesQuery = React.useMemo(() => firestore ? collection(firestore, 'roles') : null, [firestore]);

  const { data: muralNotifications } = useCollection(muralNotificationsQuery);
  const { data: roles } = useCollection(rolesQuery);

  const unreadMuralCount = React.useMemo(() => {
    if (!muralNotifications || !employeeData || !user) return 0;
    
    const lastVisit = employeeData.lastMuralVisit?.toDate?.() || new Date(0);
    const userRole = normalizeStr(employeeData.role || "");

    return muralNotifications.filter(n => {
      const createdAt = n.createdAt?.toDate?.() || new Date(0);
      if (createdAt <= lastVisit) return false;

      // Filtra conforme a segmentação igual à página do Mural
      if (n.targetType === "TODOS") return true;
      if (n.targetType === "CARGO") {
        const targetRole = roles?.find(r => r.id === n.targetId)?.name || "";
        return normalizeStr(targetRole) === userRole;
      }
      if (n.targetType === "INDIVIDUAL") return n.targetId === user.uid;
      return false;
    }).length;
  }, [muralNotifications, employeeData, roles, user]);

  React.useEffect(() => {
    if (!loading) setConnectionStatus('connected')
  }, [loading])

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'bg-green-500'
      case 'stable': return 'bg-orange-500'
      case 'disconnected': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusLabel = () => {
    switch (connectionStatus) {
      case 'connected': return 'Conectado'
      case 'stable': return 'Estável'
      case 'disconnected': return 'Desconectado'
      default: return 'Status Desconhecido'
    }
  }

  return (
    <Sidebar collapsible="icon" className="print:hidden">
      <SidebarHeader className="border-b p-2">
        <div className="flex items-center justify-between w-full group-data-[collapsible=icon]:justify-center">
          <div className="flex items-center gap-2 font-headline font-bold text-primary group-data-[collapsible=icon]:hidden px-4">
            <div className="bg-primary flex h-8 w-8 items-center justify-center rounded-lg text-white">
              N
            </div>
            <span className="truncate text-lg">
              NRH - GMVV
            </span>
            <div 
              className={`ml-2 h-2.5 w-2.5 rounded-full ${getStatusColor()} animate-pulse shadow-[0_0_8px_rgba(0,0,0,0.2)]`} 
              title={getStatusLabel()}
            />
          </div>
          <SidebarTrigger className="transition-transform duration-200" />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
            Navegação Principal
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredNavigation.map((item) => (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.href}
                      tooltip={item.name}
                      className="transition-all duration-200"
                    >
                      <Link href={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                    {item.href === "/requests" && pendingActionCount > 0 && (
                      <SidebarMenuBadge className="bg-primary text-primary-foreground font-black text-[10px] rounded-full h-5 min-w-5 flex items-center justify-center border-2 border-background shadow-sm">
                        {pendingActionCount}
                      </SidebarMenuBadge>
                    )}
                    {item.href === "/notifications" && unreadMuralCount > 0 && (
                      <SidebarMenuBadge className="bg-blue-600 text-white font-black text-[10px] rounded-full h-5 min-w-5 flex items-center justify-center border-2 border-background shadow-sm animate-in zoom-in duration-300">
                        {unreadMuralCount}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t p-4 space-y-2">
        <SidebarMenu>
          {employeeData && (
            <SidebarMenuItem className="group-data-[collapsible=icon]:hidden">
              <div className="flex items-center gap-2 px-2 py-1.5 text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-primary/70" />
                <span className="text-[10px] font-black uppercase tracking-wider truncate">
                  {employeeData.role} : {employeeData.qra}
                </span>
              </div>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={() => logout()}
              className="w-full justify-start text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
              <span className="group-data-[collapsible=icon]:hidden">Sair do Sistema</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          
          <SidebarMenuItem className="group-data-[collapsible=icon]:hidden">
            <div className="px-2 py-2 text-center">
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest opacity-50">
                Versão 1.1 - F3U
              </span>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
