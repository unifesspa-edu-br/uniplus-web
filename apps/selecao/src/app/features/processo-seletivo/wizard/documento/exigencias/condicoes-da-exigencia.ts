import type { DocumentoDaConfiguracaoCondicoesAlternativas } from '@uniplus/shared-data/selecao';

import type { CondicaoGatilhoConfig } from '../../modelos/exigencias.models';
import { ehCondicaoDasModalidades } from '../../shared/exigencias/modalidades-da-exigencia';
import {
  valorDaCondicaoNoDocumento,
  valorDaCondicaoNoEditor,
} from '../../shared/exigencias/valor-da-condicao-da-exigencia';
import { comAlteracoes } from '../edicoes/partes-por-chave';
import { comCampo, comCodigo } from '../edicoes/secao-do-documento';
import { itensPreservados, preservandoOriginal } from './campos-alterados';

type Alternativas = DocumentoDaConfiguracaoCondicoesAlternativas;
type Alternativa = Alternativas[number];
type Condicao = Alternativa[number];

/** Único ponto em que o operador do editor encontra o do documento. */
export function operadorNoEditor(operador: Condicao['operador']): string {
  return operador;
}

export function operadorNoDocumento(operador: string): Condicao['operador'] {
  return operador as Condicao['operador'];
}

function condicaoNoEditor(condicao: Condicao, clausula: number): CondicaoGatilhoConfig {
  return {
    clausula,
    fato: condicao.codigoDoDado,
    operador: operadorNoEditor(condicao.operador),
    valor: valorDaCondicaoNoEditor(condicao.valor),
  };
}

/** Cada alternativa do documento é a cláusula do editor, que começa em 1. */
export function condicoesNoEditor(alternativas: Alternativas | undefined): CondicaoGatilhoConfig[] {
  return (alternativas ?? []).flatMap((alternativa, posicao) =>
    alternativa.map((condicao) => condicaoNoEditor(condicao, posicao + 1)),
  );
}

function condicaoNoDocumento(atual: CondicaoGatilhoConfig, original?: Condicao): Condicao {
  const operador = operadorNoDocumento(atual.operador);
  return comAlteracoes(
    original ?? { codigoDoDado: atual.fato, operador, valor: '' },
    (condicao) => comCampo(condicao, 'codigoDoDado', atual.fato),
    (condicao) => comCodigo(condicao, 'operador', operador, ['operadorRotulo']),
    (condicao) => comCampo(condicao, 'valor', valorDaCondicaoNoDocumento(atual.valor)),
  );
}

function alternativaNoDocumento(
  original: Alternativa | undefined,
  atuais: readonly CondicaoGatilhoConfig[],
): Alternativa {
  const clausula = atuais[0].clausula;
  const condicoes = itensPreservados(
    original,
    atuais,
    (condicao) => condicaoNoEditor(condicao, clausula),
    condicaoNoDocumento,
  );
  return preservandoOriginal(original, condicoes);
}

/**
 * A restrição às modalidades vale para o gatilho inteiro: a alternativa que ainda não a tem a
 * recebe, ao fim. As alternativas que já a têm não mudam.
 */
function comRestricaoEmCadaAlternativa(
  atuais: readonly CondicaoGatilhoConfig[],
): readonly CondicaoGatilhoConfig[] {
  const restricao = atuais.find(ehCondicaoDasModalidades);
  if (restricao === undefined) return atuais;
  const faltantes = [...new Set(atuais.map(({ clausula }) => clausula))].filter(
    (numero) => !atuais.some((c) => c.clausula === numero && ehCondicaoDasModalidades(c)),
  );
  return [...atuais, ...faltantes.map((clausula) => ({ ...restricao, clausula }))];
}

/**
 * As alternativas do documento a partir das cláusulas do editor. A restrição às modalidades é
 * completada em cada alternativa só aqui, onde a exigência foi editada.
 */
export function condicoesNoDocumento(
  originais: Alternativas | undefined,
  atuais: readonly CondicaoGatilhoConfig[],
): Alternativas {
  const restritas = comRestricaoEmCadaAlternativa(atuais);
  const numeros = [...new Set(restritas.map(({ clausula }) => clausula))].sort((a, b) => a - b);
  const alternativas = numeros.map((numero, posicao) =>
    alternativaNoDocumento(
      originais?.[posicao],
      restritas.filter(({ clausula }) => clausula === numero),
    ),
  );
  return preservandoOriginal(originais, alternativas);
}
