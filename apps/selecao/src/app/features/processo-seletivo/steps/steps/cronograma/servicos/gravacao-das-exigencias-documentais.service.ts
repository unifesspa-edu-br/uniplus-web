import { inject, Injectable } from '@angular/core';
import { isApiOk, ProblemI18nService } from '@uniplus/shared-core/http';
import {
  OrigemCandidatos,
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
import { arvoreDeExigencias } from '../../../shared/exigencias/gravacao-das-exigencias';
import { modalidadesDaExigencia } from '../../../shared/exigencias/recorte-por-modalidade';
import { recusaDaExigenciaDoServidor } from '../../../shared/orientacao-da-recusa-do-fato';
import { quemCitaNoProcesso } from '../../formulario/citantes-no-processo';
import { finalidadesQueAtende } from '../../formulario/formularios-por-finalidade';

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
  async gravar(processoId: string): Promise<ValidacaoDoPasso> {
    const geracao = this.store.geracao();
    const detalhe = await firstValueFrom(this.api.obter(processoId));
    if (geracao !== this.store.geracao()) return { valid: true };
    if (!isApiOk(detalhe)) {
      return {
        valid: false,
        messages: [
          'As etapas e o cronograma foram gravados, mas não foi possível reler as fases para gravar os documentos exigidos. Tente gravar de novo.',
        ],
      };
    }

    const raizes = this.arvoreDoRascunho(detalhe.data);
    const recusa = await this.garantirOsCampos(processoId, detalhe.data, geracao);
    if (recusa !== null) return recusa;

    const gravacao = await this.cadastro.definirDocumentosExigidos(processoId, raizes);
    if (geracao !== this.store.geracao()) return { valid: true };
    return gravacao.ok
      ? { valid: true }
      : {
          valid: false,
          messages: [
            `As etapas, o cronograma e o formulário de inscrição foram gravados. ${recusaDaExigenciaDoServidor(gravacao.problem) ?? this.problemI18n.resolve(gravacao.problem).title}`,
          ],
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
    const recorta = todasAsExigencias(this.store.draft().documentos).some(
      (exigencia) => modalidadesDaExigencia(exigencia) !== null,
    );
    const citadosPelasModalidades = this.pedePerguntasDasModalidades(recorta)
      ? fatosCitadosPelasModalidadesOfertadas(processo)
      : new Set<string>();
    const citadosPelasExigencias = this.citadosPelasExigencias(processo);

    const campos = await this.camposPressupostos.garantirCampos(
      processoId,
      processo,
      new Set([...citadosPelasExigencias, ...citadosPelasModalidades]),
    );
    if (geracao !== this.store.geracao()) return { valid: true };
    return this.recusaDosCampos(campos, processo, recorta, citadosPelasExigencias);
  }

  /**
   * A árvore de exigências com o id de cada fase gravada, e o formulário de cada fase pelas fases
   * que acabaram de ser gravadas: é contra elas que o servidor confere o formulário de cada
   * documento.
   */
  private arvoreDoRascunho(processo: ProcessoSeletivoDto) {
    return arvoreDeExigencias(
      this.store.draft().documentos,
      new Map(processo.cronogramaFases.map((f) => [f.codigo, f.id])),
      this.store.modalidadesDoProcesso(),
      new Set(processo.etapas.map((etapa) => etapa.id)),
      new Map(processo.cronogramaFases.map((fase) => [fase.codigo, finalidadesQueAtende(fase)])),
    );
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
    // Sem a fase de inscrição, as perguntas das modalidades esperam por ela; a exigência que
    // depende de um dado, não.
    if (
      campos.tipo === 'semFaseDeInscricao' &&
      (recorta || !this.camposPressupostos.coletaTudo(processo, citadosPelasExigencias))
    ) {
      return {
        valid: false,
        messages: [
          'As etapas e o cronograma foram gravados. Uma exigência documental depende de um dado que o formulário de inscrição precisa coletar, e o cronograma não tem fase em que a inscrição é respondida. Acrescente a fase de inscrição.',
        ],
      };
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
      this.store.draft().identificacao.origemCandidatos === OrigemCandidatos.inscricaoPropria
    );
  }
}
