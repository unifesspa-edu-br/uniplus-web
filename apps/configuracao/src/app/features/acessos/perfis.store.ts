import { HttpParams } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import {
  CursorPagina,
  ProblemI18nService,
  cursorToString,
  useApiResource,
  withVendorMime,
} from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import {
  AUTORIZACAO_BASE_PATH,
  type PerfilDto,
  type ModuloDoCatalogoDto,
} from '@uniplus/shared-data/autorizacao';
import { navegacaoPorCursor, recuperarDeCursorObsoleto } from '../../shared/navegacao-por-cursor';
import { desfechoDaLeitura } from './desfecho-da-leitura';
import { notificarFalhasDeLeitura } from './falha-de-servidor';

@Injectable()
export class PerfisStore {
  private readonly basePath = inject(AUTORIZACAO_BASE_PATH);
  private readonly problemas = inject(ProblemI18nService);
  private readonly notificacoes = inject(NotificationService);
  private readonly pagina = signal<CursorPagina | undefined>(undefined);
  private readonly lista = useApiResource<readonly PerfilDto[]>(() => {
    const pagina = this.pagina();
    let params = new HttpParams();
    if (pagina)
      params = params
        .set('cursor', cursorToString(pagina.cursor))
        .set('direction', pagina.direction);
    return {
      url: `${this.basePath}/api/autorizacao/perfis`,
      params,
      context: withVendorMime('perfil', 1),
    };
  });
  private readonly navegacao = navegacaoPorCursor(this.lista, this.pagina);
  private readonly catalogoAtivo = signal(false);
  private readonly consultaCatalogo = useApiResource<readonly ModuloDoCatalogoDto[]>(() =>
    this.catalogoAtivo()
      ? {
          url: `${this.basePath}/api/autorizacao/permissoes`,
          context: withVendorMime('permissao-catalogo', 1),
        }
      : undefined,
  );
  readonly itens = this.navegacao.itens;
  readonly anterior = this.navegacao.anterior;
  readonly proximo = this.navegacao.proximo;
  /** Cursor recusado: a paginação recomeça sem cursor, e a nova tentativa não repete o cursor morto. */
  private readonly recuperandoDeCursorObsoleto = recuperarDeCursorObsoleto({
    problem: this.lista.problem,
    pagina: this.pagina,
    notificacoes: this.notificacoes,
  });
  /** Inclui o intervalo entre a resposta de cursor recusado e a nova leitura sem cursor. */
  readonly carregando = computed(
    () => this.lista.isLoading() || this.recuperandoDeCursorObsoleto(),
  );
  readonly carregandoCatalogo = this.consultaCatalogo.isLoading;
  readonly catalogo = computed(() => this.consultaCatalogo.data() ?? []);
  private readonly desfechoDaLista = desfechoDaLeitura([this.lista], this.problemas);
  private readonly desfechoDoCatalogo = desfechoDaLeitura([this.consultaCatalogo], this.problemas);
  readonly falha = computed(() =>
    this.recuperandoDeCursorObsoleto() ? null : this.desfechoDaLista.falha(),
  );
  readonly recusa = this.desfechoDaLista.recusa;
  readonly mensagemDeErro = computed(() =>
    this.recuperandoDeCursorObsoleto() ? null : this.desfechoDaLista.mensagem(),
  );
  readonly falhaDoCatalogo = this.desfechoDoCatalogo.falha;
  readonly recusaDoCatalogo = this.desfechoDoCatalogo.recusa;

  constructor() {
    notificarFalhasDeLeitura(this.problemas, this.notificacoes, [
      this.lista.problem,
      this.consultaCatalogo.problem,
    ]);
  }

  proximaPagina(): void {
    this.navegacao.irParaProxima();
  }
  paginaAnterior(): void {
    this.navegacao.irParaAnterior();
  }
  recarregar(): void {
    if (this.pagina() === undefined) this.lista.reload();
    else this.pagina.set(undefined);
  }
  /** Repete a leitura da página que falhou; devolve `false` se nenhuma leitura começou. */
  tentarNovamente(): boolean {
    return this.lista.reload();
  }
  carregarCatalogo(): void {
    if (this.catalogoAtivo()) this.consultaCatalogo.reload();
    else this.catalogoAtivo.set(true);
  }
  tentarCatalogoNovamente(): boolean {
    return this.consultaCatalogo.reload();
  }
}
