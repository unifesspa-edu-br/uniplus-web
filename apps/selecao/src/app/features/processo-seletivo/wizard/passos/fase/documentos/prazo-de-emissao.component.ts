import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
} from '@angular/core';
import {
  acompanharLeitura,
  FalhaDeLeituraDoCampoComponent,
  RecusaDoCampoComponent,
} from '@uniplus/shared-ui/components';
import type { PrazoDeEmissao, ReferenciaDoDocumento } from '../../../processo-seletivo.models';
import {
  escolherPrazo,
  definirValorDoPrazo,
  definirReferenciaDoPrazo,
  definirEfeitoDoPrazo,
  definirUnidadeDoPrazo,
} from '../../../shared/exigencias/edicao-do-prazo-e-da-validade';
import { CatalogoDasEscolhasDoPrazoDeEmissao } from '../../cronograma/catalogos/catalogo-das-escolhas-do-prazo-de-emissao.service';
import { CatalogoDasUnidadesDoPrazoDeEmissao } from '../../cronograma/catalogos/catalogo-das-unidades-do-prazo-de-emissao.service';
import { CatalogoDosEfeitosNaAnaliseDoDocumento } from '../../cronograma/catalogos/catalogo-dos-efeitos-na-analise-do-documento.service';
import { ExigenciasDaFaseStore } from './exigencias-da-fase.store';
import { RecusasDasExigencias } from './recusas-das-exigencias.service';
import { ReferenciaDeDataComponent } from './referencia-de-data.component';

@Component({
  selector: 'sel-prazo-de-emissao',
  imports: [FalhaDeLeituraDoCampoComponent, RecusaDoCampoComponent, ReferenciaDeDataComponent],
  templateUrl: './prazo-de-emissao.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrazoDeEmissaoComponent {
  protected readonly escolhas = inject(CatalogoDasEscolhasDoPrazoDeEmissao);
  protected readonly unidades = inject(CatalogoDasUnidadesDoPrazoDeEmissao);
  protected readonly efeitos = inject(CatalogoDosEfeitosNaAnaliseDoDocumento);
  private readonly exigencias = inject(ExigenciasDaFaseStore);
  private readonly recusas = inject(RecusasDasExigencias, { optional: true });
  private readonly anfitriao = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly leituraDeEscolhas = acompanharLeitura({
    falha: this.escolhas.erro,
    pendente: computed(() => this.escolhas.situacao() === 'carregando'),
    recarregar: () => this.escolhas.repetir(),
    destino: () => this.anfitriao.nativeElement.querySelector<HTMLElement>('input, select'),
    assunto: 'escolhas do prazo de emissão',
  });
  protected readonly leituraDeUnidades = acompanharLeitura({
    falha: this.unidades.erro,
    pendente: computed(() => this.unidades.situacao() === 'carregando'),
    recarregar: () => this.unidades.repetir(),
    destino: () => this.anfitriao.nativeElement.querySelector<HTMLElement>('input, select'),
    assunto: 'unidades do prazo de emissão',
  });
  protected readonly leituraDeEfeitos = acompanharLeitura({
    falha: this.efeitos.erro,
    pendente: computed(() => this.efeitos.situacao() === 'carregando'),
    recarregar: () => this.efeitos.repetir(),
    destino: () => this.anfitriao.nativeElement.querySelector<HTMLElement>('input, select'),
    assunto: 'efeitos na análise',
  });
  readonly documentoId = input.required<string>();
  readonly faseCodigo = input<string>();
  readonly idBase = input.required<string>();
  readonly desabilitado = input(false);
  protected readonly caminho = 'documento.requisitos.prazoDeEmissao';

  constructor() {
    this.escolhas.carregar();
    this.unidades.carregar();
    this.efeitos.carregar();
  }

  protected prazo(): PrazoDeEmissao | null {
    return this.exigencias.exigenciaDoDocumento(this.documentoId()).prazoDeEmissao;
  }

  protected recusasDoCampo(campo: string) {
    return (
      this.recusas?.doCampo(this.documentoId(), `${this.caminho}.${campo}`, this.faseCodigo()) ?? []
    ).map((recusa) => ({ ...recusa, pagina: null }));
  }

  protected escolher(escolha: string): void {
    if (escolha === 'semPrazo') {
      this.recusas?.limparCampo(this.documentoId(), this.caminho, this.faseCodigo());
    }
    this.gravar(escolherPrazo(escolha), 'escolha');
  }

  protected valorInvalido(): boolean {
    const valor = this.prazo()?.valor;
    return valor !== null && valor !== undefined && (!Number.isInteger(valor) || valor <= 0);
  }

  protected definirValor(evento: Event): void {
    const valor = (evento.target as HTMLInputElement).value;
    const prazo = this.prazo();
    if (prazo)
      this.gravar(definirValorDoPrazo(prazo, valor === '' ? null : Number(valor)), 'valor');
  }

  protected definirUnidade(evento: Event): void {
    const prazo = this.prazo();
    const unidade = (evento.target as HTMLSelectElement).value || null;
    if (prazo) this.gravar(definirUnidadeDoPrazo(prazo, unidade), 'unidade');
  }

  protected definirEfeito(evento: Event): void {
    const prazo = this.prazo();
    const efeito = (evento.target as HTMLSelectElement).value || null;
    if (prazo) this.gravar(definirEfeitoDoPrazo(prazo, efeito), 'efeitoForaDoPrazo');
  }

  protected definirReferencia(referencia: ReferenciaDoDocumento): void {
    const prazo = this.prazo();
    if (prazo) this.gravar(definirReferenciaDoPrazo(prazo, referencia), 'referencia');
  }

  private gravar(prazoDeEmissao: PrazoDeEmissao, campo: string): void {
    this.exigencias.escreverExigencia(this.documentoId(), { prazoDeEmissao });
    if (campo !== 'referencia')
      this.recusas?.limparCampo(this.documentoId(), `${this.caminho}.${campo}`, this.faseCodigo());
  }
}
