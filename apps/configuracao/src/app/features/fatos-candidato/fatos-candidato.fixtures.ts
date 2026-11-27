import {
  ClassificacaoDeProtecaoCodigo,
  EscopoFatoCodigo,
  HipoteseLegalTratamentoCodigo,
} from '@uniplus/shared-data/configuracao';
import { ItemParaSolicitarRequestCadastro } from '@uniplus/shared-data/configuracao';
import {
  OperadorCodigo,
  TipoDoDadoCodigo,
  QuantidadeDeValoresCodigo,
  OrigemFatoCodigo,
  FonteValoresFatoCodigo,
  type FatoCandidatoDto,
  type FatoCandidatoView,
  type FatoDeManutencaoDto,
  type FatoDoCatalogoDto,
} from '@uniplus/shared-data/configuracao';

const APROVADA = {
  situacao: 'APROVADA',
  solicitadaEm: null,
  decididaEm: null,
  classificacaoRecomendada: null,
  justificativa: null,
  aceitaEm: null,
  ciclo: 0,
  manifestadaEm: null,
  manifestacaoDesfavoravel: false,
  manifestacoesNoCiclo: 0,
};

/** O fato como a leitura administrativa o devolve: no envelope. */
export const emManutencao = (fato: FatoCandidatoDto): FatoDeManutencaoDto => ({
  fato,
  operadoresAdmitidos: [],
});

/** O fato como a leitura pública do catálogo o devolve: no envelope, com os operadores declarados. */
export const noCatalogo = (fato: FatoCandidatoView): FatoDoCatalogoDto => ({
  fato,
  operadoresAdmitidos: [
    { codigo: OperadorCodigo.IGUAL, rotulo: 'é' },
    { codigo: OperadorCodigo.DIFERENTE, rotulo: 'não é' },
  ],
});

export const codigoComRotulo = <T extends string>(codigo: T, rotulo: string) => ({
  codigo,
  rotulo,
});

type Definicao = FatoCandidatoDto['definicao'];

export const tipoSimOuNao = { codigo: TipoDoDadoCodigo.SIM_OU_NAO, rotulo: 'Sim ou não' };
export const tipoOpcao = { codigo: TipoDoDadoCodigo.OPCAO, rotulo: 'Opção' };
export const tipoNumerico = { codigo: TipoDoDadoCodigo.NUMERICO, rotulo: 'Número' };
export const tipoTexto = { codigo: TipoDoDadoCodigo.TEXTO, rotulo: 'Texto' };
export const valorUnico = { codigo: QuantidadeDeValoresCodigo.VALOR_UNICO, rotulo: 'Um valor' };
export const variosValores = {
  codigo: QuantidadeDeValoresCodigo.VARIOS_VALORES,
  rotulo: 'Vários valores',
};
export const origemDeclarada = { codigo: OrigemFatoCodigo.DECLARADO, rotulo: 'Declarado' };
export const origemCalculada = { codigo: OrigemFatoCodigo.CALCULADO, rotulo: 'Calculado' };
export const fonteCatalogo = { codigo: FonteValoresFatoCodigo.CATALOGO, rotulo: 'Catálogo' };
export const fonteDoProcesso = {
  codigo: FonteValoresFatoCodigo.OPCOES_DO_PROCESSO,
  rotulo: 'Processo',
};

export const comDefinicao = (
  fato: FatoCandidatoDto,
  parte: Partial<Definicao>,
): FatoCandidatoDto => ({ ...fato, definicao: { ...fato.definicao, ...parte } });

export const comResolucao = (
  fato: FatoCandidatoDto,
  parte: Partial<Definicao['resolucao']>,
): FatoCandidatoDto => ({
  ...fato,
  definicao: { ...fato.definicao, resolucao: { ...fato.definicao.resolucao, ...parte } },
});

export const comProtecao = (
  fato: FatoCandidatoDto,
  parte: Partial<Definicao['protecao']>,
): FatoCandidatoDto => ({
  ...fato,
  definicao: { ...fato.definicao, protecao: { ...fato.definicao.protecao, ...parte } },
});

export const comValoresDeclarados = (
  fato: FatoCandidatoDto,
  declarados: Definicao['valores']['declarados'],
  fonte: Definicao['valores']['fonte'] = fato.definicao.valores.fonte,
): FatoCandidatoDto => ({
  ...fato,
  definicao: { ...fato.definicao, valores: { fonte, declarados } },
});

export const comAprovacao = (
  fato: FatoCandidatoDto,
  situacao: string,
  classificacaoRecomendada: string | null = null,
  justificativa: string | null = null,
): FatoCandidatoDto =>
  comProtecao(fato, {
    aprovacao: {
      ...APROVADA,
      situacao,
      classificacaoRecomendada: classificacaoDaRecomendacao(classificacaoRecomendada),
      justificativa,
    },
  });

function classificacaoDaRecomendacao(codigo: string | null) {
  if (!codigo) return null;
  const valor = ClassificacaoDeProtecaoCodigo[codigo as keyof typeof ClassificacaoDeProtecaoCodigo];
  const rotulos: Partial<Record<ClassificacaoDeProtecaoCodigo, string>> = {
    SENSIVEL: 'Pessoal sensível',
    IDENTIFICADOR: 'Identificador',
  };
  return codigoComRotulo(valor, rotulos[valor] ?? codigo);
}

/** Fato declarado de sim ou não: o mais simples de editar. */
export const trabalha: FatoCandidatoDto = {
  id: '01960000-0000-7000-0000-0000000000a1',
  codigo: 'TRABALHA',
  descritivo: {
    nome: 'Trabalha',
    descricao: 'Se o candidato trabalha.',
    componenteExibicao: null,
  },
  definicao: {
    dominio: tipoSimOuNao,
    cardinalidade: valorUnico,
    escopo: codigoComRotulo(EscopoFatoCodigo.CANDIDATO, 'Candidato'),
    formato: null,
    valores: { fonte: null, declarados: [] },
    resolucao: {
      origem: origemDeclarada,
      pontoResolucao: 'INSCRICAO',
      binding: 'CAMPO_INSCRICAO:TRABALHA',
    },
    protecao: {
      classificacao: codigoComRotulo(ClassificacaoDeProtecaoCodigo.PESSOAL, 'Pessoal'),
      finalidade: 'Classificar a reserva de vagas.',
      hipoteseLegal: codigoComRotulo(
        HipoteseLegalTratamentoCodigo.EXECUCAO_POLITICAS_PUBLICAS,
        'Execução de políticas públicas',
      ),
      aprovacao: APROVADA,
    },
  },
  semeadoPeloSistema: false,
  ativo: true,
  regrasPadrao: [],
};

/** Fato declarado categórico, com um valor. */
export const corRaca: FatoCandidatoDto = {
  ...trabalha,
  id: '01960000-0000-7000-0000-0000000000f1',
  codigo: 'COR_RACA',
  descritivo: {
    nome: 'Cor ou raça',
    descricao: 'Cor ou raça autodeclarada.',
    componenteExibicao: null,
  },
  definicao: {
    ...trabalha.definicao,
    dominio: tipoOpcao,
    valores: {
      fonte: fonteCatalogo,
      declarados: [
        { codigo: 'PRETA', descricao: 'Preta', ordem: 0, ativo: true, orientacao: null },
      ],
    },
    resolucao: { ...trabalha.definicao.resolucao, binding: 'CAMPO_INSCRICAO:COR_RACA' },
    protecao: {
      ...trabalha.definicao.protecao,
      classificacao: codigoComRotulo(ClassificacaoDeProtecaoCodigo.SENSIVEL, 'Pessoal sensível'),
      finalidade: 'Reserva de vagas.',
      hipoteseLegal: codigoComRotulo(
        HipoteseLegalTratamentoCodigo.CUMPRIMENTO_OBRIGACAO_LEGAL,
        'Cumprimento de obrigação legal',
      ),
    },
  },
};

export const comValores = (fato: FatoCandidatoDto = corRaca): FatoCandidatoDto =>
  comValoresDeclarados(fato, [
    { codigo: 'PRETA', descricao: 'Preta', ordem: 0, ativo: true, orientacao: null },
    { codigo: 'PARDA', descricao: 'Parda', ordem: 1, ativo: false, orientacao: null },
    { codigo: 'BRANCA', descricao: 'Branca', ordem: 2, ativo: true, orientacao: null },
  ]);

export const derivado: FatoCandidatoDto = {
  ...comResolucao(trabalha, { origem: origemCalculada, binding: 'REGRA_DERIVACAO:PERFIL' }),
  id: '01960000-0000-7000-0000-0000000000d1',
  codigo: 'PERFIL',
  descritivo: { ...trabalha.descritivo, nome: 'Perfil' },
};

export const agregado: FatoCandidatoDto = {
  ...comResolucao(derivado, { binding: 'AGREGACAO_GRUPO:RENDA' }),
  id: '01960000-0000-7000-0000-0000000000e1',
  codigo: 'PERFIL_FAMILIAR',
  descritivo: { ...derivado.descritivo, nome: 'Perfil familiar' },
};

export const quilombola: FatoCandidatoView = {
  id: 'q',
  codigo: 'QUILOMBOLA',
  nome: 'Quilombola',
  descricao: 'Se o candidato é quilombola.',
  dominio: tipoSimOuNao,
  origem: origemDeclarada,
  cardinalidade: valorUnico,
  valoresDominio: null,
  pontoResolucao: 'INSCRICAO',
  binding: 'CAMPO_INSCRICAO:QUILOMBOLA',
  valoresDominioDeclarados: null,
  fonteValores: null,
  ativo: true,
  escopo: codigoComRotulo(EscopoFatoCodigo.CANDIDATO, 'Candidato'),
  classificacaoProtecao: codigoComRotulo(ClassificacaoDeProtecaoCodigo.PESSOAL, 'Pessoal'),
  hipoteseLegal: codigoComRotulo(
    HipoteseLegalTratamentoCodigo.EXECUCAO_POLITICAS_PUBLICAS,
    'Execução de políticas públicas',
  ),
  finalidadeTratamento: 'Classificar a reserva de vagas.',
  protecaoAprovada: true,
};

export const FASES_DA_API = [
  { id: 'f1', codigo: 'INSCRICAO', nome: 'Inscrição', descricao: null },
  { id: 'f2', codigo: 'HOMOLOGACAO_INSCRICOES', nome: 'Homologação', descricao: null },
];

export const pendencia = (fato: FatoCandidatoDto) => ({
  tipo: ItemParaSolicitarRequestCadastro.DADO_DO_CANDIDATO,
  id: fato.id,
  codigo: fato.codigo,
  nome: fato.descritivo.nome,
  classificacaoProtecao: fato.definicao.protecao.classificacao,
  finalidadeTratamento: fato.definicao.protecao.finalidade,
  hipoteseLegal: fato.definicao.protecao.hipoteseLegal,
  aprovacao: { ...APROVADA, situacao: 'PENDENTE' },
});
