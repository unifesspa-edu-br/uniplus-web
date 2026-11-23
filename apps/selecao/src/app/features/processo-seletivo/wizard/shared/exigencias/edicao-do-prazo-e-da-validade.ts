import type {
  PrazoDeEmissao,
  ReferenciaDoDocumento,
  ValidadeDoDocumento,
} from '../../processo-seletivo.models';

export function escolherPrazo(escolha: string): PrazoDeEmissao {
  return { escolha, valor: null, unidade: null, referencia: null, efeitoForaDoPrazo: null };
}

export function escolherValidade(escolha: string): ValidadeDoDocumento {
  return { escolha, referencia: null, efeitoDoVencimento: null };
}

export function escolherTipoDeReferencia(tipo: string): ReferenciaDoDocumento {
  return { tipo: tipo || null, data: null, faseCodigo: null, faseIdLido: null };
}

export function definirValorDoPrazo(prazo: PrazoDeEmissao, valor: number | null): PrazoDeEmissao {
  return { ...prazo, valor };
}

export function definirUnidadeDoPrazo(
  prazo: PrazoDeEmissao,
  unidade: string | null,
): PrazoDeEmissao {
  return { ...prazo, unidade };
}

export function definirDataDaReferencia(
  referencia: ReferenciaDoDocumento,
  data: string | null,
): ReferenciaDoDocumento {
  return { ...referencia, data };
}

export function definirFaseDaReferencia(
  referencia: ReferenciaDoDocumento,
  faseCodigo: string | null,
): ReferenciaDoDocumento {
  return { ...referencia, faseCodigo, faseIdLido: null };
}

export function definirReferenciaDoPrazo(
  prazo: PrazoDeEmissao,
  referencia: ReferenciaDoDocumento,
): PrazoDeEmissao {
  return { ...prazo, referencia };
}

export function definirEfeitoDoPrazo(
  prazo: PrazoDeEmissao,
  efeitoForaDoPrazo: string | null,
): PrazoDeEmissao {
  return { ...prazo, efeitoForaDoPrazo };
}

export function definirReferenciaDaValidade(
  validade: ValidadeDoDocumento,
  referencia: ReferenciaDoDocumento,
): ValidadeDoDocumento {
  return { ...validade, referencia };
}

export function definirEfeitoDaValidade(
  validade: ValidadeDoDocumento,
  efeitoDoVencimento: string | null,
): ValidadeDoDocumento {
  return { ...validade, efeitoDoVencimento };
}
