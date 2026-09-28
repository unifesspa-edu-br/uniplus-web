import { RegraCatalogoDto } from '@uniplus/shared-data/selecao';

/**
 * O que um `<select>` de regra exibe: `codigo` + `baseLegal` — os dois campos
 * legíveis que `RegraCatalogoDto` expõe. Nunca um mapa código→rótulo escrito
 * no frontend (`RegraCatalogoDto` não tem `nome` nem `descricao`).
 */
export interface RegraEscolhivel {
  readonly codigo: string;
  readonly versao: string;
  readonly baseLegal: string | null;
  /** O texto da regra, o mesmo na opção do seletor e na leitura em consulta. */
  readonly rotulo: string;
  /** O `value` da opção: `codigo|versao`, a forma que `lerChaveDaRegra` desfaz. */
  readonly chave: string;
  /**
   * Se a opção é a regra gravada. O `<select>` marca a escolha por `[selected]` em cada
   * opção, e não por `[value]` no próprio select: as opções nascem do `@for` depois do
   * binding, quando o catálogo chega, e o `[value]` aplicado antes delas não é reaplicado.
   */
  readonly selecionada: boolean;
}

/** A chave de uma regra no `<select>`: `codigo|versao`. */
export function chaveDaRegra(codigo: string, versao: string): string {
  return `${codigo}|${versao}`;
}

/** Desfaz `chaveDaRegra`; a opção vazia do select (`|`) dá código e versão vazios. */
export function lerChaveDaRegra(chave: string): { codigo: string; versao: string } {
  const [codigo = '', versao = ''] = chave.split('|');
  return { codigo, versao };
}

/**
 * As opções que o seletor de uma regra oferece: o catálogo carregado, mais a
 * entrada já gravada quando ela não está mais lá — regra reeditada ou
 * inativada no catálogo entre a gravação e a releitura (CA-08).
 *
 * Sem isto, reabrir um processo cuja regra saiu do catálogo mostraria o
 * `<select>` em branco, e o operador gravaria por cima sem perceber que
 * trocou de regra.
 */
export function regrasEscolhiveis(
  catalogo: readonly RegraCatalogoDto[],
  codigoSelecionado: string,
  versaoSelecionada: string,
): readonly RegraEscolhivel[] {
  const escolhivel = (
    codigo: string,
    versao: string,
    baseLegal: string | null,
  ): RegraEscolhivel => ({
    codigo,
    versao,
    baseLegal,
    rotulo: `${codigo} — ${baseLegal ?? 'base legal indisponível'}`,
    chave: chaveDaRegra(codigo, versao),
    selecionada: codigo === codigoSelecionado && versao === versaoSelecionada,
  });
  const opcoes = catalogo.map((regra) => escolhivel(regra.codigo, regra.versao, regra.baseLegal));

  if (codigoSelecionado === '' || opcoes.some((regra) => regra.selecionada)) return opcoes;

  return [...opcoes, escolhivel(codigoSelecionado, versaoSelecionada, null)];
}

/** O texto da regra escolhida entre as opções, ou `null` quando nenhuma foi escolhida. */
export function rotuloDaRegraEscolhida(opcoes: readonly RegraEscolhivel[]): string | null {
  return opcoes.find((opcao) => opcao.selecionada)?.rotulo ?? null;
}
