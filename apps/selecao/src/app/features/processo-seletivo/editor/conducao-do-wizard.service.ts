import { Injectable, Signal, computed, inject, signal } from '@angular/core';

import { PERMISSAO, PermissoesService } from '@uniplus/shared-auth/bootstrap';

import { ProcessoSeletivoStore } from '../steps/processo-seletivo.store';
import type {
  ConfirmacaoDeGravacao,
  GravacaoDoPasso,
  PassoDoWizard,
} from '../steps/passo-do-wizard';
import { ReleituraDoSnapshot } from '../steps/shared/releitura-do-snapshot.service';
import { FocoDoEditor } from './foco-do-editor.service';
import { falhaAoConcluir, mensagensDe } from './mensagens-do-passo';
import { publicar } from './publicacao-do-rascunho';
import { RascunhoDaPublicacao } from './rascunho-da-publicacao.service';

const COPIA_NAO_CONFIRMADA =
  'Os critérios de desempate não foram gravados: a classificação foi gravada, mas o quadro de Peso por Área que ela congelou não pôde ser confirmado por uma releitura do processo, e os critérios por área dependem dele. Tente de novo.';

/** A recusa à gravação dos critérios de desempate, com o passo onde eles se corrigem. */
export interface RecusaDoDesempate {
  readonly indice: number;
  readonly mensagens: string[];
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
  private readonly rascunho = inject(RascunhoDaPublicacao);
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

  /** Publicar, gravar o rascunho da publicação e enviar o edital exigem a permissão de publicar, além da de configurar. */
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

  async avancar(): Promise<void> {
    // Single-flight: o passo 2 grava na API, e um duplo clique criaria dois processos com chaves
    // de idempotência diferentes. `operacaoEmAndamento()` cobre também a janela de `publicar()`
    // entre um passo terminar e o próximo começar, em que `salvando()` fica `false` por um instante.
    if (this.store.operacaoEmAndamento()) return;

    // Consultar um processo publicado é livre; escrever nele o servidor recusaria, depois de o
    // operador ter preenchido a tela inteira.
    if (!this.store.edicaoPermitida()) {
      this.store.next();
      return;
    }

    if (this.store.isLast()) {
      if (this.podePublicar()) await publicar(this);
      return;
    }

    const validator = this.passoNo(this.store.passoAtual());
    const result = validator?.validar();

    if (result && !result.valid) {
      this.store.definirErroDoPasso(mensagensDe(result));
      this.revelarErro();
      return;
    }

    // O passo acabou de passar na conferência: o resumo que ainda estiver na tela descreve erros
    // que já não existem. Uma recusa da gravação volta a preenchê-lo.
    this.store.definirErroDoPasso(null);

    // A confirmação vem antes de qualquer requisição, quando o operador ainda pode desistir:
    // depois de gravado, o cadastro inicial não volta atrás pelo contrato desta tela.
    const confirmacao = validator?.confirmacaoDeGravacao?.();
    if (confirmacao) {
      this.pedirConfirmacao(confirmacao);
      return;
    }

    await this.gravarEAvancar(validator);
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
      // Avançar troca o passo por baixo do diálogo; devolver o foco ao botão que o abriu levaria a
      // um rodapé que já não descreve o que está em tela. Falhando, a tela é a mesma e a
      // restauração continua correta.
      const sucesso = await this.gravarEAvancar(this.passoNo(this.store.passoAtual()), {
        confirmadaPeloOperador: true,
      });
      this.restaurarFocoAoFechar.set(!sucesso);

      // `store.next()` não avança a partir do último passo, então o efeito de troca de passo não
      // dispara depois de publicar: sem este destino, fechar o diálogo da publicação deixa o foco
      // sem lugar nenhum.
      if (sucesso && this.store.isLast()) {
        // O ato foi registrado e o servidor já apagou o rascunho. O que sobra em tela é a
        // declaração publicada, e zerá-la faria a guarda de saída barrar quem acabou de publicar.
        this.rascunho.fixarComoJaGravado();
        this.foco.focarConfirmacaoDePublicacao();
      }
    } finally {
      this.confirmacaoPendente.set(null);
    }
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
    validator: PassoDoWizard | undefined,
    gravacao: GravacaoDoPasso = { confirmadaPeloOperador: false },
  ): Promise<boolean> {
    // Passos que persistem expõem `persistir()`; os demais avançam direto.
    if (validator?.persistir) {
      const commit = await validator.persistir(gravacao).catch(falhaAoConcluir);
      if (!commit.valid) {
        // Lista de mensagens vazia é descarte deliberado: o resultado pertence a um editor que já
        // não está em tela, e anunciá-lo colocaria erro num rascunho que ninguém tentou gravar.
        if (commit.messages?.length !== 0) {
          this.store.definirErroDoPasso(mensagensDe(commit));
          this.revelarErro();
        }
        return false;
      }

      const recusaDoDesempate = await this.gravarDesempatePendente();
      if (recusaDoDesempate !== null) {
        // A classificação ficou gravada; a recusa é dos critérios, e é no passo deles que se corrige.
        if (recusaDoDesempate.mensagens.length > 0) {
          this.store.goTo(recusaDoDesempate.indice);
          this.store.definirErroDoPasso(recusaDoDesempate.mensagens);
          this.revelarErro();
        }
        return false;
      }
    }

    this.store.definirErroDoPasso(null);
    this.store.next();
    return true;
  }

  /**
   * Os critérios de desempate que ficaram para depois da classificação são gravados assim que ela
   * congela o quadro: primeiro a classificação, depois os critérios, que o servidor confere contra
   * o quadro. A cópia que a gravação presumiu é confirmada antes, porque a varredura da publicação
   * não relê a cada passo e o Desempate só julga as áreas contra uma cópia confirmada. `null`
   * quando não havia o que gravar ou deu certo.
   */
  async gravarDesempatePendente(): Promise<RecusaDoDesempate | null> {
    if (!this.store.classificacao.desempatePendenteDeGravacao()) return null;
    const indice = this.indiceDoPassoPosClassificacao();
    const desempate = this.passos()[indice];
    if (desempate?.gravarAposAClassificacao === undefined) return null;

    if (this.store.classificacao.motivoDaReleitura() !== null) {
      const geracao = this.store.geracao();
      await this.releitura.reler();
      if (geracao !== this.store.geracao()) return { indice, mensagens: [] };
    }
    const gravada = this.store.classificacao.gravada().estado;
    // Ainda sem a classificação gravada com quadro: é o passo dela que vem antes.
    if (gravada === 'nunca-gravada' || gravada === 'sem-quadro') return null;
    if (this.store.classificacao.copiaCongeladaEmVigor() === null) {
      return { indice, mensagens: [COPIA_NAO_CONFIRMADA] };
    }

    const commit = await desempate.gravarAposAClassificacao().catch(falhaAoConcluir);
    if (commit.valid) return null;
    return { indice, mensagens: commit.messages?.length === 0 ? [] : mensagensDe(commit) };
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
    const pendencias: string[] = [];
    const concluidos = new Set<number>(this.store.passosConcluidos());

    for (let index = 0; index < ateIndice; index += 1) {
      const resultado = this.passoNo(index)?.validar();

      if (resultado && !resultado.valid) {
        pendencias.push(this.pendenciaDoPasso(index, mensagensDe(resultado)));
        concluidos.delete(index);
        continue;
      }

      concluidos.add(index);
    }

    this.store.syncCompleted(concluidos);
    return pendencias;
  }

  /** "Passo 3 — Vagas: …", a mensagem de pendência identificada pelo passo de origem. */
  pendenciaDoPasso(index: number, mensagens: readonly string[]): string {
    return `Passo ${index + 1} — ${this.store.labels[index]}: ${mensagens.join(' ')}`;
  }
}
