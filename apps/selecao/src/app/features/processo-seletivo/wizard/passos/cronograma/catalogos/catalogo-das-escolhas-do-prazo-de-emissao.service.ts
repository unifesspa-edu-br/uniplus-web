import { Injectable, computed, inject, signal } from '@angular/core';
import { map } from 'rxjs';
import {
  VocabulariosDoPrazoEDaValidadeApi,
  type OpcaoDeComprovacaoDto,
} from '@uniplus/shared-data/selecao';
import { dadosOuNulo, LeituraDeCatalogo } from './leitura-de-catalogo';

@Injectable({ providedIn: 'root' })
export class CatalogoDasEscolhasDoPrazoDeEmissao {
  private readonly api = inject(VocabulariosDoPrazoEDaValidadeApi);
  readonly escolhasDoPrazoDeEmissao = signal<readonly OpcaoDeComprovacaoDto[]>([]);
  private readonly leitura = new LeituraDeCatalogo({
    buscar: () => this.api.listarEscolhasDoPrazoDeEmissao().pipe(map(dadosOuNulo)),
    aplicar: (opcoes) => this.escolhasDoPrazoDeEmissao.set(opcoes),
    mensagemDeErro: 'Não foi possível carregar as escolhas do prazo de emissão. Tente novamente.',
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
