import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';

import { BUSCA_DE_MUNICIPIOS } from '../editor-de-condicoes/valor-de-municipio';
import {
  BUSCA_DE_CEP,
  type BuscaDeCep,
  type CepEncontrado,
} from '../endereco-geo/endereco-geo.model';

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
  origem: 'logradouro',
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

const FAMILIA_DE_DOIS_SUBCAMPOS: FormularioDoCandidato = {
  ...FAMILIA,
  grupos: [
    {
      ...FAMILIA.grupos[0],
      subitens: [campo('RENDA', 'Renda', 'NUMERO'), campo('PROFISSAO', 'Profissão', 'TEXTO')],
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
            subitens: [regra('RENDA'), regra('PROFISSAO')],
          },
        ],
      },
    ],
  },
};

const COM_CONFIRMACAO: FormularioDoCandidato = {
  ...DUAS_SECOES,
  fatosColetados: [campo('EMAIL', 'E-mail', 'TEXTO', { pedirConfirmacao: true })],
  regras: { etapas: [{ codigo: 'Inscricao:CONTATO', itens: [regra('EMAIL')] }] },
};

const FAMILIA_COM_CONFIRMACAO: FormularioDoCandidato = {
  ...FAMILIA,
  grupos: [
    {
      ...FAMILIA.grupos[0],
      subitens: [campo('EMAIL', 'E-mail', 'TEXTO', { pedirConfirmacao: true })],
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
            subitens: [regra('EMAIL')],
          },
        ],
      },
    ],
  },
};

describe('FormularioDoCandidatoComponent', () => {
  let fixture: ComponentFixture<FormularioDoCandidatoComponent>;
  let simulacoes: SimulacaoDoFormulario[];
  let resultadoDoCep: (cep: string) => ReturnType<BuscaDeCep>;

  beforeEach(() => {
    resultadoDoCep = () => of({ ok: true, data: CEP_DE_MARABA });
    TestBed.configureTestingModule({
      providers: [
        { provide: BUSCA_DE_MUNICIPIOS, useValue: () => of({ ok: true, data: [MARABA] }) },
        { provide: BUSCA_DE_CEP, useValue: (cep: string) => resultadoDoCep(cep) },
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
  /** O estado do passo mora no item da lista, que contém o botão. */
  const itemDoPasso = (tela: HTMLElement, texto: string): HTMLElement =>
    botao(tela, texto).closest('li') as HTMLElement;
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

  it('a resposta fixa fora do formato não mostra erro no campo', () => {
    const tela = montar(
      {
        ...ENDERECO,
        fatosColetados: [campo('NOME', 'Nome completo', 'TEXTO', { formato: 'NOME_PESSOA' })],
        regras: {
          etapas: [{ codigo: SECAO, itens: [regra('NOME', { formato: 'NOME_PESSOA' })] }],
        },
      },
      { respostasFixas: { NOME: { valor: 'Maria S. Silva', exibicao: 'Maria S. Silva' } } },
    );
    const input = tela.querySelector('input') as HTMLInputElement;

    expect(input.value).toBe('Maria S. Silva');
    expect(tela.querySelector('.field__error')).toBeNull();
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
    expect(itemDoPasso(tela, '2').classList).toContain('is-error');

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

  it('editar um subcampo do grupo descarta só a recusa dele e preserva a de outro subcampo e a de outra ocorrência', () => {
    const tela = montar(FAMILIA_DE_DOIS_SUBCAMPOS, {
      inicial: {
        grupos: {
          FAMILIA: [
            { id: 'membro-1', respostas: { RENDA: 100, PROFISSAO: 'Agricultora' } },
            { id: 'membro-2', respostas: { RENDA: 200 } },
          ],
        },
      },
    });
    fixture.componentRef.setInput('errosDoServidor', [
      { campo: 'FAMILIA.membro-1.RENDA', mensagem: 'Renda acima do teto.' },
      { campo: 'FAMILIA.membro-1.PROFISSAO', mensagem: 'Profissão não aceita.' },
      { campo: 'FAMILIA.membro-2.RENDA', mensagem: 'Renda do segundo acima do teto.' },
    ]);
    fixture.detectChanges();

    digitar(
      tela.querySelector('[data-campo="FAMILIA.membro-1.RENDA"] input') as HTMLInputElement,
      '90',
    );

    expect(tela.textContent).not.toContain('Renda acima do teto.');
    expect(tela.textContent).toContain('Profissão não aceita.');
    expect(tela.textContent).toContain('Renda do segundo acima do teto.');
  });

  it('remover a ocorrência que a API recusou tira a marcação de erro da seção, e a mensagem não volta', () => {
    const tela = montar(FAMILIA_DE_DOIS_SUBCAMPOS, {
      inicial: {
        grupos: {
          FAMILIA: [
            { id: 'membro-1', respostas: { RENDA: 100 } },
            { id: 'membro-2', respostas: { RENDA: 200 } },
          ],
        },
      },
    });
    fixture.componentRef.setInput('errosDoServidor', [
      { campo: 'FAMILIA.membro-2.RENDA', mensagem: 'Renda do segundo acima do teto.' },
    ]);
    fixture.detectChanges();
    expect(itemDoPasso(tela, '1').classList).toContain('is-error');

    clicar(botao(tela, 'Remover Integrante 2'));
    expect(itemDoPasso(tela, '1').classList).not.toContain('is-error');

    clicar(botao(tela, 'Acrescentar'));
    expect(itemDoPasso(tela, '1').classList).not.toContain('is-error');
    expect(tela.textContent).not.toContain('Renda do segundo acima do teto.');
  });

  it('editar um subcampo descarta a recusa do próprio grupo, como a de cardinalidade', () => {
    const tela = montar(FAMILIA_DE_DOIS_SUBCAMPOS, {
      inicial: { grupos: { FAMILIA: [{ id: 'membro-1', respostas: { RENDA: 100 } }] } },
    });
    fixture.componentRef.setInput('errosDoServidor', [
      { campo: 'FAMILIA', mensagem: 'Quantidade de integrantes recusada.' },
    ]);
    fixture.detectChanges();
    expect(tela.textContent).toContain('Quantidade de integrantes recusada.');

    digitar(
      tela.querySelector('[data-campo="FAMILIA.membro-1.RENDA"] input') as HTMLInputElement,
      '90',
    );

    expect(tela.textContent).not.toContain('Quantidade de integrantes recusada.');
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
      origem: 'logradouro',
    });
  });

  it('o endereço do candidato não oferece o atalho para preencher sem CEP', () => {
    const tela = montar(RESIDENCIA);

    expect(botao(tela, 'preencher sem CEP')).toBeUndefined();
    expect(tela.querySelector('select[id$="-uf"]')).toBeNull();
  });

  it('o CEP que o Geo não encontra não preenche nada e orienta a busca dos Correios em nova aba', () => {
    resultadoDoCep = () =>
      of({ ok: false, status: 404, problem: { type: 'x', title: 'x', status: 404 } } as never);
    const tela = montar(RESIDENCIA);

    digitar(tela.querySelector('input[id$="-cep"]') as HTMLInputElement, '68500000');
    clicar(botao(tela, 'Buscar CEP'));

    expect(tela.querySelector('input[id$="-logradouro"]')).toBeNull();
    const erro = tela.querySelector('[id$="-cep-error"]') as HTMLElement;
    expect(erro.getAttribute('role')).toBe('alert');
    expect(erro.textContent).toContain('CEP não encontrado. Confira o seu CEP na');
    expect(erro.textContent).toContain('use o CEP geral da sua cidade');
    const link = erro.querySelector('a') as HTMLAnchorElement;
    expect(link.href).toBe('https://buscacepinter.correios.com.br/');
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noopener');
    expect(link.textContent).toContain('abre em nova aba');
    expect(tela.querySelector('input[id$="-cep"]')?.getAttribute('aria-describedby')).toContain(
      erro.id,
    );
  });

  const buscarCepComOrigem = (origem: string): HTMLElement => {
    resultadoDoCep = () =>
      of({
        ok: true,
        data: {
          ...CEP_DE_MARABA,
          logradouro: null,
          tipo: null,
          bairro: 'Nova Marabá',
          nivelResolucao: 'cidade',
          origem,
        },
      });
    const tela = montar(RESIDENCIA);
    digitar(tela.querySelector('input[id$="-cep"]') as HTMLInputElement, '68507590');
    clicar(botao(tela, 'Buscar CEP'));
    return tela;
  };

  it('o CEP de grande usuário não exige bairro nem logradouro, mesmo no nível da cidade', () => {
    resultadoDoCep = () =>
      of({
        ok: true,
        data: {
          ...CEP_DE_MARABA,
          logradouro: null,
          tipo: null,
          bairro: null,
          nivelResolucao: 'cidade',
          origem: 'grande-usuario',
        },
      });
    const tela = montar(RESIDENCIA);

    digitar(tela.querySelector('input[id$="-cep"]') as HTMLInputElement, '68507590');
    clicar(botao(tela, 'Buscar CEP'));

    const bairro = tela.querySelector('input[id$="-bairro"]') as HTMLInputElement;
    expect(bairro.getAttribute('aria-required')).toBeNull();
    expect(bairro.readOnly).toBe(false);
    expect(simulacoes.at(-1)?.respostas['ENDERECO_RESIDENCIAL']).toMatchObject({
      cep: '68507590',
      origem: 'grande-usuario',
    });
  });

  it('a origem desconhecida do Geo exige a confirmação do CEP, como a faixa', () => {
    const tela = buscarCepComOrigem('origem-nova');

    expect(tela.querySelector('[id$="-cep-faixa"]')).not.toBeNull();
    expect(tela.querySelector('[id$="-cep-confirmacao"]')?.getAttribute('role')).toBe('alert');
    expect(simulacoes.at(-1)?.respostas['ENDERECO_RESIDENCIAL']).toBeUndefined();
  });

  it('o aviso do CEP geral descreve o campo CEP para o leitor de tela', () => {
    resultadoDoCep = () =>
      of({ ok: true, data: { ...CEP_DE_MARABA, bairro: null, origem: 'cep-geral' } });
    const tela = montar(RESIDENCIA);
    digitar(tela.querySelector('input[id$="-cep"]') as HTMLInputElement, '68507590');
    clicar(botao(tela, 'Buscar CEP'));

    const aviso = tela.querySelector('[id$="-cep-geral"]') as HTMLElement;
    expect(tela.querySelector('input[id$="-cep"]')?.getAttribute('aria-describedby')).toContain(
      aviso.id,
    );
  });

  it('o CEP geral oficial mostra de qual cidade é e exige logradouro e bairro', () => {
    resultadoDoCep = () =>
      of({
        ok: true,
        data: { ...CEP_DE_MARABA, logradouro: null, tipo: null, bairro: null, origem: 'cep-geral' },
      });
    const tela = montar(RESIDENCIA);
    digitar(tela.querySelector('input[id$="-cep"]') as HTMLInputElement, '68507590');
    clicar(botao(tela, 'Buscar CEP'));

    expect(tela.textContent).toContain('Este é o CEP geral de Marabá/PA');
    expect(tela.querySelector('input[id$="-bairro"]')?.getAttribute('aria-required')).toBe('true');
    expect(simulacoes.at(-1)?.respostas['ENDERECO_RESIDENCIAL']).toBeUndefined();
  });

  it('o CEP que só cai numa faixa avisa, não preenche além da cidade e não vale sem confirmação', () => {
    const tela = buscarCepComOrigem('faixa-bairro');

    const aviso = tela.querySelector('[id$="-cep-faixa"]') as HTMLElement;
    expect(aviso.getAttribute('role')).toBe('alert');
    expect(aviso.textContent).toContain('O CEP 68507590 não corresponde a uma rua cadastrada');
    expect(aviso.textContent).toContain('faixa de CEPs de Marabá/PA');
    expect(tela.querySelector('input[id$="-bairro"]')).toBeNull();
    expect(tela.textContent).toContain('Confirmo que este é o CEP que uso no meu endereço');
    const erro = tela.querySelector('[id$="-cep-confirmacao"]') as HTMLElement;
    expect(erro.getAttribute('role')).toBe('alert');
    const descricao = tela
      .querySelector('input[type="checkbox"]')
      ?.getAttribute('aria-describedby');
    expect(descricao).toContain(erro.id);
    expect(descricao).toContain(aviso.id);
    expect(simulacoes.at(-1)?.respostas['ENDERECO_RESIDENCIAL']).toBeUndefined();
  });

  it('confirmado o CEP de faixa, logradouro e bairro são obrigatórios e a resposta leva cepConfirmado', () => {
    const tela = buscarCepComOrigem('faixa-cidade');

    clicar(tela.querySelector('input[type="checkbox"]') as HTMLElement);
    const logradouro = tela.querySelector('input[id$="-logradouro"]') as HTMLInputElement;
    const bairro = tela.querySelector('input[id$="-bairro"]') as HTMLInputElement;
    expect([logradouro.value, bairro.value]).toEqual(['', '']);
    expect(logradouro.getAttribute('aria-required')).toBe('true');
    expect(simulacoes.at(-1)?.respostas['ENDERECO_RESIDENCIAL']).toBeUndefined();

    digitar(logradouro, 'Rua do Centro');
    digitar(bairro, 'Centro');
    expect(simulacoes.at(-1)?.respostas['ENDERECO_RESIDENCIAL']).toMatchObject({
      cepConfirmado: true,
      origem: 'faixa-cidade',
    });
  });

  it('ao trocar o CEP, os avisos de faixa e de CEP geral somem até a próxima busca e o endereço fica pendente', () => {
    const tela = buscarCepComOrigem('faixa-cidade');
    clicar(tela.querySelector('input[type="checkbox"]') as HTMLElement);

    clicar(botao(tela, 'Trocar CEP'));
    digitar(tela.querySelector('input[id$="-cep"]') as HTMLInputElement, '68507');

    expect(tela.querySelector('[id$="-cep-faixa"]')).toBeNull();
    expect(tela.querySelector('input[type="checkbox"]')).toBeNull();
    expect(tela.querySelector('[id$="-cep-geral"]')).toBeNull();
    expect(tela.querySelector('input[id$="-bairro"]')?.getAttribute('aria-required')).toBeNull();
    expect(tela.textContent).toContain('Valide o CEP em "Buscar CEP"');
    expect(simulacoes.at(-1)?.respostas['ENDERECO_RESIDENCIAL']).toBeUndefined();
  });

  it('trocar o CEP desfaz a confirmação', () => {
    const tela = buscarCepComOrigem('faixa-distrito');
    const caixa = tela.querySelector('input[type="checkbox"]') as HTMLInputElement;
    clicar(caixa);
    expect(caixa.checked).toBe(true);

    clicar(botao(tela, 'Trocar CEP'));
    digitar(tela.querySelector('input[id$="-cep"]') as HTMLInputElement, '68507');
    expect(simulacoes.at(-1)?.respostas['ENDERECO_RESIDENCIAL']).toBeUndefined();
    digitar(tela.querySelector('input[id$="-cep"]') as HTMLInputElement, '68507590');
    clicar(botao(tela, 'Buscar CEP'));

    expect((tela.querySelector('input[type="checkbox"]') as HTMLInputElement).checked).toBe(false);
  });

  it('logradouro e bairro vindos do CEP continuam editáveis', () => {
    const tela = montar(RESIDENCIA);
    digitar(tela.querySelector('input[id$="-cep"]') as HTMLInputElement, '68507590');
    clicar(botao(tela, 'Buscar CEP'));

    const logradouro = tela.querySelector('input[id$="-logradouro"]') as HTMLInputElement;
    const bairro = tela.querySelector('input[id$="-bairro"]') as HTMLInputElement;
    expect([logradouro.readOnly, bairro.readOnly]).toEqual([false, false]);
    digitar(bairro, 'Cidade Nova');
    expect(simulacoes.at(-1)?.respostas['ENDERECO_RESIDENCIAL']).toMatchObject({
      bairro: 'Cidade Nova',
    });
  });

  it('o complemento é um campo de várias linhas, de linha inteira, limitado a 300 caracteres e com contador', () => {
    const tela = montar(RESIDENCIA);
    digitar(tela.querySelector('input[id$="-cep"]') as HTMLInputElement, '68507590');
    clicar(botao(tela, 'Buscar CEP'));

    const complemento = tela.querySelector('textarea[id$="-complemento"]') as HTMLTextAreaElement;
    expect(complemento.getAttribute('maxlength')).toBe('300');
    expect(complemento.closest('.form-grid__full')).not.toBeNull();
    expect(tela.textContent).toContain(
      'Use para indicar ponto de referência ou o endereço real, quando o CEP for o geral da cidade ou de outro bairro.',
    );
    digitar(complemento as unknown as HTMLInputElement, 'Casa azul');
    const contagem = tela.querySelector('[id$="-complemento-contagem"]') as HTMLElement;
    expect(contagem.textContent).toContain('9 de 300 caracteres');
    expect(complemento.getAttribute('aria-describedby')).toContain(contagem.id);
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
          origem: 'logradouro',
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
              orientacao:
                'Quem concorre às vagas para pretos e pardos passa pela heteroidentificação.',
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

  describe('com a seção válida exigida para avançar', () => {
    const emailPreenchido = (tela: HTMLElement): void =>
      digitar(
        tela.querySelector('input[type="text"], input:not([type])') as HTMLInputElement,
        'a@b.br',
      );

    it('não avança com pergunta obrigatória pendente: fica na seção, com o foco na pergunta', () => {
      const tela = montar(DUAS_SECOES, { exigirSecaoValida: true });

      clicar(botao(tela, 'Próxima seção'));

      expect(botao(tela, '1').getAttribute('aria-current')).toBe('step');
      expect(document.activeElement?.tagName).toBe('INPUT');
      expect(tela.textContent).toContain('Há 1 item a corrigir na seção Contato.');
    });

    it('na última seção, concluir também barra com pergunta obrigatória pendente', () => {
      const tela = montar(
        {
          ...DUAS_SECOES,
          etapas: [DUAS_SECOES.etapas[0]],
          regras: { etapas: [DUAS_SECOES.regras.etapas[0]] },
        },
        { exigirSecaoValida: true },
      );

      clicar(botao(tela, 'Concluir a seção'));

      expect(tela.textContent).toContain('Há 1 item a corrigir na seção Contato.');
    });

    it('avança quando a seção está respondida', () => {
      const tela = montar(DUAS_SECOES, { exigirSecaoValida: true });
      emailPreenchido(tela);

      clicar(botao(tela, 'Próxima seção'));

      expect(botao(tela, '2').getAttribute('aria-current')).toBe('step');
    });

    it('o indicador de passos não pula uma seção pendente, mas volta sempre', () => {
      const tela = montar(DUAS_SECOES, { exigirSecaoValida: true });

      clicar(botao(tela, '2'));
      expect(botao(tela, '1').getAttribute('aria-current')).toBe('step');

      emailPreenchido(tela);
      clicar(botao(tela, '2'));
      expect(botao(tela, '2').getAttribute('aria-current')).toBe('step');

      clicar(botao(tela, 'Seção anterior'));
      expect(botao(tela, '1').getAttribute('aria-current')).toBe('step');
    });

    it('sem a exigência — a simulação do administrador — avança com pendência', () => {
      const tela = montar(DUAS_SECOES);

      clicar(botao(tela, 'Próxima seção'));

      expect(botao(tela, '2').getAttribute('aria-current')).toBe('step');
    });

    it('lista as pendências por seção sem dar nenhuma como concluída', () => {
      montar(DUAS_SECOES);

      expect(fixture.componentInstance.pendenciasPorSecao()).toEqual([
        { chave: expect.any(String), titulo: 'Contato', quantidade: 1 },
        { chave: expect.any(String), titulo: 'Nome', quantidade: 1 },
      ]);
    });
  });

  it('concluir todas com pendência não dá seção nenhuma como concluída nem muda o indicador', () => {
    const tela = montar(DUAS_SECOES);

    expect(fixture.componentInstance.concluirTodas()).toBe(2);
    fixture.detectChanges();

    expect(simulacoes.at(-1)?.etapasConcluidas ?? []).toEqual([]);
    expect(tela.querySelectorAll('nav li.is-done')).toHaveLength(0);
    expect(tela.querySelectorAll('nav li.is-error')).toHaveLength(0);
  });

  it('a seção concluída com pendência aparece com o estado de erro, e não como concluída', () => {
    const tela = montar(DUAS_SECOES);

    clicar(botao(tela, 'Próxima seção'));

    expect(itemDoPasso(tela, '1').classList).toContain('is-error');
    expect(itemDoPasso(tela, '1').classList).not.toContain('is-done');
  });

  it('ir à pendência da seção põe o foco no campo que falta sem concluir nada', async () => {
    const tela = montar(DUAS_SECOES);
    const chaveDoNome = fixture.componentInstance.pendenciasPorSecao()[1].chave;

    fixture.componentInstance.irAPendenciaDe(chaveDoNome);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(tela.querySelector('h3')?.textContent).toContain('Nome');
    expect(document.activeElement).toBe(tela.querySelector('input'));
    expect(simulacoes.at(-1)?.etapasConcluidas ?? []).toEqual([]);
  });

  it('a recusa do servidor avisa no topo da seção que tem o campo recusado', () => {
    const tela = montar(DUAS_SECOES, {
      errosDoServidor: [{ campo: 'EMAIL', mensagem: 'Recusado.' }],
    });

    expect(tela.querySelector('.formulario-candidato__secao ui-alert')?.textContent).toContain(
      'O servidor recusou 1 resposta desta seção',
    );
  });

  it('concluir todas leva à seção da primeira pendência, põe o foco nela e anuncia quantas são', () => {
    const tela = montar(DUAS_SECOES);
    digitar(tela.querySelector('input') as HTMLInputElement, 'fernanda_laura_drumond@lhp.com.br');

    expect(fixture.componentInstance.concluirTodas()).toBe(1);
    fixture.detectChanges();

    const input = tela.querySelector('input') as HTMLInputElement;
    expect(tela.querySelector('h3')?.textContent).toContain('Nome');
    expect(document.activeElement).toBe(input);
    expect(simulacoes.at(-1)?.etapasConcluidas ?? []).toEqual([]);
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

  it('concluir a seção esconde o destino: o avanço para na seção que ficou no lugar dele', () => {
    const tela = montar(
      {
        ...DUAS_SECOES,
        etapas: [
          {
            codigo: 'A',
            codigoNasRegras: 'Inscricao:A',
            ordem: 0,
            tipo: 'SECAO',
            titulo: 'Seção A',
          },
          {
            codigo: 'B',
            codigoNasRegras: 'Inscricao:B',
            ordem: 1,
            tipo: 'SECAO',
            titulo: 'Seção B',
          },
          {
            codigo: 'C',
            codigoNasRegras: 'Inscricao:C',
            ordem: 2,
            tipo: 'SECAO',
            titulo: 'Seção C',
          },
          {
            codigo: 'D',
            codigoNasRegras: 'Inscricao:D',
            ordem: 3,
            tipo: 'SECAO',
            titulo: 'Seção D',
          },
        ],
        fatosColetados: [
          campo('TEM_BOLSA', 'Tem bolsa', 'TEXTO'),
          campo('APELIDO', 'Apelido', 'TEXTO', { ordem: 1 }),
          campo('EMAIL', 'E-mail', 'TEXTO', { ordem: 2 }),
        ],
        regras: {
          etapas: [
            { codigo: 'Inscricao:A', itens: [regra('TEM_BOLSA', { obrigatoriedade: 'NUNCA' })] },
            {
              codigo: 'Inscricao:B',
              exibicao: [[{ fato: 'BOLSISTA', operador: 'DIFERENTE', valor: false }]],
            },
            { codigo: 'Inscricao:C', itens: [regra('APELIDO', { obrigatoriedade: 'NUNCA' })] },
            { codigo: 'Inscricao:D', itens: [regra('EMAIL')] },
          ],
          derivacoes: [
            {
              fatoCodigo: 'BOLSISTA',
              booleano: true,
              regras: [{ quando: [[{ fato: 'TEM_BOLSA', operador: 'IGUAL', valor: 'SIM' }]] }],
            },
          ],
        },
      },
      { exigirSecaoValida: true },
    );
    expect(tela.textContent).toContain('Seção B');

    clicar(botao(tela, 'Próxima seção'));

    expect(tela.textContent).not.toContain('Seção B');
    expect(tela.querySelector('h3')?.textContent).toContain('Seção C');
  });

  it('o obrigatório que só aparece com o opcional em branco conta como pendência, e o foco fica no título da seção', async () => {
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
            regras: [{ quando: [[{ fato: 'TEM_BOLSA', operador: 'IGUAL', valor: 'SIM' }]] }],
          },
        ],
      },
    });
    expect(tela.textContent).not.toContain('Justificativa');
    // O motivo do envio já conta o obrigatório que concluir vai mostrar, antes do clique.
    expect(fixture.componentInstance.pendenciasPorSecao().map((s) => s.quantidade)).toEqual([1]);

    expect(fixture.componentInstance.concluirTodas()).toBe(1);
    fixture.detectChanges();
    await fixture.whenStable();

    // O campo só existe depois de a seção ser concluída, e concluir é do envio válido.
    expect(document.activeElement).toBe(tela.querySelector('h3'));
  });
  describe('confirmação pedida no campo', () => {
    const EMAIL = 'fernanda_laura_drumond@lhp.com.br';
    const entradas = (
      tela: HTMLElement,
    ): { resposta: HTMLInputElement; confirmacao: HTMLInputElement } => ({
      resposta: tela.querySelector('[data-campo="EMAIL"] input') as HTMLInputElement,
      confirmacao: tela.querySelector('input[id$="-confirmacao"]') as HTMLInputElement,
    });

    it('a confirmação que não confere com a resposta bloqueia o envio e leva o foco a ela', async () => {
      const tela = montar(COM_CONFIRMACAO);
      const { resposta, confirmacao } = entradas(tela);
      digitar(resposta, EMAIL);
      digitar(confirmacao, 'outro_valor@lhp.com.br');

      expect(fixture.componentInstance.concluirTodas()).toBe(1);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(document.activeElement).toBe(confirmacao);
      expect(confirmacao.getAttribute('aria-invalid')).toBe('true');
      expect(
        tela.querySelector(`#${confirmacao.getAttribute('aria-describedby')}`)?.textContent,
      ).toContain('A confirmação não confere com a resposta.');
    });

    it('a confirmação em branco depois de digitar a resposta bloqueia o envio e pede para confirmar', async () => {
      const tela = montar(COM_CONFIRMACAO);
      const { resposta, confirmacao } = entradas(tela);
      digitar(resposta, EMAIL);

      expect(fixture.componentInstance.concluirTodas()).toBe(1);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(document.activeElement).toBe(confirmacao);
      expect(simulacoes.at(-1)?.etapasConcluidas ?? []).toEqual([]);
    });

    it('a resposta gravada sem confirmação também bloqueia o envio, como a digitada', () => {
      montar(COM_CONFIRMACAO, { inicial: { respostas: { EMAIL } } });

      expect(fixture.componentInstance.concluirTodas()).toBe(1);
    });

    it('a resposta gravada deixa enviar quando a confirmação confere', () => {
      const tela = montar(COM_CONFIRMACAO, { inicial: { respostas: { EMAIL } } });
      digitar(entradas(tela).confirmacao, EMAIL);

      expect(fixture.componentInstance.concluirTodas()).toBe(0);
    });

    it('a confirmação que confere deixa enviar, e vale depois de trocar de seção', () => {
      const tela = montar(COM_CONFIRMACAO);
      const { resposta, confirmacao } = entradas(tela);
      digitar(resposta, EMAIL);
      digitar(confirmacao, EMAIL);
      clicar(botao(tela, 'Próxima seção'));

      expect(fixture.componentInstance.concluirTodas()).toBe(0);
    });

    it('a confirmação do campo de uma ocorrência do grupo também bloqueia o envio', async () => {
      const tela = montar(FAMILIA_COM_CONFIRMACAO, {
        inicial: { grupos: { FAMILIA: [{ id: 'membro-1', respostas: {} }] } },
      });
      digitar(
        tela.querySelector('[data-campo="FAMILIA.membro-1.EMAIL"] input') as HTMLInputElement,
        EMAIL,
      );

      expect(fixture.componentInstance.concluirTodas()).toBe(1);
      fixture.detectChanges();
      await fixture.whenStable();

      expect(document.activeElement).toBe(
        tela.querySelector('[data-campo="FAMILIA.membro-1.EMAIL"] input[id$="-confirmacao"]'),
      );
    });
  });
  describe('passos prefixados', () => {
    const CURSO = { chave: 'curso', titulo: 'Curso', concluido: false };

    it('vêm antes das seções, no indicador e na contagem, e abrem o formulário', () => {
      const tela = montar(DUAS_SECOES, { passosPrefixados: [CURSO] });

      const passos = [...tela.querySelectorAll('nav[aria-label="Passos da inscrição"] li')];
      expect(passos[0].textContent).toContain('Curso');
      expect(passos).toHaveLength(3);
      expect(passos[0].querySelector('button')?.getAttribute('aria-current')).toBe('step');
      expect(tela.querySelector('h3')?.textContent).toContain('passo 1 de 3');
      expect(botao(tela, 'Passo anterior').disabled).toBe(true);
    });

    it('a seção seguinte ao passo prefixado é a primeira do formulário e o recusado aparece com erro', () => {
      const tela = montar(DUAS_SECOES, { passosPrefixados: [{ ...CURSO, comErro: true }] });
      expect(tela.querySelector('nav li')?.classList.contains('is-error')).toBe(true);

      clicar(botao(tela, 'Próximo passo'));

      expect(fixture.componentInstance.passoPrefixadoAtual()).toBeNull();
      expect(tela.querySelector('h3')?.textContent).toContain('passo 2 de 3');
    });

    it('com a seção válida exigida, o passo prefixado não concluído barra o avanço e avisa quem hospeda', () => {
      const tela = montar(DUAS_SECOES, {
        passosPrefixados: [{ ...CURSO, concluido: false }],
        exigirSecaoValida: true,
      });
      const barrados: string[] = [];
      fixture.componentInstance.avancoBarrado.subscribe((chave) => barrados.push(chave));

      clicar(botao(tela, 'Próximo passo'));
      expect(fixture.componentInstance.passoPrefixadoAtual()).toBe('curso');
      expect(barrados).toEqual(['curso']);

      fixture.componentRef.setInput('passosPrefixados', [{ ...CURSO, concluido: true }]);
      fixture.detectChanges();
      clicar(botao(tela, 'Próximo passo'));
      expect(fixture.componentInstance.passoPrefixadoAtual()).toBeNull();
    });

    it('"Próxima seção" vale até o último passo, contando os prefixados', () => {
      const tela = montar(DUAS_SECOES, { passosPrefixados: [CURSO] });
      clicar(botao(tela, 'Próximo passo'));

      expect(botao(tela, 'Próxima seção')).toBeDefined();
      clicar(botao(tela, 'Próxima seção'));

      expect(tela.querySelector('h3')?.textContent).toContain('passo 3 de 3');
      expect(botao(tela, 'Próxima seção')).toBeUndefined();
    });

    it('a recusa que o host apontou no passo prefixado não tira o candidato de lá', () => {
      const tela = montar(DUAS_SECOES, {
        passosPrefixados: [{ ...CURSO, comErro: true }],
        passoDaRecusa: 'curso',
      });

      fixture.componentRef.setInput('errosDoServidor', [
        { campo: 'NOME_SOCIAL', mensagem: 'Recusado.' },
      ]);
      fixture.detectChanges();

      expect(fixture.componentInstance.passoPrefixadoAtual()).toBe('curso');
      expect(tela.querySelector('nav li.is-active')?.textContent).toContain('Curso');
    });

    it('sem recusa do host, a lista nova leva à seção da primeira, e limpar a do host não move ninguém', () => {
      montar(DUAS_SECOES, { passosPrefixados: [CURSO], passoDaRecusa: 'curso' });
      fixture.componentRef.setInput('errosDoServidor', [
        { campo: 'NOME_SOCIAL', mensagem: 'Recusado.' },
      ]);
      fixture.detectChanges();
      fixture.componentRef.setInput('passoDaRecusa', null);
      fixture.detectChanges();
      expect(fixture.componentInstance.passoPrefixadoAtual()).toBe('curso');

      fixture.componentRef.setInput('errosDoServidor', [
        { campo: 'NOME_SOCIAL', mensagem: 'Outra.' },
      ]);
      fixture.detectChanges();

      expect(fixture.componentInstance.passoPrefixadoAtual()).toBeNull();
    });

    it('os botões chamam de passo o que antecede as seções e de seção as seções', () => {
      const tela = montar(DUAS_SECOES, { passosPrefixados: [CURSO] });
      expect(botao(tela, 'Passo anterior')).toBeDefined();

      clicar(botao(tela, 'Próximo passo'));
      expect(botao(tela, 'Passo anterior')).toBeDefined();
      expect(botao(tela, 'Próxima seção')).toBeDefined();

      clicar(botao(tela, 'Próxima seção'));
      expect(botao(tela, 'Seção anterior')).toBeDefined();
    });

    it('o formulário sem seções ainda mostra o passo prefixado', () => {
      const semSecoes: FormularioDoCandidato = { ...DUAS_SECOES, etapas: [], fatosColetados: [] };
      const tela = montar(semSecoes, { passosPrefixados: [CURSO] });

      expect(tela.querySelector('nav[aria-label="Passos da inscrição"]')?.textContent).toContain(
        'Curso',
      );
      expect(tela.textContent).not.toContain('não tem seção a mostrar');
    });

    it('concluirTodas sem navegar conta as pendências e deixa o candidato onde está', () => {
      const tela = montar(DUAS_SECOES, { passosPrefixados: [CURSO] });

      expect(fixture.componentInstance.concluirTodas(false)).toBe(2);
      fixture.detectChanges();

      expect(fixture.componentInstance.passoPrefixadoAtual()).toBe('curso');
      expect(tela.textContent).not.toContain('itens a corrigir');
    });

    it('sem passos prefixados o título e a barra dizem seção, e a lista é das seções', () => {
      const tela = montar(DUAS_SECOES, { apresentacaoDosPassos: 'lateral' });

      expect(tela.querySelector('h3')?.textContent).toContain('seção 1 de 2');
      expect(tela.querySelector('.step-bar__meta')?.textContent).toContain('Seção 1 de 2');
      expect(tela.querySelector('nav[aria-label="Seções do formulário"]')).not.toBeNull();
    });

    it('a apresentação lateral troca os chips pela coluna e traz o diálogo de seções', () => {
      const tela = montar(DUAS_SECOES, { apresentacaoDosPassos: 'lateral' });

      expect(tela.querySelector('.ui-steps--chips')).toBeNull();
      expect(tela.querySelector('nav.ui-steps--lateral')).not.toBeNull();
      expect(tela.querySelector('dialog .ui-steps--sobreposicao')).not.toBeNull();
    });
  });
});
