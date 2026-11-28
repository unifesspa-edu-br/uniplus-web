const TAMANHO_MAXIMO_DA_CHAVE = 64;
const FORMATO_DA_CHAVE = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;

/** A parte nova de um documento da configuração que recebe chave. */
export interface PedidoDeChave {
  /** O prefixo da parte: `fase`, `etapa`, `item`, `nivel`, `banca` ou `exigencia`. */
  readonly tipo: string;
  /**
   * O texto da chave: o código do catálogo (tipo de fase, de etapa, de banca ou de documento) ou,
   * para o item de avaliação e o nível de atendimento, o rótulo. Pode estar vazio.
   */
  readonly nome: string;
  /**
   * Toda chave que a nova não pode repetir: as das partes existentes do mesmo tipo e escopo e
   * todas as referências `*Chave` do documento, inclusive as que citam uma parte já excluída.
   */
  readonly tomadas: ReadonlySet<string>;
}

/** Confere o formato que a API aceita: minúsculas, dígitos e sublinhados entre palavras, de 1 a 64 caracteres. */
export function formatoDaChaveValido(chave: string): boolean {
  return chave.length <= TAMANHO_MAXIMO_DA_CHAVE && FORMATO_DA_CHAVE.test(chave);
}

/**
 * Forma a chave local de uma parte nova: o prefixo, um sublinhado e o texto sem acento, em
 * minúsculas, com o que não é letra ou dígito virando um só sublinhado. O prefixo não se repete
 * quando o texto é igual a ele ou já começa por ele e um sublinhado. Em colisão com uma chave
 * tomada, acrescenta o menor sufixo livre (`_2`, `_3`...). A chave devolvida tem formato válido e
 * até 64 caracteres, cortada na última palavra inteira que cabe junto do sufixo.
 *
 * Só se chama na criação da parte: a chave não muda ao renomear, reordenar nem trocar o tipo.
 */
export function novaChave({ tipo, nome, tomadas }: PedidoDeChave): string {
  const base = baseDaChave(tipo, textoNormalizado(nome));
  let numero = 1;
  while (tomadas.has(candidata(base, numero))) numero++;
  return candidata(base, numero);
}

function textoNormalizado(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '');
}

function baseDaChave(prefixo: string, texto: string): string {
  if (texto === '') return prefixo;
  const jaTemPrefixo = texto === prefixo || texto.startsWith(`${prefixo}_`);
  return jaTemPrefixo ? texto : `${prefixo}_${texto}`;
}

function candidata(base: string, numero: number): string {
  if (numero === 1) return cortarEmPalavras(base, TAMANHO_MAXIMO_DA_CHAVE);
  const sufixo = `_${numero}`;
  return cortarEmPalavras(base, TAMANHO_MAXIMO_DA_CHAVE - sufixo.length) + sufixo;
}

function cortarEmPalavras(chave: string, tamanho: number): string {
  if (chave.length <= tamanho) return chave;
  const limite = chave[tamanho] === '_' ? tamanho : chave.lastIndexOf('_', tamanho);
  return chave.slice(0, limite > 0 ? limite : tamanho);
}
