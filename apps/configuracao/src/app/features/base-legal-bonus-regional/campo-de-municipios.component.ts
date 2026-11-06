import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import { type CidadeResumoDto } from '@uniplus/shared-data/geo';
import { NovaTentativaDoCampoComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { BUSCA_MAXIMO_DE_CARACTERES, type CampoDeMunicipios } from './municipios-da-base-legal';

/** O campo dos municípios da base legal: a busca na API de geografia e os municípios escolhidos. */
@Component({
  selector: 'cfg-campo-de-municipios',
  standalone: true,
  imports: [SpinnerComponent, NovaTentativaDoCampoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './campo-de-municipios.component.html',
  styleUrl: './campo-de-municipios.component.css',
})
export class CampoDeMunicipiosComponent {
  readonly campo = input.required<CampoDeMunicipios>();
  readonly buscar = output<string>();
  readonly adicionar = output<CidadeResumoDto>();
  readonly remover = output<string>();
  readonly tentarBuscaDeNovo = output<void>();

  private readonly busca = viewChild.required<ElementRef<HTMLInputElement>>('busca');

  protected readonly maximoDaBusca = BUSCA_MAXIMO_DE_CARACTERES;

  /** Ids dos erros que descrevem o campo de busca; sem nenhum, o atributo some. */
  protected readonly descritoPor = computed<string | null>(() => {
    const ids = [
      this.campo().buscaFalhou ? 'cfg-blbr-municipio-busca-erro' : null,
      this.campo().erro !== null ? 'cfg-blbr-municipios-erro' : null,
    ].filter((id): id is string => id !== null);
    return ids.length > 0 ? ids.join(' ') : null;
  });

  /** O resultado escolhido sai da lista: o foco volta à busca, para a pessoa seguir adicionando. */
  protected aoAdicionar(cidade: CidadeResumoDto): void {
    this.adicionar.emit(cidade);
    this.busca().nativeElement.focus();
  }

  /** O botão removido sai do DOM: o foco vai ao "Remover" seguinte ou, sendo o último, à busca. */
  protected aoRemover(codigoIbge: string, evento: Event): void {
    const botao = evento.currentTarget as HTMLElement;
    const proximo = botao.closest('li')?.nextElementSibling?.querySelector('button');
    this.remover.emit(codigoIbge);
    (proximo ?? this.busca().nativeElement).focus();
  }

  protected valorDoCampo(evento: Event): string {
    return (evento.target as HTMLInputElement).value;
  }
}
