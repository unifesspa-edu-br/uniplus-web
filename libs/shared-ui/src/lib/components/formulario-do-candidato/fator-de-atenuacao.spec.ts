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
        itens: (comFator ? [SOLICITA, CAMINHO, MUNICIPIO, FORA_DO_FATOR] : ['EMAIL']).map(
          (fatoCodigo) => ({
            fatoCodigo,
            obrigatoriedade: 'SEMPRE',
            restricoes: [],
            ...(fatoCodigo === CAMINHO || fatoCodigo === MUNICIPIO
              ? { exibicao: [[{ fato: SOLICITA, operador: 'IGUAL', valor: true }]] }
              : {}),
          }),
        ),
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
  ): HTMLElement => {
    fixture = TestBed.createComponent(FormularioDoCandidatoComponent);
    fixture.componentRef.setInput(
      'formulario',
      dependencias === undefined
        ? formulario(comFator, undefined, municipioPorBusca)
        : formulario(comFator, dependencias, municipioPorBusca),
    );
    fixture.componentRef.setInput('inicial', {
      respostas,
      grupos: {},
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
});
