import { SENHA_DAS_PERSONAS } from '@uniplus/shared-e2e';

export const PROCESSO_ID = process.env['E2E_PROCESSO_ID'] ?? '';
export const API_URL = process.env['E2E_API_URL'] ?? 'http://localhost:5000';

/** Os dados de uma persona fictícia do portal de documentação, como a inscrição os pede. */
export interface Persona {
  readonly usuario: string;
  readonly senha: string;
  readonly nome: string;
  /** O nome social da conta; nulo quando a conta não tem. */
  readonly nomeSocial: string | null;
  readonly cpfMascarado: string;
  readonly nascimento: string;
  readonly rg: string;
  readonly mae: string;
  readonly pai: string;
  readonly email: string;
  readonly celular: string;
  readonly fixo?: string;
  readonly cep: string;
  readonly numero: string;
  readonly uf: string;
  readonly cidade: string;
}

/** O comprovante mostra o telefone na forma canônica que a API grava: só os dígitos. */
export function somenteDigitos(texto: string): string {
  return texto.replace(/\D/g, '');
}

/** Fernanda Drumond, persona fictícia do portal de documentação, que usa o nome social Ariel. */
export const PERSONA = {
  usuario: 'fernanda.drumond',
  senha: SENHA_DAS_PERSONAS,
  nome: 'Fernanda Laura Nicole Drumond',
  nomeSocial: 'Ariel Drumond',
  cpfMascarado: '***.598.363-**',
  nascimento: '1970-02-02',
  rg: '12.868.927-4',
  mae: 'Maria Marli',
  pai: 'Joaquim Eduardo Drumond',
  email: 'fernanda_laura_drumond@lhp.com.br',
  celular: '(67) 99490-8277',
  fixo: '(67) 3931-4637',
  cep: '79096730',
  numero: '743',
  uf: 'Mato Grosso do Sul',
  cidade: 'Campo Grande',
} as const satisfies Persona;

/** Helena Rezende, persona fictícia do portal de documentação, cuja conta começa sem nome social. */
export const HELENA: Persona = {
  usuario: 'helena.rezende',
  senha: SENHA_DAS_PERSONAS,
  nome: 'Helena Bianca Sueli Rezende',
  nomeSocial: null,
  cpfMascarado: '***.287.930-**',
  nascimento: '1954-05-12',
  rg: '19.377.269-3',
  mae: 'Jéssica Tatiane',
  pai: 'Thomas Felipe Marcos Vinicius Rezende',
  email: 'helena_bianca_rezende@paginacom.com.br',
  celular: '(51) 98703-7357',
  cep: '90840510',
  numero: '336',
  uf: 'Rio Grande do Sul',
  cidade: 'Porto Alegre',
};

/** O nome social que a Helena cadastra em Meu perfil durante o teste e remove ao final. */
export const NOME_SOCIAL_DA_HELENA = 'Helena Rezende';

/** Uma das edições que o roteiro da API declara como aceitas pelo processo de validação. */
export const EDICAO_DO_ENEM = 'ENEM 2026';
export const MUNICIPIO_DO_FATOR = 'Marabá/PA';
export const MUNICIPIO_DE_RESIDENCIA_DO_FATOR = 'Itupiranga/PA';
export const ORGAO_EMISSOR = 'Secretaria de Segurança Pública (SSP)';
