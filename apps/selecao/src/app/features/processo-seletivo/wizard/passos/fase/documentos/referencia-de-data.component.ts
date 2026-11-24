import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';
import {
  acompanharLeitura,
  FalhaDeLeituraDoCampoComponent,
  RecusaDoCampoComponent,
} from '@uniplus/shared-ui/components';
import type { ReferenciaDoDocumento } from '../../../processo-seletivo.models';
import {
  escolherTipoDeReferencia,
  definirDataDaReferencia,
  definirFaseDaReferencia,
} from '../../../shared/exigencias/edicao-do-prazo-e-da-validade';
import { CatalogoDosTiposDaDataDeReferencia } from '../../cronograma/catalogos/catalogo-dos-tipos-da-data-de-referencia.service';
import { FormularioDoCronograma } from '../../cronograma/servicos/formulario-do-cronograma.service';
import { RecusasDasExigencias } from './recusas-das-exigencias.service';

@Component({
  selector: 'sel-referencia-de-data',
  imports: [FalhaDeLeituraDoCampoComponent, RecusaDoCampoComponent],
  templateUrl: './referencia-de-data.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReferenciaDeDataComponent {
  protected readonly catalogo = inject(CatalogoDosTiposDaDataDeReferencia);
  protected readonly cronograma = inject(FormularioDoCronograma);
  private readonly recusas = inject(RecusasDasExigencias, { optional: true });
  readonly referencia = input.required<ReferenciaDoDocumento | null>();
  private readonly anfitriao = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly leituraDeCatalogo = acompanharLeitura({
    falha: this.catalogo.erro,
    pendente: computed(() => this.catalogo.situacao() === 'carregando'),
    recarregar: () => this.catalogo.repetir(),
    destino: () => this.anfitriao.nativeElement.querySelector<HTMLElement>('input, select'),
    assunto: 'tipos de data de referência',
  });
  readonly documentoId = input.required<string>();
  readonly faseCodigo = input<string>();
  readonly caminho = input.required<string>();
  readonly idBase = input.required<string>();
  readonly desabilitado = input(false);
  readonly referenciaChange = output<ReferenciaDoDocumento>();

  constructor() {
    this.catalogo.carregar();
  }

  recusasDoCampo(campo: string) {
    const caminho = campo === 'tipo' ? this.caminho() : `${this.caminho()}.${campo}`;
    return (this.recusas?.doCampo(this.documentoId(), caminho, this.faseCodigo()) ?? [])
      .filter((recusa) => campo !== 'tipo' || [caminho, `${caminho}.tipo`].includes(recusa.campo))
      .map((recusa) => ({ ...recusa, pagina: null }));
  }

  escolherTipo(evento: Event): void {
    const tipo = (evento.target as HTMLSelectElement).value;
    this.recusas?.limparCampo(this.documentoId(), this.caminho(), this.faseCodigo());
    this.referenciaChange.emit(escolherTipoDeReferencia(tipo));
  }

  definirData(evento: Event): void {
    const data = (evento.target as HTMLInputElement).value || null;
    this.limpar('data');
    this.referenciaChange.emit(definirDataDaReferencia(this.referenciaAtual(), data));
  }

  definirFase(evento: Event): void {
    const faseCodigo = (evento.target as HTMLSelectElement).value || null;
    this.limpar('faseId');
    this.referenciaChange.emit(definirFaseDaReferencia(this.referenciaAtual(), faseCodigo));
  }

  protected precisaDeFase(): boolean {
    return (
      this.referencia()?.tipo === 'INICIO_DA_FASE' || this.referencia()?.tipo === 'FIM_DA_FASE'
    );
  }

  private referenciaAtual(): ReferenciaDoDocumento {
    return this.referencia() ?? escolherTipoDeReferencia('');
  }

  private limpar(campo: string): void {
    this.recusas?.limparCampo(this.documentoId(), `${this.caminho()}.${campo}`, this.faseCodigo());
  }
}
