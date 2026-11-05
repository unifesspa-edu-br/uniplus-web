import { ChangeDetectionStrategy, Component, effect, inject, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { PERMISSAO } from '@uniplus/shared-auth/bootstrap';
import { TemPermissaoDirective } from '@uniplus/shared-auth/components';
import { type ItemDaProtecaoDoCatalogoDto } from '@uniplus/shared-data/configuracao';
import {
  AlertComponent,
  DrawerComponent,
  SegmentedComponent,
  SpinnerComponent,
  type UiSegmentedOption,
} from '@uniplus/shared-ui/components';
import { CatalogoCategoriasDocumento } from '../../shared/categorias-documento';
import { ProtecaoDoCatalogoStore } from './protecao-do-catalogo.store';
import { DecisoesDaProtecaoComponent } from './decisoes-da-protecao.component';
import { DecisaoDaProtecaoDialogoComponent } from './decisao-da-protecao-dialogo.component';
import { EdicaoDaProtecaoDoCatalogo } from './edicao-da-protecao-do-catalogo';
import { ProtecaoDoCatalogoListaComponent } from './protecao-do-catalogo-lista.component';
import { ItemDaProtecaoDetalheComponent } from './item-da-protecao-detalhe.component';

type Aba = 'aguardando' | 'decisoes';

const ABAS: readonly UiSegmentedOption<Aba>[] = [
  { value: 'aguardando', label: 'Aguardando decisão' },
  { value: 'decisoes', label: 'Decisões' },
];

/**
 * A aprovação da proteção de dados do catálogo: lista o que o administrador enviou na solicitação e
 * abre cada item num drawer com o que ele é, para a proteção de dados aprovar, recomendar ajuste ou
 * reprovar. A decisão vale sobre a proteção que a tela mostrou: se o item foi editado depois, a API
 * recusa e a lista é relida.
 */
@Component({
  selector: 'cfg-protecao-do-catalogo-page',
  standalone: true,
  imports: [
    TemPermissaoDirective,
    AlertComponent,
    DecisoesDaProtecaoComponent,
    DecisaoDaProtecaoDialogoComponent,
    ItemDaProtecaoDetalheComponent,
    ProtecaoDoCatalogoListaComponent,
    DrawerComponent,
    SegmentedComponent,
    SpinnerComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './protecao-do-catalogo.page.html',
  host: { class: 'cfg-page' },
  providers: [ProtecaoDoCatalogoStore, EdicaoDaProtecaoDoCatalogo],
})
export class ProtecaoDoCatalogoPage {
  protected readonly edicao = inject(EdicaoDaProtecaoDoCatalogo);
  protected readonly store = inject(ProtecaoDoCatalogoStore);
  protected readonly categorias = inject(CatalogoCategoriasDocumento);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly abas = ABAS;
  /** A aba ativa fica na query string: o link e o botão de voltar levam à mesma aba. */
  protected readonly aba = toSignal(
    this.route.queryParamMap.pipe(
      map((params): Aba => (params.get('aba') === 'decisoes' ? 'decisoes' : 'aguardando')),
    ),
    {
      initialValue:
        this.route.snapshot.queryParamMap.get('aba') === 'decisoes' ? 'decisoes' : 'aguardando',
    },
  );

  protected readonly permissaoDeAprovar = PERMISSAO.configuracao.protecaoDoCatalogoAprovar;

  protected readonly itens = this.store.itens;
  protected readonly carregando = this.store.carregando;
  protected readonly erroDeCarga = this.store.erroDeCarga;
  protected readonly itemAberto = this.store.itemAberto;
  protected readonly detalhe = this.store.detalhe;
  protected readonly carregandoDetalhe = this.store.carregandoDetalhe;
  protected readonly erroDoDetalhe = this.store.erroDoDetalhe;
  protected readonly naoEncontrado = this.store.naoEncontrado;

  constructor() {
    effect(() => {
      if (this.aba() === 'aguardando') untracked(() => this.store.carregar());
    });
  }

  /** Cada aba abre no seu estado inicial: trocar de aba tira da URL os filtros da outra. */
  protected trocarAba(aba: Aba | null): void {
    if (aba === null || aba === this.aba()) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        aba: aba === 'decisoes' ? 'decisoes' : null,
        ato: null,
        cadastro: null,
        de: null,
        ate: null,
        busca: null,
        minhas: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  protected carregar(): void {
    this.store.carregar();
  }

  protected abrirDetalhe(item: ItemDaProtecaoDoCatalogoDto): void {
    if (item.tipo === 'TIPO_DOCUMENTO') this.categorias.garantirCarregado();
    this.edicao.abrirDetalhe(item);
  }

  protected recarregarDetalhe(): void {
    this.store.recarregarDetalhe();
  }
}
