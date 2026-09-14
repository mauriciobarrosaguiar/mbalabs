"use client";

import { useEffect, useState, type ComponentType, type InputHTMLAttributes } from "react";
import {
  BadgeCheck,
  CalendarDays,
  Eye,
  EyeOff,
  Info,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  UserRound
} from "lucide-react";
import { createSupabaseClient } from "@mba-labs/shared/supabase/client";
import { ElshadaySubmitButton } from "../elshaday/ElshadaySubmitButton";
import { registerPublicElshadayMember } from "./actions";

type Icon = ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;

export function MemberRegistrationForm({
  churchId,
  convite,
  ministryOptions,
  roleOptions
}: {
  churchId: string;
  convite: string;
  ministryOptions: Array<{ id: string; nome: string }>;
  roleOptions: Array<{ id: string; nome: string }>;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [inviteIdentity, setInviteIdentity] = useState<{ email: string; nome: string } | null>(null);

  useEffect(() => {
    let active = true;
    const supabase = createSupabaseClient();

    void supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      const metadata = user?.user_metadata ?? {};
      if (
        active &&
        user?.email &&
        metadata.origem === "elshaday-convite-cadastro" &&
        String(metadata.igreja_id ?? "") === churchId
      ) {
        setInviteIdentity({
          email: String(user.email),
          nome: String(metadata.nome ?? "")
        });
      }
    });

    return () => {
      active = false;
    };
  }, [churchId]);

  return (
    <section className="overflow-hidden rounded-[28px] border border-[#123d2d]/10 bg-white shadow-[0_18px_55px_rgba(18,61,45,.10)]">
      <div className="border-b border-slate-100 px-4 py-5 sm:px-7">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-[#f7edd6] text-[#123d2d]">
            <UserRound aria-hidden size={21} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-black leading-tight text-slate-950 sm:text-2xl">Seus dados e acesso</h1>
            <p className="mt-1 text-sm font-semibold leading-5 text-slate-600">
              Preencha seus dados, crie sua senha e envie para aprovação da igreja.
            </p>
          </div>
        </div>

        {inviteIdentity ? (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
            <BadgeCheck aria-hidden className="mt-0.5 shrink-0 text-[#176445]" size={20} />
            <p className="text-sm font-bold leading-6">
              Convite Elshaday confirmado. Complete seus dados e crie sua senha para enviar o cadastro à igreja.
            </p>
          </div>
        ) : null}

        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-[#d4aa54]/60 bg-[#fbf4e5] p-4 text-[#5b431f]">
          <Info aria-hidden className="mt-0.5 shrink-0" size={20} />
          <p className="text-sm font-bold leading-6">
            Após concluir, sua conta e qualquer cargo informado ficarão aguardando aprovação. Seu cargo não concede permissões no aplicativo.
          </p>
        </div>
      </div>

      <form action={registerPublicElshadayMember} className="grid min-w-0 gap-3.5 px-4 py-5 sm:grid-cols-2 sm:px-7 sm:py-6">
        <input name="convite" type="hidden" value={convite} />
        <div className="sr-only" aria-hidden="true">
          <label>Website<input autoComplete="off" name="website" tabIndex={-1} /></label>
        </div>

        <Field
          key={"nome-" + (inviteIdentity?.email ?? "publico")}
          icon={UserRound}
          label="Nome completo *"
          name="nome"
          autoComplete="name"
          defaultValue={inviteIdentity?.nome}
          required
          wide
        />
        <Field icon={CalendarDays} label="Data de nascimento" name="data_nascimento" type="date" />
        <Field label="CPF" name="cpf" inputMode="numeric" maxLength={14} placeholder="000.000.000-00" mask="cpf" />
        <Field icon={Phone} label="WhatsApp *" name="whatsapp" inputMode="tel" autoComplete="tel" maxLength={15} placeholder="(63) 99999-9999" mask="phone" required />
        <Field icon={Phone} label="Telefone" name="telefone" inputMode="tel" autoComplete="tel" maxLength={15} placeholder="(63) 3333-3333" mask="phone" />
        <Field
          key={"email-" + (inviteIdentity?.email ?? "publico")}
          icon={Mail}
          label="E-mail para entrar *"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={inviteIdentity?.email}
          placeholder="seuemail@exemplo.com"
          readOnly={Boolean(inviteIdentity)}
          required
          wide
        />

        <PasswordField
          label="Crie uma senha *"
          name="senha"
          placeholder="Mínimo de 8 caracteres"
          visible={showPassword}
          onToggle={() => setShowPassword((value) => !value)}
        />
        <PasswordField
          label="Confirme a senha *"
          name="confirmar_senha"
          placeholder="Digite novamente"
          visible={showConfirmation}
          onToggle={() => setShowConfirmation((value) => !value)}
        />

        <Field icon={CalendarDays} label="Data de entrada na igreja" name="data_entrada" type="date" />
        <Field icon={CalendarDays} label="Data de conversão" name="data_conversao" type="date" />
        <Field icon={CalendarDays} label="Data de batismo" name="data_batismo" type="date" />

        <label className="grid min-w-0 gap-1.5 text-sm font-black text-[#294238]">
          Cargo que exerce na igreja
          <select className={inputClass()} defaultValue="" name="cargo_solicitado_id">
            <option value="">Membro / não tenho cargo</option>
            {roleOptions
              .filter((role) => role.nome.toLocaleLowerCase("pt-BR") !== "membro")
              .map((role) => (
                <option key={role.id} value={role.id}>{role.nome}</option>
              ))}
          </select>
          <span className="text-xs font-semibold leading-5 text-slate-500">
            O cargo será confirmado pela liderança antes de aparecer na sua ficha.
          </span>
        </label>

        <label className="grid min-w-0 gap-1.5 text-sm font-black text-[#294238]">
          Ministério
          <select className={inputClass()} defaultValue="" name="ministerio">
            <option value="">A definir pela igreja</option>
            {ministryOptions.map((ministry) => (
              <option key={ministry.id} value={ministry.nome}>{ministry.nome}</option>
            ))}
          </select>
        </label>

        <Field icon={MapPin} label="Endereço" name="endereco" autoComplete="street-address" placeholder="Rua, avenida, quadra e número" wide />
        <Field label="Bairro" name="bairro" />
        <Field label="Cidade" name="cidade" defaultValue="Palmas" />
        <Field label="UF" name="estado" defaultValue="TO" maxLength={2} />

        <label className="grid min-w-0 gap-1.5 text-sm font-black text-[#294238] sm:col-span-2">
          Observação
          <textarea
            className="min-h-20 w-full min-w-0 max-w-full resize-y rounded-2xl border border-[#123d2d]/20 bg-[#f7f8f4] px-4 py-3 text-base text-slate-950 outline-none placeholder:text-slate-500 focus:border-[#d4aa54] focus:ring-4 focus:ring-[#123d2d]/10"
            name="observacoes"
            placeholder="Digite alguma observação (opcional)"
          />
        </label>

        <label className="flex min-w-0 items-start gap-3 rounded-2xl border border-[#d4aa54]/35 bg-[#123d2d] p-4 text-sm font-semibold leading-6 text-white sm:col-span-2">
          <input className="mt-0.5 size-6 shrink-0 accent-[#d6af58]" name="consentimento" type="checkbox" required />
          <span>Autorizo o uso destes dados pela igreja para meu cadastro, acesso ao aplicativo e comunicação.</span>
        </label>

        <div className="pt-1 sm:col-span-2">
          <ElshadaySubmitButton
            className="inline-flex min-h-13 w-full touch-manipulation items-center justify-center rounded-2xl bg-[#123d2d] px-6 text-base font-black text-white shadow-[0_10px_24px_rgba(18,61,45,.24)] transition active:scale-[.99]"
            pendingLabel="Criando sua conta..."
          >
            Criar minha conta
          </ElshadaySubmitButton>
        </div>
      </form>
    </section>
  );
}

function inputClass(withIcon = false) {
  return "h-[50px] w-full min-w-0 max-w-full rounded-2xl border border-[#123d2d]/20 bg-[#f7f8f4] " +
    (withIcon ? "pl-11 pr-4 " : "px-4 ") +
    "text-base text-slate-950 outline-none placeholder:text-slate-500 focus:border-[#d4aa54] focus:ring-4 focus:ring-[#123d2d]/10";
}

function Field({
  icon: Icon,
  label,
  wide = false,
  mask,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  icon?: Icon;
  label: string;
  wide?: boolean;
  mask?: "cpf" | "phone";
}) {
  return (
    <label className={"grid min-w-0 gap-1.5 text-sm font-black text-[#294238]" + (wide ? " sm:col-span-2" : "")}>
      {label}
      <span className="relative block min-w-0">
        {Icon ? <Icon aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#123d2d]" size={18} /> : null}
        <input
          {...props}
          className={inputClass(Boolean(Icon))}
          onInput={mask ? (event) => {
            const input = event.currentTarget;
            input.value = mask === "cpf" ? formatCpf(input.value) : formatPhone(input.value);
          } : undefined}
        />
      </span>
    </label>
  );
}

function PasswordField({
  label,
  name,
  placeholder,
  visible,
  onToggle
}: {
  label: string;
  name: string;
  placeholder: string;
  visible: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="grid min-w-0 gap-1.5 text-sm font-black text-[#294238]">
      {label}
      <span className="relative block min-w-0">
        <LockKeyhole aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#123d2d]" size={18} />
        <input
          className={inputClass(true) + " !pr-12"}
          minLength={8}
          name={name}
          placeholder={placeholder}
          required
          type={visible ? "text" : "password"}
          autoComplete="new-password"
        />
        <button
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          className="absolute right-1 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-xl text-slate-600"
          onClick={onToggle}
          type="button"
        >
          {visible ? <EyeOff aria-hidden size={19} /> : <Eye aria-hidden size={19} />}
        </button>
      </span>
    </label>
  );
}

function formatCpf(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return digits
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
}
