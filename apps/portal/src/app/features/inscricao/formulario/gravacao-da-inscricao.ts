import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, type Observable, defer, filter, map, tap } from 'rxjs';
import {
  type ApiFailure,
  type ApiResult,
  ProblemI18nService,
  separarCausas,
} from '@uniplus/shared-core/http';
import {
  type ReciboDaInscricaoDto,
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
import { EscolhaDoCurso, type RecusasMostradas } from './escolha-do-curso';
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

/** A inscrição lida que a escrita grava, e o processo a que ela pertence. */
interface InscricaoAGravar {
  readonly processoId: string;
  readonly inscricao: InscricaoDto;
}

/** A recusa sem campo para apontar: o título diz o que aconteceu e o texto, o que fazer. */
export interface RecusaGeral {
  readonly titulo: string;
  readonly texto: string;
}

const TITULO_DA_RECUSA = 'A inscrição não foi gravada';
const ANUNCIO_DA_RECUSA_GERAL = `${TITULO_DA_RECUSA}. Leia a mensagem de recusa e tente de novo.`;
const TITULO_DA_GRAVACAO_INCERTA = 'Não conseguimos confirmar a gravação';
const ORIENTACAO_DA_GRAVACAO_INCERTA = 'Confira as respostas e tente de novo.';

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
  readonly recibo = signal<ReciboDaInscricaoDto | null>(null);

  /** A inscrição enviada só muda por novo envio, que emite novo comprovante: não há rascunho dela. */
  readonly enviada = computed(
    () =>
      this.recibo() !== null || this.leitura.inscricao()?.situacao === SituacaoInscricao.submetida,
  );

  salvar(formulario: FormularioParaGravar): void {
    const revisao = this.avaliacao.revisao();
    this.gravar(
      formulario,
      'salvando',
      (processoId, request, eTag) => this.servico.salvar(processoId, request, eTag),
      (inscricao) => this.concluirOSalvar(inscricao, revisao),
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
      (recibo) => this.concluirOEnvio(recibo),
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

  private concluirOSalvar(inscricao: InscricaoDto, revisao: number): void {
    this.leitura.adotar(inscricao);
    this.avaliacao.aplicarDaGravacao(inscricao.avaliacao, revisao);
    this.anuncio.definir('Rascunho salvo.');
    this.operacao.set(null);
  }

  private concluirOEnvio(recibo: ReciboDaInscricaoDto): void {
    this.recibo.set(recibo);
    this.anuncio.definir(`Inscrição enviada. Número ${recibo.numeroInscricao}.`);
    // O formulário só se libera com o ETag novo: antes disso, uma correção sairia com o velho.
    this.relerAGravada((lida) => {
      this.operacao.set(null);
      if (!lida) this.leitura.motivoDoRecarregar.set('envio');
    });
  }

  /**
   * Começa a escrita se a tela pode gravar. Sem inscrição lida, sem processo ou bloqueada, devolve
   * `null` sem tocar na tela.
   */
  private comecarAEscrita(operacao: Operacao): InscricaoAGravar | null {
    const inscricao = this.leitura.inscricao();
    const processoId = this.leitura.processoId();
    if (!inscricao || processoId === null || this.bloqueada()) return null;
    this.recomecar(operacao);
    return { processoId, inscricao };
  }

  private requestDaGravacao(
    inscricao: InscricaoDto,
    formulario: FormularioParaGravar,
  ): InscricaoRequest {
    const corpo = corpoDaAvaliacao(inscricao, formulario.simulacao(), this.escolha.escolhidas());
    return corpoDaGravacao(
      corpo,
      formulario.termosAceitos(),
      this.leitura.formulario()?.termos ?? [],
    );
  }

  /** Quem conclui o sucesso libera o formulário: o envio espera a releitura do ETag. */
  private gravar<T>(
    formulario: FormularioParaGravar,
    operacao: Operacao,
    chamada: Chamada<T>,
    concluir: (dado: T) => void,
  ): void {
    const alvo = this.comecarAEscrita(operacao);
    if (alvo === null) return;
    const request = this.requestDaGravacao(alvo.inscricao, formulario);
    chamada(alvo.processoId, request, alvo.inscricao.eTag)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((resultado) =>
        resultado.ok ? concluir(resultado.data) : this.tratarRecusa(resultado),
      );
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
   * O envio devolve o recibo, não a inscrição: sem reler, a próxima correção sairia com o ETag velho.
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
    this.relerAGravada(
      (lida) => this.concluirAGravacaoIncerta(lida, eTagDaTentativa),
      eTagDaTentativa,
    );
  }

  private concluirAGravacaoIncerta(lida: boolean, eTagDaTentativa: string | undefined): void {
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
  }

  /**
   * Mostra a recusa no campo, numa das ofertas ou, sem onde apontar, como recusa geral. As causas
   * gerais da API vão para a recusa geral, junto do que não tem campo na tela.
   */
  private exibirRecusa(falha: ApiFailure, ambigua: boolean): void {
    const { deCampo, gerais } = separarCausas(falha.problem.errors);
    const recusas = separarRecusas(deCampo);
    const dasOfertas = this.mostrarRecusasDasOfertas(recusas.daOferta, recusas.daSegunda);
    if (recusas.porCampo.length > 0) this.errosDoServidor.set(recusas.porCampo);
    const textoGeral = juntarTextos([dasOfertas.textoGeral, ...gerais.map((g) => g.message)]);
    if (textoGeral !== null) this.recusaGeral.set(recusaGeralComCausa(textoGeral, ambigua));
    const total = recusas.porCampo.length + dasOfertas.mostradas;
    if (total > 0 || textoGeral !== null)
      this.anuncio.definir(anuncioDaRecusa(total, textoGeral !== null, ambigua));
    else this.recusarSemOndeApontar(falha, ambigua);
  }

  private recusarSemOndeApontar(falha: ApiFailure, ambigua: boolean): void {
    if (ambigua) {
      this.recusaGeral.set({
        titulo: TITULO_DA_GRAVACAO_INCERTA,
        texto: ORIENTACAO_DA_GRAVACAO_INCERTA,
      });
      return;
    }
    const mensagem = this.problemas.resolve(falha.problem);
    this.recusaGeral.set({ titulo: TITULO_DA_RECUSA, texto: mensagem.detail ?? mensagem.title });
  }

  private mostrarRecusasDasOfertas(
    daOferta: string | null,
    daSegunda: RecusaDaSegundaOpcao | null,
  ): RecusasMostradas {
    if (daOferta === null && daSegunda === null) return { textoGeral: null, mostradas: 0 };
    return this.escolha.mostrarRecusas(daOferta, daSegunda);
  }
}

function juntarTextos(textos: readonly (string | null)[]): string | null {
  const presentes = textos.filter((texto) => texto !== null);
  return presentes.length === 0 ? null : presentes.join(' ');
}

/** Na falha ambígua a causa não diz se algo foi gravado: a orientação de gravação incerta acompanha-a. */
function recusaGeralComCausa(causa: string, ambigua: boolean): RecusaGeral {
  if (!ambigua) return { titulo: TITULO_DA_RECUSA, texto: causa };
  return {
    titulo: TITULO_DA_GRAVACAO_INCERTA,
    texto: juntarTextos([causa, ORIENTACAO_DA_GRAVACAO_INCERTA]) ?? ORIENTACAO_DA_GRAVACAO_INCERTA,
  };
}

/**
 * Com causa geral, o leitor de tela a ouve: na falha ambígua, o anúncio é o da gravação incerta; nas
 * demais, o das recusas de campo, quando há, seguido da indicação de ler a mensagem geral.
 */
function anuncioDaRecusa(total: number, comCausaGeral: boolean, ambigua: boolean): string {
  if (!comCausaGeral) return anuncioDasRecusasDeCampo(total);
  if (ambigua) return `${TITULO_DA_GRAVACAO_INCERTA}. Leia a mensagem de recusa e tente de novo.`;
  if (total === 0) return ANUNCIO_DA_RECUSA_GERAL;
  return `${anuncioDasRecusasDeCampo(total)} Leia também a mensagem de recusa.`;
}

function anuncioDasRecusasDeCampo(total: number): string {
  return total === 1
    ? 'Uma resposta foi recusada. Corrija e tente de novo.'
    : `${total} respostas foram recusadas. Corrija e tente de novo.`;
}
