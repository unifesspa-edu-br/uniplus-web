import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LEITURA_DE_MUNICIPIO_POR_CODIGO } from '@uniplus/shared-ui/components';

import type { MunicipioDeProva } from './declaracao-da-prova-presencial';

@Injectable()
export class NomesDosMunicipiosDeProva {
  private readonly ler = inject(LEITURA_DE_MUNICIPIO_POR_CODIGO);
  private readonly destroyRef = inject(DestroyRef);
  private readonly lidos = new Set<string>();
  private readonly nomes = signal<ReadonlyMap<string, string>>(new Map());

  carregar(municipios: readonly MunicipioDeProva[]): void {
    for (const municipio of municipios) {
      if (municipio.nome || this.lidos.has(municipio.codigoIbge)) continue;
      this.lidos.add(municipio.codigoIbge);
      this.lerNome(municipio.codigoIbge);
    }
  }

  private lerNome(codigo: string): void {
    this.ler(codigo)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultado) => {
          if (resultado.ok)
            this.nomes.update((nomes) => new Map(nomes).set(codigo, resultado.data.nome));
        },
        error: () => undefined,
      });
  }

  resolver(municipio: MunicipioDeProva): MunicipioDeProva {
    return { ...municipio, nome: municipio.nome ?? this.nomes().get(municipio.codigoIbge) ?? null };
  }
}
