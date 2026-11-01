import type { FormControl } from '@angular/forms';

/**
 * O vocabulário da proteção de dados que o tipo de documento e o fato do catálogo declaram
 * (ADR-0081, ADR-0136): a escala única de classificação e as hipóteses legais da LGPD. A API
 * continua a autoridade; espelhar aqui evita oferecer uma combinação que só seria recusada.
 */

/** Uma opção de vocabulário fechado: o token do contrato e o rótulo em pt-BR. */
export interface OpcaoDeVocabulario {
  readonly valor: string;
  readonly rotulo: string;
}

export const CLASSIFICACOES_DE_PROTECAO: readonly OpcaoDeVocabulario[] = [
  { valor: 'PUBLICO', rotulo: 'Público' },
  { valor: 'INTERNO', rotulo: 'Interno' },
  { valor: 'PESSOAL', rotulo: 'Pessoal' },
  { valor: 'IDENTIFICADOR', rotulo: 'Identificador' },
  { valor: 'SENSIVEL', rotulo: 'Pessoal sensível' },
];

export const HIPOTESES_LEGAIS: readonly OpcaoDeVocabulario[] = [
  { valor: 'CONSENTIMENTO', rotulo: 'Consentimento do titular' },
  { valor: 'CUMPRIMENTO_OBRIGACAO_LEGAL', rotulo: 'Cumprimento de obrigação legal ou regulatória' },
  { valor: 'EXECUCAO_POLITICAS_PUBLICAS', rotulo: 'Execução de políticas públicas' },
  { valor: 'ESTUDOS_POR_ORGAO_DE_PESQUISA', rotulo: 'Estudos por órgão de pesquisa' },
  { valor: 'EXECUCAO_CONTRATO', rotulo: 'Execução de contrato' },
  { valor: 'EXERCICIO_REGULAR_DE_DIREITOS', rotulo: 'Exercício regular de direitos' },
  { valor: 'PROTECAO_DA_VIDA', rotulo: 'Proteção da vida' },
  { valor: 'TUTELA_DA_SAUDE', rotulo: 'Tutela da saúde' },
  { valor: 'INTERESSE_LEGITIMO', rotulo: 'Interesse legítimo' },
  { valor: 'PROTECAO_DO_CREDITO', rotulo: 'Proteção do crédito' },
  { valor: 'PREVENCAO_A_FRAUDE', rotulo: 'Prevenção à fraude' },
];

/** O rótulo de um token, ou o próprio token quando o vocabulário não o conhece. */
export function rotuloDe(vocabulario: readonly OpcaoDeVocabulario[], valor: string | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  return vocabulario.find((opcao) => opcao.valor === valor)?.rotulo ?? valor;
}

// Só o art. 7º da LGPD prevê execução de contrato, interesse legítimo e proteção do crédito; só o
// art. 11 prevê a prevenção à fraude. As demais hipóteses existem nos dois artigos.
const SO_DO_DADO_COMUM = new Set(['EXECUCAO_CONTRATO', 'INTERESSE_LEGITIMO', 'PROTECAO_DO_CREDITO']);
const SO_DO_DADO_SENSIVEL = new Set(['PREVENCAO_A_FRAUDE']);

/** As hipóteses legais que cabem na classificação: as do art. 11 no dado sensível, as do art. 7º nos demais. */
export function hipotesesDaClassificacao(classificacao: string): readonly OpcaoDeVocabulario[] {
  const excluidas = classificacao === 'SENSIVEL' ? SO_DO_DADO_COMUM : SO_DO_DADO_SENSIVEL;
  return HIPOTESES_LEGAIS.filter((hipotese) => !excluidas.has(hipotese.valor));
}

/** Os três eixos da proteção que a aprovação da proteção de dados confere. */
export interface ProtecaoDoItem {
  readonly classificacaoProtecao: string;
  readonly hipoteseLegal: string;
  readonly finalidadeTratamento: string;
}

/**
 * Se a edição muda a proteção do item. Só a classificação, a hipótese legal e a finalidade a
 * mudam; nome, descrição e os demais campos não pedem nova aprovação (UNI-REQ-0205).
 */
export function protecaoMudou(atual: ProtecaoDoItem, nova: ProtecaoDoItem): boolean {
  return (
    atual.classificacaoProtecao !== nova.classificacaoProtecao ||
    atual.hipoteseLegal !== nova.hipoteseLegal ||
    atual.finalidadeTratamento.trim() !== nova.finalidadeTratamento.trim()
  );
}

/** Esvazia a escolha que deixou de estar entre as opções: ficaria no controle, invisível, e só a API a recusaria. */
export function esvaziarSeForaDas(controle: FormControl<string>, opcoes: readonly OpcaoDeVocabulario[]): void {
  if (controle.value !== '' && !opcoes.some((opcao) => opcao.valor === controle.value)) {
    controle.setValue('');
  }
}

const NOME_DO_CADASTRO: Readonly<Record<string, string>> = {
  TIPO_DOCUMENTO: 'Tipo de documento',
  FATO: 'Fato do candidato',
};

/** O nome que a tela dá ao cadastro de um item do catálogo. */
export function nomeDoCadastro(cadastro: string): string {
  return NOME_DO_CADASTRO[cadastro] ?? cadastro;
}
