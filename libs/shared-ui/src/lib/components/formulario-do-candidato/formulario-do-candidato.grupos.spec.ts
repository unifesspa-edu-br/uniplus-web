import { CenarioDoFormularioDoCandidato } from './formulario-do-candidato.testing';
import {
  CODIGO_DA_SECAO_DE_DADOS,
  FORMULARIO_DE_ENDERECO_COM_ALDEIA,
  campoRenderizavel,
  grupoDasRegras,
  itemDasRegras,
} from './formularios-de-exemplo.testing';

describe('FormularioDoCandidatoComponent', () => {
  let cenario: CenarioDoFormularioDoCandidato;

  beforeEach(() => {
    cenario = CenarioDoFormularioDoCandidato.preparar();
  });

  it('o grupo acrescenta ocorrências até o máximo e volta a permitir ao remover', () => {
    const tela = cenario.montar({
      ...FORMULARIO_DE_ENDERECO_COM_ALDEIA,
      coleta: {
        itens: [],
        grupos: [
          {
            codigo: 'FAMILIA',
            ordem: 0,
            rotulo: 'Integrante',
            ocorrencias: { minimo: 1, maximo: 2, incluiCandidato: false },
            subitens: [campoRenderizavel('RENDA', 'Renda', 'NUMERO')],
          },
        ],
      },
      regras: {
        etapas: [
          {
            codigo: CODIGO_DA_SECAO_DE_DADOS,
            grupos: [grupoDasRegras('FAMILIA', [itemDasRegras('RENDA')])],
          },
        ],
      },
    });

    cenario.clicar(cenario.botao('Acrescentar'));
    cenario.clicar(cenario.botao('Acrescentar'));
    expect(cenario.botao('Acrescentar').disabled).toBe(true);
    expect(tela.querySelectorAll('.formulario-candidato__ocorrencia')).toHaveLength(2);

    cenario.clicar(cenario.botao('Remover Integrante 2'));
    expect(cenario.botao('Acrescentar').disabled).toBe(false);
    expect(cenario.simulacoes.at(-1)?.grupos?.['FAMILIA']).toHaveLength(1);
  });

  it('o grupo de mínimo zero aceita a declaração de que não há ocorrência, distinta de não responder', () => {
    cenario.montar({
      ...FORMULARIO_DE_ENDERECO_COM_ALDEIA,
      coleta: {
        itens: [],
        grupos: [
          {
            codigo: 'BENS',
            ordem: 0,
            rotulo: 'Bem',
            ocorrencias: { minimo: 0, incluiCandidato: false },
            subitens: [campoRenderizavel('VALOR', 'Valor', 'NUMERO')],
          },
        ],
      },
      regras: {
        etapas: [
          {
            codigo: CODIGO_DA_SECAO_DE_DADOS,
            grupos: [
              grupoDasRegras('BENS', [itemDasRegras('VALOR')], {
                ocorrencias: { minimo: 0, incluiCandidato: false },
              }),
            ],
          },
        ],
      },
    });

    cenario.clicar(cenario.botao('Declarar que não há'));
    expect(cenario.simulacoes.at(-1)?.grupos).toEqual({ BENS: [] });

    cenario.clicar(cenario.botao('Desfazer a declaração'));
    expect(cenario.simulacoes.at(-1)?.grupos).toEqual({});
  });

  it('remover o último integrante volta o grupo a sem resposta, e não à declaração de que não há', () => {
    cenario.montar({
      ...FORMULARIO_DE_ENDERECO_COM_ALDEIA,
      coleta: {
        itens: [],
        grupos: [
          {
            codigo: 'BENS',
            ordem: 0,
            rotulo: 'Bem',
            ocorrencias: { minimo: 0, incluiCandidato: false },
            subitens: [campoRenderizavel('VALOR', 'Valor', 'NUMERO')],
          },
        ],
      },
      regras: {
        etapas: [
          {
            codigo: CODIGO_DA_SECAO_DE_DADOS,
            grupos: [
              grupoDasRegras('BENS', [itemDasRegras('VALOR')], {
                ocorrencias: { minimo: 0, incluiCandidato: false },
              }),
            ],
          },
        ],
      },
    });

    cenario.clicar(cenario.botao('Acrescentar'));
    cenario.clicar(cenario.botao('Remover Integrante 1'));

    expect(cenario.simulacoes.at(-1)?.grupos).toEqual({});
  });

  it('no grupo que inclui o candidato, os outros integrantes não oferecem o parentesco de próprio candidato', () => {
    const parentesco = campoRenderizavel('PARENTESCO', 'Parentesco', 'SELECAO_UNICA', {
      valoresSelecionaveis: [
        { codigo: 'PROPRIO_CANDIDATO', descricao: 'Próprio candidato', ordem: 0 },
        { codigo: 'MAE', descricao: 'Mãe', ordem: 1 },
      ],
    });
    cenario.montar({
      ...FORMULARIO_DE_ENDERECO_COM_ALDEIA,
      coleta: {
        itens: [],
        grupos: [
          {
            codigo: 'FAMILIA',
            ordem: 0,
            rotulo: 'Integrante',
            ocorrencias: { minimo: 1, incluiCandidato: true },
            subitens: [parentesco],
          },
        ],
      },
      regras: {
        etapas: [
          {
            codigo: CODIGO_DA_SECAO_DE_DADOS,
            grupos: [
              grupoDasRegras('FAMILIA', [itemDasRegras('PARENTESCO')], {
                ocorrencias: { minimo: 1, incluiCandidato: true },
              }),
            ],
          },
        ],
      },
    });

    cenario.clicar(cenario.botao('Incluir você'));
    cenario.clicar(cenario.botao('Acrescentar'));

    expect(cenario.opcao('Mãe')).toBeTruthy();
    expect(cenario.opcao('Próprio candidato')).toBeUndefined();
  });
});
