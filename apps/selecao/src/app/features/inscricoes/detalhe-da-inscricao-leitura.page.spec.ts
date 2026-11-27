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
  FormaDoValorDoItemCodigo,
  SELECAO_BASE_PATH,
  type InscricaoAdministrativaDto,
} from '@uniplus/shared-data/selecao';
import { AnuncioDaConclusao } from '@uniplus/shared-ui/components';
import { BehaviorSubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DetalheDaInscricaoPage } from './detalhe-da-inscricao.page';

import {
  arquivo,
  BASE,
  COMPROVANTE_ID,
  DIREITO,
  FERNANDA,
  INSCRICAO_ID,
  item,
  LAUDO_ID,
  MEDICINA,
  oferta,
  OUTRA_INSCRICAO_ID,
  OUTRO_ARQUIVO_ID,
  PROCESSO_ID,
  ROTA_DETALHE,
  ROTA_OUTRA,
  SEGUNDO_ARQUIVO_OMITIDO_ID,
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
  const botoesAbrir = (): HTMLButtonElement[] =>
    Array.from(host().querySelectorAll('button')).filter((b) => b.textContent?.trim() === 'Abrir');

  it('só consulta o detalhe quando a tela abre a inscrição', async () => {
    controller.expectNone(ROTA_DETALHE);
    await criarPagina();

    expect(controller.match(ROTA_DETALHE)).toHaveLength(1);
  });

  it('sem inscrição a ler não fica carregando para sempre', async () => {
    parametros.next(convertToParamMap({ id: PROCESSO_ID }));
    await criarPagina();

    expect(host().querySelector('.insc-det__lendo')).toBeNull();
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

  it('anuncia a nova tentativa na região do aviso, sem repetir o carregamento', async () => {
    await criarPagina();
    doDetalhe().flush({ title: 'Erro', status: 500 }, { status: 500, statusText: 'Server Error' });
    await propagar();
    const regiao = host().querySelector('[role="status"]');
    expect(regiao?.textContent?.trim()).toBe('');

    botao('Tentar novamente').click();
    await propagar();

    expect(host().querySelector('[role="status"]')).toBe(regiao);
    expect(regiao?.textContent).toContain('Tentando novamente');
    expect(host().querySelectorAll('[role="status"]')).toHaveLength(1);
    doDetalhe().flush(FERNANDA);
    await propagar();
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

  it('503, nova tentativa e 404: a recusa fica na tela e a conclusão não é anunciada', async () => {
    await criarPagina();
    const anunciar = vi.spyOn(TestBed.inject(AnuncioDaConclusao), 'anunciar');
    doDetalhe().flush(
      { title: 'Indisponível', status: 503 },
      { status: 503, statusText: 'Service Unavailable' },
    );
    await propagar();

    botao('Tentar novamente').click();
    await propagar();
    doDetalhe().flush(
      { title: 'Não encontrada', status: 404 },
      { status: 404, statusText: 'Not Found' },
    );
    await propagar();
    await propagar();

    expect(texto()).toContain('Inscrição não encontrada');
    expect(anunciar).not.toHaveBeenCalled();
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

  it('anuncia o primeiro carregamento no indicador e o retira ao terminar', async () => {
    await criarPagina();

    expect(host().querySelector('[role="status"]')?.textContent).toContain(
      'Carregando a inscrição',
    );
    doDetalhe().flush(FERNANDA);
    await propagar();

    expect(host().querySelector('.insc-det__lendo')).toBeNull();
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
                {
                  id: 'd1',
                  itens: [item('NOME_DEP', 'Nome', FormaDoValorDoItemCodigo.TEXTO, 'Ana')],
                },
                {
                  id: 'd2',
                  itens: [item('NOME_DEP', 'Nome', FormaDoValorDoItemCodigo.TEXTO, 'Bia')],
                },
              ],
            },
            {
              codigo: 'RESPONSAVEIS',
              rotulo: 'Responsáveis',
              ocorrencias: [
                {
                  id: 'r1',
                  itens: [item('NOME_RESP', 'Nome', FormaDoValorDoItemCodigo.TEXTO, 'Caio')],
                },
              ],
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

  describe('emitir o comprovante', () => {
    const acao = (): HTMLAnchorElement | undefined =>
      Array.from(host().querySelectorAll('a')).find(
        (a) => a.textContent?.trim() === 'Emitir comprovante',
      );

    it('leva ao comprovante do último envio quando a API permite a emissão', async () => {
      await abrir({ ...FERNANDA, podeEmitirComprovante: true, numeroDoUltimoComprovante: 3 });

      expect(acao()?.getAttribute('href')).toBe(
        `/processo-seletivo/${PROCESSO_ID}/inscricoes/${INSCRICAO_ID}/comprovantes/3`,
      );
    });

    it('não aparece quando a conta não pode emitir, mesmo com comprovante', async () => {
      await abrir({ ...FERNANDA, podeEmitirComprovante: false, numeroDoUltimoComprovante: 3 });

      expect(acao()).toBeUndefined();
    });

    it('não aparece quando a inscrição não tem comprovante, mesmo com permissão', async () => {
      await abrir({ ...FERNANDA, podeEmitirComprovante: true, numeroDoUltimoComprovante: null });

      expect(acao()).toBeUndefined();
    });
  });
});
