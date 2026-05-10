import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationService } from '@uniplus/shared-core';
import type { ProblemDetails } from '@uniplus/shared-core';
import { NotificationHostComponent } from './notification-host';

function montarProblem(overrides: Partial<ProblemDetails> = {}): ProblemDetails {
  return {
    type: 'https://uniplus.unifesspa.edu.br/erros/exemplo',
    title: 'Recurso não encontrado',
    status: 404,
    detail: 'Edital com id 42 não existe.',
    code: 'uniplus.selecao.edital.nao_encontrado',
    traceId: '0123456789abcdef0123456789abcdef',
    ...overrides,
  };
}

function byTestId<T extends Element = HTMLElement>(
  fixture: ComponentFixture<NotificationHostComponent>,
  testId: string,
): T | null {
  const debug = fixture.debugElement.query(By.css(`[data-testid="${testId}"]`));
  return (debug?.nativeElement as T) ?? null;
}

function allByTestId<T extends Element = HTMLElement>(
  fixture: ComponentFixture<NotificationHostComponent>,
  testId: string,
): T[] {
  return fixture.debugElement
    .queryAll(By.css(`[data-testid="${testId}"]`))
    .map((debug) => debug.nativeElement as T);
}

describe('NotificationHostComponent', () => {
  let service: NotificationService;
  let fixture: ComponentFixture<NotificationHostComponent>;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [NotificationHostComponent],
    });
    service = TestBed.inject(NotificationService);
    fixture = TestBed.createComponent(NotificationHostComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  describe('rendering por tipo', () => {
    it('renderiza nada quando fila está vazia', () => {
      expect(allByTestId(fixture, 'notification-host-toast-success')).toHaveLength(0);
      expect(allByTestId(fixture, 'notification-host-toast-error')).toHaveLength(0);
      expect(allByTestId(fixture, 'notification-host-toast-warning')).toHaveLength(0);
      expect(allByTestId(fixture, 'notification-host-toast-info')).toHaveLength(0);
    });

    it('renderiza article role=alert + aria-live=assertive para error', () => {
      service.error('Falha', 'detalhe');
      fixture.detectChanges();
      const article = byTestId(fixture, 'notification-host-toast-error');
      expect(article).not.toBeNull();
      expect(article?.getAttribute('role')).toBe('alert');
      expect(article?.getAttribute('aria-live')).toBe('assertive');
    });

    it('renderiza article role=status + aria-live=polite para success', () => {
      service.success('Pronto');
      fixture.detectChanges();
      const article = byTestId(fixture, 'notification-host-toast-success');
      expect(article?.getAttribute('role')).toBe('status');
      expect(article?.getAttribute('aria-live')).toBe('polite');
    });

    it('renderiza article aria-live=assertive para warning', () => {
      service.warning('Atenção');
      fixture.detectChanges();
      const article = byTestId(fixture, 'notification-host-toast-warning');
      expect(article?.getAttribute('aria-live')).toBe('assertive');
    });

    it('exibe title e detail quando ambos providos', () => {
      service.info('Sessão expira', 'Em 5 minutos.');
      fixture.detectChanges();
      const title = byTestId(fixture, 'notification-host-title');
      const detail = byTestId(fixture, 'notification-host-detail');
      expect(title?.textContent?.trim()).toBe('Sessão expira');
      expect(detail?.textContent?.trim()).toBe('Em 5 minutos.');
    });
  });

  describe('botão "Copiar traceId"', () => {
    it('não renderiza quando notification não tem traceId', () => {
      service.error('Falha local');
      fixture.detectChanges();
      expect(byTestId(fixture, 'notification-host-copy-trace')).toBeNull();
      expect(byTestId(fixture, 'notification-host-trace-block')).toBeNull();
    });

    it('renderiza com traceId quando errorFromProblem(problem) provê', () => {
      service.errorFromProblem(montarProblem({ traceId: 'abc123' }));
      fixture.detectChanges();
      const code = byTestId(fixture, 'notification-host-trace-id');
      expect(code?.textContent?.trim()).toBe('abc123');
      const copyBtn = byTestId<HTMLButtonElement>(fixture, 'notification-host-copy-trace');
      expect(copyBtn?.getAttribute('aria-label')).toContain('abc123');
    });

    it('clipboard.writeText é chamado com o traceId no clique', () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(globalThis.navigator, 'clipboard', {
        value: { writeText },
        configurable: true,
      });

      service.errorFromProblem(montarProblem({ traceId: 'xyz789' }));
      fixture.detectChanges();
      byTestId<HTMLButtonElement>(fixture, 'notification-host-copy-trace')?.click();

      expect(writeText).toHaveBeenCalledWith('xyz789');
    });

    it('falha silenciosa quando clipboard API ausente', () => {
      Object.defineProperty(globalThis.navigator, 'clipboard', {
        value: undefined,
        configurable: true,
      });

      service.errorFromProblem(montarProblem({ traceId: 'no-api' }));
      fixture.detectChanges();
      const copyBtn = byTestId<HTMLButtonElement>(fixture, 'notification-host-copy-trace');
      expect(() => copyBtn?.click()).not.toThrow();
    });
  });

  describe('dispensar', () => {
    it('clique no botão fechar remove o toast', () => {
      service.error('Falha');
      fixture.detectChanges();
      expect(byTestId(fixture, 'notification-host-toast-error')).not.toBeNull();

      byTestId<HTMLButtonElement>(fixture, 'notification-host-dismiss')?.click();
      fixture.detectChanges();
      expect(byTestId(fixture, 'notification-host-toast-error')).toBeNull();
    });
  });

  describe('persistência em 5xx', () => {
    it('toast errorFromProblem 503 não some após timeout default', () => {
      service.errorFromProblem(montarProblem({ status: 503 }));
      fixture.detectChanges();
      vi.advanceTimersByTime(60_000);
      fixture.detectChanges();
      expect(byTestId(fixture, 'notification-host-toast-error')).not.toBeNull();
    });

    it('toast 4xx some após 5 s default', () => {
      service.errorFromProblem(montarProblem({ status: 404 }));
      fixture.detectChanges();
      vi.advanceTimersByTime(5000);
      fixture.detectChanges();
      expect(byTestId(fixture, 'notification-host-toast-error')).toBeNull();
    });
  });

  describe('a11y', () => {
    it('section container tem role=region + aria-label', () => {
      const section = fixture.debugElement.query(By.css('section'))
        ?.nativeElement as HTMLElement;
      expect(section?.getAttribute('role')).toBe('region');
      expect(section?.getAttribute('aria-label')).toBe('Notificações do sistema');
    });

    it('botão fechar tem aria-label descritivo', () => {
      service.success('a');
      fixture.detectChanges();
      const closeBtn = byTestId<HTMLButtonElement>(fixture, 'notification-host-dismiss');
      expect(closeBtn?.getAttribute('aria-label')).toBe('Fechar notificação');
    });
  });
});
