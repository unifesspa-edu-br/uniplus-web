import { Injectable, computed, effect, inject, linkedSignal, signal } from '@angular/core';
import type { UnidadeDto } from '@uniplus/shared-data/organizacao';
import { OpcoesDaUnidadeSuperior } from './opcoes-da-unidade-superior';
import { UnidadesStore } from './unidades.store';

/** A unidade em exibição no drawer de detalhe e o rótulo da sua unidade superior. */
@Injectable()
export class DetalheDaUnidade {
  private readonly store = inject(UnidadesStore);
  private readonly opcoes = inject(OpcoesDaUnidadeSuperior);

  readonly aberto = signal(false);
  readonly unidade = signal<UnidadeDto | null>(null);

  /**
   * Unidades já vistas (páginas da lista e busca de pai), por id. Com filtro no servidor o pai
   * pode sair da página, mas se já foi carregado antes o rótulo continua resolvendo.
   */
  private readonly conhecidas = linkedSignal<
    { lista: readonly UnidadeDto[]; opcoes: readonly UnidadeDto[] },
    ReadonlyMap<string, UnidadeDto>
  >({
    source: () => ({ lista: this.store.unidades(), opcoes: this.opcoes.opcoes() }),
    computation: (vistas, anterior) => {
      const mapa = new Map(anterior?.value ?? []);
      for (const unidade of [...vistas.lista, ...vistas.opcoes]) {
        mapa.set(unidade.id, unidade);
      }
      return mapa;
    },
  });

  constructor() {
    // O acúmulo só vale se rodar a cada página que chega: lido apenas ao abrir o detalhe, o
    // cache nunca veria a página anterior ao filtro.
    effect(() => this.conhecidas());
  }

  abrir(unidade: UnidadeDto): void {
    this.unidade.set(unidade);
    this.aberto.set(true);
  }

  fechar(): void {
    this.aberto.set(false);
  }

  readonly rotuloDaSuperior = computed(() =>
    this.rotuloDe(this.unidade()?.unidadeSuperiorId ?? null),
  );

  rotuloDe(id: string | null): string {
    if (id === null) {
      return 'Sem superior';
    }
    const superior = this.conhecidas().get(id);
    return superior ? `${superior.sigla} — ${superior.nome}` : 'Não carregada';
  }
}
