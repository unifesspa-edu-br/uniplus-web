import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';

import { BUSCA_DE_MUNICIPIOS } from '../editor-de-condicoes/valor-de-municipio';
import { BUSCA_DE_CEP } from '../endereco-geo/endereco-geo.model';

import { FormularioDoCandidatoComponent } from './formulario-do-candidato';
import type { CampoRenderizavel, FormularioDoCandidato } from './formulario-do-candidato.model';
import type { ValorJson } from './interpretador/regras-do-formulario';

/** A Revisão e aceite resume o pedido do Fator de Atenuação (UNI-REQ-0150) com os rótulos do formulário. */
const SOLICITA = 'PEDE_BENEFICIO_X';
const CAMINHO = 'VINCULO_BENEFICIO_X';
const MUNICIPIO = 'CIDADE_BENEFICIO_X';
const FORA_DO_FATOR = 'OUTRA_PERGUNTA';
const NUMERO = 'MESES_NA_AREA';
const MULTIPLA = 'ATIVIDADES_NA_AREA';
const DATA = 'DATA_INICIO_NA_AREA';
const TELEFONE = 'TELEFONE_DO_CONTATO';

const campos: CampoRenderizavel[] = [
  {
    fatoCodigo: SOLICITA,
    ordem: 0,
    rotulo: 'Deseja solicitar o Fator?',
    tipoRenderizacao: 'BOOLEANO',
  },
  {
    fatoCodigo: CAMINHO,
    ordem: 1,
    rotulo: 'Por qual vínculo com a área você solicita o Fator?',
    tipoRenderizacao: 'SELECAO_UNICA',
    valoresSelecionaveis: [
      { codigo: 'RESIDENCIA', descricao: 'Residência no período do edital', ordem: 0 },
      { codigo: 'ENSINO_MEDIO', descricao: 'Ensino médio cursado na área', ordem: 1 },
    ],
  },
  {
    fatoCodigo: MUNICIPIO,
    ordem: 2,
    rotulo: 'Em qual município você residiu?',
    tipoRenderizacao: 'SELECAO_UNICA',
    valoresSelecionaveis: [{ codigo: '2105302', descricao: 'Imperatriz — MA', ordem: 0 }],
  },
  { fatoCodigo: NUMERO, ordem: 4, rotulo: 'Meses na área', tipoRenderizacao: 'NUMERO' },
  {
    fatoCodigo: MULTIPLA,
    ordem: 5,
    rotulo: 'Atividades na área',
    tipoRenderizacao: 'SELECAO_MULTIPLA',
    valoresSelecionaveis: [
      { codigo: 'PESCA', descricao: 'Pesca artesanal', ordem: 0 },
      { codigo: 'ROCA', descricao: 'Roça de subsistência', ordem: 1 },
    ],
  },
  { fatoCodigo: DATA, ordem: 6, rotulo: 'Início na área', tipoRenderizacao: 'DATA' },
  {
    fatoCodigo: TELEFONE,
    ordem: 7,
    rotulo: 'Telefone de contato',
    tipoRenderizacao: 'TEXTO',
    formato: 'TELEFONE',
  },
];

const formulario = (
  comFator: boolean,
  dependenciasDoFator: FormularioDoCandidato['dependenciasDoFator'] = {
    fatos: [MUNICIPIO, SOLICITA, CAMINHO].sort(),
    grupos: [],
  },
  municipioPorBusca = false,
): FormularioDoCandidato => ({
  finalidade: 'INSCRICAO',
  etapas: [
    {
      codigo: 'FATOR',
      codigoNasRegras: 'Inscricao:FATOR',
      ordem: 0,
      tipo: 'SECAO',
      titulo: 'Fator de Atenuação',
    },
    {
      codigo: 'REVISAO',
      codigoNasRegras: null,
      ordem: 1,
      tipo: 'BLOCO',
      bloco: 'REVISAO_E_ACEITE',
      titulo: 'Revisão e aceite',
    },
  ],
  termos: [],
  grupos: [],
  dependenciasDoFator,
  fatosColetados: comFator
    ? [
        ...campos.map((c) =>
          municipioPorBusca && c.fatoCodigo === MUNICIPIO
            ? { fatoCodigo: MUNICIPIO, ordem: 2, rotulo: c.rotulo, tipoRenderizacao: 'MUNICIPIO' }
            : c,
        ),
        {
          fatoCodigo: FORA_DO_FATOR,
          ordem: 3,
          rotulo: 'Outra pergunta',
          tipoRenderizacao: 'TEXTO',
        },
      ]
    : [{ fatoCodigo: 'EMAIL', ordem: 0, rotulo: 'E-mail', tipoRenderizacao: 'TEXTO' }],
  regras: {
    etapas: [
      {
        codigo: 'Inscricao:FATOR',
        itens: (comFator
          ? [SOLICITA, CAMINHO, MUNICIPIO, FORA_DO_FATOR, NUMERO, MULTIPLA, DATA, TELEFONE]
          : ['EMAIL']
        ).map((fatoCodigo) => ({
          fatoCodigo,
          obrigatoriedade: 'SEMPRE',
          restricoes: [],
          ...(fatoCodigo === CAMINHO || fatoCodigo === MUNICIPIO
            ? { exibicao: [[{ fato: SOLICITA, operador: 'IGUAL', valor: true }]] }
            : {}),
        })),
      },
    ],
  },
});

/** Acrescenta ao formulário um grupo de integrantes, na seção do Fator, com um subitem numérico. */
const comOGrupo = (base: FormularioDoCandidato): FormularioDoCandidato => ({
  ...base,
  grupos: [
    {
      codigo: 'FAMILIA',
      ordem: 0,
      rotulo: 'Integrante da família',
      minimo: 0,
      maximo: 3,
      incluiCandidato: false,
      subitens: [
        { fatoCodigo: 'RENDA', ordem: 0, rotulo: 'Renda', tipoRenderizacao: 'NUMERO' },
        { fatoCodigo: 'NOME', ordem: 1, rotulo: 'Nome', tipoRenderizacao: 'TEXTO' },
        { fatoCodigo: 'BONUS', ordem: 2, rotulo: 'Bônus', tipoRenderizacao: 'NUMERO' },
      ],
    },
  ],
  regras: {
    etapas: [
      {
        codigo: 'Inscricao:FATOR',
        itens: base.regras.etapas?.[0]?.itens ?? [],
        grupos: [
          {
            codigo: 'FAMILIA',
            obrigatoriedade: 'SEMPRE',
            minimo: 0,
            maximo: 3,
            incluiCandidato: false,
            subitens: [
              { fatoCodigo: 'RENDA', obrigatoriedade: 'SEMPRE', restricoes: [] },
              { fatoCodigo: 'NOME', obrigatoriedade: 'SEMPRE', restricoes: [] },
              {
                fatoCodigo: 'BONUS',
                obrigatoriedade: 'SEMPRE',
                restricoes: [],
                exibicao: [[{ fato: 'RENDA', operador: 'IGUAL', valor: 999 }]],
              },
            ],
          },
        ],
      },
    ],
  },
});

describe('Resumo do Fator de Atenuação na Revisão', () => {
  let fixture: ComponentFixture<FormularioDoCandidatoComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: BUSCA_DE_MUNICIPIOS, useValue: () => of({ ok: true, data: [] }) },
        { provide: BUSCA_DE_CEP, useValue: () => of({ ok: false }) },
      ],
    });
  });

  const naRevisao = (
    comFator: boolean,
    respostas: Record<string, ValorJson>,
    dependencias?: FormularioDoCandidato['dependenciasDoFator'],
    municipioPorBusca = false,
    grupos: Record<string, { id: string; respostas: Record<string, ValorJson> }[]> = {},
    comGrupo = false,
  ): HTMLElement => {
    fixture = TestBed.createComponent(FormularioDoCandidatoComponent);
    const base =
      dependencias === undefined
        ? formulario(comFator, undefined, municipioPorBusca)
        : formulario(comFator, dependencias, municipioPorBusca);
    fixture.componentRef.setInput('formulario', comGrupo ? comOGrupo(base) : base);
    fixture.componentRef.setInput('inicial', {
      respostas,
      grupos,
      etapasConcluidas: [],
      pressupostos: {},
      envio: {},
    });
    fixture.detectChanges();
    const tela = fixture.nativeElement as HTMLElement;
    const revisao = [...tela.querySelectorAll('ui-steps .ui-steps__botao')].find((b) =>
      b.textContent?.includes('Revisão e aceite'),
    ) as HTMLButtonElement;
    revisao.click();
    fixture.detectChanges();
    return tela;
  };
  const resumo = (tela: HTMLElement): HTMLElement | null =>
    tela.querySelector('ui-fator-de-atenuacao-da-inscricao');

  it('com o Fator pedido, mostra Sim, o caminho e o município pelo nome, sem código', () => {
    const tela = naRevisao(true, {
      [SOLICITA]: true,
      [CAMINHO]: 'RESIDENCIA',
      [MUNICIPIO]: '2105302',
    });

    const texto = resumo(tela)?.textContent ?? '';
    expect(texto).toContain('Sim');
    expect(texto).toContain('Residência no período do edital');
    expect(texto).toContain('Imperatriz — MA');
    expect(texto).not.toContain('2105302');
    expect(resumo(tela)?.querySelector('section[aria-labelledby]')).not.toBeNull();
  });

  it('mostra os campos na ordem do formulário, não na ordem das dependências', () => {
    const tela = naRevisao(true, {
      [SOLICITA]: true,
      [CAMINHO]: 'RESIDENCIA',
      [MUNICIPIO]: '2105302',
    });

    const rotulos = [...(resumo(tela)?.querySelectorAll('dt') ?? [])].map((dt) => dt.textContent);
    expect(rotulos).toEqual([
      'Deseja solicitar o Fator?',
      'Por qual vínculo com a área você solicita o Fator?',
      'Em qual município você residiu?',
    ]);
  });

  it('o campo de município por busca aparece com o nome ou, sem ele, sem o código solto', () => {
    const tela = naRevisao(true, { [SOLICITA]: true, [MUNICIPIO]: '2105302' }, undefined, true);

    const texto = resumo(tela)?.textContent ?? '';
    expect(texto).toContain('Município de código IBGE 2105302');
  });

  it('o link do resumo volta à seção em que o candidato respondeu', () => {
    const tela = naRevisao(true, { [SOLICITA]: true });

    (resumo(tela)?.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(tela.querySelector('h3')?.textContent).toContain('Fator de Atenuação');
  });

  it('com o Fator recusado, o campo que a regra oculta não aparece, mesmo com resposta antiga', () => {
    const tela = naRevisao(true, { [SOLICITA]: false, [CAMINHO]: 'RESIDENCIA' });

    const texto = resumo(tela)?.textContent ?? '';
    expect(texto).toContain('Não');
    expect(texto).not.toContain('Residência no período do edital');
  });

  it('só entra o que as dependências do Fator listam, nada fixo no código', () => {
    const tela = naRevisao(
      true,
      { [SOLICITA]: true, [CAMINHO]: 'RESIDENCIA', [FORA_DO_FATOR]: 'texto livre' },
      { fatos: [CAMINHO], grupos: [] },
    );

    const texto = resumo(tela)?.textContent ?? '';
    expect(texto).toContain('Residência no período do edital');
    expect(texto).not.toContain('Deseja solicitar o Fator?');
    expect(texto).not.toContain('texto livre');
  });

  it.each([
    ['sem dependências', null],
    ['com a lista vazia', { fatos: [], grupos: [] }],
  ])('%s, o resumo não aparece', (_, dependencias) => {
    const tela = naRevisao(true, { [SOLICITA]: true }, dependencias);

    expect(resumo(tela)).toBeNull();
  });

  it('o formulário que não pergunta pelo Fator não mostra o resumo', () => {
    const tela = naRevisao(false, { EMAIL: 'a@b.c' });

    expect(resumo(tela)).toBeNull();
  });

  it('os campos de grupo que o Fator lista aparecem por ocorrência respondida, com o título dela', () => {
    const tela = naRevisao(
      true,
      {},
      { fatos: ['FAMILIA.BONUS', 'FAMILIA.RENDA'], grupos: ['FAMILIA'] },
      false,
      {
        FAMILIA: [
          { id: 'a', respostas: { RENDA: 1500.5, NOME: 'Maria', BONUS: 7 } },
          { id: 'b', respostas: { RENDA: 800, NOME: 'João', BONUS: 9 } },
        ],
      },
      true,
    );

    const itens = [...(resumo(tela)?.querySelectorAll('dt, dd') ?? [])].map((e) =>
      e.textContent?.trim(),
    );
    expect(itens).toEqual([
      'Integrante da família (Integrante 1): Renda',
      '1.500,5',
      'Integrante da família (Integrante 2): Renda',
      '800',
    ]);
    // NOME não está nas dependências; BONUS está, mas a regra o oculta nas duas ocorrências.
    const texto = resumo(tela)?.textContent ?? '';
    expect(texto).not.toContain('Maria');
    expect(texto).not.toContain('Nome');
    expect(texto).not.toContain('Bônus');
  });

  it('a data aparece no formato brasileiro e o telefone com a máscara, como no comprovante', () => {
    const tela = naRevisao(
      true,
      { [DATA]: '2001-03-09', [TELEFONE]: '61981951555' },
      { fatos: [DATA, TELEFONE], grupos: [] },
    );

    const itens = [...(resumo(tela)?.querySelectorAll('dd') ?? [])].map((e) =>
      e.textContent?.trim(),
    );
    expect(itens).toEqual(['09/03/2001', '(61) 98195-1555']);
  });

  it('o número aparece formatado e a seleção múltipla pelas descrições, separadas por vírgula', () => {
    const tela = naRevisao(
      true,
      { [NUMERO]: 1234.5, [MULTIPLA]: ['PESCA', 'ROCA'] },
      { fatos: [NUMERO, MULTIPLA], grupos: [] },
    );

    const texto = resumo(tela)?.textContent ?? '';
    expect(texto).toContain('1.234,5');
    expect(texto).toContain('Pesca artesanal, Roça de subsistência');
  });
});
