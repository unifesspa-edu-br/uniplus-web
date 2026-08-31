/**
 * Formato fechado do código de cadastro institucional, tal como a API o valida:
 * inicia com letra maiúscula, segue com letras maiúsculas, dígitos e sublinhado,
 * de 2 a 50 caracteres.
 *
 * Vale para tipo de documento, tipo de deficiência, condição de atendimento,
 * categoria de documento e fato do candidato — todos com o mesmo value object do
 * lado do backend.
 */
export const CODIGO_CADASTRO_FORMATO = /^[A-Z][A-Z0-9_]{1,49}$/;

/** Comprimento máximo aceito, alinhado ao formato acima. */
export const CODIGO_CADASTRO_TAMANHO_MAXIMO = 50;

/**
 * Deriva do nome um código no formato fechado que a API exige: sem diacríticos,
 * em caixa alta, com não-alfanuméricos colapsados em sublinhado e as pontas
 * aparadas.
 *
 * A convenção do projeto é que o código de cadastro institucional é **informado
 * pelo operador**; o frontend apenas sugere, e a API continua sendo a única
 * guardiã de formato, tamanho e unicidade. Por isso a sugestão nunca é imposta —
 * quem chama é responsável por não sobrescrever o que o operador digitou.
 *
 * Devolve string vazia quando o resultado não serviria — nome sem nada
 * aproveitável (`---`), curto demais (`A`) ou começando por dígito (`21 de abril`
 * daria `21_DE_ABRIL`, que o formato recusa). Sugerir um código inválido deixaria
 * o campo em erro sem o operador ter chegado a tocá-lo; melhor não sugerir nada.
 *
 * @example
 * sugerirCodigoDeCadastro('Laudo médico')          // 'LAUDO_MEDICO'
 * sugerirCodigoDeCadastro('Declaração de IRPF')    // 'DECLARACAO_DE_IRPF'
 * sugerirCodigoDeCadastro('21 de abril')           // '' — começaria com dígito
 * sugerirCodigoDeCadastro('A')                     // '' — curto demais
 * sugerirCodigoDeCadastro('---')                   // '' — nada aproveitável
 */
export function sugerirCodigoDeCadastro(nome: string): string {
  const candidato = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^a-zA-Z0-9]+/gu, '_')
    .replace(/^_+|_+$/gu, '')
    .toLocaleUpperCase('pt-BR')
    .slice(0, CODIGO_CADASTRO_TAMANHO_MAXIMO);

  return CODIGO_CADASTRO_FORMATO.test(candidato) ? candidato : '';
}
