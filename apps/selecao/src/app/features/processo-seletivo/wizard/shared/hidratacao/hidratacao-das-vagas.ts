import type { ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';

import type { CascataSelecionada, DistribuicaoDeVagas } from '../../processo-seletivo.models';
import { decodificarComposicaoVagas } from '../../passos/vagas/composicao-de-vagas';

type DistribuicaoGravada = ProcessoSeletivoDto['distribuicaoVagas'][number];
type ModalidadeGravada = DistribuicaoGravada['modalidades'][number];

/**
 * Projeta a distribuição de vagas gravada com os identificadores **de origem**, que é o que o
 * comando recebe: o `id` do detalhe identifica o snapshot, não a entidade do catálogo. Os números
 * voltam como texto porque é o que o campo edita.
 *
 * Só as quantidades que o edital declarou voltam como entrada: reenviar as calculadas faria o
 * servidor recusar a configuração que ele mesmo devolveu.
 */
export function distribuicoesDe(dto: ProcessoSeletivoDto): DistribuicaoDeVagas[] {
  return (dto.distribuicaoVagas ?? []).map(distribuicaoDe);
}

function distribuicaoDe(distribuicao: DistribuicaoGravada): DistribuicaoDeVagas {
  return {
    ofertaCursoId: distribuicao.ofertaCursoOrigemId,
    voBase: String(distribuicao.vagasOfertadasBase),
    pr: comoDecimalPtBr(distribuicao.percentualDaReservaLegal),
    ...regrasDaDistribuicaoDe(distribuicao),
    referenciaReservaDemograficaId: distribuicao.referenciaDemografica?.origemId ?? null,
    ajusteDoQuadro: distribuicao.ajusteDoQuadro,
    modalidades: distribuicao.modalidades.map(modalidadeDe),
    quadro: quadroDeclaradoDe(distribuicao),
  };
}

function regrasDaDistribuicaoDe(distribuicao: DistribuicaoGravada) {
  return {
    regraDistribuicaoCodigo: distribuicao.regraDistribuicao.codigo,
    regraDistribuicaoVersao: distribuicao.regraDistribuicao.versao,
    ramoDaDistribuicao: distribuicao.ramoDaDistribuicao,
    regraAjusteCodigo: distribuicao.regraAjuste?.codigo ?? null,
    regraAjusteVersao: distribuicao.regraAjuste?.versao ?? null,
  };
}

function modalidadeDe(modalidade: ModalidadeGravada): DistribuicaoDeVagas['modalidades'][number] {
  return {
    id: modalidade.modalidadeOrigemId,
    codigo: modalidade.codigo,
    gravada: {
      descricao: modalidade.descricao,
      composicaoVagas: decodificarComposicaoVagas(modalidade.composicaoVagas.codigo),
      composicaoOrigemCodigo: modalidade.composicaoOrigemCodigo,
      regraRemanejamento: modalidade.regraRemanejamento?.codigo ?? null,
      remanejamentoDestino: modalidade.remanejamentoDestino,
      remanejamentoPar: modalidade.remanejamentoPar,
      remanejamentoFallback: modalidade.remanejamentoFallback,
    },
  };
}

/**
 * O quadro do rascunho é a declaração do edital, lida de `quantidadeDeclarada` em cada modalidade.
 * O `quadro` devolvido é o resultado do cálculo, já com o ajuste aplicado: reenviá-lo como entrada
 * trocaria, sem aviso, o que o edital declarou pelo que o ajuste sobrou. Modalidade com a
 * quantidade calculada pela regra não tem declaração e fica fora.
 */
function quadroDeclaradoDe(distribuicao: DistribuicaoGravada): DistribuicaoDeVagas['quadro'] {
  return distribuicao.modalidades.flatMap((modalidade) =>
    modalidade.quantidadeDeclarada === null
      ? []
      : [
          {
            modalidadeId: modalidade.modalidadeOrigemId,
            quantidade: String(modalidade.quantidadeDeclarada),
          },
        ],
  );
}

/**
 * Projeta a cascata gravada só pelo par código/versão da regra. `fallbackCodigo` e `destinos[]` são
 * derivados do `declaracaoDaRegra` da regra ao montar o comando (UNI-REQ-0056); trazê-los da leitura
 * criaria uma segunda fonte que divergiria da regra se o catálogo ganhasse versão nova entre a
 * gravação e a leitura.
 */
export function cascataDe(dto: ProcessoSeletivoDto): CascataSelecionada | null {
  const cascata = dto.cascata;
  if (cascata === null || cascata === undefined) return null;

  return { regraCodigo: cascata.regra.codigo, regraVersao: cascata.regra.versao };
}

/**
 * O separador decimal do campo é a vírgula; devolver o ponto de `String(0.5)` faria a tela reabrir
 * com grafia diferente da que ela mesma pediu.
 */
function comoDecimalPtBr(valor: number | null): string {
  return valor === null ? '' : String(valor).replace('.', ',');
}
