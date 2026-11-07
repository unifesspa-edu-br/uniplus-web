import type { components } from './schema';

type Schemas = components['schemas'];

/**
 * As respostas pelo código do fato, com o valor em JSON. O schema gerado tipa esses dicionários como
 * `Record<string, never>`; o resto de cada tipo vem dele. O município vem como o código IBGE, em texto,
 * no rascunho, e como `{ codigo, rotulo }` (`MunicipioGravado`, de `@uniplus/shared-utils`) na inscrição enviada e no comprovante.
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

/**
 * O comprovante de um envio, pronto para exibir: rótulos, seções, nomes de termos e de cursos são os
 * da versão em que a inscrição foi enviada. A resposta de cada item vem em JSON; o `tipo` diz como lê-la.
 */
export type ComprovanteDaInscricaoDto = Schemas['ComprovanteDaInscricaoDto'];

export type DocumentoDoComprovanteDto = Schemas['DocumentoDoComprovanteDto'];

export type ArquivoDoComprovanteDto = Schemas['ArquivoDoComprovanteDto'];

export type SecaoDoComprovanteDto = Schemas['SecaoDoComprovanteDto'];

export type GrupoDoComprovanteDto = Schemas['GrupoDoComprovanteDto'];

export type ItemDoComprovanteDto = Schemas['ItemDoComprovanteDto'];

/** O que a submissão devolve: onde está o comprovante emitido, sem o documento. */
export type ReciboDaInscricaoDto = Schemas['ReciboDaInscricaoDto'];

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

/** O valor de um campo revelado a pedido de quem opera o processo. */
export type CampoReveladoDto = Schemas['CampoReveladoDto'];

/** O arquivo confirmado, com a situação da verificação e a mensagem ao candidato. */
export type ArquivoDaApresentacaoDto = Schemas['ArquivoDaApresentacaoDto'];

/** Onde o arquivo está na verificação feita depois da confirmação. */
export { SituacaoDoArquivoDoCandidato } from './schema';

/**
 * Uma inscrição na listagem de quem opera o processo. A API omite o campo que a permissão da pessoa
 * não alcança, sem indicar a omissão: cada campo é opcional.
 */
export type InscricaoDoProcessoDto = Schemas['InscricaoDoProcessoDto'];

/** O nome do candidato na listagem: item classificado, que leva só o `valor`; a classificação não sai no JSON. */
export type NomeClassificadoDto = Schemas['NomeClassificadoDto'];

/** O CPF no padrão `***.999.999-**`; `podeRevelar` é sempre falso na listagem, porque a revelação é no detalhe. */
export type CpfMascaradoDto = Schemas['CpfMascaradoDto'];

/**
 * A inscrição na consulta de quem opera o processo. A API projeta cada item pela permissão da sua
 * classe e omite o que a pessoa não pode ver, sem indicação: os campos fixos são opcionais e as
 * listas só trazem o que foi permitido.
 */
export type InscricaoAdministrativaDto = Schemas['InscricaoAdministrativaDto'];

/** Uma seção do formulário com as respostas fora de grupo e os grupos repetíveis. */
export type SecaoDaInscricaoDto = Schemas['SecaoDaInscricaoDto'];

export type GrupoDaInscricaoDto = Schemas['GrupoDaInscricaoDto'];

export type OcorrenciaDaInscricaoDto = Schemas['OcorrenciaDaInscricaoDto'];

/**
 * Uma resposta do formulário. O `tipo` diz como ler o `valor` e o `componente`, como exibi-lo; o
 * `valor` do identificador já vem mascarado. Quem só pode revelar o identificador recebe o item sem
 * `valor` e com `podeRevelar` verdadeiro.
 */
export type ItemDeRespostaDto = Schemas['ItemDeRespostaDto'];

/** Os metadados de um arquivo enviado; o nome original e a chave do objeto nunca saem. */
export type ArquivoAdministrativoDto = Schemas['ArquivoAdministrativoDto'];
