import { nomeDaOferta, type CertamePublicadoDto } from '@uniplus/shared-data/selecao';

/** Texto de quem tem a oferta na inscrição mas não a encontra no certame publicado. */
export const OFERTA_NAO_IDENTIFICADA = 'Curso não identificado';

/** O nome de cada oferta do certame pelo id da oferta de origem. */
export function nomesDasOfertas(certame: CertamePublicadoDto): ReadonlyMap<string, string> {
  return new Map(
    certame.ofertas.map((oferta) => [oferta.ofertaCursoOrigemId, nomeDaOferta(oferta)]),
  );
}

/** Onde a leitura do certame publicado está; dela vêm o nome do processo e dos cursos. */
export type LeituraDoCertame = 'lendo' | 'falha' | 'lido';

/** O curso como a tela o mostra: `texto` nulo é o certame ainda carregando. */
export interface CursoExibido {
  readonly texto: string | null;
}

/** Texto do curso quando o certame, que o nomeia, não pôde ser lido. */
export const CURSO_INDISPONIVEL = 'Nome do curso indisponível';

/**
 * O curso de uma oferta segundo a leitura do certame; sem oferta, não há curso a mostrar.
 */
export function cursoExibido(
  situacaoDoCertame: LeituraDoCertame,
  nomes: ReadonlyMap<string, string>,
  ofertaId: string | null | undefined,
): CursoExibido | null {
  if (ofertaId == null) return null;
  switch (situacaoDoCertame) {
    case 'lendo':
      return { texto: null };
    case 'falha':
      return { texto: CURSO_INDISPONIVEL };
    case 'lido':
      return { texto: nomes.get(ofertaId) ?? OFERTA_NAO_IDENTIFICADA };
  }
}
