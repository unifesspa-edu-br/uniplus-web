import type { ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';

import type { CascataSelecionada, DistribuicaoDeVagas } from '../../processo-seletivo.models';
import {
  decodificarComposicaoVagas,
  ehRamoFederal,
  quantidadeEhDeclarada,
} from '../../steps/vagas/composicao-de-vagas';

/**
 * Projeta a distribuição de vagas gravada com os identificadores **de origem**, que é o que o
 * comando recebe: o `id` do detalhe identifica o snapshot, não a entidade do catálogo. Os números
 * voltam como texto porque é o que o campo edita.
 *
 * O quadro devolvido é resultado do cálculo, e só as quantidades que o edital fixou voltam como
 * entrada: reenviar as calculadas faria o servidor recusar a configuração que ele mesmo devolveu.
 */
export function distribuicoesDe(dto: ProcessoSeletivoDto): DistribuicaoDeVagas[] {
  return (dto.distribuicaoVagas ?? []).map((distribuicao) => ({
    ofertaCursoId: distribuicao.ofertaCursoOrigemId,
    voBase: String(distribuicao.voBase),
    pr: comoDecimalPtBr(distribuicao.pr),
    regraDistribuicaoCodigo: distribuicao.regraDistribuicao.codigo,
    regraDistribuicaoVersao: distribuicao.regraDistribuicao.versao,
    regraAjusteCodigo: distribuicao.regraAjuste?.codigo ?? null,
    regraAjusteVersao: distribuicao.regraAjuste?.versao ?? null,
    referenciaReservaDemograficaId: distribuicao.referenciaDemografica?.origemId ?? null,
    modalidades: distribuicao.modalidades.map((modalidade) => ({
      id: modalidade.modalidadeOrigemId,
      codigo: modalidade.codigo,
      gravada: {
        descricao: modalidade.descricao,
        composicaoVagas: decodificarComposicaoVagas(modalidade.composicaoVagas),
        composicaoOrigemCodigo: modalidade.composicaoOrigemCodigo,
        regraRemanejamento: modalidade.regraRemanejamento,
        remanejamentoDestino: modalidade.remanejamentoDestino,
        remanejamentoPar: modalidade.remanejamentoPar,
        remanejamentoFallback: modalidade.remanejamentoFallback,
      },
    })),
    quadro: quadroDeclaradoDe(distribuicao),
  }));
}

/** Só o que o edital fixou; o que a regra calcula fica de fora do rascunho. */
function quadroDeclaradoDe(
  distribuicao: ProcessoSeletivoDto['distribuicaoVagas'][number],
): DistribuicaoDeVagas['quadro'] {
  const federal = ehRamoFederal(distribuicao.regraDistribuicao.codigo);
  const composicaoPorModalidade = new Map(
    distribuicao.modalidades.map((modalidade) => [
      modalidade.modalidadeOrigemId,
      decodificarComposicaoVagas(modalidade.composicaoVagas),
    ]),
  );

  return distribuicao.quadro
    .filter((vaga) => {
      const composicao = composicaoPorModalidade.get(vaga.modalidadeOrigemId);
      return (
        composicao !== undefined &&
        composicao !== null &&
        quantidadeEhDeclarada(composicao, federal)
      );
    })
    .map((vaga) => ({
      modalidadeId: vaga.modalidadeOrigemId,
      quantidade: String(vaga.quantidade),
    }));
}

/**
 * Projeta a cascata gravada só pelo par código/versão da regra. `fallbackCodigo` e `destinos[]` são
 * derivados do `esquemaArgs` da regra ao montar o comando (UNI-REQ-0056); trazê-los da leitura
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
function comoDecimalPtBr(valor: number): string {
  return String(valor).replace('.', ',');
}
