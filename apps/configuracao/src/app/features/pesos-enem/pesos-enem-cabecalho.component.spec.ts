import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PesosEnemCabecalhoComponent } from './pesos-enem-cabecalho.component';

describe('PesosEnemCabecalhoComponent', () => {
  let fixture: ComponentFixture<PesosEnemCabecalhoComponent>;
  const emitidos: string[] = [];

  beforeEach(() => {
    emitidos.length = 0;
    TestBed.configureTestingModule({ imports: [PesosEnemCabecalhoComponent] });
    fixture = TestBed.createComponent(PesosEnemCabecalhoComponent);
    const componente = fixture.componentInstance;
    componente.cadastrar.subscribe(() => emitidos.push('cadastrar'));
    componente.editar.subscribe(() => emitidos.push('editar'));
    componente.remover.subscribe(() => emitidos.push('remover'));
  });
  afterEach(() => TestBed.resetTestingModule());

  function montar(entradas: Record<string, unknown> = {}): void {
    const padrao = {
      resolucao: 'Res. 805/2024',
      vigente: true,
      editando: false,
      gravando: false,
      podeCadastrar: true,
    };
    for (const [nome, valor] of Object.entries({ ...padrao, ...entradas })) {
      fixture.componentRef.setInput(nome, valor);
    }
    fixture.detectChanges();
  }
  const botoes = (): HTMLButtonElement[] => [
    ...(fixture.nativeElement as HTMLElement).querySelectorAll('button'),
  ];
  const indisponivel = (botao: HTMLButtonElement): boolean =>
    botao.matches(':disabled') || botao.getAttribute('aria-disabled') === 'true';

  it('com escrita em curso, todo botão fica indisponível e nenhum clique emite', () => {
    montar({ gravando: true });

    expect(botoes()).toHaveLength(3);
    for (const botao of botoes()) {
      expect(indisponivel(botao)).toBe(true);
      botao.click();
    }
    expect(emitidos).toEqual([]);
  });

  it('sem escrita em curso, cada botão emite a sua ação', () => {
    montar();

    expect(botoes().every((botao) => !indisponivel(botao))).toBe(true);
    botoes().forEach((botao) => botao.click());
    expect(emitidos).toEqual(['cadastrar', 'editar', 'remover']);
  });

  it('sem as listas de referência, o cadastro fica indisponível e os demais não', () => {
    montar({ podeCadastrar: false });

    const [cadastrar, editar, remover] = botoes();
    expect(indisponivel(cadastrar)).toBe(true);
    expect(indisponivel(editar)).toBe(false);
    expect(indisponivel(remover)).toBe(false);
    cadastrar.click();
    expect(emitidos).toEqual([]);
  });

  it('só a resolução vigente oferece o cadastro e a anterior leva a tag correspondente', () => {
    montar({ vigente: false });

    expect(botoes()).toHaveLength(2);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Anterior');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
      'Cadastrar nova resolução',
    );
  });

  it('o botão de edição informa se a edição está aberta e o de remover nomeia a resolução', () => {
    montar({ editando: true });

    expect(botoes()[1].getAttribute('aria-expanded')).toBe('true');
    expect(botoes()[2].getAttribute('aria-label')).toBe('Remover resolução Res. 805/2024');
  });
});
