import { TestBed } from '@angular/core/testing';

import { FormularioDoCandidatoComponent } from './formulario-do-candidato';
import { CenarioDoFormularioDoCandidato } from './formulario-do-candidato.testing';
import {
  CODIGO_DA_SECAO_DE_DADOS,
  FORMULARIO_DE_ENDERECO_COM_ALDEIA,
  apresentacaoDaEtapa,
  campoApresentado,
  itemDasRegras,
} from './formularios-de-exemplo.testing';

describe('FormularioDoCandidatoComponent', () => {
  let cenario: CenarioDoFormularioDoCandidato;

  beforeEach(() => {
    cenario = CenarioDoFormularioDoCandidato.preparar();
  });

  it('o endereço urbano esconde a aldeia, e a aldeia a mostra obrigatória e anuncia que apareceu', () => {
    const tela = cenario.montar(FORMULARIO_DE_ENDERECO_COM_ALDEIA);

    cenario.clicar(cenario.opcao('Urbano'));
    expect(tela.textContent).not.toContain('Nome da aldeia');

    cenario.clicar(cenario.opcao('Aldeia'));
    const rotulo = [...tela.querySelectorAll('label')].find((l) =>
      l.textContent?.includes('Nome da aldeia'),
    );
    expect(rotulo?.classList).toContain('is-required');
    expect(tela.querySelector('[aria-live="polite"]')?.textContent).toContain(
      'Apareceu: Nome da aldeia.',
    );
    expect(cenario.simulacoes.at(-1)?.respostas).toEqual({ TIPO_ENDERECO: 'ALDEIA' });
  });

  it('a escolha que as regras limitam continua escolha quando nenhuma opção vale ainda', () => {
    const tela = cenario.montar({
      ...FORMULARIO_DE_ENDERECO_COM_ALDEIA,
      coleta: {
        itens: [
          campoApresentado('CURSOS', 'Cursos', 'ESCOLHA_MULTIPLA', {
            valoresSelecionaveis: [{ codigo: 'MED', descricao: 'Medicina', ordem: 0 }],
          }),
          campoApresentado('ESPERA', 'Lista de espera', 'ESCOLHA_UNICA', { ordem: 1 }),
        ],
        grupos: [],
      },
      regras: {
        etapas: [
          {
            codigo: CODIGO_DA_SECAO_DE_DADOS,
            itens: [
              itemDasRegras('CURSOS', { obrigatoriedade: { tipo: 'NUNCA' } }),
              itemDasRegras('ESPERA', {
                restricoes: [{ tipo: 'OPCOES_DAS_RESPOSTAS', fatos: ['CURSOS'] }],
              }),
            ],
          },
        ],
      },
    });

    expect(tela.textContent).toContain('Nenhuma opção vale com as respostas dadas até aqui.');
    expect(tela.querySelector('input[type="text"]')).toBeNull();
  });

  it('o município sem regra de UF fica habilitado; com ela, espera a UF respondida antes', () => {
    const tela = cenario.montar({
      ...FORMULARIO_DE_ENDERECO_COM_ALDEIA,
      coleta: {
        itens: [
          campoApresentado('NATURALIDADE', 'Naturalidade', 'MUNICIPIO'),
          campoApresentado('MUNICIPIO_RESIDENCIA', 'Município de residência', 'MUNICIPIO', {
            ordem: 1,
          }),
        ],
        grupos: [],
      },
      regras: {
        etapas: [
          {
            codigo: CODIGO_DA_SECAO_DE_DADOS,
            itens: [
              itemDasRegras('NATURALIDADE'),
              itemDasRegras('MUNICIPIO_RESIDENCIA', {
                restricoes: [{ tipo: 'MUNICIPIOS_DA_UF', fatos: ['UF_RESIDENCIA'] }],
              }),
            ],
          },
        ],
      },
    });
    const [naturalidade, residencia] = [
      ...tela.querySelectorAll('ui-valor-de-municipio input'),
    ] as HTMLInputElement[];

    expect(naturalidade.disabled).toBe(false);
    expect(residencia.disabled).toBe(true);
    expect(tela.textContent).toContain('Informe antes a UF para escolher o município.');
  });

  it('o município já escolhido segue desfazível quando a UF de que ele depende é limpa', () => {
    cenario.fixture = TestBed.createComponent(FormularioDoCandidatoComponent);
    cenario.fixture.componentRef.setInput('formulario', {
      ...FORMULARIO_DE_ENDERECO_COM_ALDEIA,
      coleta: {
        itens: [campoApresentado('MUNICIPIO_RESIDENCIA', 'Município de residência', 'MUNICIPIO')],
        grupos: [],
      },
      regras: {
        etapas: [
          {
            codigo: CODIGO_DA_SECAO_DE_DADOS,
            itens: [
              itemDasRegras('MUNICIPIO_RESIDENCIA', {
                restricoes: [{ tipo: 'MUNICIPIOS_DA_UF', fatos: ['UF_RESIDENCIA'] }],
              }),
            ],
          },
        ],
      },
    });
    cenario.fixture.componentRef.setInput('inicial', {
      respostas: { MUNICIPIO_RESIDENCIA: '1504208' },
    });
    cenario.fixture.detectChanges();

    const controle = (cenario.fixture.nativeElement as HTMLElement).querySelector(
      'ui-valor-de-municipio input',
    ) as HTMLInputElement;
    expect(controle.disabled).toBe(false);
  });

  it('a resposta que as regras deixaram de permitir continua na lista, marcada, para ser desfeita', () => {
    cenario.fixture = TestBed.createComponent(FormularioDoCandidatoComponent);
    cenario.fixture.componentRef.setInput('formulario', {
      ...FORMULARIO_DE_ENDERECO_COM_ALDEIA,
      coleta: {
        itens: [
          campoApresentado('TURNO', 'Turno', 'ESCOLHA_UNICA', {
            valoresSelecionaveis: [{ codigo: 'NOITE', descricao: 'Noite', ordem: 0 }],
          }),
        ],
        grupos: [],
      },
      regras: {
        etapas: [
          {
            codigo: CODIGO_DA_SECAO_DE_DADOS,
            itens: [
              itemDasRegras('TURNO', {
                restricoes: [
                  {
                    tipo: 'OPCOES_PERMITIDAS',
                    entradas: [
                      {
                        quando: [[{ fato: 'TRABALHA', operador: 'IGUAL', valor: true }]],
                        valores: ['NOITE'],
                      },
                    ],
                  },
                ],
              }),
            ],
          },
        ],
      },
    });
    cenario.fixture.componentRef.setInput('inicial', { respostas: { TURNO: 'NOITE' } });
    cenario.fixture.componentRef.setInput('pressupostos', { TRABALHA: false });
    cenario.fixture.detectChanges();
    const opcaoMarcada = cenario.opcao('Noite (não vale com as respostas dadas)');
    expect(opcaoMarcada.checked).toBe(true);
  });

  it('a resposta que esconde uma seção anterior não tira o candidato da seção em que está', () => {
    const tela = cenario.montar({
      ...FORMULARIO_DE_ENDERECO_COM_ALDEIA,
      etapas: [
        {
          codigo: 'A',
          codigoNasRegras: 'Inscricao:A',
          ordem: 0,
          tipo: 'SECAO',
          apresentacao: apresentacaoDaEtapa('Seção A'),
        },
        {
          codigo: 'B',
          codigoNasRegras: 'Inscricao:B',
          ordem: 1,
          tipo: 'SECAO',
          apresentacao: apresentacaoDaEtapa('Seção B'),
        },
        {
          codigo: 'C',
          codigoNasRegras: 'Inscricao:C',
          ordem: 2,
          tipo: 'SECAO',
          apresentacao: apresentacaoDaEtapa('Seção C'),
        },
      ],
      coleta: {
        itens: [campoApresentado('QUER_A', 'Mostrar a seção A?', 'SIM_OU_NAO')],
        grupos: [],
      },
      regras: {
        etapas: [
          {
            codigo: 'Inscricao:A',
            exibicao: [[{ fato: 'QUER_A', operador: 'IGUAL', valor: true }]],
          },
          { codigo: 'Inscricao:B', itens: [itemDasRegras('QUER_A')] },
          { codigo: 'Inscricao:C' },
        ],
      },
    });

    cenario.clicar(cenario.botao('2'));
    cenario.clicar(cenario.opcao('Não'));

    expect(tela.querySelector('h3')?.textContent).toContain('Seção B');
  });

  it('o número pela metade, como "1,", não é erro e vale o que já foi escrito', () => {
    const tela = cenario.montar({
      ...FORMULARIO_DE_ENDERECO_COM_ALDEIA,
      coleta: { itens: [campoApresentado('NOTA', 'Nota', 'NUMERO')], grupos: [] },
      regras: { etapas: [{ codigo: CODIGO_DA_SECAO_DE_DADOS, itens: [itemDasRegras('NOTA')] }] },
    });

    cenario.digitar(tela.querySelector('input') as HTMLInputElement, '1,');

    expect(tela.textContent).not.toContain('Escreva um número');
    expect(cenario.simulacoes.at(-1)?.respostas).toEqual({ NOTA: 1 });
  });

  it('uma partida nova recria os campos: o número digitado pela metade não passa para ela', () => {
    const formulario = {
      ...FORMULARIO_DE_ENDERECO_COM_ALDEIA,
      coleta: { itens: [campoApresentado('NOTA', 'Nota', 'NUMERO')], grupos: [] },
      regras: { etapas: [{ codigo: CODIGO_DA_SECAO_DE_DADOS, itens: [itemDasRegras('NOTA')] }] },
    };
    const tela = cenario.montar(formulario);
    cenario.digitar(tela.querySelector('input') as HTMLInputElement, '7,a');
    expect(tela.textContent).toContain('Escreva um número');

    cenario.fixture.componentRef.setInput('inicial', {});
    cenario.fixture.detectChanges();

    expect((tela.querySelector('input') as HTMLInputElement).value).toBe('');
    expect(tela.textContent).not.toContain('Escreva um número');
  });

  it('a etapa das regras sem seção, como a dos campos do rascunho ainda sem seção, vira o passo "Outros dados"', () => {
    const tela = cenario.montar({
      ...FORMULARIO_DE_ENDERECO_COM_ALDEIA,
      coleta: { itens: [campoApresentado('NOME_SOCIAL', 'Nome social', 'TEXTO')], grupos: [] },
      regras: {
        etapas: [
          {
            codigo: 'Inscricao',
            itens: [itemDasRegras('NOME_SOCIAL', { obrigatoriedade: { tipo: 'NUNCA' } })],
          },
          { codigo: CODIGO_DA_SECAO_DE_DADOS },
        ],
      },
    });

    expect(tela.querySelector('h3')?.textContent).toContain('Outros dados');
    expect(tela.textContent).toContain('Nome social');
  });

  it('as regras que não formam formulário são mostradas com o caminho do problema', () => {
    const tela = cenario.montar({
      ...FORMULARIO_DE_ENDERECO_COM_ALDEIA,
      regras: {
        etapas: [
          {
            codigo: CODIGO_DA_SECAO_DE_DADOS,
            itens: [itemDasRegras('NOME', { obrigatoriedade: { tipo: 'QUANDO' } })],
          },
        ],
      },
    });

    expect(tela.textContent).toContain('etapas[0].itens[0].regras.obrigatoriedade');
  });

  it('a orientação da opção aparece abaixo dela e descreve o controle; a opção sem orientação não tem descrição', () => {
    const tela = cenario.montar({
      ...FORMULARIO_DE_ENDERECO_COM_ALDEIA,
      coleta: {
        itens: [
          campoApresentado('COR_RACA', 'Cor ou raça', 'ESCOLHA_UNICA', {
            valoresSelecionaveis: [
              { codigo: 'BRANCA', descricao: 'Branca', ordem: 0 },
              {
                codigo: 'PRETA',
                descricao: 'Preta',
                ordem: 1,
                orientacao:
                  'Quem concorre às vagas para pretos e pardos passa pela heteroidentificação.',
              },
            ],
          }),
        ],
        grupos: [],
      },
      regras: {
        etapas: [{ codigo: CODIGO_DA_SECAO_DE_DADOS, itens: [itemDasRegras('COR_RACA')] }],
      },
    });

    const preta = cenario.opcao('Preta');
    const orientacao = tela.querySelector(`#${preta.getAttribute('aria-describedby')}`);
    expect(orientacao?.textContent).toContain('heteroidentificação');
    expect(cenario.opcao('Branca').hasAttribute('aria-describedby')).toBe(false);
  });
});
