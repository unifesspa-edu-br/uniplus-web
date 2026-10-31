import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { ApiResult } from '@uniplus/shared-core/http';
import {
  rotuloDoPerfil,
  type PerfilConcedido,
  type RespostaDoPerfil,
} from '../models/perfil-concedido.model';
import { PROFILE_BASE_PATH } from '../tokens/auth.tokens';
import { AuthService } from './auth.service';

export type EstadoDosPerfis = 'pendente' | 'carregando' | 'carregada' | 'indisponivel';

/** Maior atraso que `setTimeout` aceita; acima disso ele dispara na hora. */
const ATRASO_MAXIMO_MS = 2_147_483_647;

/**
 * Os perfis de acesso vigentes da pessoa logada, para mostrar no cabeçalho, na barra lateral e em
 * Meu perfil. É texto de interface: a API decide o acesso a cada requisição.
 *
 * Carrega por sessão e recarrega quando ela muda (login, troca de pessoa, renovação do token).
 * Na troca de pessoa, sem sessão ou numa carga que falha, a lista fica vazia: nunca sobra perfil
 * antigo nem de outra pessoa. A ordem é a que a API devolve.
 *
 * Da resposta de `/api/profile/me` o serviço guarda só os perfis: `recarregar` devolve a resposta
 * inteira a quem pediu (Meu perfil), que decide o que fazer com nome, e-mail e CPF.
 */
@Injectable({ providedIn: 'root' })
export class PerfisDeAcessoService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly basePath = inject(PROFILE_BASE_PATH);

  private readonly _concedidos = signal<readonly PerfilConcedido[]>([]);
  private readonly _estado = signal<EstadoDosPerfis>('pendente');
  private readonly agora = signal(Date.now());

  private sessaoSincronizada: string | null = null;
  private geracao = 0;
  private temporizador: ReturnType<typeof setTimeout> | null = null;

  readonly estado = this._estado.asReadonly();
  /** Só as concessões ainda dentro do prazo: a que vence durante a sessão some sem esperar a recarga. */
  readonly perfis = computed(() =>
    this._concedidos().filter((perfil) => estaVigente(perfil, this.agora())),
  );
  readonly rotulos = computed(() => this.perfis().map(rotuloDoPerfil));

  constructor() {
    effect(() => {
      const sessao = this.auth.sessao();
      untracked(() => this.sincronizar(sessao));
    });
    inject(DestroyRef).onDestroy(() => this.cancelarTemporizador());
  }

  /**
   * Consulta de novo os perfis da sessão atual e devolve a resposta inteira, ou `null` quando a
   * consulta falha (ou não há sessão). A consulta é uma só: quem precisa dos demais dados da
   * resposta os recebe aqui, sem uma segunda requisição.
   */
  async recarregar(): Promise<RespostaDoPerfil | null> {
    const sessao = untracked(() => this.auth.sessao());
    if (sessao === null) return null;
    // Com os perfis da pessoa já carregados, a lista atual segue visível até a resposta chegar.
    if (untracked(this._estado) !== 'carregada') this._estado.set('carregando');
    return this.carregar(sessao, ++this.geracao);
  }

  private sincronizar(sessao: string | null): void {
    if (sessao === this.sessaoSincronizada) return;

    const pessoaAnterior = pessoaDa(this.sessaoSincronizada);
    this.sessaoSincronizada = sessao;
    const geracao = ++this.geracao;

    if (sessao === null) {
      this.limpar('pendente');
      return;
    }
    if (pessoaDa(sessao) !== pessoaAnterior) this.limpar('carregando');
    void this.carregar(sessao, geracao);
  }

  private async carregar(sessao: string, geracao: number): Promise<RespostaDoPerfil | null> {
    let resposta: RespostaDoPerfil | null;
    try {
      const resultado = await firstValueFrom(
        this.http.get<ApiResult<RespostaDoPerfil>>(`${this.basePath}/api/profile/me`),
      );
      resposta = resultado.ok ? resultado.data : null;
    } catch {
      resposta = null;
    }

    // Uma consulta mais nova (ou outra sessão) já assumiu: o estado não é mais deste resultado.
    // A resposta só chega a quem pediu se ainda for da mesma pessoa; nunca os dados de quem saiu.
    const atual = untracked(() => this.auth.sessao());
    if (geracao !== this.geracao || sessao !== atual) {
      return pessoaDa(sessao) === pessoaDa(atual) ? resposta : null;
    }

    if (resposta === null) {
      this.limpar('indisponivel');
      return null;
    }
    this.agora.set(Date.now());
    // A API sempre envia a lista; a ausência é tratada como "sem perfil" para não quebrar a tela.
    this._concedidos.set(resposta.perfis ?? []);
    this._estado.set('carregada');
    this.agendarVencimento();
    return resposta;
  }

  /** Reavalia a vigência no instante em que a próxima concessão com prazo vence. */
  private agendarVencimento(): void {
    this.cancelarTemporizador();
    const agora = Date.now();
    const proximo = this._concedidos()
      .map((perfil) => (perfil.validaAte === null ? NaN : Date.parse(perfil.validaAte)))
      .filter((instante) => instante > agora)
      .sort((a, b) => a - b)[0];
    if (proximo === undefined) return;

    this.temporizador = setTimeout(
      () => {
        this.agora.set(Date.now());
        this.agendarVencimento();
      },
      Math.min(proximo - agora, ATRASO_MAXIMO_MS),
    );
  }

  private cancelarTemporizador(): void {
    if (this.temporizador !== null) clearTimeout(this.temporizador);
    this.temporizador = null;
  }

  private limpar(estado: EstadoDosPerfis): void {
    this.cancelarTemporizador();
    this._concedidos.set([]);
    this._estado.set(estado);
  }
}

function estaVigente(perfil: PerfilConcedido, agora: number): boolean {
  if (perfil.validaAte === null) return true;
  const limite = Date.parse(perfil.validaAte);
  return Number.isNaN(limite) || limite > agora;
}

function pessoaDa(sessao: string | null): string | null {
  return sessao === null ? null : sessao.slice(0, sessao.lastIndexOf(':'));
}
