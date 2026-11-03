import { effect, inject, Injectable, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { isApiOk } from '@uniplus/shared-core/http';
import { ProcessosSeletivosApi } from '@uniplus/shared-data/selecao';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { etapasDe } from '../../../shared/hidratacao';

/**
 * O que a tela responde enquanto as etapas gravadas estão sem os identificadores
 * que o servidor atribuiu. Serve à conferência do passo e à recusa da gravação,
 * que é o mesmo impedimento dito uma vez só.
 */
export const AGUARDA_RELEITURA =
  'As etapas foram gravadas, mas a tela ainda não recolheu os identificadores que o servidor atribuiu. Releia as etapas antes de gravar de novo: sem eles, a gravação seguinte recriaria as etapas e desfaria as referências de desempate e eliminação.';

/** As etapas gravadas à espera dos identificadores que o servidor atribuiu, e a releitura que os recolhe. */
@Injectable()
export class ReconciliacaoDasEtapas {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly api = inject(ProcessosSeletivosApi);

  /**
   * As etapas existem no servidor, mas o rascunho ficou sem os identificadores
   * que ele atribuiu — a releitura que os recolheria não respondeu.
   *
   * Enquanto durar, a tela não grava: a gravação seguinte omitiria o `id` de
   * etapas que já existem, e o servidor criaria outras no lugar, deixando o
   * critério de desempate e a regra de eliminação apontando para as que
   * deixaram de existir. Instruir a reabrir o processo descreve a saída, mas não
   * fecha a porta — quem fecha é a recusa, e o bloqueio é a face visível dela.
   */
  readonly reconciliacaoPendente = signal(false);

  /** Releitura em voo: o botão que a dispara não aceita um segundo clique. */
  readonly relendo = signal(false);

  /** Por que a última tentativa de releitura não destravou a tela. */
  readonly erroDeReleitura = signal<string | null>(null);

  constructor() {
    // Outro processo entra em cena — por troca de rota ou por recomeço — e o
    // que travou a tela era de um cadastro que não está mais aqui. Sem isto o
    // bloqueio atravessaria a fronteira e recusaria a gravação de um processo
    // que nunca teve etapa nenhuma pendente.
    effect(() => {
      this.store.geracao();
      untracked(() => {
        this.reconciliacaoPendente.set(false);
        this.erroDeReleitura.set(null);
      });
    });
  }

  /**
   * Recolhe os `id` que o servidor atribuiu às etapas novas. Devolve se
   * conseguiu.
   *
   * A gravação de etapas responde 204 sem corpo, e é o servidor quem atribui o
   * identificador. Sem reler, o rascunho segue com `id: null` e a gravação
   * seguinte omitiria o identificador de uma etapa que já existe — o servidor
   * criaria outra no lugar, e o critério de desempate e a regra de eliminação
   * que a referenciam ficariam apontando para a que deixou de existir.
   *
   * Projeta **só as etapas**, e não o processo inteiro: a navegação do wizard é
   * livre, e hidratar tudo aqui substituiria as seções de passos que o operador
   * editou sem ter gravado ainda — o trabalho sumiria sem aviso, por causa de
   * uma gravação que nem era daquele passo.
   */
  async reconciliarEtapas(processoId: string): Promise<boolean> {
    const geracao = this.store.geracao();
    const detalhe = await firstValueFrom(this.api.obter(processoId));
    if (!isApiOk(detalhe)) return false;

    // A leitura estava em voo e outro processo entrou no lugar: projetar agora
    // escreveria as etapas de um cadastro sobre o rascunho de outro. Quem
    // chamou confere a mesma geração e descarta o resultado.
    if (geracao !== this.store.geracao()) return false;

    this.store.projetarSecao('cronograma', { etapas: etapasDe(detalhe.data) });
    return true;
  }

  /**
   * Refaz a releitura que travou a tela.
   *
   * É a saída no próprio passo. Recarregar o processo resolve igual, mas custa
   * ao operador sair de onde está — e a tela já sabe exatamente o que faltou.
   */
  async relerEtapas(): Promise<void> {
    const processoId = this.store.processoSeletivoId();
    if (processoId === null || this.relendo()) return;

    const geracao = this.store.geracao();
    this.relendo.set(true);
    this.erroDeReleitura.set(null);
    try {
      const reconciliada = await this.reconciliarEtapas(processoId);
      // Outro processo assumiu a tela enquanto a leitura vinha: o bloqueio que
      // existia era do anterior, e quem o desfaz é a troca, não esta resposta.
      if (geracao !== this.store.geracao()) return;

      if (reconciliada) {
        this.reconciliacaoPendente.set(false);
        return;
      }

      this.erroDeReleitura.set(
        'Não foi possível reler as etapas agora. Tente de novo em instantes; se continuar assim, recarregue o processo.',
      );
    } finally {
      this.relendo.set(false);
    }
  }
}
