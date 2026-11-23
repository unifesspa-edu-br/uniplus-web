import { Injectable, computed, inject, signal } from '@angular/core';
import { map } from 'rxjs';
import {
  VocabulariosDaComprovacaoApi,
  type OpcaoDeComprovacaoDto,
} from '@uniplus/shared-data/selecao';
import { dadosOuNulo, LeituraDeCatalogo } from './leitura-de-catalogo';

@Injectable()
export class CatalogoDasConsequenciasDeIndeferimento {
  private readonly api = inject(VocabulariosDaComprovacaoApi);
  readonly consequencias = signal<readonly OpcaoDeComprovacaoDto[]>([]);
  private readonly leitura = new LeituraDeCatalogo({
    buscar: () => this.api.listarConsequenciasDeIndeferimento().pipe(map(dadosOuNulo)),
    aplicar: (opcoes) => this.consequencias.set(opcoes),
    mensagemDeErro: 'Não foi possível carregar consequências de indeferimento. Tente novamente.',
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
