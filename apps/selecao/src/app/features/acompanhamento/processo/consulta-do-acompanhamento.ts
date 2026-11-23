import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, switchMap } from 'rxjs';

import { UserContextService } from '@uniplus/shared-auth/bootstrap';
import { STATUS_HTTP, type ApiResult } from '@uniplus/shared-core/http';
import { ProcessosSeletivosApi, type ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';

/** Onde a leitura do processo está; só `lido` traz dados, e nenhum estado herda os do anterior. */
export type SituacaoDoAcompanhamento =
  | { readonly estado: 'lendo' }
  | { readonly estado: 'nao-encontrado' }
  | { readonly estado: 'acesso-negado' }
  | { readonly estado: 'falha' }
  | { readonly estado: 'lido'; readonly processo: ProcessoSeletivoDto };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LENDO: SituacaoDoAcompanhamento = { estado: 'lendo' };
const NAO_ENCONTRADO: SituacaoDoAcompanhamento = { estado: 'nao-encontrado' };

function situacaoDe(resultado: ApiResult<ProcessoSeletivoDto>): SituacaoDoAcompanhamento {
  if (resultado.ok) return { estado: 'lido', processo: resultado.data };
  if (resultado.status === STATUS_HTTP.NAO_ENCONTRADO) return NAO_ENCONTRADO;
  if (resultado.status === STATUS_HTTP.SEM_PERMISSAO) return { estado: 'acesso-negado' };
  return { estado: 'falha' };
}

/**
 * Consulta individual do acompanhamento: lê o processo por `ProcessosSeletivosApi.obter`, sem
 * consultar indicadores, inscrições nem documentos. Provida pela página, para morrer com ela.
 *
 * - identificador malformado não vira consulta HTTP;
 * - trocar o identificador ou a sessão limpa o que havia e cancela a leitura em curso (`switchMap`),
 *   então a resposta tardia de outro contexto não chega aqui;
 * - a nova tentativa consulta sempre o identificador atual.
 */
@Injectable()
export class ConsultaDoAcompanhamento {
  private readonly api = inject(ProcessosSeletivosApi);
  private readonly usuario = inject(UserContextService);

  private readonly pedidos = new Subject<string | null>();
  private readonly _situacao = signal<SituacaoDoAcompanhamento>(LENDO);
  private readonly _id = signal<string | null>(null);

  readonly situacao = this._situacao.asReadonly();
  readonly processoId = this._id.asReadonly();

  /** Identidade do usuário; a renovação do token não a altera. */
  private readonly idDoUsuario = computed(() =>
    this.usuario.isAuthenticated() ? (this.usuario.user()?.id ?? null) : null,
  );

  /** Usuário da última consulta pedida: o `effect` só reage ao que difere dele. */
  private usuarioConsultado = this.idDoUsuario();

  constructor() {
    this.pedidos
      .pipe(
        switchMap((id) => (id === null ? EMPTY : this.api.obter(id))),
        takeUntilDestroyed(),
      )
      .subscribe((resultado) => this._situacao.set(situacaoDe(resultado)));

    effect(() => {
      const usuario = this.idDoUsuario();
      // Só a troca de sessão reconsulta; a primeira execução não repete o que `abrir` já pediu.
      untracked(() => usuario !== this.usuarioConsultado && this.consultar());
    });
  }

  /** Abre o processo indicado, descartando o contexto anterior. */
  abrir(id: string): void {
    this._id.set(id);
    this.consultar();
  }

  tentarNovamente(): void {
    if (this._situacao().estado === 'falha') this.consultar();
  }

  private consultar(): void {
    this.usuarioConsultado = this.idDoUsuario();
    const id = this._id();
    if (id === null) return;
    if (!UUID.test(id)) return this.recusarSemConsulta();
    this._situacao.set(LENDO);
    this.pedidos.next(this.idDoUsuario() === null ? null : id);
  }

  private recusarSemConsulta(): void {
    this.pedidos.next(null);
    this._situacao.set(NAO_ENCONTRADO);
  }
}
