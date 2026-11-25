import type { DocumentoNaTela, ItemDeComprovacao } from './regras-de-documentos';
import { ehEscolha, textoDaUnidade } from './textos-das-regras-de-documentos';

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
  anteriores: readonly ItemDeComprovacao[] | null,
  atuais: readonly ItemDeComprovacao[] | null,
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
    if (!depois.has(id) && !integranteFoiRemovido(anterior, integrantesNoFormulario)) {
      frases.push(`Deixou de ser exigido: ${anterior.texto}.`);
    }
  }
  return frases;
}

function integranteFoiRemovido(unidade: Unidade, integrantes: ReadonlySet<string>): boolean {
  return unidade.integrantes.length > 0 && unidade.integrantes.every((id) => !integrantes.has(id));
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

function unidades(elemento: ItemDeComprovacao): readonly Unidade[] {
  if (elemento.forma === 'DOCUMENTO') return unidadesDoDocumento(elemento.documento);
  if (!ehEscolha(elemento)) return elemento.itens.flatMap(unidades);
  return algoPedido(elemento) ? [unidadeDaEscolha(elemento)] : [];
}

function unidadesDoDocumento(documento: DocumentoNaTela): readonly Unidade[] {
  return documento.exigidas.map((exigencia) => ({
    id: exigencia.chave,
    escolha: false,
    texto: exigencia.texto,
    conteudo: exigencia.chave,
    integrantes: integrantesDe([exigencia.chave]),
  }));
}

function unidadeDaEscolha(elemento: Exclude<ItemDeComprovacao, { forma: 'DOCUMENTO' }>): Unidade {
  return {
    id: elemento.chave,
    escolha: true,
    texto: textoDaUnidade(elemento).texto,
    conteudo: conteudoDe(elemento),
    integrantes: integrantesDe(chavesDe(elemento)),
  };
}

/** A estrutura da regra com as exigências de cada regra de documento — as do item juntado, uma por integrante. */
function conteudoDe(elemento: ItemDeComprovacao): string {
  if (elemento.forma === 'DOCUMENTO') return chavesDoDocumento(elemento.documento).join('+');
  return `${elemento.forma}${elemento.minimo}(${elemento.itens.map(conteudoDe).join(',')})`;
}

function chavesDe(elemento: ItemDeComprovacao): readonly string[] {
  return elemento.forma === 'DOCUMENTO'
    ? chavesDoDocumento(elemento.documento)
    : elemento.itens.flatMap(chavesDe);
}

/** As chaves `exigência:ocorrência` da regra de documento: as do item juntado, ou a dela. */
function chavesDoDocumento(documento: DocumentoNaTela): readonly string[] {
  return documento.juntado ? documento.exigidas.map((e) => e.chave) : [documento.chave];
}

/** As ocorrências de integrante nas chaves `exigência:ocorrência`. */
function integrantesDe(chaves: readonly string[]): readonly string[] {
  return [...new Set(chaves.map((c) => c.slice(c.indexOf(':') + 1)).filter((o) => o !== ''))];
}

function algoPedido(elemento: ItemDeComprovacao): boolean {
  return elemento.forma === 'DOCUMENTO'
    ? elemento.documento.exigido
    : elemento.itens.some(algoPedido);
}
