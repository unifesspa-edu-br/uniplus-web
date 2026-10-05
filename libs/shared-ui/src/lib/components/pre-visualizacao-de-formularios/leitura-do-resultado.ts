import { FINALIDADES } from '../editor-de-formulario/formulario-editavel';
import type { DocumentoAvaliado, ResultadoDaPreVisualizacao } from './pre-visualizacao-de-formularios';

/** Os documentos de uma fase, na ordem da árvore de exigências. */
export interface DocumentosDaFase {
  readonly chave: string;
  readonly nome: string;
  readonly documentos: readonly DocumentoAvaliado[];
}

/**
 * O resumo da avaliação, anunciado ao leitor de tela: os campos exibidos e obrigatórios, os grupos
 * exibidos, os documentos exigidos e a definir, as respostas que impediriam a inscrição e os grupos
 * cujas ocorrências não valem como resposta — a quantidade fora do que o grupo pede, ou a
 * ocorrência do candidato faltando ou repetida.
 */
export function resumoDaPreVisualizacao({ formularios, documentos }: ResultadoDaPreVisualizacao): string {
  const itens = formularios.flatMap((avaliado) => avaliado.itens);
  const grupos = formularios.flatMap((avaliado) => avaliado.grupos);
  const exibidos = itens.filter((item) => item.visivel === 'VERDADEIRO').length;
  const obrigatorios = itens.filter((item) => item.obrigatorio === 'VERDADEIRO').length;
  const impedimentos = itens.filter((item) => item.impedido === 'VERDADEIRO').length;
  const gruposExibidos = grupos.filter((grupo) => grupo.visivel === 'VERDADEIRO').length;
  const foraDoQuePedem = grupos.filter((grupo) => !grupo.contagemValida || !grupo.ocorrenciaDoCandidatoValida).length;

  const frases = [`Pré-visualização pronta: ${exibidos} de ${itens.length} campos exibidos, ${obrigatorios} obrigatórios.`];
  if (grupos.length > 0) frases.push(`${gruposExibidos} de ${grupos.length} grupos repetíveis exibidos.`);
  // Quem não tem exigências — o modelo da Configuração — não fala de documentos.
  if (documentos !== null) {
    const exigidos = documentos.filter((documento) => documento.situacao === 'EXIGIDO').length;
    const aDefinir = documentos.filter((documento) => documento.situacao === 'INDETERMINADO').length;
    frases.push(`${exigidos} documento(s) exigido(s), ${aDefinir} a definir.`);
  }
  if (impedimentos > 0) frases.push(`A inscrição seria impedida por ${impedimentos} resposta(s).`);
  if (foraDoQuePedem > 0) frases.push(`Em ${foraDoQuePedem} grupo(s), as ocorrências simuladas não valem como resposta.`);
  return frases.join(' ');
}

/** Os documentos agrupados por fase, na ordem do cronograma; dentro da fase, na ordem da árvore. */
export function documentosPorFase(documentos: readonly DocumentoAvaliado[]): readonly DocumentosDaFase[] {
  const porFase = new Map<string, { readonly fase: DocumentoAvaliado['fase']; readonly documentos: DocumentoAvaliado[] }>();
  for (const documento of documentos) {
    const fase = porFase.get(documento.fase.chave) ?? { fase: documento.fase, documentos: [] };
    fase.documentos.push(documento);
    porFase.set(documento.fase.chave, fase);
  }
  return [...porFase.values()]
    .sort((a, b) => a.fase.ordem - b.fase.ordem)
    .map(({ fase, documentos: daFase }) => ({ chave: fase.chave, nome: fase.nome, documentos: daFase }));
}

/** Os documentos de um formulário, por fase; `finalidade` nula é o que se exige fora de formulário. */
export interface DocumentosDoFormulario {
  readonly finalidade: string | null;
  readonly fases: readonly DocumentosDaFase[];
}

/**
 * Os documentos agrupados pelo formulário em cujo bloco de comprovação são apresentados — inscrição
 * e isenção podem dividir a fase, e cada formulário lista só os seus —, na ordem em que o candidato
 * responde os formulários, e o que se exige fora de formulário por último. Dentro de cada um, por fase.
 */
export function documentosPorFormulario(documentos: readonly DocumentoAvaliado[]): readonly DocumentosDoFormulario[] {
  const ordem: readonly (string | null)[] = [...FINALIDADES.map((opcao) => opcao.valor), null];
  const finalidades = [...new Set(documentos.map((documento) => documento.finalidade))].sort(
    (uma, outra) => ordem.indexOf(uma) - ordem.indexOf(outra),
  );
  return finalidades.map((finalidade) => ({
    finalidade,
    fases: documentosPorFase(documentos.filter((documento) => documento.finalidade === finalidade)),
  }));
}

/**
 * Uma letra para cada grupo de alternativas, na ordem em que aparece. O grupo não tem nome — a
 * identidade é interna —, e a letra diz quais documentos se substituem uns aos outros.
 */
export function letrasDasAlternativas(documentos: readonly DocumentoAvaliado[]): ReadonlyMap<string, string> {
  const letras = new Map<string, string>();
  for (const { grupoId } of documentos.flatMap((documento) => documento.alternativas)) {
    if (!letras.has(grupoId)) letras.set(grupoId, letraDaPosicao(letras.size));
  }
  return letras;
}

/** Os grupos de alternativas do documento, do mais externo ao mais interno, com o mínimo que cada um pede. */
export function textoDasAlternativas(documento: DocumentoAvaliado, letras: ReadonlyMap<string, string>): string {
  if (documento.alternativas.length === 0) return '—';
  return documento.alternativas
    .map((alternativa) => `Grupo ${letras.get(alternativa.grupoId) ?? '?'} (basta ${alternativa.minimo})`)
    .join(' › ');
}

/** A, B, …, Z, AA, AB, … */
function letraDaPosicao(posicao: number): string {
  const letra = String.fromCharCode(65 + (posicao % 26));
  return posicao < 26 ? letra : `${letraDaPosicao(Math.floor(posicao / 26) - 1)}${letra}`;
}
