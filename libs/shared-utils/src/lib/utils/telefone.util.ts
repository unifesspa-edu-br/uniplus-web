/** Os caracteres que o telefone aceita além dos dígitos: espaço, parênteses, hífen e ponto. */
const SEPARADORES = /^[0-9 ().-]+$/;

/**
 * Os dígitos do telefone brasileiro com DDD, ou nulo quando o texto não é telefone: fixo com 10
 * dígitos, celular com 11 começando por 9 depois do DDD, e DDD sem zero. É a mesma conferência do tipo
 * de valor da API, para o formulário não ser mais rígido nem mais frouxo que o servidor.
 */
export function digitosDoTelefone(texto: string | null | undefined): string | null {
  if (texto === null || texto === undefined || texto.trim() === '' || !SEPARADORES.test(texto)) {
    return null;
  }
  const digitos = texto.replace(/[^0-9]/g, '');
  const fixo = digitos.length === 10;
  const celular = digitos.length === 11 && digitos[2] === '9';
  const dddValido = digitos[0] !== '0' && digitos[1] !== '0';
  return (fixo || celular) && dddValido ? digitos : null;
}

/**
 * O telefone para leitura: "(61) 3333-4444" no fixo e "(61) 98195-1555" no celular. O texto que não é
 * telefone volta como chegou, sem máscara parcial.
 */
export function formatarTelefone(texto: string | null | undefined): string {
  const digitos = digitosDoTelefone(texto);
  if (digitos === null) return texto ?? '';
  const ddd = digitos.slice(0, 2);
  const numero = digitos.slice(2);
  const corte = numero.length - 4;
  return `(${ddd}) ${numero.slice(0, corte)}-${numero.slice(corte)}`;
}
