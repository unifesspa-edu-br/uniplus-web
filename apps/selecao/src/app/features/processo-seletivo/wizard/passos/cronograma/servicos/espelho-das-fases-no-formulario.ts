import type { FormArray, FormGroup } from '@angular/forms';

import type { FaseDoCronograma } from '../../../processo-seletivo.models';
import { grupoDaFase, type FaseForm } from '../cronograma-form';

/**
 * Leva as fases do rascunho ao formulário. As mesmas fases, na mesma ordem, só com outro
 * conteúdo — o que acontece quando a configuração embutida na fase grava no rascunho — atualizam
 * os grupos que a tela já mostra: trocá-los recriaria a fase inteira e tiraria o foco do
 * controle que acabou de ser acionado. Qualquer outra diferença recria o conjunto.
 */
export function espelharFasesNoFormulario(
  formulario: FormArray<FormGroup<FaseForm>>,
  fases: readonly FaseDoCronograma[],
): void {
  if (mesmasFasesNaMesmaOrdem(formulario, fases)) {
    for (const [posicao, fase] of fases.entries()) {
      formulario.at(posicao).setValue(grupoDaFase(fase).getRawValue(), { emitEvent: false });
    }
    return;
  }

  formulario.clear({ emitEvent: false });
  for (const fase of fases) formulario.push(grupoDaFase(fase), { emitEvent: false });
}

function mesmasFasesNaMesmaOrdem(
  formulario: FormArray<FormGroup<FaseForm>>,
  fases: readonly FaseDoCronograma[],
): boolean {
  return (
    formulario.length === fases.length &&
    fases.every(
      (fase, posicao) =>
        formulario.at(posicao).controls.faseCanonicaId.value === fase.faseCanonicaId,
    )
  );
}
