import {
  type FormularioRenderizavelDto,
  TipoRenderizacaoCodigo,
} from '@uniplus/shared-data/selecao';

type Formulario = FormularioRenderizavelDto['formulario'];
type EtapaDoFormulario = Formulario['etapas'][number];
type CampoColetado = Formulario['coleta']['itens'][number];
type ItemDasRegras = Formulario['regras']['etapas'][number]['itens'][number];

export const DADOS = 'Inscricao:DADOS_PESSOAIS';
const ENDERECO = 'Inscricao:ENDERECO';

type OutrosDoCampo = Partial<Pick<CampoColetado, 'ordem' | 'etapaCodigo' | 'formato'>>;

/** Um campo coletado da seção dos dados pessoais, sem opções fixas, sem formato, sem ajuda e sem confirmação. */
export function campoColetado(
  fatoCodigo: string,
  rotulo: string,
  tipoRenderizacao: CampoColetado['apresentacao']['tipoRenderizacao'],
  { ordem = 0, etapaCodigo = DADOS, formato = null }: OutrosDoCampo = {},
): CampoColetado {
  return {
    fatoCodigo,
    ordem,
    etapaCodigo,
    formato,
    valoresSelecionaveis: null,
    apresentacao: { rotulo, tipoRenderizacao, ajuda: null, pedirConfirmacao: false },
  };
}

/** Um formulário de inscrição no contrato atual, para os testes da tela. */
export const FORMULARIO_DE_INSCRICAO_MOCK: FormularioRenderizavelDto = {
  comprovacaoDocumental: null,
  dependenciasDaAvaliacao: null,
  dependenciasDoFator: null,
  faseId: 'fase-da-inscricao',
  formulario: {
    finalidade: 'INSCRICAO',
    titulo: 'Inscrição',
    etapas: [
      secao('DADOS_PESSOAIS', 0, 'Dados pessoais'),
      secao('ENDERECO', 1, 'Endereço'),
      {
        codigo: 'REVISAO',
        codigoNasRegras: null,
        ordem: 2,
        tipo: 'BLOCO',
        bloco: 'REVISAO_E_ACEITE',
        apresentacao: { titulo: 'Revisão e aceite', descricao: null, aviso: null },
      },
    ],
    termos: [
      {
        codigo: 'VERACIDADE',
        codigoNasRegras: 'Inscricao:VERACIDADE',
        ordem: 0,
        termoId: '0199e000-0000-7000-8000-0000000000a1',
        versaoId: '0199e000-0000-7000-8000-0000000000a2',
        conteudo: {
          nome: 'Declaração de veracidade',
          texto: 'Declaro que as informações prestadas são verdadeiras.',
          baseLegal: 'Edital do processo seletivo',
          formaAceite: 'CHECKBOX',
          hashVersao: 'sha256-veracidade-v1',
        },
      },
    ],
    coleta: {
      itens: [
        campoColetado('NOME', 'Nome completo', TipoRenderizacaoCodigo.TEXTO, {
          formato: 'NOME_PESSOA',
        }),
        campoColetado('CPF', 'CPF', TipoRenderizacaoCodigo.TEXTO, { ordem: 1, formato: 'CPF' }),
        campoColetado('DATA_NASCIMENTO', 'Data de nascimento', TipoRenderizacaoCodigo.DATA, {
          ordem: 2,
        }),
        campoColetado(
          'ENDERECO_RESIDENCIAL',
          'Endereço residencial',
          TipoRenderizacaoCodigo.ENDERECO,
          {
            ordem: 3,
            etapaCodigo: ENDERECO,
          },
        ),
      ],
      grupos: [],
    },
    pressupostos: {
      dataReferenciaFatos: '2026-12-10',
      fusoDoEnvio: 'America/Belem',
      fatos: [
        {
          fatoCodigo: 'FAIXA_ETARIA',
          rotulo: 'Idade na data de referência',
          tipoRenderizacao: TipoRenderizacaoCodigo.NUMERO,
          formato: null,
          valoresSelecionaveis: null,
          calculadoDe: ['DATA_NASCIMENTO'],
        },
      ],
    },
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
          regras: { exibicao: null, obrigatoriedade: { tipo: 'SEMPRE', predicado: null } },
        },
      ],
      derivacoes: [],
      agregados: [],
    },
  },
};

function secao(codigo: string, ordem: number, titulo: string): EtapaDoFormulario {
  return {
    codigo,
    codigoNasRegras: `Inscricao:${codigo}`,
    ordem,
    tipo: 'SECAO',
    bloco: null,
    apresentacao: { titulo, descricao: null, aviso: null },
  };
}

/** O item das regras: sempre obrigatório e sem restrição. */
export function item(fatoCodigo: string, formato: string | null = null): ItemDasRegras {
  return {
    fatoCodigo,
    regras: {
      exibicao: null,
      obrigatoriedade: { tipo: 'SEMPRE', predicado: null },
      restricoes: [],
      impedimento: null,
    },
    oferta: null,
    formato,
  };
}

/** O mesmo envelope, com o formulário trocado nos blocos que `mudancas` dá. */
export function comFormulario(
  base: FormularioRenderizavelDto,
  mudancas: Partial<Formulario>,
): FormularioRenderizavelDto {
  return { ...base, formulario: { ...base.formulario, ...mudancas } };
}

/** O formulário que também coleta o campo, com a regra de sempre obrigatório na primeira seção. */
export function comCampoColetado(
  base: FormularioRenderizavelDto,
  campo: CampoColetado,
): FormularioRenderizavelDto {
  const { coleta, regras } = base.formulario;
  return comFormulario(base, {
    coleta: { ...coleta, itens: [...coleta.itens, campo] },
    regras: {
      ...regras,
      etapas: regras.etapas.map((etapa, posicao) =>
        posicao === 0 ? { ...etapa, itens: [...etapa.itens, item(campo.fatoCodigo)] } : etapa,
      ),
    },
  });
}
