'use client';

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/firebase"
import { Loader2 } from "lucide-react"

export default function Home() {
  const { user, employeeData, loading } = useAuth();
  const router = useRouter();

  const normalizeStr = (str: string) => str?.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") || "";

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/login");
      } else {
        if (employeeData) {
          const role = normalizeStr(employeeData.role || "");
          
          if (role === "AGENTE") {
            // Agentes começam em Meus Lançamentos
            router.push("/meus-lancamentos");
          } else if (role === "INSPETOR" || role === "SUBINSPETOR") {
            // Inspetores e Subinspetores começam em Relatórios
            router.push("/relatorios");
          } else {
            // Gestores e RH continuam caindo no Dashboard
            router.push("/dashboard");
          }
        } else {
          // Caso os dados funcionais ainda não existam, o ProtectedRoute cuidará da tela de erro
          router.push("/dashboard");
        }
      }
    }
  }, [user, loading, router, employeeData]);

  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
