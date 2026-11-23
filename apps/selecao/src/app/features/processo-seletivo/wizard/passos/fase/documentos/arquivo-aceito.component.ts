import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';
import { acompanharLeitura, FalhaDeLeituraDoCampoComponent } from '@uniplus/shared-ui/components';
import type { FormatosAceitos } from '../../../processo-seletivo.models';
import {
  aceitarQualquerFormato,
  definirTamanhoDoFormato,
  retirarFormato,
  selecionarFormato,
  tamanhoDoFormatoInvalido,
} from '../../../shared/exigencias/edicao-do-arquivo-da-exigencia';
import { CatalogoDosFormatosPermitidos } from '../../cronograma/catalogos/catalogo-dos-formatos-permitidos.service';

const BYTES_POR_MEGABYTE = 1024 * 1024;

@Component({
  selector: 'sel-arquivo-aceito',
  imports: [FalhaDeLeituraDoCampoComponent],
  templateUrl: './arquivo-aceito.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArquivoAceitoComponent {
  protected readonly catalogo = inject(CatalogoDosFormatosPermitidos);
  private readonly anfitriao = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly leitura = acompanharLeitura({
    falha: this.catalogo.erro,
    pendente: computed(() => this.catalogo.situacao() === 'carregando'),
    recarregar: () => this.catalogo.repetir(),
    destino: () => this.anfitriao.nativeElement.querySelector<HTMLElement>('input[type=radio]'),
    assunto: 'os formatos permitidos',
  });
  readonly formatos = input.required<FormatosAceitos>();
  readonly tamanho = input.required<number | null>();
  readonly idBase = input.required<string>();
  readonly desabilitado = input(false);
  readonly formatosChange = output<FormatosAceitos>();
  readonly tamanhoChange = output<number | null>();

  constructor() {
    this.catalogo.carregar();
  }

  escolherLista(): void {
    if (this.formatos().tipo === 'qualquer') this.formatosChange.emit({ tipo: 'lista', itens: [] });
  }

  escolherQualquer(): void {
    this.formatosChange.emit(aceitarQualquerFormato());
  }

  selecionado(formato: string): boolean {
    const formatos = this.formatos();
    return formatos.tipo === 'lista' && formatos.itens.some((item) => item.formato === formato);
  }

  alternar(formato: string, evento: Event): void {
    const marcado = (evento.target as HTMLInputElement).checked;
    const valor = marcado
      ? selecionarFormato(this.formatos(), formato)
      : retirarFormato(this.formatos(), formato);
    this.formatosChange.emit(valor);
  }

  tamanhoDoFormato(formato: string): number | null {
    const formatos = this.formatos();
    return formatos.tipo === 'lista'
      ? (formatos.itens.find((item) => item.formato === formato)?.tamanhoMaximoBytes ?? null)
      : null;
  }

  definirTamanho(formato: string, evento: Event): void {
    const valor = (evento.target as HTMLInputElement).value;
    this.formatosChange.emit(
      definirTamanhoDoFormato(this.formatos(), formato, this.emBytes(valor)),
    );
  }

  definirTamanhoDaExigencia(evento: Event): void {
    const valor = (evento.target as HTMLInputElement).value;
    this.tamanhoChange.emit(this.emBytes(valor));
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

  private emBytes(valor: string): number | null {
    return valor === '' ? null : Number(valor) * BYTES_POR_MEGABYTE;
  }
}
