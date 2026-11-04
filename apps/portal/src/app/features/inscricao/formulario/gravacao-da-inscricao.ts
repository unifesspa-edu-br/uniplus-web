import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, type Observable, defer, filter, map, tap } from 'rxjs';
import { type ApiFailure, type ApiResult, ProblemI18nService } from '@uniplus/shared-core/http';
import {
  type ComprovanteInscricaoDto,
  type InscricaoDto,
  type InscricaoRequest,
  SituacaoInscricao,
} from '@uniplus/shared-data/selecao';
import type { ErroDoServidor, FormularioDoCandidatoComponent } from '@uniplus/shared-ui/components';

import { AnuncioDaInscricao } from './anuncio-da-inscricao';
import { AvaliacaoDaInscricaoEstado } from './avaliacao-da-inscricao.estado';
import {
  confirmacaoDaGravacao,
  corpoDaAvaliacao,
  corpoDaGravacao,
  mesmoConteudoGravado,
} from './corpo-da-inscricao';
import { EnvioDeDocumentosDaInscricao } from './envio-de-documentos-da-inscricao';
import { EscolhaDoCurso } from './escolha-do-curso';
import { InscricaoDoCandidatoService } from './inscricao-do-candidato.service';
import { LeituraDaInscricao } from './leitura-da-inscricao';
import { CONFLITOS, type RecusaDaSegundaOpcao, separarRecusas } from './recusas-da-inscricao';

/** O que a gravação lê do formulário no clique: a emissão das mudanças só chega no ciclo seguinte. */
export type FormularioParaGravar = Pick<
  FormularioDoCandidatoComponent,
  'simulacao' | 'termosAceitos' | 'concluirTodas'
>;

export type Operacao = 'salvando' | 'enviando';

type Chamada<T> = (
  processoId: string,
  request: InscricaoRequest,
  eTag: string,
) => Observable<ApiResult<T>>;

/** A recusa sem campo para apontar: o título diz o que aconteceu e o texto, o que fazer. */
export interface RecusaGeral {
  readonly titulo: string;
  readonly texto: string;
}

const TITULO_DA_RECUSA = 'A inscrição não foi gravada';

/**
 * Tudo o que a tela escreve na inscrição: salvar o rascunho, enviar e reler a revisão depois de uma
 * chamada de documento. É a única dona do que está em curso: enquanto uma escrita corre, nenhuma
 * outra parte, e a tela fica bloqueada. Provida pela página.
 */
@Injectable()
export class GravacaoDaInscricao {
  private readonly servico = inject(InscricaoDoCandidatoService);
  private readonly problemas = inject(ProblemI18nService);
  private readonly documentos = inject(EnvioDeDocumentosDaInscricao);
  private readonly leitura = inject(LeituraDaInscricao);
  private readonly escolha = inject(EscolhaDoCurso);
  private readonly avaliacao = inject(AvaliacaoDaInscricaoEstado);
  private readonly anuncio = inject(AnuncioDaInscricao);
  private readonly destroyRef = inject(DestroyRef);

  /** O que está sendo gravado agora, ou `null`. */
  readonly operacao = signal<Operacao | null>(null);
  readonly ocupada = computed(() => this.operacao() !== null);
  /** O ETag está sendo relido depois de uma chamada de documento: gravar agora sairia com o velho. */
  private readonly relendoARevisao = signal(false);
  private ultimaReleituraDaRevisao = 0;

  /** O envio dos arquivos dos documentos exigidos, no processo desta tela. */
  readonly envioDeDocumentos = computed(() => {
    const processoId = this.leitura.processoId();
    return processoId === null ? null : this.documentos.paraOProcesso(processoId);
  });

  readonly bloqueada = computed(
    () =>
      this.ocupada() ||
      this.relendoARevisao() ||
      (this.envioDeDocumentos()?.ocupado() ?? false) ||
      this.leitura.precisaRecarregar(),
  );

  readonly errosDoServidor = signal<readonly ErroDoServidor[]>([]);
  readonly recusaGeral = signal<RecusaGeral | null>(null);
  readonly conflito = signal<string | null>(null);
  readonly comprovante = signal<ComprovanteInscricaoDto | null>(null);

  /** A inscrição enviada só muda por novo envio, que emite novo comprovante: não há rascunho dela. */
  readonly enviada = computed(
    () =>
      this.comprovante() !== null ||
      this.leitura.inscricao()?.situacao === SituacaoInscricao.submetida,
  );

  salvar(formulario: FormularioParaGravar): void {
    const revisao = this.avaliacao.revisao();
    this.gravar(
      formulario,
      'salvando',
      (processoId, request, eTag) => this.servico.salvar(processoId, request, eTag),
      (inscricao) => {
        this.leitura.adotar(inscricao);
        this.avaliacao.aplicarDaGravacao(inscricao.avaliacao, revisao);
        this.anuncio.definir('Rascunho salvo.');
        this.operacao.set(null);
      },
    );
  }

  enviar(formulario: FormularioParaGravar): void {
    if (this.bloqueada()) return;
    // Só o envio de um formulário válido conclui as seções.
    if (formulario.concluirTodas(false) > 0) return;
    this.gravar(
      formulario,
      'enviando',
      (processoId, request, eTag) => this.servico.submeter(processoId, request, eTag),
      (comprovante) => {
        this.comprovante.set(comprovante);
        this.anuncio.definir(`Inscrição enviada. Número ${comprovante.numeroInscricao}.`);
        // O formulário só se libera com o ETag novo: antes disso, uma correção sairia com o velho.
        this.relerAGravada((lida) => {
          this.operacao.set(null);
          if (!lida) this.leitura.motivoDoRecarregar.set('envio');
        });
      },
    );
  }

  /**
   * Cada chamada de documento avança a revisão da inscrição. O ETag da tela é relido sem trocar as
   * respostas dela, ou o próximo salvar seria recusado e as respostas não salvas se perderiam. Emite
   * quando a releitura mais recente termina; uma resposta antiga não pode pôr na tela um ETag mais
   * velho, e por isso não emite.
   */
  relerARevisao(): Observable<void> {
    return defer(() => {
      const processoId = this.leitura.processoId();
      if (processoId === null) return EMPTY;
      this.relendoARevisao.set(true);
      const releitura = ++this.ultimaReleituraDaRevisao;
      return this.servico.obter(processoId).pipe(
        filter(() => releitura === this.ultimaReleituraDaRevisao),
        tap((resultado) => this.adotarARevisaoRelida(resultado)),
        map(() => undefined),
      );
    });
  }

  private adotarARevisaoRelida(resultado: ApiResult<InscricaoDto>): void {
    this.relendoARevisao.set(false);
    if (!resultado.ok) {
      // Com o ETag velho na tela, o próximo salvar seria recusado e as respostas se perderiam.
      this.leitura.motivoDoRecarregar.set('incerta');
      return;
    }
    const atual = this.leitura.inscricao();
    // Se outra aba gravou nesse meio-tempo, o ETag novo cobre as respostas dela: a tela fica com o
    // velho, e o próximo salvar cai no conflito em vez de sobrescrever o que a outra aba gravou.
    if (atual && mesmoConteudoGravado(atual, resultado.data)) {
      this.leitura.adotarETag(resultado.data.eTag);
    }
  }

  private gravar<T>(
    formulario: FormularioParaGravar,
    operacao: Operacao,
    chamada: Chamada<T>,
    sucesso: (dado: T) => void,
  ): void {
    const inscricao = this.leitura.inscricao();
    const processoId = this.leitura.processoId();
    if (!inscricao || processoId === null || this.bloqueada()) return;
    this.recomecar(operacao);
    const corpo = corpoDaAvaliacao(inscricao, formulario.simulacao(), this.escolha.escolhidas());
    const request = corpoDaGravacao(
      corpo,
      formulario.termosAceitos(),
      this.leitura.formulario()?.termos ?? [],
    );
    chamada(processoId, request, inscricao.eTag)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => {
        if (resultado.ok) {
          // Quem trata o sucesso libera o formulário: o envio espera a releitura do ETag.
          sucesso(resultado.data);
          return;
        }
        this.tratarRecusa(resultado);
      });
  }

  /** Começa uma escrita: tudo o que a anterior deixou na tela some. */
  private recomecar(operacao: Operacao): void {
    this.operacao.set(operacao);
    this.conflito.set(null);
    this.recusaGeral.set(null);
    this.errosDoServidor.set([]);
    this.escolha.limparRecusas();
    this.anuncio.definir('');
  }

  /**
   * O envio devolve o comprovante, não a inscrição: sem reler, a próxima correção sairia com o ETag velho.
   * `aoTerminar` diz se a releitura trouxe a inscrição. Com `eTagDaTentativa`, a releitura só substitui
   * a inscrição e a avaliação da tela se o ETag mudou: com o mesmo, nada foi gravado, e a avaliação
   * gravada descreve respostas mais antigas que as da tela.
   */
  private relerAGravada(aoTerminar: (lida: boolean) => void, eTagDaTentativa?: string): void {
    const processoId = this.leitura.processoId();
    if (processoId === null) return;
    const revisao = this.avaliacao.revisao();
    this.servico
      .obter(processoId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) => {
        if (resultado.ok && resultado.data.eTag !== eTagDaTentativa) {
          this.leitura.adotar(resultado.data);
          this.avaliacao.aplicarDaGravacao(resultado.data.avaliacao, revisao);
        }
        aoTerminar(resultado.ok);
      });
  }

  /** Libera o formulário ao fim, exceto na falha ambígua, que só o libera quando a releitura termina. */
  private tratarRecusa(falha: ApiFailure): void {
    if (CONFLITOS.has(falha.problem.code)) {
      this.operacao.set(null);
      this.conflito.set(
        'Recarregamos a inscrição com a versão mais recente, e o formulário pode ter mudado. Confira as respostas e grave de novo.',
      );
      this.leitura.recarregar();
      return;
    }
    const ambigua = falha.status === 0 || falha.status >= 500;
    // O formulário volta a aceitar foco antes de as recusas o levarem ao campo recusado.
    if (!ambigua) this.operacao.set(null);
    this.exibirRecusa(falha, ambigua);
    if (ambigua) this.confirmarGravacao();
  }

  /**
   * A gravação pode ter acontecido sem a resposta chegar: o formulário só se libera com o ETag relido.
   * Se o ETag mudou, a gravação aconteceu e a tela passa a mostrar o estado do servidor, sem a recusa
   * neutra, e o aviso confirma o que foi gravado; se a releitura falha, quem fala é o aviso de recarregar.
   */
  private confirmarGravacao(): void {
    const eTagDaTentativa = this.leitura.inscricao()?.eTag;
    this.relerAGravada((lida) => {
      this.operacao.set(null);
      if (!lida) {
        this.leitura.motivoDoRecarregar.set('incerta');
        this.recusaGeral.set(null);
        return;
      }
      const relida = this.leitura.inscricao();
      if (relida && relida.eTag !== eTagDaTentativa) {
        this.recusaGeral.set(null);
        this.anuncio.definir(confirmacaoDaGravacao(relida));
      }
    }, eTagDaTentativa);
  }

  /** Mostra a recusa no campo, numa das ofertas ou, sem onde apontar, como recusa geral. */
  private exibirRecusa(falha: ApiFailure, ambigua: boolean): void {
    const recusas = separarRecusas(falha.problem.errors ?? []);
    const dasOfertas = this.mostrarRecusasDasOfertas(recusas.daOferta, recusas.daSegunda);
    if (recusas.porCampo.length > 0) this.errosDoServidor.set(recusas.porCampo);
    const total = recusas.porCampo.length + dasOfertas;
    if (total > 0) {
      this.anuncio.definir(
        total === 1
          ? 'Uma resposta foi recusada. Corrija e tente de novo.'
          : `${total} respostas foram recusadas. Corrija e tente de novo.`,
      );
      return;
    }
    if (ambigua) {
      this.recusaGeral.set({
        titulo: 'Não conseguimos confirmar a gravação',
        texto: 'Confira as respostas e tente de novo.',
      });
      return;
    }
    const mensagem = this.problemas.resolve(falha.problem);
    this.recusaGeral.set({ titulo: TITULO_DA_RECUSA, texto: mensagem.detail ?? mensagem.title });
  }

  private mostrarRecusasDasOfertas(
    daOferta: string | null,
    daSegunda: RecusaDaSegundaOpcao | null,
  ): number {
    if (daOferta === null && daSegunda === null) return 0;
    const mostradas = this.escolha.mostrarRecusas(daOferta, daSegunda);
    if (mostradas.textoGeral !== null) {
      this.recusaGeral.set({ titulo: TITULO_DA_RECUSA, texto: mostradas.textoGeral });
    }
    return mostradas.mostradas;
  }
}
