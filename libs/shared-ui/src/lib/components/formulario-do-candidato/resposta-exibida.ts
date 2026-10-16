import { formatarDataBr, formatarTelefone } from '@uniplus/shared-utils';

/** O que o comprovante precisa saber do campo para mostrar a resposta. */
export interface CampoExibido {
  readonly tipoRenderizacao?: string | null;
  /** O formato de texto do catálogo, como TELEFONE. */
  readonly formato?: string | null;
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
      return formatarDataBr(String(valor)) || String(valor);
    case 'NUMERO':
      return Number(valor).toLocaleString('pt-BR', { maximumFractionDigits: 20 });
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
      return campo.formato === 'TELEFONE' ? formatarTelefone(String(valor)) : String(valor);
  }
}

function opcao(campo: CampoExibido, codigo: string): string {
  return campo.valoresSelecionaveis?.find((v) => v.codigo === codigo)?.descricao ?? codigo;
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
