import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { PERMISSAO } from '@uniplus/shared-auth/bootstrap';
import { TemPermissaoDirective } from '@uniplus/shared-auth/components';
import { ModeloFormularioView, TipoProcessoDto } from '@uniplus/shared-data/configuracao';
import {
  EmptyStateComponent,
  FilterBarComponent,
  FilterChipsComponent,
  IconButtonComponent,
  PagerComponent,
  SpinnerComponent,
  TagComponent,
  type UiFiltroAtivo,
  type UiFilterChipOption,
} from '@uniplus/shared-ui/components';
import { devolverFocoDaLista } from '../../shared/foco';

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
  readonly filtroFaseDeInscricao = model('');
  readonly filtroSituacao = model('');
  readonly filtroTipo = model('');
  readonly tiposDeProcesso = input.required<readonly TipoProcessoDto[]>();
  readonly modelosBuscados = input.required<readonly ModeloFormularioView[]>();
  readonly loading = input.required<boolean>();
  readonly errorMessage = input.required<string | null>();
  readonly prevCursor = input.required<string | null>();
  readonly nextCursor = input.required<string | null>();
  readonly gravando = input.required<boolean>();
  readonly emAndamento = input.required<string | null>();
  readonly criar = output<void>();
  readonly ativar = output<ModeloFormularioView>();
  readonly desativar = output<ModeloFormularioView>();
  readonly anterior = output<void>();
  readonly proximo = output<void>();
  protected readonly ocupada = computed(() => this.loading() || this.gravando());
  private readonly foco = devolverFocoDaLista({
    gravando: this.gravando,
    carregando: this.loading,
    atributoDaLinha: 'data-modelo-id',
    idDoTitulo: 'cfg-modelos-list-title',
  });
  protected readonly permissaoDeManter = PERMISSAO.configuracao.modelosFormularioManter;
  protected readonly faseDeInscricaoChips: readonly UiFilterChipOption[] = [
    { value: 'true', label: 'Serve' },
    { value: 'false', label: 'Não serve' },
    { value: '', label: 'Todos' },
  ];
  protected readonly situacaoChips: readonly UiFilterChipOption[] = [
    { value: 'true', label: 'Ativos' },
    { value: 'false', label: 'Desativados' },
    { value: '', label: 'Todos' },
  ];
  protected readonly filtrosAtivos = computed<readonly UiFiltroAtivo[]>(() => {
    const ativos: UiFiltroAtivo[] = [];
    const faseDeInscricao = this.filtroFaseDeInscricao();
    if (faseDeInscricao)
      ativos.push({
        nome: 'Fase de inscrição',
        valor:
          this.faseDeInscricaoChips.find((c) => c.value === faseDeInscricao)?.label ??
          faseDeInscricao,
      });
    this.adicionarSituacao(ativos);
    const tipo = this.filtroTipo();
    if (tipo) ativos.push({ nome: 'Tipo de processo', valor: this.rotuloDoTipo(tipo) });
    return ativos;
  });
  private adicionarSituacao(ativos: UiFiltroAtivo[]): void {
    const situacao = this.filtroSituacao();
    if (situacao)
      ativos.push({
        nome: 'Situação',
        valor: this.situacaoChips.find((c) => c.value === situacao)?.label ?? situacao,
      });
  }
  protected criarModelo(evento: Event): void {
    if (this.ocupada()) {
      evento.preventDefault();
      return;
    }
    this.criar.emit();
  }
  protected trocarSituacao(modelo: ModeloFormularioView): void {
    this.foco.registrar({ acao: 'situacao', id: modelo.id });
    (modelo.ativo ? this.desativar : this.ativar).emit(modelo);
  }
  protected valorDe(evento: Event): string {
    return (evento.target as HTMLSelectElement).value;
  }
  protected rotuloDoTipo(codigo: string): string {
    return this.tiposDeProcesso().find((t) => t.codigo === codigo)?.nome ?? codigo;
  }
}
