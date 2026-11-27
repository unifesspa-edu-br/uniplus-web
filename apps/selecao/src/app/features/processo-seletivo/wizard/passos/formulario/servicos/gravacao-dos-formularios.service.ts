import { effect, inject, Injectable, signal, untracked } from '@angular/core';
import {
  isApiOk,
  type CausasDoProblema,
  type ProblemDetails,
  ProblemI18nService,
  separarCausas,
  STATUS_HTTP,
} from '@uniplus/shared-core/http';
import {
  distribuirRecusas,
  semDadosBasicos,
  type RecusasDoConteudo,
} from '@uniplus/shared-inscricao/formulario';

import type { FormularioDto, ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import type { FormularioDeInscricao, ValidacaoDoPasso } from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { CadastroInicial } from '../../../shared/cadastro-inicial.service';
import {
  GravacaoDasExigenciasDocumentais,
  type ResultadoDaGravacaoDasExigencias,
} from '../../../shared/exigencias/gravacao-das-exigencias-documentais.service';
import {
  gravarNoPasso,
  RESPOSTA_DESCARTADA,
  respostaFoiDescartada,
  type RespostaDescartada,
} from '../../../shared/gravacao/gravacao-no-passo';
import { comoComandoDeReferenciaTemporal } from '../apuracao-da-idade';
import {
  conteudoDoFormulario,
  paraGravarDoServidor,
  type FormularioParaGravar as CabecalhoParaGravar,
} from '../formulario-do-processo';
import {
  comFormulario,
  formularioDoServidorNoCodigo,
  formulariosDoServidor,
} from '../formularios-do-rascunho';
import { ordemDeGravacao } from '../ordem-de-gravacao';
import { LeituraDoProcessoNoFormulario } from './leitura-do-processo-no-formulario.service';
import { semChave } from './sem-chave';

/** O que a gravação de um formulário precisa: o código, a fase, a obrigatoriedade e o conteúdo desejado. */
export interface FormularioParaEnviar extends Omit<CabecalhoParaGravar, 'faseId'> {
  readonly codigo: string;
  /** Como as mensagens nomeiam o formulário, já entre aspas. */
  readonly nome: string;
  /** O código da fase do cronograma em que o formulário é respondido. */
  readonly fase: string;
  /** Se é o formulário que o candidato responde ao se inscrever. */
  readonly daInscricao: boolean;
}

/**
 * A gravação dos formulários do processo e da política que ancora a apuração da idade.
 *
 * As fases e os formulários gravados vêm de uma releitura fresca: a fase pode ter sido acrescentada
 * nesta sessão, e o plano de gravação compara cada parte com o que o servidor tem — inclusive o que
 * uma tentativa anterior deixou gravado pela metade. Os formulários gravam na ordem em que a API
 * aceita cada uma, e a primeira recusa interrompe a sequência e vai à aba dela.
 */
@Injectable()
export class GravacaoDosFormularios {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly cadastro = inject(CadastroInicial);
  private readonly leitura = inject(LeituraDoProcessoNoFormulario);
  private readonly documentosExigidos = inject(GravacaoDasExigenciasDocumentais);
  private readonly problemI18n = inject(ProblemI18nService);

  /** As recusas da última gravação, por código, distribuídas contra o conteúdo ENVIADO — sem os dados básicos. */
  readonly recusas = signal<ReadonlyMap<string, RecusasDoConteudo>>(new Map());

  constructor() {
    // O que o passo guarda de um processo não pode valer para o seguinte.
    effect(() => {
      this.store.geracao();
      untracked(() => this.recusas.set(new Map()));
    });
  }

  esquecerRecusasDa(codigo: string): void {
    this.recusas.update((atuais) => semChave(atuais, codigo));
  }

  /**
   * Grava os formulários e a política da idade. `irAba` recebe o código do formulário cuja gravação o
   * servidor recusou, para a tela levar o operador à aba dela.
   */
  gravar(
    processoId: string,
    formularios: readonly FormularioParaEnviar[],
    irAba: (codigo: string) => void,
  ): Promise<ValidacaoDoPasso | RespostaDescartada> {
    return gravarNoPasso(this.store, async () => {
      const geracao = this.store.geracao();
      const plano = await this.planoDaReleitura(processoId, geracao, formularios);
      if ('valid' in plano) return plano;
      const envio = await this.gravarNaOrdem(processoId, geracao, plano);
      if (respostaFoiDescartada(envio)) return envio;
      if ('recusada' in envio) return this.interromperNaRecusa(processoId, geracao, envio, irAba);
      return this.concluirComTodasGravadas(processoId, geracao, plano.faseIdPorCodigo);
    });
  }

  private async planoDaReleitura(
    processoId: string,
    geracao: number,
    formularios: readonly FormularioParaEnviar[],
  ): Promise<PlanoDeEnvio | ValidacaoDoPasso | RespostaDescartada> {
    const detalhe = await this.leitura.ler(processoId);
    if (geracao !== this.store.geracao()) return RESPOSTA_DESCARTADA;
    return isApiOk(detalhe) ? planoDeEnvio(formularios, detalhe.data) : falhaNaReleitura();
  }

  /** A primeira recusa interrompe a sequência de gravação. */
  private async gravarNaOrdem(
    processoId: string,
    geracao: number,
    plano: PlanoDeEnvio,
  ): Promise<DesfechoDaGravacaoEmOrdem> {
    const gravadas: string[] = [];
    for (const formulario of formulariosNaOrdem(plano)) {
      const gravacao = await this.enviarFormulario(processoId, formulario, plano);
      if (geracao !== this.store.geracao()) return RESPOSTA_DESCARTADA;
      if (!gravacao.ok) return { gravadas, recusada: formulario, problem: gravacao.problem };
      gravadas.push(formulario.codigo);
    }
    return { gravadas };
  }

  private enviarFormulario(processoId: string, formulario: FormularioComFase, plano: PlanoDeEnvio) {
    const gravado = plano.gravados(formulario.codigo);
    return this.cadastro.gravarFormulario(
      processoId,
      formulario.codigo,
      gravado === null ? null : paraGravarDoServidor(gravado),
      formulario,
    );
  }

  private async interromperNaRecusa(
    processoId: string,
    geracao: number,
    desfecho: Extract<DesfechoDaGravacaoEmOrdem, { recusada: FormularioComFase }>,
    aoRecusar: (codigo: string) => void,
  ): Promise<ValidacaoDoPasso> {
    const mensagens = this.aplicarRecusa(desfecho.recusada, desfecho.problem);
    aoRecusar(desfecho.recusada.codigo);
    await this.reconciliarComOServidor(processoId, geracao, desfecho.gravadas);
    return { valid: false, messages: [...mensagens] };
  }

  private async concluirComTodasGravadas(
    processoId: string,
    geracao: number,
    faseIdPorCodigo: ReadonlyMap<string, string>,
  ): Promise<ValidacaoDoPasso | RespostaDescartada> {
    this.recusas.set(new Map());
    const temporal = await this.gravarPoliticaDaIdade(processoId, faseIdPorCodigo);
    if (geracao !== this.store.geracao()) return RESPOSTA_DESCARTADA;
    if (temporal !== null) return temporal;
    await this.reconciliarComOServidor(processoId, geracao, null);
    if (geracao !== this.store.geracao()) return RESPOSTA_DESCARTADA;
    return this.gravarOsDocumentosQueAguardavam(processoId, geracao);
  }

  /**
   * Os documentos que o Cronograma deixou sem gravar por falta de formulário seguem agora, com os
   * formulários já no servidor. Se ainda falta formulário, ou a exigência precisa de ajuste, a
   * recusa é legítima e leva o operador à fase no Cronograma.
   */
  private async gravarOsDocumentosQueAguardavam(
    processoId: string,
    geracao: number,
  ): Promise<ValidacaoDoPasso | RespostaDescartada> {
    if (!this.store.documentosExigidosAguardandoFormulario()) return { valid: true };
    const documentos = await this.documentosExigidos.gravar(
      processoId,
      OS_FORMULARIOS_FORAM_GRAVADOS,
    );
    if (geracao !== this.store.geracao()) return RESPOSTA_DESCARTADA;
    return desfechoDosDocumentos(documentos, this.store.documentosExigidosAguardandoFormulario());
  }

  /** Grava a política que ancora a apuração da idade. `null` quando gravou. */
  private async gravarPoliticaDaIdade(
    processoId: string,
    faseIdPorCodigo: ReadonlyMap<string, string>,
  ): Promise<ValidacaoDoPasso | null> {
    const temporal = await this.cadastro.definirReferenciaTemporalFatos(
      processoId,
      comoComandoDeReferenciaTemporal(
        this.store.draft().formulario.referenciaTemporal,
        faseIdPorCodigo,
      ),
    );
    if (temporal.ok) return null;
    return this.recusaDaPoliticaDaIdade(temporal.problem);
  }

  private recusaDaPoliticaDaIdade(problem: ProblemDetails): ValidacaoDoPasso {
    return {
      valid: false,
      messages: [`Os formulários foram gravados. ${this.problemI18n.resolve(problem).title}`],
    };
  }

  /**
   * A recusa que aponta um item, uma página, um grupo ou um termo vai para ele no editor da aba; o
   * resto — a do grafo, que só cita o fato na mensagem — volta como mensagem do passo.
   */
  private aplicarRecusa(formulario: FormularioComFase, problem: ProblemDetails): readonly string[] {
    const { deCampo, gerais } = separarCausas(
      problem.status === STATUS_HTTP.RECUSA_DE_NEGOCIO ? problem.errors : undefined,
    );
    if (deCampo.length === 0 && gerais.length === 0)
      return this.recusaSemCausaApontada(formulario, problem);
    return this.mensagensDoPasso(formulario, { deCampo, gerais });
  }

  private recusaSemCausaApontada(
    formulario: FormularioComFase,
    problem: ProblemDetails,
  ): readonly string[] {
    this.recusas.set(new Map());
    const titulo = this.problemI18n.resolve(problem).title;
    return [`O formulário ${formulario.nome} não foi gravado. ${titulo}`];
  }

  private mensagensDoPasso(
    formulario: FormularioComFase,
    causas: CausasDoProblema,
  ): readonly string[] {
    const recusas = distribuirRecusas(causas.deCampo, semDadosBasicos(formulario.conteudo));
    this.recusas.set(new Map([[formulario.codigo, recusas]]));
    const mensagens = [...recusas.gerais, ...causas.gerais.map((causa) => causa.message)];
    const marcadas = `O formulário ${formulario.nome} foi recusado: veja os campos marcados na aba dele.`;
    return mensagens.length > 0 ? mensagens : [marcadas];
  }

  /**
   * Relê o processo e projeta no rascunho o que o servidor tem dos formulários. Depois de gravar
   * tudo, todos — a API repõe os dados básicos e pode deslocar a ordem. Depois de uma recusa, só os
   * que gravaram antes dela: o conteúdo dos outros, na tela, é o que o operador quer, e a próxima
   * tentativa se compara com a releitura que fizer.
   */
  private async reconciliarComOServidor(
    processoId: string,
    geracao: number,
    gravadas: readonly string[] | null,
  ): Promise<void> {
    const detalhe = await this.leitura.ler(processoId);
    if (geracao !== this.store.geracao() || !isApiOk(detalhe)) return;
    const formulario =
      gravadas === null
        ? formulariosDoServidor(detalhe.data)
        : formularioComAsGravadas(this.store.draft().formulario, detalhe.data, gravadas);
    this.store.projetarSecao('formulario', formulario);
  }
}

const OS_FORMULARIOS_FORAM_GRAVADOS = 'Os formulários foram gravados.';

const CORRIJA_NO_CRONOGRAMA =
  'Corrija a exigência na fase indicada, no passo Cronograma, e grave os formulários de novo.';

function desfechoDosDocumentos(
  documentos: ResultadoDaGravacaoDasExigencias,
  aindaAguardam: boolean,
): ValidacaoDoPasso {
  if (!documentos.valid) {
    return { valid: false, messages: [...(documentos.messages ?? []), CORRIJA_NO_CRONOGRAMA] };
  }
  return aindaAguardam ? AINDA_FALTA_FORMULARIO : { valid: true };
}

const AINDA_FALTA_FORMULARIO: ValidacaoDoPasso = {
  valid: false,
  messages: [
    `${OS_FORMULARIOS_FORAM_GRAVADOS} Os documentos exigidos ainda não foram gravados: falta formulário em uma das fases que os exigem. Acrescente o formulário à fase, ou ajuste a exigência no passo Cronograma.`,
  ],
};

interface FormularioComFase extends CabecalhoParaGravar {
  readonly codigo: string;
  readonly nome: string;
  readonly daInscricao: boolean;
  readonly faseId: string;
}

/** O que vai ao servidor: cada formulário com a fase resolvida, a ordem e o que já está gravado. */
interface PlanoDeEnvio {
  readonly paraEnvio: readonly FormularioComFase[];
  readonly ordem: readonly string[];
  readonly faseIdPorCodigo: ReadonlyMap<string, string>;
  readonly gravados: (codigo: string) => FormularioDto | null;
}

type DesfechoDaGravacaoEmOrdem =
  | RespostaDescartada
  | { readonly gravadas: readonly string[] }
  | {
      readonly gravadas: readonly string[];
      readonly recusada: FormularioComFase;
      readonly problem: ProblemDetails;
    };

function falhaNaReleitura(): ValidacaoDoPasso {
  return {
    valid: false,
    messages: [
      'Não foi possível reler o processo para gravar os formulários. Tente gravar de novo.',
    ],
  };
}

function formulariosNaOrdem(plano: PlanoDeEnvio): FormularioComFase[] {
  return plano.ordem.flatMap((codigo) => {
    const formulario = plano.paraEnvio.find((item) => item.codigo === codigo);
    return formulario === undefined ? [] : [formulario];
  });
}

function formularioComAsGravadas(
  formulario: FormularioDeInscricao,
  processo: ProcessoSeletivoDto,
  gravadas: readonly string[],
): FormularioDeInscricao {
  for (const codigo of gravadas) {
    const servidor = formularioDoServidorNoCodigo(processo, codigo);
    if (servidor !== null) formulario = comFormulario(formulario, servidor);
  }
  return formulario;
}

/**
 * Compara cada formulário com o que o servidor tem, a partir de uma releitura fresca, e decide a
 * ordem de gravação. Devolve a recusa quando a fase de algum ainda não está no cronograma gravado.
 */
function planoDeEnvio(
  formularios: readonly FormularioParaEnviar[],
  processo: ProcessoSeletivoDto,
): PlanoDeEnvio | ValidacaoDoPasso {
  const faseIdPorCodigo = new Map(
    processo.cronogramaFases.map((fase) => [fase.codigo, fase.id] as const),
  );
  const paraEnvio = comFaseResolvida(formularios, faseIdPorCodigo);
  if ('valid' in paraEnvio) return paraEnvio;

  const gravados = (codigo: string) =>
    processo.formularios.find((formulario) => formulario.codigo === codigo) ?? null;
  const ordem = ordemDosFormularios(paraEnvio, gravados);
  return { paraEnvio, ordem, faseIdPorCodigo, gravados };
}

function ordemDosFormularios(
  formularios: PlanoDeEnvio['paraEnvio'],
  gravados: PlanoDeEnvio['gravados'],
): readonly string[] {
  return ordemDeGravacao(formularios.map((formulario) => compararFormulario(formulario, gravados)));
}

function compararFormulario(formulario: FormularioComFase, gravados: PlanoDeEnvio['gravados']) {
  const gravado = gravados(formulario.codigo);
  return {
    codigo: formulario.codigo,
    daInscricao: formulario.daInscricao,
    servidor: gravado === null ? null : conteudoDoFormulario(gravado),
    desejado: formulario.conteudo,
  };
}

/** Cada formulário com o id da fase; a recusa quando a fase de algum ainda não está gravada. */
function comFaseResolvida(
  formularios: readonly FormularioParaEnviar[],
  faseIdPorCodigo: ReadonlyMap<string, string>,
): PlanoDeEnvio['paraEnvio'] | ValidacaoDoPasso {
  const paraEnvio: FormularioComFase[] = [];
  for (const formulario of formularios) {
    const faseId = faseIdPorCodigo.get(formulario.fase);
    if (faseId === undefined) {
      return faseForaDoCronograma(formulario.nome);
    }
    paraEnvio.push({ ...formulario, faseId });
  }
  return paraEnvio;
}

function faseForaDoCronograma(nome: string): ValidacaoDoPasso {
  return {
    valid: false,
    messages: [
      `A fase do formulário ${nome} ainda não está no cronograma gravado. Grave o passo Cronograma e tente de novo.`,
    ],
  };
}
