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

const COM_TERMO: FormularioDoCandidato = {
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
};

const DUAS_SECOES: FormularioDoCandidato = {
  finalidade: 'INSCRICAO',
  etapas: [
    {
      codigo: 'CONTATO',
      codigoNasRegras: 'Inscricao:CONTATO',
      ordem: 0,
      tipo: 'SECAO',
      titulo: 'Contato',
    },
    { codigo: 'NOME', codigoNasRegras: 'Inscricao:NOME', ordem: 1, tipo: 'SECAO', titulo: 'Nome' },
  ],
  termos: [],
  grupos: [],
  fatosColetados: [
    campo('EMAIL', 'E-mail', 'TEXTO'),
    campo('NOME_SOCIAL', 'Nome social', 'TEXTO', { ordem: 1 }),
  ],
  regras: {
    etapas: [
      { codigo: 'Inscricao:CONTATO', itens: [regra('EMAIL')] },
      { codigo: 'Inscricao:NOME', itens: [regra('NOME_SOCIAL')] },
    ],
  },
};

const FAMILIA: FormularioDoCandidato = {
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

  const montar = (
    formulario: FormularioDoCandidato,
    entradas: Readonly<Record<string, unknown>> = {},
  ): HTMLElement => {
    fixture = TestBed.createComponent(FormularioDoCandidatoComponent);
    fixture.componentRef.setInput('formulario', formulario);
    for (const [nome, valor] of Object.entries(entradas))
      fixture.componentRef.setInput(nome, valor);
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

  describe('faixa de data', () => {
    /** O nascimento de até 120 anos antes do envio até o envio, a regra do conjunto básico. */
    const NASCIMENTO: FormularioDoCandidato = {
      ...ENDERECO,
      fatosColetados: [campo('DATA_NASCIMENTO', 'Data de nascimento', 'DATA')],
      regras: {
        etapas: [
          {
            codigo: SECAO,
            itens: [
              regra('DATA_NASCIMENTO', {
                restricoes: [
                  {
                    tipo: 'FAIXA_DE_DATA',
                    dataMinima: { ancora: 'ENVIO', anos: -120, dias: 0 },
                    dataMaxima: { ancora: 'ENVIO', anos: 0, dias: 0 },
                  },
                ],
              }),
            ],
          },
        ],
      },
    };
    /** 23h30 de 11/10/2026 em Belém, já 12/10 em UTC: o dia do envio é 11/10. */
    const ENVIO = { instante: '2026-10-12T02:30:00Z', fuso: 'America/Belem' };
    const dataDe = (tela: HTMLElement): HTMLInputElement =>
      tela.querySelector('input[type="date"]') as HTMLInputElement;
    const sair = (input: HTMLInputElement): void => {
      input.dispatchEvent(new Event('blur'));
      fixture.detectChanges();
    };

    it('o calendário vai dos limites contados do dia do envio no fuso dele', () => {
      const input = dataDe(montar(NASCIMENTO, { envio: ENVIO }));

      expect(input.getAttribute('min')).toBe('1906-10-11');
      expect(input.getAttribute('max')).toBe('2026-10-11');
    });

    it('sem faixa, o calendário ainda prende o ano em quatro dígitos', () => {
      const input = dataDe(
        montar({
          ...NASCIMENTO,
          regras: { etapas: [{ codigo: SECAO, itens: [regra('DATA_NASCIMENTO')] }] },
        }),
      );

      expect(input.getAttribute('max')).toBe('9999-12-31');
    });

    it('a dica dos limites, em dd/mm/aaaa, descreve o campo antes de qualquer erro', () => {
      const tela = montar(NASCIMENTO, { envio: ENVIO });
      const input = dataDe(tela);
      const dica = tela.querySelector('.field__hint');

      expect(dica?.textContent?.trim()).toBe('Informe uma data entre 11/10/1906 e 11/10/2026.');
      expect(input.getAttribute('aria-describedby')?.split(' ')).toContain(dica?.id);
      expect(tela.querySelector('.field__error')).toBeNull();
    });

    it('a data fora dos limites só vira erro quando o candidato sai do campo', () => {
      const tela = montar(NASCIMENTO, { envio: ENVIO });
      const input = dataDe(tela);

      digitar(input, '2027-01-10');
      expect(tela.querySelector('.field__error')).toBeNull();
      expect(input.getAttribute('aria-invalid')).toBeNull();

      sair(input);
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(tela.querySelector('.field__error')?.textContent).toContain(
        'Informe uma data entre 11/10/1906 e 11/10/2026.',
      );

      digitar(input, '2027-01-11');
      expect(tela.querySelector('.field__error')).toBeNull();
    });

    it('concluir a seção mostra a data fora dos limites sem esperar o candidato sair do campo', () => {
      const tela = montar(NASCIMENTO, { envio: ENVIO });

      digitar(dataDe(tela), '2027-01-10');
      clicar(botao(tela, 'Concluir a seção'));

      expect(tela.querySelector('.field__error')?.textContent).toContain(
        'Informe uma data entre 11/10/1906 e 11/10/2026.',
      );
    });

    it('sem envio, o limite contado dele não tem dica, e a simulação não leva envio', () => {
      const tela = montar(NASCIMENTO);

      expect(tela.querySelector('.field__hint')).toBeNull();
      expect(simulacoes.at(-1)?.envio).toBeNull();
    });
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
    clicar(botao(tela, 'Remover Integrante 1'));

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
    const tela = montar(COM_TERMO);

    clicar(botao(tela, 'Concluir a seção'));
    expect(tela.textContent).toContain('Aceite o termo para concluir.');

    clicar(tela.querySelector('.formulario-candidato__termo input') as HTMLInputElement);
    expect(tela.textContent).not.toContain('Aceite o termo para concluir.');
  });

  it('o termo aceito na retomada volta marcado, e desmarcá-lo emite a lista sem ele', () => {
    const aceites: (readonly string[])[] = [];
    const tela = montar(COM_TERMO, { termosAceitosIniciais: ['VERACIDADE'] });
    fixture.componentInstance.termosAceitosChange.subscribe((a) => aceites.push(a));
    const termo = tela.querySelector('.formulario-candidato__termo input') as HTMLInputElement;
    expect(termo.checked).toBe(true);

    clicar(termo);

    expect(aceites.at(-1)).toEqual([]);
  });

  it('a resposta fixa entra na simulação com o valor, e o campo só mostra a exibição', () => {
    const tela = montar(
      {
        ...ENDERECO,
        fatosColetados: [campo('CPF', 'CPF', 'TEXTO', { formato: 'CPF' })],
        regras: { etapas: [{ codigo: SECAO, itens: [regra('CPF')] }] },
      },
      { respostasFixas: { CPF: { valor: '69959836371', exibicao: '***.598.363-**' } } },
    );
    const input = tela.querySelector('input') as HTMLInputElement;

    expect(input.readOnly).toBe(true);
    expect(input.value).toBe('***.598.363-**');
    expect(simulacoes.at(-1)?.respostas).toEqual({ CPF: '69959836371' });
  });

  const TELEFONE: FormularioDoCandidato = {
    ...ENDERECO,
    fatosColetados: [campo('TELEFONE', 'Telefone', 'TEXTO', { formato: 'TELEFONE' })],
    regras: { etapas: [{ codigo: SECAO, itens: [regra('TELEFONE')] }] },
  };

  it('o telefone vai à resposta só com os dígitos e ganha a máscara ao sair do campo', () => {
    const tela = montar(TELEFONE);
    const input = tela.querySelector('input') as HTMLInputElement;

    digitar(input, '61981951555');
    expect(simulacoes.at(-1)?.respostas).toEqual({ TELEFONE: '61981951555' });

    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(input.value).toBe('(61) 98195-1555');

    digitar(input, '(94) 3322-1234');
    expect(simulacoes.at(-1)?.respostas).toEqual({ TELEFONE: '9433221234' });
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(input.value).toBe('(94) 3322-1234');
    expect(simulacoes.at(-1)?.respostas).toEqual({ TELEFONE: '9433221234' });
  });

  it('o telefone gravado aparece com a máscara, e o que não é telefone fica como foi digitado', () => {
    const tela = montar(TELEFONE, { inicial: { respostas: { TELEFONE: '61981951555' } } });
    const input = tela.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('(61) 98195-1555');

    digitar(input, '619819');
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(input.value).toBe('619819');
    expect(simulacoes.at(-1)?.respostas).toEqual({ TELEFONE: '619819' });
  });

  it('escolher a seção em que já está leva o foco ao título na hora, e a renderização seguinte não o tira do campo', () => {
    const tela = montar(DUAS_SECOES);
    const titulo = tela.querySelector('h3') as HTMLElement;
    const input = tela.querySelector('input') as HTMLInputElement;

    // Sem renderizar no clique, como quando a detecção de mudanças agrupa os eventos do quadro.
    botao(tela, '1').click();
    expect(document.activeElement).toBe(titulo);

    input.focus();
    fixture.detectChanges();

    expect(document.activeElement).toBe(input);
  });

  it('a recusa do servidor leva à seção do campo, põe o foco nele e some quando ele muda', async () => {
    const tela = montar(DUAS_SECOES);
    fixture.componentRef.setInput('errosDoServidor', [
      { campo: 'NOME_SOCIAL', mensagem: 'Informe nome e sobrenome.' },
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    const input = tela.querySelector('input') as HTMLInputElement;
    expect(tela.querySelector('h3')?.textContent).toContain('Nome');
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(tela.querySelector(`#${input.getAttribute('aria-describedby')}`)?.textContent).toContain(
      'Informe nome e sobrenome.',
    );
    expect(botao(tela, '2').classList).toContain('is-error');

    digitar(input, 'Ariel Drumond');

    expect(tela.textContent).not.toContain('Informe nome e sobrenome.');
  });

  it('a recusa do servidor a um campo de ocorrência aparece ao lado dele, e a do grupo, no grupo', () => {
    const tela = montar(FAMILIA, {
      inicial: { grupos: { FAMILIA: [{ id: 'membro-1', respostas: { RENDA: 100 } }] } },
    });
    fixture.componentRef.setInput('errosDoServidor', [
      { campo: 'FAMILIA.membro-1.RENDA', mensagem: 'Renda acima do teto.' },
      { campo: 'FAMILIA', mensagem: 'Informe de 1 a 2.' },
    ]);
    fixture.detectChanges();

    const renda = tela.querySelector('[data-campo="FAMILIA.membro-1.RENDA"]');
    expect(renda?.querySelector('.field__error')?.textContent).toContain('Renda acima do teto.');
    expect(
      tela.querySelector('fieldset.formulario-candidato__grupo > .field__error')?.textContent,
    ).toContain('Informe de 1 a 2.');
  });

  it('a recusa do servidor a um termo aparece no termo', () => {
    const tela = montar(COM_TERMO);
    fixture.componentRef.setInput('errosDoServidor', [
      { campo: 'VERACIDADE', mensagem: 'Aceite a versão vigente do termo.' },
    ]);
    fixture.detectChanges();

    expect(tela.querySelector('.formulario-candidato__termo .field__error')?.textContent).toContain(
      'Aceite a versão vigente do termo.',
    );
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

  it('a última seção conclui por padrão; quem hospeda a ação final tira o botão dela', () => {
    let tela = montar(DUAS_SECOES);
    clicar(botao(tela, 'Próxima seção'));
    expect(botao(tela, 'Concluir a seção')).toBeDefined();

    tela = montar(DUAS_SECOES, { concluirNaUltimaSecao: false });
    expect(botao(tela, 'Próxima seção')).toBeDefined();
    clicar(botao(tela, 'Próxima seção'));
    expect(botao(tela, 'Concluir a seção')).toBeUndefined();
    expect(botao(tela, 'Seção anterior')).toBeDefined();
  });

  it('concluir todas leva à seção da primeira pendência, põe o foco nela e anuncia quantas são', () => {
    const tela = montar(DUAS_SECOES);
    digitar(tela.querySelector('input') as HTMLInputElement, 'fernanda_laura_drumond@lhp.com.br');

    expect(fixture.componentInstance.concluirTodas()).toBe(1);
    fixture.detectChanges();

    const input = tela.querySelector('input') as HTMLInputElement;
    expect(tela.querySelector('h3')?.textContent).toContain('Nome');
    expect(document.activeElement).toBe(input);
    expect(tela.querySelector('[data-campo="NOME_SOCIAL"] .field__error')?.textContent).toContain(
      'Responda este campo.',
    );
    expect(tela.querySelector('[aria-live="polite"]')?.textContent).toBe(
      'Há 1 item a corrigir. O primeiro está na seção Nome.',
    );
  });

  it('concluir todas sem pendência dá as seções como concluídas, e o opcional em branco não pende', () => {
    const tela = montar({
      ...DUAS_SECOES,
      regras: {
        etapas: [
          { codigo: 'Inscricao:CONTATO', itens: [regra('EMAIL')] },
          { codigo: 'Inscricao:NOME', itens: [regra('NOME_SOCIAL', { obrigatoriedade: 'NUNCA' })] },
        ],
      },
    });
    digitar(tela.querySelector('input') as HTMLInputElement, 'fernanda_laura_drumond@lhp.com.br');

    expect(fixture.componentInstance.concluirTodas()).toBe(0);
    fixture.detectChanges();

    expect(simulacoes.at(-1)?.etapasConcluidas).toEqual(['Inscricao:CONTATO', 'Inscricao:NOME']);
    expect(tela.querySelector('h3')?.textContent).toContain('Contato');
  });

  it('concluir todas conta o termo obrigatório sem aceite e leva o foco a ele', () => {
    const tela = montar(COM_TERMO);

    expect(fixture.componentInstance.concluirTodas()).toBe(1);
    fixture.detectChanges();

    expect(document.activeElement).toBe(
      tela.querySelector('[data-campo="VERACIDADE"] input[type="checkbox"]'),
    );
    expect(tela.textContent).toContain('Aceite o termo para concluir.');
  });

  it('concluir todas conta o grupo obrigatório sem integrante', () => {
    montar(FAMILIA);

    expect(fixture.componentInstance.concluirTodas()).toBe(1);
  });

  it('concluir todas leva o foco ao subitem pendente da ocorrência em que ele está', async () => {
    const tela = montar(FAMILIA, {
      inicial: {
        grupos: {
          FAMILIA: [
            { id: 'membro-1', respostas: { RENDA: 1200 } },
            { id: 'membro-2', respostas: {} },
          ],
        },
      },
    });

    expect(fixture.componentInstance.concluirTodas()).toBe(1);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.activeElement).toBe(
      tela.querySelector('[data-campo="FAMILIA.membro-2.RENDA"] input'),
    );
  });

  it('concluir todas leva o foco ao obrigatório que só aparece com o opcional em branco', async () => {
    const tela = montar({
      ...DUAS_SECOES,
      fatosColetados: [
        campo('TEM_BOLSA', 'Tem bolsa', 'TEXTO'),
        campo('JUSTIFICATIVA', 'Justificativa', 'TEXTO', { ordem: 1 }),
      ],
      regras: {
        etapas: [
          {
            codigo: 'Inscricao:CONTATO',
            itens: [
              regra('TEM_BOLSA', { obrigatoriedade: 'NUNCA' }),
              regra('JUSTIFICATIVA', {
                exibicao: [[{ fato: 'BOLSISTA', operador: 'IGUAL', valor: false }]],
              }),
            ],
          },
          { codigo: 'Inscricao:NOME', itens: [] },
        ],
        derivacoes: [
          {
            fatoCodigo: 'BOLSISTA',
            booleano: true,
            regras: [
              { quando: [[{ fato: 'TEM_BOLSA', operador: 'IGUAL', valor: 'SIM' }]] },
            ],
          },
        ],
      },
    });
    expect(tela.textContent).not.toContain('Justificativa');

    expect(fixture.componentInstance.concluirTodas()).toBe(1);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.activeElement).toBe(tela.querySelector('[data-campo="JUSTIFICATIVA"] input'));
  });
});
