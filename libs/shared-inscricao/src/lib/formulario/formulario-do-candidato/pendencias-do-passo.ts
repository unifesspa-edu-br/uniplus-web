import { RESOLVIDO, VERDADEIRO } from './interpretador/logica';
import type { CampoAvaliado, OcorrenciaAvaliada } from './interpretador/regras-do-formulario';
import type {
  CampoNoPasso,
  GrupoNoPasso,
  PassoDoFormulario,
  TermoNoPasso,
} from './passos-do-formulario';

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
    ...passo.campos.flatMap((c) => pendenciasDoCampo(c, confirmacoes, semCobranca)),
    ...passo.grupos.map((g) => pendenciaDoGrupo(g, confirmacoes)).filter((p) => p !== null),
    ...passo.termos
      .filter((t) => termoSemAceite(t, aceitos))
      .map((t) => daResposta(t.termo.codigoNasRegras)),
  ];
}

function pendenciasDoCampo(
  { campo, avaliado }: CampoNoPasso,
  confirmacoes: ReadonlyMap<string, ProblemaDaConfirmacao>,
  semCobranca: ReadonlySet<string>,
): PendenciaDoPasso[] {
  const codigo = campo.fatoCodigo;
  return [
    ...(campoPendente(avaliado) && !semCobranca.has(codigo) ? [daResposta(codigo)] : []),
    ...(confirmacoes.has(codigo) ? [{ campo: codigo, naConfirmacao: true }] : []),
  ];
}

function campoPendente(avaliado: CampoAvaliado): boolean {
  return (
    avaliado.regras.restricoesVioladas.length > 0 ||
    avaliado.regras.impedido === VERDADEIRO ||
    (avaliado.regras.obrigatorio === VERDADEIRO && avaliado.estado !== RESOLVIDO)
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
  const { regras, ocorrencias } = avaliado;
  if (!ocorrencias.contagemValida || !ocorrencias.ocorrenciaDoCandidatoValida)
    return daResposta(grupo.codigo);
  const doSubitem = pendenciaDosSubitens(grupo.codigo, ocorrencias.lista, confirmacoes);
  if (doSubitem !== null) return doSubitem;
  return regras.obrigatorio === VERDADEIRO && avaliado.estado !== RESOLVIDO
    ? daResposta(grupo.codigo)
    : null;
}

function pendenciaDosSubitens(
  grupo: string,
  ocorrencias: readonly OcorrenciaAvaliada[],
  confirmacoes: ReadonlyMap<string, ProblemaDaConfirmacao>,
): PendenciaDoPasso | null {
  for (const ocorrencia of ocorrencias) {
    for (const subitem of ocorrencia.campos) {
      const caminho = `${grupo}.${ocorrencia.id}.${subitem.fatoCodigo}`;
      const pendencia = pendenciaDoSubitem(caminho, subitem, confirmacoes);
      if (pendencia !== null) return pendencia;
    }
  }
  return null;
}

function pendenciaDoSubitem(
  caminho: string,
  subitem: CampoAvaliado,
  confirmacoes: ReadonlyMap<string, ProblemaDaConfirmacao>,
): PendenciaDoPasso | null {
  if (subitem.regras.visivel !== VISIVEL) return null;
  if (campoPendente(subitem)) return daResposta(caminho);
  return confirmacoes.has(caminho) ? { campo: caminho, naConfirmacao: true } : null;
}
