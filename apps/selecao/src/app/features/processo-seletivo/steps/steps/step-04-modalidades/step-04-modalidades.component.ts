import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { extractNextCursor, isApiOk } from '@uniplus/shared-core/http';
import { ModalidadeDto, ModalidadesApi } from '@uniplus/shared-data/configuracao';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { StepValidation } from '../../processo-seletivo.models';

/** Opção de modalidade exibida no passo 3, mapeada do catálogo da API. */
export interface ModalidadeOption {
  /** Código do contrato — única fonte de verdade do vocabulário. */
  readonly code: string;
  readonly label: string;
}

@Component({
  selector: 'sel-step-04-modalidades',
  standalone: true,
  templateUrl: './step-04-modalidades.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step04ModalidadesComponent {
  readonly store = inject(ProcessoSeletivoStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly modalidadesApi = inject(ModalidadesApi);

  /** Modalidades ativas do catálogo de Configuração. */
  readonly modalidades = signal<readonly ModalidadeOption[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  readonly allSelected = computed(
    () =>
      this.store.draft().modalidades.selected.length > 0 &&
      this.store.draft().modalidades.selected.length === this.modalidades().length,
  );
  readonly indeterminate = computed(() => {
    const length = this.store.draft().modalidades.selected.length;
    return length > 0 && length < this.modalidades().length;
  });

  constructor() {
    this.carregar();
  }

  carregar(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.carregarPagina();
  }

  private carregarPagina(cursor?: string, acumuladas: readonly ModalidadeOption[] = []): void {
    const consulta =
      cursor === undefined
        ? this.modalidadesApi.listar()
        : this.modalidadesApi.listar({ cursor, direction: 'next' });

    consulta.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        if (!isApiOk(result)) {
          this.exibirErro();
          return;
        }
        const modalidades = [
          ...acumuladas,
          ...result.data.map((modalidade) => this.toOption(modalidade)),
        ];
        const proximoCursor = extractNextCursor(result.headers.get('Link'));
        if (proximoCursor !== null) {
          this.carregarPagina(proximoCursor, modalidades);
          return;
        }
        this.modalidades.set(modalidades);
        this.loading.set(false);
      },
      error: () => this.exibirErro(),
    });
  }

  toggleAll(checked: boolean): void {
    const selected = checked ? this.modalidades().map((item) => item.code) : [];
    this.store.patchObjectSection('modalidades', { selected });
    this.sincronizarModalidades(selected);
  }

  toggle(code: string, checked: boolean): void {
    const atual = this.store.draft().modalidades.selected;
    const selected = checked ? [...atual, code] : atual.filter((item) => item !== code);
    this.store.patchObjectSection('modalidades', { selected });
    this.sincronizarModalidades(selected);
  }

  /**
   * Mudar a seleção aqui repercute no bônus e nos documentos, que só podem citar
   * modalidades que o processo aceita. Nem o bônus nem os documentos são podados:
   * guardam a escolha do operador, e o que vale é a interseção com as aceitas,
   * calculada na leitura de cada passo. Quem foi recortado no passo 10 guarda a
   * escolha intacta (distinguido por `modalidadesRecortadas`).
   */
  private sincronizarModalidades(selected: readonly string[]): void {
    const draft = this.store.draft();
    const documentos = Object.fromEntries(
      Object.entries(draft.documentos).map(([id, config]) => [
        id,
        {
          ...config,
          modalidades: config.modalidadesRecortadas ? config.modalidades : [...selected],
        },
      ]),
    );
    this.store.patchSection('documentos', documentos);
  }

  /** Validação declarativa — acionada pela page ao clicar em "Próximo". */
  validate(): StepValidation {
    return this.store.draft().modalidades.selected.length > 0
      ? { valid: true }
      : { valid: false, message: 'Selecione ao menos uma modalidade de concorrência.' };
  }

  private toOption(modalidade: ModalidadeDto): ModalidadeOption {
    return {
      code: modalidade.codigo,
      label: modalidade.descricao ?? modalidade.codigo,
    };
  }

  private exibirErro(): void {
    this.loading.set(false);
    this.errorMessage.set('Não foi possível carregar as modalidades. Tente novamente.');
  }
}
