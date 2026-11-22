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
import { bancaDoCampo } from './campo-da-banca';
import {
  acrescentarBanca,
  gruposPorTipo,
  identificacaoDaBanca,
  moverNoTipo,
  retirarBanca,
} from './lista-de-bancas';

const TEXTO_DA_BANCA_DE_RECURSOS =
  'A banca de análise de recursos é opcional quando já existe banca que avalia o item contestado, e obrigatória quando o item contestado não é avaliado por banca, como o gabarito, a nota do ENEM e a classificação. Se ela faltar, a publicação mostra o que a API recusou.';

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
  protected readonly textoDaBancaDeRecursos = TEXTO_DA_BANCA_DE_RECURSOS;
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
    for (const recusa of this.recusas()) {
      const banca =
        bancaDoCampo(recusa.campo, 'bancas') ?? bancaDoCampo(recusa.campo, 'bancasRequeridas');
      if (banca) tomadas.add(banca.identificador);
    }
    return {
      id: null,
      identificadorLocal: novaChave({ tipo: 'banca', nome: '', tomadas }),
      tipoBancaId,
      copiaDoTipo: this.copiaDoTipo(tipoBancaId),
      regraDeDeliberacao: null,
    };
  }

  private copiaDoTipo(id: string): BancaDeclarada['copiaDoTipo'] {
    const tipo = this.tipos().find((item) => item.id === id);
    if (!tipo) return null;
    return {
      rotulo: tipo.rotulo,
      papel: tipo.papel ?? null,
      exigeDuasOuMaisBancas: tipo.exigeDuasOuMaisBancas ?? false,
      encerraRecursoNaPrimeiraInstancia: tipo.encerraRecursoNaPrimeiraInstancia ?? false,
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
