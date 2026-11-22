import { ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { EscolhaComExplicacaoComponent } from './escolha-com-explicacao';
import {
  type EntradasDaEscolha,
  OPCOES,
  RECUSA,
  aplicar,
  montar,
} from './escolha-com-explicacao.testing';

const NOTA = 'Você alterou esta parte depois desta recusa.';

describe('EscolhaComExplicacaoComponent: recusas do campo', () => {
  let fixture: ComponentFixture<EscolhaComExplicacaoComponent>;
  let host: HTMLElement;

  beforeEach(() => {
    fixture = montar();
    host = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => fixture.nativeElement.remove());

  const grupo = (): HTMLElement => host.querySelector('fieldset') as HTMLElement;
  const campos = (): HTMLInputElement[] => Array.from(host.querySelectorAll('input[type="radio"]'));
  const campo = (codigo: string): HTMLInputElement =>
    host.querySelector(`#grupo-opcao-${codigo}`) as HTMLInputElement;
  const texto = (id: string): string =>
    host.querySelector(`[id="${id}"]`)?.textContent?.trim() ?? '';
  const descritoPor = (elemento: Element): string[] =>
    (elemento.getAttribute('aria-describedby') ?? '').split(' ').filter((id) => id);
  const recusasDe = (elemento: Element): string[] =>
    descritoPor(elemento).filter((id) => id.includes('-recusa-') || id.includes('-a-conferir-'));

  describe('aria-invalid acompanha a recusa que ainda vale', () => {
    it.each<[string, Partial<EntradasDaEscolha>, boolean]>([
      ['sem erro nenhum', {}, false],
      ['só com recusa da API', { recusas: [RECUSA] }, true],
      ['só com recusa a conferir', { recusasAConferir: [RECUSA] }, false],
    ])('%s', (_nome, entradas, invalido) => {
      aplicar(fixture, { opcoes: OPCOES, ...entradas });

      const marcados = [grupo(), ...campos()].map((e) => e.getAttribute('aria-invalid'));
      expect(marcados).toEqual(Array(4).fill(invalido ? 'true' : null));
    });
  });

  describe('as recusas pertencem ao campo inteiro', () => {
    it('a recusa descreve o grupo e nenhuma opção', () => {
      aplicar(fixture, { opcoes: OPCOES, recusas: [RECUSA] });

      expect(texto('grupo-recusa-uniplus.selecao.exemplo.escolha_obrigatoria')).toContain(
        RECUSA.mensagem,
      );
      expect(recusasDe(grupo())).toHaveLength(1);
      expect(campos().flatMap(recusasDe)).toEqual([]);
    });

    it('as recusas ficam depois das opções, dentro do grupo', () => {
      aplicar(fixture, { opcoes: OPCOES, recusas: [RECUSA] });

      const recusa = host.querySelector(
        '[id="grupo-recusa-uniplus.selecao.exemplo.escolha_obrigatoria"]',
      );
      expect(grupo().contains(recusa)).toBe(true);
      const ultimaOpcao = campo('DECIDE');
      expect(ultimaOpcao.compareDocumentPosition(recusa as Node)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
    });

    it('recusas de mesmo código ganham identificadores diferentes, todos presentes', () => {
      aplicar(fixture, { opcoes: OPCOES, recusas: [RECUSA, { ...RECUSA, mensagem: 'Outra.' }] });

      const ids = recusasDe(grupo());
      expect(new Set(ids).size).toBe(2);
      expect(ids.map((id) => texto(id))).toEqual([
        expect.stringContaining(RECUSA.mensagem),
        expect.stringContaining('Outra.'),
      ]);
    });

    it('o identificador numerado de uma recusa não repete o de outra de código parecido', () => {
      const comCodigo = (codigo: string) => ({ ...RECUSA, codigo, mensagem: `Recusa ${codigo}.` });
      aplicar(fixture, {
        opcoes: OPCOES,
        recusas: [comCodigo('erro'), comCodigo('erro'), comCodigo('erro-2')],
      });

      const ids = recusasDe(grupo());
      expect(new Set(ids).size).toBe(3);
      expect(ids.map((id) => host.querySelectorAll(`[id="${id}"]`).length)).toEqual([1, 1, 1]);
    });

    it('o parágrafo de situação é descrito pelas recusas do campo', () => {
      aplicar(fixture, { opcoes: [], recusas: [RECUSA] });

      const situacao = host.querySelector('#grupo-situacao') as HTMLElement;
      expect(descritoPor(situacao)).toEqual(descritoPor(grupo()));
      expect(descritoPor(situacao)).toHaveLength(1);
    });

    it('descreve a opção só pela instrução e pela própria explicação, e o grupo pelas recusas e pela nota', () => {
      aplicar(fixture, {
        opcoes: OPCOES,
        instrucao: 'Escolha uma opção.',
        recusas: [RECUSA],
        recusasAConferir: [{ ...RECUSA, codigo: 'outra' }],
        notaDasRecusasAConferir: NOTA,
      });

      expect(descritoPor(campo('NENHUM'))).toEqual(['grupo-instrucao', 'grupo-explicacao-NENHUM']);
      expect(descritoPor(grupo())).toEqual([
        `grupo-recusa-${RECUSA.codigo}`,
        'grupo-a-conferir-outra',
        'grupo-nota-das-recusas-a-conferir',
      ]);
    });

    it('só cita o que existe na tela', () => {
      aplicar(fixture, {
        opcoes: OPCOES,
        recusas: [RECUSA],
        recusasAConferir: [{ ...RECUSA, codigo: 'outra' }],
        notaDasRecusasAConferir: NOTA,
      });

      const citados = [grupo(), ...campos()].flatMap(descritoPor);
      expect(citados.every((id) => host.querySelector(`[id="${id}"]`) !== null)).toBe(true);
    });

    it('a recusa que sai deixa de ser citada e a que fica mantém o mesmo elemento', () => {
      const outra = { ...RECUSA, codigo: 'outra' };
      aplicar(fixture, { opcoes: OPCOES, recusas: [RECUSA, outra] });
      const daOutra = host.querySelector('[id="grupo-recusa-outra"]');

      aplicar(fixture, { recusas: [outra] });

      expect(descritoPor(grupo())).toEqual(['grupo-recusa-outra']);
      expect(host.querySelector(`[id="grupo-recusa-${RECUSA.codigo}"]`)).toBeNull();
      expect(host.querySelector('[id="grupo-recusa-outra"]')).toBe(daOutra);
    });
  });

  describe('recusas a conferir', () => {
    it('ficam à vista com a nota e não marcam o campo como inválido', () => {
      aplicar(fixture, {
        opcoes: OPCOES,
        recusasAConferir: [RECUSA],
        notaDasRecusasAConferir: NOTA,
      });

      expect(texto('grupo-a-conferir-uniplus.selecao.exemplo.escolha_obrigatoria')).toContain(
        RECUSA.mensagem,
      );
      expect(texto('grupo-nota-das-recusas-a-conferir')).toBe(NOTA);
      expect([grupo(), ...campos()].some((e) => e.hasAttribute('aria-invalid'))).toBe(false);
    });

    it('a recusa a conferir do campo e a nota descrevem o grupo', () => {
      aplicar(fixture, {
        opcoes: OPCOES,
        recusasAConferir: [RECUSA],
        notaDasRecusasAConferir: NOTA,
      });

      expect(descritoPor(grupo())).toEqual([
        'grupo-a-conferir-uniplus.selecao.exemplo.escolha_obrigatoria',
        'grupo-nota-das-recusas-a-conferir',
      ]);
    });

    it('sem nota informada, não cria o parágrafo nem o cita', () => {
      aplicar(fixture, { opcoes: OPCOES, recusasAConferir: [RECUSA] });

      expect(host.querySelector('#grupo-nota-das-recusas-a-conferir')).toBeNull();
      expect(descritoPor(grupo())).toHaveLength(1);
    });

    it('sem recusa a conferir, a nota informada não aparece', () => {
      aplicar(fixture, { opcoes: OPCOES, notaDasRecusasAConferir: NOTA });

      expect(host.querySelector('#grupo-nota-das-recusas-a-conferir')).toBeNull();
    });
  });

  it('sem recusas nem erro, não cria os blocos delas', () => {
    aplicar(fixture, { opcoes: OPCOES });

    expect(host.querySelector('ui-recusa-do-campo, #grupo-erro')).toBeNull();
  });
});
