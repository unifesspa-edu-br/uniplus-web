import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { rascunhoDifereDoGravado } from '../formulario-do-processo';
import {
  emOrdemDasFinalidades,
  formulariosDoRascunho,
  nomeDaFinalidade,
} from '../formularios-por-finalidade';
import { LeituraDoProcessoNoFormulario } from '../servicos/leitura-do-processo-no-formulario.service';

/**
 * Os links que abrem a simulação da inscrição em nova aba, sem sair do assistente. Ela usa o
 * processo gravado: só se pode simular o que está gravado.
 */
@Component({
  selector: 'sel-simulacao-do-formulario',
  imports: [RouterLink],
  templateUrl: './simulacao.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: block;
    }
    :host > .step-section {
      margin-block: 0;
    }
  `,
})
export class SimulacaoDoFormularioComponent {
  protected readonly store = inject(ProcessoSeletivoStore);
  private readonly leitura = inject(LeituraDoProcessoNoFormulario);

  /** Os formulários que se pode simular: os gravados, porque a API monta a simulação deles. */
  protected readonly formulariosParaSimular = computed(() =>
    emOrdemDasFinalidades(this.leitura.processoLido()?.formularios ?? []).map((formulario) => ({
      finalidade: formulario.finalidade,
      nome: nomeDaFinalidade(formulario.finalidade),
    })),
  );

  /** Há alteração nos formulários ainda não gravada: a simulação não a veria. */
  protected readonly simulacaoDesatualizada = computed(() =>
    rascunhoDifereDoGravado(
      this.leitura.processoLido()?.formularios ?? [],
      formulariosDoRascunho(this.store.draft().formulario),
    ),
  );
}
