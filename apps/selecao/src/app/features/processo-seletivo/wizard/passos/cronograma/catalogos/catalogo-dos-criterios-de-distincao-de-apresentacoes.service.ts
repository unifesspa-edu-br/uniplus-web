import { Injectable, computed, inject, signal } from '@angular/core';
import { map } from 'rxjs';
import {
  VocabulariosDaComprovacaoApi,
  type OpcaoDeComprovacaoDto,
} from '@uniplus/shared-data/selecao';
import { dadosOuNulo, LeituraDeCatalogo } from './leitura-de-catalogo';

@Injectable()
export class CatalogoDosCriteriosDeDistincaoDeApresentacoes {
  private readonly api = inject(VocabulariosDaComprovacaoApi);
  readonly criterios = signal<readonly OpcaoDeComprovacaoDto[]>([]);
  private readonly leitura = new LeituraDeCatalogo({
    buscar: () => this.api.listarCriteriosDeDistincaoDeApresentacoes().pipe(map(dadosOuNulo)),
    aplicar: (opcoes) => this.criterios.set(opcoes),
    mensagemDeErro:
      'Não foi possível carregar critérios de distinção de apresentações. Tente novamente.',
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
