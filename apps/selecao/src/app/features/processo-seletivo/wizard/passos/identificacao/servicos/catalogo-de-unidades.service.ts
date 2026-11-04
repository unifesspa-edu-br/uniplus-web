import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { coletarPaginas, isApiOk } from '@uniplus/shared-core/http';
import { UnidadesApi } from '@uniplus/shared-data/organizacao';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import {
  comoOpcaoDeUnidade,
  opcoesComAsGravadas,
  type OpcaoDeUnidade,
} from '../../../shared/unidades-do-cadastro';

/** As unidades administradoras que o operador pode escolher, com a leitura do catálogo e sua falha. */
@Injectable()
export class CatalogoDeUnidades {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly unidadesApi = inject(UnidadesApi);
  private readonly destroyRef = inject(DestroyRef);

  private readonly catalogo = signal<readonly OpcaoDeUnidade[]>([]);
  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);

  /**
   * Catálogo vivo mais, quando faltar, a unidade que o processo retomado declara.
   *
   * A unidade referenciada pode ter saído do catálogo, e a própria leitura do catálogo pode falhar.
   * Em ambos os casos o campo, congelado depois da criação, abriria sem valor, e o operador não
   * teria como identificar quem administra o certame. O snapshot devolvido por Seleção traz sigla e
   * nome, e é a única fonte desse rótulo nessa situação.
   */
  readonly opcoes = computed<readonly OpcaoDeUnidade[]>(() => {
    const snapshot = this.store.remoteSnapshot()?.unidadeAdministradora;

    return opcoesComAsGravadas(this.catalogo(), snapshot === undefined ? [] : [snapshot]);
  });

  constructor() {
    this.carregar();
  }

  carregar(): void {
    this.carregando.set(true);
    this.erro.set(null);

    coletarPaginas((cursor) => this.unidadesApi.listar({ cursor }))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          if (!isApiOk(result)) {
            this.exibirErro();
            return;
          }
          this.catalogo.set(result.data.map(comoOpcaoDeUnidade));
          this.carregando.set(false);
        },
        error: () => this.exibirErro(),
      });
  }

  private exibirErro(): void {
    this.carregando.set(false);
    this.erro.set('Não foi possível carregar as unidades administradoras. Tente novamente.');
  }
}
