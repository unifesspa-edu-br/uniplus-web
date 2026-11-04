import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import {
  SEM_FORMULARIO,
  comFinalidade,
  faltaOFormulario,
  formulariosEscolhiveis,
} from '../../../../shared/exigencias/formulario-da-exigencia';
import { ProcessoSeletivoStore } from '../../../../processo-seletivo.store';
import { ExigenciasDaFaseStore } from '../exigencias-da-fase.store';
import { FaseEmEdicao } from '../../fase-em-edicao';

/**
 * O formulário em cujo bloco de comprovação o candidato apresenta o documento. Na fase que divide
 * inscrição e isenção a escolha é do operador; o declarado que a fase deixou de responder não é
 * trocado: o campo aparece com o erro até o operador escolher.
 */
@Component({
  selector: 'sel-eixo-formulario',
  templateUrl: './eixo-formulario.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: ':host { display: block; }',
})
export class EixoFormularioComponent {
  protected readonly store = inject(ProcessoSeletivoStore);
  protected readonly exigencias = inject(ExigenciasDaFaseStore);
  private readonly faseEmEdicao = inject(FaseEmEdicao);

  readonly documentoId = input.required<string>();

  protected readonly idDaFase = this.faseEmEdicao.idDaFase;

  protected readonly formulariosEscolhiveis = computed(() =>
    formulariosEscolhiveis(this.exigencias.finalidadesDaFaseAberta()),
  );

  /**
   * O que falta para o documento ter formulário: a escolha na fase que divide inscrição e isenção,
   * ou outra escolha quando a fase deixou de responder o formulário declarado.
   */
  faltaFormulario(id: string): string | null {
    return faltaOFormulario(
      this.exigencias.exigenciaDoDocumento(id).finalidade,
      this.exigencias.finalidadesDaFaseAberta(),
    );
  }

  /**
   * Declara o formulário do documento nesta fase. Vale para a árvore de raiz inteira: as
   * alternativas de um grupo se satisfazem num formulário só.
   */
  escolherFinalidade(id: string, finalidade: string): void {
    const fase = this.faseEmEdicao.faseDoRascunho();
    if (fase === null) return;

    this.exigencias.editarDeclaracao(id, (exigencias) =>
      comFinalidade(
        exigencias,
        id,
        fase.codigo,
        finalidade === '' || finalidade === SEM_FORMULARIO ? null : finalidade,
      ),
    );
  }
}
