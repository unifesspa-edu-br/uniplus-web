import type { CepEncontrado, EnderecoEstruturado } from './endereco-geo.model';

type CidadeDoEndereco = EnderecoEstruturado['cidade'];

export const CEP_DO_GEO: CepEncontrado = {
  cep: '68507590',
  tipo: 'Rua',
  logradouro: 'Folha 31, Quadra 7',
  bairro: 'Nova Marabá',
  cidade: 'Marabá',
  codigoIbge: '1504208',
  uf: 'PA',
  nivelResolucao: 'logradouro',
  origem: 'geo-api',
};

export const CIDADE_DE_MARABA = { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' };

const ENDERECO_EM_BRANCO: EnderecoEstruturado = {
  cep: null,
  logradouro: null,
  numero: null,
  complemento: null,
  bairro: null,
  distrito: null,
  cidade: null,
  latitude: null,
  longitude: null,
  nivelResolucao: null,
  origem: 'manual',
};

export function enderecoEstruturado(origem: string, cidade: CidadeDoEndereco): EnderecoEstruturado {
  const manual = origem === 'manual';
  return {
    ...ENDERECO_EM_BRANCO,
    cep: manual ? null : '68507590',
    cidade,
    nivelResolucao: manual ? null : 'cidade',
    origem,
  };
}
