import { json } from './resposta-da-api';

const GEO_URL = process.env['E2E_GEO_URL'] ?? 'http://localhost:5400';
// Espelha o padrão de MUNICIPIOS_DE_PROVA do roteiro de inscrição da API.
const MUNICIPIOS_DE_PROVA_PADRAO = '[{"codigoIbge":"1504208","uf":"PA"}]';

function municipioValido(municipio: unknown): municipio is { codigoIbge: string } {
  return (
    typeof municipio === 'object' &&
    municipio !== null &&
    'codigoIbge' in municipio &&
    typeof municipio.codigoIbge === 'string' &&
    /^\d{7}$/.test(municipio.codigoIbge) &&
    'uf' in municipio &&
    typeof municipio.uf === 'string' &&
    /^[A-Z]{2}$/.test(municipio.uf)
  );
}

function municipioDeProva(): string {
  const municipios: unknown = JSON.parse(
    process.env['MUNICIPIOS_DE_PROVA'] || MUNICIPIOS_DE_PROVA_PADRAO,
  );
  if (!Array.isArray(municipios) || municipios.length === 0 || !municipios.every(municipioValido)) {
    throw new Error('MUNICIPIOS_DE_PROVA deve ser uma lista JSON não vazia de código IBGE e UF.');
  }
  return (municipios[0] as { codigoIbge: string }).codigoIbge;
}

export interface Pessoa {
  readonly nome: string;
  readonly nome_social?: string | null;
  readonly username: string;
  readonly sexo: 'Feminino' | 'Masculino';
  readonly data_nasc: string;
  readonly cpf: string;
  readonly rg: string;
  readonly mae: string;
  readonly pai: string;
  readonly email: string;
  readonly cep: string;
  readonly endereco: string;
  readonly numero: number;
  readonly bairro: string;
  readonly celular: string;
}

interface Localidade {
  readonly codigoIbge: string;
  readonly cidade: string;
  readonly uf: string;
}

export async function respostasDa(
  p: Pessoa,
  token: string,
  comLaudo: boolean,
  pedeCidadeDeProva: boolean,
): Promise<Record<string, unknown>> {
  const cep = p.cep.replace(/\D/g, '');
  const geo = await localidadeDoCep(cep, token);
  return {
    ...dadosDaPessoa(p, geo),
    ...escolaridade(),
    ...acessibilidade(comLaudo),
    ...(pedeCidadeDeProva ? { CIDADE_DE_PROVA: municipioDeProva() } : {}),
  };
}

function dadosDaPessoa(p: Pessoa, geo: Localidade): Record<string, unknown> {
  return {
    ...identificacao(p),
    ...documentos(p, geo),
    ...dadosFamiliares(p),
    ...contato(p),
    ENDERECO_RESIDENCIAL: endereco(p, geo),
  };
}

async function localidadeDoCep(cep: string, token: string): Promise<Localidade> {
  return json<Localidade>(
    await fetch(`${GEO_URL}/api/cep/${cep}`, { headers: { authorization: `Bearer ${token}` } }),
    200,
    `CEP ${cep}`,
  );
}

function identificacao(p: Pessoa): Record<string, unknown> {
  const [dia, mes, ano] = p.data_nasc.split('/');
  return {
    NOME: p.nome,
    DESEJA_NOME_SOCIAL: p.nome_social != null,
    ...(p.nome_social != null ? { NOME_SOCIAL: p.nome_social } : {}),
    NACIONALIDADE: 'NATO',
    CPF: p.cpf.replace(/\D/g, ''),
    DATA_NASCIMENTO: `${ano}-${mes}-${dia}`,
  };
}

function documentos(p: Pessoa, geo: Localidade): Record<string, unknown> {
  const ano = p.data_nasc.split('/')[2];
  return {
    RG_NUMERO: p.rg,
    RG_ORGAO_EMISSOR: 'SSP',
    RG_UF: geo.uf,
    RG_DATA_EMISSAO: `${Number(ano) + 18}-01-01`,
    NATURALIDADE_UF: geo.uf,
    NATURALIDADE_MUNICIPIO: geo.codigoIbge,
  };
}

function dadosFamiliares(p: Pessoa): Record<string, unknown> {
  const sexo = p.sexo === 'Feminino' ? 'FEMININO' : 'MASCULINO';
  return {
    NOME_MAE: p.mae,
    NOME_PAI: p.pai,
    ESTADO_CIVIL: 'SOLTEIRO',
    SEXO: sexo,
    SEXO_CIVIL: sexo,
    IDENTIDADE_GENERO: 'PREFIRO_NAO_INFORMAR',
    ORIENTACAO_SEXUAL: 'PREFIRO_NAO_INFORMAR',
  };
}

function contato(p: Pessoa): Record<string, unknown> {
  return {
    EMAIL: `${p.email.split('@')[0]}@uniplus-test.local`,
    TELEFONE: p.celular,
    TIPO_ENDERECO: 'URBANO',
  };
}

function endereco(p: Pessoa, geo: Localidade): Record<string, unknown> {
  return {
    cep: p.cep,
    logradouro: p.endereco,
    numero: String(p.numero),
    complemento: null,
    bairro: p.bairro,
    distrito: null,
    cidade: { codigoIbge: geo.codigoIbge, nome: geo.cidade, uf: geo.uf },
    latitude: null,
    longitude: null,
    nivelResolucao: null,
    origem: null,
  };
}

function escolaridade(): Record<string, unknown> {
  return {
    COR_RACA: 'BRANCA',
    EDICAO_ENEM: '2025',
    FORMA_CONCLUSAO_EM: 'REGULAR',
    ONDE_CURSOU_EM: 'PRIVADA',
    SOLICITA_FATOR_ATENUACAO: false,
  };
}

function acessibilidade(comLaudo: boolean): Record<string, unknown> {
  return {
    PCD: comLaudo,
    ...(comLaudo ? { TIPO_DEFICIENCIA: 'AUDITIVA' } : {}),
    CONCORRER_PCD: comLaudo,
    ...modalidadesDeConcorrencia(),
    SOLICITA_ATENDIMENTO_ESPECIALIZADO: comLaudo,
    ...(comLaudo
      ? { CONDICAO_ATENDIMENTO: ['PCD'], RECURSO_ACESSIBILIDADE: ['TEMPO_ADICIONAL'] }
      : {}),
  };
}

function modalidadesDeConcorrencia(): Record<string, unknown> {
  return {
    CONCORRER_EP: false,
    INDIGENA: false,
    QUILOMBOLA: false,
    CONCORRER_PPI: false,
    CONCORRER_Q: false,
    BAIXA_RENDA: false,
    CONCORRER_RENDA: false,
  };
}
