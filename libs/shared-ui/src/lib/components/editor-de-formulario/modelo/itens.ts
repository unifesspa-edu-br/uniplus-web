import { renderizacaoDe } from './catalogo-de-campos';
import { comFatosConhecidosAntes, quemCita } from './citacoes';
import { nomeDoFato } from './codigos';
import { conferirOrdem } from './conferencia-de-ordem';
import { LIMITES_DO_FORMULARIO, OBRIGATORIEDADE_SEMPRE, SECAO_DADOS_BASICOS } from './constantes';
import { entradasDaSecao, ordemDa, ordemNoFimDaSecao, renumerar } from './ordem-das-entradas';
import { RESTRICAO_MUNICIPIOS_DA_UF } from './restricoes-de-valor';
import {
  ChaveDaEntrada,
  ConteudoDoFormulario,
  EntradaDaSecao,
  FONTE_GEO_MUNICIPIO,
  FONTE_GEO_UF,
  FatoDoFormulario,
  ItemDoFormulario,
  MULTIVALORADO,
  ResultadoDaEdicao,
} from './tipos';

/** O item novo do fato, no fim da seção: obrigatório e sem condição, com o nome do fato como rótulo. */
export function acrescentarItem(
  conteudo: ConteudoDoFormulario,
  fato: FatoDoFormulario,
  etapaCodigo: string,
): ConteudoDoFormulario {
  const novo: ItemDoFormulario = {
    fatoCodigo: fato.codigo,
    ordem: ordemNoFimDaSecao(conteudo, etapaCodigo),
    rotulo: fato.nome.slice(0, LIMITES_DO_FORMULARIO.rotulo),
    tipoRenderizacao: renderizacaoDe(fato) ?? '',
    obrigatoriedade: OBRIGATORIEDADE_SEMPRE,
    precondicao: null,
    etapaCodigo,
    predicadoObrigatoriedade: null,
    ajuda: null,
    pedirConfirmacao: false,
  };
  return renumerar({ ...conteudo, itens: [...(conteudo.itens ?? []), novo] });
}

/** O que o município precisa para citar a UF: o catálogo e os fatos de outro formulário conhecidos antes. */
export interface ContextoDeCitacao {
  readonly catalogo: readonly FatoDoFormulario[];
  readonly fatosConhecidosAntes?: readonly string[];
}

/**
 * Acrescenta o campo do fato no fim da seção. O de município nasce restrito aos municípios da UF
 * respondida no campo de UF anterior mais próximo: a API recusa município sem a UF, e sem campo de
 * UF antes a tela recusa o acréscimo, em vez de criar um campo que não se grava.
 */
export function acrescentarCampo(
  conteudo: ConteudoDoFormulario,
  fato: FatoDoFormulario,
  etapaCodigo: string,
  citacoes: ContextoDeCitacao,
): ResultadoDaEdicao {
  const comCampo = acrescentarItem(conteudo, fato, etapaCodigo);
  if (fato.fonteValores !== FONTE_GEO_MUNICIPIO) return { ok: true, conteudo: comCampo };

  const uf = ufsAnteriores(
    comFatosConhecidosAntes(comCampo, citacoes.fatosConhecidosAntes ?? []),
    citacoes.catalogo,
    fato.codigo,
  ).at(-1);
  if (uf === undefined) {
    return {
      ok: false,
      recusa: `Acrescente antes o campo de UF: “${fato.nome}” escolhe entre os municípios da UF respondida antes.`,
    };
  }
  const item = (comCampo.itens ?? []).find((i) => i.fatoCodigo === fato.codigo) as ItemDoFormulario;
  return {
    ok: true,
    conteudo: comItem(comCampo, {
      ...item,
      restricoes: [{ tipo: RESTRICAO_MUNICIPIOS_DA_UF, fatos: [uf.codigo] }],
    }),
  };
}

/**
 * Os campos de UF anteriores ao campo dado, do mais antigo ao mais próximo: o município cita a UF
 * respondida antes, de resposta única e com a lista de UFs do Geo. Os pressupostos, conhecidos
 * antes de todo o formulário, vêm primeiro.
 */
export function ufsAnteriores(
  conteudo: ConteudoDoFormulario,
  catalogo: readonly FatoDoFormulario[],
  fatoCodigo: string,
): readonly FatoDoFormulario[] {
  const ordem =
    (conteudo.itens ?? []).find((item) => item.fatoCodigo === fatoCodigo)?.ordem ?? Infinity;
  const porCodigo = new Map(catalogo.map((fato) => [fato.codigo, fato]));
  const anteriores = [...(conteudo.itens ?? [])]
    .filter((item) => item.ordem < ordem)
    .sort((a, b) => a.ordem - b.ordem)
    .map((item) => item.fatoCodigo);
  return [...(conteudo.pressupostos ?? []), ...anteriores].flatMap((codigo) => {
    const fato = porCodigo.get(codigo);
    return fato?.fonteValores === FONTE_GEO_UF && fato.cardinalidade !== MULTIVALORADO
      ? [fato]
      : [];
  });
}

/** Troca o item pelo editado, sem mexer na ordem. */
export function comItem(
  conteudo: ConteudoDoFormulario,
  editado: ItemDoFormulario,
): ConteudoDoFormulario {
  return {
    ...conteudo,
    itens: (conteudo.itens ?? []).map((item) =>
      item.fatoCodigo === editado.fatoCodigo ? editado : item,
    ),
  };
}

export function ehAEntrada(entrada: EntradaDaSecao, chave: ChaveDaEntrada): boolean {
  return chave.tipo === 'item'
    ? entrada.tipo === 'item' && entrada.item.fatoCodigo === chave.fatoCodigo
    : entrada.tipo === 'grupo' && entrada.grupo.codigo === chave.codigo;
}

function etapaDaEntrada(conteudo: ConteudoDoFormulario, chave: ChaveDaEntrada): string | null {
  const etapa =
    chave.tipo === 'item'
      ? (conteudo.itens ?? []).find((item) => item.fatoCodigo === chave.fatoCodigo)?.etapaCodigo
      : (conteudo.grupos ?? []).find((grupo) => grupo.codigo === chave.codigo)?.etapaCodigo;
  return etapa ?? null;
}

/** Se o item ou o grupo pode trocar de lugar com a entrada vizinha da mesma seção. */
export function podeMoverEntrada(
  conteudo: ConteudoDoFormulario,
  chave: ChaveDaEntrada,
  direcao: -1 | 1,
): boolean {
  const etapa = etapaDaEntrada(conteudo, chave);
  if (etapa === null || etapa === SECAO_DADOS_BASICOS) return false;
  const entradas = entradasDaSecao(conteudo, etapa);
  const indice = entradas.findIndex((entrada) => ehAEntrada(entrada, chave));
  return indice >= 0 && entradas[indice + direcao] !== undefined;
}

/**
 * Troca o item ou o grupo de lugar com a entrada vizinha da seção. Recusa o movimento que põe uma
 * regra antes de um fato que ela cita, ou que passa para depois dele uma regra que o cita.
 */
export function moverEntrada(
  conteudo: ConteudoDoFormulario,
  chave: ChaveDaEntrada,
  direcao: -1 | 1,
  nomes: ReadonlyMap<string, string>,
): ResultadoDaEdicao {
  if (!podeMoverEntrada(conteudo, chave, direcao))
    return { ok: false, recusa: 'Não é possível mover nessa direção.' };
  const entradas = entradasDaSecao(conteudo, etapaDaEntrada(conteudo, chave) as string);
  const indice = entradas.findIndex((entrada) => ehAEntrada(entrada, chave));
  const [atual, vizinha] = [entradas[indice], entradas[indice + direcao]];
  // A entrada e a vizinha trocam de ordem; a renumeração fecha a numeração.
  const ordemTrocada = (alvo: ChaveDaEntrada): number | undefined =>
    ehAEntrada(atual, alvo)
      ? ordemDa(vizinha)
      : ehAEntrada(vizinha, alvo)
        ? ordemDa(atual)
        : undefined;

  const trocado = renumerar({
    ...conteudo,
    itens: (conteudo.itens ?? []).map((item) => ({
      ...item,
      ordem: ordemTrocada({ tipo: 'item', fatoCodigo: item.fatoCodigo }) ?? item.ordem,
    })),
    grupos: (conteudo.grupos ?? []).map((grupo) => ({
      ...grupo,
      ordem: ordemTrocada({ tipo: 'grupo', codigo: grupo.codigo }) ?? grupo.ordem,
    })),
  });
  return conferirOrdem(trocado, nomes);
}

/** Se o item pode trocar de lugar com a entrada vizinha da mesma seção. */
export function podeMoverItem(
  conteudo: ConteudoDoFormulario,
  fatoCodigo: string,
  direcao: -1 | 1,
): boolean {
  return podeMoverEntrada(conteudo, { tipo: 'item', fatoCodigo }, direcao);
}

/** Troca o item de lugar com a entrada vizinha da seção, com a recusa de `moverEntrada`. */
export function moverItem(
  conteudo: ConteudoDoFormulario,
  fatoCodigo: string,
  direcao: -1 | 1,
  nomes: ReadonlyMap<string, string>,
): ResultadoDaEdicao {
  return moverEntrada(conteudo, { tipo: 'item', fatoCodigo }, direcao, nomes);
}

/**
 * Remove o item. Recusa quando outra regra do formulário cita o fato dele: a condição ficaria
 * citando fato que o formulário não coleta.
 */
export function removerItem(
  conteudo: ConteudoDoFormulario,
  fatoCodigo: string,
  nomes: ReadonlyMap<string, string>,
): ResultadoDaEdicao {
  const quem = quemCita(conteudo, fatoCodigo).find((citante) => citante.fatoCodigo !== fatoCodigo);
  if (quem !== undefined) {
    return {
      ok: false,
      recusa: `Não é possível remover “${nomeDoFato(nomes, fatoCodigo)}”: ${quem.descricao} cita esse campo.`,
    };
  }
  return {
    ok: true,
    conteudo: renumerar({
      ...conteudo,
      itens: (conteudo.itens ?? []).filter((i) => i.fatoCodigo !== fatoCodigo),
    }),
  };
}
