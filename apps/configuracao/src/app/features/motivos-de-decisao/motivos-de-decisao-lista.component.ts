import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { PERMISSAO } from '@uniplus/shared-auth/bootstrap';
import { TemPermissaoDirective } from '@uniplus/shared-auth/components';
import { MotivoDeDecisaoDto } from '@uniplus/shared-data/selecao';
import {
  EmptyStateComponent,
  FilterBarComponent,
  IconButtonComponent,
  PagerComponent,
  SpinnerComponent,
  TagComponent,
} from '@uniplus/shared-ui/components';
import type { AndamentoDaEscrita } from '../../shared/escrita';
import { devolverFocoDaLista } from '../../shared/foco';
import { rotuloDe, SENTIDOS_DE_MOTIVO } from './tipos-de-motivo';

type Acao = 'editar' | 'situacao';

@Component({
  selector: 'cfg-motivos-de-decisao-lista',
  imports: [
    EmptyStateComponent,
    FilterBarComponent,
    IconButtonComponent,
    PagerComponent,
    SpinnerComponent,
    TagComponent,
    TemPermissaoDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './motivos-de-decisao-lista.component.html',
})
export class MotivosDeDecisaoListaComponent {
  readonly motivos = input.required<readonly MotivoDeDecisaoDto[]>();
  readonly tipoEscolhido = input.required<string>();
  readonly mostraSubclassificacao = input.required<boolean>();
  readonly carregando = input.required<boolean>();
  readonly gravando = input.required<boolean>();
  readonly andamento = input.required<AndamentoDaEscrita | null>();
  readonly erro = input.required<string | null>();
  readonly temFiltro = input.required<boolean>();
  readonly temAnterior = input.required<boolean>();
  readonly temProximo = input.required<boolean>();
  readonly termoBusca = model.required<string>();
  readonly cadastrar = output<void>();
  readonly editar = output<MotivoDeDecisaoDto>();
  readonly alternarSituacao = output<MotivoDeDecisaoDto>();
  readonly anterior = output<void>();
  readonly proximo = output<void>();

  protected readonly permissaoDeManter = PERMISSAO.selecao.motivosDeDecisaoManter;
  protected readonly indisponivel = computed(() => this.carregando() || this.gravando());

  protected readonly descricaoDaBuscaSemResultado = computed(() =>
    this.temAnterior() || this.temProximo()
      ? 'Nenhum motivo desta página confere com a busca. Ela não alcança as outras páginas: use a paginação para procurar nelas.'
      : 'Ajuste a busca para ver resultados.',
  );

  private readonly foco = devolverFocoDaLista({
    gravando: this.gravando,
    carregando: this.carregando,
    atributoDaLinha: 'data-motivo-id',
    idDoTitulo: 'cfg-motivos-de-decisao-list-title',
    idDoCadastro: 'cfg-motivos-de-decisao-novo',
  });

  protected acionarCadastro(): void {
    if (this.indisponivel()) return;
    this.foco.registrar(null);
    this.cadastrar.emit();
  }

  protected acionar(acao: Acao, motivo: MotivoDeDecisaoDto): void {
    if (this.indisponivel()) return;
    this.foco.registrar({ acao, id: motivo.id });
    (acao === 'editar' ? this.editar : this.alternarSituacao).emit(motivo);
  }

  protected sentidoDe(motivo: MotivoDeDecisaoDto): string {
    return rotuloDe(SENTIDOS_DE_MOTIVO, motivo.sentido);
  }

  protected nomeDaAcaoDeSituacao(motivo: MotivoDeDecisaoDto): string {
    return `${motivo.ativo ? 'Desativar' : 'Reativar'} motivo ${motivo.codigo}`;
  }
}
