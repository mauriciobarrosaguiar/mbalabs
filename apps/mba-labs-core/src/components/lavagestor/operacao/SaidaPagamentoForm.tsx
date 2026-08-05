"use client";

import { useMemo, useState } from "react";
import { registrarSaidaOperacao } from "@/lib/actions/lavagestor-operacao-actions";

type Row = Record<string, unknown>;
type Convenio = {
  id: string;
  nome: string;
  percentual_desconto: number;
  nao_paga: boolean;
};

const formasPagamento = [
  { value: "pix", label: "Pix" },
  { value: "cartao_credito", label: "Cartão crédito" },
  { value: "cartao_debito", label: "Cartão débito" }
];

export function SaidaPagamentoForm({
  lavagemId,
  funcionarios,
  funcionarioAtual = "",
  convenios = [],
  valorOriginal = 0
}: {
  lavagemId: string;
  funcionarios: Row[];
  funcionarioAtual?: string;
  convenios?: Convenio[];
  valorOriginal?: number;
}) {
  const [modoPago, setModoPago] = useState(false);
  const [formaPagamento, setFormaPagamento] = useState("pix");
  const [convenioId, setConvenioId] = useState("");

  const resumoConvenio = useMemo(() => {
    const convenio = convenios.find((item) => item.id === convenioId);
    const percentual = convenio?.nao_paga ? 100 : clampPercent(convenio?.percentual_desconto ?? 0);
    const desconto = roundMoney(Number(valorOriginal || 0) * percentual / 100);
    const valorFinal = roundMoney(Math.max(Number(valorOriginal || 0) - desconto, 0));
    return { convenio, percentual, desconto, valorFinal };
  }, [convenioId, convenios, valorOriginal]);

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
        <span className="text-sm font-black">Convênio</span>
        <select className="input min-h-12 text-base font-bold" name="convenio_id" value={convenioId} onChange={(event) => setConvenioId(event.target.value)}>
          <option value="">Sem convênio</option>
          {convenios.map((convenio) => (
            <option key={convenio.id} value={convenio.id}>
              {convenio.nome} · {convenio.nao_paga ? "100%" : `${clampPercent(convenio.percentual_desconto)}%`}
            </option>
          ))}
        </select>
      </label>

      {resumoConvenio.convenio ? (
        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-blue-100 bg-blue-50 p-2 text-center text-xs font-black text-blue-950">
          <span className="rounded-xl bg-white px-2 py-2">Desconto<br />{formatCurrency(resumoConvenio.desconto)}</span>
          <span className="rounded-xl bg-white px-2 py-2">Final<br />{formatCurrency(resumoConvenio.valorFinal)}</span>
          <span className="rounded-xl bg-white px-2 py-2">Comissão<br />sobre final</span>
        </div>
      ) : null}

      {modoPago ? (
        <div className="grid gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
          <label className="grid gap-2">
            <span className="text-sm font-black text-emerald-950">Forma de pagamento</span>
            <select
              className="input min-h-14 bg-white text-base font-black"
              name="forma_pagamento"
              required
              value={formaPagamento}
              onChange={(event) => setFormaPagamento(event.target.value)}
            >
              {formasPagamento.map((forma) => (
                <option key={forma.value} value={forma.value}>{forma.label}</option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <button className="min-h-12 rounded-2xl border border-emerald-200 bg-white px-3 text-sm font-black text-emerald-950 shadow-sm active:scale-[0.98]" type="button" onClick={() => setModoPago(false)}>
              Voltar
            </button>
            <button name="tipo_saida" value="pago" className="min-h-12 rounded-2xl bg-emerald-600 px-3 text-sm font-black text-white shadow-sm active:scale-[0.98]" type="submit">
              Finalizar saída
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <button className="min-h-16 rounded-2xl bg-emerald-500 px-3 text-base font-black text-white shadow-sm active:scale-[0.98]" type="button" onClick={() => setModoPago(true)}>
            PAGO
          </button>
          <button name="tipo_saida" value="convenio" className="min-h-16 rounded-2xl bg-blue-500 px-3 text-base font-black text-white shadow-sm active:scale-[0.98]" type="submit">
            CONVÊNIO
          </button>
          <button name="tipo_saida" value="fiado" className="min-h-16 rounded-2xl bg-amber-500 px-3 text-base font-black text-white shadow-sm active:scale-[0.98]" type="submit">
            FIADO
          </button>
          <button name="tipo_saida" value="faturar" className="min-h-16 rounded-2xl bg-slate-700 px-3 text-base font-black text-white shadow-sm active:scale-[0.98]" type="submit">
            A FATURAR
          </button>
          <button name="tipo_saida" value="cancelado" className="col-span-2 min-h-14 rounded-2xl bg-red-500 px-3 text-base font-black text-white shadow-sm active:scale-[0.98]" type="submit" formNoValidate>
            CANCELAR
          </button>
        </div>
      )}
    </form>
  );
}

function clampPercent(value: unknown) {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) return 0;
  return Math.min(Math.max(number, 0), 100);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function formatCurrency(value: unknown) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value ?? 0));
}
