import { avaliar, type ItemAvaliado, type OcorrenciaRespondida } from './avaliador';
import { lerRegras, type RegrasInvalidas } from './leitura';
import {
  codigosDa,
  estaVazia,
  FATO_NAO_INFORMADO,
  type FatoResolvido,
  type Fatos,
  INDETERMINADO,
  resolvido,
} from './logica';
import type {
  AvaliacaoDoFormulario,
  CampoAvaliado,
  OcorrenciaSimulada,
  RegrasDoFormulario,
  SimulacaoDoFormulario,
  ValorJson,
} from './regras-do-formulario';

export type InterpretacaoDoFormulario =
  | { readonly valida: true; readonly avaliacao: AvaliacaoDoFormulario }
  | { readonly valida: false; readonly erro: RegrasInvalidas };

/**
 * Interpreta as regras de um formulário diante das respostas simuladas e devolve a avaliação na mesma
 * forma da avaliação sem cadastro da API (ADR-0139). O front não tem regra própria: tudo vem das
 * regras, e a API, que revalida tudo, é a palavra final.
 *
 * As regras que não formam formulário, e a ocorrência de grupo sem identidade própria, são recusadas
 * com o caminho do problema. A resposta fora da oferta do campo não vale e é descartada antes.
 */
export function interpretarFormulario(
  regras: RegrasDoFormulario | null | undefined,
  simulacao: SimulacaoDoFormulario,
): InterpretacaoDoFormulario {
  const grupos = lerOcorrencias(simulacao.grupos);
  if ('caminho' in grupos) return { valida: false, erro: grupos };

  const leitura = lerRegras(regras);
  if (!leitura.valida) return leitura;
  const { definicao } = leitura;

  const dentroDaOferta = (
    respostas: Iterable<readonly [string, ValorJson]>,
  ): Map<string, ValorJson> =>
    new Map(
      [...respostas].filter(([fato, resposta]) => {
        const oferta = definicao.ofertas.get(fato);
        const codigos = codigosDa(resposta);
        return (
          !oferta ||
          estaVazia(resposta) ||
          (codigos !== null && codigos.every((c) => oferta.has(c)))
        );
      }),
    );

  const avaliacao = avaliar(definicao, {
    respostas: dentroDaOferta(Object.entries(simulacao.respostas ?? {})),
    grupos: new Map(
      [...grupos.entries()].map(([grupo, ocorrencias]) => [
        grupo,
        ocorrencias.map((o) => ({ id: o.id, respostas: dentroDaOferta(o.respostas) })),
      ]),
    ),
    etapasConcluidas: new Set(simulacao.etapasConcluidas ?? []),
    fatosConhecidos: comoFatosConhecidos(simulacao.pressupostos),
  });

  return {
    valida: true,
    avaliacao: {
      etapas: avaliacao.etapas.map((e) => ({ codigo: e.codigo, visivel: e.visivel })),
      campos: avaliacao.itens.map((i) => campo(i, avaliacao.fatos)),
      grupos: avaliacao.grupos.map((g) => ({
        codigo: g.codigo,
        etapaCodigo: g.etapaCodigo,
        visivel: g.visivel,
        obrigatorio: g.obrigatorio,
        estado: g.estado,
        contagemValida: g.contagemValida,
        ocorrenciaDoCandidatoValida: g.ocorrenciaDoCandidatoValida,
        ocorrencias: g.ocorrencias.map((o) => ({
          id: o.id,
          estado: o.estado,
          campos: o.itens.map((i) => campo(i, o.fatos)),
        })),
      })),
      termos: avaliacao.termos.map((t) => ({
        codigo: t.codigo,
        visivel: t.visivel,
        obrigatorio: t.obrigatorio,
      })),
    },
  };
}

/**
 * As ocorrências de cada grupo, pela identidade própria de cada uma, que não se repete no grupo: é por
 * ela que o documento exigido por membro fica ligado ao membro.
 */
function lerOcorrencias(
  grupos: Readonly<Record<string, readonly OcorrenciaSimulada[] | null>> | null | undefined,
): Map<string, OcorrenciaRespondida[]> | RegrasInvalidas {
  const lidas = new Map<string, OcorrenciaRespondida[]>();
  for (const [grupo, recebidas] of Object.entries(grupos ?? {})) {
    const vistas = new Set<string>();
    const respondidas: OcorrenciaRespondida[] = [];
    if (recebidas !== null && recebidas !== undefined && !Array.isArray(recebidas)) {
      return { caminho: `grupos.${grupo}`, mensagem: 'As ocorrências do grupo são uma lista.' };
    }
    for (const [i, ocorrencia] of (recebidas ?? []).entries()) {
      const id = ocorrencia?.id;
      if (typeof id !== 'string' || id.trim() === '' || vistas.has(id)) {
        return {
          caminho: `grupos.${grupo}[${i}].id`,
          mensagem:
            'Cada ocorrência do grupo precisa de uma identidade própria, que não se repita no grupo.',
        };
      }
      vistas.add(id);
      respondidas.push({ id, respostas: new Map(Object.entries(ocorrencia.respostas ?? {})) });
    }
    lidas.set(grupo, respondidas);
  }
  return lidas;
}

/** Os pressupostos: o valor dado resolve o fato, e o valor em branco é não informado. */
function comoFatosConhecidos(
  pressupostos: Readonly<Record<string, ValorJson>> | null | undefined,
): Fatos {
  return new Map<string, FatoResolvido>(
    Object.entries(pressupostos ?? {}).map(([fato, valor]) => [
      fato,
      estaVazia(valor) ? FATO_NAO_INFORMADO : resolvido(valor),
    ]),
  );
}

function campo(item: ItemAvaliado, fatos: Fatos): CampoAvaliado {
  return {
    fatoCodigo: item.fatoCodigo,
    etapaCodigo: item.etapaCodigo,
    estado: fatos.get(item.fatoCodigo)?.estado ?? INDETERMINADO,
    visivel: item.visivel,
    obrigatorio: item.obrigatorio,
    restricoesVioladas: item.restricoesVioladas,
    impedido: item.impedido,
    opcoes: item.opcoes,
  };
}
