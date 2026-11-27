import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import type { FormularioAAcrescentar } from './acrescimo.component';
import { AcrescimoDeFormularioComponent } from './acrescimo.component';

const FASES = [
  {
    codigo: 'INSCRICAO',
    nome: 'Inscrição',
    coletaInscricao: true,
    coletaSolicitacaoIsencao: false,
  },
  {
    codigo: 'AVALIACAO',
    nome: 'Avaliação',
    coletaInscricao: false,
    coletaSolicitacaoIsencao: false,
  },
];
const MODELOS = [
  {
    id: 'i',
    codigo: 'INSCRICAO_PADRAO',
    nome: 'Inscrição padrão',
    serveAFaseDeInscricao: true,
    obrigatorio: true,
  },
  {
    id: 'h',
    codigo: 'LAUDO',
    nome: 'Laudo médico',
    serveAFaseDeInscricao: false,
    obrigatorio: false,
  },
];

describe('AcrescimoDeFormularioComponent', () => {
  let fixture: ComponentFixture<AcrescimoDeFormularioComponent>;
  let pedidos: FormularioAAcrescentar[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AcrescimoDeFormularioComponent],
      providers: [ProcessoSeletivoStore],
    }).compileComponents();
    fixture = TestBed.createComponent(AcrescimoDeFormularioComponent);
    fixture.componentRef.setInput('fases', FASES);
    fixture.componentRef.setInput('modelos', MODELOS);
    fixture.componentRef.setInput('codigosEmUso', ['INSCRICAO']);
    pedidos = [];
    fixture.componentInstance.acrescentou.subscribe((pedido) => pedidos.push(pedido));
    fixture.detectChanges();
  });

  const tela = (): HTMLElement => fixture.nativeElement;
  const campo = <T extends HTMLElement>(id: string): T => tela().querySelector<T>(`#${id}`) as T;
  const botao = () => campo<HTMLButtonElement>('form-acrescentar');

  function escolher(id: string, valor: string): void {
    const select = campo<HTMLSelectElement>(id);
    select.value = valor;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  function digitarCodigo(valor: string): void {
    const entrada = campo<HTMLInputElement>('form-novo-codigo');
    entrada.value = valor;
    entrada.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('rotula os três campos e começa sem poder acrescentar', () => {
    const rotulos = Array.from(tela().querySelectorAll('label'), (r) => r.textContent?.trim());

    expect(rotulos).toEqual([
      'Fase em que o candidato responde',
      'Partir do modelo',
      'Código do formulário',
    ]);
    expect(botao().disabled).toBe(true);
  });

  it('o modelo oferecido é o que serve à fase escolhida', () => {
    const opcoes = () =>
      Array.from(
        tela().querySelectorAll<HTMLOptionElement>('#form-novo-modelo option'),
        (o) => o.value,
      );

    expect(opcoes()).toEqual(['', 'i', 'h']);
    escolher('form-nova-fase', 'INSCRICAO');
    expect(opcoes()).toEqual(['', 'i']);
    escolher('form-nova-fase', 'AVALIACAO');
    expect(opcoes()).toEqual(['', 'h']);
  });

  it('o modelo preenche o código, que o operador pode mudar, e a troca de modelo o acompanha', () => {
    escolher('form-novo-modelo', 'i');
    expect(campo<HTMLInputElement>('form-novo-codigo').value).toBe('INSCRICAO_PADRAO');

    escolher('form-novo-modelo', 'h');
    expect(campo<HTMLInputElement>('form-novo-codigo').value).toBe('LAUDO');

    digitarCodigo('meu_laudo');
    escolher('form-novo-modelo', 'i');
    expect(campo<HTMLInputElement>('form-novo-codigo').value).toBe('MEU_LAUDO');
  });

  it('diz por que o código não serve, e só deixa acrescentar com o código aceito', () => {
    escolher('form-nova-fase', 'AVALIACAO');

    digitarCodigo('1abc');
    expect(campo('form-novo-codigo-erro').textContent).toContain('começa com letra maiúscula');
    expect(campo<HTMLInputElement>('form-novo-codigo').getAttribute('aria-invalid')).toBe('true');
    expect(botao().disabled).toBe(true);

    digitarCodigo('inscricao');
    expect(campo('form-novo-codigo-erro').textContent).toContain('Já existe um formulário');
    expect(botao().disabled).toBe(true);

    digitarCodigo('laudo');
    expect(tela().querySelector('#form-novo-codigo-erro')).toBeNull();
    expect(botao().disabled).toBe(false);
  });

  it('emite a fase, o código e o modelo e limpa o pedido', () => {
    escolher('form-nova-fase', 'AVALIACAO');
    escolher('form-novo-modelo', 'h');

    botao().click();
    fixture.detectChanges();

    expect(pedidos).toEqual([{ faseCodigo: 'AVALIACAO', codigo: 'LAUDO', modelo: MODELOS[1] }]);
    expect(campo<HTMLInputElement>('form-novo-codigo').value).toBe('');
    expect(botao().disabled).toBe(true);
  });

  it('sem modelo, emite o pedido com modelo nulo', () => {
    escolher('form-nova-fase', 'AVALIACAO');
    digitarCodigo('outro');

    botao().click();

    expect(pedidos).toEqual([{ faseCodigo: 'AVALIACAO', codigo: 'OUTRO', modelo: null }]);
  });
});
