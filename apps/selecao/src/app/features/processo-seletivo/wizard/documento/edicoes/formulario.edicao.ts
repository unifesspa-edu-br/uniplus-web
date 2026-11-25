import type {
  DocumentoDaConfiguracao,
  DocumentoDaConfiguracaoFormulario,
  FinalidadeDoFormulario,
} from '@uniplus/shared-data/selecao';

import { textoQueVale } from '../valor-que-vale';
import { comCampo, comLista } from './secao-do-documento';

type Formulario = DocumentoDaConfiguracaoFormulario;

function formulariosDe(documento: DocumentoDaConfiguracao): readonly Formulario[] {
  return documento.formularios ?? [];
}

export function formularioDaFinalidade(
  documento: DocumentoDaConfiguracao,
  finalidade: FinalidadeDoFormulario,
  ocorrencia = 0,
): Formulario | undefined {
  return formulariosDe(documento).filter((formulario) => formulario.finalidade === finalidade)[
    ocorrencia
  ];
}

/** Edita o formulário da finalidade; sem formulário nessa finalidade, a edição não muda nada. */
export function noFormulario(
  documento: DocumentoDaConfiguracao,
  finalidade: FinalidadeDoFormulario,
  alterar: (formulario: Formulario) => Formulario,
  ocorrencia = 0,
): DocumentoDaConfiguracao {
  const formularios = formulariosDe(documento);
  const posicoes = formularios.flatMap((item, indice) =>
    item.finalidade === finalidade ? [indice] : [],
  );
  const posicao = posicoes[ocorrencia];
  if (posicao === undefined) return documento;
  const lista = formularios.map((item, indice) => (indice === posicao ? alterar(item) : item));
  return comLista(documento, 'formularios', lista);
}

/** O formulário nasce vazio, só com a finalidade; a finalidade que já tem formulário não ganha outro. */
export function criarFormulario(
  documento: DocumentoDaConfiguracao,
  finalidade: FinalidadeDoFormulario,
): DocumentoDaConfiguracao {
  if (formularioDaFinalidade(documento, finalidade) !== undefined) return documento;
  return comCampo(documento, 'formularios', [...formulariosDe(documento), { finalidade }]);
}

/**
 * Tira o formulário da finalidade. Nada fora dele é tocado: o que cita o formulário, como a
 * exigência de uma finalidade, segue citando até a API apontar.
 */
export function removerFormulario(
  documento: DocumentoDaConfiguracao,
  finalidade: FinalidadeDoFormulario,
  ocorrencia = 0,
): DocumentoDaConfiguracao {
  const formularios = formulariosDe(documento);
  const posicoes = formularios.flatMap((item, indice) =>
    item.finalidade === finalidade ? [indice] : [],
  );
  return comLista(
    documento,
    'formularios',
    formularios.filter((_item, indice) => indice !== posicoes[ocorrencia]),
  );
}

export function definirTitulo(
  documento: DocumentoDaConfiguracao,
  finalidade: FinalidadeDoFormulario,
  titulo: string,
  ocorrencia = 0,
): DocumentoDaConfiguracao {
  return noFormulario(
    documento,
    finalidade,
    (formulario) => comCampo(formulario, 'titulo', textoQueVale(formulario.titulo, titulo)),
    ocorrencia,
  );
}

export function definirFaseDoFormulario(
  documento: DocumentoDaConfiguracao,
  finalidade: FinalidadeDoFormulario,
  faseChave: string,
  ocorrencia = 0,
): DocumentoDaConfiguracao {
  return noFormulario(
    documento,
    finalidade,
    (formulario) =>
      comCampo(formulario, 'faseChave', textoQueVale(formulario.faseChave, faseChave)),
    ocorrencia,
  );
}

/**
 * A cópia do modelo no formato que a API entrega substitui o formulário da finalidade, trazendo
 * o `modeloOrigemCodigo` dela; sem formulário na finalidade, a cópia entra ao fim.
 */
export function aplicarModelo(
  documento: DocumentoDaConfiguracao,
  finalidade: FinalidadeDoFormulario,
  copia: Formulario,
  ocorrencia = 0,
): DocumentoDaConfiguracao {
  const nova = comCampo(copia, 'finalidade', finalidade);
  const criado = criarFormulario(documento, finalidade);
  return noFormulario(criado, finalidade, () => nova, ocorrencia);
}

interface ParteOrdenada {
  readonly ordem?: number;
}

/** Uma das listas do formulário cujas partes têm `ordem`, com o modo de ler e de gravar a lista. */
export interface ListaDoFormulario<P extends ParteOrdenada> {
  readonly ler: (formulario: Formulario) => readonly P[] | undefined;
  readonly gravar: (formulario: Formulario, partes: readonly P[]) => Formulario;
}

type Pagina = NonNullable<Formulario['paginas']>[number];
type Item = NonNullable<Formulario['itens']>[number];
type Grupo = NonNullable<Formulario['grupos']>[number];
type Termo = NonNullable<Formulario['termos']>[number];

export const PAGINAS: ListaDoFormulario<Pagina> = {
  ler: (formulario) => formulario.paginas,
  gravar: (formulario, partes) => comLista(formulario, 'paginas', partes),
};
export const ITENS: ListaDoFormulario<Item> = {
  ler: (formulario) => formulario.itens,
  gravar: (formulario, partes) => comLista(formulario, 'itens', partes),
};
export const GRUPOS: ListaDoFormulario<Grupo> = {
  ler: (formulario) => formulario.grupos,
  gravar: (formulario, partes) => comLista(formulario, 'grupos', partes),
};
export const TERMOS: ListaDoFormulario<Termo> = {
  ler: (formulario) => formulario.termos,
  gravar: (formulario, partes) => comLista(formulario, 'termos', partes),
};

function comOrdem<P extends ParteOrdenada>(partes: readonly P[]): P[] {
  return partes.map((parte, posicao) =>
    parte.ordem === posicao ? parte : { ...parte, ordem: posicao },
  );
}

type FinalidadeEnderecada =
  | FinalidadeDoFormulario
  | { readonly finalidade: FinalidadeDoFormulario; readonly ocorrencia: number };

function naLista<P extends ParteOrdenada>(
  documento: DocumentoDaConfiguracao,
  finalidade: FinalidadeEnderecada,
  lista: ListaDoFormulario<P>,
  alterar: (partes: readonly P[]) => readonly P[],
): DocumentoDaConfiguracao {
  const chave = typeof finalidade === 'string' ? finalidade : finalidade.finalidade;
  const ocorrencia = typeof finalidade === 'string' ? 0 : finalidade.ocorrencia;
  return noFormulario(
    documento,
    chave,
    (formulario) => lista.gravar(formulario, alterar(lista.ler(formulario) ?? [])),
    ocorrencia,
  );
}

/** A parte nova vai ao fim, e a `ordem` da lista é renumerada a partir de 0. */
export function acrescentarParte<P extends ParteOrdenada>(
  documento: DocumentoDaConfiguracao,
  finalidade: FinalidadeEnderecada,
  lista: ListaDoFormulario<P>,
  parte: P,
): DocumentoDaConfiguracao {
  return naLista(documento, finalidade, lista, (partes) => comOrdem([...partes, parte]));
}

/** Tira a parte da posição. As partes que ficam mantêm a `ordem` que tinham. */
export function retirarParte<P extends ParteOrdenada>(
  documento: DocumentoDaConfiguracao,
  finalidade: FinalidadeEnderecada,
  lista: ListaDoFormulario<P>,
  posicao: number,
): DocumentoDaConfiguracao {
  return naLista(documento, finalidade, lista, (partes) =>
    partes.filter((_parte, indice) => indice !== posicao),
  );
}

function colocada<P>(partes: readonly P[], de: number, para: number): readonly P[] {
  const parte = partes[de];
  if (parte === undefined) return partes;
  const restantes = partes.filter((_parte, indice) => indice !== de);
  return [...restantes.slice(0, para), parte, ...restantes.slice(para)];
}

/** Move a parte de uma posição para outra e renumera a `ordem` da lista a partir de 0. */
export function moverParte<P extends ParteOrdenada>(
  documento: DocumentoDaConfiguracao,
  finalidade: FinalidadeEnderecada,
  lista: ListaDoFormulario<P>,
  movimento: { readonly de: number; readonly para: number },
): DocumentoDaConfiguracao {
  return naLista(documento, finalidade, lista, (partes) =>
    movimento.de === movimento.para || partes[movimento.de] === undefined
      ? partes
      : comOrdem(colocada(partes, movimento.de, movimento.para)),
  );
}
