import { inject, Injectable } from '@angular/core';
import {
  isApiOk,
  ProblemI18nService,
  type ProblemValidationError,
  type ProblemDetails,
} from '@uniplus/shared-core/http';
import {
  OrigemCandidatosCodigo,
  ProcessosSeletivosApi,
  type ProcessoSeletivoDto,
} from '@uniplus/shared-data/selecao';
import { firstValueFrom } from 'rxjs';

import type { ValidacaoDoPasso } from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { CadastroInicial } from '../../../shared/cadastro-inicial.service';
import {
  GravacaoDosCamposPressupostos,
  fatosCitadosPelasModalidadesOfertadas,
} from '../../../shared/campos-pressupostos.service';
import { todasAsExigencias } from '../../../shared/exigencias/consulta-das-exigencias';
import {
  regrasDeComprovacaoParaEnvio,
  type OrigemDaRegraEnviada,
} from '../../../shared/exigencias/gravacao-das-exigencias';
import { identificarRecusaDaExigencia } from '../../../shared/exigencias/caminho-da-recusa-das-exigencias';
import { modalidadesDaExigencia } from '../../../shared/exigencias/recorte-por-modalidade';
import { recusaDaExigenciaDoServidor } from '../../../shared/orientacao-da-recusa-do-fato';
import { quemCitaNoProcesso } from '../../formulario/citantes-no-processo';
import { finalidadesQueAtende } from '../../formulario/formularios-por-finalidade';

export interface RecusaDaExigencia {
  readonly identificadorDaRegra: string | null;
  readonly faseCodigo?: string;
  readonly campo: string;
  readonly codigo: string;
  readonly mensagem: string;
}

export interface ResultadoDaGravacaoDasExigencias extends ValidacaoDoPasso {
  readonly recusas?: readonly RecusaDaExigencia[];
}

function traduzirRecusa(
  erro: ProblemValidationError,
  origens: readonly OrigemDaRegraEnviada[],
): RecusaDaExigencia {
  const identificacao = identificarRecusaDaExigencia(erro.field ?? '', origens);
  return {
    identificadorDaRegra: identificacao?.identificadorDaRegra ?? null,
    faseCodigo: identificacao?.faseCodigo,
    campo: identificacao?.campo ?? erro.field ?? '',
    codigo: erro.code ?? '',
    mensagem: recusaDaExigenciaDoServidor({ code: erro.code }) ?? erro.message,
  };
}

function recusaDaReleitura(): ValidacaoDoPasso {
  return {
    valid: false,
    messages: [
      'As etapas e o cronograma foram gravados, mas não foi possível reler as fases para gravar os documentos exigidos. Tente gravar de novo.',
    ],
  };
}
function recusaSemFaseDeInscricao(): ValidacaoDoPasso {
  return {
    valid: false,
    messages: [
      'As etapas e o cronograma foram gravados. Uma exigência documental depende de um dado que o formulário de inscrição precisa coletar, e o cronograma não tem fase em que a inscrição é respondida. Acrescente a fase de inscrição.',
    ],
  };
}

/** A última gravação do passo: os documentos que cada fase exige, depois das fases e das etapas. */
@Injectable()
export class GravacaoDasExigenciasDocumentais {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly cadastro = inject(CadastroInicial);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly api = inject(ProcessosSeletivosApi);
  private readonly camposPressupostos = inject(GravacaoDosCamposPressupostos);

  /**
   * Grava os documentos que cada fase exige.
   *
   * A conversão precisa do id de cada fase, que o rascunho não guarda — ele identifica
   * a fase pelo código canônico, que é o que sobrevive à reconciliação do servidor. A
   * releitura aqui é a que traduz um no outro; sem ela, a exigência sairia apontando
   * para uma fase que só existe no rascunho.
   */
  async gravar(processoId: string): Promise<ResultadoDaGravacaoDasExigencias> {
    const geracao = this.store.geracao();
    const detalhe = await firstValueFrom(this.api.obter(processoId));
    if (geracao !== this.store.geracao()) return { valid: true };
    if (!isApiOk(detalhe)) return recusaDaReleitura();

    const regrasDeComprovacao = this.regrasDoRascunho(detalhe.data);
    const recusa = await this.garantirOsCampos(processoId, detalhe.data, geracao);
    if (recusa !== null) return recusa;

    return this.gravarDocumentos(processoId, regrasDeComprovacao, geracao);
  }

  private async gravarDocumentos(
    processoId: string,
    regrasDeComprovacao: ReturnType<GravacaoDasExigenciasDocumentais['regrasDoRascunho']>,
    geracao: number,
  ): Promise<ResultadoDaGravacaoDasExigencias> {
    const gravacao = await this.cadastro.definirDocumentosExigidos(
      processoId,
      regrasDeComprovacao.regras,
    );
    if (geracao !== this.store.geracao() || gravacao.ok) return { valid: true };
    return this.resultadoDaRecusa(gravacao.problem, regrasDeComprovacao.origens);
  }

  private resultadoDaRecusa(
    problema: ProblemDetails,
    origens: readonly OrigemDaRegraEnviada[],
  ): ResultadoDaGravacaoDasExigencias {
    const motivo =
      recusaDaExigenciaDoServidor(problema) ?? this.problemI18n.resolve(problema).title;
    return {
      valid: false,
      messages: [
        `As etapas, o cronograma e o formulário de inscrição foram gravados. ${motivo}`,
        ...(problema.errors ?? []).map((erro) => erro.message),
      ],
      recusas: (problema.errors ?? []).map((erro) => traduzirRecusa(erro, origens)),
    };
  }

  /**
   * Os campos do formulário saem ANTES das exigências, e não é preferência de ordem: uma exigência
   * condicionada a um fato só se resolve se o certame coletar aquele fato. Quem declara a condição
   * é este passo, então é ele que garante o campo — o operador não deveria precisar lembrar que
   * decidir de quem o documento é cobrado mexe no formulário. A exigência recortada por modalidade
   * depende também das perguntas que as regras das modalidades ofertadas fazem: é delas que a
   * modalidade do candidato se deriva.
   *
   * Devolve a recusa quando os campos não ficaram no formulário, ou `{ valid: true }` se o
   * processo mudou no meio; `null` quando ficaram.
   */
  private async garantirOsCampos(
    processoId: string,
    processo: ProcessoSeletivoDto,
    geracao: number,
  ): Promise<ValidacaoDoPasso | null> {
    const recorta = this.recortaPorModalidade();
    const citadosPelasExigencias = this.citadosPelasExigencias(processo);
    const fatos = this.fatosParaColeta(processo, recorta, citadosPelasExigencias);
    const campos = await this.camposPressupostos.garantirCampos(processoId, processo, fatos);
    if (geracao !== this.store.geracao()) return { valid: true };
    return this.recusaDosCampos(campos, processo, recorta, citadosPelasExigencias);
  }

  private fatosParaColeta(
    processo: ProcessoSeletivoDto,
    recorta: boolean,
    citadosPelasExigencias: ReadonlySet<string>,
  ): ReadonlySet<string> {
    return new Set([...citadosPelasExigencias, ...this.fatosDasModalidades(processo, recorta)]);
  }

  private fatosDasModalidades(
    processo: ProcessoSeletivoDto,
    recorta: boolean,
  ): ReadonlySet<string> {
    return this.pedePerguntasDasModalidades(recorta)
      ? fatosCitadosPelasModalidadesOfertadas(processo)
      : new Set<string>();
  }

  private recortaPorModalidade(): boolean {
    return todasAsExigencias(this.store.draft().documentos).some(
      (exigencia) => modalidadesDaExigencia(exigencia) !== null,
    );
  }

  /**
   * As regras de comprovação com o id de cada fase gravada, e o formulário de cada fase pelas fases
   * que acabaram de ser gravadas: é contra elas que o servidor confere o formulário de cada
   * documento.
   */
  private regrasDoRascunho(processo: ProcessoSeletivoDto) {
    return regrasDeComprovacaoParaEnvio(this.store.draft().documentos, {
      faseIdPorCodigo: new Map(processo.cronogramaFases.map((f) => [f.codigo, f.id])),
      modalidadesOfertadas: this.store.modalidadesDoProcesso(),
      etapasVivas: new Set(processo.etapas.map((etapa) => etapa.id)),
      finalidadesPorFase: new Map(
        processo.cronogramaFases.map((fase) => [
          fase.codigo,
          finalidadesQueAtende({ codigo: fase.codigo, ...fase.faseCanonica }),
        ]),
      ),
    });
  }

  /** Os fatos que as exigências e as regras de derivação citam. */
  private citadosPelasExigencias(processo: ProcessoSeletivoDto): ReadonlySet<string> {
    const draft = this.store.draft();
    return new Set(
      quemCitaNoProcesso({
        documentos: draft.documentos,
        derivacao: processo.regrasDerivacao ?? [],
        desempate: draft.desempate,
      }).keys(),
    );
  }

  /** A recusa quando os campos que o processo pressupõe não ficaram no formulário; `null` se ficaram. */
  private recusaDosCampos(
    campos: Awaited<ReturnType<GravacaoDosCamposPressupostos['garantirCampos']>>,
    processo: ProcessoSeletivoDto,
    recorta: boolean,
    citadosPelasExigencias: ReadonlySet<string>,
  ): ValidacaoDoPasso | null {
    if (campos.tipo === 'recusados') {
      return {
        valid: false,
        messages: [`As etapas e o cronograma foram gravados. ${campos.motivo}`],
      };
    }
    return this.recusaPorFaltaDeFase(campos, processo, recorta, citadosPelasExigencias);
  }

  private recusaPorFaltaDeFase(
    campos: Awaited<ReturnType<GravacaoDosCamposPressupostos['garantirCampos']>>,
    processo: ProcessoSeletivoDto,
    recorta: boolean,
    citadosPelasExigencias: ReadonlySet<string>,
  ): ValidacaoDoPasso | null {
    if (campos.tipo !== 'semFaseDeInscricao') return null;
    if (recorta || !this.camposPressupostos.coletaTudo(processo, citadosPelasExigencias)) {
      return recusaSemFaseDeInscricao();
    }
    return null;
  }

  /**
   * As perguntas das modalidades vão ao formulário do processo em que o candidato se inscreve — é
   * a inscrição que coleta as respostas de que a modalidade dele se deriva —, e ao do que recorta
   * exigência por modalidade, que sem elas escreveria uma condição que nunca resolve.
   */
  private pedePerguntasDasModalidades(recorta: boolean): boolean {
    return (
      recorta ||
      this.store.draft().identificacao.origemCandidatos === OrigemCandidatosCodigo.inscricaoPropria
    );
  }
}
