import { Injectable, Signal, computed, inject, signal } from '@angular/core';

import type { ReferenciaAoSuporte } from '@uniplus/shared-core/http';
import { PERMISSAO, PermissoesService } from '@uniplus/shared-auth/bootstrap';

import { ProcessoSeletivoStore } from '../wizard/processo-seletivo.store';
import type {
  ConfirmacaoDeGravacao,
  GravacaoDoPasso,
  PassoDoWizard,
} from '../wizard/passo-do-wizard';
import type {
  ErroDoPasso,
  ReferenciaDoPasso,
  ValidacaoDoPasso,
} from '../wizard/processo-seletivo.models';
import { ReleituraDoSnapshot } from '../wizard/shared/releitura-do-snapshot.service';
import { rotuloDoPassoNaTela } from '../wizard/shared/referencia-da-tela';
import { FocoDoEditor } from './foco-do-editor.service';
import { erroSemReferencia, falhaAoConcluir, mensagensDe } from './mensagens-do-passo';
import { publicar } from './publicacao-do-rascunho';

const COPIA_NAO_CONFIRMADA =
  'Os critérios de desempate não foram gravados: a classificação foi gravada, mas o quadro de Peso por Área que ela congelou não pôde ser confirmado por uma releitura do processo, e os critérios por área dependem dele. Tente de novo.';

/** A recusa à gravação dos critérios de desempate, com o passo onde eles se corrigem. */
export interface RecusaDoDesempate {
  readonly indice: number;
  readonly mensagens: string[];
  readonly referencia?: ReferenciaAoSuporte;
}

/**
 * Conduz o operador pelos passos: valida, pede a confirmação do resumo, grava e avança, e publica
 * no último. Os passos chegam da página por `conectar`, porque `viewChildren` só existe no componente.
 */
@Injectable()
export class ConducaoDoWizard {
  readonly store = inject(ProcessoSeletivoStore);
  private readonly releitura = inject(ReleituraDoSnapshot);
  private readonly foco = inject(FocoDoEditor);
  private readonly permissoes = inject(PermissoesService);

  /**
   * Resumo aguardando confirmação do operador. Enquanto não é `null`, nada foi enviado à API: é
   * esse o ponto do modal.
   */
  readonly confirmacaoPendente = signal<ConfirmacaoDeGravacao | null>(null);

  /**
   * Se o diálogo devolve o foco ao botão que o abriu. Só é desligado quando a confirmação levou a
   * um avanço de passo, porque aí a tela por trás mudou e o destino certo é o título do passo novo.
   */
  readonly restaurarFocoAoFechar = signal(true);

  /** Publicar e enviar o edital exigem a permissão de publicar, além da de configurar. */
  readonly podePublicar = computed(() => this.permissoes.tem(PERMISSAO.selecao.processosPublicar));

  private passos: Signal<readonly PassoDoWizard[]> = signal([]);

  conectar(passos: Signal<readonly PassoDoWizard[]>): void {
    this.passos = passos;
  }

  /** O componente do passo no índice, se estiver instanciado. */
  passoNo(index: number): PassoDoWizard | undefined {
    return this.passos()[index];
  }

  /** O passo que grava depois da classificação (hoje só o Desempate), ou `-1`. */
  indiceDoPassoPosClassificacao(): number {
    return this.passos().findIndex((passo) => passo.gravarAposAClassificacao !== undefined);
  }

  reler(): Promise<boolean> {
    return this.releitura.reler();
  }

  pedirConfirmacao(confirmacao: ConfirmacaoDeGravacao): void {
    this.restaurarFocoAoFechar.set(true);
    this.confirmacaoPendente.set(confirmacao);
  }

  /** Traz o aviso de pendências para a vista; o passo em tela sabe abrir a seção que guarda o campo recusado. */
  revelarErro(): void {
    this.foco.revelarErro(() => this.passoNo(this.store.passoAtual()));
  }

  /**
   * Single-flight: o passo 2 grava na API, e um duplo clique criaria dois processos com chaves de
   * idempotência diferentes. `operacaoEmAndamento()` cobre também o intervalo de `publicar()` entre
   * um passo terminar e o próximo começar, em que `salvando()` fica `false` por um instante.
   *
   * Consultar um processo publicado é livre; escrever nele o servidor recusaria, depois de o
   * operador ter preenchido a tela inteira.
   */
  async avancar(): Promise<void> {
    if (this.store.operacaoEmAndamento()) return;
    if (!this.store.edicaoPermitida()) {
      this.store.next();
      return;
    }
    if (this.store.isLast()) {
      if (this.podePublicar()) await publicar(this);
      return;
    }
    await this.conferirEGravar(this.passoNo(this.store.passoAtual()));
  }

  /**
   * A confirmação vem antes de qualquer requisição, quando o operador ainda pode desistir: depois
   * de gravado, o cadastro inicial não volta atrás pelo contrato desta tela.
   */
  private async conferirEGravar(passoEmTela: PassoDoWizard | undefined): Promise<void> {
    if (!this.passoConferido(passoEmTela)) return;
    const confirmacao = passoEmTela?.confirmacaoDeGravacao?.();
    if (confirmacao) {
      this.pedirConfirmacao(confirmacao);
      return;
    }
    await this.gravarEAvancar(passoEmTela);
  }

  /**
   * Confere o passo em tela; recusado, mostra as pendências e traz o aviso para a vista. Aprovado,
   * limpa o resumo, que descreveria erros que já não existem; uma recusa da gravação o preenche de novo.
   */
  private passoConferido(passoEmTela: PassoDoWizard | undefined): boolean {
    const result = passoEmTela?.validar();
    if (result && !result.valid) {
      this.store.definirErroDoPasso(erroSemReferencia(mensagensDe(result)));
      this.revelarErro();
      return false;
    }
    this.store.definirErroDoPasso(null);
    return true;
  }

  /**
   * Confirma o resumo e grava. O passo de destino não pode ter mudado, porque o resumo é
   * descartado a cada troca de passo para confirmar significar sempre o que o operador leu.
   *
   * O diálogo continua aberto enquanto a requisição corre. Fechá-lo no clique devolveria o foco ao
   * botão de avanço que `persistir()` acaba de desabilitar, e o teclado ficaria sem ponto de
   * partida por toda a espera.
   */
  async confirmarGravacao(): Promise<void> {
    if (this.confirmacaoPendente() === null || this.store.salvando()) return;
    try {
      await this.gravarConfirmada();
    } finally {
      this.confirmacaoPendente.set(null);
    }
  }

  /**
   * Avançar troca o passo por baixo do diálogo; devolver o foco ao botão que o abriu levaria a um
   * rodapé que já não descreve o que está em tela. Falhando, a tela é a mesma e a restauração
   * continua correta.
   *
   * `store.next()` não avança a partir do último passo, então o efeito de troca de passo não
   * dispara depois de publicar: sem o foco na confirmação da publicação, fechar o diálogo a deixa
   * sem lugar nenhum.
   */
  private async gravarConfirmada(): Promise<void> {
    const passo = this.passoNo(this.store.passoAtual());
    const sucesso = await this.gravarEAvancar(passo, { confirmadaPeloOperador: true });
    this.restaurarFocoAoFechar.set(!sucesso);
    if (sucesso && this.store.isLast()) this.foco.focarConfirmacaoDePublicacao();
  }

  /**
   * Desiste da gravação, sem nada enviado e sem mudar o rascunho. Com a gravação em curso o
   * comando já saiu, e fechar só tiraria da tela o aviso de que ela está acontecendo.
   */
  cancelarGravacao(): void {
    if (this.store.salvando()) return;
    this.confirmacaoPendente.set(null);
  }

  /**
   * Conclui o passo depois de a confirmação já ter sido resolvida, seja porque o passo não pedia
   * nenhuma, seja porque o operador confirmou.
   */
  async gravarEAvancar(
    passoEmTela: PassoDoWizard | undefined,
    gravacao: GravacaoDoPasso = { confirmadaPeloOperador: false },
  ): Promise<boolean> {
    if (passoEmTela?.persistir && !(await this.persistirPasso(passoEmTela, gravacao))) return false;
    this.store.definirErroDoPasso(null);
    this.store.next();
    return true;
  }

  /** Passos que persistem expõem `persistir()`; os demais seguem direto. */
  private async persistirPasso(
    passoEmTela: PassoDoWizard | undefined,
    gravacao: GravacaoDoPasso,
  ): Promise<boolean> {
    if (!passoEmTela?.persistir) return true;
    const resultadoDaGravacao = await passoEmTela.persistir(gravacao).catch(falhaAoConcluir);
    if (resultadoDaGravacao.valid) return this.desempateGravado();
    this.mostrarRecusaDoPasso(resultadoDaGravacao);
    return false;
  }

  /**
   * Lista de mensagens vazia é descarte deliberado: o resultado pertence a um editor que já não
   * está em tela, e anunciá-lo colocaria erro num rascunho que ninguém tentou gravar.
   */
  private mostrarRecusaDoPasso(resultadoDaGravacao: ValidacaoDoPasso): void {
    if (resultadoDaGravacao.messages?.length === 0) return;
    const indice = this.store.passoAtual();
    const { referenciaAoSuporte } = resultadoDaGravacao;
    this.store.definirErroDoPasso(
      this.erroDoPassoNo(indice, mensagensDe(resultadoDaGravacao), referenciaAoSuporte),
    );
    this.revelarErro();
  }

  /** A classificação ficou gravada; a recusa é dos critérios, e é no passo deles que se corrige. */
  private async desempateGravado(): Promise<boolean> {
    const recusa = await this.gravarDesempatePendente();
    if (recusa === null) return true;
    if (recusa.mensagens.length > 0) {
      this.store.goTo(recusa.indice);
      this.store.definirErroDoPasso(
        this.erroDoPassoNo(recusa.indice, recusa.mensagens, recusa.referencia),
      );
      this.revelarErro();
    }
    return false;
  }

  /**
   * Os critérios de desempate que ficaram para depois da classificação são gravados assim que ela
   * congela o quadro: primeiro a classificação, depois os critérios, que o servidor confere contra
   * o quadro. A cópia que a gravação presumiu é confirmada antes, porque a varredura da publicação
   * não relê a cada passo e o Desempate só julga as áreas contra uma cópia confirmada. `null`
   * quando não havia o que gravar ou deu certo.
   *
   * Classificação ainda sem quadro gravado não grava nada: é o passo dela que vem antes.
   */
  async gravarDesempatePendente(): Promise<RecusaDoDesempate | null> {
    const indice = this.indiceDoPassoPosClassificacao();
    const desempate = this.passos()[indice];
    const pendente = this.store.classificacao.desempatePendenteDeGravacao();
    if (!pendente || desempate?.gravarAposAClassificacao === undefined) return null;
    if (await this.relidaPorOutraTroca()) return { indice, mensagens: [] };
    if (this.classificacaoSemQuadroGravado()) return null;
    if (this.store.classificacao.copiaCongeladaEmVigor() === null) {
      return { indice, mensagens: [COPIA_NAO_CONFIRMADA] };
    }

    const resultado = await desempate.gravarAposAClassificacao().catch(falhaAoConcluir);
    return resultado.valid ? null : this.recusaDosCriterios(indice, resultado);
  }

  /** Lista de mensagens vazia é descarte deliberado, como na recusa de qualquer passo. */
  private recusaDosCriterios(indice: number, resultado: ValidacaoDoPasso): RecusaDoDesempate {
    const descartada = resultado.messages?.length === 0;
    if (descartada) return { indice, mensagens: [] };
    return { indice, mensagens: mensagensDe(resultado), referencia: resultado.referenciaAoSuporte };
  }

  private classificacaoSemQuadroGravado(): boolean {
    const { estado } = this.store.classificacao.gravada();
    return estado === 'nunca-gravada' || estado === 'sem-quadro';
  }

  /** Relê o processo quando a classificação pede; `true` se a tela passou a outro processo durante a leitura. */
  private async relidaPorOutraTroca(): Promise<boolean> {
    if (this.store.classificacao.motivoDaReleitura() === null) return false;
    const geracao = this.store.geracao();
    await this.releitura.reler();
    return geracao !== this.store.geracao();
  }

  /**
   * Roda `validar()` dos passos de `0` até `ateIndice` (exclusive; todos por padrão), reconcilia o
   * progresso exibido nesse intervalo e devolve uma mensagem por pendência, identificada pelo
   * passo de origem. Todos os passos ficam montados (`[hidden]`), então todos respondem.
   *
   * `ateIndice` existe para a publicação chamar em duas passadas: a primeira sem a Revisão, cujo
   * `validar()` depende de um checklist que só fica correto depois de gravar as correções e
   * recarregá-lo. Passos fora do intervalo mantêm o progresso que já tinham.
   */
  validarRascunho(ateIndice = this.store.totalDePassos): string[] {
    const concluidos = new Set<number>(this.store.passosConcluidos());
    const pendencias: string[] = [];
    for (let index = 0; index < ateIndice; index += 1) {
      const pendencia = this.pendenciaDoPassoNo(index);
      if (pendencia === null) {
        concluidos.add(index);
      } else {
        pendencias.push(pendencia);
        concluidos.delete(index);
      }
    }
    this.store.syncCompleted(concluidos);
    return pendencias;
  }

  private pendenciaDoPassoNo(index: number): string | null {
    const resultado = this.passoNo(index)?.validar();
    if (!resultado || resultado.valid) return null;
    return this.pendenciaDoPasso(index, mensagensDe(resultado));
  }

  /** "Passo 3 — Vagas", como a tela nomeia o passo a quem cadastra e ao suporte. */
  rotuloDoPasso(index: number): string {
    return rotuloDoPassoNaTela(this.store.labels[index]);
  }

  /** "Passo 3 — Vagas: …", a mensagem de pendência identificada pelo passo de origem. */
  pendenciaDoPasso(index: number, mensagens: readonly string[]): string {
    return `${this.rotuloDoPasso(index)}: ${mensagens.join(' ')}`;
  }

  /** A referência do passo, quando a recusa veio do servidor; lista vazia quando não há. */
  referenciasDoPasso(index: number, referencia?: ReferenciaAoSuporte): ReferenciaDoPasso[] {
    return referencia === undefined ? [] : [{ passo: this.rotuloDoPasso(index), referencia }];
  }

  private erroDoPassoNo(
    index: number,
    mensagens: readonly string[],
    referencia?: ReferenciaAoSuporte,
  ): ErroDoPasso {
    return { mensagens, referencias: this.referenciasDoPasso(index, referencia) };
  }
}
