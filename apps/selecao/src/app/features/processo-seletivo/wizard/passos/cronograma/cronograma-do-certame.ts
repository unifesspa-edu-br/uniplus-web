import type { FaseCanonicaDto, PrecedenciaFaseDto } from '@uniplus/shared-data/configuracao';

import type { EtapaPontuada, FaseDoCronograma } from '../../processo-seletivo.models';
import { descreverFase } from '../../shared/descricao-da-fase';
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

/** Os catálogos que a conferência do cronograma consulta. */
export interface CatalogosDaConferencia {
  readonly fasePorId: ReadonlyMap<string, FaseCanonicaDto>;
  readonly precedencias: readonly PrecedenciaFaseDto[];
  readonly atoPorCodigo: ReadonlyMap<string, AtoDoCatalogo>;
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

  return [
    ...problemasDePosicaoDasFases(fases),
    ...fases.flatMap((fase) => problemasDaFaseDoCronograma(fase, fases, catalogos)),
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

function problemasDaFaseDoCronograma(
  fase: FaseDoCronograma,
  fases: readonly FaseDoCronograma[],
  catalogos: CatalogosDaConferencia,
): readonly string[] {
  // A mesma resolução que a tela usa: o que a fase congelou vale sobre o
  // catálogo, e a fase cuja entrada saiu continua sendo conferida pelo que
  // ela guarda. Consultar o catálogo direto aqui deixaria de conferir
  // justamente a fase que ninguém mais confere.
  const { nome, exigencias } = descreverFase(fase, catalogos.fasePorId);
  if (exigencias === null) return [];

  // O que a fase declara não é editado aqui, mas atravessa este passo até a
  // gravação — e a gravação substitui a coleção inteira. Sem conferir, uma
  // publicação sem ato, uma banca sem tipo ou um recurso pela metade sairiam
  // no comando por causa de uma mudança de data, e a recusa voltaria falando
  // de um campo que este passo não mostra. Quem confere é a mesma função que
  // a superfície da fase usa: duplicar a regra aqui produziria regras divergentes.
  const declarados = problemasDaFase(
    fase,
    fases,
    catalogos.atoPorCodigo,
    catalogos.nomeDaBanca,
  ).map((declarado) => `Na fase ${nome}: ${declarado.mensagem} Corrija em Configuração por fase.`);

  return [...problemasDaJanelaDaFase(fase, nome, exigencias.janelaObrigatoria), ...declarados];
}

function problemasDaJanelaDaFase(
  fase: FaseDoCronograma,
  nome: string,
  janelaObrigatoria: boolean,
): readonly string[] {
  const problemas: string[] = [];
  if (janelaObrigatoria && (fase.inicio === null || fase.fim === null)) {
    problemas.push(`A fase ${nome} precisa de data e hora de início e de fim.`);
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
    // Sem coerência interna, comparar com a fase só somaria ruído ao mesmo defeito.
    return [`Na etapa ${nome}, o fim não pode vir antes do início.`];
  }

  if (fase === undefined) return [];

  return problemasDeJanelaForaDaFase(
    nome,
    janela,
    emInstantes(fase.inicio, fase.fim),
    descreverFase(fase, fasePorId).nome,
  );
}

function problemasDeJanelaForaDaFase(
  nomeDaEtapa: string,
  etapa: JanelaEmInstantes,
  fase: JanelaEmInstantes,
  nomeDaFase: string,
): readonly string[] {
  const problemas: string[] = [];
  const caber = 'A janela da etapa precisa caber na da fase.';

  if (etapa.inicio !== null && fase.inicio !== null && etapa.inicio < fase.inicio) {
    problemas.push(`A etapa ${nomeDaEtapa} começa antes da fase ${nomeDaFase}. ${caber}`);
  }
  if (etapa.fim !== null && fase.fim !== null && etapa.fim > fase.fim) {
    problemas.push(`A etapa ${nomeDaEtapa} termina depois da fase ${nomeDaFase}. ${caber}`);
  }
  return problemas;
}
