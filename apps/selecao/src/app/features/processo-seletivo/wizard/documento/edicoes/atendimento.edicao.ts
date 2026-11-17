import type {
  DocumentoDaConfiguracao,
  DocumentoDaConfiguracaoAtendimento,
} from '@uniplus/shared-data/selecao';

import { paresPorOrigem } from './itens-por-origem';
import { comLista, naSecao } from './secao-do-documento';

type Atendimento = DocumentoDaConfiguracaoAtendimento;
type Condicao = NonNullable<Atendimento['condicoes']>[number];
type Recurso = NonNullable<Atendimento['recursos']>[number];
type TipoDeDeficiencia = NonNullable<Atendimento['tiposDeficiencia']>[number];

interface CodigoDoFormulario {
  readonly codigo: string;
  readonly origem?: number;
}

/** Como reconhecer um item de uma lista do atendimento e como criar o item novo. */
interface FormaDoItem<T> {
  readonly codigoDe: (item: T) => string;
  readonly novo: (codigo: string) => T;
}

const CONDICAO: FormaDoItem<Condicao> = {
  codigoDe: (item) => item.condicaoCodigo,
  novo: (condicaoCodigo) => ({ condicaoCodigo }),
};

const RECURSO: FormaDoItem<Recurso> = {
  codigoDe: (item) => item.recursoCodigo,
  novo: (recursoCodigo) => ({ recursoCodigo }),
};

const TIPO_DE_DEFICIENCIA: FormaDoItem<TipoDeDeficiencia> = {
  codigoDe: (item) => item.tipoDeficienciaCodigo,
  novo: (tipoDeficienciaCodigo) => ({ tipoDeficienciaCodigo }),
};

/**
 * Cada código escolhido vira um item. O item que já estava no documento volta como estava, com o
 * nome que a API gravou, ainda que o código se repita; o item novo leva só o código.
 */
function itensDosCodigos<T>(
  atuais: readonly T[] | undefined,
  codigos: readonly CodigoDoFormulario[],
  forma: FormaDoItem<T>,
): readonly T[] {
  return itensPorOrigem(atuais ?? [], codigos, forma);
}

function comOrigens(valores: readonly CodigoDoFormulario[]) {
  return valores.map((valor) => ({ ...valor, origem: valor.origem ?? null }));
}

function itensPorOrigem<T>(
  atuais: readonly T[],
  valores: readonly CodigoDoFormulario[],
  forma: FormaDoItem<T>,
): readonly T[] {
  const pares = paresPorOrigem(atuais, comOrigens(valores));
  return pares.map(([atual, valor]) => {
    const correspondente =
      atual !== undefined && forma.codigoDe(atual) === valor.codigo ? atual : undefined;
    return correspondente ?? forma.novo(valor.codigo);
  });
}

export function definirCondicoesDeAtendimento(
  documento: DocumentoDaConfiguracao,
  codigos: readonly CodigoDoFormulario[],
): DocumentoDaConfiguracao {
  return naSecao(documento, 'atendimento', (atendimento) =>
    comLista(atendimento, 'condicoes', itensDosCodigos(atendimento.condicoes, codigos, CONDICAO)),
  );
}

export function definirRecursosDeAtendimento(
  documento: DocumentoDaConfiguracao,
  codigos: readonly CodigoDoFormulario[],
): DocumentoDaConfiguracao {
  return naSecao(documento, 'atendimento', (atendimento) =>
    comLista(atendimento, 'recursos', itensDosCodigos(atendimento.recursos, codigos, RECURSO)),
  );
}

export function definirTiposDeDeficiencia(
  documento: DocumentoDaConfiguracao,
  codigos: readonly CodigoDoFormulario[],
): DocumentoDaConfiguracao {
  return naSecao(documento, 'atendimento', (atendimento) =>
    comLista(
      atendimento,
      'tiposDeficiencia',
      itensDosCodigos(atendimento.tiposDeficiencia, codigos, TIPO_DE_DEFICIENCIA),
    ),
  );
}

/**
 * Bloco ausente é "ainda não decidiu"; bloco com as três listas vazias é "decidiu que o processo
 * não oferece atendimento". Esta ação é a decisão explícita, e leva embora o que havia nas listas.
 */
export function confirmarSemAtendimento(
  documento: DocumentoDaConfiguracao,
): DocumentoDaConfiguracao {
  return {
    ...documento,
    atendimento: { condicoes: [], recursos: [], tiposDeficiencia: [] },
  };
}

/** Devolve o atendimento ao estado "ainda não decidiu": o bloco sai do documento. */
export function desfazerDecisaoDeAtendimento(
  documento: DocumentoDaConfiguracao,
): DocumentoDaConfiguracao {
  const { atendimento, ...resto } = documento;
  return atendimento === undefined ? documento : resto;
}

/** A decisão de atender consta no documento mesmo sem nenhum item marcado ainda. */
export function garantirDecisaoDeAtendimento(
  documento: DocumentoDaConfiguracao,
): DocumentoDaConfiguracao {
  return documento.atendimento === undefined ? confirmarSemAtendimento(documento) : documento;
}
