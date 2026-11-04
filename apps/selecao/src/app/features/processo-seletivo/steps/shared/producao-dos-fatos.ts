import type { FaseCanonicaDto } from '@uniplus/shared-data/configuracao';
import {
  ESCOPO_MEMBRO,
  FINALIDADE_INSCRICAO,
  ehColetavel,
  todosOsCampos,
  type FatoDoFormulario,
} from '@uniplus/shared-ui/components';

import type { FaseDoCronograma, FormularioDeInscricao } from '../processo-seletivo.models';
import { finalidadesDaFase } from './descricao-da-fase';
import { finalidadeDaExigencia } from './exigencias/formulario-da-exigencia';
import { fatosCitadosPelaDerivacao } from '../steps/formulario/citantes-no-processo';
import { fatosColetadosPelaInscricao } from '../steps/formulario/fatos-coletados-da-inscricao';
import {
  FINALIDADE_ISENCAO_TAXA,
  formulariosDoRascunho,
} from '../steps/formulario/formularios-por-finalidade';

/**
 * Em que fase do cronograma um fato do candidato fica conhecido no processo, e o que isso proíbe
 * ao gatilho de uma exigência documental (UNI-REQ-0144, UNI-REQ-0077): nenhum documento é pedido
 * antes de o fato que o condiciona ser conhecido.
 *
 * É a mesma regra que o servidor confere ao gravar as exigências e ao publicar: o fato fica
 * conhecido na mais tardia entre a fase em que o catálogo o situa, a fase do formulário que o
 * coleta e a das dependências dele — os fatos citados pela regra de derivação, ou o fato de membro
 * do agregado sobre grupo repetível. O fato coletado só pelo formulário de isenção vale apenas em
 * documento do formulário de isenção: inscrição e isenção podem dividir a fase, e por isso a regra
 * olha o formulário da exigência, e não a fase.
 *
 * O fato coletável que nenhum formulário coleta conta como coletado pela inscrição: é lá que o
 * passo do cronograma o acrescenta antes de gravar as exigências que o citam.
 */

/** O prefixo do vínculo do agregado sobre grupo repetível; o sufixo é o fato de membro. */
const VINCULO_AGREGACAO = 'AGREGACAO_GRUPO:';
const VINCULO_REGRA_DERIVACAO = 'REGRA_DERIVACAO:';
const VINCULO_INTEGRACAO = 'INTEGRACAO:';

/** Um fato do catálogo com a fase canônica em que ele fica conhecido. */
export interface FatoComFase extends FatoDoFormulario {
  readonly pontoResolucao: string;
}

/** Uma fase do cronograma do processo, na posição que ela ocupa nele. */
export interface FaseNoCronograma {
  readonly codigo: string;
  readonly ordem: number;
  /** As finalidades cujo formulário se responde nela (`finalidadesQueAtende`). */
  readonly finalidades: readonly string[];
}

/** As fases do cronograma na posição de cada uma, com os formulários que nela se respondem. */
export function fasesNoCronograma(
  fases: readonly FaseDoCronograma[],
  fasePorId: ReadonlyMap<string, FaseCanonicaDto>,
): readonly FaseNoCronograma[] {
  return fases.map((fase) => ({
    codigo: fase.codigo,
    ordem: fase.ordem,
    finalidades: finalidadesDaFase(fase, fasePorId),
  }));
}

/** Onde a exigência é cobrada: a fase e o formulário em que o candidato apresenta o documento. */
export interface LugarDaExigencia {
  readonly faseCodigo: string;
  /** O formulário declarado; o que vale sai da fase, por `finalidadeDaExigencia`. */
  readonly finalidade: string | null;
}

/** Um formulário do processo: a finalidade, a fase em que é respondido e os fatos que coleta. */
export interface FormularioQueColeta {
  readonly finalidade: string;
  readonly faseCodigo: string;
  readonly fatos: ReadonlySet<string>;
}

/** Um grupo repetível de um formulário do processo: as ocorrências pelas quais um documento pode se repetir. */
export interface GrupoDaProducao {
  readonly codigo: string;
  readonly rotulo: string;
  /** Os fatos de membro que o grupo coleta em cada ocorrência. */
  readonly campos: readonly string[];
}

/** O que decide a fase de cada fato no processo. */
export interface ProducaoDosFatos {
  readonly fases: readonly FaseNoCronograma[];
  readonly formularios: readonly FormularioQueColeta[];
  /** Os fatos de que cada fato derivado por regra do processo depende, pelo código do derivado. */
  readonly derivacoes: ReadonlyMap<string, readonly string[]>;
  readonly catalogo: ReadonlyMap<string, FatoComFase>;
  /** Os grupos repetíveis dos formulários do processo, pelo código, que é único no processo. */
  readonly grupos: ReadonlyMap<string, GrupoDaProducao>;
}

/** Por que o gatilho de uma exigência não pode citar o fato na fase dela. */
export type RecusaDeFase =
  /** O fato, ou um de que ele depende (`origem`), é conhecido numa fase que o cronograma não tem. */
  | {
      readonly tipo: 'FASE_FORA_DO_CRONOGRAMA';
      readonly fato: string;
      readonly origem: string;
      readonly faseCodigo: string;
    }
  /** O fato só é conhecido numa fase posterior à da exigência. */
  | { readonly tipo: 'FASE_POSTERIOR'; readonly fato: string; readonly faseCodigo: string }
  /** O fato vem do formulário de isenção, e o documento é de outro formulário. */
  | { readonly tipo: 'SO_DA_ISENCAO'; readonly fato: string; readonly faseCodigo: string };

/** O que o processo do rascunho diz sobre a produção de cada fato. */
export function producaoDoRascunho(
  formulario: FormularioDeInscricao,
  fases: readonly FaseNoCronograma[],
  catalogo: readonly FatoComFase[],
): ProducaoDosFatos {
  return {
    fases,
    formularios: formulariosDoRascunho(formulario).map((daFinalidade) => ({
      finalidade: daFinalidade.finalidade,
      faseCodigo: daFinalidade.faseCodigo,
      fatos:
        daFinalidade.finalidade === FINALIDADE_INSCRICAO
          ? fatosColetadosPelaInscricao(daFinalidade.conteudo)
          : new Set(todosOsCampos(daFinalidade.conteudo).map((campo) => campo.fatoCodigo)),
    })),
    derivacoes: derivacoesDoRascunho(formulario),
    catalogo: new Map(catalogo.map((fato) => [fato.codigo, fato])),
    grupos: gruposDoRascunho(formulario),
  };
}

function derivacoesDoRascunho(formulario: FormularioDeInscricao): ProducaoDosFatos['derivacoes'] {
  return new Map(
    formulario.derivacao.map((config) => [
      config.codigoFato,
      fatosCitadosPelaDerivacao(config.regras).filter((fato) => fato !== config.codigoFato),
    ]),
  );
}

function gruposDoRascunho(formulario: FormularioDeInscricao): ProducaoDosFatos['grupos'] {
  return new Map(
    formulariosDoRascunho(formulario).flatMap((daFinalidade) =>
      (daFinalidade.conteudo.grupos ?? []).map((grupo): [string, GrupoDaProducao] => [
        grupo.codigo,
        {
          codigo: grupo.codigo,
          rotulo: grupo.rotulo,
          campos: grupo.subitens.map((campo) => campo.fatoCodigo),
        },
      ]),
    ),
  );
}

/**
 * Se o processo resolve o fato para o candidato: o campo de formulário, coletado ou que a
 * inscrição passa a coletar; o derivado por regra que o processo declara; o agregado cujo fato de
 * membro algum formulário coleta; o que o sistema calcula do candidato e o que a classificação
 * produz. O fato de integração não tem quem o produza.
 */
export function oProcessoResolve(fato: FatoComFase, producao: ProducaoDosFatos): boolean {
  if (fato.binding.startsWith(VINCULO_REGRA_DERIVACAO)) return producao.derivacoes.has(fato.codigo);
  if (fato.binding.startsWith(VINCULO_INTEGRACAO)) return false;

  const membro = membroDoAgregado(fato);
  return membro === null || formularioQueColeta(membro, producao) !== null;
}

/**
 * Por que o gatilho de uma exigência não pode citar o fato onde ela é cobrada, ou `null` quando
 * pode. A fase fora do cronograma e o formulário que falta não são recusados aqui: a recusa que
 * orienta é a da própria exigência, que a conferência dela e o campo do formulário dizem.
 */
export function recusaDeFaseDoGatilho(
  fato: string,
  lugar: LugarDaExigencia,
  producao: ProducaoDosFatos,
): RecusaDeFase | null {
  const daExigencia = producao.fases.find((fase) => fase.codigo === lugar.faseCodigo);
  if (daExigencia === undefined) return null;
  const formulario = finalidadeDaExigencia(lugar.finalidade, daExigencia.finalidades);
  if (formulario.situacao !== 'DEFINIDO') return null;
  const { finalidade } = formulario;

  const efetiva = faseEfetiva(fato, producao, new Set());
  if ('foraDoCronograma' in efetiva) {
    return { tipo: 'FASE_FORA_DO_CRONOGRAMA', fato, ...efetiva.foraDoCronograma };
  }
  if (efetiva.fase !== null && efetiva.fase.ordem > daExigencia.ordem) {
    return { tipo: 'FASE_POSTERIOR', fato, faseCodigo: efetiva.fase.codigo };
  }

  const isencao = producao.formularios.find(
    (formulario) => formulario.finalidade === FINALIDADE_ISENCAO_TAXA,
  );
  if (
    isencao !== undefined &&
    finalidade !== FINALIDADE_ISENCAO_TAXA &&
    dependeSoDaIsencao(fato, isencao, producao, new Set())
  ) {
    return { tipo: 'SO_DA_ISENCAO', fato, faseCodigo: isencao.faseCodigo };
  }

  return null;
}

/** Por que um documento não pode se repetir pelo grupo nomeado onde ele é cobrado. */
export type RecusaDaRepeticao =
  /** Nenhum formulário do processo tem o grupo. */
  | { readonly tipo: 'GRUPO_INEXISTENTE'; readonly grupo: string }
  /** O grupo existe, mas é respondido depois da fase do documento, ou só na isenção. */
  | {
      readonly tipo: 'GRUPO_FORA_DO_LUGAR';
      readonly grupo: GrupoDaProducao;
      readonly recusa: RecusaDeFase;
    };

/**
 * Por que o documento cobrado em `lugar` não pode se repetir pelo grupo de código dado, ou `null`
 * quando pode. É a regra com que o servidor confere a repetição (ADR-0138): cada campo do grupo
 * precisa ser conhecido na fase e no formulário do documento. O servidor faz essa conferência sem
 * o catálogo — o lugar em que o catálogo situa o fato de membro é conferido nos gatilhos que o
 * citam —, e por isso ela é feita aqui com o catálogo vazio, para não recusar o que ele aceita.
 */
export function recusaDaRepeticao(
  codigo: string,
  lugar: LugarDaExigencia,
  producao: ProducaoDosFatos,
): RecusaDaRepeticao | null {
  const grupo = producao.grupos.get(codigo);
  if (grupo === undefined) return { tipo: 'GRUPO_INEXISTENTE', grupo: codigo };

  const semCatalogo = { ...producao, catalogo: new Map() };
  for (const campo of grupo.campos) {
    const recusa = recusaDeFaseDoGatilho(campo, lugar, semCatalogo);
    if (recusa !== null) return { tipo: 'GRUPO_FORA_DO_LUGAR', grupo, recusa };
  }
  return null;
}

/** Os campos que o gatilho cita além dos do candidato quando o documento se repete pelo grupo dado. */
export function camposDaRepeticao(
  codigo: string | null,
  producao: ProducaoDosFatos,
): ReadonlySet<string> {
  return new Set(codigo === null ? [] : (producao.grupos.get(codigo)?.campos ?? []));
}

/** Se o fato é de membro de grupo repetível: só o gatilho de documento repetido pelo grupo o cita. */
export function ehCampoDeMembro(fato: Pick<FatoDoFormulario, 'escopo'>): boolean {
  return fato.escopo === ESCOPO_MEMBRO;
}

type FaseEfetiva =
  | { readonly fase: FaseNoCronograma | null }
  | { readonly foraDoCronograma: { readonly origem: string; readonly faseCodigo: string } };

function faseEfetiva(
  fato: string,
  producao: ProducaoDosFatos,
  emAvaliacao: Set<string>,
): FaseEfetiva {
  const proprias = fasesProprias(fato, producao);
  if ('foraDoCronograma' in proprias) return proprias;

  const fases = [...proprias.fases];
  if (!emAvaliacao.has(fato)) {
    emAvaliacao.add(fato);
    for (const dependencia of dependenciasDoFato(fato, producao)) {
      const daDependencia = faseEfetiva(dependencia, producao, emAvaliacao);
      if ('foraDoCronograma' in daDependencia) return daDependencia;
      if (daDependencia.fase !== null) fases.push(daDependencia.fase);
    }
  }
  return { fase: maisTardia(fases) };
}

/** A fase do ponto de resolução do fato e a do formulário que o coleta. */
function fasesProprias(
  fato: string,
  producao: ProducaoDosFatos,
):
  | { readonly fases: readonly FaseNoCronograma[] }
  | Extract<FaseEfetiva, { foraDoCronograma: unknown }> {
  const fases: FaseNoCronograma[] = [];
  const ponto = producao.catalogo.get(fato)?.pontoResolucao;
  if (ponto !== undefined) {
    const doPonto = producao.fases.find((fase) => fase.codigo === ponto);
    if (doPonto === undefined) return { foraDoCronograma: { origem: fato, faseCodigo: ponto } };
    fases.push(doPonto);
  }

  const coletor = formularioQueColeta(fato, producao);
  const doColetor =
    coletor === null
      ? undefined
      : producao.fases.find((fase) => fase.codigo === coletor.faseCodigo);
  if (doColetor !== undefined) fases.push(doColetor);
  return { fases };
}

/** A de maior ordem; na igualdade, a primeira. */
function maisTardia(fases: readonly FaseNoCronograma[]): FaseNoCronograma | null {
  return fases.reduce<FaseNoCronograma | null>(
    (tardia, fase) => (tardia === null || fase.ordem > tardia.ordem ? fase : tardia),
    null,
  );
}

/**
 * O formulário que coleta o fato; para o coletável que nenhum coleta, a inscrição, que passa a
 * coletá-lo quando um gatilho o cita.
 */
export function formularioQueColeta(
  fato: string,
  producao: ProducaoDosFatos,
): FormularioQueColeta | null {
  const coletor = producao.formularios.find((formulario) => formulario.fatos.has(fato));
  if (coletor !== undefined) return coletor;

  const doCatalogo = producao.catalogo.get(fato);
  return doCatalogo !== undefined && ehColetavel(doCatalogo)
    ? (producao.formularios.find((formulario) => formulario.finalidade === FINALIDADE_INSCRICAO) ??
        null)
    : null;
}

function dependeSoDaIsencao(
  fato: string,
  isencao: FormularioQueColeta,
  producao: ProducaoDosFatos,
  emAvaliacao: Set<string>,
): boolean {
  if (isencao.fatos.has(fato)) return true;
  if (emAvaliacao.has(fato)) return false;
  emAvaliacao.add(fato);
  return dependenciasDoFato(fato, producao).some((dependencia) =>
    dependeSoDaIsencao(dependencia, isencao, producao, emAvaliacao),
  );
}

function dependenciasDoFato(fato: string, producao: ProducaoDosFatos): readonly string[] {
  const doCatalogo = producao.catalogo.get(fato);
  const membro = doCatalogo === undefined ? null : membroDoAgregado(doCatalogo);
  return [...(producao.derivacoes.get(fato) ?? []), ...(membro === null ? [] : [membro])];
}

function membroDoAgregado(fato: Pick<FatoComFase, 'binding'>): string | null {
  return fato.binding.startsWith(VINCULO_AGREGACAO)
    ? fato.binding.slice(VINCULO_AGREGACAO.length)
    : null;
}
