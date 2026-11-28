type Campos = Readonly<Record<string, unknown>>;

/**
 * Compara conteúdo, não a ordem em que os campos foram escritos.
 *
 * A projeção da leitura e a do formulário montam os mesmos objetos em ordens
 * diferentes; comparar a serialização daria "diferente" para dado igual. O efeito seria
 * reconstruir os controles a cada tecla, tirando o foco do campo em que se está digitando: um
 * sintoma que não se parece nem um pouco com a causa.
 *
 * Campo `undefined` vale como campo ausente; `null` é um valor e não vale como ausente. A ordem
 * dos itens de uma lista importa. Referências iguais encerram a comparação sem descer.
 */
export function mesmoConteudo(umLado: unknown, outroLado: unknown): boolean {
  if (Object.is(umLado, outroLado)) return true;
  if (Array.isArray(umLado) || Array.isArray(outroLado)) {
    return mesmasListas(umLado, outroLado);
  }
  if (ehObjeto(umLado) && ehObjeto(outroLado)) return mesmosCampos(umLado, outroLado);
  return false;
}

function ehObjeto(valor: unknown): valor is Campos {
  return valor !== null && typeof valor === 'object';
}

function mesmasListas(umLado: unknown, outroLado: unknown): boolean {
  if (!Array.isArray(umLado) || !Array.isArray(outroLado)) return false;
  if (umLado.length !== outroLado.length) return false;
  for (let posicao = 0; posicao < umLado.length; posicao++) {
    if (!mesmoConteudo(umLado[posicao], outroLado[posicao])) return false;
  }
  return true;
}

function camposPreenchidos(objeto: Campos): string[] {
  return Object.keys(objeto).filter((chave) => objeto[chave] !== undefined);
}

function mesmosCampos(umLado: Campos, outroLado: Campos): boolean {
  const chaves = camposPreenchidos(umLado);
  return (
    chaves.length === camposPreenchidos(outroLado).length &&
    chaves.every((chave) => mesmoConteudo(umLado[chave], outroLado[chave]))
  );
}
