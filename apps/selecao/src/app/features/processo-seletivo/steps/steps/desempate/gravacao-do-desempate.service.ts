import { inject, Injectable } from '@angular/core';
import { ProblemI18nService, type ProblemDetails } from '@uniplus/shared-core/http';

import type { CriterioDesempateConfigurado, StepValidation } from '../../processo-seletivo.models';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { CadastroInicial } from '../../shared/cadastro-inicial.service';
import {
  gravarNoPasso,
  RESPOSTA_DESCARTADA,
  type RespostaDescartada,
} from '../../shared/gravacao/gravacao-no-passo';
import { ReleituraDoSnapshot } from '../../shared/releitura-do-snapshot.service';
import { resumoDaRecusa } from '../../shared/resumo-da-recusa';
import { comoComandoDeCriteriosDesempate } from './desempate-para-comando';
import { recusaAoGravarODesempate } from './recusas-do-desempate';

/**
 * A gravação da coleção inteira de critérios, na ordem em que está na tela, e o que ela diz ao
 * responder: os critérios que o servidor passou a ter e a recusa com o texto da tela.
 */
@Injectable()
export class GravacaoDoDesempate {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly cadastro = inject(CadastroInicial);
  private readonly releitura = inject(ReleituraDoSnapshot);
  private readonly problemI18n = inject(ProblemI18nService);

  gravar(
    criterios: readonly CriterioDesempateConfigurado[],
    rotuloDaArea: (codigo: string) => string,
  ): Promise<StepValidation | RespostaDescartada> {
    const processoId = this.store.processoSeletivoId();
    if (processoId === null) {
      return Promise.resolve({
        valid: false,
        messages: [
          'O cadastro do processo precisa estar concluído antes de configurar o desempate.',
        ],
      });
    }

    return gravarNoPasso(this.store, async () => {
      const geracao = this.store.geracao();
      const resultado = await this.releitura.gravando(() =>
        this.enviar(processoId, criterios, geracao),
      );

      if (geracao !== this.store.geracao()) return RESPOSTA_DESCARTADA;
      return resultado.ok
        ? { valid: true }
        : {
            valid: false,
            messages: this.mensagensDaRecusa(resultado.problem, criterios, rotuloDaArea),
          };
    });
  }

  /** Envia os critérios e registra no store o que o servidor passou a ter. */
  private async enviar(
    processoId: string,
    criterios: readonly CriterioDesempateConfigurado[],
    geracao: number,
  ) {
    const resposta = await this.cadastro.definirCriteriosDesempate(
      processoId,
      comoComandoDeCriteriosDesempate(criterios),
    );
    if (geracao !== this.store.geracao()) return resposta;
    if (resposta.ok) {
      this.store.classificacao.criteriosDesempateGravados.set(criterios);
      this.store.classificacao.desempatePendenteDeGravacao.set(false);
    } else if (resposta.inconclusiva) {
      // O servidor pode ter gravado: o que ele tem deixa de ser sabido até a releitura.
      this.store.classificacao.criteriosDesempateGravados.set(null);
    }
    return resposta;
  }

  /**
   * O resumo da recusa: cada recusa ao critério por área com o texto da tela, o critério e a área
   * que o campo aponta; e o título da raiz quando há erro de outro tipo ou nenhum erro de campo.
   */
  private mensagensDaRecusa(
    problema: ProblemDetails,
    criterios: readonly CriterioDesempateConfigurado[],
    rotuloDaArea: (codigo: string) => string,
  ): string[] {
    return resumoDaRecusa(
      problema,
      (erro) => recusaAoGravarODesempate(erro, criterios, rotuloDaArea),
      () => this.problemI18n.resolve(problema).title,
    );
  }
}
