import { VocabulariosDeConfiguracaoApi } from '@uniplus/shared-data/configuracao';
import { of } from 'rxjs';
import { ABRANGENCIAS } from './abrangencias.testing';
import { AbrangenciaCodigo } from '@uniplus/shared-data/configuracao';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { DiaNaoUtilCamposComponent } from './dia-nao-util-campos.component';
import { aplicarAbrangencia, criarGrupoDeDiaNaoUtil, type GrupoDoDia } from './dia-nao-util-form';
import { BUSCA_DE_MUNICIPIOS } from '@uniplus/shared-ui/components';
import { marcarRecusaDoServidor } from '../../shared/formulario';

describe('DiaNaoUtilCamposComponent', () => {
  let fixture: ComponentFixture<DiaNaoUtilCamposComponent>;
  let grupo: GrupoDoDia;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [DiaNaoUtilCamposComponent],
      providers: [
        { provide: BUSCA_DE_MUNICIPIOS, useValue: () => of({ ok: true, data: [] }) },
        {
          provide: VocabulariosDeConfiguracaoApi,
          useValue: { listar: () => of({ ok: true, data: Object.values(ABRANGENCIAS) }) },
        },
      ],
    });
    fixture = TestBed.createComponent(DiaNaoUtilCamposComponent);
    grupo = criarGrupoDeDiaNaoUtil();
    fixture.componentRef.setInput('grupo', grupo);
    fixture.componentRef.setInput('sufixoDeId', '3');
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
    grupo.controls.abrangencia.setValue(AbrangenciaCodigo.MUNICIPAL);
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
      'ui-valor-de-municipio input[role=combobox]',
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
    marcarRecusaDoServidor(grupo.controls.descricao, 'c', 'Descrição recusada.');
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
    expect(raiz().querySelector('ui-valor-de-municipio input[role=combobox]')).toBeNull();

    await tornarMunicipal();
    expect(campo('label[for="' + campo('input[role=combobox]').id + '"]').textContent).toContain(
      'Município',
    );
    expect(raiz().textContent).toContain('Estado para busca');

    grupo.controls.abrangencia.setValue(AbrangenciaCodigo.NACIONAL);
    aplicarAbrangencia(grupo);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(raiz().querySelector('#uf-3')).toBeNull();
    expect(raiz().querySelector('ui-valor-de-municipio input[role=combobox]')).toBeNull();
  });
});
