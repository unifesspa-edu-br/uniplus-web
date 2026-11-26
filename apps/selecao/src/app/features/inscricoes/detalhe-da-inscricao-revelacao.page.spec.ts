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
  ExibicaoDoValorDoItemCodigo,
  FormaDoValorDoItemCodigo,
  SELECAO_BASE_PATH,
  type InscricaoAdministrativaDto,
  type ItemDeRespostaDto,
} from '@uniplus/shared-data/selecao';
import { BehaviorSubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DetalheDaInscricaoPage } from './detalhe-da-inscricao.page';

import {
  BASE,
  FERNANDA,
  INSCRICAO_ID,
  exibicao,
  item,
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
            {
              ...item('CPF', 'CPF', FormaDoValorDoItemCodigo.TEXTO, '***.598.363-**'),
              componente: exibicao(ExibicaoDoValorDoItemCodigo.CPF),
              podeRevelar: true,
            },
            {
              ...item('PASSAPORTE', 'Passaporte', FormaDoValorDoItemCodigo.TEXTO, '*********'),
              componente: exibicao(ExibicaoDoValorDoItemCodigo.IDENTIFICADOR),
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
              {
                ...item('RENDA', 'Renda familiar', FormaDoValorDoItemCodigo.NUMERO, '***'),
                componente: exibicao(ExibicaoDoValorDoItemCodigo.MOEDA),
                podeRevelar: true,
              },
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
      const identificador = (): ItemDeRespostaDto => ({
        ...item('PASSAPORTE', 'Passaporte', FormaDoValorDoItemCodigo.TEXTO, '*********'),
        componente: exibicao(ExibicaoDoValorDoItemCodigo.IDENTIFICADOR),
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
  });
});
