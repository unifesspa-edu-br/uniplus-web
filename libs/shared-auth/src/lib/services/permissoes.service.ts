import { HttpClient } from '@angular/common/http';
import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { catchError, firstValueFrom, map, of } from 'rxjs';
import { withVendorMime } from '@uniplus/shared-core/http';
import type { ApiResult } from '@uniplus/shared-core/http';
import type { CodigoDePermissao, ModuloDePermissao } from '../permissoes/catalogo';
import { AUTORIZACAO_BASE_PATH } from '../tokens/auth.tokens';
import { AuthService } from './auth.service';
import { pessoaDaSessao } from './pessoa-da-sessao';

/** Permissão que a API informa para a pessoa logada (`PermissaoEfetivaResponse`). */
export interface PermissaoEfetiva {
  readonly codigo: string;
  readonly nome: string;
}

export type EstadoDasPermissoes = 'pendente' | 'carregando' | 'carregada' | 'indisponivel';

const SEM_PERMISSOES: ReadonlySet<string> = new Set();

/**
 * Ponto único de consulta do que a pessoa logada pode fazer: menu, rotas e ações perguntam aqui
 * em vez de olhar o papel do token. A lista vem de `GET /api/autorizacao/permissoes/efetivas` e
 * serve só para montar a interface; a API decide o acesso a cada requisição.
 *
 * Carrega uma vez por sessão e recarrega quando a sessão muda (login, troca de usuário,
 * renovação do token). Sem sessão, na troca de pessoa ou em qualquer carga que falha, o conjunto
 * fica vazio: nunca sobra permissão antiga nem de outra pessoa.
 */
@Injectable({ providedIn: 'root' })
export class PermissoesService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly basePath = inject(AUTORIZACAO_BASE_PATH);

  private readonly _codigos = signal<ReadonlySet<string>>(SEM_PERMISSOES);
  private readonly _estado = signal<EstadoDasPermissoes>('pendente');

  private sessaoSincronizada: string | null = null;
  private cargaEmCurso: Promise<void> = Promise.resolve();
  private geracao = 0;

  readonly codigos = this._codigos.asReadonly();
  readonly estado = this._estado.asReadonly();

  constructor() {
    effect(() => {
      const sessao = this.auth.sessao();
      untracked(() => void this.sincronizar(sessao));
    });
  }

  /** Resolve quando as permissões da sessão atual estão carregadas (ou a carga falhou). */
  async garantir(): Promise<void> {
    for (;;) {
      const sessao = this.sessaoAtual();
      await this.sincronizar(sessao);
      if (this.sessaoAtual() === sessao) return;
    }
  }

  tem(codigo: CodigoDePermissao): boolean {
    return this._codigos().has(codigo);
  }

  temAlguma(...codigos: readonly CodigoDePermissao[]): boolean {
    const concedidas = this._codigos();
    return codigos.some((codigo) => concedidas.has(codigo));
  }

  /** Há alguma permissão do módulo (ex.: `configuracao:`), qualquer que seja o resource. */
  temNoModulo(...modulos: readonly ModuloDePermissao[]): boolean {
    const prefixos = modulos.map((modulo) => `${modulo}:`);
    for (const codigo of this._codigos()) {
      if (prefixos.some((prefixo) => codigo.startsWith(prefixo))) return true;
    }
    return false;
  }

  private sincronizar(sessao: string | null): Promise<void> {
    if (sessao === this.sessaoSincronizada) return this.cargaEmCurso;

    const pessoaAnterior = pessoaDaSessao(this.sessaoSincronizada);
    this.sessaoSincronizada = sessao;
    const geracao = ++this.geracao;
    this.cargaEmCurso =
      sessao === null ? this.semSessao() : this.carregarDaSessao(sessao, geracao, pessoaAnterior);
    return this.cargaEmCurso;
  }

  private semSessao(): Promise<void> {
    this.limpar('pendente');
    return Promise.resolve();
  }

  private carregarDaSessao(
    sessao: string,
    geracao: number,
    pessoaAnterior: string | null,
  ): Promise<void> {
    if (pessoaDaSessao(sessao) === pessoaAnterior) this._estado.set('carregando');
    else this.limpar('carregando');
    return this.carregar(sessao, geracao);
  }

  private async carregar(sessao: string, geracao: number): Promise<void> {
    const codigos = await this.consultar();
    if (geracao !== this.geracao || sessao !== this.sessaoAtual()) {
      void this.sincronizar(this.sessaoAtual());
      return;
    }
    this.aplicar(codigos);
  }

  private consultar(): Promise<ReadonlySet<string> | null> {
    const url = `${this.basePath}/api/autorizacao/permissoes/efetivas`;
    const consulta = this.http.get<ApiResult<readonly PermissaoEfetiva[]>>(url, {
      context: withVendorMime('permissao-efetiva', 1),
    });
    return firstValueFrom(
      consulta.pipe(
        map((resultado) =>
          resultado.ok ? new Set(resultado.data.map((permissao) => permissao.codigo)) : null,
        ),
        catchError(() => of(null)),
      ),
      { defaultValue: null },
    );
  }

  private aplicar(codigos: ReadonlySet<string> | null): void {
    if (codigos === null) {
      this.limpar('indisponivel');
      return;
    }
    this._codigos.set(codigos);
    this._estado.set('carregada');
  }

  private sessaoAtual(): string | null {
    return untracked(() => this.auth.sessao());
  }

  private limpar(estado: EstadoDasPermissoes): void {
    this._codigos.set(SEM_PERMISSOES);
    this._estado.set(estado);
  }
}
