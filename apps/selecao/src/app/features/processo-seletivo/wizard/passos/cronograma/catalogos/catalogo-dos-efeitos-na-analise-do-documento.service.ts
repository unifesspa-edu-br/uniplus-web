import { Injectable, computed, inject, signal } from '@angular/core';
import { map } from 'rxjs';
import {
  VocabulariosDoPrazoEDaValidadeApi,
  type OpcaoDeComprovacaoDto,
} from '@uniplus/shared-data/selecao';
import { dadosOuNulo, LeituraDeCatalogo } from './leitura-de-catalogo';

@Injectable({ providedIn: 'root' })
export class CatalogoDosEfeitosNaAnaliseDoDocumento {
  private readonly api = inject(VocabulariosDoPrazoEDaValidadeApi);
  readonly efeitosNaAnaliseDoDocumento = signal<readonly OpcaoDeComprovacaoDto[]>([]);
  private readonly leitura = new LeituraDeCatalogo({
    buscar: () => this.api.listarEfeitosNaAnaliseDoDocumento().pipe(map(dadosOuNulo)),
    aplicar: (opcoes) => this.efeitosNaAnaliseDoDocumento.set(opcoes),
    mensagemDeErro:
      'Não foi possível carregar os efeitos na análise do documento. Tente novamente.',
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
