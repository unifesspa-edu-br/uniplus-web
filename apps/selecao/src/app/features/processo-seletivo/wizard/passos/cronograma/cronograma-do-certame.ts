import type { FaseCanonicaDto, PrecedenciaFaseDto } from '@uniplus/shared-data/configuracao';

import type { EtapaPontuada, FaseDoCronograma } from '../../processo-seletivo.models';
import { descreverFase, type ExigenciasDaFase } from '../../shared/descricao-da-fase';
import { problemasDaFase, type AtoDoCatalogo } from '../fase/configuracao-da-fase';
import {
  problemasDasExigencias,
  type ExigenciaDeclarada,
} from './conferencia-das-exigencias-declaradas';
import { problemasDasEtapas } from './problemas-das-etapas';
import {
  instanteDe,
  violacoesDePrecedencia,
  type ViolacaoDePrecedencia,
} from './precedencia-de-fases';
import { repetidos } from '../../shared/repetidos';
import type { TipoDeEtapaDoCatalogo } from './regras-da-etapa';

/** Os catálogos e as edições do exame declaradas pelo processo que a conferência do cronograma consulta. */
export interface CatalogosDaConferencia {
  readonly fasePorId: ReadonlyMap<string, FaseCanonicaDto>;
  readonly precedencias: readonly PrecedenciaFaseDto[];
  readonly atoPorCodigo: ReadonlyMap<string, AtoDoCatalogo>;
  /** As edições do ENEM que o processo declara, em texto, como a Fórmula as guarda. */
  readonly edicoesDoEnem: readonly string[];
  readonly nomeDaBanca: (tipoBancaId: string) => string;
  readonly tipoDaEtapa: (tipoEtapaOrigemId: string) => TipoDeEtapaDoCatalogo | undefined;
}

/** O cronograma como o operador o declarou, com o que a conferência precisa para julgá-lo. */
export interface CronogramaConferido {
  readonly fases: readonly FaseDoCronograma[];
  readonly etapas: readonly EtapaPontuada[];
  readonly exigencias: readonly ExigenciaDeclarada[];
  readonly catalogos: CatalogosDaConferencia;
}

/**
 * O que impede a gravação, na ordem em que quem preenche resolve: primeiro o
 * que falta declarar, depois o que está incoerente entre si.
 *
 * Só entra aqui o que a tela consegue afirmar com o que tem em mãos. Teto de
 * vagas, vigência de ato e unicidade de código no servidor continuam sendo dele
 * — repetir a conferência aqui daria duas fontes para a mesma regra, e a que
 * ficasse desatualizada recusaria o que o servidor aceita.
 */
export function problemasDoCronograma({
  fases,
  etapas,
  exigencias,
  catalogos,
}: CronogramaConferido): readonly string[] {
  if (fases.length === 0) return ['O cronograma precisa de ao menos uma fase.'];
  return conferirCronograma({ fases, etapas, exigencias, catalogos });
}

function conferirCronograma(cronograma: CronogramaConferido): readonly string[] {
  const { fases, etapas, exigencias, catalogos } = cronograma;
  return [
    ...problemasDePosicaoDasFases(fases),
    ...fases.flatMap((fase) => problemasDaFaseDoCronograma(fase, catalogos)),
    ...problemasDasEtapas(fases, etapas, catalogos.fasePorId, catalogos.tipoDaEtapa),
    ...problemasDasJanelasDasEtapas(fases, etapas, catalogos.fasePorId),
    ...problemasDasExigencias(exigencias),
    ...violacoesDePrecedencia(fases, catalogos.precedencias).map(textoDaViolacao),
  ];
}

function problemasDePosicaoDasFases(fases: readonly FaseDoCronograma[]): readonly string[] {
  const problemas: string[] = [];
  if (repetidos(fases.map((fase) => fase.faseCanonicaId)).length > 0) {
    problemas.push('Cada fase canônica entra uma vez só no cronograma.');
  }
  if (repetidos(fases.map((fase) => fase.ordem)).length > 0) {
    problemas.push('Duas fases não podem ocupar a mesma posição na linha do tempo.');
  }
  return problemas;
}

/** A resolução da tela usa os atributos congelados antes do catálogo. */
function problemasDaFaseDoCronograma(
  fase: FaseDoCronograma,
  catalogos: CatalogosDaConferencia,
): readonly string[] {
  const { nome, exigencias } = descreverFase(fase, catalogos.fasePorId);
  if (exigencias === null) return [];
  const declarados = problemasDeclaradosDaFase(fase, catalogos, nome);
  return [...problemasDaJanelaDaFase(fase, nome, exigencias), ...declarados];
}

/** Confere as declarações que o passo carrega e a gravação substitui por inteiro. */
function problemasDeclaradosDaFase(
  fase: FaseDoCronograma,
  catalogos: CatalogosDaConferencia,
  nome: string,
): readonly string[] {
  return problemasDaFase(fase, catalogos.atoPorCodigo, catalogos.edicoesDoEnem).map(
    (declarado) => `Na fase ${nome}: ${declarado.mensagem} Corrija em Configuração por fase.`,
  );
}

/**
 * O que falta do período que o tipo de fase exige. O Fim da fase que não publica resultado
 * definitivo só é exigido na publicação do processo, e por isso não impede gravar o rascunho.
 */
function periodoQueFalta(
  fase: FaseDoCronograma,
  { janelaObrigatoria, fimObrigatorio }: ExigenciasDaFase,
): readonly string[] {
  if (!janelaObrigatoria) return [];
  return [
    ...(fase.inicio === null ? ['início'] : []),
    ...(fase.fim === null && !fimObrigatorio ? ['fim'] : []),
  ];
}

function problemasDaJanelaDaFase(
  fase: FaseDoCronograma,
  nome: string,
  exigencias: ExigenciasDaFase,
): readonly string[] {
  const problemas: string[] = [];
  const faltando = periodoQueFalta(fase, exigencias);
  if (faltando.length > 0) {
    problemas.push(`A fase ${nome} precisa de data e hora de ${faltando.join(' e de ')}.`);
  }
  if (fase.inicio !== null && fase.fim !== null && Date.parse(fase.fim) < Date.parse(fase.inicio)) {
    problemas.push(`Na fase ${nome}, o fim não pode vir antes do início.`);
  }
  return problemas;
}

function textoDaViolacao(violacao: ViolacaoDePrecedencia): string {
  return violacao.motivo === 'ordem'
    ? `${violacao.antecessora} precisa vir antes de ${violacao.sucessora} na linha do tempo.`
    : `${violacao.antecessora} não pode se sobrepor a ${violacao.sucessora}: o cadastro exige que uma termine antes da outra começar.`;
}

/**
 * A janela própria da etapa: coerente consigo mesma, e cabendo na janela da fase.
 *
 * A etapa não precisa declarar datas — em branco ela acontece na janela da fase, e é isso que a
 * dica do campo promete ao operador. Declarada, a janela da etapa é um REFINAMENTO da janela da
 * fase: a prova e a entrevista caem em dias diferentes, mas ambas dentro da avaliação. Uma etapa
 * que começasse antes da fase ou terminasse depois dela desmentiria o cronograma que o edital
 * publica.
 *
 * As bordas coincidentes passam: a etapa pode começar no instante em que a fase começa e
 * terminar no instante em que ela termina — refinar não obriga a encolher.
 *
 * Fase sem janela declarada não é conferida: não há o que conter, e exigir data da fase por
 * causa da etapa inventaria uma obrigação que o cadastro não faz. A etapa nesse caso responde
 * só pela própria coerência.
 *
 * <b>Esta regra vive só aqui, no cliente.</b> `EtapaProcesso` não valida datas, então um
 * chamador que vá direto à API ainda consegue gravar etapa fora da janela — decisão consciente
 * de escopo, registrada como pendência.
 */
function problemasDasJanelasDasEtapas(
  fases: readonly FaseDoCronograma[],
  etapas: readonly EtapaPontuada[],
  fasePorId: ReadonlyMap<string, FaseCanonicaDto>,
): readonly string[] {
  const faseDoCodigo = new Map(fases.map((fase) => [fase.codigo, fase]));

  return etapas.flatMap((etapa) =>
    problemasDaJanelaDaEtapa(etapa, faseDoCodigo.get(etapa.faseCodigo), fasePorId),
  );
}

/** Os dois extremos de uma janela em instantes; `null` onde o campo está em branco. */
interface JanelaEmInstantes {
  readonly inicio: number | null;
  readonly fim: number | null;
}

function emInstantes(inicio: string | null, fim: string | null): JanelaEmInstantes {
  return {
    inicio: inicio === null || inicio === '' ? null : instanteDe(inicio),
    fim: fim === null || fim === '' ? null : instanteDe(fim),
  };
}

function problemasDaJanelaDaEtapa(
  etapa: EtapaPontuada,
  fase: FaseDoCronograma | undefined,
  fasePorId: ReadonlyMap<string, FaseCanonicaDto>,
): readonly string[] {
  const janela = emInstantes(etapa.inicio, etapa.fim);
  if (janela.inicio === null && janela.fim === null) return [];
  const nome = etapa.nome.trim() === '' ? 'sem nome' : `"${etapa.nome.trim()}"`;
  if (janela.inicio !== null && janela.fim !== null && janela.fim < janela.inicio) {
    return [`Na etapa ${nome}, o fim não pode vir antes do início.`];
  }
  if (fase === undefined) return [];
  return problemasDeJanelaForaDaFase(nome, janela, fase, fasePorId);
}

function problemasDeJanelaForaDaFase(
  nomeDaEtapa: string,
  etapa: JanelaEmInstantes,
  faseDoCronograma: FaseDoCronograma,
  fasePorId: ReadonlyMap<string, FaseCanonicaDto>,
): readonly string[] {
  const fase = emInstantes(faseDoCronograma.inicio, faseDoCronograma.fim);
  const nomeDaFase = descreverFase(faseDoCronograma, fasePorId).nome;
  return problemasDosLimitesDaJanela(nomeDaEtapa, etapa, fase, nomeDaFase);
}

const JANELA_DEVE_CABER = 'A janela da etapa precisa caber na da fase.';

function problemasDosLimitesDaJanela(
  nomeDaEtapa: string,
  etapa: JanelaEmInstantes,
  fase: JanelaEmInstantes,
  nomeDaFase: string,
): readonly string[] {
  return [
    ...problemasDoInicioDaEtapa(nomeDaEtapa, etapa, fase, nomeDaFase),
    ...problemasDoFimDaEtapa(nomeDaEtapa, etapa, fase, nomeDaFase),
  ];
}

function problemasDoInicioDaEtapa(
  nomeDaEtapa: string,
  etapa: JanelaEmInstantes,
  fase: JanelaEmInstantes,
  nomeDaFase: string,
): readonly string[] {
  if (etapa.inicio !== null && fase.inicio !== null && etapa.inicio < fase.inicio) {
    return [`A etapa ${nomeDaEtapa} começa antes da fase ${nomeDaFase}. ${JANELA_DEVE_CABER}`];
  }
  return [];
}

function problemasDoFimDaEtapa(
  nomeDaEtapa: string,
  etapa: JanelaEmInstantes,
  fase: JanelaEmInstantes,
  nomeDaFase: string,
): readonly string[] {
  if (etapa.fim !== null && fase.fim !== null && etapa.fim > fase.fim) {
    return [`A etapa ${nomeDaEtapa} termina depois da fase ${nomeDaFase}. ${JANELA_DEVE_CABER}`];
  }
  return [];
}
