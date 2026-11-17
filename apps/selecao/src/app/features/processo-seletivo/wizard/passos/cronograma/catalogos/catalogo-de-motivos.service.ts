import { Injectable, inject, signal } from '@angular/core';
import { map } from 'rxjs';
import { coletarPaginas } from '@uniplus/shared-core/http';
import { MotivoDeDecisaoDto, MotivosDeDecisaoApi } from '@uniplus/shared-data/selecao';

import { dadosOuNulo, LeituraDeCatalogo } from './leitura-de-catalogo';

/**
 * Os motivos de decisão do cadastro único, de todos os tipos, lidos por cursor até o fim. Os
 * desativados vêm junto, com `ativo: false`: um motivo desativado não entra em escolha nova, mas
 * segue descrito onde já estava escolhido. A falta do catálogo não impede editar o cronograma,
 * só a escolha dos motivos, e por isso tem o próprio caminho de nova tentativa.
 */
@Injectable()
export class CatalogoDeMotivos {
  private readonly motivosApi = inject(MotivosDeDecisaoApi);

  readonly motivos = signal<readonly MotivoDeDecisaoDto[]>([]);

  private readonly leitura = new LeituraDeCatalogo({
    buscar: () =>
      coletarPaginas((cursor) => this.motivosApi.listar({ apenasAtivos: false, cursor })).pipe(
        map(dadosOuNulo),
      ),
    aplicar: (dados) => this.motivos.set(dados),
    mensagemDeErro: 'Não foi possível carregar os motivos de decisão.',
  });

  readonly carregando = this.leitura.carregando;
  readonly erro = this.leitura.erro;

  carregar(): void {
    this.leitura.carregar();
  }

  /** Busca de novo, descartando a resposta de uma busca anterior ainda em voo. */
  recarregar(): void {
    this.leitura.recarregar();
  }
}
