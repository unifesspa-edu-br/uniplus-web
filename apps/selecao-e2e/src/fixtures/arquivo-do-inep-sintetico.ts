/**
 * Arquivos de retorno do INEP sintéticos, montados a partir das personas fictícias do portal
 * (`uniplus-developers/src/data/fake-people.json`). Nenhum arquivo nem dado real entra aqui. O
 * leiaute é o de 20 campos separados por `;`, sem cabeçalho, em UTF-8 e com `\n`:
 *
 * - 0: número de inscrição no ENEM; 1: CPF; 2: nome (identifica a linha sem inscrito);
 * - 3 a 7: notas de CN, CH, LC, MT e Redação; 8 a 12: situação de cada prova (7 presente, 6 ausente);
 * - 14: sexo, `F` ou `M` (identifica a linha sem inscrito);
 * - 13 e 15 a 18: dados cadastrais (ignorados), e a última coluna vazia.
 *
 * As colunas ignoradas vêm preenchidas de propósito: provam que o Uni+ não as lê.
 */
export interface PessoaFicticia {
  /** Usuário da persona no realm de testes. */
  readonly username: string;
  readonly nome: string;
  /** Só dígitos, como o INEP devolve. */
  readonly cpf: string;
  /** dd/MM/aaaa, como no portal. */
  readonly nascimento: string;
  /** Por extenso, como no portal. */
  readonly sexo: 'Feminino' | 'Masculino';
  readonly cidade: string;
  readonly uf: string;
}

export const FERNANDA: PessoaFicticia = {
  username: 'fernanda.drumond',
  nome: 'Fernanda Laura Nicole Drumond',
  cpf: '69959836371',
  nascimento: '02/02/1970',
  sexo: 'Feminino',
  cidade: 'Campo Grande',
  uf: 'MS',
};

export const KEVIN: PessoaFicticia = {
  username: 'kevin.carvalho',
  nome: 'Kevin Anderson Carvalho',
  cpf: '33257350376',
  nascimento: '17/03/1984',
  sexo: 'Masculino',
  cidade: 'Rio Branco',
  uf: 'AC',
};

export const HELENA: PessoaFicticia = {
  username: 'helena.rezende',
  nome: 'Helena Bianca Sueli Rezende',
  cpf: '16328793014',
  nascimento: '12/05/1954',
  sexo: 'Feminino',
  cidade: 'Porto Alegre',
  uf: 'RS',
};

export const ERICK: PessoaFicticia = {
  username: 'erick.ramos',
  nome: 'Erick Isaac Ramos',
  cpf: '33434225927',
  nascimento: '13/02/1969',
  sexo: 'Masculino',
  cidade: 'Salvador',
  uf: 'BA',
};

const NOTAS_PADRAO = ['611.1', '722.2', '833.3', '544.4', '960'];
const SITUACOES_PADRAO = ['7', '7', '7', '7', '7'];

export function numeroDeInscricao(ordem: number): string {
  return String(240000000000 + ordem);
}

export function linha(pessoa: PessoaFicticia, ordem: number, cpf: string = pessoa.cpf): string {
  return [
    numeroDeInscricao(ordem),
    cpf,
    pessoa.nome,
    ...NOTAS_PADRAO,
    ...SITUACOES_PADRAO,
    pessoa.nascimento,
    pessoa.sexo === 'Feminino' ? 'F' : 'M',
    pessoa.cidade,
    pessoa.uf,
    pessoa.sexo,
    pessoa.cidade,
    '',
  ].join(';');
}

/** O leiaute anterior, com três campos a mais: não pode ser lido com o de 20. */
export function linhaDe23Campos(
  pessoa: PessoaFicticia,
  ordem: number,
  cpf: string = pessoa.cpf,
): string {
  return `${linha(pessoa, ordem, cpf)};x;y;z`;
}

export function arquivoDeRetorno(linhas: readonly string[]): Buffer {
  return Buffer.from(`${linhas.join('\n')}\n`, 'utf-8');
}

/** O arquivo de envio ao INEP: um CPF por linha. */
export function arquivoDeEnvio(pessoas: readonly PessoaFicticia[]): string {
  return `${pessoas.map((pessoa) => pessoa.cpf).join('\n')}\n`;
}

/** Todas as personas inscritas presentes no arquivo. */
export function retornoComTodosPresentes(inscritas: readonly PessoaFicticia[]): Buffer {
  return arquivoDeRetorno(inscritas.map((pessoa, indice) => linha(pessoa, indice + 1)));
}

/** Uma inscrita fica de fora do arquivo: o Uni+ a conta como inscrita sem nota. */
export function retornoSemUmInscrito(
  inscritas: readonly PessoaFicticia[],
  ausente: PessoaFicticia,
): Buffer {
  return retornoComTodosPresentes(inscritas.filter((pessoa) => pessoa !== ausente));
}

/** Uma pessoa que não se inscreveu nesta edição aparece no arquivo: linha sem inscrito. */
export function retornoComLinhaSemInscrito(
  inscritas: readonly PessoaFicticia[],
  naoInscrita: PessoaFicticia,
): Buffer {
  const linhas = inscritas.map((pessoa, indice) => linha(pessoa, indice + 1));
  return arquivoDeRetorno([...linhas, linha(naoInscrita, inscritas.length + 1)]);
}

/** O mesmo CPF em duas linhas com números de inscrição diferentes: conflito. */
export function retornoComConflito(
  inscritas: readonly PessoaFicticia[],
  conflitante: PessoaFicticia,
): Buffer {
  const linhas = inscritas.map((pessoa, indice) => linha(pessoa, indice + 1));
  return arquivoDeRetorno([...linhas, linha(conflitante, inscritas.length + 1)]);
}

export function retornoDe23Campos(inscritas: readonly PessoaFicticia[]): Buffer {
  return arquivoDeRetorno(inscritas.map((pessoa, indice) => linhaDe23Campos(pessoa, indice + 1)));
}
