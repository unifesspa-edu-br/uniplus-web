import { RESOLVIDO, VERDADEIRO } from './interpretador/logica';
import type { CampoAvaliado } from './interpretador/regras-do-formulario';
import type { GrupoNoPasso, PassoDoFormulario, TermoNoPasso } from './passos-do-formulario';

const VISIVEL = 'VERDADEIRO';

/** O termo obrigatório ainda sem aceite. */
export function termoSemAceite(termo: TermoNoPasso, aceitos: ReadonlySet<string>): boolean {
  return termo.avaliado.obrigatorio === VERDADEIRO && !aceitos.has(termo.termo.codigo);
}

/**
 * O que a confirmação digitada de um campo que pede confirmação tem de errado: a que não confere com a
 * resposta ou a que falta, para toda resposta dada — gravada ou digitada nesta sessão.
 */
export type ProblemaDaConfirmacao = 'diverge' | 'em-branco';

/** Uma pendência do passo: o código com que a tela marca o que falta e, se for o caso, que é a confirmação. */
export interface PendenciaDoPasso {
  readonly campo: string;
  /** O que falta é a confirmação do campo, não a resposta dele. */
  readonly naConfirmacao: boolean;
}

function daResposta(campo: string): PendenciaDoPasso {
  return { campo, naConfirmacao: false };
}

/**
 * O que impede de dar o passo como pronto, na ordem da tela, pelo código com que a tela marca o campo,
 * o grupo, o subitem de uma ocorrência (`grupo.ocorrência.fato`) ou o termo. Lê a avaliação do
 * interpretador com o passo já concluído: o campo com regra violada ou que impede a inscrição, o
 * obrigatório que não resolveu, o grupo fora da contagem, sem resposta ou com subitem nessa situação e
 * o termo obrigatório sem aceite. A confirmação que falta ou não confere, dada pelo mesmo código, vem
 * logo depois da resposta do campo.
 */
export function pendenciasDo(
  passo: PassoDoFormulario,
  aceitos: ReadonlySet<string>,
  confirmacoes: ReadonlyMap<string, ProblemaDaConfirmacao>,
  semCobranca: ReadonlySet<string> = new Set(),
): PendenciaDoPasso[] {
  return [
    ...passo.campos.flatMap((c) => [
      ...(campoPendente(c.avaliado) && !semCobranca.has(c.campo.fatoCodigo)
        ? [daResposta(c.campo.fatoCodigo)]
        : []),
      ...(confirmacoes.has(c.campo.fatoCodigo)
        ? [{ campo: c.campo.fatoCodigo, naConfirmacao: true }]
        : []),
    ]),
    ...passo.grupos.flatMap((g) => {
      const pendencia = pendenciaDoGrupo(g, confirmacoes);
      return pendencia === null ? [] : [pendencia];
    }),
    ...passo.termos
      .filter((t) => termoSemAceite(t, aceitos))
      .map((t) => daResposta(t.termo.codigo)),
  ];
}

function campoPendente(avaliado: CampoAvaliado): boolean {
  return (
    avaliado.restricoesVioladas.length > 0 ||
    avaliado.impedido === VERDADEIRO ||
    (avaliado.obrigatorio === VERDADEIRO && avaliado.estado !== RESOLVIDO)
  );
}

/**
 * A pendência do grupo, quando há: o próprio grupo na contagem inválida, na ocorrência do candidato
 * inválida e no obrigatório sem resposta; o primeiro subitem pendente, na resposta ou na confirmação,
 * quando é ele que falta.
 */
function pendenciaDoGrupo(
  { grupo, avaliado }: GrupoNoPasso,
  confirmacoes: ReadonlyMap<string, ProblemaDaConfirmacao>,
): PendenciaDoPasso | null {
  if (!avaliado.contagemValida || !avaliado.ocorrenciaDoCandidatoValida)
    return daResposta(grupo.codigo);
  for (const ocorrencia of avaliado.ocorrencias) {
    for (const subitem of ocorrencia.campos) {
      if (subitem.visivel !== VISIVEL) continue;
      const caminho = `${grupo.codigo}.${ocorrencia.id}.${subitem.fatoCodigo}`;
      if (campoPendente(subitem)) return daResposta(caminho);
      if (confirmacoes.has(caminho)) return { campo: caminho, naConfirmacao: true };
    }
  }
  return avaliado.obrigatorio === VERDADEIRO && avaliado.estado !== RESOLVIDO
    ? daResposta(grupo.codigo)
    : null;
}
