import { apresentacaoDasRegras } from './apresentacao-das-regras';
import type { FormularioDoCandidato } from './formulario-do-candidato.model';
import { lerRegras } from './interpretador/leitura';
import type {
  AvaliacaoDoFormulario,
  RegrasDoFormulario,
  SimulacaoDoFormulario,
} from './interpretador/regras-do-formulario';
import { ehObjeto, recusaDaApresentacao, recusaDaSimulacao } from './recusas-do-arquivo';

/**
 * O que um arquivo importado no simulador traz: um formulário renderizável — o que a exportação de um
 * modelo ou processo baixa —, ou um caso do corpus compartilhado com a API, com as regras e as
 * respostas. O caso não tem apresentação: ela é montada a partir das regras.
 */
export type ArquivoDoFormulario =
  | {
      readonly valido: true;
      readonly formulario: FormularioDoCandidato;
      readonly simulacao: SimulacaoDoFormulario | null;
    }
  | { readonly valido: false; readonly caminho: string; readonly mensagem: string };

/** O arquivo lido: a forma é conferida antes de qualquer interpretação, com o caminho do problema. */
export function lerArquivoDoFormulario(texto: string): ArquivoDoFormulario {
  let conteudo: unknown;
  try {
    conteudo = JSON.parse(texto);
  } catch (erro) {
    return recusado('(arquivo)', `O arquivo não é um JSON válido: ${(erro as Error).message}`);
  }
  if (!ehObjeto(conteudo)) return recusado('(arquivo)', 'O arquivo é um objeto JSON.');
  if (!ehObjeto(conteudo['regras']))
    return recusado('regras', 'O arquivo não traz as regras do formulário.');

  // As regras são conferidas antes de qualquer outra coisa: a apresentação de um caso é montada a
  // partir delas, e a do formulário só vale sobre regras que formam formulário.
  const leitura = lerRegras(conteudo['regras'] as RegrasDoFormulario);
  if (!leitura.valida) return recusado(`regras.${leitura.erro.caminho}`, leitura.erro.mensagem);
  return 'fatosColetados' in conteudo ? lerFormularioRenderizavel(conteudo) : lerCaso(conteudo);
}

function recusado(caminho: string, mensagem: string): ArquivoDoFormulario {
  return { valido: false, caminho, mensagem };
}

function lerFormularioRenderizavel(conteudo: Record<string, unknown>): ArquivoDoFormulario {
  const recusa = recusaDaApresentacao(conteudo);
  if (recusa) return { valido: false, ...recusa };
  return {
    valido: true,
    formulario: conteudo as unknown as FormularioDoCandidato,
    simulacao: null,
  };
}

/** O caso do corpus não tem apresentação: ela sai das regras. */
function lerCaso(conteudo: Record<string, unknown>): ArquivoDoFormulario {
  const recusa = recusaDaSimulacao(conteudo);
  if (recusa) return { valido: false, ...recusa };
  const caso = conteudo as unknown as SimulacaoDoFormulario & {
    readonly regras: RegrasDoFormulario;
  };
  return {
    valido: true,
    formulario: apresentacaoDasRegras(caso.regras, caso),
    simulacao: {
      respostas: caso.respostas ?? null,
      grupos: caso.grupos ?? null,
      etapasConcluidas: caso.etapasConcluidas ?? null,
      pressupostos: caso.pressupostos ?? null,
    },
  };
}

/**
 * Um caso do corpus para baixar: as regras, a simulação e, como esperado, a avaliação inteira do
 * interpretador — quem escreve o caso deixa só o que ele protege.
 */
export function casoDaSimulacao(
  regras: RegrasDoFormulario,
  simulacao: SimulacaoDoFormulario,
  avaliacao: AvaliacaoDoFormulario,
): Record<string, unknown> {
  return {
    descricao: 'Descreva a regra que o caso protege.',
    regras,
    respostas: simulacao.respostas ?? {},
    grupos: simulacao.grupos ?? {},
    etapasConcluidas: simulacao.etapasConcluidas ?? [],
    pressupostos: simulacao.pressupostos ?? {},
    esperado: avaliacao,
  };
}
