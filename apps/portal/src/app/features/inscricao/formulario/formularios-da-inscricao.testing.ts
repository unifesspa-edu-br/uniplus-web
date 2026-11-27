import {
  BlocoSistemaCodigo,
  type FormularioApresentadoDoProcessoDto,
  TipoDeCampoCodigo,
  TipoObrigatoriedadeCodigo,
  TipoPaginaFormularioCodigo,
} from '@uniplus/shared-data/selecao';

import {
  FORMULARIO_DE_INSCRICAO_MOCK,
  campoColetado,
  item,
} from './inscricao-do-candidato.testing';
import { type AjustesDaInscricao, RESPONDIDA } from './inscricao-do-candidato.page.testing';

const ESCOLARIDADE = 'DADOS_ACADEMICOS:ESCOLARIDADE';
export const TERMO_ACADEMICO = 'DADOS_ACADEMICOS:DECLARACAO_ACADEMICA';

/** O segundo formulário obrigatório da fase de inscrição: uma seção, um dado e um termo próprios. */
export const FORMULARIO_ACADEMICO: FormularioApresentadoDoProcessoDto = {
  codigo: 'DADOS_ACADEMICOS',
  obrigatorio: true,
  comprovacaoDocumental: null,
  dependenciasDaAvaliacao: null,
  dependenciasDoFator: null,
  faseId: 'fase-da-inscricao',
  formulario: {
    titulo: 'Dados acadêmicos',
    paginas: [
      {
        codigo: 'ESCOLARIDADE',
        codigoNasRegras: ESCOLARIDADE,
        ordem: 0,
        tipo: TipoPaginaFormularioCodigo.SECAO,
        bloco: null,
        apresentacao: { titulo: 'Escolaridade', descricao: null, aviso: null },
      },
      {
        codigo: 'REVISAO',
        codigoNasRegras: null,
        ordem: 1,
        tipo: TipoPaginaFormularioCodigo.BLOCO,
        bloco: BlocoSistemaCodigo.REVISAO_E_ACEITE,
        apresentacao: { titulo: 'Revisão e aceite', descricao: null, aviso: null },
      },
    ],
    termos: [
      {
        ...FORMULARIO_DE_INSCRICAO_MOCK.formulario.termos[0],
        codigo: 'DECLARACAO_ACADEMICA',
        codigoNasRegras: TERMO_ACADEMICO,
        versaoId: '0199e000-0000-7000-8000-0000000000b2',
      },
    ],
    coleta: {
      itens: [
        campoColetado('INSTITUICAO_DE_ORIGEM', 'Instituição de origem', TipoDeCampoCodigo.TEXTO, {
          paginaCodigo: ESCOLARIDADE,
        }),
      ],
      grupos: [],
    },
    pressupostos: { ...FORMULARIO_DE_INSCRICAO_MOCK.formulario.pressupostos, fatos: [] },
    regras: {
      paginas: [
        {
          codigo: ESCOLARIDADE,
          exibicao: null,
          grupos: [],
          itens: [item('INSTITUICAO_DE_ORIGEM')],
        },
      ],
      termos: [
        {
          codigo: TERMO_ACADEMICO,
          regras: {
            exibicao: null,
            obrigatoriedade: { tipo: TipoObrigatoriedadeCodigo.SEMPRE, predicado: null },
          },
        },
      ],
      derivacoes: [],
      agregados: [],
    },
  },
};

/** A lista que a API entrega a um processo com dois formulários obrigatórios, na ordem do código. */
export const DOIS_FORMULARIOS: readonly FormularioApresentadoDoProcessoDto[] = [
  FORMULARIO_DE_INSCRICAO_MOCK,
  FORMULARIO_ACADEMICO,
];

/** Tudo respondido e aceito nos dois formulários: o envio sai sem pendência. */
export const RESPONDIDA_NOS_DOIS: AjustesDaInscricao = {
  respostas: { ...RESPONDIDA.respostas, INSTITUICAO_DE_ORIGEM: 'Escola Estadual Tancredo Neves' },
  aceites: [
    ...(RESPONDIDA.aceites ?? []),
    {
      formularioCodigo: 'DADOS_ACADEMICOS',
      codigo: 'DECLARACAO_ACADEMICA',
      versaoId: 'v2',
      hashVersao: 'h2',
    },
  ],
};
