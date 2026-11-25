import { COM_LISTA, SO_IGUALDADE } from '../../editor-de-condicoes/operadores-de-exemplo.testing';
import type {
  ApresentacaoDoCampo,
  ConteudoDoFormulario,
  PaginaDoFormulario,
  FatoDoFormulario,
  GrupoDoFormulario,
  ItemDoFormulario,
  RegrasDoCampo,
} from './tipos';

export const APRESENTACAO_PADRAO = {
  tipoDeCampo: 'SIM_OU_NAO',
  pedirConfirmacao: false,
} satisfies Omit<ApresentacaoDoCampo, 'rotulo'>;

export const REGRAS_PADRAO: RegrasDoCampo = {
  exibicao: null,
  obrigatoriedade: { tipo: 'SEMPRE', predicado: null },
};

export const REVISAO: PaginaDoFormulario = {
  codigo: 'REVISAO_E_ACEITE',
  ordem: 9,
  tipo: 'BLOCO',
  bloco: 'REVISAO_E_ACEITE',
  apresentacao: { titulo: 'Revisão e aceite', descricao: null, aviso: null },
};

export const NOMES = new Map<string, string>([['A', 'Campo A']]);

export function secao(
  codigo: string,
  ordem: number,
  exibicao: PaginaDoFormulario['exibicao'] = null,
): PaginaDoFormulario {
  return {
    codigo,
    ordem,
    tipo: 'SECAO',
    bloco: null,
    apresentacao: { titulo: codigo, descricao: null, aviso: null },
    exibicao,
  };
}

interface ExtraDoItem {
  readonly paginaCodigo?: null | string;
  readonly apresentacao?: Partial<ApresentacaoDoCampo>;
  readonly regras?: Partial<RegrasDoCampo>;
}

export function item(
  fatoCodigo: string,
  ordem: number,
  paginaCodigo: string,
  extra: ExtraDoItem = {},
): ItemDoFormulario {
  return {
    fatoCodigo,
    ordem,
    paginaCodigo: extra.paginaCodigo === undefined ? paginaCodigo : extra.paginaCodigo,
    apresentacao: { rotulo: fatoCodigo, ...APRESENTACAO_PADRAO, ...extra.apresentacao },
    regras: { ...REGRAS_PADRAO, ...extra.regras },
  };
}

export const exibidoQuando = (fato: string, operador = 'IGUAL'): RegrasDoCampo['exibicao'] => [
  [{ fato, operador, valor: true }],
];

export function conteudo(parcial: Partial<ConteudoDoFormulario>): ConteudoDoFormulario {
  return {
    titulo: null,
    paginas: [],
    itens: [],
    termos: [],
    pressupostos: [],
    grupos: [],
    ...parcial,
  };
}

export function fato(codigo: string, extra: Partial<FatoDoFormulario> = {}): FatoDoFormulario {
  return {
    codigo,
    nome: codigo,
    dominio: { codigo: 'SIM_OU_NAO', rotulo: 'SIM_OU_NAO' },
    binding: `CAMPO_FORMULARIO:${codigo}`,
    operadoresAdmitidos: SO_IGUALDADE,
    cardinalidade: { codigo: 'VALOR_UNICO', rotulo: 'VALOR_UNICO' },
    fonteValores: null,
    escopo: 'CANDIDATO',
    ativo: true,
    ...extra,
  };
}

export const membro = (codigo: string, extra: Partial<FatoDoFormulario> = {}): FatoDoFormulario =>
  fato(codigo, { escopo: 'MEMBRO_GRUPO', ...extra });

export const parentesco = membro('PARENTESCO', {
  dominio: { codigo: 'OPCAO', rotulo: 'OPCAO' },
  operadoresAdmitidos: COM_LISTA,
  valoresDominio: ['PROPRIO_CANDIDATO', 'MAE'],
});

export function grupoDeExemplo(extra: Partial<GrupoDoFormulario> = {}): GrupoDoFormulario {
  return {
    codigo: 'FAMILIA',
    ordem: 1,
    rotulo: 'Composição familiar',
    paginaCodigo: 'S1',
    ocorrencias: { minimo: 0, maximo: null, incluiCandidato: false },
    regras: REGRAS_PADRAO,
    subitens: [
      item('RENDA', 0, 'S1', { paginaCodigo: null }),
      item('IDADE', 1, 'S1', { paginaCodigo: null }),
    ],
    ...extra,
  };
}
