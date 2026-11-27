import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { coletarPaginas, isApiOk, type ApiResult } from '@uniplus/shared-core/http';
import { UnidadesApi, type UnidadeDto } from '@uniplus/shared-data/organizacao';
import { acompanharCatalogo } from '@uniplus/shared-ui/components';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import {
  comoOpcaoDeUnidade,
  opcoesComAsGravadas,
  type OpcaoDeUnidade,
} from '../../../shared/unidades-do-cadastro';

function opcoesOuNulo(
  resultado: ApiResult<readonly UnidadeDto[]>,
): readonly OpcaoDeUnidade[] | null {
  return isApiOk(resultado) ? resultado.data.map(comoOpcaoDeUnidade) : null;
}

/** As unidades administradoras que o operador pode escolher, com a leitura do catálogo e sua falha. */
@Injectable()
export class CatalogoDeUnidades {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly unidadesApi = inject(UnidadesApi);
  private readonly destroyRef = inject(DestroyRef);

  private readonly catalogo = signal<readonly OpcaoDeUnidade[]>([]);
  readonly carregando = signal(true);
  readonly erro = signal<string | null>(null);

  readonly leitura = acompanharCatalogo({
    assunto: 'unidades administradoras',
    falha: this.erro,
    pendente: this.carregando,
    recarregar: () => this.carregar(),
    destino: () => document.getElementById('f-unidade'),
  });

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
      .pipe(map(opcoesOuNulo), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (opcoes) => (opcoes === null ? this.exibirErro() : this.receber(opcoes)),
        error: () => this.exibirErro(),
      });
  }

  private receber(opcoes: readonly OpcaoDeUnidade[]): void {
    this.catalogo.set(opcoes);
    this.carregando.set(false);
  }

  private exibirErro(): void {
    this.erro.set('Não foi possível carregar as unidades administradoras.');
    this.carregando.set(false);
  }
}
