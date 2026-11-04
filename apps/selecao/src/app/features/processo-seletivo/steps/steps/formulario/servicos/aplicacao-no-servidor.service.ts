import { inject, Injectable } from '@angular/core';
import { isApiOk, ProblemI18nService } from '@uniplus/shared-core/http';
import type { AplicacaoDeModeloDto, ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';

import { CadastroInicialService } from '../../../shared/cadastro-inicial.service';
import { conteudoDoFormulario, formularioDaFinalidade } from '../formulario-do-processo';
import { nomeDaFinalidade } from '../formularios-por-finalidade';
import {
  faseQueAAplicacaoDeclara,
  type FaseDaAplicacao,
  type ProcessoAposAplicacao,
} from '../modelo-de-formulario';
import { LeituraDoProcessoNoFormularioService } from './leitura-do-processo-no-formulario.service';
import { textoDaRecusa } from './texto-da-recusa';

/** O desfecho da aplicação de um modelo: a recusa a mostrar, ou o que o servidor relatou e ficou tendo. */
export type DesfechoDaAplicacao =
  /**
   * `copiaConfirmada`: nulo quando a recusa é definitiva e nada foi copiado; `false` quando a cópia
   * pode ter acontecido; `true` quando aconteceu e a releitura falhou.
   */
  | { readonly ok: false; readonly recusa: string; readonly copiaConfirmada: boolean | null }
  | {
      readonly ok: true;
      readonly relato: AplicacaoDeModeloDto;
      readonly servidor: ProcessoAposAplicacao;
      readonly avisoDaFase: string | null;
    };

/**
 * A sequência de chamadas que aplica um modelo ao processo: o que o servidor tem, a cópia, a fase
 * declarada quando a cópia ficou sem ela e a releitura que projeta o resultado.
 */
@Injectable()
export class AplicacaoNoServidorService {
  private readonly cadastro = inject(CadastroInicialService);
  private readonly leitura = inject(LeituraDoProcessoNoFormularioService);
  private readonly problemI18n = inject(ProblemI18nService);

  /**
   * A aplicação no servidor: relê o processo para saber se o formulário existe e com que fase, aplica
   * o modelo, declara a fase quando a cópia ficou sem ela e relê de novo para projetar o resultado.
   * A fase precisa estar no cronograma gravado ANTES da cópia: sem ela, o formulário nasceria sem
   * fase, e a publicação o recusa.
   */
  async aplicar(
    processoId: string,
    finalidade: string,
    modeloId: string,
    faseDaAba: string,
  ): Promise<DesfechoDaAplicacao> {
    const fase = await this.faseAAplicar(processoId, finalidade, faseDaAba);
    if ('ok' in fase) return fase;

    const aplicacao = await this.cadastro.aplicarModeloDeFormulario(processoId, modeloId);
    if (!aplicacao.ok)
      return {
        ok: false,
        recusa: textoDaRecusa(aplicacao.problem, this.problemI18n),
        copiaConfirmada: aplicacao.inconclusiva ? false : null,
      };

    const depois = await this.leitura.ler(processoId);
    if (!isApiOk(depois)) return { ok: false, recusa: '', copiaConfirmada: true };

    const avisoDaFase =
      fase.declarar && fase.faseId !== null
        ? await this.declararFase(processoId, finalidade, depois.data, fase.faseId)
        : null;
    return {
      ok: true,
      relato: aplicacao.relato,
      avisoDaFase,
      servidor: processoAposAplicacao(depois.data),
    };
  }

  /**
   * Relê o processo para saber se o formulário existe e com que fase. A fase precisa estar no
   * cronograma gravado antes da cópia; sem ela, a recusa volta como desfecho.
   */
  private async faseAAplicar(
    processoId: string,
    finalidade: string,
    faseDaAba: string,
  ): Promise<FaseDaAplicacao | Extract<DesfechoDaAplicacao, { ok: false }>> {
    const antes = await this.leitura.ler(processoId);
    if (!isApiOk(antes))
      return {
        ok: false,
        recusa: 'Não foi possível reler o processo para aplicar o modelo. Tente de novo.',
        copiaConfirmada: null,
      };
    const fase = faseQueAAplicacaoDeclara(
      formularioDaFinalidade(antes.data.formularios, finalidade),
      faseDaAba,
      antes.data.cronogramaFases,
    );
    if (fase.declarar && fase.faseId === null)
      return {
        ok: false,
        recusa: `O formulário de ${nomeDaFinalidade(finalidade)} precisa de uma fase do cronograma gravado antes de partir de um modelo. Escolha a fase nesta aba; se ela é nova, grave antes o passo Cronograma.`,
        copiaConfirmada: null,
      };
    return fase;
  }

  /** Declara a fase quando a cópia ficou sem ela. Devolve o aviso quando o servidor recusou. */
  private async declararFase(
    processoId: string,
    finalidade: string,
    processo: ProcessoSeletivoDto,
    faseId: string,
  ): Promise<string | null> {
    const copiado = formularioDaFinalidade(processo.formularios, finalidade);
    if (copiado === null) return null;

    const conteudo = conteudoDoFormulario(copiado);
    const cabecalho = await this.cadastro.gravarFormulario(
      processoId,
      finalidade,
      { faseId: copiado.faseId, conteudo },
      { faseId, conteudo },
    );
    return cabecalho.ok
      ? null
      : `A fase do formulário não foi gravada: ${textoDaRecusa(cabecalho.problem, this.problemI18n)} Grave o passo para declará-la.`;
  }
}

/** O processo relido como a projeção da aplicação o precisa. */
function processoAposAplicacao(processo: ProcessoSeletivoDto): ProcessoAposAplicacao {
  return {
    formularios: processo.formularios,
    cronogramaFases: processo.cronogramaFases,
    regrasDerivacao: processo.regrasDerivacao.map((config) => ({
      codigoFato: config.codigoFato,
      regras: config.regras,
    })),
  };
}
