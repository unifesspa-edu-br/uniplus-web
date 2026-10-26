import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';
import { ReactiveFormsModule, type FormControl } from '@angular/forms';
import type { LeiauteDoInepDto } from '@uniplus/shared-data/selecao';
import { AlertComponent, SpinnerComponent } from '@uniplus/shared-ui/components';

import type { Leitura } from '../leitura';
import { chaveDoLeiaute, rotuloDoLeiaute } from './leiautes';

/**
 * O leiaute do arquivo, alimentado pelo catálogo do servidor. Com um único leiaute não há o que
 * escolher: ele já fica selecionado, sem campo, e as orientações do card o descrevem. Com dois ou mais, o operador escolhe, sem
 * pré-seleção, para não gravar a nota de uma área como se fosse de outra. Enquanto o catálogo não
 * está utilizável, mostra o motivo no lugar do campo.
 */
@Component({
  selector: 'sel-seletor-de-leiaute',
  standalone: true,
  imports: [ReactiveFormsModule, AlertComponent, SpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './seletor-de-leiaute.component.html',
  styleUrl: './compartilhado.css',
  host: { '[class.notas__sem-campo]': 'unico() !== null' },
})
export class SeletorDeLeiauteComponent {
  readonly idDoCampo = input.required<string>();
  readonly rotulo = input.required<string>();
  readonly controle = input.required<FormControl<string>>();
  readonly catalogo = input.required<Leitura<readonly LeiauteDoInepDto[]>>();
  readonly erro = input<string | null>(null);
  readonly recarregar = output<void>();

  private readonly campo = viewChild<ElementRef<HTMLSelectElement>>('campo');

  /** O leiaute que o catálogo oferece quando é só um; nulo quando há que escolher. */
  protected readonly unico = computed(() => {
    const leitura = this.catalogo();
    return leitura.estado === 'lido' && leitura.dados.length === 1 ? leitura.dados[0] : null;
  });

  protected readonly chaveDoLeiaute = chaveDoLeiaute;
  protected readonly rotuloDoLeiaute = rotuloDoLeiaute;

  constructor() {
    effect(() => {
      const unico = this.unico();
      if (unico !== null) this.controle().setValue(chaveDoLeiaute(unico));
    });
  }

  focar(): void {
    this.campo()?.nativeElement.focus();
  }
}
