import { DestroyRef, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, switchMap } from 'rxjs';
import { ProblemI18nService, STATUS_HTTP } from '@uniplus/shared-core/http';
import {
  ProtecaoDoCatalogoApi,
  type CadastroDoCatalogo,
  type DetalheDaProtecaoDoCatalogoDto,
} from '@uniplus/shared-data/configuracao';

interface Pedido {
  readonly cadastro: CadastroDoCatalogo;
  readonly id: string;
}

/**
 * A leitura do detalhe de um item do catálogo para a proteção de dados: carga, recusa e item
 * inexistente. Cada leitura cancela a anterior, então a resposta velha que chega depois não
 * sobrescreve a nova; quem a usa lê os sinais e chama `ler` e `recarregar`.
 */
export class LeituraDoDetalhe {
  readonly detalhe = signal<DetalheDaProtecaoDoCatalogoDto | null>(null);
  readonly carregando = signal(false);
  readonly erro = signal<string | null>(null);
  readonly naoEncontrado = signal(false);

  private readonly pedidos = new Subject<Pedido>();
  private ultimoPedido: Pedido | null = null;

  constructor(api: ProtecaoDoCatalogoApi, problemI18n: ProblemI18nService, destroyRef: DestroyRef) {
    this.pedidos
      .pipe(
        switchMap((pedido) => {
          this.carregando.set(true);
          this.erro.set(null);
          this.naoEncontrado.set(false);
          this.detalhe.set(null);
          return api.detalhar(pedido.cadastro, pedido.id);
        }),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe((resultado) => {
        this.carregando.set(false);
        if (resultado.ok) {
          this.detalhe.set(resultado.data);
          return;
        }
        this.naoEncontrado.set(resultado.problem.status === STATUS_HTTP.NAO_ENCONTRADO);
        this.erro.set(
          this.naoEncontrado()
            ? 'O item não existe mais no catálogo.'
            : problemI18n.resolve(resultado.problem).title,
        );
      });
  }

  ler(cadastro: CadastroDoCatalogo, id: string): void {
    this.ultimoPedido = { cadastro, id };
    this.pedidos.next(this.ultimoPedido);
  }

  recarregar(): void {
    if (this.ultimoPedido !== null) this.pedidos.next(this.ultimoPedido);
  }
}
