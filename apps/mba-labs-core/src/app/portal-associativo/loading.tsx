import { Bell, Menu, Sparkles } from "lucide-react";
import styles from "./portal-shell.module.css";

export default function PortalAssociativoLoading() {
  return (
    <div className={`${styles.root} portal-associativo-module min-h-screen`} aria-live="polite" aria-busy="true">
      <header className={`${styles.mobileTop} sticky top-0 z-30 flex items-center justify-between px-6 py-5 lg:hidden`}>
        <span className={styles.menuTrigger} aria-hidden>
          <Menu className="h-6 w-6" />
        </span>
        <span className={styles.notificationButton} aria-hidden>
          <Bell className="h-5 w-5" />
          <span className={styles.notificationDot} />
        </span>
      </header>

      <div className="lg:grid lg:min-h-screen lg:grid-cols-[19rem_minmax(0,1fr)]">
        <aside className={`${styles.sidebar} hidden lg:flex`}>
          <div className="flex min-h-full w-full flex-col">
            <div className={styles.sidebarBrand}>
              <span className={styles.brandMark}>
                <Sparkles className="h-6 w-6" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-lg font-black leading-tight">Portal Associativo</span>
                <span className="block truncate text-sm font-semibold opacity-65">Carregando ambiente</span>
              </span>
            </div>

            <div className={styles.userCard}>
              <span className={`${styles.userAvatar} animate-pulse`} />
              <span className="grid min-w-0 flex-1 gap-2">
                <span className="h-4 w-36 rounded-full bg-white/20" />
                <span className="h-3 w-24 rounded-full bg-white/10" />
              </span>
            </div>

            <div className={styles.navSectionLabel}>Navegação</div>
            <div className="grid gap-2">
              {Array.from({ length: 8 }).map((_, index) => (
                <span className="h-12 rounded-[24px] bg-white/10" key={index} />
              ))}
            </div>
          </div>
        </aside>

        <main className="min-w-0 px-6 py-8 pb-12 sm:px-8 lg:px-10 xl:px-12">
          <div className="mx-auto grid max-w-7xl gap-8">
            <section className="grid gap-3">
              <p className="eyebrow">Portal Associativo</p>
              <h1 className="text-4xl font-black leading-tight text-slate-950 sm:text-5xl">Carregando painel</h1>
              <p className="max-w-2xl text-lg font-medium leading-relaxed text-slate-600">
                Preparando associados, unidades, cobranças, documentos e avisos.
              </p>
            </section>

            <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {["Associados ativos", "Arrecadação do mês", "Inadimplência"].map((label) => (
                <div className="panel min-h-40 overflow-hidden p-6" key={label}>
                  <div className="grid h-full content-between gap-5">
                    <span className="text-base font-semibold text-slate-500">{label}</span>
                    <span className="h-9 w-40 animate-pulse rounded-full bg-slate-200" />
                    <span className="flex items-center justify-between">
                      <span className="h-7 w-24 animate-pulse rounded-full bg-emerald-100" />
                      <span className="h-4 w-28 animate-pulse rounded-full bg-slate-200" />
                    </span>
                  </div>
                </div>
              ))}
            </section>

            <section className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
              <div className="panel grid gap-4 p-6">
                <span className="h-5 w-44 rounded-full bg-slate-200" />
                {Array.from({ length: 4 }).map((_, index) => (
                  <span className="h-12 animate-pulse rounded-2xl bg-slate-100" key={index} />
                ))}
              </div>
              <div className="panel grid gap-4 p-6">
                <span className="h-5 w-36 rounded-full bg-slate-200" />
                {Array.from({ length: 3 }).map((_, index) => (
                  <span className="h-14 animate-pulse rounded-2xl bg-slate-100" key={index} />
                ))}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
