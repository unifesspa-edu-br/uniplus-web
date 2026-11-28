import {
  distanciaVertical,
  ehVisivel,
  irmaoVisivel,
  type Arvore,
  type NoComEstilo,
  type NoComTexto,
  type NoDaPagina,
  type Retangulo,
} from './coleta-da-pagina';

/** Regras do ritmo vertical sobre dados já coletados da página: funções puras, sem DOM. */

const DISTANCIA_MINIMA_DO_TITULO = 20;
const DISTANCIA_MINIMA_DO_ALERTA_OU_DICA = 16;

const PROXIMIDADE_INTENCIONAL = {
  tags: ['input', 'select', 'textarea', 'label'],
  classes: ['input', 'field__hint', 'field__erro', 'regra-explicada'],
};
const LARGURA_INTEIRA = {
  tags: ['details'],
  classes: ['field__hint', 'alert', 'form-grid', 'checkbox-grid'],
};
const CONTROLES = [
  'button',
  'input',
  'select',
  'textarea',
  'img',
  'svg',
  'video',
  'canvas',
  'iframe',
];

interface Criterio {
  readonly tags: readonly string[];
  readonly classes: readonly string[];
}

function corresponde(no: NoDaPagina, criterio: Criterio): boolean {
  return criterio.tags.includes(no.tag) || no.classes.some((c) => criterio.classes.includes(c));
}

function indicesComClasse(arvore: Arvore<NoComTexto>, classes: readonly string[]): number[] {
  const criterio = { tags: [], classes };
  return arvore.nos.flatMap((no, indice) =>
    indice > 0 && corresponde(no, criterio) ? [indice] : [],
  );
}

function tituloColado(arvore: Arvore<NoComTexto>, indice: number): boolean {
  const antes = ehVisivel(arvore.nos[indice]) ? irmaoVisivel(arvore, indice, -1) : null;
  return (
    antes !== null &&
    distanciaVertical(arvore.nos[antes].retangulo, arvore.nos[indice].retangulo) <
      DISTANCIA_MINIMA_DO_TITULO
  );
}

function titulosColados(arvore: Arvore<NoComTexto>): string[] {
  return indicesComClasse(arvore, ['step-section__title', 'form-section__title'])
    .filter((indice) => tituloColado(arvore, indice))
    .map((indice) => `título "${arvore.nos[indice].texto}"`);
}

function blocoColadoNoIrmao(bloco: NoComTexto, depois: NoComTexto): string | null {
  const colado =
    !corresponde(depois, PROXIMIDADE_INTENCIONAL) &&
    distanciaVertical(bloco.retangulo, depois.retangulo) < DISTANCIA_MINIMA_DO_ALERTA_OU_DICA;
  return colado ? `bloco "${bloco.texto}"` : null;
}

function conteinerColado(arvore: Arvore<NoComTexto>, indice: number): string | null {
  const bloco = arvore.nos[indice];
  const pai = bloco.pai;
  const irmaoDoPai = pai > 0 ? irmaoVisivel(arvore, pai, 1) : null;
  const colado =
    irmaoDoPai !== null &&
    corresponde(arvore.nos[irmaoDoPai], LARGURA_INTEIRA) &&
    distanciaVertical(arvore.nos[pai].retangulo, arvore.nos[irmaoDoPai].retangulo) <
      DISTANCIA_MINIMA_DO_ALERTA_OU_DICA;
  return colado ? `contêiner da dica "${bloco.texto}"` : null;
}

function descreverBlocoColado(arvore: Arvore<NoComTexto>, indice: number): string | null {
  const depois = irmaoVisivel(arvore, indice, 1);
  return depois === null
    ? conteinerColado(arvore, indice)
    : blocoColadoNoIrmao(arvore.nos[indice], arvore.nos[depois]);
}

function alertasEDicasColados(arvore: Arvore<NoComTexto>): string[] {
  return indicesComClasse(arvore, ['alert', 'field__hint'])
    .filter((indice) => ehVisivel(arvore.nos[indice]))
    .map((indice) => descreverBlocoColado(arvore, indice))
    .filter((descricao): descricao is string => descricao !== null);
}

/** Títulos de seção, depois alertas e dicas, que estão mais próximos do vizinho que o ritmo pede. */
export function descreverBlocosColados(arvore: Arvore<NoComTexto>): string[] {
  return [...titulosColados(arvore), ...alertasEDicasColados(arvore)];
}

/** Espaço, em px inteiros, entre cada retângulo e o seguinte. */
export function espacosEntre(retangulos: readonly Retangulo[]): number[] {
  return retangulos
    .slice(1)
    .map((retangulo, indice) => Math.round(distanciaVertical(retangulos[indice], retangulo)));
}

function ehEmFluxo(no: NoComEstilo): boolean {
  const posicao = no.estilo.position;
  return !no.oculto && posicao !== 'absolute' && posicao !== 'fixed' && ehVisivel(no);
}

function desenhaNaBorda(no: NoComEstilo, lado: 'top' | 'bottom'): boolean {
  return (
    CONTROLES.includes(no.tag) ||
    parseFloat(no.estilo[`border-${lado}-width`]) > 0 ||
    parseFloat(no.estilo[`padding-${lado}`]) > 0 ||
    no.estilo['background-color'] !== 'rgba(0, 0, 0, 0)' ||
    no.estilo.overflow !== 'visible'
  );
}

function caracteresVisiveis(texto: string): number {
  return texto.replace(/\s/g, '').length;
}

// O texto dos descendentes também está no texto do elemento: o que sobra é o escrito direto nele.
function temTextoProprio(arvore: Arvore<NoComEstilo>, indice: number): boolean {
  const dosFilhos = arvore.filhos[indice].map((filho) =>
    caracteresVisiveis(arvore.nos[filho].textoCompleto),
  );
  const total = caracteresVisiveis(arvore.nos[indice].textoCompleto);
  return total > dosFilhos.reduce((soma, quantidade) => soma + quantidade, 0);
}

/*
 * Quem contém linhas de texto vale pela própria caixa: a caixa de um filho inline não
 * coincide com a da linha, e descer até ela mediria a entrelinha, não o espaço do passo.
 */
function contemLinhas(arvore: Arvore<NoComEstilo>, indice: number): boolean {
  const filhosInline = arvore.filhos[indice].some((filho) =>
    arvore.nos[filho].estilo.display.startsWith('inline'),
  );
  return temTextoProprio(arvore, indice) || filhosInline;
}

function filhosEmFluxo(arvore: Arvore<NoComEstilo>, indice: number): number[] {
  return arvore.filhos[indice].filter((filho) => ehEmFluxo(arvore.nos[filho]));
}

function filhosParaDescer(
  arvore: Arvore<NoComEstilo>,
  indice: number,
  lado: 'top' | 'bottom',
): number[] {
  const vale = desenhaNaBorda(arvore.nos[indice], lado) || contemLinhas(arvore, indice);
  return vale ? [] : filhosEmFluxo(arvore, indice);
}

function bordaVisual(arvore: Arvore<NoComEstilo>, indice: number, lado: 'top' | 'bottom'): number {
  const bordas = filhosParaDescer(arvore, indice, lado).map((filho) =>
    bordaVisual(arvore, filho, lado),
  );
  if (bordas.length === 0) return arvore.nos[indice].retangulo[lado];
  return lado === 'top' ? Math.min(...bordas) : Math.max(...bordas);
}

function rotuloDoBloco(no: NoComEstilo): string {
  return no.classes.length > 0 ? `.${no.classes[0]}` : no.tag;
}

// O `<form>` que embrulha os cartões só agrupa controles: os blocos dele são do passo.
function blocosDoPasso(arvore: Arvore<NoComEstilo>): number[] {
  return filhosEmFluxo(arvore, 0).flatMap((filho) =>
    arvore.nos[filho].tag === 'form' ? filhosEmFluxo(arvore, filho) : [filho],
  );
}

export interface EspacoEntreBlocos {
  readonly de: string;
  readonly para: string;
  readonly espaco: number;
}

/** Da borda visual de cada bloco do passo à do seguinte, na ordem do documento. */
export function espacosDosBlocosDoPasso(arvore: Arvore<NoComEstilo>): EspacoEntreBlocos[] {
  const blocos = arvore.nos.length === 0 ? [] : blocosDoPasso(arvore);
  return blocos.slice(1).map((bloco, posicao) => {
    const anterior = blocos[posicao];
    return {
      de: rotuloDoBloco(arvore.nos[anterior]),
      para: rotuloDoBloco(arvore.nos[bloco]),
      espaco: Math.round(
        bordaVisual(arvore, bloco, 'top') - bordaVisual(arvore, anterior, 'bottom'),
      ),
    };
  });
}
