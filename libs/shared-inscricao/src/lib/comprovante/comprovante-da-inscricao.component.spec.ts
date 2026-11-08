import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import type { ComprovanteDaInscricaoDto } from '@uniplus/shared-data/selecao';
import { cpfRevelavel } from '@uniplus/shared-utils';

import { ComprovanteDaInscricaoComponent } from './comprovante-da-inscricao.component';

const FUSO = { id: 'America/Belem', nome: 'Belém (PA)' };

/** O envio 2 de 2 (o que vale) de Fernanda Drumond, persona fictícia do portal de documentação. */
function comprovanteBase(): ComprovanteDaInscricaoDto {
  return {
    inscricaoId: '0199e000-0000-7000-8000-0000000000e1',
    numero: 2,
    total: 2,
    vale: true,
    numeroAnterior: 1,
    numeroSeguinte: null,
    processoSeletivoId: '0199e000-0000-7000-8000-0000000000d1',
    nomeDoProcesso: 'Medicina 2027',
    identificadorDoProcesso: 'Edital 001/2026',
    unidadeAdministradora: 'Centro de Processos Seletivos',
    envio: {
      numeroInscricao: '2027-000042',
      enviadoEm: '2026-12-11T13:30:00Z',
      fusoHorario: FUSO,
      hashIntegridade: 'a'.repeat(64),
    },
    candidato: {
      nomeCivil: 'Fernanda Laura Nicole Drumond',
      nomeSocial: null,
      usaNomeSocial: false,
      cpfMascarado: '***.598.363-**',
    },
    prazoDaCorrecao: { fim: '2026-12-20T02:59:00Z', fusoHorario: FUSO, aberto: true },
    numeroDeOpcoesDeCurso: 1,
    opcoesDeCurso: [{ ordem: 1, nome: 'Direito — Campus Marabá', modalidades: null }],
    secoes: [],
    derivados: [],
    termosAceitos: [],
    documentos: [],
  };
}

@Component({
  standalone: true,
  imports: [ComprovanteDaInscricaoComponent],
  template: `
    <insc-comprovante-da-inscricao
      [comprovante]="comprovante()"
      [cpf]="cpf()"
      [rotaDoEnvio]="rotaDoEnvio"
    >
      <a inscAcaoDaCorrecao href="#corrigir">Corrigir dados</a>
    </insc-comprovante-da-inscricao>
  `,
})
class Hospedeiro {
  readonly comprovante = signal(comprovanteBase());
  readonly cpf = signal<ReturnType<typeof cpfRevelavel> | null>(null);
  readonly rotaDoEnvio = (numero: number): readonly unknown[] => ['/envio', numero];
}

function montar(alteracoes: Partial<ComprovanteDaInscricaoDto> = {}) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(Hospedeiro);
  fixture.componentInstance.comprovante.set({ ...comprovanteBase(), ...alteracoes });
  fixture.detectChanges();
  return { fixture, tela: fixture.nativeElement as HTMLElement };
}

describe('ComprovanteDaInscricaoComponent', () => {
  it('mostra o processo, o número da inscrição e o instante do envio no fuso da API', () => {
    const { tela } = montar();
    const texto = tela.textContent ?? '';

    expect(texto).toContain('Medicina 2027');
    expect(texto).toContain('Processo Edital 001/2026');
    expect(texto).toContain('2027-000042');
    expect(texto).toContain('horário de Belém (PA)');
  });

  it('o host contribui as seções ao corpo do documento', () => {
    const { tela } = montar();

    expect(tela.querySelector('insc-comprovante-da-inscricao')?.classList).toContain(
      'documento__fragmento',
    );
  });

  it('liga o envio anterior pela rota recebida e não mostra o seguinte quando não há', () => {
    const { tela } = montar();
    const links = [...tela.querySelectorAll('nav a')].map((a) => a.getAttribute('href'));

    expect(links).toEqual(['/envio/1']);
  });

  it('mostra o CPF mascarado da API sem o revelável', () => {
    const { tela } = montar();

    expect(tela.textContent).toContain('***.598.363-**');
    expect(tela.querySelector('ui-dado-revelavel')).toBeNull();
  });

  it('com o CPF revelável, usa o componente que deixa o titular conferir', () => {
    const { fixture, tela } = montar();
    fixture.componentInstance.cpf.set(cpfRevelavel('69959836371'));
    fixture.detectChanges();

    expect(tela.querySelector('ui-dado-revelavel')).not.toBeNull();
  });

  it('projeta a ação da correção só com o prazo aberto', () => {
    const aberto = montar();
    expect(aberto.tela.querySelector('[inscAcaoDaCorrecao]')).not.toBeNull();
    TestBed.resetTestingModule();

    const fechado = montar({
      prazoDaCorrecao: { fim: '2026-12-20T02:59:00Z', fusoHorario: FUSO, aberto: false },
    });
    expect(fechado.tela.textContent).toContain('Não é mais possível corrigir esta inscrição.');
    expect(fechado.tela.querySelector('[inscAcaoDaCorrecao]')).toBeNull();
  });
});
