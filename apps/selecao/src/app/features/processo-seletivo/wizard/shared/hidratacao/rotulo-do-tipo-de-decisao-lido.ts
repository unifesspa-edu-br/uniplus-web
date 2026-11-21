import type { ProcessoSeletivoDto } from '@uniplus/shared-data/selecao';

type FaseDoDto = ProcessoSeletivoDto['cronogramaFases'][number];
type EtapaDoDto = ProcessoSeletivoDto['etapas'][number];
type TipoDeDecisaoLido = FaseDoDto['publicacoes']['tiposDeDecisao'][number];

function tiposDaFase(fase: FaseDoDto): readonly TipoDeDecisaoLido[] {
  const { tiposDeDecisao, regraRecurso } = fase.publicacoes;
  return [
    ...tiposDeDecisao,
    ...(regraRecurso?.procedimentos ?? []).map((procedimento) => procedimento.tipoDeDecisao),
  ];
}

function tiposDaEtapa(etapa: EtapaDoDto): readonly TipoDeDecisaoLido[] {
  const { tiposDeDecisao, recursos } = etapa.publicacoes;
  return [
    ...tiposDeDecisao,
    ...recursos.flatMap((recurso) =>
      recurso.procedimentos.map((procedimento) => procedimento.tipoDeDecisao),
    ),
  ];
}

function rotulosPorCodigo(processo: ProcessoSeletivoDto | null): ReadonlyMap<string, string> {
  const tipos = [
    ...(processo?.cronogramaFases ?? []).flatMap(tiposDaFase),
    ...(processo?.etapas ?? []).flatMap(tiposDaEtapa),
  ];
  return new Map(tipos.map((tipo) => [tipo.codigo, tipo.rotulo]));
}

export function rotuloDoTipoDeDecisaoLido(
  processo: ProcessoSeletivoDto | null,
): (codigo: string) => string {
  const rotulos = rotulosPorCodigo(processo);
  return (codigo) => rotulos.get(codigo) || '';
}
