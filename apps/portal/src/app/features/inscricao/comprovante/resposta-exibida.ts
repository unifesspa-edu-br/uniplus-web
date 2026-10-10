import type { RespostasDaInscricao } from '@uniplus/shared-data/selecao';

/** O que o comprovante precisa saber do campo para mostrar a resposta. */
export interface CampoExibido {
  readonly tipoRenderizacao?: string | null;
  readonly valoresSelecionaveis?: readonly { codigo: string; descricao?: string | null }[] | null;
}

interface CidadeDoEndereco {
  readonly nome?: string | null;
  readonly uf?: string | null;
}

interface EnderecoRespondido {
  readonly cep?: string | null;
  readonly logradouro?: string | null;
  readonly numero?: string | null;
  readonly complemento?: string | null;
  readonly bairro?: string | null;
  readonly cidade?: CidadeDoEndereco | null;
}

/** Os municípios pelo código IBGE, como "Nome — UF". */
export type NomesDosMunicipios = ReadonlyMap<string, string>;

/**
 * A resposta como texto, pelo tipo do campo; a opção aparece pelo nome quando o formulário o traz, e o
 * município quando o Geo o devolveu.
 */
export function respostaExibida(
  campo: CampoExibido,
  valor: unknown,
  municipios: NomesDosMunicipios = new Map(),
): string {
  switch (campo.tipoRenderizacao) {
    case 'BOOLEANO':
      return valor === true ? 'Sim' : 'Não';
    case 'DATA':
      return dataBr(String(valor));
    case 'NUMERO':
      return Number(valor).toLocaleString('pt-BR');
    case 'SELECAO_UNICA':
    case 'SELECAO_MULTIPLA':
      return (Array.isArray(valor) ? valor : [valor])
        .map((c) => opcao(campo, String(c)))
        .join(', ');
    case 'MUNICIPIO':
      return municipios.get(String(valor)) ?? `Código IBGE ${String(valor)}`;
    case 'ENDERECO':
      return endereco(valor as EnderecoRespondido);
    default:
      return String(valor);
  }
}

/** O nome social prevalece quando o candidato o pediu e o preencheu (UNI-REQ-0032); senão, o nome civil. */
export function nomePreferido(respostas: RespostasDaInscricao): string {
  const social = respostas['NOME_SOCIAL'];
  if (respostas['DESEJA_NOME_SOCIAL'] === true && typeof social === 'string' && social !== '') {
    return social;
  }
  return typeof respostas['NOME'] === 'string' ? respostas['NOME'] : '';
}

function opcao(campo: CampoExibido, codigo: string): string {
  return campo.valoresSelecionaveis?.find((v) => v.codigo === codigo)?.descricao ?? codigo;
}

function dataBr(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : iso;
}

function endereco(e: EnderecoRespondido): string {
  const cidade = [e.cidade?.nome, e.cidade?.uf].filter(Boolean).join('/');
  return [
    [e.logradouro, e.numero].filter(Boolean).join(', '),
    e.complemento,
    e.bairro,
    cidade,
    e.cep ? `CEP ${e.cep}` : null,
  ]
    .filter(Boolean)
    .join(' — ');
}
