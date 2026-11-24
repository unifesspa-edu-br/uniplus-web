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
  type InscricaoAdministrativaDto,
  type ItemDeRespostaDto,
} from '@uniplus/shared-data/selecao';
import { BehaviorSubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DetalheDaInscricaoPage } from './detalhe-da-inscricao.page';
import { DetalheDaInscricao } from './detalhe-da-inscricao.service';

import {
  BASE,
  FERNANDA,
  INSCRICAO_ID,
  item,
  OUTRA_INSCRICAO_ID,
  PROCESSO_ID,
  ROTA_DETALHE,
  ROTA_OUTRA,
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

  describe('revelar o valor de um campo', () => {
    const CPF_DE_FERNANDA = '699.598.363-71';
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
            {
              ...item('CPF', 'CPF', 'texto', '***.598.363-**'),
              componente: 'cpf',
              podeRevelar: true,
            },
            {
              ...item('PASSAPORTE', 'Passaporte', 'texto', '*********'),
              componente: 'identificador',
              podeRevelar: true,
            },
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
              {
                ...item('SITUACAO', 'Situação do vínculo', 'texto', 'cancelada'),
                componente: 'situacao',
              },
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
              {
                ...item('SITUACAO', 'Situação do vínculo', 'texto', 'deferida'),
                componente: 'situacao',
              },
            ],
          },
        ],
        derivados: [],
      });

      expect(dd('Situação do vínculo')?.querySelector('.tag')).toBeNull();
      expect(dado('Situação do vínculo')).toBe('deferida');
    });
  });
});
