"use client";

import { useState } from "react";

import { Label } from "@/modules/cotacoes/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/cotacoes/components/ui/select";
import { packageQuantityOptions } from "@/modules/cotacoes/lib/constants";
import {
  customerTypeLabels,
  judgmentTypeLabels,
  productTypeLabels,
  statusLabels,
  unitLabels,
} from "@/modules/cotacoes/lib/labels";

export interface SelectFieldProps {
  name?: string;
  label?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
}

function SelectField({
  name,
  label,
  value,
  defaultValue,
  onValueChange,
  placeholder = "Selecione",
  options,
}: SelectFieldProps & { options: Record<string, string> }) {
  return (
    <div className="space-y-2">
      {label ? <Label>{label}</Label> : null}
      <Select
        name={name}
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
      >
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(options).map(([optionValue, optionLabel]) => (
            <SelectItem key={optionValue} value={optionValue}>
              {optionLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function CustomerTypeSelect(props: SelectFieldProps) {
  return <SelectField {...props} options={customerTypeLabels} />;
}

export function StatusSelect(props: SelectFieldProps) {
  const options = {
    teste: statusLabels.teste,
    ativo: statusLabels.ativo,
    suspenso: statusLabels.suspenso,
    cancelado: statusLabels.cancelado,
    inativo: statusLabels.inativo,
  };
  return <SelectField {...props} options={options} />;
}

export function ProductTypeSelect(props: SelectFieldProps) {
  return <SelectField {...props} options={productTypeLabels} />;
}

export function UnitSelect(props: SelectFieldProps) {
  const sellerUnits = Object.fromEntries(
    Object.entries(unitLabels).filter(([key]) => key !== "CX"),
  );
  return <SelectField {...props} options={sellerUnits} />;
}

export function JudgmentTypeSelect(props: SelectFieldProps) {
  return <SelectField {...props} options={judgmentTypeLabels} />;
}

export function YesNoSwitch({
  label,
  name,
  checked,
  defaultChecked = true,
  onCheckedChange,
}: {
  label: string;
  name?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  const [internal, setInternal] = useState(defaultChecked);
  const active = checked === undefined ? internal : checked;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={label}
      onClick={() => {
        if (checked === undefined) setInternal(!active);
        onCheckedChange?.(!active);
      }}
      className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm
        transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500
        active:scale-[0.99] ${active
        ? "border-teal-500 bg-teal-50 text-teal-950 hover:bg-teal-100"
        : "border-slate-300 bg-white text-slate-900 hover:bg-slate-50"}`}
    >
      <span className="font-medium">{label}</span>
      <span className="flex shrink-0 items-center gap-2">
        <span className={`text-xs font-semibold ${active ? "text-teal-800" : "text-slate-600"}`}>
          {active ? "Sim" : "Não"}
        </span>
        <span aria-hidden="true" className={`flex h-6 w-11 items-center rounded-full p-1 transition-colors
          ${active ? "bg-teal-700" : "bg-slate-400"}`}>
          <span className={`h-4 w-4 rounded-full bg-white shadow transition-transform
            ${active ? "translate-x-5" : "translate-x-0"}`} />
        </span>
      </span>
      {name ? <input name={name} type="hidden" value={active ? "true" : "false"} /> : null}
    </button>
  );
}

export function PackageQuantitySelect({
  name,
  label = "Quantidade por embalagem",
  value,
  defaultValue,
  onValueChange,
}: SelectFieldProps) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select
        name={name}
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
      >
        <SelectTrigger>
          <SelectValue placeholder="Selecione" />
        </SelectTrigger>
        <SelectContent>
          {packageQuantityOptions.map((quantity) => (
            <SelectItem key={quantity} value={String(quantity)}>
              {quantity}
            </SelectItem>
          ))}
          <SelectItem value="outro">Outro valor</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
