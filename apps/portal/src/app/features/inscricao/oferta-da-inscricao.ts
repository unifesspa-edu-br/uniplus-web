import { nomeDaOferta, type InscricaoDto } from '@uniplus/shared-data/selecao';

/** Uma oferta de curso que o candidato escolhe na inscrição, com o nome congelado na publicação. */
export interface OfertaDaInscricao {
  readonly id: string;
  readonly nome: string;
}

/**
 * As ofertas que a inscrição oferece: as da versão em que ela está, não as do certame ao vivo.
 * Em ordem alfabética, porque a API as devolve na ordem do identificador.
 */
export function ofertasDaInscricao(
  inscricao: Pick<InscricaoDto, 'ofertas'>,
): readonly OfertaDaInscricao[] {
  return inscricao.ofertas
    .map((o) => ({ id: o.ofertaCursoOrigemId, nome: nomeDaOferta(o) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

/** Quantas opções de curso a versão da inscrição admite, do número que a API devolve: uma ou duas. */
export function numeroDeOpcoesDeCurso(numero: number): 1 | 2 {
  return numero >= 2 ? 2 : 1;
}

/** O curso de cada opção como a inscrição o tem gravado, ainda dentro do que a versão oferece. */
export interface EscolhaDeOfertas {
  readonly oferta: string | null;
  readonly segunda: string | null;
}

/**
 * A escolha com que a tela abre. Com uma oferta só, ela é a escolha — mesmo que a gravada seja de
 * outra que saiu do processo —, para o cabeçalho e o envio dizerem o mesmo curso. A 2ª opção só vale
 * com a 1ª, com 2 opções admitidas e sendo outra oferta.
 */
export function escolhaInicialDeOfertas(
  inscricao: Pick<InscricaoDto, 'ofertaCursoId' | 'ofertaCursoSegundaOpcaoId'>,
  ofertas: readonly OfertaDaInscricao[],
  numeroDeOpcoes: 1 | 2,
): EscolhaDeOfertas {
  const oferta =
    ofertas.length === 1
      ? ofertas[0].id
      : (ofertas.find((o) => o.id === inscricao.ofertaCursoId)?.id ?? null);
  const segunda =
    numeroDeOpcoes === 2 && oferta !== null
      ? (ofertas.find((o) => o.id === inscricao.ofertaCursoSegundaOpcaoId && o.id !== oferta)?.id ??
        null)
      : null;
  return { oferta, segunda };
}
