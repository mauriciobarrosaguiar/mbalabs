"use client";

import { Label } from "@/modules/cotacoes/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/cotacoes/components/ui/select";
import { Switch } from "@/modules/cotacoes/components/ui/switch";
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
  return (
    <label className="flex min-h-10 items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-3 text-sm">
      <span>{label}</span>
      <Switch
        name={name}
        checked={checked}
        defaultChecked={checked === undefined ? defaultChecked : undefined}
        onCheckedChange={onCheckedChange}
      />
    </label>
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
