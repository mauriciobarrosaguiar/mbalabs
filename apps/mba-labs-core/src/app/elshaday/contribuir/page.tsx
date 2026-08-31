import type { ReactNode } from "react";
import {
  BadgeCheck,
  CircleAlert,
  HeartHandshake,
  QrCode,
  ReceiptText,
  ShieldCheck
} from "lucide-react";
import {
  dateBR,
  moneyBR,
  requireElshadayContext
} from "@/lib/elshaday";
import { getElshadayPixStatus } from "@/lib/elshaday-payments";
import { createElshadayIdentifiedPix } from "../actions";
import { PixCopyButton } from "./PixCopyButton";

export const dynamic = "force-dynamic";

export default async function ElshadayContributePage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const context = await requireElshadayContext("/elshaday/contribuir");
  const pix = await getElshadayPixStatus(context.igreja.id);

  const { data: member, error: memberError } = await context.admin
    .from("igreja_membros")
    .select("id,nome,cpf,situacao")
    .eq("igreja_id", context.igreja.id)
    .eq("user_id", context.current.authUser.id)
    .maybeSingle();

  if (memberError) throw new Error(`Falha ao carregar vínculo do membro: ${memberError.message}`);

  const chargeId = readParam(query.cobranca);
  const errorMessage = readParam(query.erro);
  const ok = readParam(query.ok);

  let currentCharge: any = null;
  let recentCharges: any[] = [];

  if (member?.id) {
    const [chargeResult, recentResult] = await Promise.all([
      chargeId
        ? context.admin
            .from("igreja_pix_cobrancas")
            .select("id,membro_id,tipo,descricao,valor,status,due_date,qr_payload,qr_image,qr_expiration_at,paid_at,created_at")
            .eq("igreja_id", context.igreja.id)
            .eq("membro_id", member.id)
            .eq("id", chargeId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      context.admin
        .from("igreja_pix_cobrancas")
        .select("id,tipo,valor,status,created_at,paid_at")
        .eq("igreja_id", context.igreja.id)
        .eq("membro_id", member.id)
        .order("created_at", { ascending: false })
        .limit(6)
    ]);

    if (chargeResult.error) throw new Error(`Falha ao carregar cobrança PIX: ${chargeResult.error.message}`);
    if (recentResult.error) throw new Error(`Falha ao carregar histórico PIX: ${recentResult.error.message}`);

    currentCharge = chargeResult.data ?? null;
    recentCharges = recentResult.data ?? [];
  }

  const hasCpf = Boolean(String(member?.cpf ?? "").replace(/\D/g, ""));
  const canGenerateIdentified =
    Boolean(member?.id) &&
    String(member?.situacao ?? "") !== "inativo" &&
    hasCpf &&
    pix.ready;

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <header className="text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#123d2d] text-[#f1d79d]">
          <HeartHandshake size={28} />
        </div>
        <p className="mt-4 text-xs font-black uppercase tracking-[.16em] text-[#176445]">Contribuições</p>
        <h1 className="mt-1 text-3xl font-black">Contribuir via PIX</h1>
        <p className="mx-auto mt-3 max-w-2xl text-slate-600">
          Gere um PIX identificado para que Dízimo, Oferta ou Campanha entre automaticamente na categoria correta.
        </p>
      </header>

      {errorMessage ? (
        <Message kind="error">{errorMessage}</Message>
      ) : null}
      {ok === "pix_identificado" && currentCharge ? (
        <Message kind="success">PIX identificado gerado. Faça o pagamento no aplicativo do seu banco.</Message>
      ) : null}

      {currentCharge ? (
        <IdentifiedChargeCard charge={currentCharge} />
      ) : (
        <section className="rounded-[32px] border border-emerald-950/10 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-800">
              <ReceiptText size={22} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[.14em] text-[#176445]">PIX identificado</p>
              <h2 className="mt-1 text-xl font-black">Escolha o tipo e informe o valor</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Depois do pagamento, a confirmação entra no financeiro já ligada ao seu cadastro e à categoria escolhida.
              </p>
            </div>
          </div>

          {!member ? (
            <Requirement>
              Seu login ainda não está vinculado a uma ficha de membro. A Secretaria precisa fazer esse vínculo antes de você gerar um PIX identificado.
            </Requirement>
          ) : String(member.situacao) === "inativo" ? (
            <Requirement>
              Seu cadastro de membro está inativo. Procure a Secretaria para atualizá-lo.
            </Requirement>
          ) : !hasCpf ? (
            <Requirement>
              Seu cadastro ainda não possui CPF. O CPF é necessário para o Asaas criar o pagador da cobrança identificada. Procure a Secretaria para completar a ficha.
            </Requirement>
          ) : !pix.ready ? (
            <Requirement>
              A integração PIX da igreja ainda não está totalmente ativada pela Tesouraria.
            </Requirement>
          ) : (
            <form action={createElshadayIdentifiedPix} className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Tipo da contribuição
                <select className="input" name="tipo" defaultValue="dizimo" required>
                  <option value="dizimo">Dízimo</option>
                  <option value="oferta">Oferta</option>
                  <option value="oferta_especial">Oferta especial</option>
                  <option value="campanha">Campanha</option>
                  <option value="outro">Outro</option>
                </select>
              </label>

              <label className="grid gap-2 text-sm font-bold text-slate-700">
                Valor
                <input
                  className="input"
                  inputMode="decimal"
                  name="valor"
                  placeholder="0,00"
                  required
                />
              </label>

              <label className="grid gap-2 text-sm font-bold text-slate-700 sm:col-span-2">
                Descrição opcional
                <input
                  className="input"
                  maxLength={180}
                  name="descricao"
                  placeholder="Ex.: Campanha de missões"
                />
              </label>

              <div className="sm:col-span-2">
                <button
                  className="min-h-12 w-full rounded-2xl bg-[#123d2d] px-6 font-black text-white disabled:opacity-50 sm:w-auto"
                  disabled={!canGenerateIdentified}
                  type="submit"
                >
                  Gerar PIX identificado
                </button>
              </div>
            </form>
          )}

          <div className="mt-5 flex items-start gap-2 rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-600">
            <ShieldCheck className="mt-0.5 shrink-0 text-emerald-700" size={17} />
            <p>
              O membro não enxerga o financeiro da igreja. Esta tela mostra apenas as próprias cobranças PIX identificadas.
            </p>
          </div>
        </section>
      )}

      {member && recentCharges.length > 0 ? (
        <section className="overflow-hidden rounded-[28px] border border-emerald-950/10 bg-white">
          <div className="border-b border-slate-100 p-5">
            <h2 className="font-black">Meus PIX identificados</h2>
            <p className="mt-1 text-sm text-slate-500">Últimas cobranças geradas pelo seu login.</p>
          </div>
          <div className="divide-y divide-slate-100">
            {recentCharges.map((charge: any) => (
              <a
                className="flex items-center justify-between gap-4 p-5 transition hover:bg-slate-50"
                href={`/elshaday/contribuir?cobranca=${encodeURIComponent(charge.id)}`}
                key={charge.id}
              >
                <div>
                  <p className="font-black">{typeLabel(charge.tipo)}</p>
                  <p className="mt-1 text-xs text-slate-500">{dateTimeBR(charge.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className="font-black">{moneyBR(charge.valor)}</p>
                  <ChargeStatus value={charge.status} />
                </div>
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <details className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
        <summary className="cursor-pointer list-none font-black">PIX geral da igreja</summary>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Use esta opção quando não quiser vincular a contribuição ao seu cadastro ou selecionar uma categoria.
        </p>

        {!pix.staticQrPayload ? (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center text-amber-950">
            <QrCode className="mx-auto mb-3" size={28} />
            <p className="font-black">PIX geral ainda não disponível</p>
            <p className="mt-2 text-sm">A Tesouraria ainda está concluindo a configuração.</p>
          </div>
        ) : (
          <div className="mt-5">
            {pix.staticQrImage ? (
              <div className="mx-auto max-w-[280px] rounded-[28px] bg-white p-4 shadow-sm">
                <img
                  alt="QR Code PIX geral da Igreja Elshaday"
                  className="h-auto w-full"
                  src={imageSource(pix.staticQrImage)}
                />
              </div>
            ) : null}

            <textarea
              className="mx-auto mt-4 block min-h-28 w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-3 text-xs"
              readOnly
              value={pix.staticQrPayload}
            />
            <div className="mt-4 flex justify-center">
              <PixCopyButton value={pix.staticQrPayload} />
            </div>
          </div>
        )}
      </details>

      <style>{`
        .input {
          min-height: 3rem;
          border-radius: 1rem;
          border: 1px solid rgb(226 232 240);
          background: white;
          padding: 0 1rem;
          outline: none;
        }
        .input:focus { border-color: rgb(5 150 105); }
      `}</style>
    </div>
  );
}

function IdentifiedChargeCard({ charge }: { charge: any }) {
  const paid = charge.status === "pago";
  const waiting = charge.status === "aguardando_pagamento";

  return (
    <section className={`rounded-[32px] border p-5 shadow-sm sm:p-8 ${
      paid
        ? "border-emerald-200 bg-emerald-50"
        : "border-sky-200 bg-sky-50"
    }`}>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <p className="text-xs font-black uppercase tracking-[.14em] text-slate-500">
            PIX identificado
          </p>
          <h2 className="mt-1 text-2xl font-black">{typeLabel(charge.tipo)}</h2>
          <p className="mt-2 text-3xl font-black">{moneyBR(charge.valor)}</p>
          <div className="mt-3"><ChargeStatus value={charge.status} /></div>
        </div>

        {paid ? (
          <div className="grid size-14 place-items-center rounded-2xl bg-emerald-700 text-white">
            <BadgeCheck size={29} />
          </div>
        ) : (
          <div className="grid size-14 place-items-center rounded-2xl bg-sky-900 text-white">
            <QrCode size={28} />
          </div>
        )}
      </div>

      {paid ? (
        <div className="mt-6 rounded-2xl bg-white/70 p-5 text-sm leading-6 text-emerald-950">
          Pagamento confirmado automaticamente. A contribuição já foi conciliada no financeiro da igreja.
        </div>
      ) : waiting && charge.qr_payload ? (
        <div className="mt-6">
          {charge.qr_image ? (
            <div className="mx-auto max-w-[310px] rounded-[30px] bg-white p-5 shadow-sm">
              <img
                alt="QR Code PIX identificado"
                className="h-auto w-full"
                src={imageSource(charge.qr_image)}
              />
            </div>
          ) : null}

          <p className="mt-5 text-center text-sm font-black text-slate-700">PIX Copia e Cola</p>
          <textarea
            className="mx-auto mt-3 block min-h-32 w-full max-w-2xl rounded-2xl border border-sky-200 bg-white p-4 text-xs leading-5"
            readOnly
            value={charge.qr_payload}
          />
          <div className="mt-4 flex justify-center">
            <PixCopyButton value={charge.qr_payload} />
          </div>

          <p className="mt-4 text-center text-xs text-slate-500">
            Vencimento da cobrança: {charge.due_date ? dateBR(charge.due_date) : "—"}
          </p>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl bg-white/70 p-5 text-sm text-slate-700">
          Esta cobrança não está disponível para pagamento. Gere uma nova contribuição se necessário.
        </div>
      )}

      <div className="mt-5 text-center">
        <a className="text-sm font-black text-[#176445]" href="/elshaday/contribuir">
          Gerar outra contribuição
        </a>
      </div>
    </section>
  );
}

function Requirement({ children }: { children: ReactNode }) {
  return (
    <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
      <CircleAlert className="mt-0.5 shrink-0" size={19} />
      <p>{children}</p>
    </div>
  );
}

function Message({
  kind,
  children
}: {
  kind: "success" | "error";
  children: ReactNode;
}) {
  return (
    <div className={`rounded-2xl border p-4 text-sm font-bold ${
      kind === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
        : "border-red-200 bg-red-50 text-red-800"
    }`}>
      {children}
    </div>
  );
}

function ChargeStatus({ value }: { value: string }) {
  const labels: Record<string, string> = {
    criando: "Gerando",
    aguardando_pagamento: "Aguardando pagamento",
    pago: "Pago",
    expirado: "Expirado",
    cancelado: "Cancelado",
    estornado: "Estornado",
    erro: "Erro"
  };
  const styles: Record<string, string> = {
    pago: "bg-emerald-100 text-emerald-800",
    aguardando_pagamento: "bg-sky-100 text-sky-800",
    criando: "bg-amber-100 text-amber-800",
    estornado: "bg-red-100 text-red-700",
    erro: "bg-red-100 text-red-700",
    expirado: "bg-slate-100 text-slate-600",
    cancelado: "bg-slate-100 text-slate-600"
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${styles[value] ?? "bg-slate-100 text-slate-600"}`}>
      {labels[value] ?? value}
    </span>
  );
}

function typeLabel(value: string) {
  const labels: Record<string, string> = {
    dizimo: "Dízimo",
    oferta: "Oferta",
    oferta_especial: "Oferta especial",
    campanha: "Campanha",
    outro: "Outro"
  };
  return labels[value] ?? value;
}

function dateTimeBR(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Araguaina",
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
}

function imageSource(value: string) {
  if (value.startsWith("data:image/")) return value;
  return `data:image/png;base64,${value}`;
}
