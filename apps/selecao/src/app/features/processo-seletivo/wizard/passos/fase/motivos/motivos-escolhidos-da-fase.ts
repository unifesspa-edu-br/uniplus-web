import {
  SentidoDoMotivoCodigo,
  TipoMotivoDeDecisaoCodigo,
  type MotivoDeDecisaoDoProcessoDto,
  type MotivoDeDecisaoDto,
} from '@uniplus/shared-data/selecao';

import type {
  IdentidadeDoMotivo,
  MotivoNoDocumento,
} from '../../../shared/motivos/motivo-no-documento';

/** O tipo de decisão cujos motivos a homologação das inscrições aponta nas condições. */
export const TIPO_DA_HOMOLOGACAO = TipoMotivoDeDecisaoCodigo.HOMOLOGACAO_DAS_INSCRICOES;

/** Os motivos que o processo escolheu e que são da fase, na ordem em que o servidor os devolve. */
export function escolhidosDaFase(
  escolha: readonly MotivoDeDecisaoDoProcessoDto[],
  faseCanonicaId: string,
): readonly MotivoDeDecisaoDoProcessoDto[] {
  return escolha.filter((motivo) => motivo.lugar.faseCanonicaOrigemId === faseCanonicaId);
}

/** O motivo escolhido como o componente de motivos o entende: a fase pela chave e a cópia lida. */
export function comoMotivoNoDocumento(
  escolhido: MotivoDeDecisaoDoProcessoDto,
  faseChave: string,
): MotivoNoDocumento {
  return {
    faseChave,
    tipoDeDecisaoCodigo: escolhido.tipo.codigo,
    codigo: escolhido.codigo,
    descricao: escolhido.descricao,
    sentido: escolhido.sentido.codigo,
    versaoDoEditalDeEntrada: escolhido.vigencia.versaoDoEditalDeEntrada,
    ...camposOpcionais(escolhido),
  };
}

/** Os campos que o servidor devolve `null` e o documento deixa ausentes. */
function camposOpcionais({
  subclassificacao,
  justificativaDaInclusao,
}: MotivoDeDecisaoDoProcessoDto): Pick<
  MotivoNoDocumento,
  'subclassificacao' | 'justificativaDaInclusao'
> {
  return {
    ...(subclassificacao === null ? {} : { subclassificacao }),
    ...(justificativaDaInclusao === null ? {} : { justificativaDaInclusao }),
  };
}

/** O motivo que uma condição da homologação das inscrições pode apontar como desfavorável. */
export function ehDesfavoravelDaHomologacao(motivo: MotivoNoDocumento): boolean {
  return (
    motivo.tipoDeDecisaoCodigo === TIPO_DA_HOMOLOGACAO &&
    motivo.sentido === SentidoDoMotivoCodigo.DESFAVORAVEL
  );
}

/** O identificador do motivo no cadastro, pelo tipo de decisão e pelo código; `null` quando ele saiu do cadastro. */
export function idNoCadastro(
  cadastro: readonly MotivoDeDecisaoDto[],
  motivo: IdentidadeDoMotivo,
): string | null {
  const achado = cadastro.find(
    (item) => item.tipo.codigo === motivo.tipoDeDecisaoCodigo && item.codigo === motivo.codigo,
  );
  return achado?.id ?? null;
}

/** O identificador do motivo que a fase já escolheu, pelo tipo de decisão e pelo código. */
export function idDoEscolhido(
  escolhidos: readonly MotivoDeDecisaoDoProcessoDto[],
  motivo: IdentidadeDoMotivo,
): string | null {
  const achado = escolhidos.find(
    (item) => item.tipo.codigo === motivo.tipoDeDecisaoCodigo && item.codigo === motivo.codigo,
  );
  return achado?.motivoDeDecisaoId ?? null;
}
