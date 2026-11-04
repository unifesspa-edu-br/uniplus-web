import {
  type AvaliacaoDaInscricaoRequest,
  type FormularioRenderizavelDto,
  type InscricaoDto,
  type InscricaoRequest,
  SituacaoInscricao,
} from '@uniplus/shared-data/selecao';
import type { SimulacaoDoFormulario } from '@uniplus/shared-ui/components';

/** As ofertas de curso escolhidas na tela: a 2ª só existe com a 1ª. */
export interface OfertasEscolhidas {
  readonly ofertaCursoId: string | null;
  readonly ofertaCursoSegundaOpcaoId: string | null;
}

/**
 * As respostas e as ocorrências como o servidor as mescla ao gravado. A resposta que o candidato
 * apagou vai como `null`: ausente do corpo, o servidor manteria a gravada. O grupo que o candidato
 * removeu vai como lista vazia, pelo mesmo motivo: ausente do corpo, o servidor manteria as
 * ocorrências gravadas; enviado, ele as substitui. O nome social da conta só vai quando o candidato
 * escolhe usá-lo: com a recusa, a resposta vai nula, e a inscrição não guarda um nome que ele não
 * quis usar.
 */
function respostasDoCorpo(
  inscricao: InscricaoDto,
  simulacao: SimulacaoDoFormulario,
): Pick<AvaliacaoDaInscricaoRequest, 'respostas' | 'grupos'> {
  const respostas: Record<string, unknown> = { ...(simulacao.respostas ?? {}) };
  for (const fato of Object.keys(inscricao.respostas)) {
    if (!(fato in respostas)) respostas[fato] = null;
  }
  if ('NOME_SOCIAL' in respostas && respostas['DESEJA_NOME_SOCIAL'] !== true) {
    respostas['NOME_SOCIAL'] = null;
  }
  const grupos: Record<string, { id: string; respostas: Record<string, unknown> }[]> =
    Object.fromEntries(
      Object.entries(simulacao.grupos ?? {}).map(([codigo, ocorrencias]) => [
        codigo,
        (ocorrencias ?? []).map((o) => ({ id: o.id, respostas: o.respostas ?? {} })),
      ]),
    );
  for (const codigo of Object.keys(inscricao.grupos)) {
    if (simulacao.grupos?.[codigo] == null) grupos[codigo] = [];
  }
  return { respostas, grupos };
}

/** O corpo da consulta de avaliação: as respostas da tela e as ofertas escolhidas nela, ou `null`. */
export function corpoDaAvaliacao(
  inscricao: InscricaoDto,
  simulacao: SimulacaoDoFormulario,
  ofertas: OfertasEscolhidas,
): AvaliacaoDaInscricaoRequest {
  return { ...respostasDoCorpo(inscricao, simulacao), ...ofertas };
}

/** O corpo do salvar e do envio: o da avaliação e os termos aceitos, com a versão que o formulário publica. */
export function corpoDaGravacao(
  corpo: AvaliacaoDaInscricaoRequest,
  termosAceitos: readonly string[],
  termosDoFormulario: FormularioRenderizavelDto['termos'],
): InscricaoRequest {
  const termos = new Map(termosDoFormulario.map((t) => [t.codigo, t]));
  return {
    ...corpo,
    ofertaCursoId: corpo.ofertaCursoId ?? null,
    aceites: termosAceitos.flatMap((codigo) => {
      const termo = termos.get(codigo);
      return termo ? [{ codigo, versaoId: termo.versaoId, hashVersao: termo.hashVersao }] : [];
    }),
  };
}

/** O que só o candidato grava; enviar ou remover documento não muda nada disso. */
export function mesmoConteudoGravado(a: InscricaoDto, b: InscricaoDto): boolean {
  const gravado = (i: InscricaoDto): string =>
    JSON.stringify([
      i.situacao,
      i.versaoFormularioId,
      i.ofertaCursoId,
      i.ofertaCursoSegundaOpcaoId,
      i.respostas,
      i.grupos,
      i.aceites,
    ]);
  return gravado(a) === gravado(b);
}

/** O que o leitor de tela ouve quando a releitura mostra que a gravação aconteceu. */
export function confirmacaoDaGravacao(inscricao: InscricaoDto): string {
  if (inscricao.situacao !== SituacaoInscricao.submetida) return 'Rascunho salvo.';
  return inscricao.numeroInscricao
    ? `Inscrição enviada. Número ${inscricao.numeroInscricao}.`
    : 'Inscrição enviada.';
}
