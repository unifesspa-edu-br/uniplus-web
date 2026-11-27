import { EtapaDaVersao, ResultadoDaDecisao } from '@uniplus/shared-data/autorizacao';
import type { CodigoComRotulo, VariantesDosCodigos } from '@uniplus/shared-ui/components';

/** A cor de cada resultado de decisão; o rótulo da etiqueta é o que a API devolve. */
export const VARIANTES_DO_RESULTADO: VariantesDosCodigos<ResultadoDaDecisao> = {
  [ResultadoDaDecisao.APROVADO]: 'success',
  [ResultadoDaDecisao.RECUSADO]: 'danger',
  [ResultadoDaDecisao.PERFIL_ALTERADO]: 'warning',
  [ResultadoDaDecisao.PRAZO_VENCIDO]: 'warning',
  [ResultadoDaDecisao.TERMO_EXIGIDO]: 'warning',
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

function decisorDaEtapa({ codigo, rotulo }: CodigoComRotulo<string>): DecisorDaEtapa {
  return (
    DECISOR_DA_ETAPA[codigo as EtapaDaVersao] ?? {
      de: `da etapa ${rotulo}`,
      por: `pela etapa ${rotulo}`,
    }
  );
}

/** A decisão que a etapa pede, nomeada por quem a toma: "decisão do Representante do controlador". */
export function decisaoDaEtapa(etapa: CodigoComRotulo<string>): string {
  return `decisão ${decisorDaEtapa(etapa).de}`;
}

/** Quem age na etapa, para o ato: "pelo Representante do controlador". */
export function porQuemDecide(etapa: CodigoComRotulo<string>): string {
  return decisorDaEtapa(etapa).por;
}
