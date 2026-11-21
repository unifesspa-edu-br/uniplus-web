import type { CatalogoMockado } from './responder';

/** O que a API devolve em `/vocabularios/tipos-de-decisao`: o código e o rótulo de cada tipo. */
export const VOCABULARIO_DE_TIPOS_DE_DECISAO: readonly { codigo: string; rotulo: string }[] = [
  { codigo: 'ISENCAO_DA_TAXA', rotulo: 'Isenção da taxa' },
  { codigo: 'HOMOLOGACAO_DAS_INSCRICOES', rotulo: 'Homologação das inscrições' },
  { codigo: 'ANALISE_DOCUMENTAL', rotulo: 'Análise documental' },
  { codigo: 'HETEROIDENTIFICACAO', rotulo: 'Heteroidentificação' },
  { codigo: 'AVALIACAO_BIOPSICOSSOCIAL', rotulo: 'Avaliação biopsicossocial' },
  { codigo: 'CLASSIFICACAO', rotulo: 'Classificação' },
  { codigo: 'GABARITO_DA_PROVA', rotulo: 'Gabarito da prova' },
  { codigo: 'NOTA_DA_ETAPA', rotulo: 'Nota da etapa' },
];

/** A rota que o cenário intercepta para servir o vocabulário. */
export const ROTA_DO_VOCABULARIO_DE_TIPOS_DE_DECISAO =
  /\/api\/configuracao\/vocabularios\/tipos-de-decisao(\?.*)?$/;

/** O recurso da API, para a tabela de catálogos que o cenário responde. */
export const TIPOS_DE_DECISAO_DA_API: CatalogoMockado = [
  'configuracao/vocabularios/tipos-de-decisao',
  VOCABULARIO_DE_TIPOS_DE_DECISAO,
];
