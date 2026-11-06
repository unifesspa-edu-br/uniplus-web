import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { LookupAlertComponent } from '../lookup-alert/lookup-alert';
import { FalhaDeLeituraComponent } from './falha-de-leitura';
import { FalhaDeLeituraDoCampoComponent } from './falha-de-leitura-do-campo';
import { acompanharCatalogo } from './leitura-acompanhada';

@Component({
  selector: 'ui-teste-leituras',
  standalone: true,
  imports: [FalhaDeLeituraComponent, FalhaDeLeituraDoCampoComponent, LookupAlertComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui-falha-de-leitura
      titulo="Não foi possível carregar os campi"
      idMensagem="msg-cursos"
      [leitura]="cursos"
    />
    <ui-falha-de-leitura-do-campo [leitura]="cursos" />
    <ui-lookup-alert [leituras]="[cursos, locais]" />
  `,
})
class LeiturasComponent {
  readonly falhaDosCursos = signal<string | null>(null);
  readonly falhaDosLocais = signal<string | null>(null);
  readonly cursos = acompanharCatalogo({
    assunto: 'cursos',
    falha: this.falhaDosCursos,
    pendente: signal(false),
    recarregar: () => undefined,
    destino: () => null,
  });
  readonly locais = acompanharCatalogo({
    assunto: 'locais de oferta',
    falha: this.falhaDosLocais,
    pendente: signal(false),
    recarregar: () => undefined,
    destino: () => null,
  });
}

describe('avisos de falha de leitura acompanhada', () => {
  let fixture: ComponentFixture<LeiturasComponent>;
  let raiz: HTMLElement;
  let tela: LeiturasComponent;
  const avisos = (seletor: string): Element[] => Array.from(raiz.querySelectorAll(seletor));

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [LeiturasComponent] });
    fixture = TestBed.createComponent(LeiturasComponent);
    tela = fixture.componentInstance;
    raiz = fixture.nativeElement;
    fixture.detectChanges();
  });

  it('sem falha nenhum dos três avisos desenha caixa', () => {
    expect(avisos('ui-alert')).toHaveLength(0);
    expect(avisos('.field__error')).toHaveLength(0);
    expect(raiz.querySelector('ui-falha-de-leitura')?.childElementCount).toBe(0);
    expect(raiz.querySelector('ui-falha-de-leitura-do-campo')?.childElementCount).toBe(0);
    expect(raiz.querySelector('ui-lookup-alert')?.childElementCount).toBe(0);
  });

  it('com falha, o alerta traz o título, a mensagem e o botão de nova tentativa', () => {
    tela.falhaDosCursos.set('O servidor recusou a busca.');
    fixture.detectChanges();

    const alerta = raiz.querySelector('ui-falha-de-leitura ui-alert') as HTMLElement;
    expect(alerta.querySelector('.alert__title')?.textContent).toBe(
      'Não foi possível carregar os campi',
    );
    expect(alerta.querySelector('.alert__msg')?.textContent?.trim()).toBe(
      'O servidor recusou a busca.',
    );
    expect(alerta.querySelector('button')?.textContent?.trim()).toBe('Tentar novamente');
  });

  it('a mensagem do alerta recebe o id pedido, para o campo apontar para ela', () => {
    tela.falhaDosCursos.set('O servidor recusou a busca.');
    fixture.detectChanges();

    expect(raiz.querySelector('#msg-cursos')?.textContent?.trim()).toBe('O servidor recusou a busca.');
  });

  it('com falha, o campo mostra a mensagem em região de alerta e depois dela o botão', () => {
    tela.falhaDosCursos.set('Não foi possível carregar os cursos.');
    fixture.detectChanges();

    const erro = raiz.querySelector('ui-falha-de-leitura-do-campo > .field__error') as HTMLElement;
    expect(erro.children[0].getAttribute('role')).toBe('alert');
    expect(erro.children[0].textContent).toBe('Não foi possível carregar os cursos.');
    expect(erro.children[1].tagName).toBe('UI-NOVA-TENTATIVA-DO-CAMPO');
  });

  it('o aviso dos catálogos lista só as leituras em falha, cada uma com o seu botão', () => {
    tela.falhaDosLocais.set('Falhou.');
    fixture.detectChanges();

    const botoes = avisos('ui-lookup-alert button').map((botao) => botao.textContent?.trim());
    expect(botoes).toEqual(['Recarregar locais de oferta']);

    tela.falhaDosCursos.set('Falhou.');
    fixture.detectChanges();

    const todos = avisos('ui-lookup-alert button').map((botao) => botao.textContent?.trim());
    expect(todos).toEqual(['Recarregar cursos', 'Recarregar locais de oferta']);
  });

  it('o botão do aviso dos catálogos pede a nova tentativa da leitura dele', () => {
    tela.falhaDosCursos.set('Falhou.');
    fixture.detectChanges();

    (avisos('ui-lookup-alert button')[0] as HTMLButtonElement).click();

    expect(tela.cursos.fase()).toBe('tentando');
  });
});
