const TAMANHO_MAXIMO_DA_CHAVE = 64;
const TAMANHO_MAXIMO_DO_PREFIXO = 32;
const FORMATO_DA_CHAVE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/** A parte nova de um documento da configuração que recebe chave. */
export interface PedidoDeChave {
  /** O tipo da parte (por exemplo `etapa`, `fase`, `banca`), já no formato da chave. */
  readonly tipo: string;
  /** O nome informado na criação; pode estar vazio. */
  readonly nome: string;
  /**
   * Toda chave que a nova não pode repetir: as das partes existentes do mesmo tipo e escopo e
   * todas as referências `*Chave` do documento, inclusive as que citam uma parte já excluída.
   */
  readonly tomadas: ReadonlySet<string>;
}

/** Confere o formato que a API aceita: minúsculas, dígitos e hífens, de 1 a 64 caracteres. */
export function formatoDaChaveValido(chave: string): boolean {
  return chave.length <= TAMANHO_MAXIMO_DA_CHAVE && FORMATO_DA_CHAVE.test(chave);
}

/**
 * Forma a chave local de uma parte nova: o nome sem acento e separado por hífens, ou
 * `<tipo>-<N>` quando não há nome aproveitável. Em colisão com uma chave tomada, acrescenta o
 * menor sufixo livre (`-2`, `-3`...). O tipo entra no máximo com 32 caracteres e o sufixo
 * sempre cabe: a chave devolvida tem formato válido e até 64 caracteres.
 *
 * Só se chama na criação da parte: a chave não muda ao renomear nem ao reordenar.
 */
export function novaChave({ tipo, nome, tomadas }: PedidoDeChave): string {
  const slug = slugDoNome(nome);
  const prefixo = cortar(tipo, TAMANHO_MAXIMO_DO_PREFIXO);
  if (slug === '') return menorLivre((numero) => comSufixo(prefixo, numero), tomadas);

  const base = /^[a-z]/.test(slug) ? slug : `${prefixo}-${slug}`;
  return menorLivre((numero) => comSufixoDeColisao(base, numero), tomadas);
}

function slugDoNome(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
}

function comSufixoDeColisao(base: string, numero: number): string {
  return numero === 1 ? cortar(base, TAMANHO_MAXIMO_DA_CHAVE) : comSufixo(base, numero);
}

function comSufixo(base: string, numero: number): string {
  const sufixo = `-${numero}`;
  return cortar(base, TAMANHO_MAXIMO_DA_CHAVE - sufixo.length) + sufixo;
}

function cortar(chave: string, tamanho: number): string {
  return chave.slice(0, tamanho).replace(/-+$/u, '');
}

function menorLivre(candidata: (numero: number) => string, tomadas: ReadonlySet<string>): string {
  let numero = 1;
  while (tomadas.has(candidata(numero))) numero++;
  return candidata(numero);
}
