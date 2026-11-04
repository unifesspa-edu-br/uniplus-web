import { Injectable, inject, signal } from '@angular/core';
import { map } from 'rxjs';
import { FatoCandidatoView, FatosCandidatoApi } from '@uniplus/shared-data/configuracao';

import { dadosOuNulo, LeituraDeCatalogo } from './leitura-de-catalogo';

/**
 * O catálogo de fatos do candidato, conjunto fechado, semeado e governado por código — o servidor
 * o devolve inteiro. É lido por quem grava as exigências, e não só pelo passo do formulário: um
 * gatilho que cita um fato obriga o certame a coletá-lo, e sintetizar esse campo exige saber o
 * nome e o domínio do fato.
 */
@Injectable()
export class CatalogoDeFatos {
  private readonly fatosApi = inject(FatosCandidatoApi);

  readonly fatos = signal<readonly FatoCandidatoView[]>([]);

  private readonly leitura = new LeituraDeCatalogo({
    buscar: () => this.fatosApi.listar().pipe(map(dadosOuNulo)),
    aplicar: (dados) => this.fatos.set(dados),
    mensagemDeErro: 'Não foi possível carregar os fatos do candidato. Tente novamente.',
  });

  readonly carregando = this.leitura.carregando;
  readonly erro = this.leitura.erro;

  carregar(): void {
    this.leitura.carregar();
  }
}
