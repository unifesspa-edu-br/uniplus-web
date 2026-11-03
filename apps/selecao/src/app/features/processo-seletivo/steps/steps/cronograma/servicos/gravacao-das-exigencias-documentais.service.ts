import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { isApiOk, ProblemI18nService } from '@uniplus/shared-core/http';
import { OrigemCandidatos, ProcessosSeletivosApi } from '@uniplus/shared-data/selecao';

import type { StepValidation } from '../../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { CadastroInicialService } from '../../../shared/cadastro-inicial.service';
import {
  CamposPressupostosService,
  fatosCitadosPelasModalidadesOfertadas,
} from '../../../shared/campos-pressupostos.service';
import { todasAsExigencias } from '../../../shared/exigencias/consulta-das-exigencias';
import { arvoreDeExigencias } from '../../../shared/exigencias/gravacao-das-exigencias';
import { modalidadesDaExigencia } from '../../../shared/exigencias/recorte-por-modalidade';
import { recusaDaExigenciaDoServidor } from '../../../shared/orientacao-da-recusa-do-fato';
import { quemCitaNoProcesso } from '../../formulario/formulario-de-inscricao';
import { finalidadesQueAtende } from '../../formulario/formularios-por-finalidade';

/** A última gravação do passo: os documentos que cada fase exige, depois das fases e das etapas. */
@Injectable()
export class GravacaoDasExigenciasDocumentais {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly cadastro = inject(CadastroInicialService);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly api = inject(ProcessosSeletivosApi);
  private readonly camposPressupostos = inject(CamposPressupostosService);

  /**
   * Grava os documentos que cada fase exige.
   *
   * A conversão precisa do id de cada fase, que o rascunho não guarda — ele identifica
   * a fase pelo código canônico, que é o que sobrevive à reconciliação do servidor. A
   * releitura aqui é a que traduz um no outro; sem ela, a exigência sairia apontando
   * para uma fase que só existe no rascunho.
   */
  async gravar(processoId: string): Promise<StepValidation> {
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

    const faseIdPorCodigo = new Map(detalhe.data.cronogramaFases.map((f) => [f.codigo, f.id]));
    const raizes = arvoreDeExigencias(
      this.store.draft().documentos,
      faseIdPorCodigo,
      this.store.modalidadesDoProcesso(),
      new Set(detalhe.data.etapas.map((etapa) => etapa.id)),
      // O formulário de cada fase pelas fases que acabaram de ser gravadas: é contra elas que o
      // servidor confere o formulário de cada documento.
      new Map(
        detalhe.data.cronogramaFases.map((fase) => [fase.codigo, finalidadesQueAtende(fase)]),
      ),
    );

    // Os campos do formulário saem ANTES das exigências, e não é preferência de ordem: uma
    // exigência condicionada a um fato só se resolve se o certame coletar aquele fato. Quem
    // declara a condição é este passo, então é ele que garante o campo — o operador não
    // deveria precisar lembrar que decidir de quem o documento é cobrado mexe no formulário.
    // A exigência recortada por modalidade depende também das perguntas que as regras das
    // modalidades ofertadas fazem: é delas que a modalidade do candidato se deriva.
    const recorta = todasAsExigencias(this.store.draft().documentos).some(
      (exigencia) => modalidadesDaExigencia(exigencia) !== null,
    );
    const citadosPelasModalidades = this.pedePerguntasDasModalidades(recorta)
      ? fatosCitadosPelasModalidadesOfertadas(detalhe.data)
      : new Set<string>();

    const draft = this.store.draft();
    const citadosPelasExigencias = new Set(
      quemCitaNoProcesso({
        documentos: draft.documentos,
        derivacao: detalhe.data.regrasDerivacao ?? [],
        desempate: draft.desempate,
      }).keys(),
    );
    const campos = await this.camposPressupostos.garantirCampos(
      processoId,
      detalhe.data,
      new Set([...citadosPelasExigencias, ...citadosPelasModalidades]),
    );
    if (geracao !== this.store.geracao()) return { valid: true };
    if (campos.tipo === 'recusados') {
      return {
        valid: false,
        messages: [`As etapas e o cronograma foram gravados. ${campos.motivo}`],
      };
    }
    if (
      campos.tipo === 'semFaseDeInscricao' &&
      (recorta || !this.camposPressupostos.coletaTudo(detalhe.data, citadosPelasExigencias))
    ) {
      // Sem a fase de inscrição, as perguntas das modalidades esperam por ela; a exigência que
      // depende de um dado, não.
      return {
        valid: false,
        messages: [
          'As etapas e o cronograma foram gravados. Uma exigência documental depende de um dado que o formulário de inscrição precisa coletar, e o cronograma não tem fase em que a inscrição é respondida. Acrescente a fase de inscrição.',
        ],
      };
    }

    const gravacao = await this.cadastro.definirDocumentosExigidos(processoId, raizes);
    if (geracao !== this.store.geracao()) return { valid: true };
    if (!gravacao.ok) {
      return {
        valid: false,
        messages: [
          `As etapas, o cronograma e o formulário de inscrição foram gravados. ${recusaDaExigenciaDoServidor(gravacao.problem) ?? this.problemI18n.resolve(gravacao.problem).title}`,
        ],
      };
    }

    return { valid: true };
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
