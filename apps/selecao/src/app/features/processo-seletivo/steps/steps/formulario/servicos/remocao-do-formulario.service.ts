import { effect, computed, inject, Injectable, signal, untracked } from '@angular/core';
import { isApiOk, ProblemI18nService } from '@uniplus/shared-core/http';
import { FINALIDADE_INSCRICAO } from '@uniplus/shared-ui/components';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { CadastroInicialService } from '../../../shared/cadastro-inicial.service';
import { formularioDaFinalidade } from '../formulario-do-processo';
import { nomeDaFinalidade } from '../formularios-por-finalidade';
import { LeituraDoProcessoNoFormulario } from './leitura-do-processo-no-formulario.service';
import { semChave } from './sem-chave';
import { textoDaRecusa } from './texto-da-recusa';

/** O que a remoção confirmada deixou: a finalidade tratada, e a recusa quando o formulário ficou. */
export interface DesfechoDaRemocao {
  readonly finalidade: string;
  readonly recusa: string | null;
}

/**
 * A remoção de um formulário que não é a inscrição: a confirmação pendente, a remoção no servidor
 * — que não espera a gravação do passo — e a recusa, que fica em texto na aba que não saiu.
 */
@Injectable()
export class RemocaoDoFormulario {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly cadastro = inject(CadastroInicialService);
  private readonly leitura = inject(LeituraDoProcessoNoFormulario);
  private readonly problemI18n = inject(ProblemI18nService);

  /** A finalidade cuja remoção aguarda confirmação. */
  readonly pendente = signal<string | null>(null);
  /** A recusa da remoção, por finalidade: fica na aba do formulário que não saiu. */
  readonly recusas = signal<ReadonlyMap<string, string>>(new Map());

  constructor() {
    // O que o passo guarda de um processo não pode valer para o seguinte.
    effect(() => {
      this.store.geracao();
      untracked(() => {
        this.pendente.set(null);
        this.recusas.set(new Map());
      });
    });
  }

  readonly aviso = computed(() => {
    const finalidade = this.pendente();
    return finalidade === null
      ? ''
      : `O formulário de ${nomeDaFinalidade(finalidade)} sai do processo com as etapas, os campos e os termos dele. Não há como desfazer.`;
  });

  pedir(finalidade: string): void {
    if (finalidade === FINALIDADE_INSCRICAO) return;
    this.pendente.set(finalidade);
  }

  cancelar(): void {
    this.pendente.set(null);
  }

  /**
   * Remove o formulário confirmado. O que já está no servidor sai pela API na hora, e o que só
   * existe no rascunho sai dele. `null` quando não há o que decidir, ou o processo mudou no meio.
   */
  async confirmar(): Promise<DesfechoDaRemocao | null> {
    const finalidade = this.pendente();
    this.pendente.set(null);
    if (finalidade === null || finalidade === FINALIDADE_INSCRICAO) return null;
    this.recusas.update((atuais) => semChave(atuais, finalidade));

    const processoId = this.store.processoSeletivoId();
    if (processoId !== null) {
      const geracao = this.store.geracao();
      // Trava avançar, gravar e editar: um PUT da aba chegando depois do DELETE recriaria o formulário.
      this.store.salvando.set(true);
      let recusa: string | null;
      try {
        recusa = await this.removerDoServidor(processoId, finalidade);
      } finally {
        if (geracao === this.store.geracao()) this.store.salvando.set(false);
      }
      if (geracao !== this.store.geracao()) return null;
      if (recusa !== null) {
        this.recusas.update((atuais) => new Map([...atuais, [finalidade, recusa]]));
        return { finalidade, recusa };
      }
    }

    const formulario = this.store.draft().formulario;
    this.store.patchSection('formulario', {
      ...formulario,
      outrasFinalidades: formulario.outrasFinalidades.filter(
        (outro) => outro.finalidade !== finalidade,
      ),
    });
    return { finalidade, recusa: null };
  }

  /**
   * Tira o formulário do servidor, quando ele está lá. Devolve a recusa a mostrar, ou nulo quando
   * o formulário não está mais no processo — inclusive o que nunca foi gravado.
   */
  private async removerDoServidor(processoId: string, finalidade: string): Promise<string | null> {
    const detalhe = await this.leitura.ler(processoId);
    if (!isApiOk(detalhe))
      return 'Não foi possível reler o processo para remover o formulário. Tente de novo.';
    if (formularioDaFinalidade(detalhe.data.formularios, finalidade) === null) return null;

    const remocao = await this.cadastro.removerFormulario(processoId, finalidade);
    if (remocao.ok) {
      // A leitura guardada é de antes do DELETE: sem o formulário removido, ela volta a ser o gravado.
      this.leitura.processoLido.update((lido) =>
        lido === null
          ? lido
          : { ...lido, formularios: lido.formularios.filter((f) => f.finalidade !== finalidade) },
      );
      return null;
    }
    return textoDaRecusa(remocao.problem, this.problemI18n);
  }
}
