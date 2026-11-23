import { Injectable, computed, inject, signal } from '@angular/core';
import { map } from 'rxjs';
import {
  VocabulariosDaComprovacaoApi,
  type OpcaoDeComprovacaoDto,
} from '@uniplus/shared-data/selecao';
import { dadosOuNulo, LeituraDeCatalogo } from './leitura-de-catalogo';

@Injectable({ providedIn: 'root' })
export class CatalogoDosFormatosPermitidos {
  private readonly api = inject(VocabulariosDaComprovacaoApi);
  readonly formatos = signal<readonly OpcaoDeComprovacaoDto[]>([]);
  private readonly leitura = new LeituraDeCatalogo({
    buscar: () => this.api.listarFormatosPermitidos().pipe(map(dadosOuNulo)),
    aplicar: (opcoes) => this.formatos.set(opcoes),
    mensagemDeErro: 'Não foi possível carregar formatos permitidos. Tente novamente.',
  });
  readonly erro = this.leitura.erro.asReadonly();
  readonly situacao = computed<'carregando' | 'pronto' | 'falhou'>(() => {
    if (this.leitura.carregando()) return 'carregando';
    return this.erro() === null ? 'pronto' : 'falhou';
  });

  carregar(): void {
    this.leitura.carregar();
  }

  repetir(): void {
    this.leitura.recarregar();
  }
}
