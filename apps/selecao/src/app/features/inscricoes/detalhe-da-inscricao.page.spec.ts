import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { BehaviorSubject } from 'rxjs';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import {
  SELECAO_BASE_PATH,
  SituacaoDoArquivoDoCandidato,
  SituacaoInscricao,
  type ArquivoAdministrativoDto,
  type OfertaEscolhidaDto,
  type InscricaoAdministrativaDto,
  type ItemDeRespostaDto,
} from '@uniplus/shared-data/selecao';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DetalheDaInscricaoPage } from './detalhe-da-inscricao.page';
import { DetalheDaInscricao } from './detalhe-da-inscricao.service';
import { INSCRICOES_DO_PROCESSO_ROUTES } from './inscricoes.routes';

const BASE = 'http://localhost:5000';
const PROCESSO_ID = '01960000-0000-7000-0000-0000000005aa';
const INSCRICAO_ID = '01960000-0000-7000-0000-0000000006b1';
const OUTRA_INSCRICAO_ID = '01960000-0000-7000-0000-0000000006b2';
const ROTA_DETALHE = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/inscricoes/${INSCRICAO_ID}`;
const ROTA_OUTRA = `${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/inscricoes/${OUTRA_INSCRICAO_ID}`;
const OFERTA_MEDICINA = '01960000-0000-7000-0000-00000000aaa1';
const LAUDO_ID = '01960000-0000-7000-0000-0000000007c1';
const OUTRO_ARQUIVO_ID = '01960000-0000-7000-0000-0000000007c3';
const SEGUNDO_ARQUIVO_OMITIDO_ID = '01960000-0000-7000-0000-0000000007c4';
const COMPROVANTE_ID = '01960000-0000-7000-0000-0000000007c2';
const EXIGENCIA_ID = '01960000-0000-7000-0000-0000000008d1';
const OUTRA_EXIGENCIA_ID = '01960000-0000-7000-0000-0000000008d2';

const PROCESSO = { id: PROCESSO_ID, nome: 'PSR 2027' };
const MEDICINA = 'Medicina (Bacharelado) — Faculdade de Medicina — INTEGRAL';
const DIREITO = 'Direito (Bacharelado) — Faculdade de Direito — Noturno';

const oferta = (ordem: number, nome: string | null): OfertaEscolhidaDto => ({
  id: `${OFERTA_MEDICINA.slice(0, -1)}${ordem}`,
  nome,
  ordem,
});

function item(
  fatoCodigo: string,
  rotulo: string,
  tipo: string,
  valor: unknown,
  extra: Partial<ItemDeRespostaDto> = {},
): ItemDeRespostaDto {
  return {
    fatoCodigo,
    rotulo,
    descricao: '',
    tipo,
    componente: 'padrao',
    valor,
    podeRevelar: false,
    ...extra,
  };
}

function arquivo(
  arquivoId: string,
  nomeDoDocumento: string,
  extra: Partial<ArquivoAdministrativoDto> = {},
): ArquivoAdministrativoDto {
  return {
    arquivoId,
    exigenciaId: EXIGENCIA_ID,
    nomeDoDocumento,
    tipoDeMidia: 'application/pdf',
    classificacaoProtecao: 'SENSIVEL',
    situacao: SituacaoDoArquivoDoCandidato.verificado,
    tamanhoBytes: 2048,
    confirmadoEm: '2026-12-10T15:00:00Z',
    ...extra,
  } as ArquivoAdministrativoDto;
}

const FERNANDA: InscricaoAdministrativaDto = {
  id: INSCRICAO_ID,
  processo: PROCESSO,
  situacao: SituacaoInscricao.submetida,
  ofertas: [oferta(1, MEDICINA), oferta(2, DIREITO)],
  numeroInscricao: '2027-000101',
  submetidaEm: '2026-12-10T15:00:00Z',
  secoes: [
    {
      codigo: 'identificacao',
      titulo: 'Dados pessoais',
      itens: [
        item('NOME', 'Nome completo', 'texto', 'Fernanda Laura Nicole Drumond'),
        item('CPF', 'CPF', 'texto', '***.598.363-**', {
          componente: 'cpf',
          descricao: 'Cadastro de pessoa física.',
          podeRevelar: true,
        }),
        item(
          'MUNICIPIO',
          'Município de residência',
          'opcao',
          { codigo: '1505502', rotulo: 'Marabá' },
          {
            descricao: 'Onde você mora hoje.',
          },
        ),
        item('RENDA', 'Renda familiar', 'numero', '1234.56', { componente: 'moeda' }),
        item('NASCIMENTO', 'Data de nascimento', 'data', '2000-03-09'),
        item('PCD', 'Pessoa com deficiência', 'booleano', true),
        item('ATENDIMENTO', 'Atendimentos', 'opcoes', [
          { codigo: 'a', rotulo: 'Prova ampliada' },
          { codigo: 'b', rotulo: 'Tempo adicional' },
        ]),
        item('ENDERECO', 'Endereço', 'endereco', {
          logradouro: 'Folha 31',
          numero: '12',
          bairro: 'Nova Marabá',
          municipio: 'Marabá',
          uf: 'PA',
          cep: '68500-000',
        }),
      ],
      grupos: [
        {
          codigo: 'FORMACAO',
          rotulo: 'Formação anterior',
          ocorrencias: [
            { id: 'o1', itens: [item('CURSO_ANT', 'Curso anterior', 'texto', 'Enfermagem')] },
            { id: 'o2', itens: [item('CURSO_ANT', 'Curso anterior', 'texto', 'Biologia')] },
          ],
        },
      ],
    },
  ],
  derivados: [
    item('MODALIDADES', 'Modalidades', 'opcoes', [{ codigo: 'AC', rotulo: 'Ampla concorrência' }]),
  ],
  arquivos: [
    arquivo(LAUDO_ID, 'Laudo médico'),
    arquivo(COMPROVANTE_ID, 'Comprovante de residência', { exigenciaId: OUTRA_EXIGENCIA_ID }),
  ],
};

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

  const botao = (texto: string): HTMLButtonElement => {
    const encontrado = Array.from(host().querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === texto,
    );
    if (encontrado === undefined) throw new Error(`Botão ${texto} ausente`);
    return encontrado;
  };
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

  const indisponivel = (botao: HTMLElement): boolean =>
    botao.getAttribute('aria-disabled') === 'true';

  it('mostra identificação, respostas pelo tipo, derivados e arquivos', async () => {
    await abrir(FERNANDA);

    expect(host().querySelector('h1')?.textContent).toContain('Inscrição 2027-000101');
    expect(dado('Número')).toBe('2027-000101');
    expect(dado('Situação')).toBe('Enviada');
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
    await abrir({ ...FERNANDA, submetidaEm: undefined });
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
            item('CPF', 'CPF', 'texto', '***.598.363-**', { componente: 'cpf', podeRevelar: true }),
            item('RG', 'RG', 'texto', '*********', { componente: 'identificador' }),
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
            item('PASSAPORTE', 'Passaporte', 'numero', '*********', {
              componente: 'identificador',
              podeRevelar: true,
            }),
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
    expect(itens[0]).toContain('Verificado');
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
      situacao: SituacaoInscricao.submetida,
      ofertas: [oferta(1, DIREITO)],
      secoes: [],
      derivados: [],
      arquivos: [],
    });

    expect(dado('Situação')).toBe('Enviada');
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
      situacao: SituacaoInscricao.cancelada,
      canceladaEm: '2026-12-11T15:00:00Z',
      motivoDoCancelamento: 'A pedido da candidata',
    });

    expect(dado('Situação')).toBe('Cancelada');
    expect(dado('Cancelada em')).toBe('11/12/2026, 12:00');
    expect(dado('Motivo do cancelamento')).toBe('A pedido da candidata');
  });

  it('só consulta o detalhe quando a tela abre a inscrição', async () => {
    controller.expectNone(ROTA_DETALHE);
    await criarPagina();

    expect(controller.match(ROTA_DETALHE)).toHaveLength(1);
  });

  it('sem inscrição a ler não fica carregando para sempre', async () => {
    parametros.next(convertToParamMap({ id: PROCESSO_ID }));
    await criarPagina();

    expect(host().querySelector('[role="status"]')?.textContent?.trim()).toBe('');
    expect(texto()).not.toContain('Carregando a inscrição');
    expect(host().querySelector('.panel')).toBeNull();
  });

  it('diz que a inscrição não foi encontrada no 404, com retorno à listagem', async () => {
    await criarPagina();
    doDetalhe().flush(
      { title: 'Não encontrada', status: 404 },
      { status: 404, statusText: 'Not Found' },
    );
    await propagar();

    expect(texto()).toContain('Inscrição não encontrada');
    expect(host().querySelector('.page-header__desc')?.textContent ?? '').not.toContain(
      'inscrição enviada',
    );
    expect(host().querySelector('.panel')).toBeNull();
    expect(host().querySelector('a.btn--tertiary')?.getAttribute('href')).toBe(
      `/processo-seletivo/${PROCESSO_ID}/inscricoes`,
    );
  });

  it('só descreve a inscrição como enviada com ela em tela', async () => {
    await criarPagina();
    const subtitulo = (): string => host().querySelector('.page-header__desc')?.textContent ?? '';
    expect(subtitulo()).not.toContain('inscrição enviada');

    doDetalhe().flush({ title: 'Erro', status: 500 }, { status: 500, statusText: 'Server Error' });
    await propagar();
    expect(subtitulo()).not.toContain('inscrição enviada');

    botao('Tentar novamente').click();
    await propagar();
    doDetalhe().flush(FERNANDA);
    await propagar();
    expect(subtitulo()).toContain('inscrição enviada neste processo seletivo');
  });

  it('anuncia o carregamento na região viva quando a falha é relida', async () => {
    await criarPagina();
    doDetalhe().flush({ title: 'Erro', status: 500 }, { status: 500, statusText: 'Server Error' });
    await propagar();
    const regiao = host().querySelector('[role="status"]');
    expect(regiao?.textContent?.trim()).toBe('');

    botao('Tentar novamente').click();
    await propagar();

    expect(host().querySelector('[role="status"]')).toBe(regiao);
    expect(regiao?.textContent).toContain('Carregando a inscrição');
    doDetalhe().flush(FERNANDA);
    await propagar();
    expect(regiao?.textContent?.trim()).toBe('');
  });

  it('mostra a falha e relê ao tentar novamente', async () => {
    await criarPagina();
    doDetalhe().flush({ title: 'Erro', status: 500 }, { status: 500, statusText: 'Server Error' });
    await propagar();

    expect(texto()).toContain('Não foi possível carregar a inscrição');
    botao('Tentar novamente').click();
    await propagar();
    doDetalhe().flush(FERNANDA);
    await propagar();

    expect(dado('Número')).toBe('2027-000101');
    expect(texto()).not.toContain('Não foi possível carregar a inscrição');
  });

  it('com a releitura em curso, Tentar novamente mantém o foco e não parte outra leitura', async () => {
    await criarPagina();
    doDetalhe().flush({ title: 'Erro', status: 500 }, { status: 500, statusText: 'Server Error' });
    await propagar();
    const tentar = botao('Tentar novamente');
    tentar.focus();

    tentar.click();
    await propagar();
    tentar.click();
    await propagar();

    expect(document.activeElement).toBe(tentar);
    expect(tentar.getAttribute('aria-disabled')).toBe('true');
    expect(tentar.getAttribute('aria-busy')).toBe('true');
    doDetalhe().flush(FERNANDA);
    await propagar();
    expect(dado('Número')).toBe('2027-000101');
  });

  it('anuncia o carregamento numa região viva que já estava no DOM e a esvazia ao terminar', async () => {
    await criarPagina();

    const regiao = host().querySelector('[role="status"]');
    expect(regiao?.textContent).toContain('Carregando a inscrição');
    doDetalhe().flush(FERNANDA);
    await propagar();

    expect(host().querySelector('[role="status"]')).toBe(regiao);
    expect(regiao?.textContent?.trim()).toBe('');
  });

  it('numera as ofertas pela ordem da escolha, mesmo chegando invertidas', async () => {
    await abrir({ ...FERNANDA, ofertas: [oferta(2, DIREITO), oferta(1, MEDICINA)] });

    expect(itensDe('Ofertas escolhidas')).toEqual([MEDICINA, DIREITO]);
    const numeros = Array.from(dd('Ofertas escolhidas')?.querySelectorAll('li') ?? []).map(
      (li) => li.value,
    );
    expect(numeros).toEqual([1, 2]);
  });

  it('com uma oferta só mostra "Oferta escolhida", sem número', async () => {
    await abrir({ ...FERNANDA, ofertas: [oferta(1, MEDICINA)] });

    expect(dado('Oferta escolhida')).toBe(MEDICINA);
    expect(dd('Oferta escolhida')?.querySelector('li')).toBeNull();
    expect(dado('Ofertas escolhidas')).toBeNull();
  });

  it('mostra "Oferta não identificada" para a oferta sem nome, sem perder a escolha', async () => {
    await abrir({ ...FERNANDA, ofertas: [oferta(1, null)] });

    expect(dado('Oferta escolhida')).toBe('Oferta não identificada');
  });

  it('sem ofertas na resposta, o rótulo não aparece', async () => {
    await abrir({ ...FERNANDA, ofertas: undefined });

    expect(dado('Oferta escolhida')).toBeNull();
    expect(dado('Ofertas escolhidas')).toBeNull();
    expect(dado('Número')).toBe('2027-000101');
  });

  it('na troca de inscrição nada da anterior aparece', async () => {
    await abrir(FERNANDA);
    expect(dado('Nome completo')).not.toBeNull();

    parametros.next(convertToParamMap({ id: PROCESSO_ID, inscricaoId: OUTRA_INSCRICAO_ID }));
    await propagar();

    expect(dado('Nome completo')).toBeNull();
    expect(botoesAbrir()).toHaveLength(0);
    expect(host().querySelector('[role="status"]')?.textContent).toContain(
      'Carregando a inscrição',
    );
    doDetalhe(ROTA_OUTRA).flush({ ...FERNANDA, arquivos: [], numeroInscricao: '2027-000202' });
    await propagar();
    expect(dado('Número')).toBe('2027-000202');
  });

  it('distingue o nome do Abrir pela ocorrência e pelo grupo, e não numera a ocorrência que o detalhe omitiu', async () => {
    await abrir({
      ...FERNANDA,
      secoes: [
        {
          codigo: 'grupos',
          grupos: [
            {
              codigo: 'DEPENDENTES',
              rotulo: 'Dependentes',
              ocorrencias: [
                { id: 'd1', itens: [item('NOME_DEP', 'Nome', 'texto', 'Ana')] },
                { id: 'd2', itens: [item('NOME_DEP', 'Nome', 'texto', 'Bia')] },
              ],
            },
            {
              codigo: 'RESPONSAVEIS',
              rotulo: 'Responsáveis',
              ocorrencias: [{ id: 'r1', itens: [item('NOME_RESP', 'Nome', 'texto', 'Caio')] }],
            },
          ],
          itens: [],
        },
      ],
      arquivos: [
        arquivo(LAUDO_ID, 'RG', { ocorrenciaId: 'd2' }),
        arquivo(COMPROVANTE_ID, 'RG', { ocorrenciaId: 'r1' }),
        arquivo(OUTRO_ARQUIVO_ID, 'RG', { ocorrenciaId: 'omitida-1' }),
        arquivo(SEGUNDO_ARQUIVO_OMITIDO_ID, 'RG', { ocorrenciaId: 'omitida-2' }),
      ],
    });

    expect(botoesAbrir().map((b) => b.getAttribute('aria-label'))).toEqual([
      'Abrir RG (Dependentes, ocorrência 2), enviado em 10/12/2026, 12:00',
      'Abrir RG (Responsáveis, ocorrência 1), enviado em 10/12/2026, 12:00',
      'Abrir RG, arquivo 1 de 2, enviado em 10/12/2026, 12:00',
      'Abrir RG, arquivo 2 de 2, enviado em 10/12/2026, 12:00',
    ]);
    expect(texto()).toContain('RG (Dependentes, ocorrência 2)');
    expect(texto()).not.toContain('ocorrência 3');
  });

  describe('revelar o valor de um campo', () => {
    const CPF_DE_FERNANDA = '699.598.363-71';
    const PASSAPORTE_DE_ERICK = 'FJ849201';
    const revelacao = (fato: string, ocorrencia: string | null = null): string =>
      `${ROTA_DETALHE}/campos/${fato}/revelacao${ocorrencia === null ? '' : `?ocorrencia=${ocorrencia}`}`;
    const comIdentificadores = (extra: ItemDeRespostaDto[] = []): InscricaoAdministrativaDto => ({
      ...FERNANDA,
      secoes: [
        {
          codigo: 'identificacao',
          titulo: 'Identificação',
          grupos: [],
          itens: [
            item('CPF', 'CPF', 'texto', '***.598.363-**', { componente: 'cpf', podeRevelar: true }),
            item('PASSAPORTE', 'Passaporte', 'texto', '*********', {
              componente: 'identificador',
              podeRevelar: true,
            }),
            ...extra,
          ],
        },
      ],
      derivados: [],
    });
    const pedir = async (rotulo: string): Promise<void> => {
      const alvo = host().querySelector<HTMLButtonElement>(
        `button[aria-label="Revelar ${rotulo}"]`,
      );
      alvo?.focus();
      alvo?.click();
      await propagar();
    };
    const valorNaTela = (rotulo: string): string =>
      dd(rotulo)?.querySelector('.resposta__valor > span')?.textContent?.trim() ?? '';
    const avisoDe = (rotulo: string): string =>
      (
        dd(rotulo)?.querySelector('.resposta__aviso .alert__msg') ??
        dd(rotulo)?.querySelector('.resposta__aviso')
      )?.textContent?.trim() ?? '';
    const foraDoCampo = (valor: string, rotulo: string): HTMLElement[] =>
      Array.from(host().querySelectorAll<HTMLElement>('*')).filter(
        (e) =>
          e.textContent?.includes(valor) === true &&
          Array.from(e.children).every((f) => f.textContent?.includes(valor) !== true) &&
          e.closest('.dado') !== dd(rotulo),
      );

    it('revela só o campo pedido, anuncia o valor e tira o botão dele', async () => {
      await abrir(comIdentificadores());

      await pedir('CPF');
      const pedido = controller.expectOne(revelacao('CPF'));
      expect(pedido.request.headers.get('Accept')).toContain('campo-revelado-da-inscricao');
      pedido.flush({ fatoCodigo: 'CPF', valor: CPF_DE_FERNANDA });
      await propagar();

      expect(host().querySelector('button[aria-label="Revelar CPF"]')).toBeNull();
      expect(valorNaTela('CPF')).toBe(CPF_DE_FERNANDA);
      expect(dado('Passaporte')).toBe('********* Revelar');
      expect(document.activeElement).toBe(
        dd('CPF')?.querySelector('.resposta__valor') as HTMLElement,
      );
      expect(dd('CPF')?.querySelector('.resposta__valor')?.hasAttribute('aria-live')).toBe(false);
      expect(avisoDe('CPF')).toBe('CPF revelado');
      expect(avisoDe('CPF')).not.toContain(CPF_DE_FERNANDA);
      expect(foraDoCampo(CPF_DE_FERNANDA, 'CPF')).toEqual([]);
    });

    it('não rouba o foco de quem foi para outro controle enquanto a rede respondia', async () => {
      await abrir(comIdentificadores());
      await pedir('CPF');
      const outro = host().querySelector<HTMLButtonElement>(
        'button[aria-label="Revelar Passaporte"]',
      );
      outro?.focus();

      controller.expectOne(revelacao('CPF')).flush({ fatoCodigo: 'CPF', valor: CPF_DE_FERNANDA });
      await propagar();

      expect(valorNaTela('CPF')).toBe(CPF_DE_FERNANDA);
      expect(document.activeElement).toBe(outro);
    });

    it('formata o valor revelado pelo componente e pelo tipo do item', async () => {
      await abrir({
        ...FERNANDA,
        secoes: [
          {
            codigo: 'x',
            grupos: [],
            itens: [
              item('RENDA', 'Renda familiar', 'numero', '***', {
                componente: 'moeda',
                podeRevelar: true,
              }),
            ],
          },
        ],
        derivados: [],
      });

      await pedir('Renda familiar');
      controller.expectOne(revelacao('RENDA')).flush({ fatoCodigo: 'RENDA', valor: '1234.56' });
      await propagar();

      expect(valorNaTela('Renda familiar')).toBe('R$ 1.234,56');
    });

    it('mantém o foco no botão enquanto o pedido está pendente e não repete o pedido', async () => {
      await abrir(comIdentificadores());
      const alvo = host().querySelector<HTMLButtonElement>('button[aria-label="Revelar CPF"]');
      alvo?.focus();

      alvo?.click();
      await propagar();
      expect(document.activeElement).toBe(alvo);
      alvo?.click();
      await propagar();

      controller.expectOne(revelacao('CPF')).flush({ fatoCodigo: 'CPF', valor: CPF_DE_FERNANDA });
    });

    it('manda para o papel só a forma mascarada', async () => {
      await abrir(comIdentificadores());
      await pedir('CPF');
      controller.expectOne(revelacao('CPF')).flush({ fatoCodigo: 'CPF', valor: CPF_DE_FERNANDA });
      await propagar();

      const campo = dd('CPF');
      const paraPapel = campo?.querySelector('.u-print-only');
      expect(paraPapel?.textContent).toContain('***.598.363-**');
      expect(paraPapel?.textContent).not.toContain(CPF_DE_FERNANDA);
      const paraTela = Array.from(campo?.querySelectorAll('.u-no-print') ?? []).find((e) =>
        e.textContent?.includes(CPF_DE_FERNANDA),
      );
      expect(paraTela).toBeDefined();
    });

    it('oculta o valor revelado sem novo pedido, devolve o foco ao Revelar e pede de novo ao revelar', async () => {
      await abrir(comIdentificadores());
      await pedir('CPF');
      controller.expectOne(revelacao('CPF')).flush({ fatoCodigo: 'CPF', valor: CPF_DE_FERNANDA });
      await propagar();

      host().querySelector<HTMLButtonElement>('button[aria-label="Ocultar CPF"]')?.click();
      await propagar();

      expect(texto()).not.toContain(CPF_DE_FERNANDA);
      expect(dado('CPF')).toBe('***.598.363-** Revelar');
      expect(document.activeElement).toBe(host().querySelector('button[aria-label="Revelar CPF"]'));
      await pedir('CPF');
      controller.expectOne(revelacao('CPF')).flush({ fatoCodigo: 'CPF', valor: CPF_DE_FERNANDA });
    });

    it('mantém o Revelar depois de outra falha que não o 404', async () => {
      await abrir(comIdentificadores());
      await pedir('CPF');
      controller
        .expectOne(revelacao('CPF'))
        .flush({ title: 'Erro', status: 500 }, { status: 500, statusText: 'Server Error' });
      await propagar();

      expect(host().querySelector('button[aria-label="Revelar CPF"]')).not.toBeNull();
    });

    it('marca como indisponível o botão do pedido pendente', async () => {
      await abrir(comIdentificadores());

      await pedir('Passaporte');
      const botaoDoPassaporte = host().querySelector<HTMLButtonElement>(
        'button[aria-label="Revelar Passaporte"]',
      );
      expect(botaoDoPassaporte?.getAttribute('aria-disabled')).toBe('true');
      controller
        .expectOne(revelacao('PASSAPORTE'))
        .flush({ fatoCodigo: 'PASSAPORTE', valor: PASSAPORTE_DE_ERICK });
    });

    it('leva a ocorrência quando o campo está em grupo e revela só aquela ocorrência', async () => {
      const identificador = (): ItemDeRespostaDto =>
        item('PASSAPORTE', 'Passaporte', 'texto', '*********', {
          componente: 'identificador',
          podeRevelar: true,
        });
      await abrir({
        ...FERNANDA,
        secoes: [
          {
            codigo: 'familia',
            grupos: [
              {
                codigo: 'RESPONSAVEIS',
                rotulo: 'Responsáveis',
                ocorrencias: [
                  { id: 'o1', itens: [identificador()] },
                  { id: 'o2', itens: [identificador()] },
                ],
              },
            ],
            itens: [],
          },
        ],
        derivados: [],
      });

      host()
        .querySelectorAll<HTMLButtonElement>('button[aria-label="Revelar Passaporte"]')[1]
        .click();
      await propagar();
      controller
        .expectOne(revelacao('PASSAPORTE', 'o2'))
        .flush({ fatoCodigo: 'PASSAPORTE', valor: PASSAPORTE_DE_ERICK });
      await propagar();

      expect(texto()).toContain(PASSAPORTE_DE_ERICK);
      expect(host().querySelectorAll('button[aria-label="Revelar Passaporte"]')).toHaveLength(1);
    });

    it('mantém o mascarado e diz "Dado não disponível" no 404', async () => {
      await abrir(comIdentificadores());

      await pedir('CPF');
      controller
        .expectOne(revelacao('CPF'))
        .flush({ title: 'Não encontrado', status: 404 }, { status: 404, statusText: 'Not Found' });
      await propagar();

      expect(dado('CPF')).toContain('***.598.363-**');
      expect(dado('CPF')).toContain('Dado não disponível');
      expect(dado('CPF')).not.toContain(CPF_DE_FERNANDA);
      expect(host().querySelector('button[aria-label="Revelar CPF"]')).toBeNull();
      expect(document.activeElement).toBe(dd('CPF')?.querySelector('.resposta__aviso'));
    });

    it('anuncia o dado indisponível na mesma região viva que já estava no campo', async () => {
      await abrir(comIdentificadores());
      const regiaoAntes = dd('CPF')?.querySelector('.resposta__aviso');
      expect(regiaoAntes?.getAttribute('aria-live')).toBe('polite');
      expect(regiaoAntes?.textContent?.trim()).toBe('');

      await pedir('CPF');
      controller
        .expectOne(revelacao('CPF'))
        .flush({ title: 'Não encontrado', status: 404 }, { status: 404, statusText: 'Not Found' });
      await propagar();

      const regiao = dd('CPF')?.querySelector('.resposta__aviso');
      expect(regiao).toBe(regiaoAntes);
      expect(regiao?.querySelector('.alert--info')?.textContent).toContain('Dado não disponível.');
      expect(regiao?.querySelector('.alert--danger')).toBeNull();
    });

    it('mostra a falha junto do campo, sem revelar, e permite tentar de novo', async () => {
      await abrir(comIdentificadores());

      await pedir('CPF');
      controller
        .expectOne(revelacao('CPF'))
        .flush({ title: 'Erro', status: 500 }, { status: 500, statusText: 'Server Error' });
      await propagar();

      expect(dado('CPF')).toContain('***.598.363-**');
      expect(dado('CPF')).not.toContain('Dado não disponível');
      expect(avisoDe('CPF')).toBe('Resposta inesperada do servidor');
      expect(dd('CPF')?.querySelector('.resposta__aviso .alert--danger')).not.toBeNull();
      expect(host().querySelector('button[aria-label="Revelar CPF"]')).not.toBeNull();
    });

    it('não grava na nova inscrição o pedido que a anterior deixou pendente', async () => {
      await abrir(comIdentificadores());
      await pedir('CPF');
      const pendente = controller.expectOne(revelacao('CPF'));

      parametros.next(convertToParamMap({ id: PROCESSO_ID, inscricaoId: OUTRA_INSCRICAO_ID }));
      await propagar();
      doDetalhe(ROTA_OUTRA).flush(comIdentificadores());
      pendente.flush({ fatoCodigo: 'CPF', valor: CPF_DE_FERNANDA });
      await propagar();

      expect(texto()).not.toContain(CPF_DE_FERNANDA);
      expect(dado('CPF')).toBe('***.598.363-** Revelar');
    });

    it('zera o valor revelado ao trocar de inscrição', async () => {
      await abrir(comIdentificadores());
      await pedir('CPF');
      controller.expectOne(revelacao('CPF')).flush({ fatoCodigo: 'CPF', valor: CPF_DE_FERNANDA });
      await propagar();
      expect(texto()).toContain(CPF_DE_FERNANDA);

      parametros.next(convertToParamMap({ id: PROCESSO_ID, inscricaoId: OUTRA_INSCRICAO_ID }));
      await propagar();
      doDetalhe(ROTA_OUTRA).flush(comIdentificadores());
      await propagar();

      expect(texto()).not.toContain(CPF_DE_FERNANDA);
      expect(foraDoCampo(CPF_DE_FERNANDA, 'CPF')).toEqual([]);
    });

    it('anuncia cada falha igual na região do campo, esvaziando-a enquanto o pedido corre', async () => {
      await abrir(comIdentificadores());

      for (let vez = 0; vez < 2; vez++) {
        await pedir('CPF');
        expect(avisoDe('CPF')).toBe('');
        controller
          .expectOne(revelacao('CPF'))
          .flush({ title: 'Erro', status: 500 }, { status: 500, statusText: 'Server Error' });
        await propagar();
        expect(avisoDe('CPF')).toBe('Resposta inesperada do servidor');
      }
    });

    it('esquece o valor revelado ao tentar novamente a leitura da inscrição', async () => {
      await abrir(comIdentificadores());
      await pedir('CPF');
      controller.expectOne(revelacao('CPF')).flush({ fatoCodigo: 'CPF', valor: CPF_DE_FERNANDA });
      await propagar();
      fixture.debugElement.injector.get(DetalheDaInscricao).tentarNovamente();
      await propagar();
      doDetalhe().flush(comIdentificadores());
      await propagar();

      expect(texto()).not.toContain(CPF_DE_FERNANDA);
      expect(dado('CPF')).toBe('***.598.363-** Revelar');
    });

    it('mostra o componente situacao como a etiqueta de situação das demais telas', async () => {
      await abrir({
        ...FERNANDA,
        secoes: [
          {
            codigo: 'x',
            grupos: [],
            itens: [
              item('SITUACAO', 'Situação do vínculo', 'texto', 'cancelada', {
                componente: 'situacao',
              }),
            ],
          },
        ],
        derivados: [],
      });

      expect(dd('Situação do vínculo')?.querySelector('.tag')?.textContent?.trim()).toBe(
        'Cancelada',
      );
    });

    it('exibe pelo tipo a situação que a tela não conhece, sem virar etiqueta com o código cru', async () => {
      await abrir({
        ...FERNANDA,
        secoes: [
          {
            codigo: 'x',
            grupos: [],
            itens: [
              item('SITUACAO', 'Situação do vínculo', 'texto', 'deferida', {
                componente: 'situacao',
              }),
            ],
          },
        ],
        derivados: [],
      });

      expect(dd('Situação do vínculo')?.querySelector('.tag')).toBeNull();
      expect(dado('Situação do vínculo')).toBe('deferida');
    });
  });

  describe('abrir o arquivo', () => {
    const acesso = (arquivoId: string): string =>
      `${ROTA_DETALHE}/documentos/arquivos/${arquivoId}/acesso`;
    const URL_ASSINADA = 'https://armazenamento.exemplo/laudo?assinatura=1';

    interface AbaFalsa {
      location: { href: string };
      opener: unknown;
      close: ReturnType<typeof vi.fn>;
    }
    let abas: AbaFalsa[];
    let bloqueada: boolean;

    beforeEach(() => {
      abas = [];
      bloqueada = false;
      vi.spyOn(window, 'open').mockImplementation(() => {
        if (bloqueada) return null;
        const aba: AbaFalsa = { location: { href: '' }, opener: {}, close: vi.fn() };
        abas.push(aba);
        return aba as unknown as Window;
      });
    });

    const liberar = (arquivoId: string): void =>
      controller
        .expectOne(acesso(arquivoId))
        .flush({ url: URL_ASSINADA, expiraEm: '2026-12-10T15:05:00Z' });
    const recusar = (arquivoId: string, status: number): void =>
      controller
        .expectOne(acesso(arquivoId))
        .flush({ title: 'Recusado', status }, { status, statusText: 'Recusado' });

    it('abre o arquivo numa aba nova pelo acesso auditado', async () => {
      await abrir(FERNANDA);

      botoesAbrir()[0].click();
      await propagar();
      expect(abas).toHaveLength(1);
      liberar(LAUDO_ID);
      await propagar();

      expect(abas[0].location.href).toBe(URL_ASSINADA);
      expect(abas[0].opener).toBeNull();
      expect(texto()).not.toContain('Arquivo não disponível');
    });

    it('mostra "Arquivo não disponível" no 404, sem dizer se o arquivo existe', async () => {
      await abrir(FERNANDA);

      botoesAbrir()[0].click();
      await propagar();
      recusar(LAUDO_ID, 404);
      await propagar();

      const alerta = host().querySelector('ui-alert');
      expect(alerta?.textContent).toContain('Arquivo não disponível');
      expect(alerta?.closest('li')?.textContent).toContain('Laudo médico');
      expect(texto()).not.toMatch(/não existe|inexistente/i);
      expect(abas[0].close).toHaveBeenCalled();
    });

    it('não deixa a recusa de um arquivo no outro, nem pede dois acessos juntos', async () => {
      await abrir(FERNANDA);

      botoesAbrir()[0].click();
      await propagar();
      expect(botoesAbrir().every(indisponivel)).toBe(true);
      recusar(LAUDO_ID, 404);
      await propagar();
      botoesAbrir()[1].click();
      await propagar();

      expect(host().querySelector('ui-alert')).toBeNull();
      liberar(COMPROVANTE_ID);
      await propagar();
    });

    it('com um arquivo sendo aberto, o botão acionado mantém o foco e marca a espera', async () => {
      await abrir(FERNANDA);
      const [primeiro, segundo] = botoesAbrir();
      primeiro.focus();

      primeiro.click();
      await propagar();

      expect(document.activeElement).toBe(primeiro);
      expect(primeiro.getAttribute('aria-busy')).toBe('true');
      expect(segundo.getAttribute('aria-busy')).toBeNull();
      expect(botoesAbrir().every(indisponivel)).toBe(true);
      segundo.click();
      await propagar();
      controller.expectNone(acesso(COMPROVANTE_ID));
      liberar(LAUDO_ID);
      await propagar();
    });

    it('explica a falha que não é de arquivo ausente com o texto do problema', async () => {
      await abrir(FERNANDA);

      botoesAbrir()[0].click();
      await propagar();
      recusar(LAUDO_ID, 500);
      await propagar();

      expect(host().querySelector('ui-alert')).not.toBeNull();
      expect(texto()).not.toContain('Arquivo não disponível');
    });

    it('diz que o navegador bloqueou a aba e não pede o acesso', async () => {
      await abrir(FERNANDA);
      bloqueada = true;

      botoesAbrir()[0].click();
      await propagar();

      controller.expectNone(acesso(LAUDO_ID));
      expect(host().querySelector('ui-alert')?.textContent).toContain('bloqueou');
      expect(botoesAbrir().every((b) => !indisponivel(b))).toBe(true);
    });

    it('descarta o acesso que chega depois da troca de inscrição e libera os botões da nova', async () => {
      await abrir(FERNANDA);

      botoesAbrir()[0].click();
      await propagar();
      parametros.next(convertToParamMap({ id: PROCESSO_ID, inscricaoId: OUTRA_INSCRICAO_ID }));
      await propagar();
      doDetalhe(ROTA_OUTRA).flush(FERNANDA);
      await propagar();
      expect(botoesAbrir().every((b) => !indisponivel(b))).toBe(true);

      liberar(LAUDO_ID);
      await propagar();

      expect(abas[0].location.href).toBe('');
      expect(abas[0].close).toHaveBeenCalled();
      expect(botoesAbrir().every((b) => !indisponivel(b))).toBe(true);
      expect(host().querySelector('ui-alert')).toBeNull();
    });

    it('descarta o acesso que chega depois de a tela ser destruída', async () => {
      await abrir(FERNANDA);

      botoesAbrir()[0].click();
      await propagar();
      fixture.destroy();
      liberar(LAUDO_ID);
      await new Promise((resolve) => setTimeout(resolve));

      expect(abas[0].location.href).toBe('');
      expect(abas[0].close).toHaveBeenCalled();
    });

    it('vira mensagem ao usuário a rejeição do pedido, sem escapar do clique', async () => {
      await abrir(FERNANDA);

      botoesAbrir()[0].click();
      await propagar();
      controller.expectOne(acesso(LAUDO_ID)).error(new ProgressEvent('error'));
      await propagar();

      expect(host().querySelector('ui-alert')?.textContent).toContain('Não foi possível abrir');
      expect(abas[0].close).toHaveBeenCalled();
      expect(botoesAbrir().every((b) => !indisponivel(b))).toBe(true);
    });
  });

  it('distingue o nome do Abrir dos arquivos da mesma exigência, mesmo sem data válida', async () => {
    await abrir({
      ...FERNANDA,
      arquivos: [
        arquivo(LAUDO_ID, 'Laudo médico', { confirmadoEm: 'invalida' }),
        arquivo(COMPROVANTE_ID, 'Laudo médico', { confirmadoEm: 'invalida' }),
      ],
    });

    expect(botoesAbrir().map((b) => b.getAttribute('aria-label'))).toEqual([
      'Abrir Laudo médico, arquivo 1 de 2',
      'Abrir Laudo médico, arquivo 2 de 2',
    ]);
  });
});

describe('rota do detalhe da inscrição', () => {
  it('recebe o processo e a inscrição pela URL, no acesso direto, e lê só o detalhe da inscrição', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiResultInterceptor])),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'processo-seletivo/:id/inscricoes', children: INSCRICOES_DO_PROCESSO_ROUTES },
        ]),
        { provide: SELECAO_BASE_PATH, useValue: BASE },
      ],
    });
    const controller = TestBed.inject(HttpTestingController);

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/processo-seletivo/${PROCESSO_ID}/inscricoes/${INSCRICAO_ID}`);
    await new Promise((resolve) => setTimeout(resolve));
    harness.detectChanges();

    expect(controller.expectOne(ROTA_DETALHE).request.method).toBe('GET');
    controller.expectNone((r) => r.url.includes('/certames/'));
    controller.expectNone(`${BASE}/api/selecao/processos-seletivos/${PROCESSO_ID}/inscricoes`);
    controller.verify();
  });
});
