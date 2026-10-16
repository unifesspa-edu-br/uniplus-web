import type { FormularioRenderizavelDto } from '@uniplus/shared-data/selecao';

const DADOS = 'Inscricao:DADOS_PESSOAIS';
const ENDERECO = 'Inscricao:ENDERECO';

/** Um formulário de inscrição no contrato atual, para os testes da tela. */
export const FORMULARIO_DE_INSCRICAO_MOCK: FormularioRenderizavelDto = {
  comprovacaoDocumental: null,
  dependenciasDaAvaliacao: null,
  dependenciasDoFator: null,
  faseId: 'fase-da-inscricao',
  finalidade: 'INSCRICAO',
  titulo: 'Inscrição',
  dataReferenciaFatos: '2026-12-10',
  fusoDoEnvio: 'America/Belem',
  etapas: [
    secao('DADOS_PESSOAIS', DADOS, 0, 'Dados pessoais'),
    secao('ENDERECO', ENDERECO, 1, 'Endereço'),
    {
      codigo: 'REVISAO',
      codigoNasRegras: null,
      ordem: 2,
      tipo: 'BLOCO',
      bloco: 'REVISAO_E_ACEITE',
      titulo: 'Revisão e aceite',
      descricao: null,
      aviso: null,
    },
  ],
  termos: [
    {
      codigo: 'VERACIDADE',
      codigoNasRegras: 'Inscricao:VERACIDADE',
      ordem: 0,
      termoId: '0199e000-0000-7000-8000-0000000000a1',
      versaoId: '0199e000-0000-7000-8000-0000000000a2',
      nome: 'Declaração de veracidade',
      texto: 'Declaro que as informações prestadas são verdadeiras.',
      baseLegal: 'Edital do processo seletivo',
      formaAceite: 'CHECKBOX',
      hashVersao: 'sha256-veracidade-v1',
    },
  ],
  fatosColetados: [
    campo('NOME', 0, 'Nome completo', 'TEXTO', DADOS, 'NOME_PESSOA'),
    campo('CPF', 1, 'CPF', 'TEXTO', DADOS, 'CPF'),
    campo('DATA_NASCIMENTO', 2, 'Data de nascimento', 'DATA', DADOS),
    campo('ENDERECO_RESIDENCIAL', 3, 'Endereço residencial', 'ENDERECO', ENDERECO),
  ],
  grupos: [],
  pressupostos: [
    {
      fatoCodigo: 'FAIXA_ETARIA',
      rotulo: 'Idade na data de referência',
      tipoRenderizacao: 'NUMERO',
      formato: null,
      valoresSelecionaveis: null,
      calculadoDe: ['DATA_NASCIMENTO'],
    },
  ],
  regras: {
    etapas: [
      {
        codigo: DADOS,
        exibicao: null,
        grupos: [],
        itens: [item('NOME', 'NOME_PESSOA'), item('CPF', 'CPF'), item('DATA_NASCIMENTO')],
      },
      { codigo: ENDERECO, exibicao: null, grupos: [], itens: [item('ENDERECO_RESIDENCIAL')] },
    ],
    termos: [
      {
        codigo: 'Inscricao:VERACIDADE',
        exibicao: null,
        obrigatoriedade: 'SEMPRE',
        predicadoObrigatoriedade: null,
      },
    ],
    derivacoes: [],
    agregados: [],
  },
};

function secao(
  codigo: string,
  codigoNasRegras: string,
  ordem: number,
  titulo: string,
): FormularioRenderizavelDto['etapas'][number] {
  return {
    codigo,
    codigoNasRegras,
    ordem,
    tipo: 'SECAO',
    bloco: null,
    titulo,
    descricao: null,
    aviso: null,
  };
}

function campo(
  fatoCodigo: string,
  ordem: number,
  rotulo: string,
  tipoRenderizacao: string,
  etapaCodigo: string,
  formato: string | null = null,
): FormularioRenderizavelDto['fatosColetados'][number] {
  return {
    fatoCodigo,
    ordem,
    rotulo,
    tipoRenderizacao,
    valoresSelecionaveis: null,
    etapaCodigo,
    formato,
    ajuda: null,
    pedirConfirmacao: false,
  };
}

function item(
  fatoCodigo: string,
  formato: string | null = null,
): FormularioRenderizavelDto['regras']['etapas'][number]['itens'][number] {
  return {
    fatoCodigo,
    exibicao: null,
    obrigatoriedade: 'SEMPRE',
    predicadoObrigatoriedade: null,
    restricoes: [],
    impedimento: null,
    oferta: null,
    formato,
  };
}
