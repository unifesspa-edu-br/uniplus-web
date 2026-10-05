import type { FaseCanonicaDto } from '@uniplus/shared-data/configuracao';
import type { ProblemDetails } from '@uniplus/shared-core/http';
import {
  FINALIDADE_INSCRICAO,
  ehColetavel,
  todosOsCampos,
  type FatoDoFormulario,
} from '@uniplus/shared-ui/components';

import type { FaseDoCronograma, FormularioDeInscricao } from '../processo-seletivo.models';
import { finalidadesDaFase } from '../steps/cronograma/cronograma-do-certame';
import { finalidadeDaExigencia } from './exigencias-documentais';
import {
  fatosCitadosPelaDerivacao,
  fatosColetadosPelaInscricao,
} from '../steps/formulario/formulario-de-inscricao';
import {
  FINALIDADE_ISENCAO_TAXA,
  formulariosDoRascunho,
  nomeDaFinalidade,
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
  return fases.map((fase) => ({ codigo: fase.codigo, ordem: fase.ordem, finalidades: finalidadesDaFase(fase, fasePorId) }));
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

/** O que decide a fase de cada fato no processo. */
export interface ProducaoDosFatos {
  readonly fases: readonly FaseNoCronograma[];
  readonly formularios: readonly FormularioQueColeta[];
  /** Os fatos de que cada fato derivado por regra do processo depende, pelo código do derivado. */
  readonly derivacoes: ReadonlyMap<string, readonly string[]>;
  readonly catalogo: ReadonlyMap<string, FatoComFase>;
}

/** Por que o gatilho de uma exigência não pode citar o fato na fase dela. */
export type RecusaDeFase =
  /** O fato, ou um de que ele depende (`origem`), é conhecido numa fase que o cronograma não tem. */
  | { readonly tipo: 'FASE_FORA_DO_CRONOGRAMA'; readonly fato: string; readonly origem: string; readonly faseCodigo: string }
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
    derivacoes: new Map(
      formulario.derivacao.map((config) => [
        config.codigoFato,
        fatosCitadosPelaDerivacao(config.regras).filter((fato) => fato !== config.codigoFato),
      ]),
    ),
    catalogo: new Map(catalogo.map((fato) => [fato.codigo, fato])),
  };
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

  const isencao = producao.formularios.find((formulario) => formulario.finalidade === FINALIDADE_ISENCAO_TAXA);
  if (isencao !== undefined && finalidade !== FINALIDADE_ISENCAO_TAXA && dependeSoDaIsencao(fato, isencao, producao, new Set())) {
    return { tipo: 'SO_DA_ISENCAO', fato, faseCodigo: isencao.faseCodigo };
  }

  return null;
}

/** Como a tela nomeia o fato e a fase na orientação. */
export interface NomesDaOrientacao {
  readonly fato: (codigo: string) => string;
  readonly fase: (codigo: string) => string;
}

/**
 * A recusa dita com o que fazer para resolvê-la. Cada saída proposta é conferida pela própria
 * regra antes de ser oferecida — a fase e o formulário para onde levar a exigência, o formulário
 * para onde levar o campo —, para que segui-la não termine em outra recusa. Sem saída que passe,
 * resta retirar a condição.
 */
export function orientacaoDaRecusaDeFase(
  recusa: RecusaDeFase,
  lugar: LugarDaExigencia,
  producao: ProducaoDosFatos,
  nomes: NomesDaOrientacao,
): string {
  const fato = `“${nomes.fato(recusa.fato)}”`;
  const causa = causaDaRecusa(recusa, fato, nomes);

  const saidas = [
    ...saidaPorOutroLugar(recusa.fato, producao, nomes),
    ...saidasPorOutroFormulario(recusa.fato, lugar, producao).map(
      (finalidade) => `colete ${fato} no formulário de ${nomeDaFinalidade(finalidade)}`,
    ),
  ];
  if (saidas.length === 0 && recusa.tipo === 'FASE_FORA_DO_CRONOGRAMA') {
    saidas.push(`acrescente ao cronograma a fase ${nomes.fase(recusa.faseCodigo)} e exija o documento nela ou em fase posterior`);
  }

  const comoResolver = saidas.length === 0 ? 'retire esta condição' : saidas.join('; ou ');
  return `${causa} Como resolver: ${comoResolver}.`;
}

function causaDaRecusa(recusa: RecusaDeFase, fato: string, nomes: NomesDaOrientacao): string {
  switch (recusa.tipo) {
    case 'FASE_FORA_DO_CRONOGRAMA':
      return recusa.origem === recusa.fato
        ? `${fato} só é conhecido na fase ${nomes.fase(recusa.faseCodigo)}, que o cronograma não tem.`
        : `${fato} depende de “${nomes.fato(recusa.origem)}”, só conhecido na fase ${nomes.fase(recusa.faseCodigo)}, que o cronograma não tem.`;
    case 'FASE_POSTERIOR':
      return `${fato} só é conhecido na fase ${nomes.fase(recusa.faseCodigo)}, depois da fase em que o documento é exigido.`;
    case 'SO_DA_ISENCAO':
      return `${fato} vem do formulário de isenção e só condiciona documento apresentado nele, que se responde na fase ${nomes.fase(recusa.faseCodigo)}.`;
  }
}

/**
 * Os lugares em que a exigência pode citar o fato, ditos como saída — nenhum quando não há. O
 * lugar é o par fase e formulário: na fase que divide inscrição e isenção, o fato só da isenção
 * vale no documento da isenção e não no da inscrição. A fase em que todo formulário aceita é dita
 * inteira; a que aceita só algum, com o formulário.
 */
function saidaPorOutroLugar(fato: string, producao: ProducaoDosFatos, nomes: NomesDaOrientacao): readonly string[] {
  const emOrdem = [...producao.fases].sort((uma, outra) => uma.ordem - outra.ordem);
  const aceitas = emOrdem
    .map((fase) => {
      const lugares = lugaresDaFase(fase);
      const aceitos = lugares.filter((lugar) => recusaDeFaseDoGatilho(fato, lugar, producao) === null);
      return { fase, aceitos, inteira: aceitos.length === lugares.length };
    })
    .filter(({ aceitos }) => aceitos.length > 0);
  const [primeira] = aceitas;
  if (primeira === undefined) return [];

  if (aceitas.some(({ inteira }) => !inteira)) {
    const destinos = aceitas.flatMap(({ fase, aceitos, inteira }) =>
      inteira
        ? [`na fase ${nomes.fase(fase.codigo)}`]
        : aceitos.map((lugar) => `no formulário de ${nomeDaFinalidade(lugar.finalidade ?? '')}, na fase ${nomes.fase(fase.codigo)}`),
    );
    return [`exija o documento ${destinos.join(' ou ')}`];
  }
  if (aceitas.length === 1) return [`exija o documento na fase ${nomes.fase(primeira.fase.codigo)}`];

  const daPrimeiraEmDiante = emOrdem.filter((fase) => fase.ordem >= primeira.fase.ordem);
  return aceitas.length === daPrimeiraEmDiante.length
    ? [`exija o documento na fase ${nomes.fase(primeira.fase.codigo)} ou em fase posterior`]
    : [`exija o documento numa destas fases: ${aceitas.map(({ fase }) => nomes.fase(fase.codigo)).join(', ')}`];
}

/** Os lugares de uma fase: um por formulário que ela responde, ou a fase só, quando não responde nenhum. */
function lugaresDaFase(fase: FaseNoCronograma): readonly LugarDaExigencia[] {
  return fase.finalidades.length === 0
    ? [{ faseCodigo: fase.codigo, finalidade: null }]
    : fase.finalidades.map((finalidade) => ({ faseCodigo: fase.codigo, finalidade }));
}

/** Os formulários para onde levar a coleta do fato faz o gatilho valer onde a exigência é cobrada. */
function saidasPorOutroFormulario(fato: string, lugar: LugarDaExigencia, producao: ProducaoDosFatos): readonly string[] {
  const doCatalogo = producao.catalogo.get(fato);
  if (doCatalogo === undefined || !ehColetavel(doCatalogo)) return [];

  const atual = formularioQueColeta(fato, producao);
  return producao.formularios
    .filter((formulario) => formulario.finalidade !== atual?.finalidade && formulario.faseCodigo !== '')
    .filter((destino) => recusaDeFaseDoGatilho(fato, lugar, comColetaEm(producao, fato, destino.finalidade)) === null)
    .map((destino) => destino.finalidade);
}

/** A produção com o fato coletado só pelo formulário da finalidade dada. */
function comColetaEm(producao: ProducaoDosFatos, fato: string, finalidade: string): ProducaoDosFatos {
  return {
    ...producao,
    formularios: producao.formularios.map((formulario) => {
      const fatos = new Set([...formulario.fatos].filter((codigo) => codigo !== fato));
      if (formulario.finalidade === finalidade) fatos.add(fato);
      return { ...formulario, fatos };
    }),
  };
}

type FaseEfetiva =
  | { readonly fase: FaseNoCronograma | null }
  | { readonly foraDoCronograma: { readonly origem: string; readonly faseCodigo: string } };

function faseEfetiva(fato: string, producao: ProducaoDosFatos, emAvaliacao: Set<string>): FaseEfetiva {
  let maisTardia: FaseNoCronograma | null = null;
  const considerar = (fase: FaseNoCronograma | null | undefined): void => {
    if (fase !== null && fase !== undefined && (maisTardia === null || fase.ordem > maisTardia.ordem)) maisTardia = fase;
  };

  const ponto = producao.catalogo.get(fato)?.pontoResolucao;
  if (ponto !== undefined) {
    const doPonto = producao.fases.find((fase) => fase.codigo === ponto);
    if (doPonto === undefined) return { foraDoCronograma: { origem: fato, faseCodigo: ponto } };
    considerar(doPonto);
  }

  const coletor = formularioQueColeta(fato, producao);
  if (coletor !== null) considerar(producao.fases.find((fase) => fase.codigo === coletor.faseCodigo));

  if (!emAvaliacao.has(fato)) {
    emAvaliacao.add(fato);
    for (const dependencia of dependenciasDoFato(fato, producao)) {
      const daDependencia = faseEfetiva(dependencia, producao, emAvaliacao);
      if ('foraDoCronograma' in daDependencia) return daDependencia;
      considerar(daDependencia.fase);
    }
  }

  return { fase: maisTardia };
}

/**
 * O formulário que coleta o fato; para o coletável que nenhum coleta, a inscrição, que passa a
 * coletá-lo quando um gatilho o cita.
 */
function formularioQueColeta(fato: string, producao: ProducaoDosFatos): FormularioQueColeta | null {
  const coletor = producao.formularios.find((formulario) => formulario.fatos.has(fato));
  if (coletor !== undefined) return coletor;

  const doCatalogo = producao.catalogo.get(fato);
  return doCatalogo !== undefined && ehColetavel(doCatalogo)
    ? (producao.formularios.find((formulario) => formulario.finalidade === FINALIDADE_INSCRICAO) ?? null)
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
  return dependenciasDoFato(fato, producao).some((dependencia) => dependeSoDaIsencao(dependencia, isencao, producao, emAvaliacao));
}

function dependenciasDoFato(fato: string, producao: ProducaoDosFatos): readonly string[] {
  const doCatalogo = producao.catalogo.get(fato);
  const membro = doCatalogo === undefined ? null : membroDoAgregado(doCatalogo);
  return [...(producao.derivacoes.get(fato) ?? []), ...(membro === null ? [] : [membro])];
}

function membroDoAgregado(fato: Pick<FatoComFase, 'binding'>): string | null {
  return fato.binding.startsWith(VINCULO_AGREGACAO) ? fato.binding.slice(VINCULO_AGREGACAO.length) : null;
}

/** Onde o operador declara o formulário do documento, como a superfície da fase o rotula. */
const CAMPO_DO_FORMULARIO = 'no campo “Formulário” do documento, na fase';

/**
 * As recusas do servidor sobre onde o documento é cobrado — a fase do fato que o gatilho cita e o
 * formulário a que o documento pertence — ditas com o que fazer. Servem quando a conferência da
 * tela não as previu: o servidor não diz qual documento nem qual condição, e por isso o texto
 * orienta pelo caso e pelo campo que o resolve, sem nomeá-los.
 */
const RECUSA_DA_EXIGENCIA_DO_SERVIDOR: ReadonlyMap<string, string> = new Map([
  [
    'uniplus.selecao.documento_exigido.fato_resolvido_em_fase_posterior',
    'Uma condição de documento exigido cita dado que só é conhecido depois da fase em que o documento é exigido. Exija o documento numa fase em que o dado já seja conhecido, ou colete o dado num formulário respondido até a fase da exigência.',
  ],
  [
    'uniplus.selecao.documento_exigido.fato_da_isencao_em_outra_finalidade',
    `Uma condição de documento exigido cita dado do formulário de isenção, e o documento é apresentado em outro formulário. Escolha o formulário de isenção ${CAMPO_DO_FORMULARIO} da isenção, ou colete o dado no formulário de inscrição.`,
  ],
  [
    'uniplus.selecao.documento_exigido.ponto_resolucao_fora_do_cronograma',
    'Uma condição de documento exigido cita dado que só é conhecido numa fase que o cronograma não tem. Acrescente essa fase ao cronograma e exija o documento nela ou em fase posterior, ou retire a condição.',
  ],
  [
    'uniplus.selecao.documento_exigido.finalidade_obrigatoria',
    `Um documento exigido em fase que responde formulário está sem o formulário em que o candidato o apresenta. Escolha-o ${CAMPO_DO_FORMULARIO} em que ele é exigido.`,
  ],
  [
    'uniplus.selecao.documento_exigido.fase_incoerente_com_finalidade',
    `Um documento exigido declara um formulário que a fase dele não responde. Escolha ${CAMPO_DO_FORMULARIO} em que ele é exigido, um dos formulários que ela responde.`,
  ],
  [
    'uniplus.estrutura_formulario.finalidade_invalida',
    `Um documento exigido declara um formulário que não existe. Escolha ${CAMPO_DO_FORMULARIO} em que ele é exigido, um dos formulários que ela responde.`,
  ],
  [
    'uniplus.selecao.no_exigencia.grupo_com_finalidades_diferentes',
    `Os documentos de um grupo de alternativas estão em formulários diferentes, e o candidato satisfaz o grupo num formulário só. Escolha o mesmo formulário para todos eles, ${CAMPO_DO_FORMULARIO} do grupo.`,
  ],
]);

/**
 * A recusa do servidor sobre onde o documento é cobrado, com a orientação; `null` quando a recusa é
 * outra. O código vem no problema, ou em cada erro dele quando a recusa é de forma — a do formulário
 * que não existe chega assim, junto com as outras recusas de forma do mesmo envio.
 */
export function recusaDaExigenciaDoServidor(problema: Pick<ProblemDetails, 'code' | 'errors'>): string | null {
  const codigos = [problema.code, ...(problema.errors ?? []).map((erro) => erro.code)];
  return codigos.map((codigo) => RECUSA_DA_EXIGENCIA_DO_SERVIDOR.get(codigo)).find((orientacao) => orientacao !== undefined) ?? null;
}
