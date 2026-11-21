import { ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { EscolhaComExplicacaoComponent } from './escolha-com-explicacao';
import {
  type EntradasDaEscolha,
  OPCOES,
  RECUSA,
  aplicar,
  montar,
  recusaDaOpcao,
} from './escolha-com-explicacao.testing';

const NOTA = 'Você alterou esta parte depois desta recusa.';

describe('EscolhaComExplicacaoComponent: recusas e erro do campo', () => {
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
  const texto = (id: string): string => host.querySelector(`[id="${id}"]`)?.textContent?.trim() ?? '';
  const descritoPor = (elemento: Element): string[] =>
    (elemento.getAttribute('aria-describedby') ?? '').split(' ').filter((id) => id);
  const recusasDe = (elemento: Element): string[] =>
    descritoPor(elemento).filter((id) => id.includes('-recusa-') || id.includes('-a-conferir-'));

  describe('aria-invalid acompanha o erro visível do campo', () => {
    it.each<[string, Partial<EntradasDaEscolha>, boolean]>([
      ['sem erro nenhum', {}, false],
      ['só com erro local', { erroLocal: 'Escolha uma opção.' }, true],
      ['só com recusa da API', { recusas: [RECUSA] }, true],
      ['com erro local e recusa da API', { erroLocal: 'Escolha.', recusas: [RECUSA] }, true],
      ['com recusa de uma opção', { recusas: [recusaDaOpcao('NENHUM')] }, true],
      ['com erro local vazio', { erroLocal: '' }, false],
      ['só com recusa a conferir', { recusasAConferir: [RECUSA] }, false],
    ])('%s', (_nome, entradas, invalido) => {
      aplicar(fixture, { opcoes: OPCOES, ...entradas });

      const marcados = [grupo(), ...campos()].map((e) => e.getAttribute('aria-invalid'));
      expect(marcados).toEqual(Array(4).fill(invalido ? 'true' : null));
    });

    it('o erro local fica à vista e descreve o grupo, não cada opção', () => {
      aplicar(fixture, { opcoes: OPCOES, erroLocal: 'Escolha uma opção.' });

      expect(texto('grupo-erro')).toBe('Escolha uma opção.');
      expect(descritoPor(grupo())).toEqual(['grupo-erro']);
      expect(campos().some((c) => descritoPor(c).includes('grupo-erro'))).toBe(false);
    });

    it('sai a marca quando o erro some', () => {
      aplicar(fixture, { opcoes: OPCOES, erroLocal: 'Escolha uma opção.' });

      aplicar(fixture, { erroLocal: null });

      expect(grupo().hasAttribute('aria-invalid')).toBe(false);
      expect(host.querySelector('#grupo-erro')).toBeNull();
      expect(grupo().hasAttribute('aria-describedby')).toBe(false);
    });
  });

  describe('cada recusa descreve só o elemento a que pertence', () => {
    it('a recusa do campo descreve o grupo e nenhuma opção', () => {
      aplicar(fixture, { opcoes: OPCOES, recusas: [RECUSA] });

      expect(texto('grupo-recusa-uniplus.selecao.exemplo.escolha_obrigatoria')).toContain(
        RECUSA.mensagem,
      );
      expect(recusasDe(grupo())).toHaveLength(1);
      expect(campos().flatMap(recusasDe)).toEqual([]);
    });

    it('a recusa de uma opção descreve só essa opção', () => {
      aplicar(fixture, { opcoes: OPCOES, recusas: [recusaDaOpcao('NENHUM')] });

      expect(recusasDe(campo('NENHUM'))).toEqual([
        'grupo-recusa-NENHUM-uniplus.selecao.exemplo.escolha_obrigatoria',
      ]);
      expect([campo('TODOS'), campo('DECIDE'), grupo()].flatMap(recusasDe)).toEqual([]);
    });

    it('cada recusa fica na sua opção, e as outras opções não a citam', () => {
      aplicar(fixture, {
        opcoes: OPCOES,
        recusas: [recusaDaOpcao('TODOS', 'a'), recusaDaOpcao('DECIDE', 'b'), RECUSA],
      });

      expect(recusasDe(campo('TODOS'))).toEqual(['grupo-recusa-TODOS-a']);
      expect(recusasDe(campo('DECIDE'))).toEqual(['grupo-recusa-DECIDE-b']);
      expect(recusasDe(campo('NENHUM'))).toEqual([]);
      expect(recusasDe(grupo())).toHaveLength(1);
    });

    it('várias recusas da mesma opção descrevem essa opção', () => {
      aplicar(fixture, {
        opcoes: OPCOES,
        recusas: [recusaDaOpcao('TODOS', 'a'), recusaDaOpcao('TODOS', 'b')],
      });

      expect(recusasDe(campo('TODOS'))).toEqual(['grupo-recusa-TODOS-a', 'grupo-recusa-TODOS-b']);
    });

    it('a recusa de uma opção que não existe passa a ser do campo', () => {
      aplicar(fixture, { opcoes: OPCOES, recusas: [recusaDaOpcao('OUTRA')] });

      expect(recusasDe(grupo())).toHaveLength(1);
      expect(campos().flatMap(recusasDe)).toEqual([]);
    });

    it('recusas de mesmo código e dono ganham identificadores diferentes, todos presentes', () => {
      aplicar(fixture, { opcoes: OPCOES, recusas: [RECUSA, { ...RECUSA, mensagem: 'Outra.' }] });

      const ids = recusasDe(grupo());
      expect(new Set(ids).size).toBe(2);
      expect(ids.map((id) => texto(id))).toEqual([
        expect.stringContaining(RECUSA.mensagem),
        expect.stringContaining('Outra.'),
      ]);
    });

    it('o parágrafo de situação é descrito pelo erro e pelas recusas do campo', () => {
      aplicar(fixture, { opcoes: [], erroLocal: 'Sem opção.', recusas: [RECUSA] });

      const situacao = host.querySelector('#grupo-situacao') as HTMLElement;
      expect(descritoPor(situacao)).toEqual(descritoPor(grupo()));
      expect(descritoPor(situacao)).toHaveLength(2);
    });

    it('descreve a opção pela instrução, pela explicação, pelas recusas e pelas a conferir, nessa ordem', () => {
      aplicar(fixture, {
        opcoes: OPCOES,
        instrucao: 'Escolha uma opção.',
        recusas: [recusaDaOpcao('NENHUM', 'a')],
        recusasAConferir: [recusaDaOpcao('NENHUM', 'b')],
        notaDasRecusasAConferir: NOTA,
      });

      expect(descritoPor(campo('NENHUM'))).toEqual([
        'grupo-instrucao',
        'grupo-explicacao-NENHUM',
        'grupo-recusa-NENHUM-a',
        'grupo-a-conferir-NENHUM-b',
        'grupo-nota-das-recusas-a-conferir',
      ]);
    });

    it('só cita o que existe na tela', () => {
      aplicar(fixture, {
        opcoes: OPCOES,
        erroLocal: 'Erro.',
        recusas: [recusaDaOpcao('TODOS'), RECUSA],
        recusasAConferir: [recusaDaOpcao('DECIDE')],
        notaDasRecusasAConferir: NOTA,
      });

      const citados = [grupo(), ...campos()].flatMap(descritoPor);
      expect(citados.every((id) => host.querySelector(`[id="${id}"]`) !== null)).toBe(true);
    });

    it('a recusa que sai deixa de ser citada e a que fica mantém o mesmo elemento', () => {
      aplicar(fixture, {
        opcoes: OPCOES,
        recusas: [recusaDaOpcao('TODOS'), recusaDaOpcao('DECIDE')],
      });
      const daDecide = host.querySelector('[id^="grupo-recusa-DECIDE-"]');

      aplicar(fixture, { recusas: [recusaDaOpcao('DECIDE')] });

      expect(recusasDe(campo('TODOS'))).toEqual([]);
      expect(host.querySelector('[id^="grupo-recusa-TODOS-"]')).toBeNull();
      expect(host.querySelector('[id^="grupo-recusa-DECIDE-"]')).toBe(daDecide);
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

    it('a nota só descreve quem tem recusa a conferir', () => {
      aplicar(fixture, {
        opcoes: OPCOES,
        recusasAConferir: [recusaDaOpcao('DECIDE')],
        notaDasRecusasAConferir: NOTA,
      });

      expect(descritoPor(campo('DECIDE'))).toContain('grupo-nota-das-recusas-a-conferir');
      expect(descritoPor(campo('TODOS'))).not.toContain('grupo-nota-das-recusas-a-conferir');
      expect(grupo().hasAttribute('aria-describedby')).toBe(false);
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
