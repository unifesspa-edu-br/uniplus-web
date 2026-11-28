import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProblemDetails } from '@uniplus/shared-core/http';
import { NotificationService } from '@uniplus/shared-core/notifications';
import { NotificationHostComponent } from './notification-host';

function montarProblem(overrides: Partial<ProblemDetails> = {}): ProblemDetails {
  return {
    type: 'https://unifesspa-edu-br.github.io/uniplus-developers/erros/exemplo',
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

    it('não põe papel nem aria-live em nenhum cartão', () => {
      service.error('Falha', 'detalhe');
      service.success('Pronto');
      fixture.detectChanges();
      const cartao = fixture.nativeElement.querySelector('ui-aviso') as HTMLElement;
      expect(cartao.querySelector('[role], [aria-live]')).toBeNull();
    });

    it('anuncia o erro na região assertiva e o sucesso na educada', () => {
      service.error('Falha', 'detalhe');
      fixture.detectChanges();
      expect(byTestId(fixture, 'notification-host-anuncio-assertivo')?.textContent).toContain(
        'Falha',
      );
      service.success('Pronto');
      fixture.detectChanges();
      expect(byTestId(fixture, 'notification-host-anuncio-polido')?.textContent).toContain(
        'Pronto',
      );
      expect(byTestId(fixture, 'notification-host-anuncio-assertivo')?.textContent).not.toContain(
        'Pronto',
      );
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

  describe('referência ao suporte', () => {
    const IDENTIFICADOR = '0af7651916cd43dd8448eb211c80319c';

    function textoDoBloco(): string {
      return byTestId(fixture, 'notification-host-referencia')?.textContent ?? '';
    }

    function definirAreaDeTransferencia(writeText: Clipboard['writeText'] | undefined): void {
      Object.defineProperty(globalThis.navigator, 'clipboard', {
        value: writeText ? { writeText } : undefined,
        configurable: true,
      });
    }

    it('mostra código do erro e identificador do pedido sem o rótulo antigo', () => {
      service.errorFromProblem(montarProblem({ traceId: IDENTIFICADOR }));
      fixture.detectChanges();
      expect(textoDoBloco()).toContain('Código do erro');
      expect(textoDoBloco()).toContain('uniplus.selecao.edital.nao_encontrado');
      expect(textoDoBloco()).toContain('Identificador do pedido');
      expect(textoDoBloco()).toContain(IDENTIFICADOR);
      expect(fixture.nativeElement.textContent).not.toContain('ID de rastreamento');
    });

    it('mostra só o código quando o identificador está fora do formato', () => {
      service.errorFromProblem(montarProblem({ traceId: 'curto' }));
      fixture.detectChanges();
      expect(textoDoBloco()).toContain('Código do erro');
      expect(textoDoBloco()).not.toContain('Identificador do pedido');
    });

    it('mostra só o identificador quando o código está fora do formato', () => {
      service.errorFromProblem(montarProblem({ code: 'ERRO 1', traceId: IDENTIFICADOR }));
      fixture.detectChanges();
      expect(textoDoBloco()).toContain('Identificador do pedido');
      expect(textoDoBloco()).not.toContain('Código do erro');
    });

    it('não mostra o bloco quando nenhum dos dois serve, nem em erro sem resposta', () => {
      service.errorFromProblem(montarProblem({ code: 'ERRO 1', traceId: '' }));
      service.error('Falha local');
      fixture.detectChanges();
      expect(allByTestId(fixture, 'notification-host-referencia')).toHaveLength(0);
    });

    it.each(['success', 'info', 'warning'] as const)('aviso de %s não mostra o bloco', (tipo) => {
      service[tipo]('Aviso');
      fixture.detectChanges();
      expect(byTestId(fixture, 'notification-host-referencia')).toBeNull();
    });

    it('mostra o bloco dentro do mesmo aviso', () => {
      service.errorFromProblem(montarProblem());
      fixture.detectChanges();
      const bloco = byTestId(fixture, 'notification-host-referencia');
      expect(byTestId(fixture, 'notification-host-toast-error')?.contains(bloco)).toBe(true);
    });

    it('copia sem aria-pressed e anuncia "Copiado." na região de status do bloco', async () => {
      definirAreaDeTransferencia(vi.fn().mockResolvedValue(undefined));
      service.errorFromProblem(montarProblem({ traceId: IDENTIFICADOR }));
      fixture.detectChanges();
      const copiar = fixture.nativeElement.querySelector('.referencia-ao-suporte button');
      copiar.click();
      await vi.advanceTimersByTimeAsync(0);
      fixture.detectChanges();
      expect(copiar.hasAttribute('aria-pressed')).toBe(false);
      const status = byTestId(fixture, 'notification-host-referencia')?.querySelector(
        '[role=status]',
      );
      expect(status?.textContent?.trim()).toBe('Copiado.');
    });

    it('orienta a copiar à mão quando a cópia é recusada', async () => {
      definirAreaDeTransferencia(vi.fn().mockRejectedValue(new Error('negado')));
      service.errorFromProblem(montarProblem());
      fixture.detectChanges();
      fixture.nativeElement.querySelector('.referencia-ao-suporte button').click();
      await vi.advanceTimersByTimeAsync(0);
      fixture.detectChanges();
      expect(textoDoBloco()).toContain('Selecione o texto e copie.');
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

  describe('permanência', () => {
    it('erro de servidor não some após o prazo padrão', () => {
      service.errorFromProblem(montarProblem({ status: 503 }));
      vi.advanceTimersByTime(60_000);
      fixture.detectChanges();
      expect(byTestId(fixture, 'notification-host-toast-error')).not.toBeNull();
    });

    it('erro 4xx com o bloco continua na tela depois de 5 s e fecha ao clicar em fechar', () => {
      service.errorFromProblem(montarProblem({ status: 404 }));
      vi.advanceTimersByTime(5000);
      fixture.detectChanges();
      expect(byTestId(fixture, 'notification-host-toast-error')).not.toBeNull();
      byTestId<HTMLButtonElement>(fixture, 'notification-host-dismiss')?.click();
      fixture.detectChanges();
      expect(byTestId(fixture, 'notification-host-toast-error')).toBeNull();
    });

    it.each(['success', 'info', 'warning', 'error'] as const)(
      'aviso de %s sem bloco some após 5 s',
      (tipo) => {
        service[tipo]('Aviso');
        vi.advanceTimersByTime(5000);
        fixture.detectChanges();
        expect(byTestId(fixture, `notification-host-toast-${tipo}`)).toBeNull();
      },
    );

    it('erro 4xx sem bloco some após 5 s', () => {
      service.errorFromProblem(montarProblem({ status: 404, code: 'ERRO 1', traceId: '' }));
      vi.advanceTimersByTime(5000);
      fixture.detectChanges();
      expect(byTestId(fixture, 'notification-host-toast-error')).toBeNull();
    });
  });

  describe('a11y', () => {
    it('section container tem role=region + aria-label', () => {
      const section = fixture.debugElement.query(By.css('section'))?.nativeElement as HTMLElement;
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
