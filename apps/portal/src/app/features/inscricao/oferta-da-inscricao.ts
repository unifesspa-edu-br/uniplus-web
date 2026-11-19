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
  escolhas: Pick<InscricaoDto['escolhasDeCurso'], 'ofertas'>,
): readonly OfertaDaInscricao[] {
  return escolhas.ofertas
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

type GravadaDaInscricao = Pick<
  InscricaoDto['escolhasDeCurso'],
  'ofertaCursoId' | 'ofertaCursoSegundaOpcaoId'
>;

/**
 * Com uma oferta só, ela é a 1ª opção — mesmo que a gravada seja de outra que saiu do processo —, para
 * o cabeçalho e o envio dizerem o mesmo curso. Com várias, vale a gravada, se ainda é oferta do processo.
 */
function primeiraOpcaoInicial(
  inscricao: GravadaDaInscricao,
  ofertas: readonly OfertaDaInscricao[],
): string | null {
  if (ofertas.length === 1) return ofertas[0].id;
  return ofertas.find((o) => o.id === inscricao.ofertaCursoId)?.id ?? null;
}

/** A 2ª opção só vale com a 1ª, com 2 opções admitidas e sendo outra oferta. */
function segundaOpcaoInicial(
  inscricao: GravadaDaInscricao,
  ofertas: readonly OfertaDaInscricao[],
  numeroDeOpcoes: 1 | 2,
  primeira: string | null,
): string | null {
  if (numeroDeOpcoes !== 2 || primeira === null) return null;
  const gravada = inscricao.ofertaCursoSegundaOpcaoId;
  return ofertas.find((o) => o.id === gravada && o.id !== primeira)?.id ?? null;
}

/** A escolha com que a tela abre: a 1ª e a 2ª opção, cada uma pela sua regra. */
export function escolhaInicialDeOfertas(
  inscricao: GravadaDaInscricao,
  ofertas: readonly OfertaDaInscricao[],
  numeroDeOpcoes: 1 | 2,
): EscolhaDeOfertas {
  const oferta = primeiraOpcaoInicial(inscricao, ofertas);
  return { oferta, segunda: segundaOpcaoInicial(inscricao, ofertas, numeroDeOpcoes, oferta) };
}
