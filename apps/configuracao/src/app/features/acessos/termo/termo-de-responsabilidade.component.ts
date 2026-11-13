import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import type { VersaoDoTermoDto } from '@uniplus/shared-data/autorizacao';
import { AlertComponent, SpinnerComponent } from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';

let proximoSufixo = 0;

/**
 * Uma versão do termo de responsabilidade: número, ato, data, resumo e o texto, numa área rolável
 * que recebe o foco pelo teclado (WCAG 2.1.1). Com o controle de aceite, mostra a caixa que o
 * registra; sem ele, só apresenta a versão.
 */
@Component({
  selector: 'cfg-termo-de-responsabilidade',
  standalone: true,
  imports: [ReactiveFormsModule, AlertComponent, DateBrPipe, SpinnerComponent],
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
  readonly erro = input<string | null>(null);
  /** O que mudou no termo depois da última leitura; anunciado pela região viva. */
  readonly aviso = input<string | null>(null);

  private readonly sufixo = proximoSufixo++;
  protected readonly idDoTitulo = `cfg-termo-titulo-${this.sufixo}`;
  protected readonly idDoErro = `cfg-termo-erro-${this.sufixo}`;
  protected readonly semAceite = computed(() => this.tentou() && this.aceite()?.value === false);
}
