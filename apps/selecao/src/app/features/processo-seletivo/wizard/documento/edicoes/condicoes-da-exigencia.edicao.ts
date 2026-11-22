import type {
  DocumentoDaConfiguracaoBaseLegal,
  DocumentoDaConfiguracaoExigencia,
  AbrangenciaDaBaseLegal,
  FormatoPermitido,
  ReferenciaDaIdadeMaxima,
  SituacaoDaBaseLegal,
  UnidadeDaIdadeMaxima,
} from '@uniplus/shared-data/selecao';

import { inteiroQueVale, textoQueVale } from '../valor-que-vale';
import { itensEditadosPorOrigem } from './itens-por-posicao';
import { comAlteracoes } from './partes-por-chave';
import { comCampo, comEscolha, comLista } from './secao-do-documento';

type Exigencia = DocumentoDaConfiguracaoExigencia;
type BaseLegal = DocumentoDaConfiguracaoBaseLegal;
type Idade = NonNullable<Exigencia['idadeMaximaEmissao']>;
type Formatos = NonNullable<Exigencia['formatosPermitidos']>;
type FormatoDaLista = NonNullable<Formatos['lista']>[number];

/** A base legal como o formulário a tem: todos os campos dela, os textos como estão nos campos. */
export interface BaseLegalDoFormulario {
  readonly origem?: number;
  readonly referencia: string;
  readonly abrangencia: AbrangenciaDaBaseLegal | '';
  readonly situacao: SituacaoDaBaseLegal | '';
  readonly observacao: string;
}

/** A idade máxima de emissão: o bloco inteiro no formulário, com a quantidade em texto. */
export interface IdadeMaximaDoFormulario {
  readonly valor: string;
  readonly unidade: UnidadeDaIdadeMaxima | '';
  readonly referenciaTipo: ReferenciaDaIdadeMaxima | '';
  readonly data: string;
  readonly referenciaFaseChave: string;
}

export interface FormatoDoFormulario {
  readonly origem?: number;
  readonly formato: FormatoPermitido | '';
  readonly tamanhoMaximoBytesMax: string;
}

/** `qualquer` nulo é "ainda não declarado": não é o mesmo que "não aceita qualquer formato". */
export interface FormatosDoFormulario {
  readonly qualquer: boolean | null;
  readonly lista: readonly FormatoDoFormulario[];
}

export function baseLegalComValores(
  atual: BaseLegal | undefined,
  valores: BaseLegalDoFormulario,
): BaseLegal {
  return comAlteracoes(
    atual ?? {},
    (base) => comCampo(base, 'referencia', textoQueVale(base.referencia, valores.referencia)),
    (base) => comEscolha(base, 'abrangencia', valores.abrangencia),
    (base) => comEscolha(base, 'situacao', valores.situacao),
    (base) => comCampo(base, 'observacao', textoQueVale(base.observacao, valores.observacao)),
  );
}

/** As bases legais, na ordem do formulário; a base que ele não traz sai. */
export function comBasesLegais<T extends { readonly basesLegais?: readonly BaseLegal[] }>(
  parte: T,
  bases: readonly BaseLegalDoFormulario[],
): T {
  return comLista(
    parte,
    'basesLegais',
    itensEditadosPorOrigem(parte.basesLegais, bases, baseLegalComValores),
  );
}

function idadeComValores(atual: Idade | undefined, valores: IdadeMaximaDoFormulario): Idade {
  return comAlteracoes(
    atual ?? {},
    (idade) => comCampo(idade, 'valor', inteiroQueVale(idade.valor, valores.valor)),
    (idade) => comEscolha(idade, 'unidade', valores.unidade),
    (idade) => comEscolha(idade, 'referenciaTipo', valores.referenciaTipo),
    (idade) => comCampo(idade, 'data', textoQueVale(idade.data, valores.data)),
    (idade) =>
      comCampo(
        idade,
        'referenciaFaseChave',
        textoQueVale(idade.referenciaFaseChave, valores.referenciaFaseChave),
      ),
  );
}

/** `null` retira o bloco da idade máxima; o bloco só nasce quando a pessoa o declara. */
export function comIdadeMaximaDeEmissao(
  exigencia: Exigencia,
  idade: IdadeMaximaDoFormulario | null,
): Exigencia {
  const bloco = idade === null ? undefined : idadeComValores(exigencia.idadeMaximaEmissao, idade);
  return comCampo(exigencia, 'idadeMaximaEmissao', bloco);
}

function formatoComValores(
  atual: FormatoDaLista | undefined,
  valores: FormatoDoFormulario,
): FormatoDaLista {
  return comAlteracoes(
    atual ?? {},
    (formato) => comEscolha(formato, 'formato', valores.formato),
    (formato) =>
      comCampo(
        formato,
        'tamanhoMaximoBytesMax',
        inteiroQueVale(formato.tamanhoMaximoBytesMax, valores.tamanhoMaximoBytesMax),
      ),
  );
}

function formatosComValores(atual: Formatos | undefined, valores: FormatosDoFormulario): Formatos {
  const bloco = atual ?? {};
  const lista = itensEditadosPorOrigem(bloco.lista, valores.lista, formatoComValores);
  return comAlteracoes(
    bloco,
    (formatos) => comCampo(formatos, 'qualquer', valores.qualquer ?? undefined),
    (formatos) => comLista(formatos, 'lista', lista),
  );
}

/** `null` retira o bloco dos formatos permitidos; o bloco só nasce quando a pessoa o declara. */
export function comFormatosPermitidos(
  exigencia: Exigencia,
  formatos: FormatosDoFormulario | null,
): Exigencia {
  const bloco =
    formatos === null ? undefined : formatosComValores(exigencia.formatosPermitidos, formatos);
  return comCampo(exigencia, 'formatosPermitidos', bloco);
}
