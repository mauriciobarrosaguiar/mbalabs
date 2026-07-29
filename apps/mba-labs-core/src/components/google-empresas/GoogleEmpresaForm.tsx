import type { GoogleEmpresa } from "@/lib/google-empresas/data";
import { FormDateInput, FormInput, FormSelect, FormTextarea, SubmitButton } from "@/components/ui-kit";

const days = [
  ["MONDAY", "Segunda-feira"],
  ["TUESDAY", "Terça-feira"],
  ["WEDNESDAY", "Quarta-feira"],
  ["THURSDAY", "Quinta-feira"],
  ["FRIDAY", "Sexta-feira"],
  ["SATURDAY", "Sábado"],
  ["SUNDAY", "Domingo"]
] as const;

export function GoogleEmpresaForm({
  action,
  empresa,
  submitLabel = "Salvar empresa"
}: {
  action: (formData: FormData) => void | Promise<void>;
  empresa?: GoogleEmpresa | null;
  submitLabel?: string;
}) {
  return (
    <form action={action} className="panel grid gap-6 p-5 md:p-6">
      {empresa?.id ? <input type="hidden" name="id" value={empresa.id} /> : null}

      <section className="grid gap-4">
        <div>
          <p className="eyebrow">1. Identificação</p>
          <h2 className="mt-1 text-2xl font-black">Dados principais</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <FormInput label="Nome da empresa no Google" name="nome" defaultValue={empresa?.nome} required />
          <FormInput label="Razão social" name="razao_social" defaultValue={empresa?.razao_social} />
          <FormInput label="CNPJ" name="cnpj" defaultValue={empresa?.cnpj} placeholder="00.000.000/0000-00" />
          <FormInput label="Categoria principal" name="categoria_principal" defaultValue={empresa?.categoria_principal} placeholder="Ex.: Farmácia" required />
          <FormInput
            label="Categorias secundárias"
            name="categorias_secundarias"
            defaultValue={(empresa?.categorias_secundarias ?? []).join(", ")}
            placeholder="Separe por vírgulas"
          />
          <FormSelect
            label="Como atende"
            name="tipo_atendimento"
            defaultValue={empresa?.tipo_atendimento ?? "local"}
            required
            options={[
              { label: "No endereço da empresa", value: "local" },
              { label: "No endereço e na casa do cliente", value: "hibrido" },
              { label: "Somente na casa do cliente", value: "area_servico" }
            ]}
          />
          <FormDateInput label="Data de abertura" name="data_abertura" defaultValue={empresa?.data_abertura?.slice(0, 10)} />
        </div>
      </section>

      <section className="grid gap-4 border-t border-white/10 pt-6">
        <div>
          <p className="eyebrow">2. Localização</p>
          <h2 className="mt-1 text-2xl font-black">Endereço e área atendida</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <FormInput label="Endereço e número" name="endereco_linha1" defaultValue={empresa?.endereco_linha1} placeholder="Rua, avenida, quadra e número" />
          <FormInput label="Complemento" name="endereco_linha2" defaultValue={empresa?.endereco_linha2} />
          <FormInput label="Bairro" name="bairro" defaultValue={empresa?.bairro} />
          <FormInput label="Cidade" name="cidade" defaultValue={empresa?.cidade} />
          <FormInput label="Estado" name="estado" defaultValue={empresa?.estado} placeholder="TO" />
          <FormInput label="CEP" name="cep" defaultValue={empresa?.cep} placeholder="00000-000" />
          <FormInput
            label="Áreas atendidas"
            name="areas_atendimento"
            defaultValue={(empresa?.areas_atendimento ?? []).join(", ")}
            placeholder="Ex.: Palmas, Porto Nacional, Paraíso"
          />
        </div>
      </section>

      <section className="grid gap-4 border-t border-white/10 pt-6">
        <div>
          <p className="eyebrow">3. Contato</p>
          <h2 className="mt-1 text-2xl font-black">Canais públicos e responsável</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <FormInput label="Telefone público" name="telefone" defaultValue={empresa?.telefone} />
          <FormInput label="WhatsApp" name="whatsapp" defaultValue={empresa?.whatsapp} />
          <FormInput label="E-mail do cliente" name="email_cliente" type="email" defaultValue={empresa?.email_cliente} />
          <FormInput label="Site" name="site" defaultValue={empresa?.site} placeholder="www.empresa.com.br" />
          <FormTextarea label="Descrição da empresa" name="descricao" defaultValue={empresa?.descricao} />
          <FormTextarea label="Observações internas" name="observacoes" defaultValue={empresa?.observacoes} />
        </div>
      </section>

      <section className="grid gap-4 border-t border-white/10 pt-6">
        <div>
          <p className="eyebrow">4. Horários</p>
          <h2 className="mt-1 text-2xl font-black">Funcionamento regular</h2>
          <p className="mt-2 text-sm text-slate-300">Marque fechado ou informe abertura e fechamento em cada dia.</p>
        </div>
        <div className="grid gap-3">
          {days.map(([day, label]) => {
            const item = (empresa?.horario_regular?.[day] ?? {}) as Record<string, unknown>;
            return (
              <div className="grid gap-3 rounded-[14px] border border-white/10 bg-white/[0.03] p-4 md:grid-cols-[1fr_150px_150px_120px] md:items-end" key={day}>
                <strong>{label}</strong>
                <label className="grid gap-2 text-sm font-bold">
                  Abre
                  <input className="input" type="time" name={`hours_${day}_open`} defaultValue={String(item.open ?? "08:00")} />
                </label>
                <label className="grid gap-2 text-sm font-bold">
                  Fecha
                  <input className="input" type="time" name={`hours_${day}_close`} defaultValue={String(item.close ?? "18:00")} />
                </label>
                <label className="flex min-h-12 items-center gap-2 rounded-[8px] border border-white/10 px-3 text-sm font-bold">
                  <input type="checkbox" name={`hours_${day}_closed`} value="true" defaultChecked={item.closed === true} />
                  Fechado
                </label>
              </div>
            );
          })}
        </div>
      </section>

      <div className="flex flex-wrap gap-3 border-t border-white/10 pt-6">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
