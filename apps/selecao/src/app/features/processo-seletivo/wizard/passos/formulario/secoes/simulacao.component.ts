import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { rascunhoDifereDoGravado } from '../formulario-do-processo';
import {
  emOrdemDoCronograma,
  formulariosDoServidor,
  rotuloDoFormulario,
} from '../formularios-do-rascunho';
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
  protected readonly formulariosParaSimular = computed(() => {
    const lido = this.leitura.processoLido();
    if (lido === null) return [];
    const fasesEmOrdem = [...this.store.draft().cronograma.fases]
      .sort((uma, outra) => uma.ordem - outra.ordem)
      .map((fase) => fase.codigo);
    return emOrdemDoCronograma(formulariosDoServidor(lido).formularios, fasesEmOrdem).map(
      (formulario) => ({ codigo: formulario.codigo, nome: rotuloDoFormulario(formulario, null) }),
    );
  });

  /** Há alteração nos formulários ainda não gravada: a simulação não a veria. */
  protected readonly simulacaoDesatualizada = computed(() =>
    rascunhoDifereDoGravado(
      this.leitura.processoLido()?.formularios ?? [],
      this.store.draft().formulario.formularios,
    ),
  );
}
