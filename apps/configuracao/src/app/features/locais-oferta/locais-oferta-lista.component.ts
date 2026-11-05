import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ResolucaoDeVinculo } from '@uniplus/shared-core/http';
import {
  LocalOfertaDto,
  TIPOS_LOCAL_OFERTA,
  TipoLocalOferta,
} from '@uniplus/shared-data/configuracao';
import {
  AlertComponent,
  EmptyStateComponent,
  LookupLabelComponent,
  PagerComponent,
  SpinnerComponent,
  UiLookupFalho,
} from '@uniplus/shared-ui/components';

@Component({
  selector: 'cfg-locais-oferta-lista',
  standalone: true,
  imports: [
    AlertComponent,
    EmptyStateComponent,
    LookupLabelComponent,
    PagerComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './locais-oferta-lista.component.html',
})
export class LocaisOfertaListaComponent {
  readonly locais = input.required<readonly LocalOfertaDto[]>();
  readonly carregando = input.required<boolean>();
  readonly indisponivel = input.required<boolean>();
  readonly mensagemDeErro = input.required<string | null>();
  readonly temAnterior = input.required<boolean>();
  readonly temProximo = input.required<boolean>();
  readonly falhas = input.required<readonly UiLookupFalho[]>();
  readonly resolucoes = input.required<ReadonlyMap<string, ResolucaoDeVinculo>>();
  readonly localAfetadoId = input.required<string | null>();
  readonly andamento = input.required<string>();
  readonly cadastrar = output<void>();
  readonly editar = output<LocalOfertaDto>();
  readonly remover = output<LocalOfertaDto>();
  readonly anterior = output<void>();
  readonly proximo = output<void>();
  protected tipoLabel(tipo: TipoLocalOferta): string {
    return TIPOS_LOCAL_OFERTA.find((item) => item.value === tipo)?.label ?? tipo;
  }
  protected cidadeLabel(local: LocalOfertaDto): string {
    const cidade = local.endereco?.cidade ?? local.cidade;
    return cidade ? `${cidade.nome} — ${cidade.uf}` : '—';
  }
  protected recarregar(falha: UiLookupFalho): void {
    if (!this.indisponivel() && !this.carregando()) falha.recarregar();
  }
  protected acionarCadastro(): void {
    if (!this.indisponivel() && !this.carregando()) this.cadastrar.emit();
  }
  protected acionarEdicao(local: LocalOfertaDto): void {
    if (!this.indisponivel() && !this.carregando()) this.editar.emit(local);
  }
  protected acionarRemocao(local: LocalOfertaDto): void {
    if (!this.indisponivel() && !this.carregando()) this.remover.emit(local);
  }
}
