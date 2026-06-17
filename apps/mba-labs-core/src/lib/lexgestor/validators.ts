export function validarCampoObrigatorio(valor: string) {
  return valor.trim().length > 0;
}

export function validarEmail(email: string) {
  if (!email) {
    return true;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validarCpfCnpj(valor: string) {
  const digits = valor.replace(/\D/g, "");
  return digits.length === 11 || digits.length === 14;
}

export function validarTamanhoArquivo(bytes: number, limiteMb = 25) {
  return bytes <= limiteMb * 1024 * 1024;
}
