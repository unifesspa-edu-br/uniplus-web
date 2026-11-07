import type { ComprovanteDaInscricaoDto } from '@uniplus/shared-data/selecao';
import { nomesPelaOrdem } from '@uniplus/shared-ui/components';

/** Uma opção de curso do envio, como o comprovante a mostra. */
export interface OpcaoDeCursoExibida {
  /** "Curso" quando o processo admite uma só opção; senão "1ª opção" ou "2ª opção". */
  readonly rotulo: string;
  /** O nome do curso na versão da inscrição; nulo se a opção não foi declarada ou a versão não a nomeia. */
  readonly curso: string | null;
  /** O que a tela mostra da opção: o curso, ou que ela não foi declarada ou não tem nome. */
  readonly exibicao: string;
  /** Nulo quando a opção não foi declarada ou o processo não define pela inscrição as modalidades. */
  readonly modalidades: readonly string[] | null;
}

type OpcoesDoComprovante = Pick<
  ComprovanteDaInscricaoDto,
  'numeroDeOpcoesDeCurso' | 'opcoesDeCurso'
>;

const SEGUNDA_OPCAO = 2;

/**
 * Os cursos do envio na ordem das opções. A API só traz as opções declaradas; com 2 admitidas, a 2ª
 * aparece sempre, e a que o envio não declarou diz isso.
 */
export function opcoesDeCursoExibidas(comprovante: OpcoesDoComprovante): OpcaoDeCursoExibida[] {
  const declaradas = [...comprovante.opcoesDeCurso].sort((a, b) => a.ordem - b.ordem);
  const admitePar = comprovante.numeroDeOpcoesDeCurso >= SEGUNDA_OPCAO;
  const rotuloDa = (ordem: number): string =>
    admitePar || declaradas.length > 1 ? `${ordem}ª opção` : 'Curso';
  const exibidas = declaradas.map((o) => ({
    rotulo: rotuloDa(o.ordem),
    curso: o.nome,
    exibicao: o.nome ?? 'Curso não identificado',
    modalidades: o.modalidades ? nomesPelaOrdem(o.modalidades) : null,
  }));
  const segundaDeclarada = declaradas.some((o) => o.ordem === SEGUNDA_OPCAO);
  return admitePar && !segundaDeclarada
    ? [
        ...exibidas,
        {
          rotulo: rotuloDa(SEGUNDA_OPCAO),
          curso: null,
          exibicao: 'Não declarada',
          modalidades: null,
        },
      ]
    : exibidas;
}
