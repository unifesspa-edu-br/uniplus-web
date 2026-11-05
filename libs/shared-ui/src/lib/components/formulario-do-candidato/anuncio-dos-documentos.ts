import type { DocumentoNaTela, NoDeDocumentos } from './arvore-de-documentos';
import { ehEscolha, textoDaUnidade } from './textos-da-arvore-de-documentos';

/**
 * O que dizer quando os documentos exigidos mudam, uma frase por unidade: cada documento fora de
 * escolha, por integrante quando se repete, e cada escolha inteira. A escolha que continua só é
 * anunciada quando o conteúdo dela muda — as exigências e os integrantes, não o nome que eles têm na
 * tela, que muda quando outro integrante sai. O que sai porque o candidato tirou o integrante do
 * formulário não é anunciado: foi ele quem tirou, e o título antigo já pode ser o de outro integrante.
 * A primeira avaliação não é mudança.
 *
 * @param integrantesNoFormulario As ocorrências que os grupos do formulário têm agora.
 */
export function anunciarMudancaDosDocumentos(
  anteriores: readonly NoDeDocumentos[] | null,
  atuais: readonly NoDeDocumentos[] | null,
  integrantesNoFormulario: ReadonlySet<string>,
): string {
  if (anteriores === null || atuais === null) return '';
  const antes = new Map(anteriores.flatMap(unidades).map((u) => [u.id, u]));
  const depois = new Map(atuais.flatMap(unidades).map((u) => [u.id, u]));
  return [
    ...frasesDoQueEntrou(antes, depois),
    ...frasesDoQueSaiu(antes, depois, integrantesNoFormulario),
  ].join(' ');
}

function frasesDoQueEntrou(
  antes: ReadonlyMap<string, Unidade>,
  depois: ReadonlyMap<string, Unidade>,
): string[] {
  const frases: string[] = [];
  for (const [id, atual] of depois) {
    const anterior = antes.get(id);
    if (!anterior) {
      frases.push(`Passou a ser exigido${atual.escolha ? ', à sua escolha' : ''}: ${atual.texto}.`);
    } else if (atual.escolha && anterior.conteudo !== atual.conteudo) {
      frases.push(`Mudou a escolha: ${atual.texto}.`);
    }
  }
  return frases;
}

function frasesDoQueSaiu(
  antes: ReadonlyMap<string, Unidade>,
  depois: ReadonlyMap<string, Unidade>,
  integrantesNoFormulario: ReadonlySet<string>,
): string[] {
  const frases: string[] = [];
  for (const [id, anterior] of antes) {
    const integranteRemovido =
      anterior.integrantes.length > 0 &&
      anterior.integrantes.every((o) => !integrantesNoFormulario.has(o));
    if (!depois.has(id) && !integranteRemovido) {
      frases.push(`Deixou de ser exigido: ${anterior.texto}.`);
    }
  }
  return frases;
}

/**
 * O que se anuncia: um documento pedido, ou uma escolha em que algo já é pedido. O conteúdo identifica
 * a estrutura e as exigências de cada integrante, sem o texto.
 */
interface Unidade {
  readonly id: string;
  readonly escolha: boolean;
  readonly texto: string;
  readonly conteudo: string;
  /** As ocorrências dos integrantes a que a unidade se liga; vazia fora de repetição. */
  readonly integrantes: readonly string[];
}

function unidades(no: NoDeDocumentos): readonly Unidade[] {
  if (no.tipo === 'DOCUMENTO') {
    return no.documento.exigidas.map((e) => ({
      id: e.chave,
      escolha: false,
      texto: e.texto,
      conteudo: e.chave,
      integrantes: integrantesDe([e.chave]),
    }));
  }
  if (!ehEscolha(no)) return no.itens.flatMap(unidades);
  if (!algoPedido(no)) return [];
  return [
    {
      id: no.chave,
      escolha: true,
      texto: textoDaUnidade(no).texto,
      conteudo: conteudoDe(no),
      integrantes: integrantesDe(chavesDe(no)),
    },
  ];
}

/** A estrutura do nó com as exigências de cada folha — as do item juntado, uma por integrante. */
function conteudoDe(no: NoDeDocumentos): string {
  if (no.tipo === 'DOCUMENTO') return chavesDaFolha(no.documento).join('+');
  return `${no.tipo}${no.minimo}(${no.itens.map(conteudoDe).join(',')})`;
}

function chavesDe(no: NoDeDocumentos): readonly string[] {
  return no.tipo === 'DOCUMENTO' ? chavesDaFolha(no.documento) : no.itens.flatMap(chavesDe);
}

/** As chaves `exigência:ocorrência` da folha: as do item juntado, ou a dela. */
function chavesDaFolha(documento: DocumentoNaTela): readonly string[] {
  return documento.juntado ? documento.exigidas.map((e) => e.chave) : [documento.chave];
}

/** As ocorrências de integrante nas chaves `exigência:ocorrência`. */
function integrantesDe(chaves: readonly string[]): readonly string[] {
  return [...new Set(chaves.map((c) => c.slice(c.indexOf(':') + 1)).filter((o) => o !== ''))];
}

function algoPedido(no: NoDeDocumentos): boolean {
  return no.tipo === 'DOCUMENTO' ? no.documento.exigido : no.itens.some(algoPedido);
}
