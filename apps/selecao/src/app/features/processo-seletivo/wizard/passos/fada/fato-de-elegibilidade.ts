import { OrigemCandidatosCodigo, TipoDeCampoCodigo } from '@uniplus/shared-data/selecao';

import type { ConteudoDoFormulario } from '@uniplus/shared-inscricao/formulario';

import type { FormularioDeInscricao, WizardDraft } from '../../processo-seletivo.models';

/** Um fato que pode decidir quem recebe o acréscimo, com o texto que o seletor mostra. */
export interface FatoDeElegibilidade {
  readonly codigo: string;
  readonly rotulo: string;
}

/** O nome que o cadastro de dados do candidato dá ao código, ou `undefined` quando não tem. */
export type NomeDoFato = (codigo: string) => string | undefined;

/** "Nome (CÓDIGO)"; o código sozinho só quando não há nome para ele. */
export function rotuloDoFato(codigo: string, nome: string | undefined): string {
  return nome === undefined || nome.trim() === '' ? codigo : `${nome} (${codigo})`;
}

/**
 * O processo cita o fato de elegibilidade quando aplica o acréscimo e o candidato se inscreve
 * nele (ADR-0142). O processo que só importa o resultado não tem o que citar.
 */
export function citaFatoDeElegibilidade(draft: WizardDraft): boolean {
  return (
    draft.fada.aplica === true &&
    draft.identificacao.origemCandidatos === OrigemCandidatosCodigo.INSCRICAO_PROPRIA
  );
}

/**
 * Os fatos que o motor consegue resolver para todo candidato: os campos de sim ou não do
 * formulário de inscrição, fora de grupo, e os fatos que o processo deriva como sim ou não.
 */
export function fatosDeElegibilidade(
  inscricao: ConteudoDoFormulario,
  derivacao: FormularioDeInscricao['derivacao'],
  nomeDoFato: NomeDoFato,
): readonly FatoDeElegibilidade[] {
  return [...camposBooleanos(inscricao, nomeDoFato), ...derivadosBooleanos(derivacao, nomeDoFato)];
}

/** O campo do formulário leva o texto da pergunta; sem ele, vale o nome do cadastro. */
function camposBooleanos(
  inscricao: ConteudoDoFormulario,
  nomeDoFato: NomeDoFato,
): readonly FatoDeElegibilidade[] {
  return (inscricao.itens ?? [])
    .filter((item) => item.apresentacao.tipoDeCampo === TipoDeCampoCodigo.SIM_OU_NAO)
    .map((item) => ({
      codigo: item.fatoCodigo,
      rotulo: rotuloDoFato(
        item.fatoCodigo,
        item.apresentacao.rotulo.trim() || nomeDoFato(item.fatoCodigo),
      ),
    }));
}

function derivadosBooleanos(
  derivacao: FormularioDeInscricao['derivacao'],
  nomeDoFato: NomeDoFato,
): readonly FatoDeElegibilidade[] {
  return derivacao
    .filter((derivacao) => derivacaoBooleana(derivacao.regras))
    .map((derivacao) => ({
      codigo: derivacao.codigoFato,
      rotulo: rotuloDoFato(derivacao.codigoFato, nomeDoFato(derivacao.codigoFato)),
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
