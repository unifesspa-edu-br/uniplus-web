/** Um tipo de decisão do cadastro de motivos, com o nome que a tela mostra. */
export interface TipoDeMotivo {
  readonly codigo: string;
  readonly rotulo: string;
}

/**
 * O vocabulário de tipos de decisão que o cadastro de motivos admite. A API não o publica por
 * uma rota: o código de cada tipo é o do contrato, e a tela só lhe dá o nome em português.
 */
export const TIPOS_DE_MOTIVO: readonly TipoDeMotivo[] = [
  { codigo: 'ISENCAO_DA_TAXA', rotulo: 'Isenção da taxa' },
  { codigo: 'HOMOLOGACAO_DAS_INSCRICOES', rotulo: 'Homologação das inscrições' },
  { codigo: 'ANALISE_DOCUMENTAL', rotulo: 'Análise documental' },
  { codigo: 'HETEROIDENTIFICACAO', rotulo: 'Heteroidentificação' },
  { codigo: 'AVALIACAO_BIOPSICOSSOCIAL', rotulo: 'Avaliação biopsicossocial' },
  { codigo: 'CLASSIFICACAO', rotulo: 'Classificação' },
];

export const TIPO_INICIAL = TIPOS_DE_MOTIVO[0].codigo;

/** O sentido do motivo em relação ao candidato: o contrato admite exatamente estes dois. */
export const SENTIDOS_DE_MOTIVO: readonly TipoDeMotivo[] = [
  { codigo: 'FAVORAVEL', rotulo: 'Favorável ao candidato' },
  { codigo: 'DESFAVORAVEL', rotulo: 'Desfavorável ao candidato' },
];

const TIPO_COM_SUBCLASSIFICACAO = 'ISENCAO_DA_TAXA';

/** A subclassificação existe só onde o tipo a pede: na isenção, o fundamento de isenção. */
export function tipoPedeSubclassificacao(tipo: string): boolean {
  return tipo === TIPO_COM_SUBCLASSIFICACAO;
}

/** O nome do código, ou o próprio código quando o vocabulário da tela não o conhece. */
export function rotuloDe(vocabulario: readonly TipoDeMotivo[], codigo: string): string {
  return vocabulario.find((item) => item.codigo === codigo)?.rotulo ?? codigo;
}
