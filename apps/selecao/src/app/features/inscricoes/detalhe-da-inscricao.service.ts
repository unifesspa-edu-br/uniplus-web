import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  ProblemI18nService,
  STATUS_HTTP,
  abrirAcessoEmNovaAba,
  useApiResource,
} from '@uniplus/shared-core/http';
import {
  ArquivosDaInscricaoDoProcessoApi,
  SELECAO_BASE_PATH,
  inscricaoAdministrativaRequest,
  type InscricaoAdministrativaDto,
} from '@uniplus/shared-data/selecao';

import { useCertameDoProcesso } from './certame-do-processo';

/** Onde a leitura do detalhe está; `ocioso` é a tela ainda sem inscrição a ler; `nao-encontrada` é o 404 da API, que a tela diz com texto próprio. */
export type SituacaoDoDetalhe =
  | { readonly estado: 'ocioso' }
  | { readonly estado: 'lendo' }
  | { readonly estado: 'nao-encontrada' }
  | { readonly estado: 'falha'; readonly mensagem: string }
  | { readonly estado: 'lida' };

/** Texto do arquivo que a API recusa abrir; não diz se o arquivo existe. */
export const ARQUIVO_NAO_DISPONIVEL = 'Arquivo não disponível';

/** Texto de quando o navegador impede a aba em que o arquivo abriria. */
export const ABERTURA_BLOQUEADA =
  'O navegador bloqueou a abertura do arquivo. Permita pop-ups para este endereço e tente de novo.';

/** Texto de quando o pedido de acesso falha sem resposta da API. */
export const FALHA_AO_ABRIR = 'Não foi possível abrir o arquivo. Tente novamente.';

/**
 * Como terminou o pedido para abrir um arquivo. `abandonado` é o pedido que a tela deixou de
 * esperar, porque a inscrição mudou ou a tela saiu: nada abriu e nada há a dizer.
 */
export type DesfechoDoAcessoAoArquivo =
  | { readonly situacao: 'aberto' }
  | { readonly situacao: 'abandonado' }
  | { readonly situacao: 'recusado'; readonly mensagem: string };

/**
 * O que a página do detalhe da inscrição sabe: a inscrição que a API devolveu e o que dá nome ao
 * processo e aos cursos. Provido pela página, porque descreve uma inscrição só.
 *
 * A tela mostra o que a API devolve; a decisão de visibilidade é dela. A leitura é um
 * `useApiResource` (ADR-0018) e só sai quando a tela abre a inscrição: trocar de inscrição cancela
 * a leitura em curso e o valor da anterior deixa de existir.
 */
@Injectable()
export class DetalheDaInscricao {
  private readonly basePath = inject(SELECAO_BASE_PATH);
  private readonly problemI18n = inject(ProblemI18nService);
  private readonly arquivosApi = inject(ArquivosDaInscricaoDoProcessoApi);
  /** Muda a cada inscrição aberta e na saída da tela; o pedido de acesso só vale na que o fez. */
  private geracao = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.geracao++);
  }

  readonly processoId = signal<string | null>(null);
  readonly inscricaoId = signal<string | null>(null);

  private readonly detalhe = useApiResource<InscricaoAdministrativaDto>(() => {
    const processo = this.processoId();
    const inscricao = this.inscricaoId();
    return processo === null || inscricao === null
      ? undefined
      : inscricaoAdministrativaRequest(this.basePath, processo, inscricao);
  });

  private readonly certame = useCertameDoProcesso(this.processoId);

  readonly inscricao = this.detalhe.data;
  readonly carregando = this.detalhe.isLoading;

  readonly situacao = computed<SituacaoDoDetalhe>(() => {
    const problema = this.detalhe.problem();
    if (problema !== null) {
      return problema.status === STATUS_HTTP.NAO_ENCONTRADO
        ? { estado: 'nao-encontrada' }
        : { estado: 'falha', mensagem: this.problemI18n.resolve(problema).title };
    }
    if (this.detalhe.error() !== undefined) {
      return { estado: 'falha', mensagem: 'Não foi possível carregar a inscrição.' };
    }
    if (this.detalhe.status() === 'idle') return { estado: 'ocioso' };
    return this.detalhe.data() === null ? { estado: 'lendo' } : { estado: 'lida' };
  });

  readonly situacaoDoCertame = this.certame.situacao;
  readonly carregandoCertame = this.certame.carregando;
  readonly nomeDoProcesso = this.certame.nomeDoProcesso;
  readonly nomesDasOfertas = this.certame.nomesDasOfertas;

  /** Lê a inscrição indicada; trocar de inscrição descarta a anterior. */
  abrir(processoId: string, inscricaoId: string): void {
    this.geracao++;
    this.processoId.set(processoId);
    this.inscricaoId.set(inscricaoId);
  }

  tentarNovamente(): void {
    this.detalhe.reload();
    if (this.situacaoDoCertame() === 'falha') this.certame.recarregar();
  }

  recarregarCertame(): void {
    this.certame.recarregar();
  }

  /**
   * Abre o arquivo numa aba nova pelo acesso auditado, como as demais telas de abrir da Seleção.
   * Tem de ser chamado dentro do clique. O 404 vira o texto único de arquivo indisponível, sem dizer
   * se o arquivo existe, e o pedido que chega depois de a inscrição mudar ou a tela sair é
   * descartado: a aba fecha e nada abre.
   */
  async abrirArquivo(arquivoId: string): Promise<DesfechoDoAcessoAoArquivo> {
    const processo = this.processoId();
    const inscricao = this.inscricaoId();
    if (processo === null || inscricao === null) {
      return { situacao: 'recusado', mensagem: ARQUIVO_NAO_DISPONIVEL };
    }
    const geracao = this.geracao;
    const aindaVale = (): boolean => geracao === this.geracao;
    try {
      const desfecho = await abrirAcessoEmNovaAba(
        () => firstValueFrom(this.arquivosApi.obterAcesso(processo, inscricao, arquivoId)),
        aindaVale,
      );
      switch (desfecho.situacao) {
        case 'aberta':
          return { situacao: 'aberto' };
        case 'abandonada':
          return { situacao: 'abandonado' };
        case 'bloqueada':
          return { situacao: 'recusado', mensagem: ABERTURA_BLOQUEADA };
        case 'recusada':
          return {
            situacao: 'recusado',
            mensagem:
              desfecho.problem.status === STATUS_HTTP.NAO_ENCONTRADO
                ? ARQUIVO_NAO_DISPONIVEL
                : this.problemI18n.resolve(desfecho.problem).title,
          };
      }
    } catch {
      return aindaVale()
        ? { situacao: 'recusado', mensagem: FALHA_AO_ABRIR }
        : { situacao: 'abandonado' };
    }
  }
}
