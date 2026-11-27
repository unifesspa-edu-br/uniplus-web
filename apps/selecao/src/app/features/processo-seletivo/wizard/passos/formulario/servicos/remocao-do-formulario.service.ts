import { effect, computed, inject, Injectable, signal, untracked } from '@angular/core';
import { isApiOk, ProblemI18nService } from '@uniplus/shared-core/http';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { CadastroInicial } from '../../../shared/cadastro-inicial.service';
import { semFormulario } from '../formularios-do-rascunho';
import { LeituraDoProcessoNoFormulario } from './leitura-do-processo-no-formulario.service';
import { semChave } from './sem-chave';
import { textoDaRecusa } from './texto-da-recusa';

/** O que a remoção confirmada deixou: o código tratado, e a recusa quando o formulário ficou. */
export interface DesfechoDaRemocao {
  readonly codigo: string;
  readonly recusa: string | null;
}

/**
 * A remoção de um formulário: a confirmação pendente, a remoção no servidor
 * — que não espera a gravação do passo — e a recusa, que fica em texto na aba que não saiu.
 */
@Injectable()
export class RemocaoDoFormulario {
  private readonly store = inject(ProcessoSeletivoStore);
  private readonly cadastro = inject(CadastroInicial);
  private readonly leitura = inject(LeituraDoProcessoNoFormulario);
  private readonly problemI18n = inject(ProblemI18nService);

  /** O código do formulário cuja remoção aguarda confirmação. */
  readonly pendente = signal<string | null>(null);
  /** A recusa da remoção, por código: fica na aba do formulário que não saiu. */
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
    const codigo = this.pendente();
    return codigo === null
      ? ''
      : `O formulário ${codigo} sai do processo com as páginas, os campos e os termos dele. Não há como desfazer.`;
  });

  pedir(codigo: string): void {
    this.pendente.set(codigo);
  }

  cancelar(): void {
    this.pendente.set(null);
  }

  /**
   * Remove o formulário confirmado. O que já está no servidor sai pela API na hora, e o que só
   * existe no rascunho sai dele. `null` quando não há o que decidir, ou o processo mudou no meio.
   */
  async confirmar(): Promise<DesfechoDaRemocao | null> {
    const codigo = this.pendente();
    this.pendente.set(null);
    if (codigo === null) return null;
    this.recusas.update((atuais) => semChave(atuais, codigo));

    const processoId = this.store.processoSeletivoId();
    if (processoId !== null) {
      const resultado = await this.confirmarRemocaoNoServidor(processoId, codigo);
      if (resultado !== undefined) return resultado;
    }
    this.removerDoRascunho(codigo);
    return { codigo, recusa: null };
  }

  private async confirmarRemocaoNoServidor(
    processoId: string,
    codigo: string,
  ): Promise<DesfechoDaRemocao | null | undefined> {
    const geracao = this.store.geracao();
    const recusa = await this.removerComEdicaoBloqueada(processoId, codigo, geracao);
    if (geracao !== this.store.geracao()) return null;
    if (recusa === null) return undefined;
    this.recusas.update((atuais) => new Map([...atuais, [codigo, recusa]]));
    return { codigo, recusa };
  }

  private async removerComEdicaoBloqueada(
    processoId: string,
    codigo: string,
    geracao: number,
  ): Promise<string | null> {
    this.store.salvando.set(true);
    try {
      return await this.removerDoServidor(processoId, codigo);
    } finally {
      if (geracao === this.store.geracao()) this.store.salvando.set(false);
    }
  }

  private removerDoRascunho(codigo: string): void {
    this.store.patchSection('formulario', semFormulario(this.store.draft().formulario, codigo));
  }

  /**
   * Tira o formulário do servidor, quando ele está lá. Devolve a recusa a mostrar, ou nulo quando
   * o formulário não está mais no processo — inclusive o que nunca foi gravado.
   */
  private async removerDoServidor(processoId: string, codigo: string): Promise<string | null> {
    const detalhe = await this.leitura.ler(processoId);
    if (!isApiOk(detalhe))
      return 'Não foi possível reler o processo para remover o formulário. Tente de novo.';
    if (!detalhe.data.formularios.some((formulario) => formulario.codigo === codigo)) return null;

    const remocao = await this.cadastro.removerFormulario(processoId, codigo);
    if (remocao.ok) {
      this.retirarFormularioDaLeitura(codigo);
      return null;
    }
    return textoDaRecusa(remocao.problem, this.problemI18n);
  }

  private retirarFormularioDaLeitura(codigo: string): void {
    this.leitura.processoLido.update((lido) =>
      lido === null
        ? lido
        : {
            ...lido,
            formularios: lido.formularios.filter((f) => f.codigo !== codigo),
          },
    );
  }
}
