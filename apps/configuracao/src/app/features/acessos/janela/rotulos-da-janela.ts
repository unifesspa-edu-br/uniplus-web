import { FormaDoEncerramento, SituacaoDaMigracao } from '@uniplus/shared-data/autorizacao';
import type { UiTagVariant } from '@uniplus/shared-ui/components';

export interface RotuloDaJanela {
  readonly texto: string;
  readonly variante: UiTagVariant;
}

const SITUACAO_DO_ITEM: Readonly<Record<string, RotuloDaJanela>> = {
  aguardando_decisoes: { texto: 'Aguarda a decisão', variante: 'info' },
  [SituacaoDaMigracao.RETIDA]: { texto: 'Retida', variante: 'warning' },
  [SituacaoDaMigracao.AGUARDANDO_PROTECAO_DE_DADOS]: {
    texto: 'Aguarda o Representante do controlador',
    variante: 'info',
  },
  [SituacaoDaMigracao.MIGRADA]: { texto: 'Aprovada', variante: 'success' },
  [SituacaoDaMigracao.RECUSADA]: { texto: 'Recusada', variante: 'danger' },
  [SituacaoDaMigracao.NAO_MIGRADA]: { texto: 'Não aprovada no prazo', variante: 'danger' },
  [SituacaoDaMigracao.FORA_DA_LISTA]: { texto: 'Fora da lista', variante: 'neutral' },
};

const SITUACAO_DA_REVISAO: Readonly<Record<string, RotuloDaJanela>> = {
  aberta: { texto: 'Aberta', variante: 'warning' },
  encerrando: { texto: 'Em encerramento', variante: 'info' },
  encerrada: { texto: 'Encerrada', variante: 'neutral' },
};

const FORMA_DO_ENCERRAMENTO: Readonly<Record<FormaDoEncerramento, string>> = {
  [FormaDoEncerramento.CONCLUIDA]: 'Todas as concessões foram decididas.',
  [FormaDoEncerramento.PRAZO]: 'O prazo de 72 horas terminou.',
  [FormaDoEncerramento.MANUAL]:
    'A gestão de acessos encerrou a revisão das concessões antes do prazo.',
};

export function situacaoDoItem(codigo: string): RotuloDaJanela {
  return (
    SITUACAO_DO_ITEM[codigo] ?? {
      texto: codigo,
      variante: 'neutral',
    }
  );
}

export function situacaoDaJanela(codigo: string): RotuloDaJanela {
  return SITUACAO_DA_REVISAO[codigo] ?? { texto: codigo, variante: 'neutral' };
}

export function formaDoEncerramento(codigo: string | null): string | null {
  return codigo === null ? null : (FORMA_DO_ENCERRAMENTO[codigo as FormaDoEncerramento] ?? codigo);
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

export function orientacaoDaPropria(situacao: string): OrientacaoDaPropria {
  return situacao === SituacaoDaMigracao.AGUARDANDO_PROTECAO_DE_DADOS
    ? NA_PROTECAO_DE_DADOS
    : NA_GESTAO;
}
