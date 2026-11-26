import {
  BlocoSistemaCodigo,
  FormatoTextoCodigo,
  TipoPaginaFormularioCodigo,
  TipoObrigatoriedadeCodigo,
  type FormularioApresentadoDoProcessoDto,
  TipoDeCampoCodigo,
} from '@uniplus/shared-data/selecao';

type Formulario = FormularioApresentadoDoProcessoDto['formulario'];
type PaginaDoFormulario = Formulario['paginas'][number];
type CampoColetado = Formulario['coleta']['itens'][number];
type ItemDasRegras = Formulario['regras']['paginas'][number]['itens'][number];

export const DADOS = 'Inscricao:DADOS_PESSOAIS';
const ENDERECO = 'Inscricao:ENDERECO';

type OutrosDoCampo = Partial<Pick<CampoColetado, 'ordem' | 'paginaCodigo' | 'formato'>>;

/** Um campo coletado da seção dos dados pessoais, sem opções fixas, sem formato, sem ajuda e sem confirmação. */
export function campoColetado(
  fatoCodigo: string,
  rotulo: string,
  tipoDeCampo: CampoColetado['apresentacao']['tipoDeCampo'],
  { ordem = 0, paginaCodigo = DADOS, formato = null }: OutrosDoCampo = {},
): CampoColetado {
  return {
    fatoCodigo,
    ordem,
    paginaCodigo,
    formato,
    valoresSelecionaveis: null,
    apresentacao: { rotulo, tipoDeCampo, ajuda: null, pedirConfirmacao: false },
  };
}

/** Um formulário de inscrição no contrato atual, para os testes da tela. */
export const FORMULARIO_DE_INSCRICAO_MOCK: FormularioApresentadoDoProcessoDto = {
  comprovacaoDocumental: null,
  dependenciasDaAvaliacao: null,
  dependenciasDoFator: null,
  faseId: 'fase-da-inscricao',
  formulario: {
    finalidade: 'INSCRICAO',
    titulo: 'Inscrição',
    paginas: [
      secao('DADOS_PESSOAIS', 0, 'Dados pessoais'),
      secao('ENDERECO', 1, 'Endereço'),
      {
        codigo: 'REVISAO',
        codigoNasRegras: null,
        ordem: 2,
        tipo: TipoPaginaFormularioCodigo.BLOCO,
        bloco: BlocoSistemaCodigo.REVISAO_E_ACEITE,
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
          formaAceite: {
            codigo:
              'A_DEFINIR' as FormularioApresentadoDoProcessoDto['formulario']['termos'][number]['conteudo']['formaAceite']['codigo'],
            rotulo: 'Aceite de teste',
          },
          hashVersao: 'sha256-veracidade-v1',
        },
      },
    ],
    coleta: {
      itens: [
        campoColetado('NOME', 'Nome completo', TipoDeCampoCodigo.TEXTO, {
          formato: 'NOME_PESSOA',
        }),
        campoColetado('CPF', 'CPF', TipoDeCampoCodigo.TEXTO, { ordem: 1, formato: 'CPF' }),
        campoColetado('DATA_NASCIMENTO', 'Data de nascimento', TipoDeCampoCodigo.DATA, {
          ordem: 2,
        }),
        campoColetado('ENDERECO_RESIDENCIAL', 'Endereço residencial', TipoDeCampoCodigo.ENDERECO, {
          ordem: 3,
          paginaCodigo: ENDERECO,
        }),
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
          tipoDeCampo: TipoDeCampoCodigo.NUMERO,
          formato: null,
          valoresSelecionaveis: null,
          calculadoDe: ['DATA_NASCIMENTO'],
        },
      ],
    },
    regras: {
      paginas: [
        {
          codigo: DADOS,
          exibicao: null,
          grupos: [],
          itens: [
            item('NOME', FormatoTextoCodigo.NOME_PESSOA),
            item('CPF', FormatoTextoCodigo.CPF),
            item('DATA_NASCIMENTO'),
          ],
        },
        { codigo: ENDERECO, exibicao: null, grupos: [], itens: [item('ENDERECO_RESIDENCIAL')] },
      ],
      termos: [
        {
          codigo: 'Inscricao:VERACIDADE',
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

function secao(codigo: string, ordem: number, titulo: string): PaginaDoFormulario {
  return {
    codigo,
    codigoNasRegras: `Inscricao:${codigo}`,
    ordem,
    tipo: TipoPaginaFormularioCodigo.SECAO,
    bloco: null,
    apresentacao: { titulo, descricao: null, aviso: null },
  };
}

/** O item das regras: sempre obrigatório e sem restrição. */
export function item(fatoCodigo: string, formato: ItemDasRegras['formato'] = null): ItemDasRegras {
  return {
    fatoCodigo,
    regras: {
      exibicao: null,
      obrigatoriedade: { tipo: TipoObrigatoriedadeCodigo.SEMPRE, predicado: null },
      restricoes: [],
      impedimento: null,
    },
    oferta: null,
    formato,
  };
}

/** O mesmo envelope, com o formulário trocado nos blocos que `mudancas` dá. */
export function comFormulario(
  base: FormularioApresentadoDoProcessoDto,
  mudancas: Partial<Formulario>,
): FormularioApresentadoDoProcessoDto {
  return { ...base, formulario: { ...base.formulario, ...mudancas } };
}

/** O formulário que também coleta o campo, com a regra de sempre obrigatório na primeira seção. */
export function comCampoColetado(
  base: FormularioApresentadoDoProcessoDto,
  campo: CampoColetado,
): FormularioApresentadoDoProcessoDto {
  const { coleta, regras } = base.formulario;
  return comFormulario(base, {
    coleta: { ...coleta, itens: [...coleta.itens, campo] },
    regras: {
      ...regras,
      paginas: regras.paginas.map((pagina, posicao) =>
        posicao === 0 ? { ...pagina, itens: [...pagina.itens, item(campo.fatoCodigo)] } : pagina,
      ),
    },
  });
}
