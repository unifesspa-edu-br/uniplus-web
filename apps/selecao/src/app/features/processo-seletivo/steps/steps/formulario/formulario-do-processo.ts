import type {
  DefinirFormularioRequest,
  DefinirItensDoFormularioRequest,
  DefinirTermosDoFormularioRequest,
  FatoColetadoDto,
  FormularioDto,
} from '@uniplus/shared-data/selecao';
import {
  conteudoInicial,
  etapasEmOrdem,
  FINALIDADE_INSCRICAO,
  semDadosBasicos,
  todosOsCampos,
  type ConteudoDoFormulario,
  type EtapaDoFormulario,
  type GrupoDoFormulario,
  type ItemDoFormulario,
  type PredicadoNoWire,
  type RestricaoDeValor,
  type TermoDoFormulario,
} from '@uniplus/shared-ui/components';

/**
 * O formulário de uma finalidade do processo entre a forma em que a API o devolve (`FormularioDto`,
 * dentro do processo) e a do editor (`ConteudoDoFormulario`, a das entradas da API). A leitura traz
 * a obrigatoriedade como objeto e campos só de exibição; a escrita os quer como token e predicado,
 * sem o que é do catálogo.
 */

type CondicoesDoDto = FatoColetadoDto['precondicao'];

function predicado(condicoes: CondicoesDoDto): PredicadoNoWire {
  return condicoes === null || condicoes.length === 0 ? null : condicoes;
}

function restricaoDoDto(restricao: FatoColetadoDto['restricoes'][number]): RestricaoDeValor {
  return {
    tipo: restricao.tipo,
    minimo: restricao.minimo,
    maximo: restricao.maximo,
    entradas: restricao.entradas?.map((entrada) => ({ quando: predicado(entrada.quando), valores: entrada.valores })) ?? null,
    fatos: restricao.fatos,
  };
}

function itemDoDto(fato: FatoColetadoDto): ItemDoFormulario {
  return {
    fatoCodigo: fato.fatoCodigo,
    ordem: Number(fato.ordem),
    rotulo: fato.rotulo,
    tipoRenderizacao: fato.tipoRenderizacao,
    obrigatoriedade: fato.obrigatoriedade.tipo,
    predicadoObrigatoriedade: predicado(fato.obrigatoriedade.predicado),
    precondicao: predicado(fato.precondicao),
    etapaCodigo: fato.etapaCodigo,
    ajuda: fato.ajuda,
    pedirConfirmacao: fato.pedirConfirmacao,
    restricoes: fato.restricoes.length === 0 ? null : fato.restricoes.map(restricaoDoDto),
    impedimento: fato.impedimento === null ? null : { quando: predicado(fato.impedimento.quando), mensagem: fato.impedimento.mensagem },
  };
}

/** O formulário do processo na forma do editor. O processo não tem pressuposto: as outras finalidades citam a inscrição. */
export function conteudoDoFormulario(dto: FormularioDto): ConteudoDoFormulario {
  return {
    titulo: dto.titulo,
    etapas: dto.etapas.map((etapa) => ({ ...etapa, ordem: Number(etapa.ordem), exibicao: predicado(etapa.exibicao) })),
    itens: dto.fatosColetados.map(itemDoDto),
    grupos: dto.grupos.map(
      (grupo): GrupoDoFormulario => ({
        codigo: grupo.codigo,
        ordem: Number(grupo.ordem),
        rotulo: grupo.rotulo,
        etapaCodigo: grupo.etapaCodigo,
        minimo: Number(grupo.minimo),
        maximo: grupo.maximo === null ? null : Number(grupo.maximo),
        exibicao: predicado(grupo.exibicao),
        obrigatoriedade: grupo.obrigatoriedade.tipo,
        predicadoObrigatoriedade: predicado(grupo.obrigatoriedade.predicado),
        subitens: grupo.subitens.map(itemDoDto),
        incluiCandidato: grupo.incluiCandidato,
      }),
    ),
    termos: dto.termos.map(
      (termo): TermoDoFormulario => ({
        codigo: termo.codigo,
        ordem: Number(termo.ordem),
        termoId: termo.termoId,
        versaoId: termo.versaoId,
        exibicao: predicado(termo.exibicao),
        obrigatoriedade: termo.obrigatoriedade.tipo,
        predicadoObrigatoriedade: predicado(termo.obrigatoriedade.predicado),
      }),
    ),
    pressupostos: [],
  };
}

/** O cabeçalho para o PUT: fase, título e etapas, sem a seção dos dados básicos, que a API repõe. */
export function cabecalhoParaEnvio(faseId: string, conteudo: ConteudoDoFormulario): DefinirFormularioRequest {
  return { faseId, titulo: conteudo.titulo, etapas: semDadosBasicos(conteudo).etapas ?? [] };
}

/**
 * Os itens e os grupos para o PUT, sem os dados básicos. `semSecao` tira a seção de todos — o
 * rascunho aceita item sem seção —, para gravar os itens antes de um cabeçalho que muda as seções.
 * `grupos` vai sempre como lista: nulo manteria os grupos gravados.
 */
export function itensParaEnvio(conteudo: ConteudoDoFormulario, semSecao = false): DefinirItensDoFormularioRequest {
  const enviado = semDadosBasicos(conteudo);
  return {
    itens: (enviado.itens ?? []).map((item) => (semSecao ? { ...item, etapaCodigo: null } : item)),
    grupos: (enviado.grupos ?? []).map((grupo) => (semSecao ? { ...grupo, etapaCodigo: null } : grupo)),
  };
}

export function termosParaEnvio(conteudo: ConteudoDoFormulario): DefinirTermosDoFormularioRequest {
  return { termos: conteudo.termos ?? [] };
}

/** Um passo da gravação de um formulário, na ordem em que a API o aceita. */
export type PassoDaGravacao = 'cabecalho' | 'itensSemSecao' | 'itens' | 'termos';

/** O formulário de uma finalidade como a gravação o compara: a fase pelo id e o conteúdo do editor. */
export interface FormularioParaGravar {
  readonly faseId: string | null;
  readonly conteudo: ConteudoDoFormulario;
}

const mesmo = (um: unknown, outro: unknown): boolean => JSON.stringify(um) === JSON.stringify(outro);

/** A etapa sem a posição: o que a distingue de si mesma noutro lugar. */
function semOrdem(etapa: EtapaDoFormulario): EtapaDoFormulario {
  return { ...etapa, ordem: 0 };
}

/**
 * Se a única mudança nas etapas foi acrescentar seções: as do servidor continuam todas, iguais e na
 * mesma ordem relativa. Aí o cabeçalho pode ir primeiro, porque os itens gravados continuam
 * dentro de seções que existem e na ordem delas.
 */
function soAcrescentouEtapas(servidor: ConteudoDoFormulario, desejado: ConteudoDoFormulario): boolean {
  const antes = etapasEmOrdem(semDadosBasicos(servidor));
  const depois = etapasEmOrdem(semDadosBasicos(desejado)).filter((etapa) => antes.some((a) => a.codigo === etapa.codigo));
  return antes.length === depois.length && antes.every((etapa, indice) => mesmo(semOrdem(etapa), semOrdem(depois[indice])));
}

/**
 * A ordem dos PUTs de uma finalidade. A API confere cada parte contra o que está gravado da outra
 * — o cabeçalho contra os itens gravados, os itens contra as etapas gravadas —, então reordenar ou
 * remover seção com itens não tem ordem simples que funcione. Nesse caso os itens vão antes sem
 * seção (o rascunho aceita), o cabeçalho depois, e os itens de novo com a seção. Só o que mudou em
 * relação ao servidor é enviado, cada parte comparada pelo mesmo mapeamento do envio.
 */
export function planoDeGravacao(servidor: FormularioParaGravar | null, desejado: FormularioParaGravar & { readonly faseId: string }): readonly PassoDaGravacao[] {
  const termosMudaram = !mesmo(termosParaEnvio(desejado.conteudo), servidor === null ? { termos: [] } : termosParaEnvio(servidor.conteudo));
  const comTermos = (passos: readonly PassoDaGravacao[]): readonly PassoDaGravacao[] => (termosMudaram ? [...passos, 'termos'] : passos);

  if (servidor === null) {
    const enviados = itensParaEnvio(desejado.conteudo);
    return comTermos(['cabecalho', ...(enviados.itens.length + (enviados.grupos ?? []).length > 0 ? (['itens'] as const) : [])]);
  }

  const cabecalhoMudou = !mesmo(cabecalhoParaEnvio(desejado.faseId, desejado.conteudo), cabecalhoParaEnvio(servidor.faseId ?? '', servidor.conteudo));
  const itensMudaram = !mesmo(itensParaEnvio(desejado.conteudo), itensParaEnvio(servidor.conteudo));
  const etapasMudaram = !mesmo(semDadosBasicos(desejado.conteudo).etapas, semDadosBasicos(servidor.conteudo).etapas);

  if (etapasMudaram && itensMudaram) {
    return comTermos(soAcrescentouEtapas(servidor.conteudo, desejado.conteudo) ? ['cabecalho', 'itens'] : ['itensSemSecao', 'cabecalho', 'itens']);
  }
  return comTermos([...(cabecalhoMudou ? (['cabecalho'] as const) : []), ...(itensMudaram ? (['itens'] as const) : [])]);
}

/** O formulário da finalidade, quando o processo o tem. */
export function formularioDaFinalidade(formularios: readonly FormularioDto[], finalidade: string): FormularioDto | null {
  return formularios.find((formulario) => formulario.finalidade === finalidade) ?? null;
}

/** Os fatos que o formulário coleta: os itens, os campos dos grupos e os próprios códigos dos grupos. */
export function fatosColetadosPor(conteudo: ConteudoDoFormulario): readonly string[] {
  return [...todosOsCampos(conteudo).map((campo) => campo.fatoCodigo), ...(conteudo.grupos ?? []).map((grupo) => grupo.codigo)];
}

/** Os fatos que os formulários das outras finalidades coletam no servidor. */
export function fatosDasOutrasFinalidades(formularios: readonly FormularioDto[], finalidade: string): readonly string[] {
  return [
    ...new Set(formularios.filter((formulario) => formulario.finalidade !== finalidade).flatMap((formulario) => fatosColetadosPor(conteudoDoFormulario(formulario)))),
  ];
}

/** A fase do cronograma em que a inscrição é respondida: a que coleta inscrição. */
export function faseDaInscricao<T extends { readonly coletaInscricao: boolean }>(fases: readonly T[]): T | null {
  return fases.find((fase) => fase.coletaInscricao) ?? null;
}

/** O processo como a leitura dos formulários o precisa: os formulários e as fases, para resolver a fase pelo código. */
export interface ProcessoComFormularios {
  readonly formularios: readonly FormularioDto[];
  readonly cronogramaFases: readonly { readonly id: string; readonly codigo: string }[];
}

/** O formulário do servidor na forma do rascunho: o conteúdo pelo mesmo mapeamento da gravação e a fase pelo código. */
export function formularioDoServidor(
  dto: ProcessoComFormularios,
  formulario: FormularioDto,
): { readonly finalidade: string; readonly faseCodigo: string; readonly conteudo: ConteudoDoFormulario } {
  const fase = formulario.faseId === null ? undefined : dto.cronogramaFases.find((f) => f.id === formulario.faseId);
  return { finalidade: formulario.finalidade, faseCodigo: fase?.codigo ?? '', conteudo: conteudoDoFormulario(formulario) };
}

/**
 * O formulário de inscrição do servidor, na forma do rascunho. Sem formulário de inscrição, o
 * conteúdo é o inicial — a revisão e aceite —, e a seção dos dados básicos chega com a criação.
 */
export function inscricaoDoServidor(dto: ProcessoComFormularios): { readonly faseCodigo: string; readonly conteudo: ConteudoDoFormulario } {
  const inscricao = formularioDaFinalidade(dto.formularios, FINALIDADE_INSCRICAO);
  if (inscricao === null) return { faseCodigo: '', conteudo: conteudoInicial() };
  const { faseCodigo, conteudo } = formularioDoServidor(dto, inscricao);
  return { faseCodigo, conteudo };
}
