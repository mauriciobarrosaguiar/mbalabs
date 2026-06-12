import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Layers3,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const benefits = [
  {
    title: "Farmácias",
    text: "Compare preço por produto, pedido mínimo por distribuidora e gere pedidos vencedores em poucos cliques.",
    icon: ClipboardList,
  },
  {
    title: "Licitações",
    text: "Converta automaticamente preço por comprimido, cápsula, ampola, ml, grama ou dose.",
    icon: BarChart3,
  },
  {
    title: "Vendedor externo",
    text: "Link público seguro, sem login, sem ranking e sem acesso a dados de outros fornecedores.",
    icon: ShieldCheck,
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="relative overflow-hidden border-b border-slate-200 bg-[linear-gradient(120deg,#062f2d_0%,#0f766e_48%,#1d4ed8_100%)] text-white">
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,white_0,transparent_22%),radial-gradient(circle_at_80%_10%,white_0,transparent_18%)]" />
        <div className="relative mx-auto grid min-h-[88vh] max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
          <div className="space-y-8">
            <Badge className="bg-white/12 text-white hover:bg-white/12">
              SaaS de compras farmacêuticas
            </Badge>
            <div className="space-y-5">
              <h1 className="max-w-3xl text-balance text-5xl font-semibold tracking-normal sm:text-6xl">
                MBA Cotações
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-white/82">
                Cotação para farmácias e licitações em uma plataforma moderna,
                multi-tenant e pronta para Supabase, Vercel e links públicos
                seguros para fornecedores.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-white text-teal-800 hover:bg-white/90">
                <Link href="/login">
                  Entrar
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="mailto:comercial@mbacotacoes.com.br">
                  Falar com comercial
                </Link>
              </Button>
            </div>
          </div>
          <div className="rounded-md border border-white/20 bg-white/96 p-3 shadow-2xl">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-slate-950">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Análise licitação</p>
                  <p className="text-xl font-semibold">Duloxetina 30mg</p>
                </div>
                <Badge className="bg-emerald-50 text-emerald-700">100% atendido</Badge>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  ["João", "60.000 CAP", "R$ 1,33"],
                  ["Ana", "30.000 CAP", "R$ 1,38"],
                  ["Carlos", "10.000 CAP", "R$ 1,45"],
                ].map(([name, qty, price]) => (
                  <div key={name} className="rounded-md border border-slate-200 bg-white p-3">
                    <p className="text-sm font-medium">{name}</p>
                    <p className="mt-3 text-2xl font-semibold">{price}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{qty}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 overflow-hidden rounded-md border border-slate-200 bg-white">
                <div className="grid grid-cols-4 border-b border-slate-200 bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600">
                  <span>Fornecedor</span>
                  <span>Embalagem</span>
                  <span>Unitário</span>
                  <span>Saldo</span>
                </div>
                {[
                  ["João Medicamentos", "c/30", "R$ 1,33", "40.000"],
                  ["Ana Distribuidora", "c/60", "R$ 1,38", "10.000"],
                  ["Carlos Farma", "c/30", "R$ 1,45", "0"],
                ].map((row) => (
                  <div key={row[0]} className="grid grid-cols-4 px-3 py-3 text-sm">
                    {row.map((cell) => <span key={cell}>{cell}</span>)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {benefits.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <Card key={benefit.title} className="border-slate-200 shadow-sm">
                <CardContent className="p-5">
                  <span className="inline-flex rounded-md bg-teal-50 p-2 text-teal-700">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h2 className="mt-4 text-lg font-semibold">{benefit.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {benefit.text}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <div className="mt-8 grid gap-4 lg:grid-cols-3">
          {[
            {
              title: "Multi-tenant",
              text: "RLS por empresa e perfis por usuário",
              icon: Layers3,
            },
            {
              title: "Cálculo automático",
              text: "Preço convertido e atendimento parcial",
              icon: Sparkles,
            },
            {
              title: "Pedido vencedor",
              text: "Links individuais por fornecedor",
              icon: CheckCircle2,
            },
          ].map(({ title, text, icon: Icon }) => (
            <div key={title} className="flex items-center gap-3 rounded-md border border-slate-200 bg-white p-4">
              <Icon className="h-5 w-5 text-blue-700" />
              <div>
                <p className="font-medium">{title}</p>
                <p className="text-sm text-muted-foreground">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
