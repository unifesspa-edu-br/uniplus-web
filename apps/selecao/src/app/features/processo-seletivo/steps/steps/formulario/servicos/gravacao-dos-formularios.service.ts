import { effect, inject, Injectable, signal, untracked } from '@angular/core';
import {
  isApiOk,
  ProblemI18nService,
  STATUS_HTTP,
  type ProblemDetails,
} from '@uniplus/shared-core/http';
import {
  distribuirRecusas,
  semDadosBasicos,
  type ConteudoDoFormulario,
  type RecusasDoConteudo,
} from '@uniplus/shared-ui/components';

import type { FormularioDto, ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import type { StepValidation } from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { CadastroInicial } from '../../../shared/cadastro-inicial.service';
import {
  gravarNoPasso,
  RESPOSTA_DESCARTADA,
  type RespostaDescartada,
} from '../../../shared/gravacao/gravacao-no-passo';
import { comoComandoDeReferenciaTemporal } from '../apuracao-da-idade';
import { conteudoDoFormulario, formularioDaFinalidade } from '../formulario-do-processo';
import {
  comFormulario,
  formularioDoServidorNaFinalidade,
  formulariosDoServidor,
  nomeDaFinalidade,
  ordemDeGravacao,
} from '../formularios-por-finalidade';
import { LeituraDoProcessoNoFormulario } from './leitura-do-processo-no-formulario.service';
import { semChave } from './sem-chave';

/** O que a gravação de um formulário precisa: a fase, a finalidade e o conteúdo desejado. */
export interface FormularioParaGravar {
  readonly finalidade: string;
  readonly nome: string;
  /** O código da fase do cronograma em que o formulário é respondido. */
  readonly fase: string;
  readonly conteudo: ConteudoDoFormulario;
}

/**
 * A gravação dos formulários de cada finalidade e da política que ancora a apuração da idade.
 *
 * As fases e os formulários gravados vêm de uma releitura fresca: a fase pode ter sido acrescentada
 * nesta sessão, e o plano de gravação compara cada parte com o que o servidor tem — inclusive o que
 * uma tentativa anterior deixou gravado pela metade. As finalidades gravam na ordem em que a API
 * aceita cada uma, e a primeira recusa interrompe a sequência e vai à aba dela.
 */
@Injectable()
export class GravacaoDosFormularios {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly cadastro = inject(CadastroInicial);
  private readonly leitura = inject(LeituraDoProcessoNoFormulario);
  private readonly problemI18n = inject(ProblemI18nService);

  /** As recusas da última gravação, por finalidade, distribuídas contra o conteúdo ENVIADO — sem os dados básicos. */
  readonly recusas = signal<ReadonlyMap<string, RecusasDoConteudo>>(new Map());

  constructor() {
    // O que o passo guarda de um processo não pode valer para o seguinte.
    effect(() => {
      this.store.geracao();
      untracked(() => this.recusas.set(new Map()));
    });
  }

  esquecerRecusasDa(finalidade: string): void {
    this.recusas.update((atuais) => semChave(atuais, finalidade));
  }

  /**
   * Grava os formulários e a política da idade. `aoRecusar` recebe a finalidade cuja gravação o
   * servidor recusou, para a tela levar o operador à aba dela.
   */
  gravar(
    processoId: string,
    formularios: readonly FormularioParaGravar[],
    aoRecusar: (finalidade: string) => void,
  ): Promise<StepValidation | RespostaDescartada> {
    return gravarNoPasso(this.store, async () => {
      const geracao = this.store.geracao();
      const detalhe = await this.leitura.ler(processoId);
      if (geracao !== this.store.geracao()) return RESPOSTA_DESCARTADA;
      if (!isApiOk(detalhe)) {
        return {
          valid: false,
          messages: [
            'Não foi possível reler o processo para gravar os formulários. Tente gravar de novo.',
          ],
        };
      }

      const plano = planoDeEnvio(formularios, detalhe.data);
      if ('valid' in plano) return plano;

      const recusa = await this.gravarNaOrdem(processoId, geracao, plano, aoRecusar);
      if (recusa !== null) return recusa;
      this.recusas.set(new Map());

      const temporal = await this.gravarPoliticaDaIdade(processoId, plano.faseIdPorCodigo);
      if (geracao !== this.store.geracao()) return RESPOSTA_DESCARTADA;
      if (temporal !== null) return temporal;

      await this.reconciliarComOServidor(processoId, geracao, null);
      return { valid: true };
    });
  }

  /**
   * Grava as finalidades na ordem em que a API aceita cada uma. A primeira recusa interrompe a
   * sequência. `null` quando todas gravaram.
   */
  private async gravarNaOrdem(
    processoId: string,
    geracao: number,
    plano: PlanoDeEnvio,
    aoRecusar: (finalidade: string) => void,
  ): Promise<StepValidation | RespostaDescartada | null> {
    const gravadas: string[] = [];
    for (const finalidade of plano.ordem) {
      const desejado = plano.paraEnvio.find((formulario) => formulario.finalidade === finalidade);
      if (desejado === undefined) continue;
      const gravado = plano.gravados(finalidade);
      const gravacao = await this.cadastro.gravarFormulario(
        processoId,
        finalidade,
        gravado === null
          ? null
          : { faseId: gravado.faseId, conteudo: conteudoDoFormulario(gravado) },
        { faseId: desejado.faseId, conteudo: desejado.conteudo },
      );
      if (geracao !== this.store.geracao()) return RESPOSTA_DESCARTADA;
      if (!gravacao.ok) {
        const mensagens = this.aplicarRecusa(finalidade, gravacao.problem, desejado.conteudo);
        aoRecusar(finalidade);
        await this.reconciliarComOServidor(processoId, geracao, gravadas);
        return { valid: false, messages: [...mensagens] };
      }
      gravadas.push(finalidade);
    }
    return null;
  }

  /** Grava a política que ancora a apuração da idade. `null` quando gravou. */
  private async gravarPoliticaDaIdade(
    processoId: string,
    faseIdPorCodigo: ReadonlyMap<string, string>,
  ): Promise<StepValidation | null> {
    const temporal = await this.cadastro.definirReferenciaTemporalFatos(
      processoId,
      comoComandoDeReferenciaTemporal(
        this.store.draft().formulario.referenciaTemporal,
        faseIdPorCodigo,
      ),
    );
    if (temporal.ok) return null;
    return {
      valid: false,
      messages: [
        `Os formulários foram gravados. ${this.problemI18n.resolve(temporal.problem).title}`,
      ],
    };
  }

  /**
   * A recusa que aponta um item, uma etapa, um grupo ou um termo vai para ele no editor da aba; o
   * resto — a do grafo, que só cita o fato na mensagem — volta como mensagem do passo.
   */
  private aplicarRecusa(
    finalidade: string,
    problem: ProblemDetails,
    conteudo: ConteudoDoFormulario,
  ): readonly string[] {
    const erros = problem.status === STATUS_HTTP.RECUSA_DE_NEGOCIO ? (problem.errors ?? []) : [];
    if (erros.length === 0) {
      this.recusas.set(new Map());
      return [
        `O formulário de ${nomeDaFinalidade(finalidade)} não foi gravado. ${this.problemI18n.resolve(problem).title}`,
      ];
    }
    const recusas = distribuirRecusas(erros, semDadosBasicos(conteudo));
    this.recusas.set(new Map([[finalidade, recusas]]));
    return recusas.gerais.length > 0
      ? recusas.gerais
      : [
          `O formulário de ${nomeDaFinalidade(finalidade)} foi recusado: veja os campos marcados na aba dele.`,
        ];
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
    if (gravadas === null) {
      this.store.projetarSecao('formulario', formulariosDoServidor(detalhe.data));
      return;
    }

    let formulario = this.store.draft().formulario;
    for (const finalidade of gravadas) {
      const servidor = formularioDoServidorNaFinalidade(detalhe.data, finalidade);
      if (servidor !== null) formulario = comFormulario(formulario, servidor);
    }
    this.store.projetarSecao('formulario', formulario);
  }
}

/** O que vai ao servidor: cada formulário com a fase resolvida, a ordem de gravação e o que já está gravado. */
interface PlanoDeEnvio {
  readonly paraEnvio: readonly {
    finalidade: string;
    faseId: string;
    conteudo: ConteudoDoFormulario;
  }[];
  readonly ordem: readonly string[];
  readonly faseIdPorCodigo: ReadonlyMap<string, string>;
  readonly gravados: (finalidade: string) => FormularioDto | null;
}

/**
 * Compara cada formulário com o que o servidor tem, a partir de uma releitura fresca, e decide a
 * ordem de gravação. Devolve a recusa quando a fase de algum ainda não está no cronograma gravado.
 */
function planoDeEnvio(
  formularios: readonly FormularioParaGravar[],
  processo: ProcessoSeletivoDto,
): PlanoDeEnvio | StepValidation {
  const faseIdPorCodigo = new Map(
    processo.cronogramaFases.map((fase) => [fase.codigo, fase.id] as const),
  );
  const paraEnvio = comFaseResolvida(formularios, faseIdPorCodigo);
  if ('valid' in paraEnvio) return paraEnvio;

  const gravados = (finalidade: string) => formularioDaFinalidade(processo.formularios, finalidade);
  const ordem = ordemDeGravacao(
    paraEnvio.map((formulario) => {
      const gravado = gravados(formulario.finalidade);
      return {
        finalidade: formulario.finalidade,
        servidor: gravado === null ? null : conteudoDoFormulario(gravado),
        desejado: formulario.conteudo,
      };
    }),
  );
  return { paraEnvio, ordem, faseIdPorCodigo, gravados };
}

/** Cada formulário com o id da fase; a recusa quando a fase de algum ainda não está gravada. */
function comFaseResolvida(
  formularios: readonly FormularioParaGravar[],
  faseIdPorCodigo: ReadonlyMap<string, string>,
): PlanoDeEnvio['paraEnvio'] | StepValidation {
  const paraEnvio: PlanoDeEnvio['paraEnvio'][number][] = [];
  for (const formulario of formularios) {
    const faseId = faseIdPorCodigo.get(formulario.fase);
    if (faseId === undefined) {
      return {
        valid: false,
        messages: [
          `A fase do formulário de ${formulario.nome} ainda não está no cronograma gravado. Grave o passo Cronograma e tente de novo.`,
        ],
      };
    }
    paraEnvio.push({ finalidade: formulario.finalidade, faseId, conteudo: formulario.conteudo });
  }
  return paraEnvio;
}
