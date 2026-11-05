import {
  BLOCO_COMPROVACAO_DOCUMENTAL,
  campoEm,
  type ErroDoServidor,
} from './formulario-do-candidato.model';
import { ehCampoDeDocumento } from './envio-de-documentos';
import type { OcorrenciaSimulada } from './interpretador/regras-do-formulario';
import type { PassoDoFormulario } from './passos-do-formulario';

/**
 * A recusa de dentro de um grupo segue de pé quando a ocorrência dela continua na lista e o que ela
 * recusa não mudou: o subcampo, se a recusa é dele, ou a ocorrência toda, se a recusa é dela. A do grupo
 * em si (cardinalidade) e a de ocorrência removida, nova ou fora da lista não sobrevivem à edição.
 */
export function erroSobrevive(
  erro: ErroDoServidor,
  grupo: string,
  antes: readonly OcorrenciaSimulada[] | undefined,
  depois: readonly OcorrenciaSimulada[] | undefined,
): boolean {
  if (!antes || !depois) return false;
  for (const anterior of antes) {
    const atual = depois.find((o) => o.id === anterior.id);
    if (!atual) continue;
    const ocorrencia = `${grupo}.${anterior.id}`;
    if (erro.campo === ocorrencia) return mesmoValor(anterior.respostas, atual.respostas);
    if (erro.campo.startsWith(`${ocorrencia}.`)) {
      const fato = erro.campo.slice(ocorrencia.length + 1);
      return mesmoValor(anterior.respostas?.[fato], atual.respostas?.[fato]);
    }
  }
  return false;
}

function mesmoValor(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** O campo — o código de um campo, grupo ou termo, ou de dentro de um grupo — é deste passo. */
export function contemOCampo(passo: PassoDoFormulario, campo: string): boolean {
  return (
    passo.campos.some((c) => campo === c.campo.fatoCodigo) ||
    passo.grupos.some((g) => campoEm(campo, g.grupo.codigo)) ||
    passo.termos.some((t) => campo === t.termo.codigo) ||
    (passo.bloco === BLOCO_COMPROVACAO_DOCUMENTAL && ehCampoDeDocumento(campo))
  );
}

export function tituloDasRecusas(quantidade: number): string {
  return quantidade === 1
    ? 'O servidor recusou 1 resposta desta seção'
    : `O servidor recusou ${quantidade} respostas desta seção`;
}
