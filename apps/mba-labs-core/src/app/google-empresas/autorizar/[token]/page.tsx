import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { MessageBanner } from "@/components/ui-kit";
import { getPublicGoogleAuthorization } from "@/lib/google-empresas/data";

export const dynamic = "force-dynamic";

export default async function AutorizarGoogleEmpresaPage({
  params,
  searchParams
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const { autorizacao, empresa, error } = await getPublicGoogleAuthorization(token);

  return (
    <main className="min-h-screen">
      <header className="border-b border-white/10 bg-black/20">
        <div className="page-shell flex min-h-16 items-center justify-between py-3">
          <Link href="/" aria-label="MBA Labs - início"><BrandLogo size="md" /></Link>
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-black uppercase text-slate-300">Autorização segura</span>
        </div>
      </header>

      <section className="page-shell mx-auto grid max-w-3xl gap-6 py-10">
        <div className="grid gap-2 text-center">
          <p className="eyebrow">Google Perfil da Empresa</p>
          <h1 className="text-4xl font-black">Autorizar gerenciamento</h1>
          <p className="text-sm leading-6 text-slate-300">
            Esta página permite somente autorizar a conta Google responsável pela empresa. Você não terá acesso ao painel interno do MBA Labs.
          </p>
        </div>

        <MessageBanner ok={first(query.ok)} error={first(query.error) ?? error ?? autorizacao?.ultimo_erro ?? undefined} />

        {!autorizacao || !empresa ? (
          <div className="panel grid gap-3 p-6 text-center">
            <h2 className="text-2xl font-black">Link indisponível</h2>
            <p className="text-slate-300">Solicite ao responsável pelo cadastro um novo link de autorização.</p>
          </div>
        ) : (
          <div className="panel grid gap-6 p-6 md:p-8">
            <div className="grid gap-3 rounded-[16px] border border-white/10 bg-white/[0.03] p-5">
              <div>
                <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Empresa</span>
                <h2 className="mt-1 text-2xl font-black">{empresa.nome}</h2>
              </div>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <Info label="Categoria" value={empresa.categoria_principal} />
                <Info label="CNPJ" value={empresa.cnpj} />
                <Info label="Cidade/UF" value={[empresa.cidade, empresa.estado].filter(Boolean).join("/")} />
                <Info label="Endereço" value={[empresa.endereco_linha1, empresa.bairro].filter(Boolean).join(" - ")} />
              </dl>
            </div>

            {autorizacao.status === "autorizado" ? (
              <div className="rounded-[16px] border border-emerald-300/30 bg-emerald-300/10 p-5 text-center">
                <h2 className="text-2xl font-black text-emerald-100">Autorização concluída</h2>
                <p className="mt-2 text-sm text-emerald-50">
                  A conta {autorizacao.google_email || "Google selecionada"} foi conectada. Você pode fechar esta página.
                </p>
              </div>
            ) : ["expirado", "revogado"].includes(autorizacao.status) ? (
              <div className="rounded-[16px] border border-amber-300/30 bg-amber-300/10 p-5 text-center">
                <h2 className="text-2xl font-black text-amber-100">Link encerrado</h2>
                <p className="mt-2 text-sm text-amber-50">Peça um novo link ao responsável pelo cadastro.</p>
              </div>
            ) : (
              <>
                <div className="grid gap-3 text-sm leading-6 text-slate-300">
                  <h2 className="text-xl font-black text-white">O que será autorizado</h2>
                  <p>O Google mostrará exatamente quais permissões serão concedidas. A autorização será usada para pesquisar, criar, atualizar e acompanhar o Perfil da Empresa acima.</p>
                  <p>Sua senha não é enviada ao MBA Labs. O acesso pode ser revogado posteriormente na sua Conta Google.</p>
                  <p>Use a Conta Google que já possui o perfil da empresa ou que deverá ficar como proprietária do novo perfil.</p>
                </div>
                <a className="button-primary justify-center py-4 text-base" href={`/api/google-empresas/oauth/iniciar?token=${encodeURIComponent(token)}`}>
                  Continuar com o Google
                </a>
              </>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

function Info({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <dt className="text-xs font-black uppercase text-slate-400">{label}</dt>
      <dd className="mt-1 font-bold text-slate-100">{String(value || "Não informado")}</dd>
    </div>
  );
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
