import { formatarDataBr, formatarTelefone } from '@uniplus/shared-utils';

import { lerMunicipio, municipioParaExibir } from './valor-de-municipio-gravado';

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

type Exibicao = (campo: CampoExibido, valor: unknown) => string;

const selecaoExibida: Exibicao = (campo, valor) =>
  (Array.isArray(valor) ? valor : [valor]).map((c) => opcao(campo, String(c))).join(', ');

const EXIBICAO_POR_TIPO: Readonly<Record<string, Exibicao>> = {
  BOOLEANO: (_, valor) => (valor === true ? 'Sim' : 'Não'),
  DATA: (_, valor) => formatarDataBr(String(valor)) || String(valor),
  NUMERO: (_, valor) => Number(valor).toLocaleString('pt-BR', { maximumFractionDigits: 20 }),
  SELECAO_UNICA: selecaoExibida,
  SELECAO_MULTIPLA: selecaoExibida,
  MUNICIPIO: (_, valor) => municipioExibido(valor),
  ENDERECO: (_, valor) => endereco(valor as EnderecoRespondido),
};

const textoExibido: Exibicao = (campo, valor) =>
  campo.formato === 'TELEFONE' ? formatarTelefone(String(valor)) : String(valor);

/**
 * A resposta como texto, pelo tipo do campo; a opção aparece pelo nome quando o formulário o traz, e o
 * município pelo nome que ficou gravado no envio.
 */
export function respostaExibida(campo: CampoExibido, valor: unknown): string {
  return (EXIBICAO_POR_TIPO[campo.tipoRenderizacao ?? ''] ?? textoExibido)(campo, valor);
}

function municipioExibido(valor: unknown): string {
  const municipio = lerMunicipio(valor);
  return municipio ? municipioParaExibir(municipio) : String(valor);
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
