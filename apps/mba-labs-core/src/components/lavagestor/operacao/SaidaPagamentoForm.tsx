import { registrarSaidaOperacao } from "@/lib/actions/lavagestor-operacao-actions";

type Row = Record<string, unknown>;

const conveniosPadrao = [
  "ANM",
  "Alianca Auto Center (Desc. 15%)",
  "Andar Locadora (Desc. 33%)",
  "Ariolino",
  "Bunge (Desc. R$ 10,00)",
  "CAOA CHERY - NOVOS",
  "CAOA CHERY - SEMI NOVOS",
  "CRM",
  "CRT - TO",
  "Carajas (Desc. 10%)",
  "Celebrate (Desc. 11%)",
  "Cid - Oficina Alianca (Desc. 15%)",
  "Claro - Ticket Log",
  "Cref 14 (R$ 60,00)"
];

export function SaidaPagamentoForm({ lavagemId, funcionarios, funcionarioAtual = "" }: { lavagemId: string; funcionarios: Row[]; funcionarioAtual?: string }) {
  return (
    <form action={registrarSaidaOperacao} className="grid gap-3 p-3 pt-0">
      <input type="hidden" name="lavagem_id" value={lavagemId} />
      <input type="hidden" name="return_to" value="/lavagestor/operacao/fila" />

      <div className="grid gap-2 rounded-2xl bg-muted p-3">
        <p className="text-sm font-black">Quem lavou?</p>
        <div className="grid gap-2">
          {funcionarios.map((funcionario) => {
            const funcionarioId = String(funcionario.id ?? "");
            return (
              <label className="flex items-center gap-3 rounded-xl bg-white p-3 text-sm font-black" key={funcionarioId}>
                <input className="h-5 w-5" type="checkbox" name="funcionario_ids" value={funcionarioId} defaultChecked={funcionarioAtual === funcionarioId} />
                <span className="min-w-0 truncate">{String(funcionario.nome ?? "Lavador")}</span>
              </label>
            );
          })}
        </div>
        <p className="text-xs font-semibold text-muted-foreground">Pode marcar mais de um. A comissao sera dividida entre os selecionados.</p>
      </div>

      <label className="grid gap-2">
        <span className="text-sm font-black">Convenio</span>
        <select className="input min-h-12 text-base font-bold" name="convenio_nome" defaultValue="">
          <option value="">Selecione o convenio</option>
          {conveniosPadrao.map((convenio) => (
            <option key={convenio} value={convenio}>{convenio}</option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-2">
        <button name="tipo_saida" value="pago" className="min-h-16 rounded-2xl bg-emerald-500 px-3 text-base font-black text-white shadow-sm active:scale-[0.98]" type="submit">PAGO</button>
        <button name="tipo_saida" value="convenio" className="min-h-16 rounded-2xl bg-blue-500 px-3 text-base font-black text-white shadow-sm active:scale-[0.98]" type="submit">CONVENIO</button>
        <button name="tipo_saida" value="fiado" className="min-h-16 rounded-2xl bg-amber-500 px-3 text-base font-black text-white shadow-sm active:scale-[0.98]" type="submit">FIADO</button>
        <button name="tipo_saida" value="faturar" className="min-h-16 rounded-2xl bg-slate-700 px-3 text-base font-black text-white shadow-sm active:scale-[0.98]" type="submit">A FATURAR</button>
        <button name="tipo_saida" value="cancelado" className="col-span-2 min-h-14 rounded-2xl bg-red-500 px-3 text-base font-black text-white shadow-sm active:scale-[0.98]" type="submit" formNoValidate>CANCELAR</button>
      </div>
    </form>
  );
}
