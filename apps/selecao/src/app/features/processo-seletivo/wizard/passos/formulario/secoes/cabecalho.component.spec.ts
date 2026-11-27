import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConsequenciaDoDescumprimentoCodigo } from '@uniplus/shared-data/selecao';
import { beforeEach, describe, expect, it } from 'vitest';

import { ProcessoSeletivoStore } from '../../../processo-seletivo.store';
import { CatalogoDasConsequenciasDeIndeferimento } from '../../cronograma/catalogos/catalogo-das-consequencias-de-indeferimento.service';
import { abasDoFormulario, type AbaDoFormulario } from '../abas-do-formulario';
import { entradaDasAbas, inscricao, laudo } from '../abas-do-formulario.testing';
import { CabecalhoDoFormularioComponent } from './cabecalho.component';

const CONSEQUENCIAS = [
  { codigo: ConsequenciaDoDescumprimentoCodigo.ELIMINA_DO_PROCESSO, rotulo: 'Elimina do processo' },
];

describe('CabecalhoDoFormularioComponent', () => {
  let fixture: ComponentFixture<CabecalhoDoFormularioComponent>;
  let codigos: string[];
  let fases: string[];
  let obrigatorios: boolean[];
  let consequencias: (string | null)[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CabecalhoDoFormularioComponent],
      providers: [
        ProcessoSeletivoStore,
        {
          provide: CatalogoDasConsequenciasDeIndeferimento,
          useValue: { consequencias: () => CONSEQUENCIAS },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(CabecalhoDoFormularioComponent);
    [codigos, fases, obrigatorios, consequencias] = [[], [], [], []];
    const componente = fixture.componentInstance;
    componente.codigoMudou.subscribe((codigo) => codigos.push(codigo));
    componente.faseMudou.subscribe((fase) => fases.push(fase));
    componente.obrigatorioMudou.subscribe((valor) => obrigatorios.push(valor));
    componente.consequenciaMudou.subscribe((valor) => consequencias.push(valor));
  });

  /** A aba do formulário de código dado, entre a inscrição e o laudo. */
  function mostrar(
    codigo: string,
    ajuste: (aba: AbaDoFormulario) => AbaDoFormulario = (a) => a,
  ): void {
    const abas = abasDoFormulario(entradaDasAbas([inscricao(), laudo()]));
    const aba = abas.find((item) => item.codigo === codigo) as AbaDoFormulario;
    fixture.componentRef.setInput('aba', ajuste(aba));
    fixture.componentRef.setInput(
      'codigosEmUso',
      ['INSCRICAO', 'LAUDO'].filter((c) => c !== codigo),
    );
    fixture.detectChanges();
  }

  const tela = (): HTMLElement => fixture.nativeElement;
  const campo = <T extends HTMLElement>(id: string): T | null => tela().querySelector<T>(`#${id}`);

  function digitar(id: string, valor: string, confirmar = true): void {
    const entrada = campo<HTMLInputElement>(id) as HTMLInputElement;
    entrada.value = valor;
    entrada.dispatchEvent(new Event('input'));
    if (confirmar) entrada.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  it('o código do formulário já gravado só se lê, e o do rascunho se edita', () => {
    mostrar('INSCRICAO');
    expect(campo<HTMLInputElement>('form-0-codigo')?.readOnly).toBe(true);

    mostrar('LAUDO', (aba) => ({ ...aba, gravado: false }));
    expect(campo<HTMLInputElement>('form-1-codigo')?.readOnly).toBe(false);
  });

  it('o código novo vale quando passa na conferência, em maiúsculas', () => {
    mostrar('LAUDO', (aba) => ({ ...aba, gravado: false }));

    digitar('form-1-codigo', 'novo_laudo');

    expect(codigos).toEqual(['NOVO_LAUDO']);
  });

  it('o código que não serve ou já existe é recusado com o motivo, e o campo volta ao que vale', () => {
    mostrar('LAUDO', (aba) => ({ ...aba, gravado: false }));

    digitar('form-1-codigo', '1x', false);
    expect(campo('form-1-codigo-erro')?.textContent).toContain('começa com letra maiúscula');
    expect(campo<HTMLInputElement>('form-1-codigo')?.getAttribute('aria-invalid')).toBe('true');

    digitar('form-1-codigo', 'INSCRICAO', false);
    expect(campo('form-1-codigo-erro')?.textContent).toContain('Já existe um formulário');
    digitar('form-1-codigo', 'INSCRICAO');
    expect(codigos).toEqual([]);
    expect(campo<HTMLInputElement>('form-1-codigo')?.value).toBe('LAUDO');
  });

  it('a fase escolhida sai pelo evento', () => {
    mostrar('LAUDO');
    const select = campo<HTMLSelectElement>('form-fase-1') as HTMLSelectElement;
    select.value = 'INSCRICAO';
    select.dispatchEvent(new Event('change'));

    expect(fases).toEqual(['INSCRICAO']);
  });

  it('sem fase com lugar, diz o que fazer em vez de oferecer a escolha', () => {
    mostrar('LAUDO', (aba) => ({ ...aba, fases: [] }));

    expect(campo('form-1-sem-fase')?.textContent).toContain(
      'Acrescente a fase no passo Cronograma',
    );
    expect(campo('form-fase-1')).toBeNull();
  });

  it('na fase de inscrição a obrigatoriedade é dita em texto, sem caixa nem consequência', () => {
    mostrar('INSCRICAO');

    expect(campo('form-0-obrigatoriedade')?.textContent).toContain('obrigatório');
    expect(campo('form-0-obrigatorio')).toBeNull();
    expect(campo('form-0-consequencia')).toBeNull();
  });

  it('nas demais fases a caixa de obrigatoriedade e a consequência saem pelos eventos', () => {
    mostrar('LAUDO');

    const caixa = campo<HTMLInputElement>('form-1-obrigatorio') as HTMLInputElement;
    caixa.checked = false;
    caixa.dispatchEvent(new Event('change'));
    const consequencia = campo<HTMLSelectElement>('form-1-consequencia') as HTMLSelectElement;
    consequencia.value = 'ELIMINA_DO_PROCESSO';
    consequencia.dispatchEvent(new Event('change'));
    consequencia.value = '';
    consequencia.dispatchEvent(new Event('change'));

    expect(obrigatorios).toEqual([false]);
    expect(consequencias).toEqual(['ELIMINA_DO_PROCESSO', null]);
  });

  it('a caixa de obrigatoriedade fica desabilitada, com o motivo, quando a fase já tem o outro', () => {
    mostrar('LAUDO', (aba) => ({
      ...aba,
      obrigatoriedade: { ...aba.obrigatoriedade, podeAlternar: false },
    }));

    expect(campo<HTMLInputElement>('form-1-obrigatorio')?.disabled).toBe(true);
    expect(campo('form-1-obrigatorio-ajuda')?.textContent).toContain(
      'A fase já tem outro formulário',
    );
  });

  it('em consulta, mostra os dados como texto, sem controle', () => {
    TestBed.inject(ProcessoSeletivoStore).publicacaoNaoConfirmada.set(true);
    mostrar('LAUDO', (aba) => ({
      ...aba,
      consequenciaDaFaltaDeEnvio: ConsequenciaDoDescumprimentoCodigo.ELIMINA_DO_PROCESSO,
    }));

    expect(tela().querySelector('input, select, button')).toBeNull();
    expect(tela().textContent).toContain('LAUDO');
    expect(tela().textContent).toContain('Obrigatório');
    expect(tela().textContent).toContain('Elimina do processo');
  });
});
