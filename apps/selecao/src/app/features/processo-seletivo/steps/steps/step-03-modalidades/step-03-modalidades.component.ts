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
import { ModalidadeConcorrencia } from '@uniplus/shared-data/selecao';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { StepValidation } from '../../processo-seletivo.models';

/** Opção de modalidade exibida no passo 3, mapeada do catálogo da API. */
export interface ModalidadeOption {
  readonly code: ModalidadeConcorrencia;
  readonly label: string;
}

/** Códigos canônicos de `ModalidadeConcorrencia` aceitos pelo rascunho. */
const MODALIDADES_CANONICAS_SAFE: ReadonlySet<string> = new Set<string>([
  'AC',
  'V',
  'LB_PPI',
  'LB_Q',
  'LB_PcD',
  'LB_EP',
  'LI_PPI',
  'LI_Q',
  'LI_PcD',
  'LI_EP',
]);

function isModalidadeConcorrencia(codigo: string): codigo is ModalidadeConcorrencia {
  return MODALIDADES_CANONICAS_SAFE.has(codigo);
}

@Component({
  selector: 'sel-step-03-modalidades',
  standalone: true,
  templateUrl: './step-03-modalidades.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Step03ModalidadesComponent {
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
          ...result.data
            .map((modalidade) => this.toOption(modalidade))
            .filter((item): item is ModalidadeOption => item !== null),
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

  toggle(code: ModalidadeConcorrencia, checked: boolean): void {
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
  private sincronizarModalidades(selected: readonly ModalidadeConcorrencia[]): void {
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

  private toOption(modalidade: ModalidadeDto): ModalidadeOption | null {
    if (!isModalidadeConcorrencia(modalidade.codigo)) return null;
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
