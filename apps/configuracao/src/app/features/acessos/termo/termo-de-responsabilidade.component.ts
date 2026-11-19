import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import type { VersaoDoTermoDto } from '@uniplus/shared-data/autorizacao';
import {
  AlertComponent,
  FalhaDeLeituraComponent,
  SpinnerComponent,
  type LeituraAcompanhada,
} from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';
import { of, startWith, switchMap } from 'rxjs';

let proximoSufixo = 0;

/**
 * Uma versão do termo de responsabilidade: número, ato, data, resumo e o texto, numa área rolável
 * que recebe o foco pelo teclado (WCAG 2.1.1). Com o controle de aceite, mostra a caixa que o
 * registra; sem ele, só apresenta a versão.
 */
@Component({
  selector: 'cfg-termo-de-responsabilidade',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AlertComponent,
    DateBrPipe,
    FalhaDeLeituraComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './termo-de-responsabilidade.component.css',
  templateUrl: './termo-de-responsabilidade.component.html',
})
export class TermoDeResponsabilidadeComponent {
  readonly versao = input<VersaoDoTermoDto | null>(null);
  readonly titulo = input('Termo de responsabilidade');
  readonly aceite = input<FormControl<boolean> | null>(null);
  readonly tentou = input(false);
  readonly carregando = input(false);
  /** A leitura do termo, cuja falha aparece com "Tentar novamente"; sem ela, só a versão. */
  readonly leitura = input<LeituraAcompanhada | null>(null);
  /** O que mudou no termo depois da última leitura; anunciado pela região viva. */
  readonly aviso = input<string | null>(null);
  /** Nota sobre a versão quando ela é só informada, sem a caixa de aceite. */
  readonly observacao = input<string | null>(null);

  private readonly sufixo = proximoSufixo++;
  protected readonly idDoTitulo = `cfg-termo-titulo-${this.sufixo}`;
  protected readonly idDoErro = `cfg-termo-erro-${this.sufixo}`;
  /** O valor da caixa como signal, para o erro e o `aria-invalid` acompanharem a marcação. */
  private readonly marcado = toSignal(
    toObservable(this.aceite).pipe(
      switchMap((controle) =>
        controle === null ? of(true) : controle.valueChanges.pipe(startWith(controle.value)),
      ),
    ),
    { initialValue: true },
  );
  protected readonly semAceite = computed(() => this.tentou() && !this.marcado());
}
