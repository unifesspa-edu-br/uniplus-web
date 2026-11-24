import {
  EtapaDaVersao,
  ResultadoDaDecisao,
  SituacaoDaVersao,
} from '@uniplus/shared-data/autorizacao';
import type { UiTagVariant } from '@uniplus/shared-ui/components';

const ETAPA: Readonly<Record<EtapaDaVersao, string>> = {
  [EtapaDaVersao.GESTAO_DE_ACESSOS]: 'Gestão de acessos',
  [EtapaDaVersao.PROTECAO_DE_DADOS]: 'Proteção de dados',
};

export interface RotuloDaDecisao {
  readonly texto: string;
  readonly variante: UiTagVariant;
}

const RESULTADO: Readonly<Record<ResultadoDaDecisao, RotuloDaDecisao>> = {
  [ResultadoDaDecisao.APROVADO]: { texto: 'Aprovado', variante: 'success' },
  [ResultadoDaDecisao.RECUSADO]: { texto: 'Recusado', variante: 'danger' },
  [ResultadoDaDecisao.PERFIL_ALTERADO]: {
    texto: 'Perfil alterado antes da decisão',
    variante: 'warning',
  },
  [ResultadoDaDecisao.PRAZO_VENCIDO]: { texto: 'Prazo vencido', variante: 'warning' },
  [ResultadoDaDecisao.TERMO_EXIGIDO]: { texto: 'Termo exigido', variante: 'warning' },
};

const SITUACAO_ENCERRADA: Readonly<Record<SituacaoDaVersao, string>> = {
  [SituacaoDaVersao.PENDENTE]: 'pendente',
  [SituacaoDaVersao.VIGENTE]: 'vigente',
  [SituacaoDaVersao.ENCERRADA]: 'encerrada',
  [SituacaoDaVersao.RECUSADA]: 'recusada',
  [SituacaoDaVersao.CANCELADA]: 'cancelada',
  [SituacaoDaVersao.EXPIRADA]: 'encerrada por expiração',
};

interface DecisorDaEtapa {
  readonly de: string;
  readonly por: string;
}

/** Quem decide cada etapa: os códigos nomeiam o que se confere, e o texto, o papel (ADR-0162). */
const DECISOR_DA_ETAPA: Readonly<Record<EtapaDaVersao, DecisorDaEtapa>> = {
  [EtapaDaVersao.GESTAO_DE_ACESSOS]: { de: 'da gestão de acessos', por: 'pela gestão de acessos' },
  [EtapaDaVersao.PROTECAO_DE_DADOS]: {
    de: 'do Representante do controlador',
    por: 'pelo Representante do controlador',
  },
};

function decisorDaEtapa(codigo: string): DecisorDaEtapa {
  return (
    DECISOR_DA_ETAPA[codigo as EtapaDaVersao] ?? {
      de: `da etapa ${codigo}`,
      por: `pela etapa ${codigo}`,
    }
  );
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
  return ETAPA[codigo as EtapaDaVersao] ?? codigo;
}

/** O texto e a cor da decisão; o resultado que a tela não conhece fica neutro, nunca como recusa. */
export function resultadoDaDecisao(codigo: string): RotuloDaDecisao {
  return RESULTADO[codigo as ResultadoDaDecisao] ?? { texto: codigo, variante: 'neutral' };
}

export function situacaoEncerrada(codigo: string): string {
  return SITUACAO_ENCERRADA[codigo as SituacaoDaVersao] ?? codigo;
}

/** As etapas que a versão ainda exige, na ordem em que acontecem. */
export function etapasExigidas(exigeProtecaoDeDados: boolean): string {
  return exigeProtecaoDeDados
    ? `${etapaDaVersao(EtapaDaVersao.GESTAO_DE_ACESSOS)} e ${etapaDaVersao(EtapaDaVersao.PROTECAO_DE_DADOS).toLowerCase()}`
    : etapaDaVersao(EtapaDaVersao.GESTAO_DE_ACESSOS);
}
