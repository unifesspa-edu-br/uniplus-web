import {
  FINALIDADE_INSCRICAO,
  FINALIDADES,
  fatosCitadosPeloConteudo,
  fatosQueExigemResposta,
  type ConteudoDoFormulario,
  type OpcaoDoFormulario,
} from '@uniplus/shared-ui/components';

import type { FormularioDaFinalidade, FormularioDeInscricao } from '../../processo-seletivo.models';
import {
  fatosColetadosPor,
  formularioDaFinalidade,
  formularioDoServidor,
  inscricaoDoServidor,
  type ProcessoComFormularios,
} from './formulario-do-processo';

/**
 * Os formulários do processo, um por finalidade (UNI-REQ-0144): a inscrição, que todo processo
 * tem, e os que o operador acrescenta — a solicitação de isenção da taxa e a habilitação. Cada um
 * é respondido numa fase do cronograma, e um fato tem um único formulário que o coleta.
 */

export const FINALIDADE_ISENCAO_TAXA = 'ISENCAO_TAXA';
export const FINALIDADE_HABILITACAO = 'HABILITACAO';
/** O código da fase em que o formulário de habilitação é respondido — a API não aceita outra. */
export const FASE_HABILITACAO = 'HABILITACAO';

/** A fase do cronograma como a escolha da fase do formulário a enxerga. */
export interface FaseQueRespondeFormulario {
  readonly codigo: string;
  readonly coletaInscricao: boolean;
  readonly coletaSolicitacaoIsencao: boolean;
}

/**
 * Se o formulário da finalidade pode ser respondido na fase — a mesma coerência que a API confere
 * ao gravar o cabeçalho: inscrição na fase que coleta inscrição, isenção na que coleta a
 * solicitação de isenção, habilitação na fase de habilitação.
 */
export function faseServeAFinalidade(finalidade: string, fase: FaseQueRespondeFormulario): boolean {
  switch (finalidade) {
    case FINALIDADE_INSCRICAO:
      return fase.coletaInscricao;
    case FINALIDADE_ISENCAO_TAXA:
      return fase.coletaSolicitacaoIsencao;
    case FINALIDADE_HABILITACAO:
      return fase.codigo === FASE_HABILITACAO;
    default:
      return false;
  }
}

/**
 * As finalidades cujo formulário se responde na fase, na ordem em que o candidato as responde — a
 * mesma lista que a API confere na exigência documental. Inscrição e isenção podem dividir a fase.
 */
export function finalidadesQueAtende(fase: FaseQueRespondeFormulario): readonly string[] {
  return FINALIDADES.map((opcao) => opcao.valor).filter((finalidade) => faseServeAFinalidade(finalidade, fase));
}

/**
 * A fase do formulário: a escolhida, enquanto estiver entre as que servem à finalidade, ou a única
 * que serve — preenchida sozinha. Sem nenhuma das duas, vazia, e o passo pede a escolha.
 */
export function faseEfetiva(escolhida: string, opcoes: readonly { readonly codigo: string }[]): string {
  if (opcoes.some((opcao) => opcao.codigo === escolhida)) return escolhida;
  return opcoes.length === 1 ? opcoes[0].codigo : '';
}

/** A isenção só existe em processo que cobra taxa de inscrição; as outras finalidades, sempre. */
export function finalidadeCabeNaCobranca(finalidade: string, cobraTaxa: boolean): boolean {
  return finalidade !== FINALIDADE_ISENCAO_TAXA || cobraTaxa;
}

/**
 * As finalidades que ainda podem ganhar formulário: as que faltam, que cabem na cobrança do
 * processo e com fase no cronograma em que são respondidas — sem ela a fase do formulário ficaria
 * nula, e a publicação a recusa.
 */
export function finalidadesParaAcrescentar(
  existentes: readonly string[],
  cobraTaxa: boolean,
  fases: readonly FaseQueRespondeFormulario[],
): readonly OpcaoDoFormulario[] {
  return FINALIDADES.filter(
    (opcao) =>
      !existentes.includes(opcao.valor) &&
      finalidadeCabeNaCobranca(opcao.valor, cobraTaxa) &&
      fases.some((fase) => faseServeAFinalidade(opcao.valor, fase)),
  );
}

/** O nome da finalidade em meio de frase: "o formulário de isenção da taxa de inscrição". */
export function nomeDaFinalidade(finalidade: string): string {
  return (FINALIDADES.find((opcao) => opcao.valor === finalidade)?.rotulo ?? finalidade).toLocaleLowerCase('pt-BR');
}

/** O trecho dos ids da aba, do painel e do editor de cada finalidade — únicos na tela. */
export function sufixoDaFinalidade(finalidade: string): string {
  return finalidade.toLocaleLowerCase('pt-BR').replaceAll('_', '-');
}

const posicaoDaFinalidade = (finalidade: string): number => {
  const posicao = FINALIDADES.findIndex((opcao) => opcao.valor === finalidade);
  return posicao === -1 ? FINALIDADES.length : posicao;
};

/** Em ordem das finalidades: a inscrição, a isenção e a habilitação, que é a ordem em que o candidato as responde. */
export function emOrdemDasFinalidades<T extends { readonly finalidade: string }>(formularios: readonly T[]): readonly T[] {
  return [...formularios].sort((um, outro) => posicaoDaFinalidade(um.finalidade) - posicaoDaFinalidade(outro.finalidade));
}

/** Todos os formulários do rascunho, a inscrição primeiro. */
export function formulariosDoRascunho(formulario: FormularioDeInscricao): readonly FormularioDaFinalidade[] {
  return [
    {
      finalidade: FINALIDADE_INSCRICAO,
      faseCodigo: formulario.faseCodigo,
      conteudo: formulario.conteudo,
      modeloOrigemCodigo: formulario.modeloOrigemCodigo ?? null,
    },
    ...formulario.outrasFinalidades,
  ];
}

/** O rascunho com o formulário da finalidade trocado; a inscrição nos campos dela, as outras na lista. */
export function comFormulario(formulario: FormularioDeInscricao, novo: FormularioDaFinalidade): FormularioDeInscricao {
  if (novo.finalidade === FINALIDADE_INSCRICAO) {
    return { ...formulario, faseCodigo: novo.faseCodigo, conteudo: novo.conteudo, modeloOrigemCodigo: novo.modeloOrigemCodigo ?? null };
  }
  const outras = formulario.outrasFinalidades.filter((outro) => outro.finalidade !== novo.finalidade);
  return { ...formulario, outrasFinalidades: emOrdemDasFinalidades([...outras, novo]) };
}

/** Os formulários das outras finalidades que o servidor tem, na forma do rascunho e em ordem. */
export function outrasFinalidadesDoServidor(dto: ProcessoComFormularios): readonly FormularioDaFinalidade[] {
  return emOrdemDasFinalidades(
    dto.formularios.filter((formulario) => formulario.finalidade !== FINALIDADE_INSCRICAO).map((formulario) => formularioDoServidor(dto, formulario)),
  );
}

/** O formulário da finalidade que o servidor tem, na forma do rascunho; nulo quando não tem. */
export function formularioDoServidorNaFinalidade(dto: ProcessoComFormularios, finalidade: string): FormularioDaFinalidade | null {
  const formulario = formularioDaFinalidade(dto.formularios, finalidade);
  return formulario === null ? null : formularioDoServidor(dto, formulario);
}

/** Os formulários do servidor na forma do rascunho: a inscrição nos campos dela e as outras finalidades. */
export function formulariosDoServidor(
  dto: ProcessoComFormularios,
): Pick<FormularioDeInscricao, 'faseCodigo' | 'conteudo' | 'outrasFinalidades' | 'modeloOrigemCodigo'> {
  return { ...inscricaoDoServidor(dto), outrasFinalidades: outrasFinalidadesDoServidor(dto) };
}

/** Os fatos que os OUTROS formulários do rascunho coletam — o que este não pode coletar. */
export function fatosColetadosPelasOutras(formularios: readonly FormularioDaFinalidade[], finalidade: string): readonly string[] {
  return [
    ...new Set(formularios.filter((formulario) => formulario.finalidade !== finalidade).flatMap((formulario) => fatosColetadosPor(formulario.conteudo))),
  ];
}

/**
 * Os fatos da inscrição que uma regra de outra finalidade cita por negação ou com impedimento: a
 * inscrição precisa torná-los obrigatórios, e o editor dela não vê aquelas regras (UNI-REQ-0074).
 */
export function fatosDaInscricaoQueOutrasExigem(inscricao: ConteudoDoFormulario, outras: readonly FormularioDaFinalidade[]): readonly string[] {
  const daInscricao = new Set(fatosColetadosPor(inscricao));
  return [...new Set(outras.flatMap((outra) => [...fatosQueExigemResposta(outra.conteudo)]))].filter((fato) => daInscricao.has(fato));
}

/** Um formulário na gravação: o que o servidor tem, quando tem, e o que o rascunho quer. */
export interface FormularioNaGravacao {
  readonly finalidade: string;
  readonly servidor: ConteudoDoFormulario | null;
  readonly desejado: ConteudoDoFormulario;
}

const coletados = (conteudo: ConteudoDoFormulario | null): ReadonlySet<string> => new Set(conteudo === null ? [] : fatosColetadosPor(conteudo));
const citados = (conteudo: ConteudoDoFormulario | null): ReadonlySet<string> => (conteudo === null ? new Set() : fatosCitadosPeloConteudo(conteudo));
const diferenca = (um: ReadonlySet<string>, outro: ReadonlySet<string>): readonly string[] => [...um].filter((fato) => !outro.has(fato));
const algumEm = (fatos: readonly string[], conjunto: ReadonlySet<string>): boolean => fatos.some((fato) => conjunto.has(fato));

/**
 * A ordem em que as finalidades gravam. Cada PUT é conferido contra o que as OUTRAS têm gravado,
 * então a ordem decide se a gravação passa:
 * - o fato que muda de formulário sai de um antes de entrar no outro, ou o segundo é recusado por
 *   coletar o que o primeiro ainda coleta (produtor único);
 * - a inscrição que ganha um fato grava antes da finalidade que passa a citá-lo, ou a citação é
 *   recusada por apontar fato que ninguém coleta;
 * - a inscrição que perde um fato que outra finalidade cita no servidor grava depois dela, ou a
 *   inscrição é recusada por deixar aquela citação órfã.
 *
 * Sem dependência, vale a ordem das finalidades. Dependências em ciclo não têm ordem que passe; o
 * resto vai na ordem das finalidades e a recusa da API aponta o conflito.
 */
export function ordemDeGravacao(formularios: readonly FormularioNaGravacao[]): readonly string[] {
  const antesDe = new Map<string, Set<string>>(formularios.map((formulario) => [formulario.finalidade, new Set<string>()]));
  const exigir = (primeira: string, depois: string): void => {
    if (primeira !== depois) antesDe.get(depois)?.add(primeira);
  };

  for (const perde of formularios) {
    const perdidos = diferenca(coletados(perde.servidor), coletados(perde.desejado));
    for (const ganha of formularios) {
      if (algumEm(perdidos, coletados(ganha.desejado))) exigir(perde.finalidade, ganha.finalidade);
    }
  }

  const inscricao = formularios.find((formulario) => formulario.finalidade === FINALIDADE_INSCRICAO);
  if (inscricao !== undefined) {
    const ganhos = diferenca(coletados(inscricao.desejado), coletados(inscricao.servidor));
    const perdas = diferenca(coletados(inscricao.servidor), coletados(inscricao.desejado));
    for (const outra of formularios) {
      if (algumEm(ganhos, citados(outra.desejado))) exigir(FINALIDADE_INSCRICAO, outra.finalidade);
      if (algumEm(perdas, citados(outra.servidor))) exigir(outra.finalidade, FINALIDADE_INSCRICAO);
    }
  }

  const pendentes = emOrdemDasFinalidades(formularios).map((formulario) => formulario.finalidade);
  const ordem: string[] = [];
  while (pendentes.length > 0) {
    const livre = pendentes.findIndex((finalidade) => [...(antesDe.get(finalidade) ?? [])].every((anterior) => ordem.includes(anterior)));
    ordem.push(...pendentes.splice(livre === -1 ? 0 : livre, 1));
  }
  return ordem;
}

/** A aba que a tecla escolhe: setas andam em círculo, Home e End vão às pontas; outra tecla, nenhuma. */
export function abaPelaTecla(tecla: string, atual: number, total: number): number | null {
  switch (tecla) {
    case 'ArrowRight':
      return (atual + 1) % total;
    case 'ArrowLeft':
      return (atual - 1 + total) % total;
    case 'Home':
      return 0;
    case 'End':
      return total - 1;
    default:
      return null;
  }
}
