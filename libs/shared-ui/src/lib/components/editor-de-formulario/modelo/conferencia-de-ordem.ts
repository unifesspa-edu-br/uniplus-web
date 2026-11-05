import { fatosCitadosPeloCampo, fatosDoPredicado } from './citacoes';
import { nomeDoFato } from './codigos';
import { etapasEmOrdem, primeiraOrdemDaEtapa } from './ordem-das-entradas';
import { ConteudoDoFormulario, ResultadoDaEdicao } from './tipos';

/**
 * Recusa a ordem em que um item, um grupo ou uma seção cita fato coletado por item que não vem
 * antes dele. Só os itens do formulário entram na conta: o pressuposto é conhecido antes, e o
 * derivado — cuja posição depende das dependências dele — fica com a API.
 */
interface VerificacaoDeOrdem {
  readonly ordem: number;
  readonly citados: readonly string[];
  readonly descricao: string;
}

function verificacoesDeOrdem(conteudo: ConteudoDoFormulario): readonly VerificacaoDeOrdem[] {
  return [
    ...(conteudo.itens ?? []).map((item) => ({
      ordem: item.ordem,
      citados: fatosCitadosPeloCampo(item).filter((fato) => fato !== item.fatoCodigo),
      descricao: `“${item.rotulo}”`,
    })),
    ...(conteudo.grupos ?? []).map((grupo) => ({
      ordem: grupo.ordem,
      // Os campos do grupo também citam: o fato de membro não tem posição e não entra na conta.
      citados: [
        ...[grupo.exibicao, grupo.predicadoObrigatoriedade].flatMap(fatosDoPredicado),
        ...grupo.subitens.flatMap(fatosCitadosPeloCampo),
      ],
      descricao: `O grupo “${grupo.rotulo}”`,
    })),
    ...etapasEmOrdem(conteudo).map((etapa) => ({
      ordem: primeiraOrdemDaEtapa(conteudo, etapa.ordem),
      citados: fatosDoPredicado(etapa.exibicao ?? null),
      descricao: `A seção “${etapa.titulo}”`,
    })),
  ];
}

export function conferirOrdem(
  conteudo: ConteudoDoFormulario,
  nomes: ReadonlyMap<string, string>,
): ResultadoDaEdicao {
  const posicao = new Map((conteudo.itens ?? []).map((item) => [item.fatoCodigo, item.ordem]));
  const pressupostos = new Set(conteudo.pressupostos ?? []);
  const depoisDe = (fato: string, ordem: number): boolean =>
    !pressupostos.has(fato) && (posicao.get(fato) ?? -Infinity) >= ordem;

  for (const verificacao of verificacoesDeOrdem(conteudo)) {
    const fato = verificacao.citados.find((citado) => depoisDe(citado, verificacao.ordem));
    if (fato !== undefined) {
      return {
        ok: false,
        recusa: `${verificacao.descricao} cita “${nomeDoFato(nomes, fato)}”, que ficaria depois. Mova primeiro o campo citado.`,
      };
    }
  }
  return { ok: true, conteudo };
}
