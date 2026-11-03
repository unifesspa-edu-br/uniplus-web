import type { FaseCanonicaDto, PrecedenciaFaseDto } from '@uniplus/shared-data/configuracao';

import type { EtapaPontuada, FaseDoCronograma } from '../../processo-seletivo.models';
import { descreverFase } from '../../shared/descricao-da-fase';
import { problemasDaFase, type AtoDoCatalogo } from '../fase/configuracao-da-fase';
import {
  problemasDasExigencias,
  type ExigenciaDeclarada,
} from './conferencia-das-exigencias-declaradas';
import { problemasDasEtapas } from './problemas-das-etapas';
import { instanteDe, violacoesDePrecedencia } from './precedencia-de-fases';
import { repetidos } from './repetidos';
import type { TipoDeEtapaDoCatalogo } from './regras-da-etapa';

/**
 * O que impede a gravação, na ordem em que quem preenche resolve: primeiro o
 * que falta declarar, depois o que está incoerente entre si.
 *
 * Só entra aqui o que a tela consegue afirmar com o que tem em mãos. Teto de
 * vagas, vigência de ato e unicidade de código no servidor continuam sendo dele
 * — repetir a conferência aqui daria duas fontes para a mesma regra, e a que
 * ficasse desatualizada recusaria o que o servidor aceita.
 */
export function problemasDoCronograma(
  fases: readonly FaseDoCronograma[],
  etapas: readonly EtapaPontuada[],
  fasePorId: ReadonlyMap<string, FaseCanonicaDto>,
  precedencias: readonly PrecedenciaFaseDto[],
  atoPorCodigo: ReadonlyMap<string, AtoDoCatalogo>,
  nomeDaBanca: (tipoBancaId: string) => string,
  tipoDaEtapa: (tipoEtapaOrigemId: string) => TipoDeEtapaDoCatalogo | undefined,
  exigencias: readonly ExigenciaDeclarada[],
): readonly string[] {
  const problemas: string[] = [];

  if (fases.length === 0) {
    problemas.push('O cronograma precisa de ao menos uma fase.');
    return problemas;
  }

  const codigosRepetidos = repetidos(fases.map((fase) => fase.faseCanonicaId));
  if (codigosRepetidos.length > 0) {
    problemas.push('Cada fase canônica entra uma vez só no cronograma.');
  }

  if (repetidos(fases.map((fase) => fase.ordem)).length > 0) {
    problemas.push('Duas fases não podem ocupar a mesma posição na linha do tempo.');
  }

  for (const fase of fases) {
    // A mesma resolução que a tela usa: o que a fase congelou vale sobre o
    // catálogo, e a fase cuja entrada saiu continua sendo conferida pelo que
    // ela guarda. Consultar o catálogo direto aqui deixaria de conferir
    // justamente a fase que ninguém mais confere.
    const { nome, exigencias } = descreverFase(fase, fasePorId);
    if (exigencias === null) continue;

    if (exigencias.janelaObrigatoria && (fase.inicio === null || fase.fim === null)) {
      problemas.push(`A fase ${nome} precisa de data e hora de início e de fim.`);
    }

    if (
      fase.inicio !== null &&
      fase.fim !== null &&
      Date.parse(fase.fim) < Date.parse(fase.inicio)
    ) {
      problemas.push(`Na fase ${nome}, o fim não pode vir antes do início.`);
    }

    // O que a fase declara não é editado aqui, mas atravessa este passo até a
    // gravação — e a gravação substitui a coleção inteira. Sem conferir, uma
    // publicação sem ato, uma banca sem tipo ou um recurso pela metade sairiam
    // no comando por causa de uma mudança de data, e a recusa voltaria falando
    // de um campo que este passo não mostra. Quem confere é a mesma função que
    // a superfície da fase usa: duplicar a regra aqui é o que já produziu um
    // defeito nesta frente.
    for (const declarado of problemasDaFase(fase, fases, atoPorCodigo, nomeDaBanca)) {
      problemas.push(`Na fase ${nome}: ${declarado.mensagem} Corrija em Configuração por fase.`);
    }
  }

  problemas.push(...problemasDasEtapas(fases, etapas, fasePorId, tipoDaEtapa));
  problemas.push(...problemasDasJanelasDasEtapas(fases, etapas, fasePorId));
  problemas.push(...problemasDasExigencias(exigencias));

  for (const violacao of violacoesDePrecedencia(fases, precedencias)) {
    problemas.push(
      violacao.motivo === 'ordem'
        ? `${violacao.antecessora} precisa vir antes de ${violacao.sucessora} na linha do tempo.`
        : `${violacao.antecessora} não pode se sobrepor a ${violacao.sucessora}: o cadastro exige que uma termine antes da outra começar.`,
    );
  }

  return problemas;
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
  const problemas: string[] = [];
  const faseDoCodigo = new Map(fases.map((fase) => [fase.codigo, fase]));

  for (const etapa of etapas) {
    const inicio = etapa.inicio === '' ? null : instanteDe(etapa.inicio);
    const fim = etapa.fim === '' ? null : instanteDe(etapa.fim);
    if (inicio === null && fim === null) continue;

    const nome = etapa.nome.trim() === '' ? 'sem nome' : `"${etapa.nome.trim()}"`;

    if (inicio !== null && fim !== null && fim < inicio) {
      problemas.push(`Na etapa ${nome}, o fim não pode vir antes do início.`);
      // Sem coerência interna, comparar com a fase só somaria ruído ao mesmo defeito.
      continue;
    }

    const fase = faseDoCodigo.get(etapa.faseCodigo);
    if (fase === undefined) continue;

    const nomeDaFase = descreverFase(fase, fasePorId).nome;
    const faseInicio = fase.inicio === null ? null : instanteDe(fase.inicio);
    const faseFim = fase.fim === null ? null : instanteDe(fase.fim);

    if (inicio !== null && faseInicio !== null && inicio < faseInicio) {
      problemas.push(
        `A etapa ${nome} começa antes da fase ${nomeDaFase}. A janela da etapa precisa caber na da fase.`,
      );
    }

    if (fim !== null && faseFim !== null && fim > faseFim) {
      problemas.push(
        `A etapa ${nome} termina depois da fase ${nomeDaFase}. A janela da etapa precisa caber na da fase.`,
      );
    }
  }

  return problemas;
}
