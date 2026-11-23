import { Injectable, computed, inject, signal } from '@angular/core';
import { map } from 'rxjs';
import {
  VocabulariosDoPrazoEDaValidadeApi,
  type OpcaoDeComprovacaoDto,
} from '@uniplus/shared-data/selecao';
import { dadosOuNulo, LeituraDeCatalogo } from './leitura-de-catalogo';

@Injectable({ providedIn: 'root' })
export class CatalogoDosTiposDaDataDeReferencia {
  private readonly api = inject(VocabulariosDoPrazoEDaValidadeApi);
  readonly tiposDaDataDeReferencia = signal<readonly OpcaoDeComprovacaoDto[]>([]);
  private readonly leitura = new LeituraDeCatalogo({
    buscar: () => this.api.listarTiposDaDataDeReferencia().pipe(map(dadosOuNulo)),
    aplicar: (opcoes) => this.tiposDaDataDeReferencia.set(opcoes),
    mensagemDeErro: 'Não foi possível carregar os tipos da data de referência. Tente novamente.',
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
