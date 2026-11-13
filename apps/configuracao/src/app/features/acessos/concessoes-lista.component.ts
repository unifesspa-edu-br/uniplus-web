import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { ConcessaoDto, SituacaoDaConcessao } from '@uniplus/shared-data/autorizacao';
import {
  EmptyStateComponent,
  IconButtonComponent,
  PagerComponent,
  SpinnerComponent,
  TagComponent,
} from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';
import { situacaoDaConcessao } from './situacao-da-concessao';
import { autorDoEvento } from './trilha-de-acesso.component';

@Component({
  selector: 'cfg-concessoes-lista',
  standalone: true,
  imports: [
    FormsModule,
    EmptyStateComponent,
    IconButtonComponent,
    PagerComponent,
    SpinnerComponent,
    TagComponent,
    DateBrPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './concessoes-lista.component.html',
})
export class ConcessoesListaComponent {
  readonly concessoes = input.required<readonly ConcessaoDto[]>();
  readonly carregando = input.required<boolean>();
  readonly gravando = input.required<boolean>();
  readonly erro = input.required<string | null>();
  readonly situacao = input.required<SituacaoDaConcessao>();
  readonly nomeDoEscopo = input.required<(escopo: ConcessaoDto['escopo']) => string>();
  readonly temAnterior = input.required<boolean>();
  readonly temProximo = input.required<boolean>();
  /** Quem só consulta as concessões não vê a revogação. */
  readonly podeRevogar = input.required<boolean>();
  readonly filtrar = output<SituacaoDaConcessao>();
  readonly verTrilha = output<ConcessaoDto>();
  readonly revogar = output<ConcessaoDto>();
  readonly anterior = output<void>();
  readonly proximo = output<void>();
  protected readonly indisponivel = computed(() => this.carregando() || this.gravando());
  protected readonly situacoes: readonly {
    readonly value: SituacaoDaConcessao;
    readonly label: string;
  }[] = [
    { value: 'ativa', label: 'Ativas' },
    { value: 'vencida', label: 'Vencidas' },
    { value: 'revogada', label: 'Revogadas' },
    { value: 'todas', label: 'Todas' },
  ];
  protected pessoa(concessao: ConcessaoDto): string {
    return autorDoEvento(concessao.beneficiario);
  }
  protected readonly situacaoDe = situacaoDaConcessao;
}
