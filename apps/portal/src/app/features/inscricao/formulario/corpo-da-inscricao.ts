import {
  type AceiteDeTermoInput,
  type AvaliacaoDaInscricaoRequest,
  type FormularioApresentadoDoProcessoDto,
  type InscricaoDto,
  type InscricaoRequest,
  SituacaoInscricaoCodigo,
} from '@uniplus/shared-data/selecao';
import type { SimulacaoDoFormulario } from '@uniplus/shared-inscricao/formulario';

/** As ofertas de curso escolhidas na tela: a 2ª só existe com a 1ª. */
export interface OfertasEscolhidas {
  readonly ofertaCursoId: string | null;
  readonly ofertaCursoSegundaOpcaoId: string | null;
}

type GruposDoCorpo = Record<string, { id: string; respostas: Record<string, unknown> }[]>;

/**
 * As respostas como o servidor as mescla ao gravado. A resposta que o candidato apagou vai como
 * `null`: ausente do corpo, o servidor manteria a gravada. O nome social da conta só vai quando o
 * candidato escolhe usá-lo: com a recusa, a resposta vai nula, e a inscrição não guarda um nome que
 * ele não quis usar.
 */
function respostasDoCorpo(
  inscricao: InscricaoDto,
  simulacao: SimulacaoDoFormulario,
): Record<string, unknown> {
  const respostas: Record<string, unknown> = { ...(simulacao.respostas ?? {}) };
  for (const fato of Object.keys(inscricao.formulario.respostas)) {
    if (!(fato in respostas)) respostas[fato] = null;
  }
  if ('NOME_SOCIAL' in respostas && respostas['DESEJA_NOME_SOCIAL'] !== true) {
    respostas['NOME_SOCIAL'] = null;
  }
  return respostas;
}

/**
 * As ocorrências dos grupos como o servidor as mescla ao gravado. O grupo que o candidato removeu vai
 * como lista vazia: ausente do corpo, o servidor manteria as ocorrências gravadas; enviado, ele as
 * substitui.
 */
function gruposDoCorpo(inscricao: InscricaoDto, simulacao: SimulacaoDoFormulario): GruposDoCorpo {
  const grupos: GruposDoCorpo = Object.fromEntries(
    Object.entries(simulacao.grupos ?? {}).map(([codigo, ocorrencias]) => [
      codigo,
      (ocorrencias ?? []).map((o) => ({ id: o.id, respostas: o.respostas ?? {} })),
    ]),
  );
  for (const codigo of Object.keys(inscricao.formulario.grupos)) {
    if (simulacao.grupos?.[codigo] == null) grupos[codigo] = [];
  }
  return grupos;
}

/** O corpo da consulta de avaliação: as respostas da tela e as ofertas escolhidas nela, ou `null`. */
export function corpoDaAvaliacao(
  inscricao: InscricaoDto,
  simulacao: SimulacaoDoFormulario,
  ofertas: OfertasEscolhidas,
): AvaliacaoDaInscricaoRequest {
  return {
    respostas: respostasDoCorpo(inscricao, simulacao),
    grupos: gruposDoCorpo(inscricao, simulacao),
    ...ofertas,
  };
}

function aceitesDosTermos(
  termosAceitos: readonly string[],
  formulario: FormularioApresentadoDoProcessoDto | null,
): InscricaoRequest['aceites'] {
  if (formulario === null) return [];
  const termos = new Map(formulario.formulario.termos.map((t) => [t.codigo, t]));
  return termosAceitos.flatMap((codigo) => {
    const termo = termos.get(codigo);
    return termo ? [aceiteDoTermo(formulario.codigo, termo)] : [];
  });
}

function aceiteDoTermo(
  formularioCodigo: string,
  termo: FormularioApresentadoDoProcessoDto['formulario']['termos'][number],
): AceiteDeTermoInput {
  return {
    formularioCodigo,
    codigo: termo.codigo,
    versaoId: termo.versaoId,
    hashVersao: termo.conteudo.hashVersao,
  };
}

/** O corpo do salvar e do envio: o da avaliação e os termos aceitos, com o código do formulário e a versão que ele publica. */
export function corpoDaGravacao(
  corpo: AvaliacaoDaInscricaoRequest,
  termosAceitos: readonly string[],
  formulario: FormularioApresentadoDoProcessoDto | null,
): InscricaoRequest {
  return {
    ...corpo,
    ofertaCursoId: corpo.ofertaCursoId ?? null,
    aceites: aceitesDosTermos(termosAceitos, formulario),
  };
}

/** O que só o candidato grava; enviar ou remover documento não muda nada disso. */
export function mesmoConteudoGravado(a: InscricaoDto, b: InscricaoDto): boolean {
  const gravado = (i: InscricaoDto): string =>
    JSON.stringify([
      i.situacao.codigo,
      i.formulario.versaoFormularioId,
      i.escolhasDeCurso.ofertaCursoId,
      i.escolhasDeCurso.ofertaCursoSegundaOpcaoId,
      i.formulario.respostas,
      i.formulario.grupos,
      i.formulario.aceites,
    ]);
  return gravado(a) === gravado(b);
}

/** O que o leitor de tela ouve quando a releitura mostra que a gravação aconteceu. */
export function confirmacaoDaGravacao(inscricao: InscricaoDto): string {
  if (inscricao.situacao.codigo !== SituacaoInscricaoCodigo.ENVIADA) return 'Rascunho salvo.';
  return inscricao.numeroInscricao
    ? `Inscrição enviada. Número ${inscricao.numeroInscricao}.`
    : 'Inscrição enviada.';
}
