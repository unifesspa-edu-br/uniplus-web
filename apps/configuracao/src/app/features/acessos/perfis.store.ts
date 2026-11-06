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
import { navegacaoPorCursor } from '../../shared/navegacao-por-cursor';
import { notificarFalhasDeLeitura } from './falha-de-servidor';
import { textoDaRecusa } from './mensagens-de-acesso';

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
  readonly carregando = this.lista.isLoading;
  readonly carregandoCatalogo = this.consultaCatalogo.isLoading;
  readonly catalogo = computed(() => this.consultaCatalogo.data() ?? []);
  readonly erroDoCatalogo = computed(
    () => !!(this.consultaCatalogo.problem() || this.consultaCatalogo.error()),
  );
  readonly mensagemDeErro = computed(() => {
    const problema = this.lista.problem();
    return problema
      ? textoDaRecusa(this.problemas.resolve(problema))
      : this.lista.error()
        ? 'Não foi possível carregar a lista. Tente novamente.'
        : null;
  });

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
  carregarCatalogo(): void {
    if (this.catalogoAtivo()) this.consultaCatalogo.reload();
    else this.catalogoAtivo.set(true);
  }
}
