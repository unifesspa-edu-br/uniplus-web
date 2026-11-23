import type { ExigenciaDeDocumento } from '../../../processo-seletivo.models';
import type { RepeticaoDaExigencia } from '../../../shared/exigencias/consulta-das-exigencias';
import {
  motivoDoGrupoForaDoLugar,
  orientacaoDaRecusaDaRepeticao,
  type NomesDaOrientacao,
} from '../../../shared/orientacao-da-recusa-do-fato';
import { recusaDaRepeticao, type ProducaoDosFatos } from '../../../shared/producao-dos-fatos';
import type { RepeticaoDoDocumento } from '../tipos-da-conferencia';

export function repeticaoDoDocumentoNaFase(
  exigencia: ExigenciaDeDocumento,
  atual: RepeticaoDaExigencia | null,
  producao: ProducaoDosFatos,
  nomes: NomesDaOrientacao,
): RepeticaoDoDocumento {
  return {
    atual,
    rotulo: atual === null ? '' : (producao.grupos.get(atual.grupo)?.rotulo ?? atual.grupo),
    semGrupo: producao.grupos.size === 0,
    ...gruposParaRepeticao(exigencia, producao, nomes),
    erro: erroDaRepeticao(atual, exigencia, producao, nomes),
  };
}

function gruposParaRepeticao(
  exigencia: ExigenciaDeDocumento,
  producao: ProducaoDosFatos,
  nomes: NomesDaOrientacao,
): Pick<RepeticaoDoDocumento, 'oferecidos' | 'naoOferecidos'> {
  const avaliados = [...producao.grupos.values()].map(
    (grupo) => [grupo, recusaDaRepeticao(grupo.codigo, exigencia, producao)] as const,
  );
  return {
    oferecidos: avaliados.filter(([, recusa]) => recusa === null).map(([grupo]) => grupo),
    naoOferecidos: avaliados.flatMap(([, recusa]) =>
      recusa?.tipo === 'GRUPO_FORA_DO_LUGAR' ? [motivoDoGrupoForaDoLugar(recusa, nomes)] : [],
    ),
  };
}

function erroDaRepeticao(
  atual: RepeticaoDaExigencia | null,
  exigencia: ExigenciaDeDocumento,
  producao: ProducaoDosFatos,
  nomes: NomesDaOrientacao,
): string | null {
  if (atual === null) return null;
  const recusa = recusaDaRepeticao(atual.grupo, exigencia, producao);
  return recusa === null
    ? null
    : orientacaoDaRecusaDaRepeticao(recusa, producao, nomes, atual.herdada);
}
