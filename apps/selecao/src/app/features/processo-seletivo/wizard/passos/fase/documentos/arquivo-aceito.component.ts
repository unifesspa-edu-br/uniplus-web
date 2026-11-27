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
import type { RecusaDaExigencia } from '../../../shared/exigencias/gravacao-das-exigencias-documentais.service';
import type { FormatosAceitos } from '../../../processo-seletivo.models';
import {
  aceitarQualquerFormato,
  definirTamanhoDoFormato,
  retirarFormato,
  selecionarFormato,
  tamanhoDoFormatoInvalido,
} from '../../../shared/exigencias/edicao-do-arquivo-da-exigencia';
import { CatalogoDosFormatosPermitidos } from '../../cronograma/catalogos/catalogo-dos-formatos-permitidos.service';
import { ExigenciasDaFaseStore } from './exigencias-da-fase.store';
import { RecusasDasExigencias } from './recusas-das-exigencias.service';

const BYTES_POR_MEGABYTE = 1024 * 1024;

@Component({
  selector: 'sel-arquivo-aceito',
  imports: [FalhaDeLeituraDoCampoComponent, RecusaDoCampoComponent],
  templateUrl: './arquivo-aceito.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArquivoAceitoComponent {
  protected readonly catalogo = inject(CatalogoDosFormatosPermitidos);
  private readonly exigencias = inject(ExigenciasDaFaseStore);
  private readonly recusas = inject(RecusasDasExigencias, { optional: true });
  private readonly anfitriao = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly leitura = acompanharLeitura({
    falha: this.catalogo.erro,
    pendente: computed(() => this.catalogo.situacao() === 'carregando'),
    recarregar: () => this.catalogo.repetir(),
    destino: () => this.anfitriao.nativeElement.querySelector<HTMLElement>('input[type=radio]'),
    assunto: 'os formatos permitidos',
  });
  readonly documentoId = input.required<string>();
  readonly faseCodigo = input<string>();
  readonly idBase = input.required<string>();
  readonly desabilitado = input(false);
  private readonly caminho = 'documento.requisitos.formatosPermitidos';
  private readonly caminhoDoTamanho = 'documento.requisitos.tamanhoMaximoBytes';

  protected formatos(): FormatosAceitos {
    return this.exigencias.exigenciaDoDocumento(this.documentoId()).formatosPermitidos;
  }

  protected tamanho(): number | null {
    return this.exigencias.exigenciaDoDocumento(this.documentoId()).tamanhoMaximoBytes;
  }

  protected recusasDosFormatos(): readonly RecusaDaExigencia[] {
    return this.recusas?.doCampo(this.documentoId(), this.caminho, this.faseCodigo()) ?? [];
  }

  protected recusasDoTamanho(): readonly RecusaDaExigencia[] {
    return (
      this.recusas?.doCampo(this.documentoId(), this.caminhoDoTamanho, this.faseCodigo()) ?? []
    );
  }
  protected recusasParaExibir(recusas: readonly RecusaDaExigencia[]) {
    return recusas.map((recusa) => ({ ...recusa, pagina: null }));
  }

  constructor() {
    this.catalogo.carregar();
  }

  escolherLista(): void {
    const formatos = this.formatos();
    this.gravarFormatos(
      formatos.tipo === 'qualquer' ? { tipo: 'lista', itens: [] } : formatos,
      this.caminho,
    );
  }

  escolherQualquer(): void {
    this.gravarFormatos(aceitarQualquerFormato(), this.caminho);
  }

  selecionado(formato: string): boolean {
    const formatos = this.formatos();
    return formatos.tipo === 'lista' && formatos.itens.some((item) => item.formato === formato);
  }

  alternar(formato: string, evento: Event): void {
    const marcado = (evento.target as HTMLInputElement).checked;
    const formatos = this.formatos();
    this.gravarFormatos(
      marcado ? selecionarFormato(formatos, formato) : retirarFormato(formatos, formato),
      this.caminho,
    );
  }

  caminhoDoFormato(formato: string): string {
    const formatos = this.formatos();
    const indice =
      formatos.tipo === 'lista' ? formatos.itens.findIndex((item) => item.formato === formato) : -1;
    return `documento.requisitos.formatosPermitidos[${indice}].tamanhoMaximoBytesMax`;
  }

  recusasDoFormato(formato: string): readonly RecusaDaExigencia[] {
    const caminho = this.caminhoDoFormato(formato);
    return this.recusasDosFormatos().filter((recusa) => recusa.campo === caminho);
  }

  recusasDaLista(): readonly RecusaDaExigencia[] {
    return this.recusasDosFormatos().filter(
      (recusa) => !/\[\d+\]\.tamanhoMaximoBytesMax$/.test(recusa.campo),
    );
  }

  tamanhoDoFormato(formato: string): number | null {
    const formatos = this.formatos();
    return formatos.tipo === 'lista'
      ? (formatos.itens.find((item) => item.formato === formato)?.tamanhoMaximoBytes ?? null)
      : null;
  }

  definirTamanho(formato: string, evento: Event): void {
    const valor = (evento.target as HTMLInputElement).value;
    this.gravarFormatos(
      definirTamanhoDoFormato(this.formatos(), formato, this.emBytes(valor)),
      this.caminhoDoFormato(formato),
    );
  }

  definirTamanhoDaExigencia(evento: Event): void {
    const valor = (evento.target as HTMLInputElement).value;
    this.exigencias.escreverExigencia(this.documentoId(), {
      tamanhoMaximoBytes: this.emBytes(valor),
    });
    this.recusas?.limparCampo(this.documentoId(), this.caminhoDoTamanho, this.faseCodigo());
  }

  emMegabytes(valor: number | null): number | null {
    return valor === null ? null : valor / BYTES_POR_MEGABYTE;
  }

  listaVazia(): boolean {
    const formatos = this.formatos();
    return formatos.tipo === 'lista' && formatos.itens.length === 0;
  }

  tamanhoDaExigenciaInvalido(): boolean {
    return tamanhoDoFormatoInvalido(this.tamanho(), null);
  }

  tamanhoInvalido(formato: string): boolean {
    return tamanhoDoFormatoInvalido(this.tamanhoDoFormato(formato), this.tamanho());
  }

  private gravarFormatos(formatosPermitidos: FormatosAceitos, campo: string): void {
    this.exigencias.escreverExigencia(this.documentoId(), { formatosPermitidos });
    this.recusas?.limparCampo(this.documentoId(), campo, this.faseCodigo());
  }

  private emBytes(valor: string): number | null {
    return valor === '' ? null : Math.round(Number(valor) * BYTES_POR_MEGABYTE);
  }
}
