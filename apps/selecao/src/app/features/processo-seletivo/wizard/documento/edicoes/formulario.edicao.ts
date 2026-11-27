import type {
  DocumentoDaConfiguracao,
  DocumentoDaConfiguracaoFormulario,
} from '@uniplus/shared-data/selecao';

import { textoQueVale } from '../valor-que-vale';
import { comCampo, comLista } from './secao-do-documento';

type Formulario = DocumentoDaConfiguracaoFormulario;

function formulariosDe(documento: DocumentoDaConfiguracao): readonly Formulario[] {
  return documento.formularios ?? [];
}

/** O formulário do código; `undefined` quando o documento não o tem. */
export function formularioDoCodigo(
  documento: DocumentoDaConfiguracao,
  codigo: string,
): Formulario | undefined {
  return formulariosDe(documento).find((formulario) => formulario.codigo === codigo);
}

/** Edita o formulário do código; sem formulário com ele, a edição não muda nada. */
export function noFormulario(
  documento: DocumentoDaConfiguracao,
  codigo: string,
  alterar: (formulario: Formulario) => Formulario,
): DocumentoDaConfiguracao {
  const formularios = formulariosDe(documento);
  if (!formularios.some((item) => item.codigo === codigo)) return documento;
  const lista = formularios.map((item) => (item.codigo === codigo ? alterar(item) : item));
  return comLista(documento, 'formularios', lista);
}

/** O formulário nasce vazio, só com o código; o código que já tem formulário não ganha outro. */
export function criarFormulario(
  documento: DocumentoDaConfiguracao,
  codigo: string,
): DocumentoDaConfiguracao {
  if (formularioDoCodigo(documento, codigo) !== undefined) return documento;
  return comCampo(documento, 'formularios', [...formulariosDe(documento), { codigo }]);
}

/**
 * Tira o formulário do código. Nada fora dele é tocado: o que cita o formulário, como a
 * exigência de um documento, segue citando até a API apontar.
 */
export function removerFormulario(
  documento: DocumentoDaConfiguracao,
  codigo: string,
): DocumentoDaConfiguracao {
  return comLista(
    documento,
    'formularios',
    formulariosDe(documento).filter((item) => item.codigo !== codigo),
  );
}

export function definirTitulo(
  documento: DocumentoDaConfiguracao,
  codigo: string,
  titulo: string,
): DocumentoDaConfiguracao {
  return noFormulario(documento, codigo, (formulario) =>
    comCampo(formulario, 'titulo', textoQueVale(formulario.titulo, titulo)),
  );
}

export function definirFaseDoFormulario(
  documento: DocumentoDaConfiguracao,
  codigo: string,
  faseChave: string,
): DocumentoDaConfiguracao {
  return noFormulario(documento, codigo, (formulario) =>
    comCampo(formulario, 'faseChave', textoQueVale(formulario.faseChave, faseChave)),
  );
}

/**
 * A cópia do modelo no formato que a API entrega substitui o formulário do código, trazendo o
 * `modeloOrigemCodigo` dela; sem formulário com o código, a cópia entra ao fim.
 */
export function aplicarModelo(
  documento: DocumentoDaConfiguracao,
  codigo: string,
  copia: Formulario,
): DocumentoDaConfiguracao {
  const nova = comCampo(copia, 'codigo', codigo);
  return noFormulario(criarFormulario(documento, codigo), codigo, () => nova);
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

function naLista<P extends ParteOrdenada>(
  documento: DocumentoDaConfiguracao,
  codigo: string,
  lista: ListaDoFormulario<P>,
  alterar: (partes: readonly P[]) => readonly P[],
): DocumentoDaConfiguracao {
  return noFormulario(documento, codigo, (formulario) =>
    lista.gravar(formulario, alterar(lista.ler(formulario) ?? [])),
  );
}

/** A parte nova vai ao fim, e a `ordem` da lista é renumerada a partir de 0. */
export function acrescentarParte<P extends ParteOrdenada>(
  documento: DocumentoDaConfiguracao,
  codigo: string,
  lista: ListaDoFormulario<P>,
  parte: P,
): DocumentoDaConfiguracao {
  return naLista(documento, codigo, lista, (partes) => comOrdem([...partes, parte]));
}

/** Tira a parte da posição. As partes que ficam mantêm a `ordem` que tinham. */
export function retirarParte<P extends ParteOrdenada>(
  documento: DocumentoDaConfiguracao,
  codigo: string,
  lista: ListaDoFormulario<P>,
  posicao: number,
): DocumentoDaConfiguracao {
  return naLista(documento, codigo, lista, (partes) =>
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
  codigo: string,
  lista: ListaDoFormulario<P>,
  movimento: { readonly de: number; readonly para: number },
): DocumentoDaConfiguracao {
  return naLista(documento, codigo, lista, (partes) =>
    movimento.de === movimento.para || partes[movimento.de] === undefined
      ? partes
      : comOrdem(colocada(partes, movimento.de, movimento.para)),
  );
}
