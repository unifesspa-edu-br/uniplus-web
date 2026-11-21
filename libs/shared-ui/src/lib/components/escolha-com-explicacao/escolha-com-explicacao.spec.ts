import { ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  EscolhaComExplicacaoComponent,
  type OpcaoDeEscolhaComExplicacao,
  type SituacaoDasOpcoes,
} from './escolha-com-explicacao';
import { OPCOES, aplicar, montar } from './escolha-com-explicacao.testing';

describe('EscolhaComExplicacaoComponent', () => {
  let fixture: ComponentFixture<EscolhaComExplicacaoComponent>;
  let host: HTMLElement;

  beforeEach(() => {
    fixture = montar();
    host = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => fixture.nativeElement.remove());

  const campos = (): HTMLInputElement[] => Array.from(host.querySelectorAll('input[type="radio"]'));
  const campo = (codigo: string): HTMLInputElement =>
    host.querySelector(`#grupo-opcao-${codigo}`) as HTMLInputElement;
  const texto = (id: string): string => host.querySelector(`#${id}`)?.textContent?.trim() ?? '';
  const situacao = (): HTMLElement | null => host.querySelector('#grupo-situacao');
  const descritoPor = (elemento: Element): string[] =>
    (elemento.getAttribute('aria-describedby') ?? '').split(' ').filter((id) => id);

  describe('grupo', () => {
    it('é um grupo de opções nomeado pela legenda', () => {
      aplicar(fixture, { opcoes: OPCOES });

      const grupo = host.querySelector('fieldset') as HTMLFieldSetElement;
      expect(grupo.getAttribute('role')).toBe('radiogroup');
      expect(grupo.id).toBe('grupo-grupo');
      expect(grupo.querySelector('legend')?.textContent?.trim()).toBe('Efeito do recurso');
    });

    it('com texto de obrigatoriedade, a legenda termina com ele e o grupo é obrigatório', () => {
      aplicar(fixture, { opcoes: OPCOES, textoDeObrigatoriedade: '(obrigatório)' });

      const grupo = host.querySelector('fieldset') as HTMLFieldSetElement;
      expect(grupo.querySelector('legend')?.textContent?.trim()).toBe(
        'Efeito do recurso (obrigatório)',
      );
      expect(grupo.getAttribute('aria-required')).toBe('true');
    });

    it('sem texto de obrigatoriedade, a legenda fica só com o nome e o grupo não é obrigatório', () => {
      aplicar(fixture, { opcoes: OPCOES, textoDeObrigatoriedade: null });

      const grupo = host.querySelector('fieldset') as HTMLFieldSetElement;
      expect(grupo.querySelector('legend')?.textContent?.trim()).toBe('Efeito do recurso');
      expect(grupo.hasAttribute('aria-required')).toBe(false);
    });

    it('mostra a instrução do grupo', () => {
      aplicar(fixture, { opcoes: OPCOES, instrucao: 'Escolha uma opção.' });

      expect(texto('grupo-instrucao')).toBe('Escolha uma opção.');
    });

    it('sem instrução, não cria o parágrafo dela', () => {
      aplicar(fixture, { opcoes: OPCOES });

      expect(host.querySelector('#grupo-instrucao')).toBeNull();
    });
  });

  describe('opções', () => {
    it('mostra uma opção por item, com o rótulo, no mesmo grupo nativo', () => {
      aplicar(fixture, { opcoes: OPCOES });

      expect(campos().map((c) => c.value)).toEqual(['TODOS', 'NENHUM', 'DECIDE']);
      expect(new Set(campos().map((c) => c.name))).toEqual(new Set(['grupo']));
      expect(host.querySelector('label.radio')?.textContent?.trim()).toBe('Todos os recursos');
    });

    it('todas as opções podem receber foco pelo teclado', () => {
      aplicar(fixture, { opcoes: OPCOES });

      expect(campos().every((c) => c.tabIndex === 0 && !c.disabled)).toBe(true);
    });

    it('desabilita todas as opções quando a escolha não está liberada', () => {
      aplicar(fixture, { opcoes: OPCOES, valor: 'NENHUM', desabilitado: true });

      expect(campos().every((c) => c.disabled)).toBe(true);
      expect(campos().map((c) => c.checked)).toEqual([false, true, false]);
    });

    it('marca a opção que o valor indica', () => {
      aplicar(fixture, { opcoes: OPCOES, valor: 'NENHUM' });

      expect(campos().map((c) => c.checked)).toEqual([false, true, false]);
    });

    it('sem valor, nenhuma opção vem marcada', () => {
      aplicar(fixture, { opcoes: OPCOES, valor: '' });

      expect(campos().some((c) => c.checked)).toBe(false);
    });

    it('com valor que não está nas opções, nenhuma opção vem marcada', () => {
      aplicar(fixture, { opcoes: OPCOES, valor: 'OUTRA' });

      expect(campos().some((c) => c.checked)).toBe(false);
    });

    it('acompanha o valor quando ele muda', () => {
      aplicar(fixture, { opcoes: OPCOES, valor: 'TODOS' });
      aplicar(fixture, { valor: 'DECIDE' });

      expect(campos().map((c) => c.checked)).toEqual([false, false, true]);
    });

    it('devolve o código da opção que a pessoa escolhe', () => {
      const escolhidos: string[] = [];
      fixture.componentInstance.escolhido.subscribe((codigo) => escolhidos.push(codigo));
      aplicar(fixture, { opcoes: OPCOES, valor: 'TODOS' });

      campo('DECIDE').click();

      expect(escolhidos).toEqual(['DECIDE']);
    });

    it('se quem usa não aceita a escolha e mantém o valor, a marca volta à opção do valor', async () => {
      aplicar(fixture, { opcoes: OPCOES, valor: 'TODOS' });

      campo('DECIDE').click();
      await fixture.whenStable();

      expect(campos().map((c) => c.checked)).toEqual([true, false, false]);
    });

    it('se quem usa aceita a escolha e atualiza o valor, a marca fica na opção escolhida', async () => {
      fixture.componentInstance.escolhido.subscribe((codigo) =>
        aplicar(fixture, { valor: codigo }),
      );
      aplicar(fixture, { opcoes: OPCOES, valor: 'TODOS' });

      campo('DECIDE').click();
      await fixture.whenStable();

      expect(campos().map((c) => c.checked)).toEqual([false, false, true]);
    });

    it('sem valor e sem aceitar a escolha, nenhuma opção fica marcada', async () => {
      aplicar(fixture, { opcoes: OPCOES, valor: '' });

      campo('NENHUM').click();
      await fixture.whenStable();

      expect(campos().some((c) => c.checked)).toBe(false);
    });

    it('não devolve nada ao tocar de novo na opção já marcada', () => {
      const escolhidos: string[] = [];
      fixture.componentInstance.escolhido.subscribe((codigo) => escolhidos.push(codigo));
      aplicar(fixture, { opcoes: OPCOES, valor: 'TODOS' });

      campo('TODOS').click();

      expect(escolhidos).toEqual([]);
    });
  });

  describe('explicações e descrição de cada opção', () => {
    it('mostra a explicação da opção e a liga a ela pelo aria-describedby', () => {
      aplicar(fixture, { opcoes: OPCOES });

      expect(texto('grupo-explicacao-TODOS')).toBe('Todos os recursos suspendem o resultado.');
      expect(descritoPor(campo('TODOS'))).toEqual(['grupo-explicacao-TODOS']);
    });

    it('opção sem explicação fica só com o rótulo, sem parágrafo nem descrição', () => {
      const semExplicacao: OpcaoDeEscolhaComExplicacao[] = [{ codigo: 'A', rotulo: 'Opção A' }];
      aplicar(fixture, { opcoes: semExplicacao });

      expect(host.querySelector('#grupo-explicacao-A')).toBeNull();
      expect(campo('A').hasAttribute('aria-describedby')).toBe(false);
    });

    it('explicação vazia conta como ausente', () => {
      aplicar(fixture, { opcoes: [{ codigo: 'A', rotulo: 'Opção A', descricao: '' }] });

      expect(host.querySelector('#grupo-explicacao-A')).toBeNull();
      expect(campo('A').hasAttribute('aria-describedby')).toBe(false);
    });
  });

  describe('quando não há opção para escolher', () => {
    it.each<[SituacaoDasOpcoes, string]>([
      ['carregando', 'Carregando as opções…'],
      ['falhou', 'As opções não carregaram. Use "Tentar de novo" no aviso do topo do passo.'],
      ['pronta', 'Nenhuma opção disponível.'],
    ])('no estado %s, o parágrafo de situação diz "%s"', (estado, mensagem) => {
      aplicar(fixture, { opcoes: [], situacao: estado });

      expect(situacao()?.textContent?.trim()).toBe(mensagem);
      expect(campos()).toHaveLength(0);
    });

    it('o parágrafo de situação recebe foco por código, mas fora da ordem do Tab', () => {
      aplicar(fixture, { opcoes: [], situacao: 'carregando' });

      expect(situacao()?.getAttribute('tabindex')).toBe('-1');
    });

    it('enquanto carrega, o grupo é anunciado como ocupado', () => {
      aplicar(fixture, { opcoes: [], situacao: 'carregando' });
      expect(host.querySelector('fieldset')?.getAttribute('aria-busy')).toBe('true');

      aplicar(fixture, { situacao: 'pronta' });
      expect(host.querySelector('fieldset')?.hasAttribute('aria-busy')).toBe(false);
    });

    it('lista pronta e vazia usa o texto que quem usa informou', () => {
      aplicar(fixture, { opcoes: [], textoSemOpcoes: 'Nada cadastrado.' });

      expect(situacao()?.textContent?.trim()).toBe('Nada cadastrado.');
    });

    it('sem recusas, o parágrafo de situação não tem descrição', () => {
      aplicar(fixture, { opcoes: [] });

      expect(situacao()?.hasAttribute('aria-describedby')).toBe(false);
    });

    it('havendo opções, o parágrafo de situação não existe, mesmo carregando', () => {
      aplicar(fixture, { opcoes: OPCOES, situacao: 'carregando' });

      expect(situacao()).toBeNull();
    });

    it('a instrução continua à vista', () => {
      aplicar(fixture, { opcoes: [], instrucao: 'Escolha uma opção.' });

      expect(texto('grupo-instrucao')).toBe('Escolha uma opção.');
    });
  });

  describe('foco', () => {
    it('com o foco no parágrafo, ao chegarem as opções ele vai para a opção marcada', async () => {
      aplicar(fixture, { opcoes: [], situacao: 'carregando', valor: 'NENHUM' });
      situacao()?.focus();

      aplicar(fixture, { opcoes: OPCOES, situacao: 'pronta' });
      await fixture.whenStable();

      expect(document.activeElement).toBe(campo('NENHUM'));
      expect(situacao()).toBeNull();
    });

    it('sem nenhuma opção marcada, o foco vai para a primeira', async () => {
      aplicar(fixture, { opcoes: [], situacao: 'carregando' });
      situacao()?.focus();

      aplicar(fixture, { opcoes: OPCOES, situacao: 'pronta' });
      await fixture.whenStable();

      expect(document.activeElement).toBe(campo('TODOS'));
    });

    it('com o foco em outro lugar, a chegada das opções não o move', async () => {
      const outro = document.createElement('button');
      document.body.appendChild(outro);
      aplicar(fixture, { opcoes: [], situacao: 'carregando' });
      outro.focus();

      aplicar(fixture, { opcoes: OPCOES, situacao: 'pronta' });
      await fixture.whenStable();

      expect(document.activeElement).toBe(outro);
      outro.remove();
    });

    it('focar() leva o foco à opção marcada', () => {
      aplicar(fixture, { opcoes: OPCOES, valor: 'DECIDE' });

      fixture.componentInstance.focar();

      expect(document.activeElement).toBe(campo('DECIDE'));
    });

    it('focar() sem opção marcada leva o foco à primeira', () => {
      aplicar(fixture, { opcoes: OPCOES });

      fixture.componentInstance.focar();

      expect(document.activeElement).toBe(campo('TODOS'));
    });

    it('focar() sem opção alguma leva o foco ao parágrafo de situação', () => {
      aplicar(fixture, { opcoes: [], situacao: 'carregando' });

      fixture.componentInstance.focar();

      expect(document.activeElement).toBe(situacao());
    });
  });

  it('usa o prefixo recebido em todos os identificadores', () => {
    aplicar(fixture, { prefixoDoId: 'recurso-fase-7-efeito', opcoes: OPCOES });

    expect(host.querySelector('#recurso-fase-7-efeito-grupo')).not.toBeNull();
    expect(host.querySelector('#recurso-fase-7-efeito-opcao-TODOS')).not.toBeNull();
    expect(host.querySelector('#recurso-fase-7-efeito-explicacao-TODOS')).not.toBeNull();
  });
});
