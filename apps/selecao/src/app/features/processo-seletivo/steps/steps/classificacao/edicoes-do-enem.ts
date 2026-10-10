import { OrigemCandidatos, type ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';
import type { WizardDraft } from '../../processo-seletivo.models';

/** O fato cujas opções são as edições do ENEM que o processo aceita. */
export const FATO_DA_EDICAO_DO_ENEM = 'EDICAO_ENEM';

/** A primeira edição do ENEM. */
const PRIMEIRA_EDICAO = 1998;

/**
 * O processo declara as edições quando a nota vem do ENEM e o candidato se inscreve nele: é na
 * inscrição que ele escolhe a edição. O processo que só importa o resultado não as declara.
 */
export function declaraEdicoesDoEnem(draft: WizardDraft): boolean {
  return (
    draft.classificacao.baseadoEmEnem &&
    draft.identificacao.origemCandidatos === OrigemCandidatos.inscricaoPropria
  );
}

export function rotuloDaEdicao(ano: string): string {
  return `ENEM ${ano}`;
}

/** As edições gravadas no processo, pela ordem declarada. */
export function edicoesDoEnemDe(dto: ProcessoSeletivoDto): readonly string[] {
  const declaradas = dto.opcoesDeclaradas.find((o) => o.fatoCodigo === FATO_DA_EDICAO_DO_ENEM);
  return [...(declaradas?.opcoes ?? [])]
    .sort((a, b) => Number(a.ordem) - Number(b.ordem))
    .map((o) => o.codigo);
}

/**
 * O ano digitado como edição a acrescentar, ou o motivo da recusa. Aceita do ano da primeira
 * edição até o seguinte ao atual: o processo é configurado antes da edição que ele aceita.
 */
export function anoDaEdicao(
  texto: string,
  declaradas: readonly string[],
  anoAtual: number,
): { readonly ano: string } | { readonly recusa: string } {
  const ano = texto.trim();
  const numero = Number(ano);
  if (!/^\d{4}$/.test(ano) || numero < PRIMEIRA_EDICAO || numero > anoAtual + 1) {
    return { recusa: `Informe um ano de ${PRIMEIRA_EDICAO} a ${anoAtual + 1}.` };
  }
  if (declaradas.includes(ano)) return { recusa: `A edição ${ano} já está na lista.` };
  return { ano };
}

/** As edições em ordem crescente, que é a ordem em que o candidato as vê. */
export function comEdicao(declaradas: readonly string[], ano: string): readonly string[] {
  return [...declaradas, ano].sort();
}

export function comoOpcoesDasEdicoes(
  anos: readonly string[],
): { readonly codigo: string; readonly rotulo: string }[] {
  return anos.map((ano) => ({ codigo: ano, rotulo: rotuloDaEdicao(ano) }));
}
