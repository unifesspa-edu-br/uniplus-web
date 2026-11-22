import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  TemplateRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import type { BancaDeclarada } from '../../modelos/banca.models';
import { novaChave } from '../chaves/chave-local';
import type { RecusaOrdenada } from '../recusas/ordem-das-recusas';
import { RecusasDoCampoComponent } from '../recusas/recusas-do-campo.component';
import {
  acrescentarBanca,
  gruposPorTipo,
  identificacaoDaBanca,
  moverNoTipo,
  retirarBanca,
} from './lista-de-bancas';

export interface TipoDeBancaEscolhivel {
  readonly id: string;
  readonly rotulo: string;
  readonly exigeDuasOuMaisBancas?: boolean;
  readonly encerraRecursoNaPrimeiraInstancia?: boolean;
  readonly papel?: { readonly codigo: string };
}

@Component({
  selector: 'sel-lista-de-bancas',
  imports: [NgTemplateOutlet, RecusasDoCampoComponent],
  templateUrl: './lista-de-bancas.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListaDeBancasComponent {
  readonly bancas = input.required<readonly BancaDeclarada[]>();
  readonly tipos = input.required<readonly TipoDeBancaEscolhivel[]>();
  readonly recusas = input<readonly RecusaOrdenada[]>([]);
  /** As recusas que apontam a banca inteira; as dos controles dela ficam junto de cada controle. */
  readonly recusasPorBanca = input<ReadonlyMap<string, readonly RecusaOrdenada[]>>(new Map());
  readonly idBase = input.required<string>();
  readonly idRecusas = input<string>();
  readonly edicaoLiberada = input(true);
  readonly textoDoGrupo = input('Bancas do mesmo tipo julgam em paralelo.');
  readonly textoDaExigencia = input('Este tipo exige duas ou mais bancas.');
  readonly detalhe = input<TemplateRef<{ $implicit: BancaDeclarada }> | null>(null);
  readonly bancasChange = output<readonly BancaDeclarada[]>();
  protected readonly grupos = computed(() => gruposPorTipo(this.bancas()));
  protected readonly tipoSelecionado = signal('');
  protected readonly faltaTipo = signal(false);
  protected readonly anuncio = signal('');
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);

  protected identificacao(banca: BancaDeclarada, bancas = this.bancas()): string {
    return identificacaoDaBanca(bancas, banca, this.tipo(banca)?.rotulo ?? '');
  }

  protected tipo(banca: BancaDeclarada): TipoDeBancaEscolhivel | undefined {
    return this.tipos().find((tipo) => tipo.id === banca.tipoBancaId);
  }

  protected rotulo(banca: BancaDeclarada): string {
    return banca.copiaDoTipo?.rotulo ?? this.tipo(banca)?.rotulo ?? '';
  }

  protected marcas(banca: BancaDeclarada) {
    return banca.copiaDoTipo ?? this.tipo(banca);
  }

  protected idDaBanca(banca: BancaDeclarada): string {
    return `${this.idBase()}-${banca.identificadorLocal}`;
  }

  protected escolherTipo(valor: string): void {
    this.tipoSelecionado.set(valor);
    this.faltaTipo.set(false);
  }

  protected acrescentar(): void {
    const tipoBancaId = this.tipoSelecionado();
    if (!tipoBancaId) {
      this.faltaTipo.set(true);
      this.focar(`${this.idBase()}-tipo`);
      return;
    }
    const banca = this.novaBanca(tipoBancaId);
    const novas = acrescentarBanca(this.bancas(), banca);
    this.bancasChange.emit(novas);
    this.anuncio.set(`${this.identificacao(banca, novas)} acrescentada.`);
    this.focar(this.idDaBanca(banca));
  }

  private novaBanca(tipoBancaId: string): BancaDeclarada {
    const tomadas = new Set(this.bancas().map((banca) => banca.identificadorLocal));
    return {
      id: null,
      identificadorLocal: novaChave({ tipo: 'banca', nome: '', tomadas }),
      tipoBancaId,
      copiaDoTipo: null,
      regraDeDeliberacao: null,
    };
  }

  protected retirar(banca: BancaDeclarada, grupo: readonly BancaDeclarada[], indice: number): void {
    const nome = this.identificacao(banca);
    const destino = grupo[indice + 1] ?? grupo[indice - 1];
    this.bancasChange.emit(retirarBanca(this.bancas(), banca.identificadorLocal));
    this.anuncio.set(`${nome} retirada; as seguintes deste tipo mudaram de número.`);
    this.focar(destino ? this.idDaBanca(destino) : `${this.idBase()}-tipo`);
  }

  protected mover(banca: BancaDeclarada, direcao: -1 | 1): void {
    const novas = moverNoTipo(this.bancas(), banca.identificadorLocal, direcao);
    this.bancasChange.emit(novas);
    this.anuncio.set(`A banca movida passou a ser a ${this.identificacao(banca, novas)}.`);
    this.focar(this.idDaBanca(banca));
  }

  private focar(id: string): void {
    setTimeout(() =>
      this.elemento.nativeElement.querySelector<HTMLElement>(`[id="${id}"]`)?.focus(),
    );
  }
}
