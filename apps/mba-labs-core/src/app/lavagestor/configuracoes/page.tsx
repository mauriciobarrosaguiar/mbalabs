import { LavaGestorShell } from "@/components/LavaGestorShell";
import { BackButton, MessageBanner, PageHeader } from "@/components/ui-kit";
import { saveLavaConfiguracoesEmpresa } from "@/lib/actions/lavagestor-configuracoes-actions";
import { firstParam } from "@/lib/form-utils";
import { getLavaConfiguracoesEmpresa } from "@/lib/lavagestor-configuracoes-data";

export const dynamic = "force-dynamic";

export default async function LavaConfiguracoesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const { config, error } = await getLavaConfiguracoesEmpresa();

  return (
    <LavaGestorShell activePath="/lavagestor/configuracoes" companyName={config.nome_exibicao}>
      <section className="grid gap-6">
        <PageHeader
          eyebrow="LavaGestor"
          title="Configurações da empresa"
          description="Personalize dados, regras financeiras, mensagens, motivos e identidade do LavaGestor."
          actions={<BackButton href="/lavagestor" />}
        />
        <MessageBanner ok={firstParam(params.ok)} error={firstParam(params.error) ?? error ?? undefined} />

        <form action={saveLavaConfiguracoesEmpresa} className="grid gap-5">
          <ConfigBlock title="1. Dados da empresa" description="Essas informações serão usadas no cabeçalho, recibos, relatórios e mensagens.">
            <Field label="Nome que aparece no sistema" name="nome_exibicao" defaultValue={config.nome_exibicao} required />
            <Field label="Nome fantasia" name="nome_fantasia" defaultValue={config.nome_fantasia} />
            <Field label="CNPJ / CPF" name="documento" defaultValue={config.documento} />
            <Field label="WhatsApp principal" name="whatsapp" defaultValue={config.whatsapp} placeholder="Ex.: 63999999999" />
            <Field label="Telefone" name="telefone" defaultValue={config.telefone} />
            <Field label="Endereço" name="endereco" defaultValue={config.endereco} wide />
            <Field label="Cidade" name="cidade" defaultValue={config.cidade} />
            <Field label="Estado" name="estado" defaultValue={config.estado} placeholder="TO" />
            <Field label="URL da logo" name="logo_url" defaultValue={config.logo_url} placeholder="https://..." wide />
          </ConfigBlock>

          <ConfigBlock title="2. Financeiro" description="Defina os padrões de comissão, pagamento e regras de cobrança.">
            <Field label="Comissão padrão dos lavadores (%)" name="percentual_comissao_padrao" defaultValue={String(config.percentual_comissao_padrao)} type="number" step="0.01" />
            <label className="grid gap-2"><span className="text-sm font-bold">Forma de pagamento padrão</span><select className="input" name="forma_pagamento_padrao" defaultValue={config.forma_pagamento_padrao}><option value="pix">Pix</option><option value="dinheiro">Dinheiro</option><option value="cartao_credito">Cartão de crédito</option><option value="cartao_debito">Cartão de débito</option><option value="transferencia">Transferência</option><option value="fiado">Fiado</option></select></label>
            <Field label="Chave PIX" name="chave_pix" defaultValue={config.chave_pix} wide />
            <Toggle label="Permitir fiado" name="permitir_fiado" defaultChecked={config.permitir_fiado} />
            <Toggle label="Permitir desconto" name="permitir_desconto" defaultChecked={config.permitir_desconto} />
            <Toggle label="Bloquear entrega sem pagamento" name="bloquear_entrega_sem_pagamento" defaultChecked={config.bloquear_entrega_sem_pagamento} />
          </ConfigBlock>

          <ConfigBlock title="3. Operação" description="Controle opções que aparecem na rotina do lava-jato.">
            <TextArea label="Motivos de cancelamento" name="motivos_cancelamento" defaultValue={config.motivos_cancelamento.join("\n")} helper="Coloque um motivo por linha." />
            <TextArea label="Tipos de entrega" name="tipos_entrega" defaultValue={config.tipos_entrega.join("\n")} helper="Coloque uma opção por linha. Ex.: Cliente retira / Levar ao cliente." />
          </ConfigBlock>

          <ConfigBlock title="4. Mensagens automáticas" description="Use variáveis: {cliente}, {veiculo}, {total}, {recibo}, {entrega}.">
            <TextArea label="Mensagem de veículo pronto" name="mensagem_veiculo_pronto" defaultValue={config.mensagem_veiculo_pronto} />
            <TextArea label="Mensagem do recibo no WhatsApp" name="mensagem_recibo" defaultValue={config.mensagem_recibo} />
          </ConfigBlock>

          <ConfigBlock title="5. Identidade visual" description="Primeira versão simples para deixar cada lava-jato com a própria cara.">
            <label className="grid gap-2"><span className="text-sm font-bold">Cor principal</span><div className="flex gap-3"><input className="h-12 w-16 rounded-lg border border-border bg-white p-1" name="cor_principal" type="color" defaultValue={config.cor_principal || "#059669"} /><input className="input" defaultValue={config.cor_principal || "#059669"} readOnly /></div></label>
            <div className="rounded-xl border border-border bg-muted p-4 md:col-span-2"><p className="text-xs font-black uppercase tracking-[0.1em] text-muted-foreground">Prévia</p><div className="mt-3 rounded-xl border border-border bg-white p-4"><h3 className="text-2xl font-black" style={{ color: config.cor_principal }}>{config.nome_exibicao}</h3><p className="text-sm font-semibold text-muted-foreground">Recibos, relatórios e WhatsApp usarão essas informações.</p></div></div>
          </ConfigBlock>

          <div className="sticky bottom-4 z-10 rounded-xl border border-emerald-200 bg-white/95 p-3 shadow-xl backdrop-blur"><button className="button-primary w-full md:w-auto" type="submit">Salvar configurações</button></div>
        </form>
      </section>
    </LavaGestorShell>
  );
}

function ConfigBlock({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="panel grid gap-4 p-4"><div><h2 className="text-2xl font-black">{title}</h2><p className="mt-1 text-sm font-semibold text-muted-foreground">{description}</p></div><div className="grid gap-4 md:grid-cols-2">{children}</div></section>;
}

function Field({ label, name, defaultValue, placeholder, type = "text", required = false, wide = false, step }: { label: string; name: string; defaultValue?: string; placeholder?: string; type?: string; required?: boolean; wide?: boolean; step?: string }) {
  return <label className={`grid gap-2 ${wide ? "md:col-span-2" : ""}`}><span className="text-sm font-bold">{label}</span><input className="input" name={name} type={type} defaultValue={defaultValue ?? ""} placeholder={placeholder} required={required} step={step} /></label>;
}

function TextArea({ label, name, defaultValue, helper }: { label: string; name: string; defaultValue?: string; helper?: string }) {
  return <label className="grid gap-2 md:col-span-2"><span className="text-sm font-bold">{label}</span><textarea className="input min-h-28 resize-y" name={name} defaultValue={defaultValue ?? ""} />{helper ? <span className="text-xs font-semibold text-muted-foreground">{helper}</span> : null}</label>;
}

function Toggle({ label, name, defaultChecked }: { label: string; name: string; defaultChecked: boolean }) {
  return <label className="flex items-center justify-between gap-3 rounded-lg border border-border bg-white p-3"><span className="font-bold">{label}</span><input className="h-5 w-5" name={name} type="checkbox" defaultChecked={defaultChecked} /></label>;
}
