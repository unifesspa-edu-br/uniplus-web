import type { components } from './schema';

type Schemas = components['schemas'];

/**
 * As respostas pelo código do fato, com o valor em JSON. O schema gerado tipa esses dicionários como
 * `Record<string, never>`; o resto de cada tipo vem dele.
 */
export type RespostasDaInscricao = Readonly<Record<string, unknown>>;

export type OcorrenciaDeGrupoInscricaoInput = Omit<
  Schemas['OcorrenciaDeGrupoInscricaoInput'],
  'respostas'
> & { readonly respostas: RespostasDaInscricao | null };

type GruposDaInscricao = Readonly<Record<string, readonly OcorrenciaDeGrupoInscricaoInput[]>>;

export type AceiteDeTermoInput = Schemas['AceiteDeTermoInput'];

export type InscricaoDto = Omit<Schemas['InscricaoDto'], 'respostas' | 'derivados' | 'grupos'> & {
  readonly respostas: RespostasDaInscricao;
  readonly derivados: RespostasDaInscricao;
  readonly grupos: GruposDaInscricao;
};

export type InscricaoRequest = Omit<Schemas['InscricaoRequest'], 'respostas' | 'grupos'> & {
  readonly respostas: RespostasDaInscricao | null;
  readonly grupos: GruposDaInscricao | null;
};

export type ComprovanteInscricaoDto = Omit<
  Schemas['ComprovanteInscricaoDto'],
  'respostas' | 'derivados' | 'grupos'
> & {
  readonly respostas: RespostasDaInscricao;
  readonly derivados: RespostasDaInscricao;
  readonly grupos: GruposDaInscricao;
};

export type MinhaInscricaoDto = Schemas['MinhaInscricaoDto'];

export type AcoesDaInscricaoDto = Schemas['AcoesDaInscricaoDto'];

export type CancelamentoDaInscricaoRequest = Schemas['CancelamentoDaInscricaoRequest'];

/**
 * O que as respostas determinam no processo, calculado pela API sem gravar (ADR-0143): as modalidades
 * em que o candidato concorre ou o que falta responder para saber.
 */
export type AvaliacaoDaInscricaoDto = Schemas['AvaliacaoDaInscricaoDto'];

export type ModalidadesDaInscricaoDto = Schemas['ModalidadesDaInscricaoDto'];

/** As respostas da consulta, mescladas pela API ao rascunho gravado: o que não vier vale o gravado. */
export type AvaliacaoDaInscricaoRequest = Omit<
  Schemas['AvaliacaoDaInscricaoRequest'],
  'respostas' | 'grupos'
> & {
  readonly respostas: RespostasDaInscricao | null;
  readonly grupos: GruposDaInscricao | null;
};

/** O pedido de envio de um arquivo que atende uma exigência de documento da inscrição. */
export type IniciarEnvioDeDocumentoDaInscricaoRequest =
  Schemas['IniciarEnvioDeDocumentoDaInscricaoRequest'];

/** O arquivo pendente e a URL pré-assinada de PUT, de validade curta. */
export type IniciarEnvioDeDocumentoDaInscricaoDto =
  Schemas['IniciarEnvioDeDocumentoDaInscricaoDto'];

/** O ETag do PUT, que fixa a versão do objeto que o verificador confere. */
export type ConfirmarEnvioDeDocumentoDaInscricaoRequest =
  Schemas['ConfirmarEnvioDeDocumentoDaInscricaoRequest'];

/** A URL de curta validade para baixar o arquivo verificado do candidato. */
export type AcessoArquivoDoCandidatoDto = Schemas['AcessoArquivoDoCandidatoDto'];

/** O arquivo confirmado, com a situação da verificação e a mensagem ao candidato. */
export type ArquivoDaApresentacaoDto = Schemas['ArquivoDaApresentacaoDto'];

/** Onde o arquivo está na verificação feita depois da confirmação. */
export { SituacaoDoArquivoDoCandidato } from './schema';

/**
 * Uma inscrição na listagem de quem opera o processo. A API omite o campo que a permissão da pessoa
 * não alcança, sem indicar a omissão: cada campo é opcional.
 */
export type InscricaoDoProcessoDto = Schemas['InscricaoDoProcessoDto'];

/** O CPF no padrão `***.999.999-**`; `podeRevelar` é sempre falso na listagem, porque a revelação é no detalhe. */
export type CpfMascaradoDto = Schemas['CpfMascaradoDto'];
