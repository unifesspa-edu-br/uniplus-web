import type {
  ConteudoDoFormulario as Conteudo,
  CaminhoDoCampo as Caminho,
} from '@uniplus/shared-ui/components';

function objeto(valor: unknown): valor is Readonly<Record<string, unknown>> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function posicaoDaParte(lista: readonly unknown[], chave: string): number {
  const indice = lista.findIndex(
    (item) => objeto(item) && (item['codigo'] ?? item['fatoCodigo']) === chave,
  );
  return indice >= 0 ? indice : Number(chave);
}

/** A pessoa localiza o problema pela posição, sem incluir os valores recusados na mensagem. */
export function localizacaoDaConversao(caminho: Caminho, conteudo?: Conteudo): string {
  let atual: unknown = conteudo;
  const partes = caminho.map((chave) => {
    if (Array.isArray(atual)) {
      const indice = posicaoDaParte(atual, chave);
      atual = atual[indice];
      return Number.isInteger(indice) ? String(indice) : chave;
    }
    atual = objeto(atual) ? atual[chave] : undefined;
    return chave;
  });
  return '/' + partes.map(escaparSegmento).join('/');
}

function escaparSegmento(parte: string): string {
  return parte.replaceAll('~', '~0').replaceAll('/', '~1');
}
