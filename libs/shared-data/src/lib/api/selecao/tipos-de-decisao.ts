/** Um tipo de decisão do vocabulário da Seleção, com o nome que a tela mostra. */
export interface TipoDeDecisao {
  readonly codigo: string;
  readonly rotulo: string;
}

/**
 * O vocabulário de tipos de decisão da Seleção. A API não o publica por uma rota nem por enum: o
 * código de cada tipo é o do contrato, e o cliente só lhe dá o nome em português. Cadastro de
 * motivos, declaração por fase ou etapa e escolha de motivos leem este mesmo vocabulário.
 */
export const TIPOS_DE_DECISAO: readonly TipoDeDecisao[] = [
  { codigo: 'ISENCAO_DA_TAXA', rotulo: 'Isenção da taxa' },
  { codigo: 'HOMOLOGACAO_DAS_INSCRICOES', rotulo: 'Homologação das inscrições' },
  { codigo: 'ANALISE_DOCUMENTAL', rotulo: 'Análise documental' },
  { codigo: 'HETEROIDENTIFICACAO', rotulo: 'Heteroidentificação' },
  { codigo: 'AVALIACAO_BIOPSICOSSOCIAL', rotulo: 'Avaliação biopsicossocial' },
  { codigo: 'CLASSIFICACAO', rotulo: 'Classificação' },
  { codigo: 'GABARITO_DA_PROVA', rotulo: 'Gabarito da prova' },
  { codigo: 'NOTA_DA_ETAPA', rotulo: 'Nota da etapa' },
];

/** O nome do código, ou o próprio código quando o vocabulário não o conhece. */
export function rotuloDoTipoDeDecisao(codigo: string): string {
  return TIPOS_DE_DECISAO.find((tipo) => tipo.codigo === codigo)?.rotulo ?? codigo;
}
