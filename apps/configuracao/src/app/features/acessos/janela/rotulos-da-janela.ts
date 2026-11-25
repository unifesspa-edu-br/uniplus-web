import {
  SituacaoDaConcessaoNaRevisaoCodigo,
  SituacaoDaRevisaoDasConcessoesCodigo,
  type ItemDaJanelaDto,
  type JanelaDeMigracaoDto,
} from '@uniplus/shared-data/autorizacao';
import type { UiTagVariant } from '@uniplus/shared-ui/components';

const CORES_DO_ITEM: Readonly<Record<SituacaoDaConcessaoNaRevisaoCodigo, UiTagVariant>> = {
  [SituacaoDaConcessaoNaRevisaoCodigo.AGUARDANDO_DECISOES]: 'info',
  [SituacaoDaConcessaoNaRevisaoCodigo.RETIDA]: 'warning',
  [SituacaoDaConcessaoNaRevisaoCodigo.AGUARDANDO_PROTECAO_DE_DADOS]: 'info',
  [SituacaoDaConcessaoNaRevisaoCodigo.MIGRADA]: 'success',
  [SituacaoDaConcessaoNaRevisaoCodigo.RECUSADA]: 'danger',
  [SituacaoDaConcessaoNaRevisaoCodigo.NAO_MIGRADA]: 'danger',
  [SituacaoDaConcessaoNaRevisaoCodigo.FORA_DA_LISTA]: 'neutral',
};
const CORES_DA_REVISAO: Readonly<Record<SituacaoDaRevisaoDasConcessoesCodigo, UiTagVariant>> = {
  [SituacaoDaRevisaoDasConcessoesCodigo.ABERTA]: 'warning',
  [SituacaoDaRevisaoDasConcessoesCodigo.ENCERRANDO]: 'info',
  [SituacaoDaRevisaoDasConcessoesCodigo.ENCERRADA]: 'neutral',
};
export function situacaoDoItem(situacao: ItemDaJanelaDto['situacao']) {
  return { texto: situacao.rotulo, variante: CORES_DO_ITEM[situacao.codigo] ?? 'neutral' };
}
export function situacaoDaJanela(situacao: JanelaDeMigracaoDto['situacao']) {
  return { texto: situacao.rotulo, variante: CORES_DA_REVISAO[situacao.codigo] ?? 'neutral' };
}

/** O que diz a quem lê sobre as concessões que são dele: quem as decide depende da situação. */
export interface OrientacaoDaPropria {
  readonly titulo: string;
  readonly dica: string;
  readonly legenda: string;
}

const NA_GESTAO: OrientacaoDaPropria = {
  titulo: 'Retidas: outra pessoa decide',
  dica: 'Concessões em que você é a pessoa beneficiada ficam retidas e são decididas por outra pessoa da gestão de acessos.',
  legenda: 'Concessões suas retidas para outra pessoa decidir',
};

const NA_PROTECAO_DE_DADOS: OrientacaoDaPropria = {
  titulo: 'Na etapa de proteção de dados: outro Representante do controlador decide',
  dica: 'Concessões em que você é a pessoa beneficiada aguardam a decisão de outro Representante do controlador.',
  legenda: 'Concessões suas que aguardam outro Representante do controlador',
};

export function orientacaoDaPropria(
  situacao: SituacaoDaConcessaoNaRevisaoCodigo,
): OrientacaoDaPropria {
  return situacao === SituacaoDaConcessaoNaRevisaoCodigo.AGUARDANDO_PROTECAO_DE_DADOS
    ? NA_PROTECAO_DE_DADOS
    : NA_GESTAO;
}
