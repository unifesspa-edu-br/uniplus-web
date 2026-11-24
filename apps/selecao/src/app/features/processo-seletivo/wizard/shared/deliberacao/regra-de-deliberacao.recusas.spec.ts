import { proverVocabulariosDaDeliberacao } from './regra-de-deliberacao.testing';
import { ENCERRAMENTOS } from './regra-de-deliberacao.testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { fornecerVocabulariosDaRegra } from './vocabularios-da-regra.testing';
import { beforeEach, describe, expect, it } from 'vitest';

import type { RecusaOrdenada } from '../recusas/ordem-das-recusas';
import type { RecusasDaBancaPorCampo } from './recusas-da-regra';
import { RegraDeDeliberacaoComponent } from './regra-de-deliberacao.component';
import { COLEGIADA, comRegra } from './regra-de-deliberacao.testing';
import type { RegraDeDeliberacaoDaBanca } from '../../modelos/deliberacao.models';

const ID = 'banca';

function recusa(campo: string, mensagem: string, aConferir = false): RecusaOrdenada {
  return {
    campo: `bancas.banca-1.${campo}`,
    codigo: `uniplus.selecao.banca.recusa_${campo}`,
    mensagem,
    pagina: null,
    ordem: 0,
    resposta: 1,
    origem: 'gravacao',
    aConferir,
  };
}

describe('RegraDeDeliberacaoComponent: recusas do servidor', () => {
  let fixture: ComponentFixture<RegraDeDeliberacaoComponent>;
  const nativo = () => fixture.nativeElement as HTMLElement;
  const elemento = (id: string) => nativo().querySelector<HTMLElement>(`#${ID}-${id}`);
  const exibe = (
    regra: RegraDeDeliberacaoDaBanca | null,
    recusas: RecusasDaBancaPorCampo,
    erros: Record<string, string> = {},
  ) => {
    fixture.componentRef.setInput('regra', regra);
    fixture.componentRef.setInput('recusas', recusas);
    fixture.componentRef.setInput('erros', erros);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [fornecerVocabulariosDaRegra()],
      imports: [RegraDeDeliberacaoComponent],
      providers: [proverVocabulariosDaDeliberacao()],
    }).compileComponents();
    fixture = TestBed.createComponent(RegraDeDeliberacaoComponent);
    fixture.componentRef.setInput('idBase', ID);
  });

  it('mostra a recusa ativa sob o controle, com mensagem e código, e marca só ele', () => {
    exibe(COLEGIADA, { quorum: [recusa('quorum', 'Quórum fora do intervalo.')] });

    const bloco = elemento('quorum-recusas');
    expect(bloco?.textContent).toContain('Quórum fora do intervalo.');
    expect(bloco?.textContent).toContain('uniplus.selecao.banca.recusa_quorum');
    expect(bloco?.getAttribute('tabindex')).toBe('-1');
    expect(elemento('quorum')?.getAttribute('aria-invalid')).toBe('true');
    expect(elemento('quorum')?.getAttribute('aria-describedby')).toBe(`${ID}-quorum-recusas`);
    expect(elemento('criterio')?.getAttribute('aria-invalid')).toBeNull();
    expect(elemento('criterio-recusas')).toBeNull();
  });

  it('não repete a recusa do servidor como erro da tela nem lhe dá o papel de alerta', () => {
    exibe(COLEGIADA, { quorum: [recusa('quorum', 'Do servidor.')] }, { quorum: 'Da tela.' });

    expect(elemento('quorum-erro')).toBeNull();
    expect(nativo().textContent).not.toContain('Da tela.');
    expect(nativo().querySelector('[role="alert"]')).toBeNull();
  });

  it('mostra a recusa a conferir com a nota, sem marcar o controle, e o erro da tela volta', () => {
    exibe(COLEGIADA, { quorum: [recusa('quorum', 'Antiga.', true)] }, { quorum: 'Da tela.' });

    expect(elemento('quorum-recusas')?.textContent).toContain('será conferida de novo');
    expect(elemento('quorum-erro')?.textContent).toContain('Da tela.');
    expect(elemento('quorum-erro')?.getAttribute('role')).toBe('alert');
    expect(elemento('quorum')?.getAttribute('aria-describedby')).toBe(
      `${ID}-quorum-erro ${ID}-quorum-recusas`,
    );
  });

  it('só descreve o controle com a recusa a conferir, sem marcá-lo como inválido', () => {
    exibe(COLEGIADA, { criterio: [recusa('criterio', 'Antiga.', true)] });

    expect(elemento('criterio')?.getAttribute('aria-invalid')).toBeNull();
    expect(elemento('criterio')?.getAttribute('aria-describedby')).toBe(`${ID}-criterio-recusas`);
  });

  it('junta a dica, o erro da tela e a recusa, nessa ordem, no quórum fixo', () => {
    exibe(
      comRegra({ encerramento: ENCERRAMENTOS.todosOsTitulares, quorum: '5' }),
      { quorum: [recusa('quorum', 'Antiga.', true)] },
      { quorum: 'Da tela.' },
    );

    expect(elemento('quorum')?.getAttribute('aria-describedby')).toBe(
      `${ID}-quorum-dica ${ID}-quorum-erro ${ID}-quorum-recusas`,
    );
  });

  it('mostra sob o modo a recusa de um controle que a tela não mostra para a regra', () => {
    exibe(comRegra({ integrantes: '1' }), { desempate: [recusa('desempate', 'Sem empate.')] });

    expect(elemento('desempate')).toBeNull();
    expect(elemento('desempate-recusas')).toBeNull();
    expect(elemento('modo-recusas')?.textContent).toContain('Sem empate.');
    expect(elemento('modo')?.getAttribute('aria-invalid')).toBe('true');
    expect(elemento('modo')?.getAttribute('aria-describedby')).toBe(`${ID}-modo-recusas`);
  });

  it('mostra sob o modo a recusa da regra inteira e a dele, e todas se não há regra', () => {
    exibe(null, {
      regra: [recusa('regra', 'Declare a regra.')],
      quorum: [recusa('quorum', 'Quórum.')],
    });

    expect(elemento('modo-recusas')?.textContent).toContain('Declare a regra.');
    expect(elemento('modo-recusas')?.textContent).toContain('Quórum.');
  });

  it('mostra o controle com a recusa dele, e não sob o modo, quando a tela o mostra', () => {
    exibe(COLEGIADA, { desempate: [recusa('desempate', 'Sem empate.')] });

    expect(elemento('desempate-recusas')?.textContent).toContain('Sem empate.');
    expect(elemento('modo-recusas')).toBeNull();
  });

  it('mostra sob o modo a recusa do resultado sem unanimidade quando o critério não a pede', () => {
    exibe(COLEGIADA, { semUnanimidade: [recusa('semUnanimidade', 'Sem unanimidade.')] });

    expect(elemento('modo-recusas')?.textContent).toContain('Sem unanimidade.');
  });
});
