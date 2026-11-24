import { OrigemCandidatosCodigo } from '@uniplus/shared-data/selecao';

import type { FormularioDeInscricao, WizardDraft } from '../../processo-seletivo.models';

/** Um fato que pode decidir quem recebe o acréscimo, como o seletor o mostra. */
export interface FatoDeElegibilidade {
  readonly codigo: string;
  readonly rotulo: string;
  readonly origem: 'campo' | 'derivado';
}

/**
 * O processo cita o fato de elegibilidade quando aplica o acréscimo e o candidato se inscreve
 * nele (ADR-0142). O processo que só importa o resultado não tem o que citar.
 */
export function citaFatoDeElegibilidade(draft: WizardDraft): boolean {
  return (
    draft.bonus.aplica === true &&
    draft.identificacao.origemCandidatos === OrigemCandidatosCodigo.INSCRICAO_PROPRIA
  );
}

/**
 * Os fatos que o motor consegue resolver para todo candidato: os campos de sim ou não do
 * formulário de inscrição, fora de grupo, e os fatos que o processo deriva como sim ou não.
 */
export function fatosDeElegibilidade(
  formulario: FormularioDeInscricao,
): readonly FatoDeElegibilidade[] {
  return [...camposBooleanos(formulario), ...derivadosBooleanos(formulario)];
}

function camposBooleanos(formulario: FormularioDeInscricao): readonly FatoDeElegibilidade[] {
  return (formulario.conteudo.itens ?? [])
    .filter((item) => item.apresentacao.tipoRenderizacao === 'BOOLEANO')
    .map((item) => ({
      codigo: item.fatoCodigo,
      rotulo: item.apresentacao.rotulo,
      origem: 'campo',
    }));
}

function derivadosBooleanos(formulario: FormularioDeInscricao): readonly FatoDeElegibilidade[] {
  return formulario.derivacao
    .filter((derivacao) => derivacaoBooleana(derivacao.regras))
    .map((derivacao) => ({
      codigo: derivacao.codigoFato,
      rotulo: derivacao.codigoFato,
      origem: 'derivado',
    }));
}

/** A derivação é de sim ou não quando nenhuma regra dela contribui com um valor. */
function derivacaoBooleana(regras: unknown): boolean {
  return (
    Array.isArray(regras) &&
    regras.length > 0 &&
    regras.every(
      (regra) =>
        typeof regra === 'object' &&
        regra !== null &&
        ((regra as { contribui?: unknown }).contribui ?? null) === null,
    )
  );
}
