import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { PERMISSAO } from '@uniplus/shared-auth/bootstrap';
import { TemPermissaoDirective } from '@uniplus/shared-auth/components';
import { ModeloFormularioView, TipoProcessoDto } from '@uniplus/shared-data/configuracao';
import {
  EmptyStateComponent,
  FINALIDADES,
  FilterBarComponent,
  FilterChipsComponent,
  IconButtonComponent,
  PagerComponent,
  SpinnerComponent,
  TagComponent,
  type UiFiltroAtivo,
  type UiFilterChipOption,
} from '@uniplus/shared-ui/components';

@Component({
  selector: 'cfg-modelos-formulario-lista',
  imports: [
    TemPermissaoDirective,
    EmptyStateComponent,
    FilterBarComponent,
    FilterChipsComponent,
    IconButtonComponent,
    PagerComponent,
    SpinnerComponent,
    TagComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modelos-formulario-lista.component.html',
  host: { class: 'cfg-page' },
})
export class ModelosFormularioListaComponent {
  readonly termoBusca = model('');
  readonly filtroFinalidade = model('');
  readonly filtroSituacao = model('');
  readonly filtroTipo = model('');
  readonly tiposDeProcesso = input.required<readonly TipoProcessoDto[]>();
  readonly modelosBuscados = input.required<readonly ModeloFormularioView[]>();
  readonly loading = input.required<boolean>();
  readonly errorMessage = input.required<string | null>();
  readonly prevCursor = input.required<string | null>();
  readonly nextCursor = input.required<string | null>();
  readonly gravando = input.required<boolean>();
  readonly criar = output<void>();
  readonly ativar = output<ModeloFormularioView>();
  readonly desativar = output<ModeloFormularioView>();
  readonly anterior = output<void>();
  readonly proximo = output<void>();
  protected readonly permissaoDeManter = PERMISSAO.configuracao.modelosFormularioManter;
  protected readonly finalidadeChips: readonly UiFilterChipOption[] = [
    { value: '', label: 'Todas' },
    ...FINALIDADES.map((f) => ({ value: f.valor, label: f.rotulo })),
  ];
  protected readonly situacaoChips: readonly UiFilterChipOption[] = [
    { value: 'true', label: 'Ativos' },
    { value: 'false', label: 'Desativados' },
    { value: '', label: 'Todos' },
  ];
  protected readonly filtrosAtivos = computed<readonly UiFiltroAtivo[]>(() => {
    const ativos: UiFiltroAtivo[] = [];
    const finalidade = this.filtroFinalidade();
    if (finalidade)
      ativos.push({
        nome: 'Finalidade',
        valor: this.finalidadeChips.find((c) => c.value === finalidade)?.label ?? finalidade,
      });
    const situacao = this.filtroSituacao();
    if (situacao)
      ativos.push({
        nome: 'Situação',
        valor: this.situacaoChips.find((c) => c.value === situacao)?.label ?? situacao,
      });
    const tipo = this.filtroTipo();
    if (tipo) ativos.push({ nome: 'Tipo de processo', valor: this.rotuloDoTipo(tipo) });
    return ativos;
  });
  protected valorDe(evento: Event): string {
    return (evento.target as HTMLSelectElement).value;
  }
  protected rotuloDaFinalidade(valor: string): string {
    return FINALIDADES.find((f) => f.valor === valor)?.rotulo ?? valor;
  }
  protected rotuloDoTipo(codigo: string): string {
    return this.tiposDeProcesso().find((t) => t.codigo === codigo)?.nome ?? codigo;
  }
}
