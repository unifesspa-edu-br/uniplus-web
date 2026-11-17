import type { FormularioRenderizavelDto } from '@uniplus/shared-data/selecao';

type EtapaDoFormulario = FormularioRenderizavelDto['etapas'][number];
type CampoColetado = FormularioRenderizavelDto['fatosColetados'][number];

const DADOS = 'Inscricao:DADOS_PESSOAIS';
const ENDERECO = 'Inscricao:ENDERECO';

/** O que o campo coletado tem por padrão: sem opções fixas, sem formato, sem ajuda e sem confirmação. */
const CAMPO_COLETADO = {
  valoresSelecionaveis: null,
  formato: null,
  ajuda: null,
  pedirConfirmacao: false,
} satisfies Partial<CampoColetado>;

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
    secao('DADOS_PESSOAIS', 0, 'Dados pessoais'),
    secao('ENDERECO', 1, 'Endereço'),
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
    {
      ...CAMPO_COLETADO,
      fatoCodigo: 'NOME',
      ordem: 0,
      rotulo: 'Nome completo',
      tipoRenderizacao: 'TEXTO',
      etapaCodigo: DADOS,
      formato: 'NOME_PESSOA',
    },
    {
      ...CAMPO_COLETADO,
      fatoCodigo: 'CPF',
      ordem: 1,
      rotulo: 'CPF',
      tipoRenderizacao: 'TEXTO',
      etapaCodigo: DADOS,
      formato: 'CPF',
    },
    {
      ...CAMPO_COLETADO,
      fatoCodigo: 'DATA_NASCIMENTO',
      ordem: 2,
      rotulo: 'Data de nascimento',
      tipoRenderizacao: 'DATA',
      etapaCodigo: DADOS,
    },
    {
      ...CAMPO_COLETADO,
      fatoCodigo: 'ENDERECO_RESIDENCIAL',
      ordem: 3,
      rotulo: 'Endereço residencial',
      tipoRenderizacao: 'ENDERECO',
      etapaCodigo: ENDERECO,
    },
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

function secao(codigo: string, ordem: number, titulo: string): EtapaDoFormulario {
  return {
    codigo,
    codigoNasRegras: `Inscricao:${codigo}`,
    ordem,
    tipo: 'SECAO',
    bloco: null,
    titulo,
    descricao: null,
    aviso: null,
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
