import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
  type TestRequest,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { apiResultInterceptor } from '@uniplus/shared-core/http';
import { SELECAO_BASE_PATH, type InscricaoAdministrativaDto } from '@uniplus/shared-data/selecao';
import { BehaviorSubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DetalheDaInscricaoPage } from './detalhe-da-inscricao.page';

import {
  arquivo,
  BASE,
  COMPROVANTE_ID,
  FERNANDA,
  INSCRICAO_ID,
  LAUDO_ID,
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

  const botoesAbrir = (): HTMLButtonElement[] =>
    Array.from(host().querySelectorAll('button')).filter((b) => b.textContent?.trim() === 'Abrir');

  const indisponivel = (botao: HTMLElement): boolean =>
    botao.getAttribute('aria-disabled') === 'true';

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
