import { redirect } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import {
  BackButton,
  FormCheckbox,
  FormInput,
  FormTextarea,
  MessageBanner,
  PageHeader,
  ResourceForm,
  SubmitButton
} from "@/components/ui-kit";
import { saveSiteConfig } from "@/lib/actions/site-config-actions";
import { firstParam } from "@/lib/form-utils";
import { getSiteConfigForAdmin } from "@/lib/site-config";

export const dynamic = "force-dynamic";

export default async function SiteConfigPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { current, config } = await getSiteConfigForAdmin();

  if (!current.isAdminMaster) {
    redirect("/dashboard");
  }

  const benefits = Array.from({ length: 6 }, (_, index) => config.benefits[index] ?? "");

  return (
    <main>
      <AppNav />
      <section className="page-shell grid gap-8 py-8">
        <PageHeader
          eyebrow="Configurações do site"
          title="Editor da landing MBA Labs"
          description="Edite textos comerciais, logo, WhatsApp, cards de sistemas, benefícios e conteúdo público da página inicial."
          actions={<BackButton href="/admin/configuracoes" label="Voltar" />}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error)} />

        <form action={saveSiteConfig} className="grid gap-6">
          <ResourceForm title="Marca e chamada principal" actions={<SubmitButton>Salvar configurações do site</SubmitButton>}>
            <FormInput label="Nome da marca" name="brandName" defaultValue={config.brandName} required />
            <FormInput label="URL do logo" name="logoUrl" defaultValue={config.logoUrl} placeholder="https://..." />
            <FormInput label="Etiqueta do hero" name="heroEyebrow" defaultValue={config.heroEyebrow} required />
            <FormInput label="Título principal" name="heroTitle" defaultValue={config.heroTitle} required />
            <FormTextarea label="Texto principal" name="heroSubtitle" defaultValue={config.heroSubtitle} />
            <FormTextarea label="Texto de apoio" name="heroSupportText" defaultValue={config.heroSupportText} />
            <FormInput label="Texto do botão principal" name="primaryButtonText" defaultValue={config.primaryButtonText} required />
            <FormInput label="Texto do botão WhatsApp" name="whatsappButtonText" defaultValue={config.whatsappButtonText} required />
            <FormInput label="URL do WhatsApp" name="whatsappUrl" defaultValue={config.whatsappUrl} required />
            <FormInput label="Cor principal" name="primaryColor" defaultValue={config.primaryColor} type="color" />
            <FormInput label="Cor de apoio" name="secondaryColor" defaultValue={config.secondaryColor} type="color" />
          </ResourceForm>

          <ResourceForm title="Card comercial lateral" actions={null}>
            <FormInput label="Etiqueta" name="sideEyebrow" defaultValue={config.sideEyebrow} required />
            <FormInput label="Título" name="sideTitle" defaultValue={config.sideTitle} required />
            <FormTextarea label="Texto do card" name="sideText" defaultValue={config.sideText} />
          </ResourceForm>

          <section className="panel grid gap-5 p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <FormInput label="Título da área de sistemas" name="systemsTitle" defaultValue={config.systemsTitle} required />
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              {config.systems.map((system) => (
                <div className="grid gap-4 rounded-[8px] border border-white/10 bg-white/[0.04] p-4" key={system.key}>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">{system.href}</p>
                    <h2 className="mt-1 text-lg font-black">{system.name}</h2>
                  </div>
                  <FormCheckbox label="Mostrar este card na landing" name={`system_${system.key}_visible`} defaultChecked={system.visible} />
                  <FormInput label="Nome do card" name={`system_${system.key}_name`} defaultValue={system.name} required />
                  <FormTextarea label="Descrição" name={`system_${system.key}_description`} defaultValue={system.description} />
                  <FormInput label="Texto do botão" name={`system_${system.key}_cta`} defaultValue={system.cta} required />
                </div>
              ))}
            </div>
          </section>

          <ResourceForm title="Benefícios e rodapé" actions={<SubmitButton>Salvar tudo</SubmitButton>}>
            <FormInput label="Título dos benefícios" name="benefitsTitle" defaultValue={config.benefitsTitle} required />
            {benefits.map((benefit, index) => (
              <FormInput
                label={`Benefício ${index + 1}`}
                name={`benefit_${index}`}
                defaultValue={benefit}
                key={`benefit_${index}`}
              />
            ))}
            <FormTextarea label="Texto de rodapé" name="footerText" defaultValue={config.footerText} />
          </ResourceForm>
        </form>
      </section>
    </main>
  );
}
