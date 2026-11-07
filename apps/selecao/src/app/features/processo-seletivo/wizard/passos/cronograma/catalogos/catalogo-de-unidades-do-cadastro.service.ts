import { Injectable, computed, inject, signal } from '@angular/core';
import { map } from 'rxjs';
import { coletarPaginas } from '@uniplus/shared-core/http';
import { UnidadeDto, UnidadesApi } from '@uniplus/shared-data/organizacao';

import { comoOpcaoDeUnidade } from '../../../shared/unidades-do-cadastro';
import { dadosOuNulo, LeituraDeCatalogo } from './leitura-de-catalogo';

/**
 * As unidades do cadastro, a mesma lista que a unidade administradora do processo oferece. A falta
 * delas não impede editar o cronograma, só a escolha da unidade de cada fase, e por isso tem o
 * próprio caminho de nova tentativa.
 */
@Injectable()
export class CatalogoDeUnidadesDoCadastro {
  private readonly unidadesApi = inject(UnidadesApi);

  readonly unidades = signal<readonly UnidadeDto[]>([]);
  readonly opcoes = computed(() => this.unidades().map(comoOpcaoDeUnidade));

  private readonly leitura = new LeituraDeCatalogo({
    buscar: () =>
      coletarPaginas((cursor) => this.unidadesApi.listar({ cursor })).pipe(map(dadosOuNulo)),
    aplicar: (dados) => this.unidades.set(dados),
    mensagemDeErro: 'Não foi possível carregar as unidades.',
  });

  readonly carregando = this.leitura.carregando;
  readonly erro = this.leitura.erro;

  /** Verdadeiro só depois que o cadastro de unidades respondeu com sucesso. */
  readonly carregada = computed(() => !this.carregando() && this.erro() === null);

  carregar(): void {
    this.leitura.carregar();
  }

  /** Busca de novo, descartando a resposta de uma busca anterior ainda em voo. */
  recarregar(): void {
    this.leitura.recarregar();
  }
}
