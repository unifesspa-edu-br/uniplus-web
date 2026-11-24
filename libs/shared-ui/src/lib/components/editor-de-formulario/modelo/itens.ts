import { campoNovo } from './catalogo-de-campos';
import { comFatosConhecidosAntes, quemCita } from './citacoes';
import { nomeDoFato } from './codigos';
import { conferirOrdem } from './conferencia-de-ordem';
import { SECAO_DADOS_BASICOS } from './constantes';
import {
  TrocaComAVizinha,
  entradasDaSecao,
  ordemDa,
  ordemNoFimDaSecao,
  renumerar,
} from './ordem-das-entradas';
import { RESTRICAO_MUNICIPIOS_DA_UF } from './restricoes-de-valor';
import {
  ChaveDaEntrada,
  ConteudoDoFormulario,
  EntradaDaSecao,
  FONTE_MUNICIPIOS,
  FONTE_UNIDADES_FEDERATIVAS,
  FatoDoFormulario,
  GrupoDoFormulario,
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
  const novo = campoNovo(fato, ordemNoFimDaSecao(conteudo, etapaCodigo), etapaCodigo);
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
  if (fato.fonteValores?.codigo !== FONTE_MUNICIPIOS) return { ok: true, conteudo: comCampo };
  return municipioRestritoAUfAnterior(comCampo, fato, citacoes);
}

function municipioRestritoAUfAnterior(
  comCampo: ConteudoDoFormulario,
  fato: FatoDoFormulario,
  citacoes: ContextoDeCitacao,
): ResultadoDaEdicao {
  const uf = ufsAnteriores(
    comFatosConhecidosAntes(comCampo, citacoes.fatosConhecidosAntes ?? []),
    citacoes.catalogo,
    fato.codigo,
  ).at(-1);
  if (uf === undefined) return { ok: false, recusa: recusaDoMunicipioSemUf(fato) };
  return { ok: true, conteudo: comRestricaoAosMunicipiosDaUf(comCampo, fato.codigo, uf.codigo) };
}

function recusaDoMunicipioSemUf(fato: FatoDoFormulario): string {
  return `Acrescente antes o campo de UF: “${fato.nome}” escolhe entre os municípios da UF respondida antes.`;
}

function comRestricaoAosMunicipiosDaUf(
  conteudo: ConteudoDoFormulario,
  fatoCodigo: string,
  uf: string,
): ConteudoDoFormulario {
  const item = (conteudo.itens ?? []).find((i) => i.fatoCodigo === fatoCodigo) as ItemDoFormulario;
  const restricoes = [{ tipo: RESTRICAO_MUNICIPIOS_DA_UF, fatos: [uf] }];
  return comItem(conteudo, { ...item, regras: { ...item.regras, restricoes } });
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
  const porCodigo = new Map(catalogo.map((fato) => [fato.codigo, fato]));
  return fatosAntesDoCampo(conteudo, fatoCodigo).flatMap((codigo) => {
    const fato = porCodigo.get(codigo);
    return fato !== undefined && ehUfDeRespostaUnica(fato) ? [fato] : [];
  });
}

function ehUfDeRespostaUnica(fato: FatoDoFormulario): boolean {
  return fato.fonteValores?.codigo === FONTE_UNIDADES_FEDERATIVAS && fato.cardinalidade.codigo !== MULTIVALORADO;
}

/** Os pressupostos, conhecidos antes de todo o formulário, e depois os itens anteriores ao campo, em ordem. */
function fatosAntesDoCampo(conteudo: ConteudoDoFormulario, fatoCodigo: string): readonly string[] {
  const ordem =
    (conteudo.itens ?? []).find((item) => item.fatoCodigo === fatoCodigo)?.ordem ?? Infinity;
  const anteriores = [...(conteudo.itens ?? [])]
    .filter((item) => item.ordem < ordem)
    .sort((a, b) => a.ordem - b.ordem)
    .map((item) => item.fatoCodigo);
  return [...(conteudo.pressupostos ?? []), ...anteriores];
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

function entradaEVizinha(
  conteudo: ConteudoDoFormulario,
  chave: ChaveDaEntrada,
  direcao: -1 | 1,
): TrocaComAVizinha<EntradaDaSecao> | null {
  const etapa = etapaDaEntrada(conteudo, chave);
  if (etapa === null || etapa === SECAO_DADOS_BASICOS) return null;
  const entradas = entradasDaSecao(conteudo, etapa);
  const indice = entradas.findIndex((entrada) => ehAEntrada(entrada, chave));
  const vizinha = indice >= 0 ? entradas[indice + direcao] : undefined;
  return vizinha === undefined ? null : { atual: entradas[indice], vizinha };
}

/** Se o item ou o grupo pode trocar de lugar com a entrada vizinha da mesma seção. */
export function podeMoverEntrada(
  conteudo: ConteudoDoFormulario,
  chave: ChaveDaEntrada,
  direcao: -1 | 1,
): boolean {
  return entradaEVizinha(conteudo, chave, direcao) !== null;
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
  const troca = entradaEVizinha(conteudo, chave, direcao);
  if (troca === null) return { ok: false, recusa: 'Não é possível mover nessa direção.' };
  return conferirOrdem(comEntradasTrocadas(conteudo, troca), nomes);
}

/** A entrada e a vizinha trocam de ordem; a renumeração fecha a numeração. */
function comEntradasTrocadas(
  conteudo: ConteudoDoFormulario,
  troca: TrocaComAVizinha<EntradaDaSecao>,
): ConteudoDoFormulario {
  return renumerar({
    ...conteudo,
    itens: (conteudo.itens ?? []).map((item) => comOrdemTrocada(item, troca)),
    grupos: (conteudo.grupos ?? []).map((grupo) => comOrdemTrocada(grupo, troca)),
  });
}

function comOrdemTrocada<T extends ItemDoFormulario | GrupoDoFormulario>(
  alvo: T,
  troca: TrocaComAVizinha<EntradaDaSecao>,
): T {
  const chave: ChaveDaEntrada =
    'fatoCodigo' in alvo
      ? { tipo: 'item', fatoCodigo: alvo.fatoCodigo }
      : { tipo: 'grupo', codigo: alvo.codigo };
  return { ...alvo, ordem: ordemDepoisDaTroca(troca, chave) ?? alvo.ordem };
}

function ordemDepoisDaTroca(
  troca: TrocaComAVizinha<EntradaDaSecao>,
  alvo: ChaveDaEntrada,
): number | undefined {
  if (ehAEntrada(troca.atual, alvo)) return ordemDa(troca.vizinha);
  return ehAEntrada(troca.vizinha, alvo) ? ordemDa(troca.atual) : undefined;
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
  const recusa = recusaDaRemocaoDoItem(conteudo, fatoCodigo, nomes);
  if (recusa !== null) return { ok: false, recusa };
  return {
    ok: true,
    conteudo: renumerar({
      ...conteudo,
      itens: (conteudo.itens ?? []).filter((i) => i.fatoCodigo !== fatoCodigo),
    }),
  };
}

function recusaDaRemocaoDoItem(
  conteudo: ConteudoDoFormulario,
  fatoCodigo: string,
  nomes: ReadonlyMap<string, string>,
): string | null {
  const quem = quemCita(conteudo, fatoCodigo).find((citante) => citante.fatoCodigo !== fatoCodigo);
  return quem === undefined
    ? null
    : `Não é possível remover “${nomeDoFato(nomes, fatoCodigo)}”: ${quem.descricao} cita esse campo.`;
}
