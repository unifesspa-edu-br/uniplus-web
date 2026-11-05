import type { EnderecoEstruturado } from '../endereco-geo/endereco-geo.model';
import type { ValorJson } from './interpretador/regras-do-formulario';

type ObjetoJson = { readonly [chave: string]: ValorJson };

function comoObjeto(valor: ValorJson | undefined): ObjetoJson | null {
  return valor !== undefined && valor !== null && typeof valor === 'object' && !Array.isArray(valor)
    ? (valor as ObjetoJson)
    : null;
}

/** O endereço que a resposta guarda, na forma de `EnderecoGeoInput`; outra forma é sem endereço. */
export function enderecoDa(resposta: ValorJson | undefined): EnderecoEstruturado | null {
  const objeto = comoObjeto(resposta);
  if (objeto === null) return null;
  const cidade = comoObjeto(objeto['cidade']);
  return {
    cep: textoOuNulo(objeto['cep']),
    logradouro: textoOuNulo(objeto['logradouro']),
    numero: textoOuNulo(objeto['numero']),
    complemento: textoOuNulo(objeto['complemento']),
    bairro: textoOuNulo(objeto['bairro']),
    distrito: textoOuNulo(objeto['distrito']),
    cidade:
      cidade === null
        ? null
        : {
            codigoIbge: textoOuNulo(cidade['codigoIbge']) ?? '',
            nome: textoOuNulo(cidade['nome']) ?? '',
            uf: textoOuNulo(cidade['uf']) ?? '',
          },
    latitude: textoOuNulo(objeto['latitude']),
    longitude: textoOuNulo(objeto['longitude']),
    nivelResolucao: textoOuNulo(objeto['nivelResolucao']),
    origem: textoOuNulo(objeto['origem']),
    ...(objeto['cepConfirmado'] === true ? { cepConfirmado: true } : {}),
  };
}

/** O endereço como resposta: um objeto JSON com a cidade aninhada. */
export function respostaDoEndereco(endereco: EnderecoEstruturado): ValorJson {
  return { ...endereco, cidade: endereco.cidade === null ? null : { ...endereco.cidade } };
}

function textoOuNulo(valor: ValorJson | undefined): string | null {
  if (typeof valor === 'string') return valor;
  return typeof valor === 'number' ? String(valor) : null;
}
