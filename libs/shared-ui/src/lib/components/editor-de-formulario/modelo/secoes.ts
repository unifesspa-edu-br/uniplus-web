import { conferirOrdem } from './conferencia-de-ordem';
import { BLOCO_REVISAO_E_ACEITE, SECAO_DADOS_BASICOS, etapaNova } from './constantes';
import { TrocaComAVizinha, entradasDaSecao, etapasEmOrdem, renumerar } from './ordem-das-entradas';
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
  return acrescentarEtapaAntesDaRevisao(conteudo, etapaNova(codigoDaSecaoNova(conteudo), titulo));
}

function codigoDaSecaoNova(conteudo: ConteudoDoFormulario): string {
  const codigos = new Set((conteudo.etapas ?? []).map((etapa) => etapa.codigo));
  let numero = 1;
  while (codigos.has(`SECAO_${numero}`)) numero++;
  return `SECAO_${numero}`;
}

/** Um bloco do sistema, logo antes da revisão e aceite. O código do bloco é o próprio token. */
export function acrescentarBloco(
  conteudo: ConteudoDoFormulario,
  bloco: OpcaoDoFormulario,
): ConteudoDoFormulario {
  return acrescentarEtapaAntesDaRevisao(
    conteudo,
    etapaNova(bloco.valor, bloco.rotulo, bloco.valor),
  );
}

/** Se a etapa fica onde está: os dados básicos abrem o formulário, e a revisão e aceite o fecha. */
export function etapaFixa(etapa: Pick<EtapaDoFormulario, 'codigo' | 'bloco'>): boolean {
  return etapa.codigo === SECAO_DADOS_BASICOS || etapa.bloco === BLOCO_REVISAO_E_ACEITE;
}

/** A etapa e a vizinha na direção dada, se as duas podem trocar de lugar. */
function etapaEVizinha(
  conteudo: ConteudoDoFormulario,
  codigo: string,
  direcao: -1 | 1,
): TrocaComAVizinha<EtapaDoFormulario> | null {
  const etapas = etapasEmOrdem(conteudo);
  const indice = etapas.findIndex((etapa) => etapa.codigo === codigo);
  const atual = etapas[indice];
  const vizinha = etapas[indice + direcao];
  if (atual === undefined || vizinha === undefined) return null;
  return etapaFixa(atual) || etapaFixa(vizinha) ? null : { atual, vizinha };
}

/** Se a etapa pode trocar de lugar com a vizinha na direção dada. */
export function podeMoverEtapa(
  conteudo: ConteudoDoFormulario,
  codigo: string,
  direcao: -1 | 1,
): boolean {
  return etapaEVizinha(conteudo, codigo, direcao) !== null;
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
  const troca = etapaEVizinha(conteudo, codigo, direcao);
  if (troca === null) return { ok: false, recusa: 'Não há para onde mover nessa direção.' };
  return conferirOrdem(comEtapasTrocadas(conteudo, troca), nomes);
}

function comEtapasTrocadas(
  conteudo: ConteudoDoFormulario,
  { atual, vizinha }: TrocaComAVizinha<EtapaDoFormulario>,
): ConteudoDoFormulario {
  const ordemTrocada = (etapa: EtapaDoFormulario): EtapaDoFormulario => {
    if (etapa.codigo === atual.codigo) return { ...etapa, ordem: vizinha.ordem };
    return etapa.codigo === vizinha.codigo ? { ...etapa, ordem: atual.ordem } : etapa;
  };
  return renumerar({ ...conteudo, etapas: (conteudo.etapas ?? []).map(ordemTrocada) });
}

/** Remove a etapa. A seção com itens não sai: os itens ficariam sem seção. */
export function removerEtapa(conteudo: ConteudoDoFormulario, codigo: string): ResultadoDaEdicao {
  const recusa = recusaDaRemocaoDaEtapa(conteudo, codigo);
  if (recusa !== null) return { ok: false, recusa };
  return {
    ok: true,
    conteudo: renumerar({
      ...conteudo,
      etapas: (conteudo.etapas ?? []).filter((e) => e.codigo !== codigo),
    }),
  };
}

function recusaDaRemocaoDaEtapa(conteudo: ConteudoDoFormulario, codigo: string): string | null {
  const etapa = (conteudo.etapas ?? []).find((e) => e.codigo === codigo);
  if (etapa === undefined || etapaFixa(etapa))
    return 'Esta parte do formulário não pode ser removida.';
  if (entradasDaSecao(conteudo, codigo).length === 0) return null;
  return `Remova ou mova os campos de “${etapa.apresentacao.titulo}” antes de remover a seção.`;
}

function acrescentarEtapaAntesDaRevisao(
  conteudo: ConteudoDoFormulario,
  nova: EtapaDoFormulario,
): ConteudoDoFormulario {
  const revisao = (conteudo.etapas ?? []).find((etapa) => etapa.bloco === BLOCO_REVISAO_E_ACEITE);
  const ordem = revisao === undefined ? Number.MAX_SAFE_INTEGER : revisao.ordem - 0.5;
  return renumerar({ ...conteudo, etapas: [...(conteudo.etapas ?? []), { ...nova, ordem }] });
}
