import { conferirOrdem } from './conferencia-de-ordem';
import { BLOCO_REVISAO_E_ACEITE, SECAO_DADOS_BASICOS, TIPO_BLOCO, TIPO_SECAO } from './constantes';
import { entradasDaSecao, etapasEmOrdem, renumerar } from './ordem-das-entradas';
import {
  ConteudoDoFormulario,
  EtapaDoFormulario,
  OpcaoDoFormulario,
  ResultadoDaEdicao,
} from './tipos';

/** Troca a etapa pela editada, sem mexer na ordem. */
export function comEtapa(
  conteudo: ConteudoDoFormulario,
  editada: EtapaDoFormulario,
): ConteudoDoFormulario {
  return {
    ...conteudo,
    etapas: (conteudo.etapas ?? []).map((etapa) =>
      etapa.codigo === editada.codigo ? editada : etapa,
    ),
  };
}

/** Uma seção nova, vazia, logo antes da revisão e aceite — que é sempre a última etapa. */
export function acrescentarSecao(
  conteudo: ConteudoDoFormulario,
  titulo: string,
): ConteudoDoFormulario {
  const codigos = new Set((conteudo.etapas ?? []).map((etapa) => etapa.codigo));
  let numero = 1;
  while (codigos.has(`SECAO_${numero}`)) numero++;
  return acrescentarEtapaAntesDaRevisao(conteudo, {
    codigo: `SECAO_${numero}`,
    ordem: 0,
    tipo: TIPO_SECAO,
    bloco: null,
    titulo,
    descricao: null,
    aviso: null,
    exibicao: null,
  });
}

/** Um bloco do sistema, logo antes da revisão e aceite. O código do bloco é o próprio token. */
export function acrescentarBloco(
  conteudo: ConteudoDoFormulario,
  bloco: OpcaoDoFormulario,
): ConteudoDoFormulario {
  return acrescentarEtapaAntesDaRevisao(conteudo, {
    codigo: bloco.valor,
    ordem: 0,
    tipo: TIPO_BLOCO,
    bloco: bloco.valor,
    titulo: bloco.rotulo,
    descricao: null,
    aviso: null,
    exibicao: null,
  });
}

/** Se a etapa fica onde está: os dados básicos abrem o formulário, e a revisão e aceite o fecha. */
export function etapaFixa(etapa: Pick<EtapaDoFormulario, 'codigo' | 'bloco'>): boolean {
  return etapa.codigo === SECAO_DADOS_BASICOS || etapa.bloco === BLOCO_REVISAO_E_ACEITE;
}

/** Se a etapa pode trocar de lugar com a vizinha na direção dada. */
export function podeMoverEtapa(
  conteudo: ConteudoDoFormulario,
  codigo: string,
  direcao: -1 | 1,
): boolean {
  const etapas = etapasEmOrdem(conteudo);
  const indice = etapas.findIndex((etapa) => etapa.codigo === codigo);
  const vizinha = etapas[indice + direcao];
  return indice >= 0 && vizinha !== undefined && !etapaFixa(etapas[indice]) && !etapaFixa(vizinha);
}

/**
 * Troca a etapa de lugar com a vizinha, levando os itens dela junto. Recusa o movimento que põe
 * um item antes de um fato que ele cita.
 */
export function moverEtapa(
  conteudo: ConteudoDoFormulario,
  codigo: string,
  direcao: -1 | 1,
  nomes: ReadonlyMap<string, string>,
): ResultadoDaEdicao {
  if (!podeMoverEtapa(conteudo, codigo, direcao))
    return { ok: false, recusa: 'Não há para onde mover nessa direção.' };
  const etapas = etapasEmOrdem(conteudo);
  const indice = etapas.findIndex((etapa) => etapa.codigo === codigo);
  const atual = etapas[indice];
  const vizinha = etapas[indice + direcao];
  const trocado = renumerar({
    ...conteudo,
    etapas: (conteudo.etapas ?? []).map((etapa) =>
      etapa.codigo === atual.codigo
        ? { ...etapa, ordem: vizinha.ordem }
        : etapa.codigo === vizinha.codigo
          ? { ...etapa, ordem: atual.ordem }
          : etapa,
    ),
  });
  return conferirOrdem(trocado, nomes);
}

/** Remove a etapa. A seção com itens não sai: os itens ficariam sem seção. */
export function removerEtapa(conteudo: ConteudoDoFormulario, codigo: string): ResultadoDaEdicao {
  const etapa = (conteudo.etapas ?? []).find((e) => e.codigo === codigo);
  if (etapa === undefined || etapaFixa(etapa))
    return { ok: false, recusa: 'Esta parte do formulário não pode ser removida.' };
  if (entradasDaSecao(conteudo, codigo).length > 0) {
    return {
      ok: false,
      recusa: `Remova ou mova os campos de “${etapa.titulo}” antes de remover a seção.`,
    };
  }
  return {
    ok: true,
    conteudo: renumerar({
      ...conteudo,
      etapas: (conteudo.etapas ?? []).filter((e) => e.codigo !== codigo),
    }),
  };
}

function acrescentarEtapaAntesDaRevisao(
  conteudo: ConteudoDoFormulario,
  nova: EtapaDoFormulario,
): ConteudoDoFormulario {
  const revisao = (conteudo.etapas ?? []).find((etapa) => etapa.bloco === BLOCO_REVISAO_E_ACEITE);
  const ordem = revisao === undefined ? Number.MAX_SAFE_INTEGER : revisao.ordem - 0.5;
  return renumerar({ ...conteudo, etapas: [...(conteudo.etapas ?? []), { ...nova, ordem }] });
}
