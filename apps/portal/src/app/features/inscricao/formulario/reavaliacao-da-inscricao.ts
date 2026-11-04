import { DOCUMENT } from '@angular/common';
import {
  DestroyRef,
  type Signal,
  Injectable,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type {
  FormularioDoCandidatoComponent,
  SimulacaoDoFormulario,
} from '@uniplus/shared-ui/components';

import { AcompanhamentoDaVerificacao } from './acompanhamento-da-verificacao';
import { AvaliacaoDaInscricaoEstado } from './avaliacao-da-inscricao.estado';
import { corpoDaAvaliacao } from './corpo-da-inscricao';
import { EscolhaDoCurso } from './escolha-do-curso';
import { GravacaoDaInscricao } from './gravacao-da-inscricao';
import { LeituraDaInscricao } from './leitura-da-inscricao';

/** O que a reavaliação lê do formulário: as respostas da tela e se algum arquivo espera a verificação. */
export type FormularioParaReavaliar = Pick<
  FormularioDoCandidatoComponent,
  'simulacao' | 'haArquivoEmVerificacao'
>;

/**
 * Quando a avaliação da tela precisa ser pedida de novo sem gravar: as respostas ou o curso mudaram, um
 * arquivo foi enviado ou removido, ou um arquivo espera a verificação. Provida pela página.
 */
@Injectable()
export class ReavaliacaoDaInscricao {
  private readonly leitura = inject(LeituraDaInscricao);
  private readonly escolha = inject(EscolhaDoCurso);
  private readonly gravacao = inject(GravacaoDaInscricao);
  private readonly avaliacao = inject(AvaliacaoDaInscricaoEstado);
  private readonly destroyRef = inject(DestroyRef);
  private readonly documento = inject(DOCUMENT);

  /** Enquanto um arquivo espera a verificação, a avaliação é pedida de novo até o resultado chegar. */
  private readonly verificacao = new AcompanhamentoDaVerificacao(() => this.consultarVerificacao());
  private readonly abaVisivel = signal(true);
  /** Quantas mudanças do envio a avaliação já levou em conta; o envio nasce sem nenhuma. */
  private mudancasVistas = 0;
  private formulario: Signal<FormularioParaReavaliar | undefined> | null = null;

  /**
   * Passa a acompanhar o formulário da tela. Tem de ser chamado na construção da página, onde o
   * formulário ainda não existe: ele só aparece quando a inscrição termina de carregar.
   */
  acompanhar(formulario: Signal<FormularioParaReavaliar | undefined>): void {
    this.formulario = formulario;
    const aoMudarAVisibilidade = (): void =>
      this.abaVisivel.set(this.documento.visibilityState !== 'hidden');
    this.documento.addEventListener('visibilitychange', aoMudarAVisibilidade);
    this.destroyRef.onDestroy(() => {
      this.documento.removeEventListener('visibilitychange', aoMudarAVisibilidade);
      this.verificacao.parar();
    });
    // Cada consulta que termina, com resultado ou com erro, agenda a seguinte enquanto houver arquivo em
    // verificação na fase do formulário. Com a aba oculta ninguém vê o resultado: espera a volta.
    effect(() => {
      this.avaliacao.respondidas();
      const aguardando = (formulario()?.haArquivoEmVerificacao() ?? false) && this.abaVisivel();
      untracked(() => this.verificacao.aoAvaliar(aguardando));
    });
    // Enviar ou remover um arquivo muda a situação dos documentos, que só a API calcula. O envio fica
    // fora do componente do passo, então a reavaliação vem dele, mesmo que a tela tenha mudado de passo.
    effect(() => {
      const mudancas = this.gravacao.envioDeDocumentos()?.mudancas() ?? 0;
      untracked(() => this.aoMudarOsDocumentos(mudancas));
    });
  }

  /**
   * As respostas mudaram. Só consulta se mudou uma de que a avaliação depende; o corpo é montado só
   * nesse caso.
   */
  respostasMudaram(simulacao: SimulacaoDoFormulario): void {
    const inscricao = this.leitura.inscricao();
    if (inscricao) {
      this.avaliacao.respostasMudaram(simulacao, () =>
        corpoDaAvaliacao(inscricao, simulacao, this.escolha.escolhidas()),
      );
    }
  }

  /** A oferta de alguma opção mudou na tela, sem gravar: a avaliação é pedida de novo com as novas. */
  ofertaMudou(): void {
    const inscricao = this.leitura.inscricao();
    const formulario = this.formulario?.();
    if (!inscricao || !formulario) return;
    const ofertas = this.escolha.escolhidas();
    // Lido do formulário na troca: a emissão das mudanças só chega no ciclo seguinte.
    this.avaliacao.ofertaMudou(ofertas.ofertaCursoId, ofertas.ofertaCursoSegundaOpcaoId, () =>
      corpoDaAvaliacao(inscricao, formulario.simulacao(), this.escolha.escolhidas()),
    );
  }

  private aoMudarOsDocumentos(mudancas: number): void {
    if (mudancas === this.mudancasVistas) return;
    this.mudancasVistas = mudancas;
    this.verificacao.recomecar();
    this.gravacao
      .relerARevisao()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.reavaliarDocumentos());
  }

  /**
   * A consulta da verificação não corre sobre uma gravação ou releitura em andamento: a avaliação da
   * gravação seria descartada pela revisão. Fica para a próxima espera.
   */
  private consultarVerificacao(): void {
    if (this.gravacao.bloqueada()) this.verificacao.aoAvaliar(true);
    else this.reavaliarDocumentos();
  }

  /** Os arquivos enviados mudaram: a avaliação é pedida de novo com as respostas que estão na tela. */
  private reavaliarDocumentos(): void {
    const inscricao = this.leitura.inscricao();
    const formulario = this.formulario?.();
    if (inscricao && formulario) {
      this.avaliacao.reavaliar(() =>
        corpoDaAvaliacao(inscricao, formulario.simulacao(), this.escolha.escolhidas()),
      );
    }
  }
}
