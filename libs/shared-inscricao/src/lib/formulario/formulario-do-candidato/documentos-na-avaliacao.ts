import { regrasDeDocumentos, type ItemDeComprovacao } from './regras-de-documentos';
import { type DocumentosDoFormulario, documentosDoFormulario } from './documentos-avaliados';
import type { FormularioDoCandidato, FormularioNoProcesso } from './formulario-do-candidato.model';
import type { AvaliacaoNaTela, PendenciaDaAvaliacao } from './modalidades-avaliadas';
import type { OcorrenciaSimulada } from './interpretador/regras-do-formulario';

/** Os documentos que a avaliação pede no próprio formulário: a estrutura de regras da escolha e o que falta responder. */
export interface DocumentosNaAvaliacao {
  readonly regras: readonly ItemDeComprovacao[];
  readonly pendencias: readonly PendenciaDaAvaliacao[];
}

/** A comparação que poupa nova renderização quando a avaliação devolve o mesmo conteúdo. */
export function iguaisPorJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Os documentos da fase e do código do formulário, como a avaliação da API os traz; nulos antes dela. */
export function documentosDaFase(
  avaliacao: AvaliacaoNaTela | null,
  noProcesso: FormularioNoProcesso | null,
): DocumentosDoFormulario | null {
  const avaliados = avaliacao?.documentos ?? null;
  if (avaliados === null) return null;
  return documentosDoFormulario(avaliados, noProcesso?.faseId, noProcesso?.codigo);
}

/** A estrutura de regras da escolha dos documentos e o que falta responder; nulas antes da primeira avaliação. */
export function documentosDaAvaliacao(
  daFase: DocumentosDoFormulario | null,
  formulario: FormularioDoCandidato,
  ocorrencias: Readonly<Record<string, readonly OcorrenciaSimulada[]>>,
): DocumentosNaAvaliacao | null {
  if (daFase === null) return null;
  return {
    regras: regrasDeDocumentos(daFase.documentos, formulario.coleta.grupos, ocorrencias),
    pendencias: daFase.pendencias,
  };
}
