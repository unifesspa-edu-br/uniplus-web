import { Injectable, computed, inject, signal } from '@angular/core';
import { map } from 'rxjs';
import {
  VocabulariosDaComprovacaoApi,
  type FormaDeComprovacaoDto,
} from '@uniplus/shared-data/selecao';
import { dadosOuNulo, LeituraDeCatalogo } from './leitura-de-catalogo';

@Injectable()
export class CatalogoDasFormasDeComprovacao {
  private readonly api = inject(VocabulariosDaComprovacaoApi);
  readonly formas = signal<readonly FormaDeComprovacaoDto[]>([]);
  private readonly leitura = new LeituraDeCatalogo({
    buscar: () => this.api.listarFormasDeComprovacao().pipe(map(dadosOuNulo)),
    aplicar: (formas) => this.formas.set(formas),
    mensagemDeErro: 'Não foi possível carregar as formas de comprovação. Tente novamente.',
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
