import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  SELECAO_BASE_PATH,
  SituacaoInscricaoCodigo,
  type InscricaoAdministrativaDto,
} from '@uniplus/shared-data/selecao';
import { BehaviorSubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DetalheDaInscricaoPage } from './detalhe-da-inscricao.page';
import { INSCRICAO_ENVIADA } from './situacoes-da-inscricao.testing';

import {
  arquivo,
  BASE,
  COMPROVANTE_ID,
  DIREITO,
  FERNANDA,
  INSCRICAO_ID,
  item,
  MEDICINA,
  oferta,
  OUTRA_EXIGENCIA_ID,
  PROCESSO,
  PROCESSO_ID,
  ROTA_DETALHE,
} from './detalhe-da-inscricao-dados.testing';

describe('DetalheDaInscricaoPage', () => {
  let fixture: ComponentFixture<DetalheDaInscricaoPage>;
  let controller: HttpTestingController;
  let parametros: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(() => {
    parametros = new BehaviorSubject(
      convertToParamMap({ id: PROCESSO_ID, inscricaoId: INSCRICAO_ID }),
    );
    TestBed.configureTestingModule({
      imports: [DetalheDaInscricaoPage],
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
        { provide: ActivatedRoute, useValue: { paramMap: parametros } },
      ],
    });
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    controller.verify();
  });

  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const texto = (): string => host().textContent?.replace(/\s+/g, ' ') ?? '';

  async function propagar(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
    TestBed.tick();
    fixture.detectChanges();
  }

  async function criarPagina(): Promise<void> {
    fixture = TestBed.createComponent(DetalheDaInscricaoPage);
    fixture.detectChanges();
    await propagar();
  }

  const doDetalhe = (rota = ROTA_DETALHE): TestRequest => controller.expectOne(rota);

  async function abrir(inscricao: InscricaoAdministrativaDto): Promise<void> {
    await criarPagina();
    doDetalhe().flush(inscricao);
    await propagar();
  }
  const dado = (rotulo: string): string | null => {
    const par = Array.from(host().querySelectorAll('.dado')).find(
      (d) => d.querySelector('dt')?.textContent?.trim() === rotulo,
    );
    return par?.querySelector('dd')?.textContent?.replace(/\s+/g, ' ').trim() ?? null;
  };
  const dd = (rotulo: string): Element | undefined =>
    Array.from(host().querySelectorAll('.dado')).find(
      (d) => d.querySelector('dt')?.textContent?.trim() === rotulo,
    );
  const itensDe = (rotulo: string): string[] =>
    Array.from(dd(rotulo)?.querySelectorAll('li') ?? []).map((li) => li.textContent?.trim() ?? '');
  const linhasDe = (rotulo: string): string[] =>
    Array.from(dd(rotulo)?.querySelectorAll('.resposta__linha') ?? []).map(
      (l) => l.textContent?.trim() ?? '',
    );
  const botoesAbrir = (): HTMLButtonElement[] =>
    Array.from(host().querySelectorAll('button')).filter((b) => b.textContent?.trim() === 'Abrir');

  it('mostra identificação, respostas pelo tipo, derivados e arquivos', async () => {
    await abrir(FERNANDA);

    expect(host().querySelector('h1')?.textContent).toContain('Inscrição 2027-000101');
    expect(dado('Número')).toBe('2027-000101');
    expect(dado('Situação')).toBe(INSCRICAO_ENVIADA.rotulo);
    expect(itensDe('Ofertas escolhidas')).toEqual([MEDICINA, DIREITO]);
    expect(dado('Oferta escolhida')).toBeNull();
    expect(host().querySelector('.page-header__desc')?.textContent).toContain(
      'PSR 2027 — inscrição enviada neste processo seletivo.',
    );
    expect(dado('Nome completo')).toBe('Fernanda Laura Nicole Drumond');
    expect(dado('CPF')).toContain('***.598.363-**');
    expect(dado('Município de residência')).toContain('Marabá');
    expect(dado('Renda familiar')).toBe('R$ 1.234,56');
    expect(dado('Data de nascimento')).toBe('09/03/2000');
    expect(dado('Pessoa com deficiência')).toBe('Sim');
    expect(itensDe('Atendimentos')).toEqual(['Prova ampliada', 'Tempo adicional']);
    expect(linhasDe('Endereço')).toEqual([
      'Folha 31, 12',
      'Nova Marabá',
      'Marabá/PA',
      'CEP 68500-000',
    ]);
    expect(texto()).toContain('Formação anterior');
    expect(texto()).toContain('1ª ocorrência');
    expect(texto()).toContain('Enfermagem');
    expect(texto()).toContain('2ª ocorrência');
    expect(texto()).toContain('Biologia');
    expect(dado('Modalidades')).toBe('Ampla concorrência');
    expect(texto()).toContain('PSR 2027');
  });

  it('mostra a data do envio quando a API a devolve e nada quando ela a omite', async () => {
    await abrir(FERNANDA);
    expect(dado('Enviada em')).toBe('10/12/2026, 12:00');
  });

  it('não mostra a data do envio que a API omitiu', async () => {
    await abrir({ ...FERNANDA, enviadaEm: undefined });
    expect(dado('Enviada em')).toBeNull();
  });

  it('mostra o título da seção como cabeçalho, com os grupos um nível abaixo', async () => {
    await abrir(FERNANDA);

    expect(host().querySelector('h3.insc-secoes__secao-titulo')?.textContent?.trim()).toBe(
      'Dados pessoais',
    );
    expect(host().querySelector('.insc-secoes__grupo-titulo')?.getAttribute('aria-level')).toBe(
      '4',
    );
    expect(
      host().querySelector('.insc-secoes__ocorrencia-titulo')?.getAttribute('aria-level'),
    ).toBe('5');
  });

  it('sem título da seção não há cabeçalho nem o código cru, e os grupos sobem de nível', async () => {
    await abrir({
      ...FERNANDA,
      secoes: [{ ...FERNANDA.secoes[0], titulo: undefined }],
    });

    expect(host().querySelector('.insc-secoes__secao-titulo')).toBeNull();
    expect(texto()).not.toContain('identificacao');
    expect(host().querySelector('.insc-secoes__grupo-titulo')?.getAttribute('aria-level')).toBe(
      '3',
    );
    expect(dado('Nome completo')).toBe('Fernanda Laura Nicole Drumond');
  });

  it('oferece a descrição de cada campo como texto visível junto do valor', async () => {
    await abrir(FERNANDA);

    expect(dado('Município de residência')).toBe('Marabá Onde você mora hoje.');
    expect(dado('Nome completo')).not.toContain('.');
  });

  it('mostra o identificador como a API o devolve e oferece Revelar só onde podeRevelar é verdadeiro', async () => {
    await abrir({
      ...FERNANDA,
      secoes: [
        {
          codigo: 'identificacao',
          grupos: [],
          itens: [
            {
              ...item('CPF', 'CPF', 'texto', '***.598.363-**'),
              componente: 'cpf',
              podeRevelar: true,
            },
            { ...item('RG', 'RG', 'texto', '*********'), componente: 'identificador' },
          ],
        },
      ],
    });

    expect(dado('CPF')).toBe('***.598.363-** Revelar');
    expect(dado('RG')).toBe('*********');
    const revelar = Array.from(host().querySelectorAll('button')).filter(
      (b) => b.textContent?.trim() === 'Revelar',
    );
    expect(revelar.map((b) => b.getAttribute('aria-label'))).toEqual(['Revelar CPF']);
  });

  it('mostra o identificador mascarado mesmo quando o tipo declarado não é texto', async () => {
    await abrir({
      ...FERNANDA,
      secoes: [
        {
          codigo: 'documentos',
          grupos: [],
          itens: [
            {
              ...item('PASSAPORTE', 'Passaporte', 'numero', '*********'),
              componente: 'identificador',
              podeRevelar: true,
            },
          ],
        },
      ],
    });

    expect(dado('Passaporte')).toBe('********* Revelar');
  });

  it('lista cada arquivo com a exigência, a situação e um Abrir de nome acessível próprio', async () => {
    await abrir(FERNANDA);

    const itens = Array.from(host().querySelectorAll('.insc-arquivos__item')).map(
      (li) => li.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    );
    expect(itens[0]).toContain('Laudo médico');
    expect(itens[0]).toContain('PDF');
    expect(itens[0]).toContain('2,0 KB');
    expect(itens[0]).toContain(FERNANDA.arquivos[0].situacao.rotulo);
    expect(botoesAbrir().map((b) => b.getAttribute('aria-label'))).toEqual([
      'Abrir Laudo médico, enviado em 10/12/2026, 12:00',
      'Abrir Comprovante de residência, enviado em 10/12/2026, 12:00',
    ]);
  });

  it('não mostra o laudo nem marca de omissão quando a API não o devolve', async () => {
    await abrir({
      ...FERNANDA,
      arquivos: [
        arquivo(COMPROVANTE_ID, 'Comprovante de residência', { exigenciaId: OUTRA_EXIGENCIA_ID }),
      ],
    });

    expect(texto()).not.toContain('Laudo');
    expect(botoesAbrir()).toHaveLength(1);
    expect(texto()).not.toMatch(/oculto|restrito|protegido|sem permissão|omitid/i);
  });

  it('sem dados pessoais mostra só a oferta e a situação, sem painel vazio nem marca', async () => {
    await abrir({
      id: INSCRICAO_ID,
      processo: PROCESSO,
      situacao: INSCRICAO_ENVIADA,
      ofertas: [oferta(1, DIREITO)],
      secoes: [],
      derivados: [],
      arquivos: [],
      podeEmitirComprovante: false,
      numeroDoUltimoComprovante: null,
    });

    expect(dado('Situação')).toBe(INSCRICAO_ENVIADA.rotulo);
    expect(dado('Oferta escolhida')).toBe(DIREITO);
    expect(dado('Número')).toBeNull();
    expect(dado('Nome completo')).toBeNull();
    expect(host().querySelector('#insc-det-respostas')).toBeNull();
    expect(host().querySelector('#insc-det-derivados')).toBeNull();
    expect(host().querySelector('#insc-det-arquivos')).toBeNull();
    expect(host().querySelector('h1')?.textContent?.trim()).toBe('Inscrição');
    expect(texto()).not.toMatch(/oculto|restrito|protegido|sem permissão|omitid/i);
  });

  it('mostra o motivo e o instante do cancelamento quando a API os devolve', async () => {
    await abrir({
      ...FERNANDA,
      situacao: { codigo: SituacaoInscricaoCodigo.CANCELADA, rotulo: 'Cancelada' },
      canceladaEm: '2026-12-11T15:00:00Z',
      motivoDoCancelamento: 'A pedido da candidata',
    });

    expect(dado('Situação')).toBe('Cancelada');
    expect(dado('Cancelada em')).toBe('11/12/2026, 12:00');
    expect(dado('Motivo do cancelamento')).toBe('A pedido da candidata');
  });
});
