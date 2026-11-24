import { type FatoColetadoDto, type FormularioDto } from '@uniplus/shared-data/selecao';
import { cabecalhoParaEnvio, itensParaEnvio, termosParaEnvio } from './codigos-do-formulario';
export { cabecalhoParaEnvio, itensParaEnvio, termosParaEnvio } from './codigos-do-formulario';
import {
  conteudoInicial,
  etapasEmOrdem,
  FINALIDADE_INSCRICAO,
  semDadosBasicos,
  todosOsCampos,
  type ConteudoDoFormulario,
  type EtapaDoFormulario,
  type ExibicaoEObrigatoriedade,
  type GrupoDoFormulario,
  type Impedimento,
  type ItemDoFormulario,
  type PredicadoNoWire,
  type RegrasDoCampo,
  type RestricaoDeValor,
  type TermoDoFormulario,
} from '@uniplus/shared-ui/components';

/**
 * O formulário de uma finalidade do processo entre a forma em que a API o devolve (`FormularioDto`,
 * dentro do processo) e a do editor (`ConteudoDoFormulario`, a das entradas da API). A leitura traz
 * a obrigatoriedade como objeto e campos só de exibição; a escrita os quer como token e predicado,
 * sem o que é do catálogo.
 */

type CondicoesDoDto = FatoColetadoDto['regras']['exibicao'];

function predicado(condicoes: CondicoesDoDto): PredicadoNoWire {
  return condicoes === null || condicoes.length === 0 ? null : condicoes;
}

type RestricaoDoDto = FatoColetadoDto['regras']['restricoes'][number];

function entradasDoDto(entradas: RestricaoDoDto['entradas']): RestricaoDeValor['entradas'] {
  return (
    entradas?.map((entrada) => ({
      quando: predicado(entrada.quando),
      valores: entrada.valores,
    })) ?? null
  );
}

function restricaoDoDto(restricao: RestricaoDoDto): RestricaoDeValor {
  return {
    tipo: restricao.tipo,
    minimo: restricao.minimo,
    maximo: restricao.maximo,
    entradas: entradasDoDto(restricao.entradas),
    fatos: restricao.fatos,
    dataMinima: restricao.dataMinima,
    dataMaxima: restricao.dataMaxima,
  };
}

type GrupoDoFormularioDto = FormularioDto['coleta']['grupos'][number];
type TermoDoFormularioDto = FormularioDto['termos'][number];
type EtapaDoFormularioDto = FormularioDto['etapas'][number];
type RegrasDoGrupoOuTermoDto = GrupoDoFormularioDto['regras'];

function regrasDoDto(regras: RegrasDoGrupoOuTermoDto): ExibicaoEObrigatoriedade {
  return {
    exibicao: predicado(regras.exibicao),
    obrigatoriedade: {
      tipo: regras.obrigatoriedade.tipo,
      predicado: predicado(regras.obrigatoriedade.predicado),
    },
  };
}

function regrasDoCampoDoDto(regras: FatoColetadoDto['regras']): RegrasDoCampo {
  return {
    ...regrasDoDto(regras),
    restricoes: regras.restricoes.length === 0 ? null : regras.restricoes.map(restricaoDoDto),
    impedimento: impedimentoDoDto(regras.impedimento),
  };
}

function itemDoDto(fato: FatoColetadoDto): ItemDoFormulario {
  const { apresentacao } = fato;
  return {
    fatoCodigo: fato.fatoCodigo,
    ordem: fato.ordem,
    etapaCodigo: fato.etapaCodigo,
    apresentacao: {
      rotulo: apresentacao.rotulo,
      tipoRenderizacao: apresentacao.tipoRenderizacao,
      ajuda: apresentacao.ajuda,
      pedirConfirmacao: apresentacao.pedirConfirmacao,
    },
    regras: regrasDoCampoDoDto(fato.regras),
  };
}

function impedimentoDoDto(
  impedimento: FatoColetadoDto['regras']['impedimento'],
): Impedimento | null {
  return impedimento === null
    ? null
    : { quando: predicado(impedimento.quando), mensagem: impedimento.mensagem };
}

function ocorrenciasDoDto(ocorrencias: GrupoDoFormularioDto['ocorrencias']) {
  return {
    minimo: ocorrencias.minimo,
    maximo: ocorrencias.maximo,
    incluiCandidato: ocorrencias.incluiCandidato,
  };
}

function grupoDoDto(grupo: GrupoDoFormularioDto): GrupoDoFormulario {
  return {
    codigo: grupo.codigo,
    ordem: grupo.ordem,
    rotulo: grupo.rotulo,
    etapaCodigo: grupo.etapaCodigo,
    ocorrencias: ocorrenciasDoDto(grupo.ocorrencias),
    regras: regrasDoDto(grupo.regras),
    subitens: grupo.subitens.map(itemDoDto),
  };
}

function termoDoDto(termo: TermoDoFormularioDto): TermoDoFormulario {
  return {
    codigo: termo.codigo,
    ordem: termo.ordem,
    termo: { termoId: termo.termo.termoId, versaoId: termo.termo.versaoId },
    regras: regrasDoDto(termo.regras),
  };
}

function etapaDoDto(etapa: EtapaDoFormularioDto): EtapaDoFormulario {
  const { apresentacao } = etapa;
  return {
    codigo: etapa.codigo,
    ordem: etapa.ordem,
    tipo: etapa.tipo,
    bloco: etapa.bloco,
    apresentacao: {
      titulo: apresentacao.titulo,
      descricao: apresentacao.descricao,
      aviso: apresentacao.aviso,
    },
    exibicao: predicado(etapa.exibicao),
  };
}

/** O formulário do processo na forma do editor. O processo não tem pressuposto: as outras finalidades citam a inscrição. */
export function conteudoDoFormulario(dto: FormularioDto): ConteudoDoFormulario {
  return {
    titulo: dto.titulo,
    etapas: dto.etapas.map(etapaDoDto),
    itens: dto.coleta.itens.map(itemDoDto),
    grupos: dto.coleta.grupos.map(grupoDoDto),
    termos: dto.termos.map(termoDoDto),
    pressupostos: [],
  };
}

/** Um passo da gravação de um formulário, na ordem em que a API o aceita. */
export type PassoDaGravacao = 'cabecalho' | 'itensSemSecao' | 'itens' | 'termos';

/** O formulário de uma finalidade como a gravação o compara: a fase pelo id e o conteúdo do editor. */
export interface FormularioParaGravar {
  readonly faseId: string | null;
  readonly conteudo: ConteudoDoFormulario;
}

const mesmo = (um: unknown, outro: unknown): boolean =>
  JSON.stringify(um) === JSON.stringify(outro);

/** A etapa sem a posição: o que a distingue de si mesma noutro lugar. */
function semOrdem(etapa: EtapaDoFormulario): EtapaDoFormulario {
  return { ...etapa, ordem: 0 };
}

/**
 * Se a única mudança nas etapas foi acrescentar seções: as do servidor continuam todas, iguais e na
 * mesma ordem relativa. Aí o cabeçalho pode ir primeiro, porque os itens gravados continuam
 * dentro de seções que existem e na ordem delas.
 */
function soAcrescentouEtapas(
  servidor: ConteudoDoFormulario,
  desejado: ConteudoDoFormulario,
): boolean {
  const antes = etapasEmOrdem(semDadosBasicos(servidor));
  const depois = etapasEmOrdem(semDadosBasicos(desejado)).filter((etapa) =>
    antes.some((a) => a.codigo === etapa.codigo),
  );
  return (
    antes.length === depois.length &&
    antes.every((etapa, indice) => mesmo(semOrdem(etapa), semOrdem(depois[indice])))
  );
}

/**
 * A ordem dos PUTs de uma finalidade. A API confere cada parte contra o que está gravado da outra
 * — o cabeçalho contra os itens gravados, os itens contra as etapas gravadas —, então reordenar ou
 * remover seção com itens não tem ordem simples que funcione. Nesse caso os itens vão antes sem
 * seção (o rascunho aceita), o cabeçalho depois, e os itens de novo com a seção. Só o que mudou em
 * relação ao servidor é enviado, cada parte comparada pelo mesmo mapeamento do envio.
 */
export function planoDeGravacao(
  servidor: FormularioParaGravar | null,
  desejado: FormularioComFase,
): readonly PassoDaGravacao[] {
  const passos =
    servidor === null
      ? passosDaPrimeiraGravacao(desejado)
      : passosDeAtualizacao(servidor, desejado);
  const termosMudaram = !mesmo(
    termosParaEnvio(desejado.conteudo),
    servidor === null ? { termos: [] } : termosParaEnvio(servidor.conteudo),
  );
  return termosMudaram ? [...passos, 'termos'] : passos;
}

function passosDaPrimeiraGravacao(desejado: FormularioParaGravar): readonly PassoDaGravacao[] {
  const enviados = itensParaEnvio(desejado.conteudo);
  const temItens = enviados === null || enviados.itens.length + (enviados.grupos ?? []).length > 0;
  return temItens ? ['cabecalho', 'itens'] : ['cabecalho'];
}

type FormularioComFase = FormularioParaGravar & { readonly faseId: string };

function cabecalhoMudou(servidor: FormularioParaGravar, desejado: FormularioComFase): boolean {
  return !mesmo(
    cabecalhoParaEnvio(desejado.faseId, desejado.conteudo),
    cabecalhoParaEnvio(servidor.faseId ?? '', servidor.conteudo),
  );
}

function etapasMudaram(servidor: FormularioParaGravar, desejado: FormularioComFase): boolean {
  return !mesmo(
    semDadosBasicos(desejado.conteudo).etapas,
    semDadosBasicos(servidor.conteudo).etapas,
  );
}

function passosDeAtualizacao(
  servidor: FormularioParaGravar,
  desejado: FormularioComFase,
): readonly PassoDaGravacao[] {
  const itensMudaram = !mesmo(itensParaEnvio(desejado.conteudo), itensParaEnvio(servidor.conteudo));
  if (etapasMudaram(servidor, desejado) && itensMudaram) {
    return soAcrescentouEtapas(servidor.conteudo, desejado.conteudo)
      ? ['cabecalho', 'itens']
      : ['itensSemSecao', 'cabecalho', 'itens'];
  }
  return [
    ...(cabecalhoMudou(servidor, desejado) ? (['cabecalho'] as const) : []),
    ...(itensMudaram ? (['itens'] as const) : []),
  ];
}

/** O formulário da finalidade, quando o processo o tem. */
export function formularioDaFinalidade(
  formularios: readonly FormularioDto[],
  finalidade: string,
): FormularioDto | null {
  return formularios.find((formulario) => formulario.finalidade.codigo === finalidade) ?? null;
}

/** Os fatos que o formulário coleta: os itens, os campos dos grupos e os próprios códigos dos grupos. */
export function fatosColetadosPor(conteudo: ConteudoDoFormulario): readonly string[] {
  return [
    ...todosOsCampos(conteudo).map((campo) => campo.fatoCodigo),
    ...(conteudo.grupos ?? []).map((grupo) => grupo.codigo),
  ];
}

/** Os fatos que os formulários das outras finalidades coletam no servidor. */
export function fatosDasOutrasFinalidades(
  formularios: readonly FormularioDto[],
  finalidade: string,
): readonly string[] {
  return [
    ...new Set(
      formularios
        .filter((formulario) => formulario.finalidade.codigo !== finalidade)
        .flatMap((formulario) => fatosColetadosPor(conteudoDoFormulario(formulario))),
    ),
  ];
}

/** A fase do cronograma em que a inscrição é respondida: a que coleta inscrição. */
export function faseDaInscricao<T extends { readonly coletaInscricao: boolean }>(
  fases: readonly T[],
): T | null {
  return fases.find((fase) => fase.coletaInscricao) ?? null;
}

/** O processo como a leitura dos formulários o precisa: os formulários e as fases, para resolver a fase pelo código. */
export interface ProcessoComFormularios {
  readonly formularios: readonly FormularioDto[];
  readonly cronogramaFases: readonly { readonly id: string; readonly codigo: string }[];
}

/** O formulário do servidor na forma do rascunho: o conteúdo pelo mesmo mapeamento da gravação e a fase pelo código. */
export interface FormularioDoServidor {
  readonly finalidade: string;
  readonly faseCodigo: string;
  readonly conteudo: ConteudoDoFormulario;
  readonly modeloOrigemCodigo: string | null;
}

export function formularioDoServidor(
  dto: ProcessoComFormularios,
  formulario: FormularioDto,
): FormularioDoServidor {
  const fase = dto.cronogramaFases.find((f) => f.id === formulario.faseId);
  return {
    finalidade: formulario.finalidade.codigo,
    faseCodigo: fase?.codigo ?? '',
    conteudo: conteudoDoFormulario(formulario),
    modeloOrigemCodigo: formulario.modeloOrigem?.codigo ?? null,
  };
}

/**
 * O formulário de inscrição do servidor, na forma do rascunho. Sem formulário de inscrição, o
 * conteúdo é o inicial — a revisão e aceite —, e a seção dos dados básicos chega com a criação.
 */
export function inscricaoDoServidor(
  dto: ProcessoComFormularios,
): Omit<FormularioDoServidor, 'finalidade'> {
  const inscricao = formularioDaFinalidade(dto.formularios, FINALIDADE_INSCRICAO);
  if (inscricao === null)
    return { faseCodigo: '', conteudo: conteudoInicial(), modeloOrigemCodigo: null };
  const { faseCodigo, conteudo, modeloOrigemCodigo } = formularioDoServidor(dto, inscricao);
  return { faseCodigo, conteudo, modeloOrigemCodigo };
}

/**
 * Se os formulários do rascunho diferem dos gravados no que a gravação enviaria — conteúdo, e
 * formulário acrescentado ou removido. A fase fica de fora: não muda o que uma simulação avalia.
 */
export function rascunhoDifereDoGravado(
  gravados: readonly FormularioDto[],
  rascunho: readonly { readonly finalidade: string; readonly conteudo: ConteudoDoFormulario }[],
): boolean {
  if (gravados.length !== rascunho.length) return true;
  return rascunho.some(({ finalidade, conteudo }) => {
    const gravado = formularioDaFinalidade(gravados, finalidade);
    return gravado === null || gravacaoMudaria(gravado, conteudo);
  });
}

function gravacaoMudaria(gravado: FormularioDto, conteudo: ConteudoDoFormulario): boolean {
  const servidor = { faseId: '', conteudo: conteudoDoFormulario(gravado) };
  return planoDeGravacao(servidor, { faseId: '', conteudo }).length > 0;
}
