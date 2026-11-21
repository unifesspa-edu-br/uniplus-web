import { HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../processo-seletivo.store';
import { AtendimentoPassoComponent } from './atendimento.component';
import {
  CONDICOES,
  OUTRA_CONDICAO_ID,
  PCD_ID,
  RECURSO_ID,
  ROTA_ATENDIMENTO,
  TIPOS_DEFICIENCIA,
  montarPassoDeAtendimento,
} from './atendimento.component.testing';

describe('AtendimentoPassoComponent — validação e seleção em massa', () => {
  let componente: AtendimentoPassoComponent;
  let fixture: ComponentFixture<AtendimentoPassoComponent>;
  let store: ProcessoSeletivoStore;
  let controller: HttpTestingController;
  let elemento: HTMLElement;
  let detectar: () => void;

  beforeEach(async () => {
    ({ fixture, store, controller } = await montarPassoDeAtendimento());
    componente = fixture.componentInstance;
    elemento = fixture.nativeElement as HTMLElement;
    detectar = () => fixture.detectChanges();
  });

  afterEach(() => controller.verify());

  /**
   * O `DefinirAtendimentoEspecializadoCommandHandler`
   * resolve cada id no cadastro vivo e recusa com 422 quando uma referência
   * já saiu de lá — sem este diagnóstico local, "Gravar e avançar" falharia
   * sempre que o rascunho guardasse uma referência removida, e nada na tela
   * apontaria qual item é a causa.
   */
  it('recusa validar com referência removida marcada, nomeando o item, sem chamar o servidor', async () => {
    store.patchObjectSection('atendimento', {
      recursos: [{ id: 'id-antigo', nome: 'Recurso descontinuado' }],
    });
    detectar();

    const resultado = componente.validar();

    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.some((m) => m.includes('Recurso descontinuado'))).toBe(true);

    const gravacao = await componente.persistir();
    expect(gravacao.valid).toBe(false);
    controller.expectNone(ROTA_ATENDIMENTO);
  });

  /** As três listas acumulam pendências — não é só a primeira encontrada. */
  it('nomeia todas as referências removidas de uma vez, em mais de uma lista', () => {
    store.patchObjectSection('atendimento', {
      condicoes: [{ id: 'id-antigo-lact', codigo: 'LACTANTE', nome: 'Lactante (antiga)' }],
      recursos: [
        { id: 'id-antigo-r1', nome: 'Recurso A' },
        { id: 'id-antigo-r2', nome: 'Recurso B' },
      ],
    });
    detectar();

    const resultado = componente.validar();

    expect(resultado.valid).toBe(false);
    expect(resultado.messages?.some((m) => m.includes('Lactante (antiga)'))).toBe(true);
    expect(
      resultado.messages?.some((m) => m.includes('Recurso A') && m.includes('Recurso B')),
    ).toBe(true);
  });

  it('marca a condição pelo checkbox real da tela, no DOM', () => {
    const checkbox = Array.from(
      elemento.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>,
    ).find((input) => input.closest('label')?.textContent?.includes('Pessoa com deficiência'));
    if (checkbox === undefined) throw new Error('Checkbox da condição PcD não encontrado.');

    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    detectar();

    expect(store.draft().atendimento.condicoes.map((item) => item.id)).toContain(PCD_ID);
  });

  // ── "Marcar todas" ───────────────────────────────────────────────

  function marcarTodasCheckbox(): HTMLInputElement {
    const checkbox = Array.from(
      elemento.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>,
    ).find((input) => input.closest('label')?.textContent?.includes('Marcar todas as'));
    if (checkbox === undefined)
      throw new Error('Checkbox "Marcar todas" (condições) não encontrado.');
    return checkbox;
  }

  function marcarTodosCheckbox(): HTMLInputElement {
    const checkbox = Array.from(
      elemento.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>,
    ).find((input) => input.closest('label')?.textContent?.includes('Marcar todos os'));
    if (checkbox === undefined)
      throw new Error('Checkbox "Marcar todos" (recursos) não encontrado.');
    return checkbox;
  }

  it('marca todas as condições ativas pelo checkbox real da tela', () => {
    const checkbox = marcarTodasCheckbox();
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    detectar();

    expect(
      store
        .draft()
        .atendimento.condicoes.map((item) => item.id)
        .sort(),
    ).toEqual([PCD_ID, OUTRA_CONDICAO_ID].sort());
  });

  it('marca todos os recursos ativos pelo checkbox real da tela', () => {
    const checkbox = marcarTodosCheckbox();
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    detectar();

    expect(store.draft().atendimento.recursos).toEqual([{ id: RECURSO_ID, nome: 'Ledor' }]);
  });

  it('desmarca todas as condições ativas em uma única ação quando todas estão marcadas', () => {
    componente.marcarTodasAsCondicoes(true);
    detectar();
    expect(componente.todasAsCondicoesSelecionadas()).toBe(true);

    componente.marcarTodasAsCondicoes(false);
    detectar();

    expect(store.draft().atendimento.condicoes).toEqual([]);
  });

  it('apresenta estado indeterminado quando só parte das condições ativas está marcada', () => {
    componente.toggleCondicao(CONDICOES[0], true);
    detectar();

    expect(componente.condicoesParcialmenteSelecionadas()).toBe(true);
    expect(componente.todasAsCondicoesSelecionadas()).toBe(false);
    expect(marcarTodasCheckbox().indeterminate).toBe(true);
  });

  it('sincroniza "Marcar todas" ao marcar cada condição ativa individualmente', () => {
    componente.toggleCondicao(CONDICOES[0], true);
    detectar();
    expect(componente.todasAsCondicoesSelecionadas()).toBe(false);

    componente.toggleCondicao(CONDICOES[1], true);
    detectar();

    expect(componente.todasAsCondicoesSelecionadas()).toBe(true);
    expect(componente.condicoesParcialmenteSelecionadas()).toBe(false);
    expect(marcarTodasCheckbox().checked).toBe(true);
  });

  it('preserva referência removida ao marcar e ao desmarcar todas as condições', () => {
    store.patchObjectSection('atendimento', {
      condicoes: [{ id: 'id-antigo-lact', codigo: 'LACTANTE', nome: 'Lactante (antiga)' }],
    });
    detectar();

    componente.marcarTodasAsCondicoes(true);
    detectar();
    expect(store.draft().atendimento.condicoes.map((item) => item.id)).toContain('id-antigo-lact');

    componente.marcarTodasAsCondicoes(false);
    detectar();

    expect(store.draft().atendimento.condicoes).toEqual([
      { id: 'id-antigo-lact', codigo: 'LACTANTE', nome: 'Lactante (antiga)' },
    ]);
  });

  it('preserva referência removida ao marcar e ao desmarcar todos os recursos', () => {
    store.patchObjectSection('atendimento', {
      recursos: [{ id: 'id-antigo', nome: 'Recurso descontinuado' }],
    });
    detectar();

    componente.marcarTodosOsRecursos(true);
    detectar();
    expect(store.draft().atendimento.recursos.map((item) => item.id)).toContain('id-antigo');

    componente.marcarTodosOsRecursos(false);
    detectar();

    expect(store.draft().atendimento.recursos).toEqual([
      { id: 'id-antigo', nome: 'Recurso descontinuado' },
    ]);
  });

  it('marcar todas as condições esvazia os tipos de deficiência se, ao desmarcar, nenhuma PcD restar', () => {
    componente.toggleCondicao(CONDICOES[0], true);
    componente.toggleTipoDeficiencia(TIPOS_DEFICIENCIA[0], true);
    detectar();

    componente.marcarTodasAsCondicoes(false);
    detectar();

    expect(store.draft().atendimento.condicoes).toEqual([]);
    expect(store.draft().atendimento.tiposDeficiencia).toEqual([]);
  });

  it('os checkboxes "Marcar todas"/"Marcar todos" ficam desabilitados enquanto o catálogo carrega ou falha', () => {
    componente.catalogos.carregando.set(true);
    detectar();
    expect(marcarTodasCheckbox().disabled).toBe(true);
    expect(marcarTodosCheckbox().disabled).toBe(true);

    componente.catalogos.carregando.set(false);
    componente.catalogos.erro.set('Não foi possível carregar os catálogos.');
    detectar();
    expect(marcarTodasCheckbox().disabled).toBe(true);
    expect(marcarTodosCheckbox().disabled).toBe(true);

    componente.catalogos.erro.set(null);
    detectar();
    expect(marcarTodasCheckbox().disabled).toBe(false);
    expect(marcarTodosCheckbox().disabled).toBe(false);
  });

  it('cada checkbox "Marcar todas"/"Marcar todos" nomeia a seção correspondente', () => {
    expect(marcarTodasCheckbox().closest('label')?.textContent).toContain('condições aceitas');
    expect(marcarTodosCheckbox().closest('label')?.textContent).toContain(
      'recursos de acessibilidade',
    );
  });
});
