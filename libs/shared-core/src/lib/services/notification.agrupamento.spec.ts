import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationService } from './notification.service';

describe('NotificationService: avisos repetidos e anúncio', () => {
  let service: NotificationService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({});
    service = TestBed.inject(NotificationService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('repetição de aviso com prazo recomeça os 5 s e mantém o id', () => {
    const id = service.info('Salvo');
    vi.advanceTimersByTime(4000);
    expect(service.info('Salvo')).toBe(id);
    vi.advanceTimersByTime(4000);
    expect(service.notifications()).toHaveLength(1);
    expect(service.notifications()[0].ocorrencias).toBe(2);
    vi.advanceTimersByTime(1000);
    expect(service.notifications()).toHaveLength(0);
  });

  it('aviso fixo nunca expira, mesmo repetido', () => {
    service.error('Falha', undefined, { persistent: true });
    service.error('Falha', undefined, { persistent: true });
    vi.advanceTimersByTime(600_000);
    expect(service.notifications()).toHaveLength(1);
  });

  it('20 avisos fixos distintos permanecem', () => {
    for (let i = 0; i < 20; i++) service.error(`Falha ${i}`, undefined, { persistent: true });
    vi.advanceTimersByTime(600_000);
    expect(service.notifications()).toHaveLength(20);
  });

  it('dismiss do aviso agrupado remove o grupo inteiro', () => {
    const id = service.error('Falha', undefined, { persistent: true });
    service.error('Falha', undefined, { persistent: true });
    service.dismiss(id);
    expect(service.notifications()).toHaveLength(0);
  });

  it('anuncia título e detalhe do aviso novo; erro e alerta são assertivos', () => {
    expect(service.anuncios()).toEqual([]);
    service.warning('Atenção', 'Verifique.');
    service.success('Salvo');
    expect(service.anuncios()).toEqual([
      { texto: 'Atenção Verifique.', assertivo: true, sequencia: 1 },
      { texto: 'Salvo', assertivo: false, sequencia: 2 },
    ]);
  });

  it('na repetição anuncia só o título com a contagem, e a sequência cresce', () => {
    service.error('Falha', 'detalhe', { persistent: true });
    service.error('Falha', 'outro detalhe', { persistent: true });
    service.error('Falha', 'mais um', { persistent: true });
    expect(service.anuncios().at(-1)).toEqual({
      texto: 'Repetido 3 vezes: Falha',
      assertivo: true,
      sequencia: 3,
    });
  });

  it('guarda só os 20 últimos anúncios, em ordem', () => {
    for (let i = 1; i <= 22; i++) service.info(`Aviso ${i}`, undefined, { persistent: true });
    const janela = service.anuncios();
    expect(janela.map((a) => a.sequencia)).toEqual(Array.from({ length: 20 }, (_, i) => i + 3));
    expect(janela[0].texto).toBe('Aviso 3');
  });
});
