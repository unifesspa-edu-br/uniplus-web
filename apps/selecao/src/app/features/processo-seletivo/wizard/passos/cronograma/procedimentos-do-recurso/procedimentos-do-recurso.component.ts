import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import type {
  ItemDeAvaliacaoDaEtapa,
  ProcedimentoDeRecurso,
} from '../../../processo-seletivo.models';
import { CatalogoDeRegras } from '../catalogos/catalogo-de-regras.service';
import { procedimentosParaLeitura } from './procedimentos-para-leitura';

/**
 * Os procedimentos declarados do recurso de uma fase ou de uma etapa, só para leitura. A sugestão
 * do servidor aparece ao lado como dica: não preenche nem troca nada do que foi declarado.
 */
@Component({
  selector: 'sel-procedimentos-do-recurso',
  templateUrl: './procedimentos-do-recurso.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[hidden]': 'linhas().length === 0' },
})
export class ProcedimentosDoRecursoComponent {
  private readonly catalogoDeRegras = inject(CatalogoDeRegras);

  readonly procedimentos = input.required<readonly ProcedimentoDeRecurso[]>();
  /** Os itens da etapa, que dão nome ao item contestado; vazio no recurso da fase. */
  readonly itensDaEtapa = input<readonly ItemDeAvaliacaoDaEtapa[]>([]);
  /** O `id` do título da lista, único na tela, que a lista referencia como rótulo. */
  readonly idDoTitulo = input.required<string>();

  protected readonly linhas = computed(() =>
    procedimentosParaLeitura(
      this.procedimentos(),
      this.catalogoDeRegras.regrasProcedimento(),
      this.itensDaEtapa(),
    ),
  );
}
