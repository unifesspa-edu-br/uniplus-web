import type { ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';

import type { CascataSelecionada, DistribuicaoDeVagas } from '../../processo-seletivo.models';
import {
  decodificarComposicaoVagas,
  ehRamoFederal,
  ehRamoReconhecido,
  quantidadeEhDeclarada,
} from '../../passos/vagas/composicao-de-vagas';

type DistribuicaoGravada = ProcessoSeletivoDto['distribuicaoVagas'][number];
type ModalidadeGravada = DistribuicaoGravada['modalidades'][number];

/**
 * Projeta a distribuição de vagas gravada com os identificadores **de origem**, que é o que o
 * comando recebe: o `id` do detalhe identifica o snapshot, não a entidade do catálogo. Os números
 * voltam como texto porque é o que o campo edita.
 *
 * O quadro devolvido é resultado do cálculo, e só as quantidades que o edital fixou voltam como
 * entrada: reenviar as calculadas faria o servidor recusar a configuração que ele mesmo devolveu.
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
      composicaoVagas: decodificarComposicaoVagas(modalidade.composicaoVagas),
      composicaoOrigemCodigo: modalidade.composicaoOrigemCodigo,
      regraRemanejamento: modalidade.regraRemanejamento,
      remanejamentoDestino: modalidade.remanejamentoDestino,
      remanejamentoPar: modalidade.remanejamentoPar,
      remanejamentoFallback: modalidade.remanejamentoFallback,
    },
  };
}

/**
 * Só o que o edital fixou; o que a regra calcula fica de fora do rascunho. Sem ramo reconhecido
 * não se sabe o que a regra calcula, então nada se deriva do quadro devolvido.
 */
function quadroDeclaradoDe(distribuicao: DistribuicaoGravada): DistribuicaoDeVagas['quadro'] {
  if (!ehRamoReconhecido(distribuicao.ramoDaDistribuicao)) return [];

  const federal = ehRamoFederal(distribuicao.ramoDaDistribuicao);
  const composicaoPorModalidade = composicaoPorModalidadeDe(distribuicao);

  return distribuicao.quadro
    .filter((vaga) =>
      temQuantidadeDeclarada(composicaoPorModalidade.get(vaga.modalidadeOrigemId), federal),
    )
    .map((vaga) => ({
      modalidadeId: vaga.modalidadeOrigemId,
      quantidade: String(vaga.quantidade),
    }));
}

function composicaoPorModalidadeDe(distribuicao: DistribuicaoGravada) {
  return new Map(
    distribuicao.modalidades.map((modalidade) => [
      modalidade.modalidadeOrigemId,
      decodificarComposicaoVagas(modalidade.composicaoVagas),
    ]),
  );
}

function temQuantidadeDeclarada(composicao: string | null | undefined, federal: boolean): boolean {
  return (
    composicao !== undefined && composicao !== null && quantidadeEhDeclarada(composicao, federal)
  );
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
function comoDecimalPtBr(valor: number | null): string {
  return valor === null ? '' : String(valor).replace('.', ',');
}
