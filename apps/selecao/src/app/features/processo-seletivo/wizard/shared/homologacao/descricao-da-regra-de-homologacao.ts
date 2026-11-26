import { descreverAlternativas, type FatoEscolhivel } from '@uniplus/shared-inscricao/formulario';

import type {
  AlternativaDeHomologacao,
  CondicaoDeHomologacao,
  RegraDeHomologacao,
} from '../../modelos/homologacao.models';
import { rotuloDoTipoDeCondicao } from './tipos-de-condicao-de-homologacao';

/** A leitura da regra sem alternativa: nenhuma condição restringe a homologação. */
export const HOMOLOGA_TODA_INSCRICAO_ENVIADA = 'A fase homologa toda inscrição enviada';

/** Na leitura da edição, o ano que a condição ainda não aponta. */
export const EDICAO_NAO_ESCOLHIDA = 'edição (não escolhida)';

/** Como a leitura nomeia a edição do exame pelo ano; é quem chama que conhece o nome do exame. */
export type RotuloDaEdicao = (ano: string) => string;

/**
 * A regra em prosa: as condições de cada alternativa ligadas por "e" e as alternativas por
 * "ou", como "A e B, ou C". A condição com enquadramento diz para quem vale.
 */
export function descricaoDaRegraDeHomologacao(
  regra: RegraDeHomologacao,
  fatos: ReadonlyMap<string, FatoEscolhivel>,
  rotuloDaEdicao: RotuloDaEdicao,
): string {
  if (regra.alternativas.length === 0) return HOMOLOGA_TODA_INSCRICAO_ENVIADA;
  return regra.alternativas
    .map((alternativa) => descricaoDaAlternativa(alternativa, fatos, rotuloDaEdicao))
    .join(', ou ');
}

function descricaoDaAlternativa(
  alternativa: AlternativaDeHomologacao,
  fatos: ReadonlyMap<string, FatoEscolhivel>,
  rotuloDaEdicao: RotuloDaEdicao,
): string {
  return alternativa.condicoes
    .map((condicao) => descricaoDaCondicaoDeHomologacao(condicao, fatos, rotuloDaEdicao))
    .join(' e ');
}

/** Uma condição em prosa, como a leitura da regra a escreve. */
export function descricaoDaCondicaoDeHomologacao(
  condicao: CondicaoDeHomologacao,
  fatos: ReadonlyMap<string, FatoEscolhivel>,
  rotuloDaEdicao: RotuloDaEdicao,
): string {
  const base = `${comInicialMinuscula(rotuloDoTipoDeCondicao(condicao.tipo))} na ${edicaoDescrita(condicao, rotuloDaEdicao)}`;
  const publico = descreverAlternativas(condicao.enquadramento, fatos);
  return publico.length === 0 ? base : `${base} (para quem ${publico.join(' ou ')})`;
}

function edicaoDescrita(condicao: CondicaoDeHomologacao, rotuloDaEdicao: RotuloDaEdicao): string {
  if (condicao.edicaoDoExame === null) return EDICAO_NAO_ESCOLHIDA;
  return `edição ${rotuloDaEdicao(String(condicao.edicaoDoExame))}`;
}

/** Só a inicial de palavra comum desce: a sigla e o código que a API devolve ficam como estão. */
function comInicialMinuscula(texto: string): string {
  const [inicial, segunda = ''] = texto;
  const ehSigla =
    segunda === segunda.toLocaleUpperCase('pt-BR') &&
    segunda !== segunda.toLocaleLowerCase('pt-BR');
  return ehSigla ? texto : inicial.toLocaleLowerCase('pt-BR') + texto.slice(1);
}
