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
    expect(texto).toContain('por decisão do Representante do controlador');
    expect(texto).toContain('Retomada pela gestão de acessos: decidida');
    expect(texto).toContain('Retomada pelo Representante do controlador: aguarda a decisão');
  });

  it('mantém a etapa já decidida que deixou de ser exigida, dizendo que não é mais exigida', () => {
    const texto = abrir({
      ...SUSPENSAO,
      etapasExigidasAgora: ['gestao_de_acessos'],
      etapasDecididas: ['protecao_de_dados'],
    });

    expect(texto).toContain('Retomada pela gestão de acessos: aguarda a decisão');
    expect(texto).toContain('Retomada pelo Representante do controlador: decidida; não é mais exigida');
  });

  it('não repete a etapa exigida e decidida entre as dispensadas', () => {
    const texto = abrir(SUSPENSAO);

    expect(texto.match(/Retomada pela gestão de acessos/g)).toHaveLength(1);
    expect(texto).not.toContain('não é mais exigida');
  });
});
