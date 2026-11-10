import type { UiTagVariant } from '@uniplus/shared-ui/components';

export interface RotuloDaJanela {
  readonly texto: string;
  readonly variante: UiTagVariant;
}

const SITUACAO_DO_ITEM: Readonly<Record<string, RotuloDaJanela>> = {
  aguardando_lote: { texto: 'Aguarda o lote', variante: 'info' },
  retida: { texto: 'Retida', variante: 'warning' },
  aguardando_protecao_de_dados: { texto: 'Aguarda a proteção de dados', variante: 'info' },
  migrada: { texto: 'Migrada', variante: 'success' },
  recusada: { texto: 'Recusada', variante: 'danger' },
  nao_migrada: { texto: 'Não migrada no prazo', variante: 'danger' },
  fora_da_lista: { texto: 'Fora da lista', variante: 'neutral' },
};

const SITUACAO_DA_JANELA: Readonly<Record<string, RotuloDaJanela>> = {
  aberta: { texto: 'Aberta', variante: 'warning' },
  encerrando: { texto: 'Em encerramento', variante: 'info' },
  encerrada: { texto: 'Encerrada', variante: 'neutral' },
};

const FORMA_DO_ENCERRAMENTO: Readonly<Record<string, string>> = {
  concluida: 'Todas as concessões foram decididas.',
  prazo: 'O prazo de 72 horas terminou.',
  manual: 'A gestão de acessos encerrou a janela antes do prazo.',
};

const MOTIVO_DA_DISPENSA: Readonly<Record<string, string>> = {
  beneficiario_ja_tem_protecao_de_dados:
    'Dispensada: a pessoa beneficiada já exerce a proteção de dados.',
};

export function situacaoDoItem(codigo: string): RotuloDaJanela {
  return SITUACAO_DO_ITEM[codigo] ?? { texto: codigo, variante: 'neutral' };
}

export function situacaoDaJanela(codigo: string): RotuloDaJanela {
  return SITUACAO_DA_JANELA[codigo] ?? { texto: codigo, variante: 'neutral' };
}

export function formaDoEncerramento(codigo: string | null): string | null {
  return codigo === null ? null : (FORMA_DO_ENCERRAMENTO[codigo] ?? codigo);
}

export function dispensaDoItem(codigo: string | null): string | null {
  return codigo === null ? null : (MOTIVO_DA_DISPENSA[codigo] ?? codigo);
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
  titulo: 'Na proteção de dados: outra pessoa decide',
  dica: 'Concessões em que você é a pessoa beneficiada aguardam a decisão de outra pessoa da proteção de dados.',
  legenda: 'Concessões suas que aguardam a proteção de dados',
};

export function orientacaoDaPropria(situacao: string): OrientacaoDaPropria {
  return situacao === 'aguardando_protecao_de_dados' ? NA_PROTECAO_DE_DADOS : NA_GESTAO;
}
