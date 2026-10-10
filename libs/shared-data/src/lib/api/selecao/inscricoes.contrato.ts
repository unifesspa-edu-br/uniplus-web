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
