import { DestroyRef, Injectable, Signal, computed, inject } from '@angular/core';
import { lookupCompleto, type LookupCompleto } from '@uniplus/shared-core/http';
import {
  CategoriasDocumentoApi,
  type CategoriaDocumentoDto,
} from '@uniplus/shared-data/configuracao';

/**
 * Catálogo de categorias de documento compartilhado pelo cadastro inteiro.
 *
 * Vive no injector raiz porque é dado de referência: o mesmo catálogo alimenta
 * o `select` do formulário, os chips de filtro e o rótulo da coluna, e nenhuma
 * dessas telas tem motivo para buscá-lo de novo ao ser reaberta. A instância
 * root é o que faz a categoria sobreviver à navegação entre as abas do
 * cadastro, sem cada página pagar uma requisição.
 *
 * Expõe a mesma superfície de `LookupCompleto`, então `resolverVinculo` e
 * `ui-lookup-label` funcionam aqui como em qualquer lookup de chave
 * estrangeira — a diferença é só o tempo de vida.
 */
@Injectable({ providedIn: 'root' })
export class CatalogoCategoriasDocumento implements LookupCompleto<CategoriaDocumentoDto> {
  private readonly api = inject(CategoriasDocumentoApi);
  private readonly lookup = lookupCompleto<CategoriaDocumentoDto>(
    () => this.api.listar(),
    inject(DestroyRef),
  );
  private iniciado = false;

  /** Categorias vivas, na ordem de exibição decidida pelo operador. */
  readonly opcoes: Signal<readonly CategoriaDocumentoDto[]> = this.lookup.opcoes;
  /** `true` quando a última tentativa não trouxe o catálogo. */
  readonly comErro: Signal<boolean> = this.lookup.comErro;
  /** `true` antes da primeira busca e durante cada tentativa. */
  readonly pendente: Signal<boolean> = this.lookup.pendente;

  /** Índice por código — é por ele que o Tipo de Documento referencia a categoria. */
  readonly porCodigo = computed(
    () => new Map(this.opcoes().map((categoria) => [categoria.codigo, categoria] as const)),
  );

  /**
   * Busca o catálogo na primeira vez e reaproveita o que já está em memória
   * nas seguintes. Seguro de chamar a cada abertura de tela: uma tentativa em
   * curso não é reiniciada — reiniciá-la cancelaria a resposta que já vinha e
   * a segunda página exibiria "Carregando…" de novo, sem ganho nenhum.
   *
   * A exceção é a recusa: quando a última tentativa falhou, reentrar na tela
   * tenta de novo. Uma indisponibilidade momentânea não deve obrigar o
   * operador a achar o botão de recarregar para ver um catálogo que já
   * voltaria sozinho.
   */
  garantirCarregado(): void {
    if (this.iniciado && (this.pendente() || !this.comErro())) {
      return;
    }
    this.iniciado = true;
    this.lookup.recarregar();
  }

  /** Busca de novo por pedido explícito, descartando o que estiver em andamento. */
  recarregar(): void {
    this.iniciado = true;
    this.lookup.recarregar();
  }
}
