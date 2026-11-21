import { avaliar } from './avaliador';
import type { RegrasInvalidas } from './definicao-do-formulario';
import { lerRegras } from './leitura';
import { entradaDaAvaliacao, lerSimulacao } from './leitura-da-simulacao';
import { comoAvaliacaoDoFormulario } from './resultado-da-avaliacao';
import type {
  AvaliacaoDoFormulario,
  RegrasDoFormulario,
  SimulacaoDoFormulario,
} from './regras-do-formulario';

export { lerEnvio } from './leitura-da-simulacao';

export type InterpretacaoDoFormulario =
  | { readonly valida: true; readonly avaliacao: AvaliacaoDoFormulario }
  | { readonly valida: false; readonly erro: RegrasInvalidas };

/**
 * Interpreta as regras de um formulário diante das respostas simuladas e devolve a avaliação na mesma
 * forma da avaliação sem cadastro da API (ADR-0139). O front não tem regra própria: tudo vem das
 * regras, e a API, que revalida tudo, é a palavra final.
 *
 * As regras que não formam formulário, e a ocorrência de grupo sem identidade própria, são recusadas
 * com o caminho do problema. O fato de resposta fixa, que vem da conta, não passa pelas restrições. A resposta fora da oferta do campo não vale e é descartada antes.
 */
export function interpretarFormulario(
  regras: RegrasDoFormulario | null | undefined,
  simulacao: SimulacaoDoFormulario,
  fatosFixos: ReadonlySet<string> = new Set(),
): InterpretacaoDoFormulario {
  const lida = lerSimulacao(simulacao);
  if ('caminho' in lida) return { valida: false, erro: lida };
  const leitura = lerRegras(regras);
  if (!leitura.valida) return leitura;
  const { definicao } = leitura;
  const entrada = entradaDaAvaliacao(definicao, simulacao, lida, fatosFixos);
  return { valida: true, avaliacao: comoAvaliacaoDoFormulario(avaliar(definicao, entrada)) };
}
