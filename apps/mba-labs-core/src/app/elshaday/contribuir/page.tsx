import { HeartHandshake, QrCode } from "lucide-react";
import { requireElshadayContext } from "@/lib/elshaday";
import { getElshadayPixStatus } from "@/lib/elshaday-payments";
import { PixCopyButton } from "./PixCopyButton";

export const dynamic = "force-dynamic";

export default async function ElshadayContributePage() {
  const context = await requireElshadayContext("/elshaday/contribuir");
  const pix = await getElshadayPixStatus(context.igreja.id);

  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <header className="text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#123d2d] text-[#f1d79d]">
          <HeartHandshake size={28} />
        </div>
        <p className="mt-4 text-xs font-black uppercase tracking-[.16em] text-[#176445]">Contribuições</p>
        <h1 className="mt-1 text-3xl font-black">PIX da Igreja Elshaday</h1>
        <p className="mx-auto mt-3 max-w-2xl text-slate-600">
          Use o QR Code ou o PIX Copia e Cola para contribuir com a igreja pelo aplicativo do seu banco.
        </p>
      </header>

      {!pix.staticQrPayload ? (
        <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-8 text-center text-amber-950">
          <QrCode className="mx-auto mb-3" size={30} />
          <p className="font-black">PIX ainda não disponível</p>
          <p className="mt-2 text-sm leading-6">
            A tesouraria ainda está concluindo a configuração do recebimento PIX.
          </p>
        </section>
      ) : (
        <section className="rounded-[32px] border border-emerald-950/10 bg-white p-5 shadow-sm sm:p-8">
          {pix.staticQrImage ? (
            <div className="mx-auto max-w-[310px] rounded-[32px] border border-slate-100 bg-white p-5 shadow-sm">
              <img
                alt="QR Code PIX da Igreja Elshaday"
                className="h-auto w-full"
                src={imageSource(pix.staticQrImage)}
              />
            </div>
          ) : null}

          <div className="mx-auto mt-6 max-w-2xl">
            <p className="text-center text-sm font-black text-slate-700">PIX Copia e Cola</p>
            <textarea
              className="mt-3 min-h-32 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-700"
              readOnly
              value={pix.staticQrPayload}
            />
            <div className="mt-4 flex justify-center">
              <PixCopyButton value={pix.staticQrPayload} />
            </div>
          </div>

          <div className="mx-auto mt-6 max-w-2xl rounded-2xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
            O valor é escolhido no aplicativo do banco. Assim que o Asaas confirmar o pagamento, a tesouraria recebe a entrada automaticamente no financeiro.
          </div>
        </section>
      )}

      <p className="text-center text-xs leading-5 text-slate-500">
        Os dados financeiros individuais permanecem restritos à Administração e Tesouraria.
      </p>
    </div>
  );
}

function imageSource(value: string) {
  if (value.startsWith("data:image/")) return value;
  return `data:image/png;base64,${value}`;
}
