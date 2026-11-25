import {
  BlocoSistemaCodigo,
  type OperadorCodigo,
  TipoPaginaFormularioCodigo,
  TipoObrigatoriedadeCodigo,
  type TipoDeCampoCodigo,
} from '@uniplus/shared-data/configuracao';
import { codigoDoContrato } from '@uniplus/shared-data/utils';
import type { ConteudoDoFormulario } from '@uniplus/shared-inscricao/formulario';

type Conteudo = ConteudoDoFormulario<number, OperadorCodigo | null, TipoDeCampoCodigo | null>;
type Item = NonNullable<Conteudo['itens']>[number];
type Grupo = NonNullable<Conteudo['grupos']>[number];
type Termo = NonNullable<Conteudo['termos']>[number];
type Regras = Item['regras'] | Grupo['regras'] | Termo['regras'];

function tipoDeObrigatoriedade(tipo: string | null): TipoObrigatoriedadeCodigo | null {
  return tipo === null ? null : codigoDoContrato(TipoObrigatoriedadeCodigo, tipo);
}

/** As regras com o tipo de obrigatoriedade no membro do enum do contrato. */
function regrasParaOModelo<R extends Regras>(regras: R) {
  const { obrigatoriedade } = regras;
  return {
    ...regras,
    obrigatoriedade: { ...obrigatoriedade, tipo: tipoDeObrigatoriedade(obrigatoriedade.tipo) },
  };
}

function itemParaOModelo(item: Item) {
  return { ...item, regras: regrasParaOModelo(item.regras) };
}

/** Os itens, com a obrigatoriedade no código do contrato. */
export function itensParaOModelo(itens: Conteudo['itens']) {
  return itens?.map(itemParaOModelo) ?? null;
}

/** Os grupos, com a obrigatoriedade deles e a dos subitens no código do contrato. */
export function gruposParaOModelo(grupos: Conteudo['grupos']) {
  return (
    grupos?.map((grupo) => ({
      ...grupo,
      regras: regrasParaOModelo(grupo.regras),
      subitens: grupo.subitens.map(itemParaOModelo),
    })) ?? null
  );
}

/** Os termos, com a obrigatoriedade no código do contrato. */
export function termosParaOModelo(termos: Conteudo['termos']) {
  return termos?.map((termo) => ({ ...termo, regras: regrasParaOModelo(termo.regras) })) ?? null;
}

function membroDoContrato<E extends Record<string, string>>(contrato: E, codigo: string) {
  const membro = codigoDoContrato(contrato, codigo);
  if (membro === null) throw new Error(`Código fora do contrato: ${codigo}`);
  return membro;
}

/**
 * As páginas, com o tipo e o bloco no membro do enum do contrato.
 *
 * @throws Error quando o tipo ou o bloco não existe no contrato: os dois vêm da API ou das
 * constantes do editor, então um valor desconhecido é defeito do código, não da pessoa que preenche.
 */
export function paginasParaOModelo<
  E extends { readonly tipo: string; readonly bloco: string | null },
>(paginas: readonly E[] | null | undefined) {
  return (
    paginas?.map((pagina) => ({
      ...pagina,
      tipo: membroDoContrato(TipoPaginaFormularioCodigo, pagina.tipo),
      bloco: pagina.bloco === null ? null : membroDoContrato(BlocoSistemaCodigo, pagina.bloco),
    })) ?? null
  );
}
