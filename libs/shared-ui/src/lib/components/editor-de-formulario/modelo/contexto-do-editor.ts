import {
  fatosEscolhiveis,
  nomesDoCatalogo,
  type FatoEscolhivel,
} from '../../editor-de-condicoes/condicoes-de-fatos';
import { fatosDeMembroParaAcrescentar, fatosParaAcrescentar } from './catalogo-de-campos';
import {
  comFatosConhecidosAntes,
  fatosCitaveisPelaSecao,
  fatosCitaveisPeloItem,
  fatosCitaveisPelosTermos,
  fatosOferecidos,
  fatosQueExigemResposta,
  predicadosSobreRespostasAnteriores,
} from './citacoes';
import { FINALIDADE_INSCRICAO, LIMITES_DO_FORMULARIO } from './constantes';
import { quantidadeNoTeto } from './grupos';
import { impedimentoCabe } from './impedimento';
import { ufsAnteriores } from './itens';
import { type RecusasDoConteudo } from './recusas';
import { fontesDasOpcoes } from './restricoes-de-valor';
import {
  ESCOPO_CANDIDATO,
  type ConteudoDoFormulario,
  type FatoDoFormulario,
  type ItemDoFormulario,
  type PredicadoNoWire,
  type TermoDisponivel,
} from './tipos';

/** O que o editor recebe do hospedeiro e de que depende tudo o que ele mostra. */
export interface EntradasDoEditor {
  readonly conteudo: ConteudoDoFormulario;
  readonly catalogo: readonly FatoDoFormulario[];
  readonly finalidade: string;
  readonly idBase: string;
  readonly disabled: boolean;
  readonly recusas: RecusasDoConteudo | null;
  readonly termosDisponiveis: readonly TermoDisponivel[];
  readonly fatosDaInscricao: readonly string[] | null;
  readonly fatosIndisponiveis: readonly string[];
  readonly fatosQueExigemRespostaPorFora: readonly string[];
  readonly remocoesTravadas: ReadonlyMap<string, string>;
  /** As condições citam município só quando o hospedeiro provê a busca de onde sai o valor. */
  readonly comMunicipios: boolean;
}

/** O que o campo precisa para as regras sobre a própria resposta. */
export interface RegrasProprias {
  readonly valoresConhecidos: readonly string[];
  readonly fontesDeOpcoes: readonly { readonly codigo: string; readonly nome: string }[];
  readonly ufs: readonly { readonly codigo: string; readonly nome: string }[];
  readonly impedimentoPermitido: boolean;
  readonly fatosDoImpedimento: readonly FatoEscolhivel[];
}

/** As entradas do editor e o que se deriva delas, calculado uma vez por mudança. */
export interface ContextoDoEditor extends EntradasDoEditor {
  /** O conteúdo com os fatos da inscrição conhecidos antes de tudo; serve só às citações e nunca é gravado. */
  readonly conteudoParaCitacoes: ConteudoDoFormulario;
  /** O que este formulário não pode coletar: o que outra finalidade coleta e, fora da inscrição, todo fato da inscrição. */
  readonly naoColetaveisAqui: readonly string[];
  readonly nomes: ReadonlyMap<string, string>;
  readonly exigemResposta: ReadonlySet<string>;
  readonly desativados: ReadonlySet<string>;
  readonly paraAcrescentar: readonly FatoDoFormulario[];
  readonly fatosDeMembro: readonly FatoDoFormulario[];
  readonly noTeto: boolean;
  readonly fatosDoItem: ReadonlyMap<string, readonly FatoEscolhivel[]>;
  readonly regrasProprias: ReadonlyMap<string, RegrasProprias>;
  readonly fatosDaSecao: ReadonlyMap<string, readonly FatoEscolhivel[]>;
  readonly fatosDosTermos: readonly FatoEscolhivel[];
}

export function contextoDoEditor(entradas: EntradasDoEditor): ContextoDoEditor {
  const conteudoParaCitacoes = conteudoParaCitar(entradas);
  const escolhiveis: Escolhiveis = (citaveis, predicados) =>
    fatosOferecidos(entradas.catalogo, citaveis, predicados, entradas.comMunicipios);
  const fatosDoItem = fatosQueOItemPodeCitar(conteudoParaCitacoes, escolhiveis);
  return {
    ...entradas,
    ...fatosDoFormulario(entradas),
    conteudoParaCitacoes,
    nomes: nomesDoCatalogo(entradas.catalogo),
    fatosDoItem,
    regrasProprias: regrasPropriasDosCampos({ entradas, conteudoParaCitacoes, fatosDoItem }),
    fatosDaSecao: fatosQueASecaoPodeCitar(conteudoParaCitacoes, escolhiveis),
    fatosDosTermos: escolhiveis(
      fatosCitaveisPelosTermos(conteudoParaCitacoes),
      (conteudoParaCitacoes.termos ?? []).flatMap((termo) => [
        termo.exibicao,
        termo.predicadoObrigatoriedade,
      ]),
    ),
  };
}

function fatosDoFormulario(entradas: EntradasDoEditor) {
  const naoColetaveisAqui = fatosNaoColetaveisAqui(entradas);
  const { conteudo, catalogo } = entradas;
  return {
    naoColetaveisAqui,
    exigemResposta: new Set([
      ...fatosQueExigemResposta(conteudo),
      ...entradas.fatosQueExigemRespostaPorFora,
    ]),
    desativados: new Set(catalogo.filter((fato) => !fato.ativo).map((fato) => fato.codigo)),
    paraAcrescentar: fatosParaAcrescentar(conteudo, catalogo, ESCOPO_CANDIDATO, naoColetaveisAqui),
    fatosDeMembro: fatosDeMembroParaAcrescentar(conteudo, catalogo, naoColetaveisAqui),
    noTeto: quantidadeNoTeto(conteudo) >= LIMITES_DO_FORMULARIO.itens,
  };
}

type Escolhiveis = (
  citaveis: ReadonlySet<string>,
  predicados: readonly PredicadoNoWire[],
) => readonly FatoEscolhivel[];

function fatosNaoColetaveisAqui(entradas: EntradasDoEditor): readonly string[] {
  return [
    ...entradas.fatosIndisponiveis,
    ...(entradas.finalidade === FINALIDADE_INSCRICAO ? [] : (entradas.fatosDaInscricao ?? [])),
  ];
}

/**
 * Na própria inscrição os fatos dela têm posição: torná-los conhecidos antes deixaria um campo
 * citar outro que vem depois. Fora dela, só os fatos do candidato — o de membro existe uma vez por
 * ocorrência do grupo e não tem valor fora dele.
 */
function conteudoParaCitar(entradas: EntradasDoEditor): ConteudoDoFormulario {
  if (entradas.finalidade === FINALIDADE_INSCRICAO) return entradas.conteudo;
  const doCandidato = new Set(
    entradas.catalogo.filter((fato) => fato.escopo === ESCOPO_CANDIDATO).map((fato) => fato.codigo),
  );
  const conhecidos = (entradas.fatosDaInscricao ?? []).filter((codigo) => doCandidato.has(codigo));
  return comFatosConhecidosAntes(entradas.conteudo, conhecidos);
}

/** Os fatos que as condições de cada item podem citar, e os que ele já cita — para a condição gravada aparecer. */
function fatosQueOItemPodeCitar(
  conteudo: ConteudoDoFormulario,
  escolhiveis: Escolhiveis,
): ReadonlyMap<string, readonly FatoEscolhivel[]> {
  return new Map(
    (conteudo.itens ?? []).map((item) => [
      item.fatoCodigo,
      escolhiveis(
        fatosCitaveisPeloItem(conteudo, item.fatoCodigo),
        predicadosSobreRespostasAnteriores(item),
      ),
    ]),
  );
}

function fatosQueASecaoPodeCitar(
  conteudo: ConteudoDoFormulario,
  escolhiveis: Escolhiveis,
): ReadonlyMap<string, readonly FatoEscolhivel[]> {
  return new Map(
    (conteudo.etapas ?? []).map((etapa) => [
      etapa.codigo,
      escolhiveis(fatosCitaveisPelaSecao(conteudo, etapa.codigo), [etapa.exibicao ?? null]),
    ]),
  );
}

/**
 * O que cada item precisa para as regras sobre a própria resposta: os valores que as opções
 * permitidas marcam, os campos anteriores de onde as opções podem vir, as UFs de onde o município
 * tira a lista, e se cabe o impedimento — com os fatos que a condição dele cita, o próprio campo
 * primeiro, para a alternativa nova nascer com ele.
 */
function regrasPropriasDosCampos(base: BaseDasRegras): ReadonlyMap<string, RegrasProprias> {
  const { entradas, conteudoParaCitacoes } = base;
  const escolhiveis = new Map(
    fatosEscolhiveis(entradas.catalogo, new Map(), [], entradas.comMunicipios).map((fato) => [
      fato.codigo,
      fato,
    ]),
  );
  return new Map(
    (conteudoParaCitacoes.itens ?? []).map((item) => [
      item.fatoCodigo,
      regrasPropriasDo(base, item, escolhiveis.get(item.fatoCodigo)),
    ]),
  );
}

interface BaseDasRegras {
  readonly entradas: EntradasDoEditor;
  readonly conteudoParaCitacoes: ConteudoDoFormulario;
  readonly fatosDoItem: ReadonlyMap<string, readonly FatoEscolhivel[]>;
}

function regrasPropriasDo(
  base: BaseDasRegras,
  item: ItemDoFormulario,
  proprio: FatoEscolhivel | undefined,
): RegrasProprias {
  const { entradas, conteudoParaCitacoes: conteudo } = base;
  const anteriores = (base.fatosDoItem.get(item.fatoCodigo) ?? []).filter(
    (fato) => fato.codigo !== item.fatoCodigo,
  );
  const codigoENome = (fato: { codigo: string; nome: string }) => ({
    codigo: fato.codigo,
    nome: fato.nome,
  });
  return {
    valoresConhecidos: proprio?.tipoDominio === 'CATEGORICO_ESTATICO' ? proprio.valores : [],
    fontesDeOpcoes: fontesDasOpcoes(
      entradas.catalogo,
      fatosCitaveisPeloItem(conteudo, item.fatoCodigo),
      item.fatoCodigo,
    ).map(codigoENome),
    ufs: ufsAnteriores(conteudo, entradas.catalogo, item.fatoCodigo).map(codigoENome),
    impedimentoPermitido: impedimentoCabe(
      entradas.finalidade,
      item.tipoRenderizacao,
      proprio !== undefined,
    ),
    fatosDoImpedimento: proprio === undefined ? anteriores : [proprio, ...anteriores],
  };
}
