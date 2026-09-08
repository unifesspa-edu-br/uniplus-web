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
  const opcoes: RegraEscolhivel[] = catalogo.map((regra) => ({
    codigo: regra.codigo,
    versao: regra.versao,
    baseLegal: regra.baseLegal,
  }));

  if (codigoSelecionado === '') return opcoes;

  const jaPresente = opcoes.some(
    (regra) => regra.codigo === codigoSelecionado && regra.versao === versaoSelecionada,
  );
  if (jaPresente) return opcoes;

  return [...opcoes, { codigo: codigoSelecionado, versao: versaoSelecionada, baseLegal: null }];
}
