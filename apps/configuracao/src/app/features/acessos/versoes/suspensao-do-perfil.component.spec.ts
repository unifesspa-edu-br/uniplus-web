import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { SuspensaoDoPerfilDto } from '@uniplus/shared-data/autorizacao';
import { beforeEach, describe, expect, it } from 'vitest';
import { SuspensaoDoPerfilComponent } from './suspensao-do-perfil.component';

const SUSPENSAO: SuspensaoDoPerfilDto = {
  desde: '2026-11-09T15:00:00Z',
  papelDeQuemSuspendeu: 'protecao_de_dados',
  etapasExigidasAgora: ['gestao_de_acessos', 'protecao_de_dados'],
  etapasDecididas: ['gestao_de_acessos'],
};

describe('SuspensaoDoPerfilComponent', () => {
  let fixture: ComponentFixture<SuspensaoDoPerfilComponent>;

  beforeEach(() => {
    fixture = TestBed.createComponent(SuspensaoDoPerfilComponent);
  });

  function abrir(suspensao: SuspensaoDoPerfilDto): string {
    fixture.componentRef.setInput('suspensao', suspensao);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ') ?? '';
  }

  it('diz desde quando, quem determinou e o que cada etapa exigida já decidiu', () => {
    const texto = abrir(SUSPENSAO);

    expect(texto).toContain('Desde 09/11/2026');
    expect(texto).toContain('por proteção de dados');
    expect(texto).toContain('Retomada pela gestão de acessos: decidida');
    expect(texto).toContain('Retomada pela proteção de dados: aguarda a decisão');
  });

  it('lista só as etapas exigidas agora', () => {
    const texto = abrir({
      ...SUSPENSAO,
      etapasExigidasAgora: ['gestao_de_acessos'],
      etapasDecididas: [],
    });

    expect(texto).toContain('Retomada pela gestão de acessos: aguarda a decisão');
    expect(texto).not.toContain('Retomada pela proteção de dados');
  });
});
