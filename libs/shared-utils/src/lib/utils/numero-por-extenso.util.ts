export type GeneroDoOrdinal = 'MASCULINO' | 'FEMININO';

const unidades = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
const especiais = [
  'dez',
  'onze',
  'doze',
  'treze',
  'catorze',
  'quinze',
  'dezesseis',
  'dezessete',
  'dezoito',
  'dezenove',
];
const dezenas = [
  '',
  '',
  'vinte',
  'trinta',
  'quarenta',
  'cinquenta',
  'sessenta',
  'setenta',
  'oitenta',
  'noventa',
];
const centenas = [
  '',
  'cento',
  'duzentos',
  'trezentos',
  'quatrocentos',
  'quinhentos',
  'seiscentos',
  'setecentos',
  'oitocentos',
  'novecentos',
];
const unidadesOrdinais = [
  '',
  'primeiro',
  'segundo',
  'terceiro',
  'quarto',
  'quinto',
  'sexto',
  'sétimo',
  'oitavo',
  'nono',
];
const dezenasOrdinais = [
  '',
  'décimo',
  'vigésimo',
  'trigésimo',
  'quadragésimo',
  'quinquagésimo',
  'sexagésimo',
  'septuagésimo',
  'octogésimo',
  'nonagésimo',
];
const centenasOrdinais = [
  '',
  'centésimo',
  'ducentésimo',
  'tricentésimo',
  'quadringentésimo',
  'quingentésimo',
  'seiscentésimo',
  'septingentésimo',
  'octingentésimo',
  'nongentésimo',
];

/** Escreve um cardinal de zero a 999 no masculino. */
export function cardinalPorExtenso(numero: number): string {
  if (numero < 10) return unidades[numero];
  if (numero < 20) return especiais[numero - 10];
  if (numero === 100) return 'cem';
  const partes = [
    centenas[Math.floor(numero / 100)],
    dezenas[Math.floor((numero % 100) / 10)],
    unidades[numero % 10],
  ];
  if (numero % 100 >= 10 && numero % 100 < 20) {
    return [partes[0], especiais[(numero % 100) - 10]].filter(Boolean).join(' e ');
  }
  return partes.filter((parte) => parte && parte !== 'zero').join(' e ');
}

/** Escreve um ordinal de 1 a 999 no gênero informado. */
export function ordinalPorExtenso(numero: number, genero: GeneroDoOrdinal): string {
  const partes = [
    centenasOrdinais[Math.floor(numero / 100)],
    dezenasOrdinais[Math.floor((numero % 100) / 10)],
    unidadesOrdinais[numero % 10],
  ];
  return partes
    .filter(Boolean)
    .map((parte) => (genero === 'FEMININO' ? parte.replace(/o$/u, 'a') : parte))
    .join(' ');
}
