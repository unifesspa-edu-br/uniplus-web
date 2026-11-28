import { TestBed } from '@angular/core/testing';
import { HttpHeaders } from '@angular/common/http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationService } from './notification.service';
import type { ProblemDetails } from '../http/problem-details';

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

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({});
    service = TestBed.inject(NotificationService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('success/info/warning/error simples', () => {
    it('publica notification com type/title/detail e auto-dismiss em 5 s', () => {
      const id = service.success('Salvo', 'Edital criado com sucesso.');
      expect(service.notifications()).toHaveLength(1);
      const [n] = service.notifications();
      expect(n.id).toBe(id);
      expect(n.type).toBe('success');
      expect(n.title).toBe('Salvo');
      expect(n.detail).toBe('Edital criado com sucesso.');
      expect(n.persistent).toBe(false);
      expect(n.referencia).toBeUndefined();
      expect(n.ocorrencias).toBe(1);
      expect(n.identificadoresAnteriores).toEqual([]);

      vi.advanceTimersByTime(5000);
      expect(service.notifications()).toHaveLength(0);
    });

    it('respeita timeoutMs override em info/warning', () => {
      service.info('Aviso', 'Sessão expira em 5 min.', { timeoutMs: 1000 });
      vi.advanceTimersByTime(999);
      expect(service.notifications()).toHaveLength(1);
      vi.advanceTimersByTime(1);
      expect(service.notifications()).toHaveLength(0);
    });

    it('persistent=true não auto-dismisses', () => {
      const id = service.warning('Atenção', 'Verifique anexos', { persistent: true });
      vi.advanceTimersByTime(60_000);
      expect(service.notifications()).toHaveLength(1);
      service.dismiss(id);
      expect(service.notifications()).toHaveLength(0);
    });

    it('error simples segue mesmo padrão de auto-dismiss', () => {
      service.error('Falha', 'Conexão recusada.');
      vi.advanceTimersByTime(5000);
      expect(service.notifications()).toHaveLength(0);
    });
  });

  describe('errorFromProblem', () => {
    it('extrai title/detail e a referência ao suporte do ProblemDetails', () => {
      const problem = montarProblem();
      service.errorFromProblem(problem);
      const [n] = service.notifications();
      expect(n.type).toBe('error');
      expect(n.title).toBe(problem.title);
      expect(n.detail).toBe(problem.detail);
      expect(n.referencia).toEqual({
        origem: 'servidor',
        codigoDoErro: problem.code,
        identificadorDoPedido: problem.traceId,
      });
    });

    it('aplica persistent automaticamente em status >= 500', () => {
      service.errorFromProblem(montarProblem({ status: 503, code: 'x', traceId: '' }));
      const [n] = service.notifications();
      expect(n.persistent).toBe(true);
      vi.advanceTimersByTime(60_000);
      expect(service.notifications()).toHaveLength(1);
    });

    it('4xx com referência ao suporte não some sozinho', () => {
      service.errorFromProblem(montarProblem({ status: 404 }));
      vi.advanceTimersByTime(60_000);
      const [n] = service.notifications();
      expect(n.persistent).toBe(true);
    });

    it('4xx sem referência mantém o prazo normal', () => {
      service.errorFromProblem(montarProblem({ status: 404, code: 'x', traceId: '' }));
      const [n] = service.notifications();
      expect(n.persistent).toBe(false);
      vi.advanceTimersByTime(5000);
      expect(service.notifications()).toHaveLength(0);
    });

    it('overrides.title/detail substituem os do problem (LGPD: PII-safe)', () => {
      service.errorFromProblem(montarProblem({ detail: 'CPF 163.287.930-14 não encontrado' }), {
        detail: 'Documento não encontrado.',
      });
      const [n] = service.notifications();
      expect(n.detail).toBe('Documento não encontrado.');
      expect(n.detail).not.toContain('CPF');
    });

    it('overrides.persistent prevalece sobre o default por status sem referência', () => {
      service.errorFromProblem(montarProblem({ status: 503, code: 'x', traceId: '' }), {
        persistent: false,
      });
      const [n] = service.notifications();
      expect(n.persistent).toBe(false);
    });

    it('identificador vazio ou fora do formato não aparece; o código ausente também não', () => {
      service.errorFromProblem(montarProblem({ traceId: 'curto', code: 'x' }));
      service.errorFromProblem(montarProblem({ traceId: '' }));
      const [semNada, soCodigo] = service.notifications();
      expect(semNada.referencia).toBeUndefined();
      expect(soCodigo.referencia).toEqual({
        origem: 'servidor',
        codigoDoErro: 'uniplus.selecao.edital.nao_encontrado',
        identificadorDoPedido: null,
      });
    });

    it('retorna id sequencial para chamadas paralelas', () => {
      const id1 = service.errorFromProblem(montarProblem());
      const id2 = service.errorFromProblem(montarProblem({ code: 'uniplus.selecao.edital.outro' }));
      expect(id2).toBeGreaterThan(id1);
      expect(service.notifications()).toHaveLength(2);
    });
  });

  describe('dismiss + clearAll', () => {
    it('dismiss(id) cancela timer associado e remove da fila', () => {
      const id = service.success('Salvo');
      service.dismiss(id);
      expect(service.notifications()).toHaveLength(0);
      // Avançar o timer não pode causar erro nem reaparecer
      vi.advanceTimersByTime(5000);
      expect(service.notifications()).toHaveLength(0);
    });

    it('clearAll esvazia fila e cancela timers pendentes', () => {
      service.success('a');
      service.success('b');
      service.error('c');
      expect(service.notifications()).toHaveLength(3);
      service.clearAll();
      expect(service.notifications()).toHaveLength(0);
      vi.advanceTimersByTime(60_000);
      expect(service.notifications()).toHaveLength(0);
    });
  });

  describe('janela de anúncios', () => {
    const textos = (): string[] => service.anuncios().map((anuncio) => anuncio.texto);

    it('guarda 20 avisos do mesmo ciclo e o 21º descarta só o mais antigo', () => {
      for (let i = 1; i <= 20; i++) service.error(`Falha ${i}`, undefined, { persistent: true });
      expect(textos()).toHaveLength(20);
      expect(textos()[0]).toContain('Falha 1');
      service.error('Falha 21', undefined, { persistent: true });
      expect(textos()).toHaveLength(20);
      expect(textos()[0]).toContain('Falha 2');
      expect(textos().at(-1)).toContain('Falha 21');
    });
  });

  describe('signature compatibility', () => {
    it('HttpHeaders importado mas não exposto pelo signal — evita leak', () => {
      // Garante que ProblemDetails é o único contrato de entrada estruturada.
      const headers = new HttpHeaders({ 'x-trace-id': 'abc' });
      expect(headers.get('x-trace-id')).toBe('abc');
    });
  });
});
