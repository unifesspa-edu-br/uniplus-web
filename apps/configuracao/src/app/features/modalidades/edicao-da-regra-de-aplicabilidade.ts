import { Injectable, computed, inject, signal } from '@angular/core';
import type { ModalidadeDto } from '@uniplus/shared-data/configuracao';
import {
  deClausulasDoWire,
  descreverAlternativas,
  fatosParaLeitura,
  paraClausulasDoWire,
  problemaDaCondicao,
  type CondicaoEmClausula,
} from '@uniplus/shared-ui/components';

import { ModalidadeFormStore } from './modalidade-form.store';
import { fatosDaRegraDeAplicabilidade } from './regra-de-aplicabilidade';

export type EstadoDoCatalogo = 'erro' | 'carregando' | 'pronto';

/** A regra de aplicabilidade em edição: as condições, o que as impede de ser gravadas e as recusas da API. */
@Injectable()
export class EdicaoDaRegraDeAplicabilidade {
  private readonly store = inject(ModalidadeFormStore);
  private readonly catalogo = this.store.catalogo;

  /** Sem condição, a modalidade vale para todos os candidatos. */
  readonly condicoes = signal<readonly CondicaoEmClausula[]>([]);
  /** O que impede cada condição de ser gravada, pela posição dela na regra. */
  readonly errosDasCondicoes = signal<Readonly<Record<number, string>>>({});
  /** As recusas da API à regra. */
  readonly recusas = signal<readonly string[]>([]);
  /** A modalidade do catálogo legal fixo tem a regra fixada em lei. */
  readonly fixadaEmLei = signal(false);

  /** Os fatos que a regra salva cita, que o editor continua oferecendo mesmo desativados. */
  private readonly fatosJaCitados = signal<ReadonlySet<string>>(new Set());

  readonly estadoDoCatalogo = computed<EstadoDoCatalogo>(() => {
    if (this.store.catalogoComErro()) return 'erro';
    return this.catalogo.data() === null ? 'carregando' : 'pronto';
  });
  /** O catálogo está sendo lido de novo: o "Tentar novamente" fica indisponível, sem perder o foco. */
  readonly catalogoPendente = this.catalogo.isLoading;
  readonly fatos = computed(() =>
    fatosDaRegraDeAplicabilidade(this.catalogo.data() ?? [], this.fatosJaCitados()),
  );
  private readonly fatosPorCodigo = computed(() => fatosParaLeitura(this.catalogo.data() ?? []));
  readonly leitura = computed(() => descreverAlternativas(this.condicoes(), this.fatosPorCodigo()));

  carregar(dto: ModalidadeDto): void {
    const condicoes = deClausulasDoWire(dto.regraDeAplicabilidade);
    this.condicoes.set(condicoes);
    this.fixadaEmLei.set(dto.legalFixa);
    this.fatosJaCitados.set(new Set(condicoes.map((condicao) => condicao.fato)));
  }

  trocar(condicoes: readonly CondicaoEmClausula[]): void {
    this.condicoes.set(condicoes);
    this.errosDasCondicoes.set({});
    this.recusas.set([]);
  }

  recarregarCatalogo(): void {
    this.catalogo.reload();
  }

  paraOWire(): ReturnType<typeof paraClausulasDoWire> {
    return paraClausulasDoWire(this.condicoes());
  }

  /**
   * Confere cada condição antes de enviar, como o editor de regras padrão: a API recusaria a
   * condição sem valor ou fora do domínio, e a recusa no campo da regra não diria qual delas.
   * A regra fixada em lei não passa pelo editor e segue como veio; sem o catálogo, a tela não
   * tem contra o que conferir e a palavra fica com a API.
   */
  conferir(): boolean {
    if (this.fixadaEmLei() || this.catalogo.data() === null) return true;
    const fatos = new Map(this.fatos().map((fato) => [fato.codigo, fato]));
    const erros: Record<number, string> = {};
    this.condicoes().forEach((condicao, indice) => {
      const problema = problemaDaCondicao(condicao, fatos);
      if (problema !== null) erros[indice] = problema;
    });
    this.errosDasCondicoes.set(erros);
    return Object.keys(erros).length === 0;
  }
}
