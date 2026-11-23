import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
} from '@angular/core';
import {
  acompanharLeitura,
  FalhaDeLeituraDoCampoComponent,
  IndicadorDaLeituraDirective,
} from '@uniplus/shared-ui/components';

import { CatalogoDosCriteriosDeDistincaoDeApresentacoes } from '../../cronograma/catalogos/catalogo-dos-criterios-de-distincao-de-apresentacoes.service';

@Component({
  selector: 'sel-criterio-de-distincao',
  imports: [FalhaDeLeituraDoCampoComponent, IndicadorDaLeituraDirective],
  providers: [CatalogoDosCriteriosDeDistincaoDeApresentacoes],
  templateUrl: './criterio-de-distincao.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CriterioDeDistincaoComponent {
  readonly identificador = input.required<string>();
  readonly criterio = input<string | null>(null);
  readonly desabilitado = input(false);
  readonly criterioChange = output<string | null>();
  protected readonly catalogo = inject(CatalogoDosCriteriosDeDistincaoDeApresentacoes);
  private readonly anfitriao = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly leitura = acompanharLeitura({
    falha: this.catalogo.erro,
    pendente: computed(() => this.catalogo.situacao() === 'carregando'),
    recarregar: () => this.catalogo.repetir(),
    destino: () => this.anfitriao.nativeElement.querySelector('select'),
    assunto: 'os critérios de distinção',
  });

  constructor() {
    this.catalogo.carregar();
  }
}
