import type {
  DocumentoDaConfiguracao,
  DocumentoDaConfiguracaoClassificacao,
} from '@uniplus/shared-data/selecao';

import { escalaDaNotaFinalComoTexto } from '../../shared/escala-da-nota-final';
import {
  definirBaseadoEmEnem,
  definirCasasDeArredondamento,
  definirEscalaDaNotaFinal,
  definirRegraDeArredondamento,
  definirRegraDeCalculo,
  definirRegraDeOrdemDeAlocacao,
  definirResolucaoDoPesoPorArea,
} from '../edicoes/classificacao.edicao';
import { emSequencia, type EdicaoDoDocumento } from '../edicoes/secao-do-documento';
import { regraEscolhida, type RegraEscolhida } from '../regra-escolhida';
import { textoDoNumero } from '../texto-do-campo';

export type QuadroDePesosLido = NonNullable<
  DocumentoDaConfiguracaoClassificacao['quadroPesoAreaEnem']
>;

export interface ValoresDaFormula {
  readonly regraDeCalculo: RegraEscolhida | null;
  readonly regraDeArredondamento: RegraEscolhida | null;
  readonly casasDeArredondamento: string;
  readonly escalaDaNotaFinal: string;
  readonly regraDeOrdemDeAlocacao: RegraEscolhida | null;
  /** `null` é "ainda não declarado": ausente não é o mesmo que "não é baseada em ENEM". */
  readonly baseadoEmEnem: boolean | null;
  readonly resolucaoDoPesoPorArea: string;
  /** Só leitura: o quadro que a API copiou da resolução escolhida. A edição não o escreve. */
  readonly quadroDePesos: QuadroDePesosLido;
}

export function valoresDoFormulario(documento: DocumentoDaConfiguracao): ValoresDaFormula {
  const classificacao = documento.classificacao ?? {};
  return {
    regraDeCalculo: regraEscolhida(classificacao.regraCalculo),
    regraDeArredondamento: regraEscolhida(classificacao.regraArredondamento),
    casasDeArredondamento: textoDoNumero(classificacao.casasArredondamento),
    escalaDaNotaFinal: escalaDaNotaFinalComoTexto(classificacao.escalaNotaFinal),
    regraDeOrdemDeAlocacao: regraEscolhida(classificacao.regraOrdemAlocacao),
    baseadoEmEnem: classificacao.baseadoEmEnem ?? null,
    resolucaoDoPesoPorArea: classificacao.resolucaoPesoAreaEnem ?? '',
    quadroDePesos: classificacao.quadroPesoAreaEnem ?? [],
  };
}

export function edicaoDoPasso(valores: ValoresDaFormula): EdicaoDoDocumento {
  return emSequencia(
    (documento) => definirRegraDeCalculo(documento, valores.regraDeCalculo),
    (documento) => definirRegraDeArredondamento(documento, valores.regraDeArredondamento),
    (documento) => definirCasasDeArredondamento(documento, valores.casasDeArredondamento),
    (documento) => definirEscalaDaNotaFinal(documento, valores.escalaDaNotaFinal),
    (documento) => definirRegraDeOrdemDeAlocacao(documento, valores.regraDeOrdemDeAlocacao),
    (documento) => definirBaseadoEmEnem(documento, valores.baseadoEmEnem),
    (documento) => definirResolucaoDoPesoPorArea(documento, valores.resolucaoDoPesoPorArea),
  );
}
