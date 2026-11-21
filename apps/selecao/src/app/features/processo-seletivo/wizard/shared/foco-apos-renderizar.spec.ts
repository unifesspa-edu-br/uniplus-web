import { ApplicationRef, Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  focarAposRenderizar,
  focarAposRenderizarSeSemFoco,
  migrarFocoAposRenderizar,
} from './foco-apos-renderizar';

describe('foco depois de renderizar', () => {
  let tela: HTMLElement;
  let injetor: Injector;

  const renderizar = () => TestBed.inject(ApplicationRef).tick();

  beforeEach(() => {
    tela = document.createElement('div');
    document.body.append(tela);
    injetor = TestBed.inject(Injector);
  });

  afterEach(() => tela.remove());

  describe('focarAposRenderizar', () => {
    it('leva o foco ao primeiro destino que existe, do preferido ao de reserva', () => {
      tela.innerHTML = '<input id="reserva" />';

      focarAposRenderizar(injetor, 'preferido', 'reserva');
      renderizar();

      expect(document.activeElement?.id).toBe('reserva');
    });

    it('pula o destino desabilitado', () => {
      tela.innerHTML = '<button id="preferido" disabled></button><input id="reserva" />';

      focarAposRenderizar(injetor, 'preferido', 'reserva');
      renderizar();

      expect(document.activeElement?.id).toBe('reserva');
    });

    it('não faz nada quando nenhum destino existe', () => {
      tela.innerHTML = '<input id="outro" />';

      focarAposRenderizar(injetor, 'nao-existe');
      renderizar();

      expect(document.activeElement).toBe(document.body);
    });

    describe('com um grupo de opções como destino', () => {
      const grupo = (marcada: string | null) => `
        <fieldset id="grupo" role="radiogroup">
          <input type="radio" id="a" name="g" ${marcada === 'a' ? 'checked' : ''} />
          <input type="radio" id="b" name="g" ${marcada === 'b' ? 'checked' : ''} />
        </fieldset>`;

      it('leva o foco à opção marcada', () => {
        tela.innerHTML = grupo('b');

        focarAposRenderizar(injetor, 'grupo');
        renderizar();

        expect(document.activeElement?.id).toBe('b');
      });

      it('leva o foco à primeira opção quando nenhuma está marcada', () => {
        tela.innerHTML = grupo(null);

        focarAposRenderizar(injetor, 'grupo');
        renderizar();

        expect(document.activeElement?.id).toBe('a');
      });

      it('sem opção alguma, leva o foco ao parágrafo de situação que ocupa o lugar delas', () => {
        tela.innerHTML =
          '<fieldset id="grupo" role="radiogroup"><p id="situacao" tabindex="-1">Carregando</p></fieldset>';

        focarAposRenderizar(injetor, 'grupo');
        renderizar();

        expect(document.activeElement?.id).toBe('situacao');
      });
    });
  });

  describe('focarAposRenderizarSeSemFoco', () => {
    it('recupera o foco que se perdeu', () => {
      tela.innerHTML = '<input id="destino" />';

      focarAposRenderizarSeSemFoco(injetor, 'destino');
      renderizar();

      expect(document.activeElement?.id).toBe('destino');
    });

    it('não arrasta de volta quem já levou o foco a outro campo', () => {
      tela.innerHTML = '<input id="destino" /><input id="outro" />';
      tela.querySelector<HTMLInputElement>('#outro')?.focus();

      focarAposRenderizarSeSemFoco(injetor, 'destino');
      renderizar();

      expect(document.activeElement?.id).toBe('outro');
    });
  });

  describe('migrarFocoAposRenderizar', () => {
    it('leva o foco ao destino quando ele estava na origem', () => {
      tela.innerHTML = '<p id="origem" tabindex="-1"></p><input id="destino" />';
      tela.querySelector<HTMLElement>('#origem')?.focus();

      migrarFocoAposRenderizar(injetor, 'origem', 'destino');
      renderizar();

      expect(document.activeElement?.id).toBe('destino');
    });

    it('não move o foco que estava em outro elemento', () => {
      tela.innerHTML = '<input id="destino" /><input id="outro" />';
      tela.querySelector<HTMLInputElement>('#outro')?.focus();

      migrarFocoAposRenderizar(injetor, 'origem', 'destino');
      renderizar();

      expect(document.activeElement?.id).toBe('outro');
    });

    it('não move o foco quando ninguém o tem e a origem é vazia', () => {
      tela.innerHTML = '<input id="destino" />';

      migrarFocoAposRenderizar(injetor, '', 'destino');
      renderizar();

      expect(document.activeElement).toBe(document.body);
    });
  });
});
