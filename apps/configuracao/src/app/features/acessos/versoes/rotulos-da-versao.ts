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
