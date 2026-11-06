import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ResolucaoDeVinculo } from '@uniplus/shared-core/http';
import {
  LocalOfertaDto,
  TIPOS_LOCAL_OFERTA,
  TipoLocalOferta,
} from '@uniplus/shared-data/configuracao';
import {
  AlertComponent,
  EmptyStateComponent,
  IconButtonComponent,
  LookupLabelComponent,
  PagerComponent,
  SpinnerComponent,
  UiLookupFalho,
} from '@uniplus/shared-ui/components';
import { devolverFocoDaLista } from '../../shared/foco';

type Acao = 'editar' | 'remover';

const VERBO_DA_ACAO: Readonly<Record<Acao, string>> = { editar: 'Editar', remover: 'Remover' };

@Component({
  selector: 'cfg-locais-oferta-lista',
  standalone: true,
  imports: [
    AlertComponent,
    EmptyStateComponent,
    IconButtonComponent,
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
  readonly gravando = input.required<boolean>();
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

  protected readonly indisponivel = computed(() => this.carregando() || this.gravando());

  private readonly foco = devolverFocoDaLista({
    gravando: this.gravando,
    carregando: this.carregando,
    atributoDaLinha: 'data-local-id',
    idDoTitulo: 'cfg-locais-list-title',
    idDoCadastro: 'cfg-locais-novo',
  });

  protected tipoLabel(tipo: TipoLocalOferta): string {
    return TIPOS_LOCAL_OFERTA.find((item) => item.value === tipo)?.label ?? tipo;
  }

  protected cidadeLabel(local: LocalOfertaDto): string {
    const cidade = local.endereco?.cidade ?? local.cidade;
    return cidade ? `${cidade.nome} — ${cidade.uf}` : '—';
  }

  protected nomeDaAcao(acao: Acao, local: LocalOfertaDto): string {
    return `${VERBO_DA_ACAO[acao]} local de oferta ${this.tipoLabel(local.tipo)} — ${this.cidadeLabel(local)}`;
  }

  protected recarregar(falha: UiLookupFalho): void {
    falha.recarregar();
  }

  protected acionarCadastro(): void {
    this.foco.registrar(null);
    this.cadastrar.emit();
  }

  protected acionarEdicao(local: LocalOfertaDto): void {
    this.foco.registrar({ acao: 'editar', id: local.id });
    this.editar.emit(local);
  }

  protected acionarRemocao(local: LocalOfertaDto): void {
    this.foco.registrar({ acao: 'remover', id: local.id });
    this.remover.emit(local);
  }
}
