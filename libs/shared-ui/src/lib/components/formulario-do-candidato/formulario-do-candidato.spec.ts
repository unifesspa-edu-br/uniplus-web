import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { vi } from 'vitest';
import { of } from 'rxjs';

import { BUSCA_DE_MUNICIPIOS } from '../editor-de-condicoes/valor-de-municipio';
import { BUSCA_DE_CEP, type CepEncontrado } from '../endereco-geo/endereco-geo.model';

import { FormularioDoCandidatoComponent } from './formulario-do-candidato';
import type { CampoRenderizavel, FormularioDoCandidato } from './formulario-do-candidato.model';
import type { ItemDasRegras, SimulacaoDoFormulario } from './interpretador/regras-do-formulario';

/**
 * O formulário do candidato desenha o que o interpretador decide: as seções ligadas às regras pelo
 * código nas regras — prefixado pela finalidade no processo —, os campos que aparecem e somem com as
 * respostas, a pendência do obrigatório ao concluir a seção, os grupos dentro do mínimo e do máximo e a
 * mensagem de cada regra violada ao lado do campo.
 */
const SECAO = 'Inscricao:DADOS';

const regra = (fatoCodigo: string, outros: Partial<ItemDasRegras> = {}): ItemDasRegras => ({
  fatoCodigo,
  obrigatoriedade: 'SEMPRE',
  restricoes: [],
  ...outros,
});

const campo = (
  fatoCodigo: string,
  rotulo: string,
  tipoRenderizacao: string,
  outros: Partial<CampoRenderizavel> = {},
): CampoRenderizavel => ({
  fatoCodigo,
  ordem: 0,
  rotulo,
  tipoRenderizacao,
  ...outros,
});

const ENDERECO: FormularioDoCandidato = {
  finalidade: 'INSCRICAO',
  etapas: [{ codigo: 'DADOS', codigoNasRegras: SECAO, ordem: 0, tipo: 'SECAO', titulo: 'Dados' }],
  termos: [],
  grupos: [],
  fatosColetados: [
    campo('TIPO_ENDERECO', 'Tipo de endereço', 'SELECAO_UNICA', {
      valoresSelecionaveis: [
        { codigo: 'URBANO', descricao: 'Urbano', ordem: 0 },
        { codigo: 'ALDEIA', descricao: 'Aldeia', ordem: 1 },
      ],
    }),
    campo('NOME_ALDEIA', 'Nome da aldeia', 'TEXTO', { ordem: 1 }),
  ],
  regras: {
    etapas: [
      {
        codigo: SECAO,
        itens: [
          regra('TIPO_ENDERECO', { oferta: ['ALDEIA', 'URBANO'] }),
          regra('NOME_ALDEIA', {
            exibicao: [[{ fato: 'TIPO_ENDERECO', operador: 'IGUAL', valor: 'ALDEIA' }]],
          }),
        ],
      },
    ],
  },
};

const MARABA = { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' };
const CEP_DE_MARABA: CepEncontrado = {
  cep: '68507590',
  tipo: 'Rua',
  logradouro: 'Folha 31',
  complemento: null,
  bairro: 'Nova Marabá',
  distrito: null,
  cidade: 'Marabá',
  codigoIbge: '1504208',
  uf: 'PA',
  latitude: null,
  longitude: null,
  nivelResolucao: 'logradouro',
  origem: 'geo-api',
};
const RESIDENCIA: FormularioDoCandidato = {
  ...ENDERECO,
  fatosColetados: [campo('ENDERECO_RESIDENCIAL', 'Endereço residencial', 'ENDERECO')],
  regras: { etapas: [{ codigo: SECAO, itens: [regra('ENDERECO_RESIDENCIAL')] }] },
};

describe('FormularioDoCandidatoComponent', () => {
  let fixture: ComponentFixture<FormularioDoCandidatoComponent>;
  let simulacoes: SimulacaoDoFormulario[];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: BUSCA_DE_MUNICIPIOS, useValue: () => of({ ok: true, data: [MARABA] }) },
        { provide: BUSCA_DE_CEP, useValue: () => of({ ok: true, data: CEP_DE_MARABA }) },
      ],
    });
  });

  const montar = (formulario: FormularioDoCandidato): HTMLElement => {
    fixture = TestBed.createComponent(FormularioDoCandidatoComponent);
    fixture.componentRef.setInput('formulario', formulario);
    simulacoes = [];
    fixture.componentInstance.simulacaoChange.subscribe((s) => simulacoes.push(s));
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };
  const opcao = (tela: HTMLElement, texto: string): HTMLInputElement =>
    [...tela.querySelectorAll('label')]
      .find((l) => l.textContent?.trim() === texto)
      ?.querySelector('input') as HTMLInputElement;
  const clicar = (elemento: HTMLElement): void => {
    elemento.click();
    fixture.detectChanges();
  };
  const botao = (tela: HTMLElement, texto: string): HTMLButtonElement =>
    [...tela.querySelectorAll('button')].find((b) =>
      b.textContent?.trim().startsWith(texto),
    ) as HTMLButtonElement;
  const digitar = (input: HTMLInputElement, texto: string): void => {
    input.value = texto;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  it('o endereço urbano esconde a aldeia, e a aldeia a mostra obrigatória e anuncia que apareceu', () => {
    const tela = montar(ENDERECO);

    clicar(opcao(tela, 'Urbano'));
    expect(tela.textContent).not.toContain('Nome da aldeia');

    clicar(opcao(tela, 'Aldeia'));
    const rotulo = [...tela.querySelectorAll('label')].find((l) =>
      l.textContent?.includes('Nome da aldeia'),
    );
    expect(rotulo?.classList).toContain('is-required');
    expect(tela.querySelector('[aria-live="polite"]')?.textContent).toContain(
      'Apareceu: Nome da aldeia.',
    );
    expect(simulacoes.at(-1)?.respostas).toEqual({ TIPO_ENDERECO: 'ALDEIA' });
  });

  it('concluir a seção mostra a pendência do obrigatório sem resposta ao lado dele', () => {
    const tela = montar(ENDERECO);
    expect(tela.textContent).not.toContain('Responda este campo.');

    clicar(botao(tela, 'Concluir a seção'));

    expect(tela.querySelector('.field__error')?.textContent).toContain('Responda este campo.');
    expect(simulacoes.at(-1)?.etapasConcluidas).toEqual([SECAO]);
  });

  it('concluir de novo uma seção já concluída não muda a simulação', () => {
    const tela = montar(ENDERECO);
    clicar(botao(tela, 'Concluir a seção'));
    const quantas = simulacoes.length;

    clicar(botao(tela, 'Concluir a seção'));

    expect(simulacoes).toHaveLength(quantas);
  });

  it('a resposta que viola a faixa mostra a mensagem com os limites ao lado do campo', () => {
    const tela = montar({
      ...ENDERECO,
      fatosColetados: [campo('NOTA', 'Nota', 'NUMERO')],
      regras: {
        etapas: [
          {
            codigo: SECAO,
            itens: [regra('NOTA', { restricoes: [{ tipo: 'FAIXA_NUMERICA', minimo: 0.5 }] })],
          },
        ],
      },
    });
    const input = tela.querySelector('input') as HTMLInputElement;

    digitar(input, '0,4');

    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(tela.querySelector('.field__error')?.textContent).toContain(
      'Informe um número igual ou maior que 0,5.',
    );
  });

  it('o grupo acrescenta ocorrências até o máximo e volta a permitir ao remover', () => {
    const tela = montar({
      ...ENDERECO,
      fatosColetados: [],
      grupos: [
        {
          codigo: 'FAMILIA',
          ordem: 0,
          rotulo: 'Integrante',
          minimo: 1,
          maximo: 2,
          incluiCandidato: false,
          subitens: [campo('RENDA', 'Renda', 'NUMERO')],
        },
      ],
      regras: {
        etapas: [
          {
            codigo: SECAO,
            grupos: [
              {
                codigo: 'FAMILIA',
                obrigatoriedade: 'SEMPRE',
                minimo: 1,
                maximo: 2,
                incluiCandidato: false,
                subitens: [regra('RENDA')],
              },
            ],
          },
        ],
      },
    });

    clicar(botao(tela, 'Acrescentar'));
    clicar(botao(tela, 'Acrescentar'));
    expect(botao(tela, 'Acrescentar').disabled).toBe(true);
    expect(tela.querySelectorAll('.formulario-candidato__ocorrencia')).toHaveLength(2);

    clicar(botao(tela, 'Remover Integrante 2'));
    expect(botao(tela, 'Acrescentar').disabled).toBe(false);
    expect(simulacoes.at(-1)?.grupos?.['FAMILIA']).toHaveLength(1);
  });

  it('o grupo de mínimo zero aceita a declaração de que não há ocorrência, distinta de não responder', () => {
    const tela = montar({
      ...ENDERECO,
      fatosColetados: [],
      grupos: [
        {
          codigo: 'BENS',
          ordem: 0,
          rotulo: 'Bem',
          minimo: 0,
          incluiCandidato: false,
          subitens: [campo('VALOR', 'Valor', 'NUMERO')],
        },
      ],
      regras: {
        etapas: [
          {
            codigo: SECAO,
            grupos: [
              {
                codigo: 'BENS',
                obrigatoriedade: 'SEMPRE',
                minimo: 0,
                incluiCandidato: false,
                subitens: [regra('VALOR')],
              },
            ],
          },
        ],
      },
    });

    clicar(botao(tela, 'Declarar que não há'));
    expect(simulacoes.at(-1)?.grupos).toEqual({ BENS: [] });

    clicar(botao(tela, 'Desfazer a declaração'));
    expect(simulacoes.at(-1)?.grupos).toEqual({});
  });

  it('remover o último integrante volta o grupo a sem resposta, e não à declaração de que não há', () => {
    const tela = montar({
      ...ENDERECO,
      fatosColetados: [],
      grupos: [
        {
          codigo: 'BENS',
          ordem: 0,
          rotulo: 'Bem',
          minimo: 0,
          incluiCandidato: false,
          subitens: [campo('VALOR', 'Valor', 'NUMERO')],
        },
      ],
      regras: {
        etapas: [
          {
            codigo: SECAO,
            grupos: [
              {
                codigo: 'BENS',
                obrigatoriedade: 'SEMPRE',
                minimo: 0,
                incluiCandidato: false,
                subitens: [regra('VALOR')],
              },
            ],
          },
        ],
      },
    });

    clicar(botao(tela, 'Acrescentar'));
    clicar(botao(tela, 'Remover Bem 1'));

    expect(simulacoes.at(-1)?.grupos).toEqual({});
  });

  it('a escolha que as regras limitam continua escolha quando nenhuma opção vale ainda', () => {
    const tela = montar({
      ...ENDERECO,
      fatosColetados: [
        campo('CURSOS', 'Cursos', 'SELECAO_MULTIPLA', {
          valoresSelecionaveis: [{ codigo: 'MED', descricao: 'Medicina', ordem: 0 }],
        }),
        campo('ESPERA', 'Lista de espera', 'SELECAO_UNICA', { ordem: 1 }),
      ],
      regras: {
        etapas: [
          {
            codigo: SECAO,
            itens: [
              regra('CURSOS', { obrigatoriedade: 'NUNCA' }),
              regra('ESPERA', {
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
    const tela = montar({
      ...ENDERECO,
      fatosColetados: [
        campo('NATURALIDADE', 'Naturalidade', 'MUNICIPIO'),
        campo('MUNICIPIO_RESIDENCIA', 'Município de residência', 'MUNICIPIO', { ordem: 1 }),
      ],
      regras: {
        etapas: [
          {
            codigo: SECAO,
            itens: [
              regra('NATURALIDADE'),
              regra('MUNICIPIO_RESIDENCIA', {
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
    fixture = TestBed.createComponent(FormularioDoCandidatoComponent);
    fixture.componentRef.setInput('formulario', {
      ...ENDERECO,
      fatosColetados: [campo('MUNICIPIO_RESIDENCIA', 'Município de residência', 'MUNICIPIO')],
      regras: {
        etapas: [
          {
            codigo: SECAO,
            itens: [
              regra('MUNICIPIO_RESIDENCIA', {
                restricoes: [{ tipo: 'MUNICIPIOS_DA_UF', fatos: ['UF_RESIDENCIA'] }],
              }),
            ],
          },
        ],
      },
    });
    fixture.componentRef.setInput('inicial', { respostas: { MUNICIPIO_RESIDENCIA: '1504208' } });
    fixture.detectChanges();

    const controle = (fixture.nativeElement as HTMLElement).querySelector(
      'ui-valor-de-municipio input',
    ) as HTMLInputElement;
    expect(controle.disabled).toBe(false);
  });

  it('a resposta que as regras deixaram de permitir continua na lista, marcada, para ser desfeita', () => {
    fixture = TestBed.createComponent(FormularioDoCandidatoComponent);
    fixture.componentRef.setInput('formulario', {
      ...ENDERECO,
      fatosColetados: [
        campo('TURNO', 'Turno', 'SELECAO_UNICA', {
          valoresSelecionaveis: [{ codigo: 'NOITE', descricao: 'Noite', ordem: 0 }],
        }),
      ],
      regras: {
        etapas: [
          {
            codigo: SECAO,
            itens: [
              regra('TURNO', {
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
    fixture.componentRef.setInput('inicial', { respostas: { TURNO: 'NOITE' } });
    fixture.componentRef.setInput('pressupostos', { TRABALHA: false });
    fixture.detectChanges();
    const tela = fixture.nativeElement as HTMLElement;

    const opcaoMarcada = opcao(tela, 'Noite (não vale com as respostas dadas)');
    expect(opcaoMarcada.checked).toBe(true);
  });

  it('a resposta que esconde uma seção anterior não tira o candidato da seção em que está', () => {
    const tela = montar({
      ...ENDERECO,
      etapas: [
        { codigo: 'A', codigoNasRegras: 'Inscricao:A', ordem: 0, tipo: 'SECAO', titulo: 'Seção A' },
        { codigo: 'B', codigoNasRegras: 'Inscricao:B', ordem: 1, tipo: 'SECAO', titulo: 'Seção B' },
        { codigo: 'C', codigoNasRegras: 'Inscricao:C', ordem: 2, tipo: 'SECAO', titulo: 'Seção C' },
      ],
      fatosColetados: [campo('QUER_A', 'Mostrar a seção A?', 'BOOLEANO')],
      regras: {
        etapas: [
          {
            codigo: 'Inscricao:A',
            exibicao: [[{ fato: 'QUER_A', operador: 'IGUAL', valor: true }]],
          },
          { codigo: 'Inscricao:B', itens: [regra('QUER_A')] },
          { codigo: 'Inscricao:C' },
        ],
      },
    });

    clicar(botao(tela, '2'));
    clicar(opcao(tela, 'Não'));

    expect(tela.querySelector('h3')?.textContent).toContain('Seção B');
  });

  it('no grupo que inclui o candidato, os outros integrantes não oferecem o parentesco de próprio candidato', () => {
    const parentesco = campo('PARENTESCO', 'Parentesco', 'SELECAO_UNICA', {
      valoresSelecionaveis: [
        { codigo: 'PROPRIO_CANDIDATO', descricao: 'Próprio candidato', ordem: 0 },
        { codigo: 'MAE', descricao: 'Mãe', ordem: 1 },
      ],
    });
    const tela = montar({
      ...ENDERECO,
      fatosColetados: [],
      grupos: [
        {
          codigo: 'FAMILIA',
          ordem: 0,
          rotulo: 'Integrante',
          minimo: 1,
          incluiCandidato: true,
          subitens: [parentesco],
        },
      ],
      regras: {
        etapas: [
          {
            codigo: SECAO,
            grupos: [
              {
                codigo: 'FAMILIA',
                obrigatoriedade: 'SEMPRE',
                minimo: 1,
                incluiCandidato: true,
                subitens: [regra('PARENTESCO')],
              },
            ],
          },
        ],
      },
    });

    clicar(botao(tela, 'Incluir você'));
    clicar(botao(tela, 'Acrescentar'));

    expect(opcao(tela, 'Mãe')).toBeTruthy();
    expect(opcao(tela, 'Próprio candidato')).toBeUndefined();
  });

  it('o termo obrigatório não aceito mostra a pendência ao concluir a revisão', () => {
    const tela = montar({
      ...ENDERECO,
      fatosColetados: [],
      etapas: [
        {
          codigo: 'REVISAO',
          codigoNasRegras: null,
          ordem: 0,
          tipo: 'BLOCO',
          bloco: 'REVISAO_E_ACEITE',
          titulo: 'Revisão e aceite',
        },
      ],
      termos: [
        {
          codigo: 'VERACIDADE',
          codigoNasRegras: 'Inscricao:VERACIDADE',
          ordem: 0,
          nome: 'Veracidade',
          texto: 'Declaro.',
          baseLegal: 'Lei',
        },
      ],
      regras: {
        etapas: [],
        termos: [{ codigo: 'Inscricao:VERACIDADE', obrigatoriedade: 'SEMPRE' }],
      },
    });

    clicar(botao(tela, 'Concluir a seção'));
    expect(tela.textContent).toContain('Aceite o termo para concluir.');

    clicar(tela.querySelector('.formulario-candidato__termo input') as HTMLInputElement);
    expect(tela.textContent).not.toContain('Aceite o termo para concluir.');
  });

  it('o número pela metade, como "1,", não é erro e vale o que já foi escrito', () => {
    const tela = montar({
      ...ENDERECO,
      fatosColetados: [campo('NOTA', 'Nota', 'NUMERO')],
      regras: { etapas: [{ codigo: SECAO, itens: [regra('NOTA')] }] },
    });

    digitar(tela.querySelector('input') as HTMLInputElement, '1,');

    expect(tela.textContent).not.toContain('Escreva um número');
    expect(simulacoes.at(-1)?.respostas).toEqual({ NOTA: 1 });
  });

  it('uma partida nova recria os campos: o número digitado pela metade não passa para ela', () => {
    const formulario = {
      ...ENDERECO,
      fatosColetados: [campo('NOTA', 'Nota', 'NUMERO')],
      regras: { etapas: [{ codigo: SECAO, itens: [regra('NOTA')] }] },
    };
    const tela = montar(formulario);
    digitar(tela.querySelector('input') as HTMLInputElement, '7,a');
    expect(tela.textContent).toContain('Escreva um número');

    fixture.componentRef.setInput('inicial', {});
    fixture.detectChanges();

    expect((tela.querySelector('input') as HTMLInputElement).value).toBe('');
    expect(tela.textContent).not.toContain('Escreva um número');
  });

  it('a etapa das regras sem seção, como a dos campos do rascunho ainda sem seção, vira o passo "Outros dados"', () => {
    const tela = montar({
      ...ENDERECO,
      fatosColetados: [campo('NOME_SOCIAL', 'Nome social', 'TEXTO')],
      regras: {
        etapas: [
          { codigo: 'Inscricao', itens: [regra('NOME_SOCIAL', { obrigatoriedade: 'NUNCA' })] },
          { codigo: SECAO },
        ],
      },
    });

    expect(tela.querySelector('h3')?.textContent).toContain('Outros dados');
    expect(tela.textContent).toContain('Nome social');
  });

  it('as regras que não formam formulário são mostradas com o caminho do problema', () => {
    const tela = montar({
      ...ENDERECO,
      regras: {
        etapas: [{ codigo: SECAO, itens: [regra('NOME', { obrigatoriedade: 'QUANDO' })] }],
      },
    });

    expect(tela.textContent).toContain('etapas[0].itens[0].obrigatoriedade');
  });

  it('o endereço pelo CEP é respondido como o endereço estruturado do Geo, com a cidade', () => {
    const tela = montar(RESIDENCIA);
    expect(tela.querySelector('legend')?.textContent).toContain('Endereço residencial');

    digitar(tela.querySelector('input[id$="-cep"]') as HTMLInputElement, '68507-590');
    clicar(botao(tela, 'Buscar CEP'));
    digitar(tela.querySelector('input[id$="-numero"]') as HTMLInputElement, '12');

    expect(simulacoes.at(-1)?.respostas['ENDERECO_RESIDENCIAL']).toEqual({
      cep: '68507590',
      logradouro: 'Rua Folha 31',
      numero: '12',
      complemento: null,
      bairro: 'Nova Marabá',
      distrito: null,
      cidade: MARABA,
      latitude: null,
      longitude: null,
      nivelResolucao: 'logradouro',
      origem: 'geo-api',
    });
  });

  it('sem CEP, a cidade escolhida no campo com busca do Geo é a resposta', async () => {
    const tela = montar(RESIDENCIA);

    clicar(botao(tela, 'preencher sem CEP'));
    const uf = tela.querySelector('select[id$="-uf"]') as HTMLSelectElement;
    uf.value = 'PA';
    uf.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    const campo = tela.querySelector('input[role="combobox"]') as HTMLInputElement;
    campo.value = 'Mara';
    campo.dispatchEvent(new Event('input'));
    let marabaNaLista: HTMLElement | undefined;
    await vi.waitFor(() => {
      fixture.detectChanges();
      marabaNaLista = [...tela.querySelectorAll<HTMLElement>('[role="option"]')].find((item) =>
        item.textContent?.includes('Marabá (PA)'),
      );
      expect(marabaNaLista).toBeDefined();
    });
    marabaNaLista?.dispatchEvent(new MouseEvent('mousedown'));
    fixture.detectChanges();

    expect(simulacoes.at(-1)?.respostas['ENDERECO_RESIDENCIAL']).toMatchObject({
      cep: null,
      cidade: MARABA,
      origem: 'manual',
    });
  });

  it('o endereço já respondido volta à tela com a cidade', () => {
    fixture = TestBed.createComponent(FormularioDoCandidatoComponent);
    fixture.componentRef.setInput('formulario', RESIDENCIA);
    fixture.componentRef.setInput('inicial', {
      respostas: {
        ENDERECO_RESIDENCIAL: {
          cep: '68507590',
          logradouro: 'Rua Folha 31',
          cidade: MARABA,
          nivelResolucao: 'logradouro',
          origem: 'geo-api',
        },
      },
    });
    fixture.detectChanges();

    const tela = fixture.nativeElement as HTMLElement;
    expect((tela.querySelector('input[id$="-cidade"]') as HTMLInputElement).value).toBe('Marabá');
    expect((tela.querySelector('input[id$="-uf"]') as HTMLInputElement).value).toBe('PA');
    expect((tela.querySelector('input[id$="-logradouro"]') as HTMLInputElement).value).toBe(
      'Rua Folha 31',
    );
  });

  it('o CEP trocado e ainda não resolvido deixa o endereço obrigatório sem resposta', () => {
    const tela = montar(RESIDENCIA);
    digitar(tela.querySelector('input[id$="-cep"]') as HTMLInputElement, '68507590');
    clicar(botao(tela, 'Buscar CEP'));

    clicar(botao(tela, 'Trocar CEP'));
    const cep = tela.querySelector('input[id$="-cep"]') as HTMLInputElement;
    digitar(cep, '6850');
    clicar(botao(tela, 'Concluir a seção'));

    expect(simulacoes.at(-1)?.respostas['ENDERECO_RESIDENCIAL']).toBeUndefined();
    expect(tela.textContent).toContain('Responda este campo.');
    expect(cep.value).toBe('6850');
  });

  it('a orientação da opção aparece abaixo dela e descreve o controle; a opção sem orientação não tem descrição', () => {
    const tela = montar({
      ...ENDERECO,
      fatosColetados: [
        campo('COR_RACA', 'Cor ou raça', 'SELECAO_UNICA', {
          valoresSelecionaveis: [
            { codigo: 'BRANCA', descricao: 'Branca', ordem: 0 },
            {
              codigo: 'PRETA',
              descricao: 'Preta',
              ordem: 1,
              orientacao: 'Quem concorre às vagas para pretos e pardos passa pela heteroidentificação.',
            },
          ],
        }),
      ],
      regras: { etapas: [{ codigo: SECAO, itens: [regra('COR_RACA')] }] },
    });

    const preta = opcao(tela, 'Preta');
    const orientacao = tela.querySelector(`#${preta.getAttribute('aria-describedby')}`);
    expect(orientacao?.textContent).toContain('heteroidentificação');
    expect(opcao(tela, 'Branca').hasAttribute('aria-describedby')).toBe(false);
  });
});
