import { estaVazia, RESOLVIDO, VERDADEIRO } from './interpretador/logica';
import type { GrupoApresentado } from './formulario-do-candidato.model';
import { indiceDaOcorrenciaDoCandidato } from './interpretador/ocorrencia-do-candidato';
import { type OcorrenciaNaTela, ocorrenciasNaTela } from './ocorrencias-na-tela';
import type {
  CampoAvaliado,
  OcorrenciaSimulada,
  ValorJson,
} from './interpretador/regras-do-formulario';
import type {
  CampoNoPasso,
  GrupoNoPasso,
  PassoDoFormulario,
  TermoNoPasso,
} from './passos-do-formulario';

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
  /** O texto da pergunta, do aceite ou da confirmação; nunca a resposta dada. */
  readonly rotulo: string;
  /** O que falta é a confirmação do campo, não a resposta dele. */
  readonly naConfirmacao: boolean;
  /** Não há resposta: diferente da resposta dada que a regra recusa ou da confirmação que não confere. */
  readonly semResposta: boolean;
}

function pendenciaDe(campo: string, rotulo: string, semResposta: boolean): PendenciaDoPasso {
  return { campo, rotulo, naConfirmacao: false, semResposta };
}

/** O que a conferência sabe do preenchimento: as respostas dadas, os aceites e as confirmações. */
export interface PreenchimentoDoPasso {
  readonly aceitos: ReadonlySet<string>;
  readonly confirmacoes: ReadonlyMap<string, ProblemaDaConfirmacao>;
  /** Os fatos de resposta fixa sem valor, que não se cobram do candidato. */
  readonly semCobranca: ReadonlySet<string>;
  /** As respostas do formulário, por fato. */
  readonly respostas: Readonly<Record<string, ValorJson>>;
  /** As ocorrências de cada grupo, com as respostas de cada uma. */
  readonly grupos: Readonly<Record<string, readonly OcorrenciaSimulada[]>>;
}

/**
 * O que impede de dar o passo como pronto, na ordem da tela, pelo código com que a tela marca o campo,
 * o grupo, o subitem de uma ocorrência (`grupo.ocorrência.fato`) ou o termo. Lê a avaliação do
 * interpretador com o passo já concluído: o campo com regra violada ou que impede a inscrição, o
 * obrigatório que não resolveu, o grupo fora da contagem, sem resposta ou com subitem nessa situação —
 * cada subitem pendente conta, inclusive quando o grupo também está fora da contagem — e o termo
 * obrigatório sem aceite. A confirmação que falta ou não confere, dada pelo mesmo código, vem logo
 * depois da resposta do campo. `semResposta` olha a presença da resposta, não o estado da avaliação.
 */
export function pendenciasDo(
  passo: PassoDoFormulario,
  preenchimento: PreenchimentoDoPasso,
): PendenciaDoPasso[] {
  return [
    ...passo.campos.flatMap((c) => pendenciasDoCampo(c, preenchimento)),
    ...passo.grupos.flatMap((g) => pendenciasDoGrupo(g, preenchimento)),
    ...passo.termos
      .filter((t) => termoSemAceite(t, preenchimento.aceitos))
      .map((t) => pendenciaDe(t.termo.codigoNasRegras, t.termo.conteudo.nome, true)),
  ];
}

function pendenciasDoCampo(
  { campo, avaliado }: CampoNoPasso,
  preenchimento: PreenchimentoDoPasso,
): PendenciaDoPasso[] {
  const codigo = campo.fatoCodigo;
  const { rotulo } = campo.apresentacao;
  const daResposta =
    campoPendente(avaliado) && !preenchimento.semCobranca.has(codigo)
      ? [pendenciaDe(codigo, rotulo, faltaResposta(avaliado, preenchimento.respostas[codigo]))]
      : [];
  return [...daResposta, ...daConfirmacao(codigo, rotulo, preenchimento.confirmacoes)];
}

function daConfirmacao(
  campo: string,
  rotulo: string,
  confirmacoes: ReadonlyMap<string, ProblemaDaConfirmacao>,
): PendenciaDoPasso[] {
  const problema = confirmacoes.get(campo);
  if (problema === undefined) return [];
  const semResposta = problema === 'em-branco';
  return [{ campo, rotulo: `Confirme ${rotulo}`, naConfirmacao: true, semResposta }];
}

function campoPendente(avaliado: CampoAvaliado): boolean {
  return (
    avaliado.regras.restricoesVioladas.length > 0 ||
    avaliado.regras.impedido === VERDADEIRO ||
    (avaliado.regras.obrigatorio === VERDADEIRO && avaliado.estado !== RESOLVIDO)
  );
}

/** O obrigatório que não resolveu e não tem resposta: o que falta é responder, não corrigir. */
function faltaResposta(avaliado: CampoAvaliado, resposta: ValorJson | undefined): boolean {
  return (
    avaliado.regras.obrigatorio === VERDADEIRO &&
    avaliado.estado !== RESOLVIDO &&
    estaVazia(resposta)
  );
}

/**
 * As pendências do grupo: o próprio grupo na contagem ou na ocorrência do candidato inválida, seguido de
 * todo subitem pendente, na resposta ou na confirmação; sem nenhum dos dois, o próprio grupo no
 * obrigatório não resolvido, que só é "sem resposta" se nenhuma ocorrência tem resposta.
 */
function pendenciasDoGrupo(
  noPasso: GrupoNoPasso,
  preenchimento: PreenchimentoDoPasso,
): PendenciaDoPasso[] {
  const { grupo, avaliado } = noPasso;
  const dosSubitens = pendenciasDosSubitens(noPasso, preenchimento);
  const { contagemValida, ocorrenciaDoCandidatoValida } = avaliado.ocorrencias;
  if (!contagemValida || !ocorrenciaDoCandidatoValida)
    return [pendenciaDe(grupo.codigo, grupo.rotulo, false), ...dosSubitens];
  if (dosSubitens.length > 0) return dosSubitens;
  if (avaliado.regras.obrigatorio !== VERDADEIRO || avaliado.estado === RESOLVIDO) return [];
  const vazio = (preenchimento.grupos[grupo.codigo] ?? []).every(semRespostas);
  return [pendenciaDe(grupo.codigo, grupo.rotulo, vazio)];
}

function semRespostas(ocorrencia: OcorrenciaSimulada): boolean {
  return Object.values(ocorrencia.respostas ?? {}).every(estaVazia);
}

/** Os subitens como a tela os mostra: por ocorrência, na ordem dos subitens, só os que aparecem. */
function pendenciasDosSubitens(
  noPasso: GrupoNoPasso,
  preenchimento: PreenchimentoDoPasso,
): PendenciaDoPasso[] {
  const lista = preenchimento.grupos[noPasso.grupo.codigo] ?? [];
  const doCandidato = indiceDaOcorrenciaDoCandidato(
    noPasso.grupo.ocorrencias.incluiCandidato,
    lista.map((o) => o.respostas),
  );
  return ocorrenciasNaTela(noPasso, lista, doCandidato).flatMap((ocorrencia) =>
    ocorrencia.campos.flatMap((campo) =>
      pendenciasDoSubitem(noPasso.grupo.codigo, ocorrencia, campo, preenchimento),
    ),
  );
}

/** O texto do subitem na tela; sem texto próprio, o do grupo. */
export function rotuloDoSubitem(grupo: GrupoApresentado, subitem: CampoAvaliado): string {
  return (
    grupo.subitens.find((s) => s.fatoCodigo === subitem.fatoCodigo)?.apresentacao.rotulo ??
    grupo.rotulo
  );
}

/** A pergunta do subitem com a ocorrência a que pertence, como a tela a titula. */
function pendenciasDoSubitem(
  codigoDoGrupo: string,
  ocorrencia: OcorrenciaNaTela,
  { campo, avaliado }: CampoNoPasso,
  preenchimento: PreenchimentoDoPasso,
): PendenciaDoPasso[] {
  const caminho = `${codigoDoGrupo}.${ocorrencia.id}.${campo.fatoCodigo}`;
  const rotulo = `${campo.apresentacao.rotulo} (${ocorrencia.titulo})`;
  const resposta = ocorrencia.respostas[campo.fatoCodigo];
  const daResposta = campoPendente(avaliado)
    ? [pendenciaDe(caminho, rotulo, faltaResposta(avaliado, resposta))]
    : [];
  return [...daResposta, ...daConfirmacao(caminho, rotulo, preenchimento.confirmacoes)];
}
