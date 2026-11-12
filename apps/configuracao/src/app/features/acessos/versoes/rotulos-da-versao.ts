import type { UiTagVariant } from '@uniplus/shared-ui/components';

const ETAPA: Readonly<Record<string, string>> = {
  gestao_de_acessos: 'Gestão de acessos',
  protecao_de_dados: 'Proteção de dados',
};

export interface RotuloDaDecisao {
  readonly texto: string;
  readonly variante: UiTagVariant;
}

const RESULTADO: Readonly<Record<string, RotuloDaDecisao>> = {
  aprovado: { texto: 'Aprovado', variante: 'success' },
  recusado: { texto: 'Recusado', variante: 'danger' },
  perfil_alterado: { texto: 'Perfil alterado antes da decisão', variante: 'warning' },
  prazo_vencido: { texto: 'Prazo vencido', variante: 'warning' },
};

const SITUACAO_ENCERRADA: Readonly<Record<string, string>> = {
  recusada: 'recusada',
  cancelada: 'cancelada',
  expirada: 'encerrada por expiração',
};

interface DecisorDaEtapa {
  readonly de: string;
  readonly por: string;
}

/** Quem decide cada etapa: os códigos nomeiam o que se confere, e o texto, o papel (ADR-0162). */
const DECISOR_DA_ETAPA: Readonly<Record<string, DecisorDaEtapa>> = {
  gestao_de_acessos: { de: 'da gestão de acessos', por: 'pela gestão de acessos' },
  protecao_de_dados: {
    de: 'do Representante do controlador',
    por: 'pelo Representante do controlador',
  },
};

function decisorDaEtapa(codigo: string): DecisorDaEtapa {
  return DECISOR_DA_ETAPA[codigo] ?? { de: `da etapa ${codigo}`, por: `pela etapa ${codigo}` };
}

/** A decisão que a etapa pede, nomeada por quem a toma: "decisão do Representante do controlador". */
export function decisaoDaEtapa(codigo: string): string {
  return `decisão ${decisorDaEtapa(codigo).de}`;
}

/** Quem age na etapa, para o ato: "pelo Representante do controlador". */
export function porQuemDecide(codigo: string): string {
  return decisorDaEtapa(codigo).por;
}

export function etapaDaVersao(codigo: string): string {
  return ETAPA[codigo] ?? codigo;
}

/** O texto e a cor da decisão; o resultado que a tela não conhece fica neutro, nunca como recusa. */
export function resultadoDaDecisao(codigo: string): RotuloDaDecisao {
  return RESULTADO[codigo] ?? { texto: codigo, variante: 'neutral' };
}

export function situacaoEncerrada(codigo: string): string {
  return SITUACAO_ENCERRADA[codigo] ?? codigo;
}

/** As etapas que a versão ainda exige, na ordem em que acontecem. */
export function etapasExigidas(exigeProtecaoDeDados: boolean): string {
  return exigeProtecaoDeDados
    ? `${etapaDaVersao('gestao_de_acessos')} e ${etapaDaVersao('protecao_de_dados').toLowerCase()}`
    : etapaDaVersao('gestao_de_acessos');
}
