import { DestroyRef, Signal, computed, inject, untracked } from '@angular/core';
import type { Observable } from 'rxjs';
import { lookupCompleto, type ApiResult, type LookupCompleto } from '@uniplus/shared-core/http';

/** Um item de vocabulário da API: o código do contrato e o nome que a tela mostra. */
export interface ItemDeVocabulario {
  readonly codigo: string;
  readonly rotulo: string;
}

/**
 * Um vocabulário que a API publica, com o estado da leitura. O nome de cada código vem sempre da
 * resposta: a tela não escreve texto de vocabulário.
 */
export interface Vocabulario<T extends ItemDeVocabulario> {
  /** Os itens na ordem da API; vazio até a primeira resposta. */
  readonly itens: Signal<readonly T[]>;
  /** Verdadeiro desde a criação até a primeira resposta, e durante cada nova busca. */
  readonly carregando: Signal<boolean>;
  /** A mensagem da falha, da recusa ou da lista vazia; `null` quando a leitura deu certo. */
  readonly erro: Signal<string | null>;
  /** O nome do código; o código desconhecido volta como veio. */
  readonly rotulo: Signal<(codigo: string) => string>;
  /** Busca uma vez; depois de uma falha, busca de novo. */
  carregar(): void;
  /** Busca de novo e descarta a resposta antiga que ainda estiver a caminho. */
  recarregar(): void;
}

class VocabularioLido<T extends ItemDeVocabulario> implements Vocabulario<T> {
  private iniciado = false;
  private readonly leitura: LookupCompleto<T>;
  readonly itens: Signal<readonly T[]>;
  readonly carregando: Signal<boolean>;
  readonly erro: Signal<string | null>;
  readonly rotulo: Signal<(codigo: string) => string>;

  constructor(listar: () => Observable<ApiResult<readonly T[]>>, mensagemDeErro: string) {
    this.leitura = lookupCompleto<T>(() => listar(), inject(DestroyRef));
    this.itens = this.leitura.opcoes;
    this.carregando = this.leitura.pendente;
    this.erro = computed(() => (this.falhou() ? mensagemDeErro : null));
    this.rotulo = computed(() => rotuloDosCodigos(this.itens()));
  }

  carregar(): void {
    if (!this.iniciado || untracked(this.erro) !== null) this.recarregar();
  }

  recarregar(): void {
    this.iniciado = true;
    this.leitura.recarregar();
  }

  private falhou(): boolean {
    return this.leitura.comErro() || (!this.carregando() && this.itens().length === 0);
  }
}

function rotuloDosCodigos(itens: readonly ItemDeVocabulario[]): (codigo: string) => string {
  const rotulos = new Map(itens.map(({ codigo, rotulo }) => [codigo, rotulo]));
  return (codigo) => rotulos.get(codigo) ?? codigo;
}

/**
 * Lê um vocabulário da API sobre o `lookupCompleto`. Chamar em contexto de injeção: a busca em
 * andamento termina junto com o dono.
 *
 * @param listar a consulta, sem paginação: o vocabulário vem inteiro.
 * @param mensagemDeErro o que a tela diz quando a leitura falha ou volta vazia.
 */
export function criarVocabulario<T extends ItemDeVocabulario>(
  listar: () => Observable<ApiResult<readonly T[]>>,
  mensagemDeErro: string,
): Vocabulario<T> {
  return new VocabularioLido(listar, mensagemDeErro);
}

/**
 * As opções que a tela oferece: os itens do vocabulário, na ordem da API, e depois cada código já
 * declarado que ele não conhece, para a pessoa poder vê-lo e retirá-lo. O declarado desconhecido
 * aparece com o rótulo que a leitura trouxe ou, sendo só o código, com o próprio código. Nenhum
 * código aparece duas vezes.
 */
export function opcoesDoVocabulario(
  itens: readonly ItemDeVocabulario[],
  declarados: readonly (string | ItemDeVocabulario)[],
): readonly ItemDeVocabulario[] {
  const vistos = new Set(itens.map((item) => item.codigo));
  const acrescentados: ItemDeVocabulario[] = [];
  for (const declarado of declarados) {
    const item =
      typeof declarado === 'string' ? { codigo: declarado, rotulo: declarado } : declarado;
    if (vistos.has(item.codigo)) continue;
    vistos.add(item.codigo);
    acrescentados.push(item);
  }
  return [...itens, ...acrescentados];
}
