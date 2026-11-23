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
import type { ReferenciaDoDocumento, ValidadeDoDocumento } from '../../../processo-seletivo.models';
import {
  escolherValidade,
  definirEfeitoDaValidade,
  definirReferenciaDaValidade,
} from '../../../shared/exigencias/edicao-do-prazo-e-da-validade';
import { CatalogoDasEscolhasDaValidade } from '../../cronograma/catalogos/catalogo-das-escolhas-da-validade.service';
import { CatalogoDosEfeitosNaAnaliseDoDocumento } from '../../cronograma/catalogos/catalogo-dos-efeitos-na-analise-do-documento.service';
import { ExigenciasDaFaseStore } from './exigencias-da-fase.store';
import { RecusasDasExigencias } from './recusas-das-exigencias.service';
import { ReferenciaDeDataComponent } from './referencia-de-data.component';

@Component({
  selector: 'sel-validade-do-documento',
  imports: [FalhaDeLeituraDoCampoComponent, RecusaDoCampoComponent, ReferenciaDeDataComponent],
  templateUrl: './validade-do-documento.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ValidadeDoDocumentoComponent {
  protected readonly escolhas = inject(CatalogoDasEscolhasDaValidade);
  protected readonly efeitos = inject(CatalogoDosEfeitosNaAnaliseDoDocumento);
  private readonly exigencias = inject(ExigenciasDaFaseStore);
  private readonly recusas = inject(RecusasDasExigencias, { optional: true });
  private readonly anfitriao = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly leituraDeEscolhas = acompanharLeitura({
    falha: this.escolhas.erro,
    pendente: computed(() => this.escolhas.situacao() === 'carregando'),
    recarregar: () => this.escolhas.repetir(),
    destino: () => this.anfitriao.nativeElement.querySelector<HTMLElement>('input, select'),
    assunto: 'escolhas da validade',
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
  protected readonly caminho = 'documento.requisitos.validade';

  constructor() {
    this.escolhas.carregar();
    this.efeitos.carregar();
  }

  protected validade(): ValidadeDoDocumento | null {
    return this.exigencias.exigenciaDoDocumento(this.documentoId()).validade;
  }

  protected recusasDoCampo(campo: string) {
    return (
      this.recusas?.doCampo(this.documentoId(), `${this.caminho}.${campo}`, this.faseCodigo()) ?? []
    ).map((recusa) => ({ ...recusa, pagina: null }));
  }

  protected escolher(escolha: string): void {
    if (escolha === 'naoExigeDocumentoValido') {
      this.recusas?.limparCampo(this.documentoId(), this.caminho, this.faseCodigo());
    }
    this.gravar(escolherValidade(escolha), 'escolha');
  }

  protected definirEfeito(evento: Event): void {
    const validade = this.validade();
    const efeito = (evento.target as HTMLSelectElement).value || null;
    if (validade) this.gravar(definirEfeitoDaValidade(validade, efeito), 'efeitoDoVencimento');
  }

  protected definirReferencia(referencia: ReferenciaDoDocumento): void {
    const validade = this.validade();
    if (validade) this.gravar(definirReferenciaDaValidade(validade, referencia), 'referencia');
  }

  private gravar(validade: ValidadeDoDocumento, campo: string): void {
    this.exigencias.escreverExigencia(this.documentoId(), { validade });
    if (campo !== 'referencia')
      this.recusas?.limparCampo(this.documentoId(), `${this.caminho}.${campo}`, this.faseCodigo());
  }
}
