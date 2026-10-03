import type { FatoCandidatoDto } from '@uniplus/shared-data/configuracao';

/**
 * As regras do catálogo de fatos que a tela espelha da API (ADR-0136). A API continua a autoridade
 * — recusa o que não cabe e a tela mostra a recusa no campo —; espelhar aqui é o que evita oferecer
 * um campo que só serviria para ser recusado.
 */

/** Uma opção de vocabulário fechado: o token do contrato e o rótulo em pt-BR. */
export interface OpcaoDeVocabulario {
  readonly valor: string;
  readonly rotulo: string;
}

export const ORIGENS: readonly OpcaoDeVocabulario[] = [
  { valor: 'DECLARADO', rotulo: 'Declarado pelo candidato' },
  { valor: 'DERIVADO', rotulo: 'Derivado' },
  { valor: 'INTEGRACAO', rotulo: 'Integração' },
];

export const DOMINIOS: readonly OpcaoDeVocabulario[] = [
  { valor: 'BOOLEANO', rotulo: 'Sim ou não' },
  { valor: 'NUMERICO', rotulo: 'Número' },
  { valor: 'CATEGORICO', rotulo: 'Lista de valores' },
  { valor: 'TEXTO', rotulo: 'Texto' },
  { valor: 'DATA', rotulo: 'Data' },
  { valor: 'ENDERECO', rotulo: 'Endereço' },
];

/** O derivado por regra é booleano ou categórico: são os domínios que uma regra contribui. */
export const DOMINIOS_DO_DERIVADO: readonly OpcaoDeVocabulario[] = DOMINIOS.filter((d) =>
  ['BOOLEANO', 'CATEGORICO'].includes(d.valor),
);

export const CARDINALIDADES: readonly OpcaoDeVocabulario[] = [
  { valor: 'ESCALAR', rotulo: 'Um valor' },
  { valor: 'MULTIVALORADO', rotulo: 'Vários valores' },
];

export const FONTES_DE_VALORES: readonly OpcaoDeVocabulario[] = [
  { valor: 'GLOBAL', rotulo: 'Valores do catálogo' },
  { valor: 'PROCESSO', rotulo: 'Opções declaradas pelo processo' },
  { valor: 'MODALIDADE', rotulo: 'Modalidades do processo' },
  { valor: 'MUNICIPIOS_BONUS', rotulo: 'Municípios do bônus regional' },
  { valor: 'GEO_UF', rotulo: 'Unidades da federação' },
  { valor: 'GEO_MUNICIPIO', rotulo: 'Municípios' },
];

export const FORMATOS_DE_TEXTO: readonly OpcaoDeVocabulario[] = [
  { valor: 'LIVRE', rotulo: 'Texto livre' },
  { valor: 'NOME_PESSOA', rotulo: 'Nome de pessoa' },
  { valor: 'CPF', rotulo: 'CPF' },
  { valor: 'EMAIL', rotulo: 'E-mail' },
  { valor: 'TELEFONE', rotulo: 'Telefone' },
  { valor: 'CEP', rotulo: 'CEP' },
];

export const ESCOPOS: readonly OpcaoDeVocabulario[] = [
  { valor: 'CANDIDATO', rotulo: 'Candidato' },
  { valor: 'MEMBRO_GRUPO', rotulo: 'Membro de grupo (ex.: composição familiar)' },
];

export const CLASSIFICACOES_DE_PROTECAO: readonly OpcaoDeVocabulario[] = [
  { valor: 'PUBLICO', rotulo: 'Público' },
  { valor: 'INTERNO', rotulo: 'Interno' },
  { valor: 'PESSOAL', rotulo: 'Pessoal' },
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

/**
 * As classificações que cabem no domínio: texto, data e endereço identificam ou localizam a pessoa
 * e nunca são menos que dado pessoal.
 */
export function classificacoesDoDominio(dominio: string): readonly OpcaoDeVocabulario[] {
  return ['TEXTO', 'DATA', 'ENDERECO'].includes(dominio)
    ? CLASSIFICACOES_DE_PROTECAO.filter((c) => ['PESSOAL', 'SENSIVEL'].includes(c.valor))
    : CLASSIFICACOES_DE_PROTECAO;
}

/** O fato declarado categórico escolhe a fonte dos valores; os demais domínios não têm fonte. */
export function temFonteDeValores(dominio: string): boolean {
  return dominio === 'CATEGORICO';
}

/** O fato declarado de texto tem formato; os demais domínios não. */
export function temFormato(dominio: string): boolean {
  return dominio === 'TEXTO';
}

/** O tipo do fato, pelo vínculo que diz de onde vem o valor dele. */
export type TipoDoFato = 'DECLARADO' | 'DERIVADO_POR_REGRA' | 'AGREGADO' | 'OUTRO';

export function tipoDoFato(fato: Pick<FatoCandidatoDto, 'binding'>): TipoDoFato {
  if (fato.binding.startsWith('CAMPO_INSCRICAO:') || fato.binding.startsWith('CAMPO_FORMULARIO:')) return 'DECLARADO';
  if (fato.binding.startsWith('REGRA_DERIVACAO:')) return 'DERIVADO_POR_REGRA';
  if (fato.binding.startsWith('AGREGACAO_GRUPO:')) return 'AGREGADO';
  return 'OUTRO';
}

type FatoAvaliado = Pick<FatoCandidatoDto, 'binding' | 'sistema' | 'dominio' | 'fonteValores'>;

/**
 * Se o fato tem valores próprios para manter: o categórico do administrador com os valores no
 * catálogo — o declarado de fonte global e o derivado por regra. O agregado herda os valores do
 * fato de membro, e o fato de sistema só muda por nova versão do sistema.
 */
export function podeTerValores(fato: FatoAvaliado): boolean {
  const tipo = tipoDoFato(fato);
  return (
    !fato.sistema &&
    fato.dominio === 'CATEGORICO' &&
    fato.fonteValores === 'GLOBAL' &&
    (tipo === 'DECLARADO' || tipo === 'DERIVADO_POR_REGRA')
  );
}

/** Se o fato tem regras padrão: só o derivado por regra do administrador. */
export function podeTerRegras(fato: FatoAvaliado): boolean {
  return !fato.sistema && tipoDoFato(fato) === 'DERIVADO_POR_REGRA';
}

/**
 * Os fatos que uma regra padrão pode citar: os ativos do candidato, sem o próprio derivado — o
 * fato de membro só existe dentro do grupo, e a regra que cita o próprio fato não termina.
 */
export function fatosCitaveisPelaRegra<T extends Pick<FatoCandidatoDto, 'codigo' | 'ativo' | 'escopo'>>(
  catalogo: readonly T[],
  codigoDoDerivado: string,
): readonly T[] {
  return catalogo.filter((fato) => fato.ativo && fato.escopo === 'CANDIDATO' && fato.codigo !== codigoDoDerivado);
}

/**
 * O controle do formulário a que a recusa da API se refere: o último segmento do campo, com a
 * primeira letra minúscula — a API devolve `pontoResolucao` nas recusas do domínio e `Nome` nas
 * de validação de entrada.
 */
export function campoDaRecusa(campo: string): string {
  const ultimo = campo.split('.').at(-1) ?? campo;
  return ultimo.charAt(0).toLocaleLowerCase('pt-BR') + ultimo.slice(1);
}

/**
 * A regra padrão que recebeu a recusa, pelo campo que a API devolve (`regras[2]`,
 * `regras[2].quando[0][1]`); nula quando a recusa não é de uma regra.
 */
export function indiceDaRegra(campo: string): number | null {
  const encontrado = /^regras\[(\d+)\]/u.exec(campo);
  return encontrado === null ? null : Number(encontrado[1]);
}
