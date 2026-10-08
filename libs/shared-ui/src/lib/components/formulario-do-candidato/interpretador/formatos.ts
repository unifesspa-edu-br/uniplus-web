/**
 * Os formatos de texto do catálogo de fatos e a conferência de cada um, idêntica à dos tipos de valor
 * da API: o interpretador não pode ser mais rígido nem mais frouxo que o servidor.
 */
const CONFERENCIAS: Readonly<Record<string, (texto: string) => boolean>> = {
  LIVRE: () => true,
  CPF: ehCpf,
  EMAIL: ehEmail,
  TELEFONE: ehTelefone,
  CEP: ehCep,
  NOME_PESSOA: ehNomeDePessoa,
};

export function ehFormatoConhecido(formato: string): boolean {
  return Object.hasOwn(CONFERENCIAS, formato);
}

/** A resposta atende ao formato; o formato tem de ser conhecido. */
export function atendeAoFormato(formato: string, texto: string): boolean {
  return CONFERENCIAS[formato](texto);
}

const emBranco = (texto: string): boolean => texto.trim() === '';
const soDigitos = (texto: string): string => texto.replace(/[^0-9]/g, '');
const soComCaracteres = (texto: string, separadores: RegExp): boolean =>
  [...texto].every((c) => /[0-9]/.test(c) || separadores.test(c));
const todosIguais = (digitos: string): boolean => new Set(digitos).size === 1;

function ehCpf(texto: string): boolean {
  if (emBranco(texto) || !soComCaracteres(texto, /[ .-]/)) return false;
  const digitos = soDigitos(texto);
  if (digitos.length !== 11 || todosIguais(digitos)) return false;
  const verificador = (quantos: number): number => {
    const soma = [...digitos.slice(0, quantos)].reduce(
      (total, c, i) => total + Number(c) * (quantos + 1 - i),
      0,
    );
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return digitos.endsWith(`${verificador(9)}${verificador(10)}`);
}

function ehEmail(texto: string): boolean {
  return !emBranco(texto) && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(texto.trim().toLowerCase());
}

function ehTelefone(texto: string): boolean {
  if (emBranco(texto) || !soComCaracteres(texto, /[ ()\-.]/)) return false;
  const digitos = soDigitos(texto);
  const fixo = digitos.length === 10;
  const celular = digitos.length === 11 && digitos[2] === '9';
  const dddValido = digitos.length >= 2 && digitos[0] !== '0' && digitos[1] !== '0';
  return (fixo || celular) && dddValido;
}

function ehCep(texto: string): boolean {
  if (emBranco(texto) || !soComCaracteres(texto, /[ .-]/)) return false;
  const digitos = soDigitos(texto);
  return digitos.length === 8 && !todosIguais(digitos);
}

/** Nome e sobrenome, só com letras, apóstrofo ou hífen entre letras, até 200 caracteres. */
function ehNomeDePessoa(texto: string): boolean {
  if (emBranco(texto)) return false;
  const normalizado = texto.trim().normalize('NFC').replace(/\s+/g, ' ').replace(/[’ʼ]/g, "'");
  return (
    normalizado.length <= 200 &&
    /^\p{L}+(?:['-]\p{L}+)*(?: \p{L}+(?:['-]\p{L}+)*)+$/u.test(normalizado)
  );
}

/** As UFs pelo prefixo do código IBGE do município. */
const UF_POR_PREFIXO: Readonly<Record<string, string>> = {
  '11': 'RO',
  '12': 'AC',
  '13': 'AM',
  '14': 'RR',
  '15': 'PA',
  '16': 'AP',
  '17': 'TO',
  '21': 'MA',
  '22': 'PI',
  '23': 'CE',
  '24': 'RN',
  '25': 'PB',
  '26': 'PE',
  '27': 'AL',
  '28': 'SE',
  '29': 'BA',
  '31': 'MG',
  '32': 'ES',
  '33': 'RJ',
  '35': 'SP',
  '41': 'PR',
  '42': 'SC',
  '43': 'RS',
  '50': 'MS',
  '51': 'MT',
  '52': 'GO',
  '53': 'DF',
};

/** A UF do município pelo código IBGE de sete dígitos; nula quando o código não é de município. */
export function ufDoCodigoIbge(codigo: string): string | null {
  return /^[0-9]{7}$/.test(codigo) ? (UF_POR_PREFIXO[codigo.slice(0, 2)] ?? null) : null;
}
