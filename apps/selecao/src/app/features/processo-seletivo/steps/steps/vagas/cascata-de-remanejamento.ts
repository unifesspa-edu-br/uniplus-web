import {
  DefinirCascataRemanejamentoRequest,
  DestinoRemanejamentoInput,
} from '@uniplus/shared-data/selecao';

import { CascataSelecionada, DistribuicaoDeVagas } from '../../processo-seletivo.models';
import { ehRamoFederal, ModalidadeDoCatalogo } from './distribuicao-de-vagas';

/** Vocabulário fechado que a API devolve para a modalidade: ela segue a cascata única do processo. */
const SEGUE_CASCATA = 'SEGUE_CASCATA';

/**
 * Uma origem da matriz que a regra congelou: a modalidade de onde a vaga sai e
 * a ordem de preferência dos destinos. `destinos` já vem na ordem em que a
 * regra os declara — é a ordem que o comando envia como `ordem` 1-based.
 */
export interface OrdemDaMatriz {
  readonly origem: string;
  readonly destinos: readonly string[];
}

/**
 * A cascata como a regra do catálogo a congela — o que `RegraCatalogoDto.esquemaArgs`
 * expõe para `criterio_remanejamento`, na forma que a tela consome.
 *
 * A tela nunca monta isto: ela só lê o que a regra já declarou e apresenta.
 */
export interface MatrizDaRegra {
  readonly fallbackCodigo: string;
  readonly ordens: readonly OrdemDaMatriz[];
}

/**
 * Lê o `esquemaArgs` da regra de remanejamento — shape `{"fallbackCodigo":
 * "AC", "ordens": [{"origem": "...", "destinos": ["...", ...]}]}` — devolvendo
 * `null` quando não bate com o esperado.
 *
 * `esquemaArgs` chega como `unknown` (é `JsonElement` no contrato): a tela não
 * confia na forma sem checar, porque um catálogo com outra regra do mesmo tipo
 * poderia declarar um esquema diferente no futuro. `null` aqui vira "regra sem
 * matriz reconhecida" na tela, nunca uma matriz inventada.
 */
export function matrizDaRegra(esquemaArgs: unknown): MatrizDaRegra | null {
  if (typeof esquemaArgs !== 'object' || esquemaArgs === null) return null;

  const bruto = esquemaArgs as Record<string, unknown>;
  const fallbackCodigo = bruto['fallbackCodigo'];
  const ordensBrutas = bruto['ordens'];
  if (typeof fallbackCodigo !== 'string' || !Array.isArray(ordensBrutas)) return null;

  const ordens: OrdemDaMatriz[] = [];
  for (const itemBruto of ordensBrutas) {
    if (typeof itemBruto !== 'object' || itemBruto === null) return null;
    const item = itemBruto as Record<string, unknown>;
    const origem = item['origem'];
    const destinosBrutos = item['destinos'];
    if (typeof origem !== 'string' || !Array.isArray(destinosBrutos)) return null;
    if (!destinosBrutos.every((destino): destino is string => typeof destino === 'string')) {
      return null;
    }
    ordens.push({ origem, destinos: destinosBrutos });
  }

  return { fallbackCodigo, ordens };
}

/** A modalidade segue a cascata única do processo — vocabulário fechado do catálogo. */
function segueCascata(modalidadeId: string, catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>): boolean {
  return catalogo.get(modalidadeId)?.regraRemanejamento === SEGUE_CASCATA;
}

/** A oferta tem ao menos uma modalidade selecionada que segue a cascata única do processo (RN-CASCATA-2b). */
export function ofertaExigeCascata(
  oferta: DistribuicaoDeVagas,
  catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>,
): boolean {
  return oferta.modalidades.some((modalidade) => segueCascata(modalidade.id, catalogo));
}

/** A oferta não usa o ramo federal (Lei 12.711, em qualquer variação) — espelha `OfertaForaDoRegimeFederal` do domínio. */
export function ofertaForaDoRegimeFederal(oferta: DistribuicaoDeVagas): boolean {
  return !ehRamoFederal(oferta.regraDistribuicaoCodigo);
}

/**
 * A seção da cascata só aparece quando há ao menos uma oferta que a exige **e**
 * usa o ramo federal — espelha `PendenciaDaCascata`/`ExisteCascataForaDoRegimeFederal`
 * do agregado (`ProcessoSeletivo.cs`). Revelar a seção fora disso pediria ao
 * operador uma declaração que não fecha pendência nenhuma.
 */
export function precisaExibirSecaoDaCascata(
  ofertas: readonly DistribuicaoDeVagas[],
  catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>,
): boolean {
  return ofertas.some(
    (oferta) => ofertaExigeCascata(oferta, catalogo) && !ofertaForaDoRegimeFederal(oferta),
  );
}

/**
 * Ofertas que exigem a cascata mas usam regra de distribuição fora do ramo
 * federal — o item `cascata_modalidade_fora_do_regime_federal`. Aqui a saída
 * não é configurar a cascata: é corrigir a regra de distribuição ou a
 * modalidade no próprio quadro de vagas, acima nesta mesma tela.
 */
export function ofertasComCascataForaDoRegimeFederal(
  ofertas: readonly DistribuicaoDeVagas[],
  catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>,
): readonly DistribuicaoDeVagas[] {
  return ofertas.filter(
    (oferta) => ofertaExigeCascata(oferta, catalogo) && ofertaForaDoRegimeFederal(oferta),
  );
}

/**
 * Um problema de encaixe entre a matriz da regra e o quadro de vagas.
 *
 * `ofertaCursoId` é `null` para os dois problemas de escopo de **processo**
 * (origem ou destino que a matriz declara e nenhuma oferta cobre) — esses não
 * apontam para uma oferta específica porque nenhuma delas, isoladamente, é
 * "a errada": a matriz inteira é que sobra em relação ao que o processo
 * ofertou.
 */
export interface ProblemaDaCascata {
  readonly ofertaCursoId: string | null;
  readonly mensagem: string;
}

/**
 * Confere a matriz que a regra declara contra o quadro de vagas, em dois
 * níveis (RN-CASCATA-1/2/2b).
 *
 * **Por oferta** — nunca contra a união —, espelhando
 * `FallbackNaoSelecionadoNaOferta` e `DestinoDaOrigemNaoResolvivelNaOferta`:
 * o destino final tem de estar selecionado em cada oferta federal que exige
 * cascata, e cada origem que ela declara com `SEGUE_CASCATA` precisa de ao
 * menos um destino, entre os que a regra ordena para ela, também selecionado
 * na mesma oferta.
 *
 * **Sobre a união de todas as ofertas** — espelhando
 * `ExisteCascataOrigemNaoSegueCascata` e `ExisteCascataDestinoDesconhecido`:
 * a tela sempre envia a matriz **inteira** que a regra declara (RN-CASCATA-5
 * não admite recorte), então uma origem ou destino que a regra declara mas
 * nenhuma oferta do processo cobre passa despercebido pela checagem por
 * oferta — e o handler de gravação também não o rejeita, porque
 * `BateComEsquemaArgs` só confere a matriz contra o `esquemaArgs`, nunca
 * contra o quadro de vagas. Sem esta segunda checagem, o PUT aceita uma
 * cascata que o preflight de conformidade (`PendenciaDaCascata`) recusa na
 * publicação — silenciosamente, porque `GET /conformidade` não tem tela
 * própria ainda (Story #486).
 */
export function problemasDaCascata(
  ofertas: readonly DistribuicaoDeVagas[],
  catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>,
  matriz: MatrizDaRegra,
): readonly ProblemaDaCascata[] {
  const destinosPorOrigem = new Map(matriz.ordens.map((ordem) => [ordem.origem, ordem.destinos]));
  const problemas: ProblemaDaCascata[] = [];

  for (const oferta of ofertas) {
    if (!ofertaExigeCascata(oferta, catalogo) || ofertaForaDoRegimeFederal(oferta)) continue;

    const codigosDaOferta = new Set(oferta.modalidades.map((modalidade) => modalidade.codigo));

    if (!codigosDaOferta.has(matriz.fallbackCodigo)) {
      problemas.push({
        ofertaCursoId: oferta.ofertaCursoId,
        mensagem: `O destino final da cascata (${matriz.fallbackCodigo}) não está selecionado no quadro de vagas desta oferta.`,
      });
    }

    const origensDaOferta = oferta.modalidades.filter((modalidade) =>
      segueCascata(modalidade.id, catalogo),
    );

    for (const origem of origensDaOferta) {
      const destinos = destinosPorOrigem.get(origem.codigo);
      if (destinos === undefined) {
        problemas.push({
          ofertaCursoId: oferta.ofertaCursoId,
          mensagem: `A modalidade ${origem.codigo} segue a cascata, mas a regra escolhida não declara essa origem.`,
        });
        continue;
      }

      if (!destinos.some((destino) => codigosDaOferta.has(destino))) {
        problemas.push({
          ofertaCursoId: oferta.ofertaCursoId,
          mensagem: `Nenhum destino de ${origem.codigo} (${destinos.join(', ')}) está selecionado no quadro de vagas desta oferta.`,
        });
      }
    }
  }

  problemas.push(...problemasDeCoberturaDaMatriz(ofertas, catalogo, matriz));

  return problemas;
}

/**
 * A matriz enviada é sempre inteira: origem ou destino que a regra declara e
 * nenhuma oferta do processo cobre torna o processo impublicável mesmo com o
 * PUT aceito — o handler de gravação não confere isso, só o preflight de
 * conformidade, na publicação. `union` é deliberadamente **sobre todas as
 * ofertas**, diferente da checagem por oferta acima: uma origem pode ser
 * `SEGUE_CASCATA` na oferta A e o destino dela estar ofertado só na B.
 */
function problemasDeCoberturaDaMatriz(
  ofertas: readonly DistribuicaoDeVagas[],
  catalogo: ReadonlyMap<string, ModalidadeDoCatalogo>,
  matriz: MatrizDaRegra,
): readonly ProblemaDaCascata[] {
  const codigosOfertados = new Set(
    ofertas.flatMap((oferta) => oferta.modalidades.map((modalidade) => modalidade.codigo)),
  );
  const origensSegueCascata = new Set(
    ofertas.flatMap((oferta) =>
      oferta.modalidades
        .filter((modalidade) => segueCascata(modalidade.id, catalogo))
        .map((modalidade) => modalidade.codigo),
    ),
  );

  const problemas: ProblemaDaCascata[] = [];

  for (const ordem of matriz.ordens) {
    if (!origensSegueCascata.has(ordem.origem)) {
      problemas.push({
        ofertaCursoId: null,
        mensagem: `A regra declara a origem ${ordem.origem}, mas nenhuma oferta do processo a marca como SEGUE_CASCATA no quadro de vagas.`,
      });
    }
  }

  // Uma mensagem por destino ausente, não por par origem-destino: no
  // catálogo real cada origem repete os mesmos pares como destino umas das
  // outras, e listar por origem duplicaria a mesma modalidade faltante uma
  // vez por origem que a referencia.
  const destinosDaMatriz = new Set(matriz.ordens.flatMap((ordem) => ordem.destinos));
  const destinosFaltantes = [...destinosDaMatriz].filter(
    (destino) => !codigosOfertados.has(destino),
  );
  if (destinosFaltantes.length > 0) {
    problemas.push({
      ofertaCursoId: null,
      mensagem: `A regra declara os destinos ${destinosFaltantes.join(', ')}, mas nenhuma oferta do processo os oferece no quadro de vagas.`,
    });
  }

  if (!codigosOfertados.has(matriz.fallbackCodigo)) {
    problemas.push({
      ofertaCursoId: null,
      mensagem: `A regra declara ${matriz.fallbackCodigo} como destino final, mas nenhuma oferta do processo o oferece no quadro de vagas.`,
    });
  }

  return problemas;
}

/**
 * O comando de gravação: a matriz inteira que a regra declarou, célula a
 * célula (RN-CASCATA-5) — nunca um recorte. O handler recusa com
 * `MatrizDivergenteDaRegra` qualquer payload que não seja idêntico ao
 * `esquemaArgs` congelado, então enviar menos do que a regra declara já é
 * recusa certa.
 */
export function comandoDaCascata(
  selecao: CascataSelecionada,
  matriz: MatrizDaRegra,
): DefinirCascataRemanejamentoRequest {
  const destinos: DestinoRemanejamentoInput[] = matriz.ordens.flatMap((ordem) =>
    ordem.destinos.map((destino, indice) => ({
      modalidadeOrigemCodigo: ordem.origem,
      ordem: indice + 1,
      modalidadeDestinoCodigo: destino,
    })),
  );

  return {
    regraCodigo: selecao.regraCodigo,
    regraVersao: selecao.regraVersao,
    fallbackCodigo: matriz.fallbackCodigo,
    destinos,
  };
}

/** Os quatro campos nulos removem a cascata do processo (contrato do handler). */
export function comandoDeRemocaoDaCascata(): DefinirCascataRemanejamentoRequest {
  return { regraCodigo: null, regraVersao: null, fallbackCodigo: null, destinos: null };
}
