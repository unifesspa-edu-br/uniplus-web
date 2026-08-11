import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TipoProcessoDto, TiposProcessoApi } from '@uniplus/shared-data/configuracao';
import { TypeCardComponent } from '../../../components/type-card/type-card.component';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { StepValidation, TipoProcessoOption } from '../../processo-seletivo.models';

@Component({
  selector: 'sel-step-01-tipo-processo',
  standalone: true,
  imports: [TypeCardComponent],
  templateUrl: './step-01-tipo-processo.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step01TipoProcessoComponent {
  readonly store = inject(ProcessoSeletivoStore);
  private readonly api = inject(TiposProcessoApi);
  private readonly destroyRef = inject(DestroyRef);

  /** Tipos de processo carregados da API — somente ativos (inatividade é soft-delete). */
  readonly options = signal<TipoProcessoOption[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly query = signal('');
  readonly filteredOptions = computed(() => {
    const query = this.query().trim().toLocaleLowerCase('pt-BR');
    return query
      ? this.options().filter((item) => item.name.toLocaleLowerCase('pt-BR').includes(query))
      : this.options();
  });

  constructor() {
    this.carregar();
  }

  tentarNovamente(): void {
    this.carregar();
  }

  select(value: string): void {
    this.store.patchObjectSection('tipoProcesso', { selected: value });
  }

  /** Validação declarativa — acionada pela page ao clicar em "Próximo". */
  validate(): StepValidation {
    return this.store.draft().tipoProcesso.selected
      ? { valid: true }
      : { valid: false, message: 'Selecione um tipo de processo seletivo para continuar.' };
  }

  private carregar(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.api
      .listar({ limit: 100 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result) => {
        this.loading.set(false);
        if (!result.ok) {
          this.loadError.set(true);
          return;
        }
        this.options.set(result.data.filter((tipo) => tipo.ativo).map(tipoProcessoParaOption));
      });
  }
}

function tipoProcessoParaOption(tipo: TipoProcessoDto): TipoProcessoOption {
  return {
    value: tipo.codigo,
    name: tipo.nome,
    description: tipo.descricao ?? '',
    tags: [],
    legal: '',
  };
}
