import type { ColunaDoQuadro } from '../../shared/quadro-de-pesos';
import type { CriterioDesempateConfigurado, WizardDraft } from '../../processo-seletivo.models';
import type { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import type { LeituraDoCadastro } from '../classificacao/leitura-do-cadastro-de-pesos.service';
import { desempateUsaAreas } from './desempate-para-comando';
import { areasForaDoQuadro, rotulosDasAreas, situacaoDoQuadro } from './situacao-do-quadro';

/**
 * O que a gravação da classificação do rascunho deixaria sem nota de área num critério de
 * desempate gravado: o quadro inteiro — o que é certo, pelo próprio rascunho —, ou as áreas, pelo
 * rótulo, que o cadastro lido não tem em todos os grupos — o que depende de o cadastro lido ser o
 * que o servidor tem.
 */
export interface PendenciaDoCriterioGravado {
  readonly posicao: number;
  readonly semQuadro: boolean;
  readonly fora: readonly string[];
  /** Nenhuma área do critério sobra: retirá-las deixaria o critério vazio. */
  readonly todas: boolean;
}

/**
 * A conferência do desempate gravado contra a classificação do rascunho. `nao-conferivel` quando
 * falta o que conferir — a resolução, ou o cadastro dela lido —, o que não é o mesmo que não haver
 * pendência.
 */
export type ConferenciaDoDesempateGravado =
  | { readonly resultado: 'sem-pendencia' }
  | {
      readonly resultado: 'com-pendencias';
      readonly pendencias: readonly PendenciaDoCriterioGravado[];
    }
  | { readonly resultado: 'nao-conferivel' };

export function conferirDesempateGravado(
  criterios: readonly CriterioDesempateConfigurado[],
  classificacao: WizardDraft['classificacao'],
  cadastro: LeituraDoCadastro,
): ConferenciaDoDesempateGravado {
  const porArea = criterios
    .map((criterio, indice) => ({ criterio, posicao: indice + 1 }))
    .filter(({ criterio }) => desempateUsaAreas(criterio.regraCodigo));
  if (porArea.length === 0) return { resultado: 'sem-pendencia' };

  const situacao = situacaoDoQuadro(classificacao, { estado: 'nunca-gravada' }, cadastro);
  if (situacao.tipo === 'sem-quadro') {
    return comPendencias(
      porArea.map(({ posicao }) => ({ posicao, semQuadro: true, fora: [], todas: true })),
    );
  }
  if (situacao.tipo !== 'lido' && situacao.tipo !== 'sem-area-em-todos-os-grupos') {
    return { resultado: 'nao-conferivel' };
  }

  const aceitas = situacao.tipo === 'lido' ? situacao.aceitas : [];
  const rotulos = rotulosDasAreas(cadastro.canonicas, situacao.grupos);
  return comPendencias(
    porArea.flatMap(({ criterio, posicao }) =>
      pendenciaForaDoQuadro(criterio, posicao, aceitas, rotulos),
    ),
  );
}

function comPendencias(
  pendencias: readonly PendenciaDoCriterioGravado[],
): ConferenciaDoDesempateGravado {
  return pendencias.length === 0
    ? { resultado: 'sem-pendencia' }
    : { resultado: 'com-pendencias', pendencias };
}

/** As áreas do critério que o quadro não aceita, pelo rótulo; nenhuma pendência quando todas cabem. */
function pendenciaForaDoQuadro(
  criterio: CriterioDesempateConfigurado,
  posicao: number,
  aceitas: readonly ColunaDoQuadro[],
  rotulos: ReadonlyMap<string, string>,
): PendenciaDoCriterioGravado[] {
  const fora = areasForaDoQuadro(criterio.areas, aceitas);
  if (fora.length === 0) return [];
  return [
    {
      posicao,
      semQuadro: false,
      fora: fora.map((codigo) => rotulos.get(codigo) ?? codigo),
      todas: fora.length === criterio.areas.length,
    },
  ];
}

/**
 * Tira a recusa da classificação por um critério de desempate gravado quando ela acabou: os
 * critérios gravados, conferidos contra o rascunho da classificação, já não têm pendência. Com os
 * mesmos critérios que o servidor julgou, só um cadastro pedido depois da recusa pode mostrar
 * isso, porque o servidor julgou pelo cadastro dele; critérios regravados, ou nenhum por área,
 * são outro julgamento. Com os critérios gravados desconhecidos, ou sem ter como conferir, ela
 * fica.
 */
export function reavaliarRecusaPeloDesempate(
  store: ProcessoSeletivoStore,
  cadastro: LeituraDoCadastro,
): void {
  const gravados = store.classificacao.criteriosDesempateGravados();
  if (store.classificacao.recusaPeloDesempatePorArea() === null || gravados === null) return;
  const semCriterioPorArea = !gravados.some((criterio) => desempateUsaAreas(criterio.regraCodigo));
  const criteriosMudaram =
    JSON.stringify(gravados) !==
    JSON.stringify(store.classificacao.criteriosNaRecusaPeloDesempate());
  const cadastroRelido =
    cadastro.lido &&
    cadastro.leitura > store.classificacao.leituraDoCadastroNaRecusaPeloDesempate();
  if (!semCriterioPorArea && !criteriosMudaram && !cadastroRelido) return;
  const conferencia = conferirDesempateGravado(gravados, store.draft().classificacao, cadastro);
  if (conferencia.resultado === 'sem-pendencia')
    store.classificacao.recusaPeloDesempatePorArea.set(null);
}
