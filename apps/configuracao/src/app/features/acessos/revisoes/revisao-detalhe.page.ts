import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { PermissoesService } from '@uniplus/shared-auth/bootstrap';
import type { ItemDaRevisaoDto } from '@uniplus/shared-data/autorizacao';
import {
  acompanharLeitura,
  AlertComponent,
  FalhaDeLeituraComponent,
  IndicadorDaLeituraDirective,
  SpinnerComponent,
  TagComponent,
} from '@uniplus/shared-ui/components';
import { DateBrPipe } from '@uniplus/shared-ui/pipes';
import { PERMISSOES_DA_CONCESSAO } from '../../../acesso/permissoes-das-telas';
import { RecusaDaLeituraComponent } from '../../../shared/recusa-da-leitura';
import { MotivoDialogComponent } from '../motivo-dialog.component';
import { nomesDeEscopo } from '../nomes-de-escopo';
import { EscritaDoPerfil } from '../versoes/escrita-do-perfil';
import { devolverFocoAoTitulo } from '../versoes/foco-ao-titulo';
import { LeituraDosPerfis } from '../versoes/leitura-dos-perfis';
import { DecisaoDoItem } from './decisao-do-item';
import { ItensDoBeneficiarioComponent } from './itens-do-beneficiario.component';
import { decideOItem, porBeneficiario, type QuemLe } from './regras-da-revisao';
import { RevisaoDetalheStore } from './revisao-detalhe.store';
import { itens, pendentes, situacaoDaRevisao } from './rotulos-da-revisao';

const ID_DO_TITULO = 'cfg-revisao-titulo';

/** Uma revisão de acessos, por beneficiário, com a decisão de cada item para quem a pode tomar. */
@Component({
  selector: 'cfg-revisao-detalhe-page',
  standalone: true,
  imports: [
    RouterLink,
    DateBrPipe,
    AlertComponent,
    FalhaDeLeituraComponent,
    IndicadorDaLeituraDirective,
    ItensDoBeneficiarioComponent,
    MotivoDialogComponent,
    RecusaDaLeituraComponent,
    SpinnerComponent,
    TagComponent,
  ],
  providers: [
    RevisaoDetalheStore,
    { provide: LeituraDosPerfis, useExisting: RevisaoDetalheStore },
    EscritaDoPerfil,
    DecisaoDoItem,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cfg-page' },
  templateUrl: './revisao-detalhe.page.html',
})
export class RevisaoDetalhePage {
  /** Vem do parâmetro `:id` da rota. */
  readonly id = input.required<string>();

  protected readonly store = inject(RevisaoDetalheStore);
  protected readonly decisao = inject(DecisaoDoItem);
  protected readonly escrita = inject(EscritaDoPerfil);
  private readonly permissoes = inject(PermissoesService);
  private readonly escopos = nomesDeEscopo();
  protected readonly idDoTitulo = ID_DO_TITULO;
  protected readonly situacao = situacaoDaRevisao;
  protected readonly itens = itens;
  protected readonly pendentes = pendentes;
  protected readonly grupos = computed(() => porBeneficiario(this.store.revisao()?.itens ?? []));
  protected readonly encerrada = computed(() => this.store.revisao()?.situacao === 'concluida');
  private readonly quemLe: QuemLe = { tem: (codigo) => this.permissoes.tem(codigo) };
  protected readonly decide = computed(() => {
    const revisao = this.store.revisao();
    return (item: ItemDaRevisaoDto) => revisao !== null && decideOItem(revisao, item, this.quemLe);
  });
  /** O motivo da revogação fica na concessão; o link aparece a quem a pode ler. */
  protected readonly leConcessao = computed(() =>
    this.permissoes.temAlguma(...PERMISSOES_DA_CONCESSAO),
  );
  protected readonly nomeDoEscopo = (item: ItemDaRevisaoDto): string =>
    this.escopos.nome(item.escopo);
  protected readonly leitura = acompanharLeitura({
    assunto: 'revisão de acessos',
    falha: this.store.falha,
    pendente: this.store.carregando,
    indisponivel: this.escrita.gravando,
    recusada: computed(() => this.store.recusa() !== null),
    recarregar: () => this.store.tentarNovamente(),
    destino: () => document.getElementById(ID_DO_TITULO),
  });

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.store.id.set(id));
    });
    devolverFocoAoTitulo(this.escrita.gravando, ID_DO_TITULO);
  }
}
