import { fatosCitadosPeloCampo, fatosDoPredicado, predicadosDasRegras } from './citacoes';
import { nomeDoFato } from './codigos';
import { etapasEmOrdem, primeiraOrdemDaEtapa } from './ordem-das-entradas';
import {
  ConteudoDoFormulario,
  EtapaDoFormulario,
  GrupoDoFormulario,
  ItemDoFormulario,
  ResultadoDaEdicao,
} from './tipos';

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

function verificacaoDoItem(item: ItemDoFormulario): VerificacaoDeOrdem {
  return {
    ordem: item.ordem,
    citados: fatosCitadosPeloCampo(item).filter((fato) => fato !== item.fatoCodigo),
    descricao: `“${item.apresentacao.rotulo}”`,
  };
}

function verificacaoDoGrupo(grupo: GrupoDoFormulario): VerificacaoDeOrdem {
  return {
    ordem: grupo.ordem,
    // Os campos do grupo também citam: o fato de membro não tem posição e não entra na conta.
    citados: [
      ...predicadosDasRegras(grupo.regras).flatMap(fatosDoPredicado),
      ...grupo.subitens.flatMap(fatosCitadosPeloCampo),
    ],
    descricao: `O grupo “${grupo.rotulo}”`,
  };
}

function verificacaoDaSecao(
  conteudo: ConteudoDoFormulario,
  etapa: EtapaDoFormulario,
): VerificacaoDeOrdem {
  return {
    ordem: primeiraOrdemDaEtapa(conteudo, etapa.ordem),
    citados: fatosDoPredicado(etapa.exibicao ?? null),
    descricao: `A seção “${etapa.apresentacao.titulo}”`,
  };
}

function verificacoesDeOrdem(conteudo: ConteudoDoFormulario): readonly VerificacaoDeOrdem[] {
  return [
    ...(conteudo.itens ?? []).map(verificacaoDoItem),
    ...(conteudo.grupos ?? []).map(verificacaoDoGrupo),
    ...etapasEmOrdem(conteudo).map((etapa) => verificacaoDaSecao(conteudo, etapa)),
  ];
}

function ficaDepoisNoConteudo(
  conteudo: ConteudoDoFormulario,
): (fato: string, ordem: number) => boolean {
  const posicao = new Map((conteudo.itens ?? []).map((item) => [item.fatoCodigo, item.ordem]));
  const pressupostos = new Set(conteudo.pressupostos ?? []);
  return (fato, ordem) => !pressupostos.has(fato) && (posicao.get(fato) ?? -Infinity) >= ordem;
}

export function recusaDaCitacaoPosterior(
  descricao: string,
  citado: string,
  nomes: ReadonlyMap<string, string>,
): string {
  return `${descricao} cita “${nomeDoFato(nomes, citado)}”, que ficaria depois. Mova primeiro o campo citado.`;
}

export function conferirOrdem(
  conteudo: ConteudoDoFormulario,
  nomes: ReadonlyMap<string, string>,
): ResultadoDaEdicao {
  const ficaDepois = ficaDepoisNoConteudo(conteudo);
  for (const verificacao of verificacoesDeOrdem(conteudo)) {
    const fato = verificacao.citados.find((citado) => ficaDepois(citado, verificacao.ordem));
    if (fato !== undefined) {
      return { ok: false, recusa: recusaDaCitacaoPosterior(verificacao.descricao, fato, nomes) };
    }
  }
  return { ok: true, conteudo };
}
