import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiResult, extractNextCursor, isApiOk } from '@uniplus/shared-core/http';
import { TipoProcessoDto, TiposProcessoApi } from '@uniplus/shared-data/configuracao';
import {
  acompanharLeitura,
  FalhaDeLeituraComponent,
  IndicadorDaLeituraDirective,
  ValorEmConsultaComponent,
  ValorLegivelDirective,
} from '@uniplus/shared-ui/components';
import { TypeCardComponent } from '../../../components/type-card/type-card.component';
import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { ValidacaoDoPasso, TipoProcessoOption } from '../../processo-seletivo.models';
import { provePassoDoWizard } from '../../passo-do-wizard';
import { tituloDoPasso } from '../../shared/titulo-do-passo';
import { incluirTipoRetomado } from './opcoes-do-tipo-de-processo';

@Component({
  selector: 'sel-step-tipo-processo',
  standalone: true,
  imports: [
    FalhaDeLeituraComponent,
    IndicadorDaLeituraDirective,
    ValorLegivelDirective,
    TypeCardComponent,
    ValorEmConsultaComponent,
  ],
  templateUrl: './tipo-processo.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [provePassoDoWizard(TipoProcessoPassoComponent)],
})
export class TipoProcessoPassoComponent {
  readonly store = inject(ProcessoSeletivoStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly tiposProcessoApi = inject(TiposProcessoApi);

  /** Tipos ativos retornados pelo catálogo de Configuração (ADR-0122). */
  private readonly catalogo = signal<readonly TipoProcessoOption[]>([]);

  /** Catálogo vivo, com o tipo do processo retomado quando o catálogo já não o lista. */
  readonly options = computed<readonly TipoProcessoOption[]>(() =>
    incluirTipoRetomado(this.catalogo(), this.store.remoteSnapshot()?.tipoProcesso),
  );
  /** O tipo gravado, com a descrição do catálogo quando ele a tem. */
  readonly tipoEscolhido = computed(
    () =>
      this.options().find((opcao) => opcao.value === this.store.draft().tipoProcesso.selected) ??
      null,
  );
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  protected readonly leitura = acompanharLeitura({
    falha: this.errorMessage,
    pendente: this.loading,
    recarregar: () => this.carregar(),
    destino: tituloDoPasso,
  });
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
      next: (result) => this.receberPagina(result, acumulados),
      error: () => this.exibirErro(),
    });
  }

  private receberPagina(
    result: ApiResult<readonly TipoProcessoDto[]>,
    acumulados: readonly TipoProcessoOption[],
  ): void {
    if (!isApiOk(result)) {
      this.exibirErro();
      return;
    }
    const tipos = [...acumulados, ...result.data.map((tipo) => this.toOption(tipo))];
    const proximoCursor = extractNextCursor(result.headers.get('Link'));
    if (proximoCursor === null) this.concluirCarga(tipos);
    else this.carregarPagina(proximoCursor, tipos);
  }

  private concluirCarga(tipos: readonly TipoProcessoOption[]): void {
    this.catalogo.set(tipos);
    this.loading.set(false);
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
      codigo: escolhido?.codigo ?? '',
    });
  }

  /** Validação declarativa — acionada pela page ao clicar em "Próximo". */
  validar(): ValidacaoDoPasso {
    return this.store.draft().tipoProcesso.selected
      ? { valid: true }
      : { valid: false, message: 'Selecione um tipo de processo seletivo para continuar.' };
  }

  private toOption(tipo: TipoProcessoDto): TipoProcessoOption {
    return {
      value: tipo.id,
      codigo: tipo.codigo,
      name: tipo.nome,
      description: tipo.descricao ?? `Código: ${tipo.codigo}`,
      tags: [tipo.codigo],
    };
  }

  private exibirErro(): void {
    this.errorMessage.set('Não foi possível carregar os tipos de processo.');
    this.loading.set(false);
  }
}
