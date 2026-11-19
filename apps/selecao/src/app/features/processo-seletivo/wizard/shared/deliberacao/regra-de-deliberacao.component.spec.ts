import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { ModoDeDeliberacao } from '@uniplus/shared-data/selecao';
import { beforeEach, describe, expect, it } from 'vitest';

import type { RegraDeDeliberacaoDaBanca } from '../../modelos/deliberacao.models';
import type { CampoDaBanca } from './recusas-da-regra';
import { RegraDeDeliberacaoComponent } from './regra-de-deliberacao.component';
import { ATO_INDIVIDUAL, COLEGIADA, comRegra } from './regra-de-deliberacao.testing';

const ID = 'banca';

describe('RegraDeDeliberacaoComponent', () => {
  let fixture: ComponentFixture<RegraDeDeliberacaoComponent>;
  let emitidas: (RegraDeDeliberacaoDaBanca | null)[];

  const nativo = () => fixture.nativeElement as HTMLElement;
  const controle = <T extends HTMLElement>(campo: string): T | null =>
    nativo().querySelector<T>(`#${ID}-${campo}`);
  const exibe = (regra: RegraDeDeliberacaoDaBanca | null, extras = {}) => {
    fixture.componentRef.setInput('regra', regra);
    for (const [nome, valor] of Object.entries(extras)) fixture.componentRef.setInput(nome, valor);
    fixture.detectChanges();
  };
  const escolher = (campo: string, valor: string) => {
    const select = controle<HTMLSelectElement>(campo);
    if (select === null) throw new Error(`Seletor ${campo} não está na tela.`);
    select.value = valor;
    select.dispatchEvent(new Event('change'));
  };
  const digitar = (campo: string, valor: string) => {
    const input = controle<HTMLInputElement>(campo);
    if (input === null) throw new Error(`Campo ${campo} não está na tela.`);
    input.value = valor;
    input.dispatchEvent(new Event('input'));
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegraDeDeliberacaoComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(RegraDeDeliberacaoComponent);
    fixture.componentRef.setInput('idBase', ID);
    emitidas = [];
    fixture.componentInstance.regraChange.subscribe((regra) => emitidas.push(regra));
  });

  describe('sem regra declarada', () => {
    beforeEach(() => exibe(null));

    it('mostra só o modo, com a opção de não declarar regra escolhida', () => {
      expect(controle<HTMLSelectElement>('modo')?.value).toBe('');
      expect(controle('integrantes')).toBeNull();
      expect(controle('criterio')).toBeNull();
    });

    it('oferece a deliberação colegiada e o ato individual', () => {
      const opcoes = Array.from(controle<HTMLSelectElement>('modo')?.options ?? []).map((opcao) =>
        opcao.textContent?.trim(),
      );

      expect(opcoes).toEqual([
        'Sem regra declarada',
        'Colegiada, com votação',
        'Ato individual, sem votação',
      ]);
    });

    it('cria a regra do modo escolhido, com os campos ainda em branco', () => {
      escolher('modo', ModoDeDeliberacao.colegiadaComVotacao);

      expect(emitidas).toEqual([
        expect.objectContaining({
          modo: ModoDeDeliberacao.colegiadaComVotacao,
          integrantes: '',
          suplentes: '0',
        }),
      ]);
    });
  });

  describe('colegiada', () => {
    beforeEach(() => exibe(COLEGIADA));

    it('mostra composição, encerramento, quórum, critério e desempate', () => {
      for (const campo of [
        'integrantes',
        'suplentes',
        'encerramento',
        'quorum',
        'criterio',
        'desempate',
      ]) {
        expect(controle(campo), campo).not.toBeNull();
      }
      expect(controle('semUnanimidade')).toBeNull();
      expect(controle<HTMLInputElement>('integrantes')?.value).toBe('5');
      expect(controle<HTMLSelectElement>('criterio')?.value).toBe('maioriaSimples');
    });

    it('devolve a regra com o campo digitado', () => {
      digitar('integrantes', '7');

      expect(emitidas.at(-1)).toEqual(comRegra({ integrantes: '7' }));
    });

    it('troca de critério e já tira o desempate que ele não admite', () => {
      escolher('criterio', 'unanimidade');

      expect(emitidas.at(-1)).toMatchObject({ criterio: 'unanimidade', desempate: '' });
    });

    it('volta a banca ao estado sem regra', () => {
      escolher('modo', '');

      expect(emitidas).toEqual([null]);
    });

    it('passa ao ato individual e perde a votação', () => {
      escolher('modo', ModoDeDeliberacao.atoIndividual);

      expect(emitidas.at(-1)).toMatchObject({
        modo: ModoDeDeliberacao.atoIndividual,
        criterio: '',
        quorum: '',
      });
    });

    it('pede o resultado sem unanimidade só no critério que o admite', () => {
      exibe(comRegra({ criterio: 'unanimidade', desempate: '' }));

      expect(controle('semUnanimidade')).not.toBeNull();
      expect(controle('desempate')).toBeNull();
    });

    it('não pede desempate nem resultado sem unanimidade de um só integrante', () => {
      exibe(comRegra({ integrantes: '1' }));

      expect(controle('desempate')).toBeNull();
      expect(controle('semUnanimidade')).toBeNull();
    });
  });

  describe('quórum que acompanha os integrantes', () => {
    beforeEach(() => exibe(comRegra({ encerramento: 'todosOsTitulares', quorum: '5' })));

    it('não deixa digitar o quórum e explica por quê', () => {
      expect(controle<HTMLInputElement>('quorum')?.readOnly).toBe(true);
      expect(controle('quorum-dica')?.textContent).toContain('o quórum é o número de integrantes');
      expect(controle('quorum')?.getAttribute('aria-describedby')).toBe(`${ID}-quorum-dica`);
    });
  });

  describe('ato individual', () => {
    beforeEach(() => exibe(ATO_INDIVIDUAL));

    it('mostra só a composição e diz que não há quórum nem votação', () => {
      expect(controle('integrantes')).not.toBeNull();
      expect(controle('quorum')).toBeNull();
      expect(controle('criterio')).toBeNull();
      expect(nativo().textContent).toContain('sem quórum nem votação');
    });
  });

  describe('recusas', () => {
    const erros: Partial<Record<CampoDaBanca, string>> = {
      quorum: 'O quórum precisa ficar entre 1 e o número de integrantes.',
      regra: 'Declare a regra de deliberação da banca para publicar.',
    };

    it('mostra a recusa sob o campo, ligada a ele para o leitor de tela', () => {
      exibe(COLEGIADA, { erros });

      const alerta = controle(`quorum-erro`);
      expect(alerta?.textContent).toContain('entre 1 e o número de integrantes');
      expect(alerta?.getAttribute('role')).toBe('alert');
      expect(controle('quorum')?.getAttribute('aria-invalid')).toBe('true');
      expect(controle('quorum')?.getAttribute('aria-describedby')).toBe(`${ID}-quorum-erro`);
      expect(controle('criterio')?.getAttribute('aria-invalid')).toBeNull();
    });

    it('mostra a recusa da regra inteira sob o modo', () => {
      exibe(null, { erros });

      expect(controle('modo-erro')?.textContent).toContain('Declare a regra de deliberação');
      expect(controle('modo')?.getAttribute('aria-invalid')).toBe('true');
      expect(controle('modo')?.getAttribute('aria-describedby')).toBe(`${ID}-modo-erro`);
    });
  });

  it('não aceita edição quando desabilitada', () => {
    exibe(COLEGIADA, { desabilitada: true });

    for (const campo of [
      'modo',
      'integrantes',
      'suplentes',
      'encerramento',
      'quorum',
      'criterio',
    ]) {
      expect(controle<HTMLInputElement>(campo)?.disabled, campo).toBe(true);
    }
  });
});
