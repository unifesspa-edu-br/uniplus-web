import {
  DocumentoDaConfiguracaoOpcoesDeCursoNumero as NumeroDeOpcoes,
  type DocumentoDaConfiguracao,
} from '@uniplus/shared-data/selecao';

import { comCampo, naSecao } from './secao-do-documento';

/** Quantos cursos o candidato escolhe, como o seletor os escreve; vazio é "ainda não declarado". */
export type OpcoesDeCursoDoCampo = '' | '1' | '2';

export function numeroDeOpcoes(campo: OpcoesDeCursoDoCampo): NumeroDeOpcoes | undefined {
  if (campo === '1') return NumeroDeOpcoes.Value1;
  return campo === '2' ? NumeroDeOpcoes.Value2 : undefined;
}

export function opcoesDeCursoDoCampo(numero: NumeroDeOpcoes | undefined): OpcoesDeCursoDoCampo {
  if (numero === NumeroDeOpcoes.Value1) return '1';
  return numero === NumeroDeOpcoes.Value2 ? '2' : '';
}

/** Ausente é "ainda não declarado": a ausência nunca vale uma opção. */
export function definirNumeroDeOpcoes(
  documento: DocumentoDaConfiguracao,
  campo: OpcoesDeCursoDoCampo,
): DocumentoDaConfiguracao {
  return naSecao(documento, 'opcoesDeCurso', (opcoes) =>
    comCampo(opcoes, 'numero', numeroDeOpcoes(campo)),
  );
}
