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
  private readonly destroyRef = inject(DestroyRef);
  private readonly tiposProcessoApi = inject(TiposProcessoApi);

  /** Tipos ativos retornados pelo catálogo de Configuração (ADR-0122). */
  private readonly catalogo = signal<readonly TipoProcessoOption[]>([]);

  /**
   * Catálogo vivo mais, quando faltar, o tipo que o processo retomado declara.
   *
   * O catálogo lista só tipos ativos; um processo criado antes de o tipo ser
   * desativado continua apontando para ele. Sem esta opção o passo abriria sem
   * seleção alguma, e como o cadastro inicial fica congelado o operador não
   * teria como identificar nem corrigir o que está lá — o snapshot devolvido
   * por Seleção é a única fonte desse rótulo (ADR-0122).
   */
  readonly options = computed<readonly TipoProcessoOption[]>(() => {
    const catalogo = this.catalogo();
    const snapshot = this.store.remoteSnapshot()?.tipoProcesso;

    if (snapshot === undefined) return catalogo;
    if (catalogo.some((opcao) => opcao.value === snapshot.origemId)) return catalogo;

    return [
      {
        value: snapshot.origemId,
        name: snapshot.nome,
        description: 'Tipo não disponível no catálogo atual — preservado deste processo.',
        tags: [snapshot.codigo],
      },
      ...catalogo,
    ];
  });
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly query = signal('');
  readonly filteredOptions = computed(() => {
    const query = this.query().trim().toLocaleLowerCase('pt-BR');
    const options = this.options();
    return query
      ? options.filter((item) => item.name.toLocaleLowerCase('pt-BR').includes(query))
      : options;
  });

  constructor() {
    this.carregar();
  }

  carregar(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.carregarPagina();
  }

  private carregarPagina(cursor?: string, acumulados: readonly TipoProcessoOption[] = []): void {
    const consulta =
      cursor === undefined
        ? this.tiposProcessoApi.listar()
        : this.tiposProcessoApi.listar({ cursor, direction: 'next' });

    consulta.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        if (!isApiOk(result)) {
          this.exibirErro();
          return;
        }

        const tipos = [...acumulados, ...result.data.map((tipo) => this.toOption(tipo))];
        const proximoCursor = extractNextCursor(result.headers.get('Link'));
        if (proximoCursor !== null) {
          this.carregarPagina(proximoCursor, tipos);
          return;
        }

        this.catalogo.set(tipos);
        this.loading.set(false);
      },
      error: () => this.exibirErro(),
    });
  }

  select(value: string): void {
    // O tipo compõe o comando de criação e não é atualizável depois dele.
    if (this.store.cadastroInicialCongelado()) return;

    // O nome acompanha o id porque o catálogo que os liga só existe aqui: quem
    // precisar dizer qual tipo foi escolhido não tem outra fonte antes de o
    // processo existir.
    const escolhido = this.options().find((opcao) => opcao.value === value);
    this.store.patchObjectSection('tipoProcesso', {
      selected: value,
      rotulo: escolhido?.name ?? '',
    });
  }

  /** Validação declarativa — acionada pela page ao clicar em "Próximo". */
  validate(): StepValidation {
    return this.store.draft().tipoProcesso.selected
      ? { valid: true }
      : { valid: false, message: 'Selecione um tipo de processo seletivo para continuar.' };
  }

  private toOption(tipo: TipoProcessoDto): TipoProcessoOption {
    return {
      value: tipo.id,
      name: tipo.nome,
      description: tipo.descricao ?? `Código: ${tipo.codigo}`,
      tags: [tipo.codigo],
    };
  }

  private exibirErro(): void {
    this.loading.set(false);
    this.errorMessage.set('Não foi possível carregar os tipos de processo. Tente novamente.');
  }
}
