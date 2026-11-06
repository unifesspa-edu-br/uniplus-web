import {
  ChangeDetectionStrategy,
  Component,
  input,
  linkedSignal,
  output,
  untracked,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { UnidadeDto } from '@uniplus/shared-data/organizacao';
import { IconButtonComponent } from '@uniplus/shared-ui/components';
import { NoDaArvore, idsDosNosComFilhos } from './arvore-de-unidades';

/** A hierarquia de unidades em listas aninhadas, com os botões de cada nó. */
@Component({
  selector: 'cfg-unidades-arvore',
  imports: [NgTemplateOutlet, IconButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './unidades-arvore.component.html',
})
export class UnidadesArvoreComponent {
  readonly arvore = input.required<readonly NoDaArvore[]>();
  readonly temFiltro = input.required<boolean>();
  /** A lista está sendo lida ou gravada: as ações das linhas não valem. */
  readonly indisponivel = input.required<boolean>();
  readonly detalhar = output<UnidadeDto>();
  readonly editar = output<UnidadeDto>();
  readonly remover = output<UnidadeDto>();

  /**
   * Os nós expandidos, semeados a partir da árvore que chega e não do filtro: a listagem é
   * filtrada no servidor, então o resultado só existe depois da resposta. Com filtro, todo nó com
   * filhos entra expandido, senão um resultado dentro de ramo recolhido ficaria invisível; sem
   * filtro, vale o que a pessoa expandiu. Semear, em vez de forçar `expandido` a devolver `true`,
   * mantém o botão honesto: ele opera sobre este conjunto, e `aria-expanded` acompanha.
   */
  private readonly expandidos = linkedSignal<readonly NoDaArvore[], Set<string>>({
    source: () => this.arvore(),
    computation: (arvore, anterior) =>
      untracked(() => this.temFiltro())
        ? idsDosNosComFilhos(arvore)
        : new Set(anterior?.value ?? []),
  });

  protected expandido(id: string): boolean {
    return this.expandidos().has(id);
  }

  protected alternar(id: string): void {
    this.expandidos.update((conjunto) => {
      const proximo = new Set(conjunto);
      if (!proximo.delete(id)) {
        proximo.add(id);
      }
      return proximo;
    });
  }
}
