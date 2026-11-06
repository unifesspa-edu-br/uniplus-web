import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AlteracaoDoLocal } from './busca-de-municipios';
import { DiaNaoUtilCamposComponent } from './dia-nao-util-campos.component';
import { MUNICIPIO_BUSCA_VAZIA, type MunicipioBuscaState } from './calendario-dias-uteis.util';
import { aplicarAbrangencia, criarGrupoDeDiaNaoUtil, type GrupoDoDia } from './dia-nao-util-form';

describe('DiaNaoUtilCamposComponent', () => {
  let fixture: ComponentFixture<DiaNaoUtilCamposComponent>;
  let grupo: GrupoDoDia;
  let alteracoes: AlteracaoDoLocal[];

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [DiaNaoUtilCamposComponent] });
    fixture = TestBed.createComponent(DiaNaoUtilCamposComponent);
    grupo = criarGrupoDeDiaNaoUtil();
    alteracoes = [];
    fixture.componentRef.setInput('grupo', grupo);
    fixture.componentRef.setInput('sufixoDeId', '3');
    fixture.componentInstance.alteracao.subscribe((alteracao) => alteracoes.push(alteracao));
    fixture.detectChanges();
    await fixture.whenStable();
  });

  const raiz = (): HTMLElement => fixture.nativeElement;
  const campo = <T extends HTMLElement>(seletor: string): T => {
    const encontrado = raiz().querySelector<T>(seletor);
    expect(encontrado, seletor).not.toBeNull();
    return encontrado as T;
  };
  const tornarMunicipal = async (): Promise<void> => {
    grupo.controls.abrangencia.setValue('MUNICIPAL');
    aplicarAbrangencia(grupo);
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it('distingue os ids de cada dia pelo sufixo', () => {
    expect(campo('select').id).toBe('abrangencia-3');
    expect(campo('input[type="date"]').id).toBe('data-3');
    expect(campo('textarea').id).toBe('descricao-3');
  });

  it('marca como obrigatórios, para tecnologias assistivas, todos os campos que o são', async () => {
    await tornarMunicipal();

    for (const seletor of [
      '#abrangencia-3',
      '#uf-3',
      '#codigo-municipio-3',
      '#data-3',
      '#descricao-3',
    ]) {
      expect(campo(seletor).getAttribute('aria-required'), seletor).toBe('true');
    }
  });

  it('mostra o erro quando o formulário é marcado como tocado por quem hospeda, sem input novo', async () => {
    expect(raiz().querySelector('.field__error')).toBeNull();

    grupo.markAllAsTouched();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(campo('#data-3').getAttribute('aria-invalid')).toBe('true');
    expect(campo('#descricao-3').getAttribute('aria-invalid')).toBe('true');
    expect(raiz().textContent).toContain('Campo obrigatório.');
  });

  it('com o grupo já tocado, sair do campo seguinte mostra o erro dele, pois marcar de novo não emite evento', async () => {
    campo<HTMLInputElement>('#data-3').focus();
    campo<HTMLInputElement>('#data-3').blur();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(grupo.touched).toBe(true);
    expect(campo('#data-3').getAttribute('aria-invalid')).toBe('true');
    expect(campo('#descricao-3').getAttribute('aria-invalid')).toBeNull();

    campo<HTMLTextAreaElement>('#descricao-3').focus();
    campo<HTMLTextAreaElement>('#descricao-3').blur();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(campo('#descricao-3').getAttribute('aria-invalid')).toBe('true');
    expect(raiz().textContent?.match(/Campo obrigatório\./g)).toHaveLength(2);
  });

  it('mostra a recusa do servidor posta no campo por quem hospeda', async () => {
    grupo.controls.descricao.setErrors({ backend: { code: 'c', message: 'Descrição recusada.' } });
    grupo.controls.descricao.markAsTouched();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(raiz().textContent).toContain('Descrição recusada.');
  });

  it('a duplicidade informada por quem hospeda aparece na data, e some quando ela é desfeita', async () => {
    grupo.controls.data.setValue('2026-09-07');
    grupo.controls.data.markAsTouched();
    fixture.componentRef.setInput('dataDuplicada', true);
    fixture.detectChanges();

    expect(raiz().textContent).toContain('Esta data está duplicada');

    fixture.componentRef.setInput('dataDuplicada', false);
    fixture.detectChanges();

    expect(raiz().textContent).not.toContain('Esta data está duplicada');
  });

  it('só oferece a UF nas abrangências que a usam e o município na municipal', async () => {
    expect(raiz().querySelector('#uf-3')).not.toBeNull();
    expect(raiz().querySelector('#codigo-municipio-3')).toBeNull();

    await tornarMunicipal();
    expect(campo('label[for="busca-municipio-3"]').textContent).toContain('Município');
    expect(raiz().textContent).toContain('Estado para busca');

    grupo.controls.abrangencia.setValue('NACIONAL');
    aplicarAbrangencia(grupo);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(raiz().querySelector('#uf-3')).toBeNull();
    expect(raiz().querySelector('#codigo-municipio-3')).toBeNull();
  });

  it('avisa quem hospeda do que a pessoa fez com o local do dia', async () => {
    await tornarMunicipal();
    const busca = campo<HTMLInputElement>('#busca-municipio-3');

    busca.value = 'Marabá';
    busca.dispatchEvent(new Event('input'));
    campo<HTMLSelectElement>('#abrangencia-3').dispatchEvent(new Event('change'));
    campo<HTMLSelectElement>('#uf-3').dispatchEvent(new Event('change'));
    campo<HTMLSelectElement>('#codigo-municipio-3').dispatchEvent(new Event('change'));

    expect(alteracoes).toEqual([
      { tipo: 'busca', termo: 'Marabá' },
      { tipo: 'abrangencia' },
      { tipo: 'uf' },
      { tipo: 'municipio' },
    ]);
  });

  it('mostra o município escolhido, a busca sem resultado e a falha com nova tentativa', async () => {
    await tornarMunicipal();
    grupo.controls.buscaMunicipio.setValue('Zzz');
    fixture.componentRef.setInput('busca', { opcoes: [], carregando: false, erro: false });
    fixture.detectChanges();
    expect(raiz().textContent).toContain('Nenhum município encontrado para essa busca.');

    fixture.componentRef.setInput('busca', { opcoes: [], carregando: true, erro: false });
    fixture.detectChanges();
    expect(raiz().textContent).toContain('Consultando a API Geo…');

    fixture.componentRef.setInput('busca', { opcoes: [], carregando: false, erro: true });
    fixture.detectChanges();
    expect(campo('[role="alert"]').textContent).toContain('Não foi possível buscar os municípios.');
    campo<HTMLButtonElement>('ui-nova-tentativa-do-campo button').click();
    expect(alteracoes).toEqual([{ tipo: 'novaTentativa' }]);

    fixture.componentRef.setInput('busca', { opcoes: [], carregando: true, erro: false });
    fixture.detectChanges();
    expect(campo('ui-situacao-da-nova-tentativa').textContent).toBe('Recarregando municípios…');
    expect(raiz().textContent).not.toContain('Consultando a API Geo…');

    const marabá = { codigoIbge: '1504208', nome: 'Marabá', uf: 'PA' };
    fixture.componentRef.setInput('busca', { opcoes: [marabá], carregando: false, erro: false });
    grupo.controls.codigoMunicipio.setValue('1504208');
    grupo.controls.municipioNome.setValue('Marabá');
    grupo.controls.municipioUf.setValue('PA');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(raiz().textContent).toContain('Selecionado: Marabá — PA');
  });
});

@Component({
  standalone: true,
  imports: [DiaNaoUtilCamposComponent],
  template: `<cfg-dia-nao-util-campos
    [grupo]="grupo"
    sufixoDeId="3"
    [busca]="busca()"
    (alteracao)="aoAlterar($event)"
  />`,
})
class PaiDoDiaComponent {
  readonly grupo = criarGrupoDeDiaNaoUtil();
  readonly busca = signal<MunicipioBuscaState>(MUNICIPIO_BUSCA_VAZIA);

  /** Como o pai real: grava o estado da busca na hora, e o filho só o vê na atualização da tela. */
  protected aoAlterar(alteracao: AlteracaoDoLocal): void {
    if (alteracao.tipo === 'novaTentativa') {
      this.busca.set({ opcoes: [], carregando: true, erro: false });
    }
  }
}

describe('DiaNaoUtilCamposComponent — nova tentativa da busca com o pai real', () => {
  it('a busca que dá certo depois do "Tentar novamente" leva o foco ao campo de busca', async () => {
    TestBed.configureTestingModule({ imports: [PaiDoDiaComponent] });
    const fixture = TestBed.createComponent(PaiDoDiaComponent);
    const pai = fixture.componentInstance;
    pai.grupo.controls.abrangencia.setValue('MUNICIPAL');
    aplicarAbrangencia(pai.grupo);
    pai.grupo.controls.buscaMunicipio.setValue('Zzz');
    pai.busca.set({ opcoes: [], carregando: false, erro: true });
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    const tentar = raiz.querySelector('ui-nova-tentativa-do-campo button') as HTMLButtonElement;

    tentar.focus();
    tentar.click();
    await new Promise((resolver) => setTimeout(resolver));
    await fixture.whenStable();
    expect(raiz.querySelector('ui-nova-tentativa-do-campo')?.textContent).toContain(
      'Recarregando municípios…',
    );
    expect(document.activeElement).toBe(tentar);

    pai.busca.set({ opcoes: [], carregando: false, erro: false });
    await fixture.whenStable();
    await new Promise((resolver) => setTimeout(resolver));
    await fixture.whenStable();

    expect(raiz.querySelector('ui-nova-tentativa-do-campo')).toBeNull();
    expect(document.activeElement).toBe(raiz.querySelector('#busca-municipio-3'));
  });
});
