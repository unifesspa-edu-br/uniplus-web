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
  CamposDaInscricaoDoProcessoApi,
  SELECAO_BASE_PATH,
  inscricaoAdministrativaRequest,
  type InscricaoAdministrativaDto,
} from '@uniplus/shared-data/selecao';

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

/** Texto do campo que a API recusa revelar. Não sugere causa: a API responde 404 justamente para não dizer se o dado existe. */
export const DADO_NAO_DISPONIVEL = 'Dado não disponível.';

/** Texto de quando a revelação falha sem resposta da API. */
export const FALHA_AO_REVELAR = 'Não foi possível revelar o dado. Tente novamente.';

/**
 * Onde a revelação de um campo está. O campo que ninguém pediu para revelar não tem entrada: a tela
 * mostra o que a API devolveu na leitura, já mascarado.
 */
export type RevelacaoDoCampo =
  | { readonly estado: 'pendente' }
  | { readonly estado: 'revelado'; readonly valor: string }
  | { readonly estado: 'indisponivel' }
  | { readonly estado: 'falha'; readonly mensagem: string };

/** Identifica um campo na inscrição: o fato e, quando está em grupo, a ocorrência. */
export function chaveDoCampo(fatoCodigo: string, ocorrenciaId: string | null): string {
  return JSON.stringify([fatoCodigo, ocorrenciaId]);
}

const SEM_REVELACOES: ReadonlyMap<string, RevelacaoDoCampo> = new Map();

/**
 * O que a página do detalhe da inscrição sabe: a inscrição que a API devolveu, que já traz o processo
 * e as ofertas pelo nome. Provido pela página, porque descreve uma inscrição só.
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
  private readonly camposApi = inject(CamposDaInscricaoDoProcessoApi);
  /** Muda a cada inscrição aberta e na saída da tela; o pedido de acesso só vale na que o fez. */
  private geracao = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.esquecerRevelacoes());
  }

  /**
   * Os campos revelados a pedido. Vivem só no estado desta página: zerados quando a inscrição muda
   * e descartados na saída da tela, sem passar por cache nem por armazenamento.
   */
  readonly revelacoes = signal<ReadonlyMap<string, RevelacaoDoCampo>>(SEM_REVELACOES);

  readonly processoId = signal<string | null>(null);
  readonly inscricaoId = signal<string | null>(null);

  private readonly detalhe = useApiResource<InscricaoAdministrativaDto>(() => {
    const processo = this.processoId();
    const inscricao = this.inscricaoId();
    return processo === null || inscricao === null
      ? undefined
      : inscricaoAdministrativaRequest(this.basePath, processo, inscricao);
  });

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

  readonly nomeDoProcesso = computed(() => this.detalhe.data()?.processo.nome ?? null);

  /** Lê a inscrição indicada; trocar de inscrição descarta a anterior. */
  abrir(processoId: string, inscricaoId: string): void {
    this.esquecerRevelacoes();
    this.processoId.set(processoId);
    this.inscricaoId.set(inscricaoId);
  }

  /** Descarta o valor revelado do campo; revelar de novo faz novo pedido. */
  ocultar(fatoCodigo: string, ocorrenciaId: string | null): void {
    const chave = chaveDoCampo(fatoCodigo, ocorrenciaId);
    this.revelacoes.update((atuais) => {
      const proximas = new Map(atuais);
      proximas.delete(chave);
      return proximas;
    });
  }

  private esquecerRevelacoes(): void {
    this.geracao++;
    this.revelacoes.set(SEM_REVELACOES);
  }

  private registrar(chave: string, revelacao: RevelacaoDoCampo): void {
    this.revelacoes.update((atuais) => new Map(atuais).set(chave, revelacao));
  }

  /**
   * Pede à API o valor de um campo e o guarda só no estado da página. Um pedido revela um campo; o
   * pedido em curso do mesmo campo não se repete, e o que chega depois de a inscrição mudar ou a
   * tela sair é descartado. O 404 mantém o valor mascarado e diz que o dado não está disponível.
   */
  async revelar(fatoCodigo: string, ocorrenciaId: string | null): Promise<void> {
    const processo = this.processoId();
    const inscricao = this.inscricaoId();
    const chave = chaveDoCampo(fatoCodigo, ocorrenciaId);
    if (processo === null || inscricao === null) return;
    if (this.revelacoes().get(chave)?.estado === 'pendente') return;
    const geracao = this.geracao;
    const aindaVale = (): boolean => geracao === this.geracao;
    this.registrar(chave, { estado: 'pendente' });
    try {
      const resultado = await firstValueFrom(
        this.camposApi.revelar(processo, inscricao, fatoCodigo, ocorrenciaId),
      );
      if (!aindaVale()) return;
      if (resultado.ok) {
        this.registrar(chave, { estado: 'revelado', valor: resultado.data.valor });
      } else if (resultado.problem.status === STATUS_HTTP.NAO_ENCONTRADO) {
        this.registrar(chave, { estado: 'indisponivel' });
      } else {
        this.registrar(chave, {
          estado: 'falha',
          mensagem: this.problemI18n.resolve(resultado.problem).title,
        });
      }
    } catch {
      if (aindaVale()) {
        this.registrar(chave, { estado: 'falha', mensagem: FALHA_AO_REVELAR });
      }
    }
  }

  /** Repete a leitura; `false` quando nenhuma leitura recomeçou. */
  tentarNovamente(): boolean {
    this.esquecerRevelacoes();
    return this.detalhe.reload();
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
