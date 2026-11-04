import { afterEach, describe, expect, it } from 'vitest';

import { FormulaStepComponent } from './formula.component';
import {
  MontagemDe,
  RESOLUCAO,
  SELETOR_RESOLUCAO,
  encerrarMontagem,
  escolherNoSeletor,
  pedidosDoCadastro,
  rascunhoComResolucao,
  responderPesos,
  seletor,
  texto,
  montar,
  type OpcoesDaMontagem,
} from './peso-por-area.testing';

function montarPasso(
  opcoes: Omit<OpcoesDaMontagem, 'comoSecao'> = {},
): Promise<MontagemDe<FormulaStepComponent>> {
  return montar(FormulaStepComponent, opcoes);
}

/** Marca o ENEM como o operador: escolhe a média ponderada local e liga a caixa. */
function marcarEnemPelaTela(m: MontagemDe<FormulaStepComponent>): void {
  m.componente.escolherRegraCalculo('FORMULA-MEDIA-PONDERADA|1.0');
  m.fixture.detectChanges();
  const checkbox = m.el.querySelector<HTMLInputElement>('input[type="checkbox"]');
  if (checkbox === null) throw new Error('checkbox do ENEM ausente');
  checkbox.checked = true;
  checkbox.dispatchEvent(new Event('change'));
  m.fixture.detectChanges();
}

describe('FormulaStepComponent — resolução de Peso por Área', () => {
  afterEach(encerrarMontagem);

  describe('quando aparece e quando o cadastro é lido', () => {
    it('não lê o cadastro enquanto a classificação não exige a resolução', async () => {
      const m = await montarPasso();
      m.componente.escolherRegraCalculo('CLASSIFICACAO-IMPORTADA|1.0');
      m.componente.alternarBaseadoEmEnem(true);
      m.fixture.detectChanges();

      expect(pedidosDoCadastro(m)).toHaveLength(0);
      expect(m.el.querySelector(SELETOR_RESOLUCAO)).toBeNull();
      expect(texto(m.el)).toContain('não há resolução de Peso por Área a escolher');
    });

    it('sem ENEM, não mostra a escolha nem lê o cadastro', async () => {
      const m = await montarPasso();
      m.componente.escolherRegraCalculo('FORMULA-MEDIA-PONDERADA|1.0');
      m.fixture.detectChanges();

      expect(pedidosDoCadastro(m)).toHaveLength(0);
      expect(m.el.querySelector(SELETOR_RESOLUCAO)).toBeNull();
    });

    it('a opção do ENEM anuncia o corte por área, que vale para qualquer área e não só a redação', async () => {
      const m = await montarPasso();

      const opcao = texto(m.el.querySelector('.check-item'));
      expect(opcao).toContain('corte por área');
      expect(opcao).not.toContain('corte de redação');
    });
  });

  describe('seletor mostra a escolha do rascunho', () => {
    it('tirar a regra de cálculo guarda a resolução no rascunho e descarta a recusa', async () => {
      const m = await montarPasso({ antesDeMontar: rascunhoComResolucao(RESOLUCAO) });
      responderPesos(m);
      m.store.classificacao.recusaDaResolucaoPesoAreaEnem.set('Recusa anterior.');

      m.componente.escolherRegraCalculo('|');

      expect(m.store.draft().classificacao.resolucaoPesoAreaEnem).toBe(RESOLUCAO);
      expect(m.store.classificacao.recusaDaResolucaoPesoAreaEnem()).toBeNull();
    });

    it('trocar para a nota importada e voltar devolve a escolha, sem a recusa', async () => {
      const m = await montarPasso({ antesDeMontar: rascunhoComResolucao(RESOLUCAO) });
      responderPesos(m);
      m.store.classificacao.recusaDaResolucaoPesoAreaEnem.set('Recusa anterior.');

      m.componente.escolherRegraCalculo('CLASSIFICACAO-IMPORTADA|1.0');
      m.fixture.detectChanges();
      m.componente.escolherRegraCalculo('FORMULA-MEDIA-PONDERADA|1.0');
      m.fixture.detectChanges();

      expect(m.store.draft().classificacao.resolucaoPesoAreaEnem).toBe(RESOLUCAO);
      expect(m.store.classificacao.recusaDaResolucaoPesoAreaEnem()).toBeNull();
      expect(seletor(m).value).toBe(RESOLUCAO);
    });
  });

  describe('resolução fora do cadastro', () => {
    it('avisa, continua a oferecê-la e bloqueia o avanço com a pendência no campo', async () => {
      const m = await montarPasso({ antesDeMontar: rascunhoComResolucao('Resolução revogada') });
      responderPesos(m);
      m.store.patchObjectSection('classificacao', {
        regraArredondamentoCodigo: 'ARRED-TRUNCAR',
        regraArredondamentoVersao: '1.0',
        casasArredondamento: '2',
        regraOrdemAlocacaoCodigo: 'ALOCACAO-PRIMEIRA-OPCAO-PRIORITARIA',
        regraOrdemAlocacaoVersao: '1.0',
      });
      m.fixture.detectChanges();

      const opcoes = Array.from(
        m.el.querySelectorAll(`${SELETOR_RESOLUCAO} option`) as NodeListOf<HTMLOptionElement>,
      ).map(texto);
      expect(opcoes).toContain('Resolução revogada (fora do cadastro)');
      expect(texto(m.el)).toContain('não está no cadastro de Peso por Área lido');

      const resultado = m.componente.validar();
      m.fixture.detectChanges();

      expect(resultado.valid).toBe(false);
      expect(resultado.messages).toEqual([
        'A resolução de Peso por Área escolhida não está no cadastro lido. Se ela foi criada ou corrigida agora, use "Atualizar lista" no passo Fórmula; senão, escolha outra.',
      ]);
      expect(seletor(m).getAttribute('aria-invalid')).toBe('true');
      expect(texto(m.el.querySelector('#f-resolucao-peso-area-erro'))).toBe(
        'Esta resolução não está no cadastro lido. Use "Atualizar lista" se ela foi criada agora, ou escolha outra.',
      );
    });
  });

  describe('obrigatoriedade e limpeza', () => {
    it('desmarcar e remarcar o ENEM deixa o seletor vazio, sem a recusa, e bloqueia o avanço', async () => {
      const m = await montarPasso();
      marcarEnemPelaTela(m);
      responderPesos(m);
      escolherNoSeletor(m, RESOLUCAO);
      m.store.classificacao.recusaDaResolucaoPesoAreaEnem.set('Recusa anterior.');

      m.componente.alternarBaseadoEmEnem(false);
      m.fixture.detectChanges();
      expect(m.store.draft().classificacao.resolucaoPesoAreaEnem).toBe('');
      expect(m.store.classificacao.recusaDaResolucaoPesoAreaEnem()).toBeNull();

      m.componente.alternarBaseadoEmEnem(true);
      m.fixture.detectChanges();
      expect(seletor(m).value).toBe('');
      expect(m.componente.validar().valid).toBe(false);
    });

    it('marcado sem escolha, bloqueia o avanço e aponta a pendência no campo', async () => {
      const m = await montarPasso();
      marcarEnemPelaTela(m);
      responderPesos(m);
      m.store.patchObjectSection('classificacao', {
        regraArredondamentoCodigo: 'ARRED-TRUNCAR',
        regraArredondamentoVersao: '1.0',
        casasArredondamento: '2',
        regraOrdemAlocacaoCodigo: 'ALOCACAO-PRIMEIRA-OPCAO-PRIORITARIA',
        regraOrdemAlocacaoVersao: '1.0',
      });

      const resultado = m.componente.validar();
      m.fixture.detectChanges();

      expect(resultado.valid).toBe(false);
      expect(resultado.messages).toEqual([
        'Selecione a resolução de Peso por Área usada na nota, no passo Fórmula.',
      ]);
      const select = seletor(m);
      expect(select.getAttribute('aria-invalid')).toBe('true');
      expect(select.getAttribute('aria-describedby')?.split(' ')).toContain(
        'f-resolucao-peso-area-erro',
      );
      expect(texto(m.el.querySelector('#f-resolucao-peso-area-erro'))).toBe(
        'Selecione a resolução de Peso por Área usada na nota.',
      );

      escolherNoSeletor(m, RESOLUCAO);
      expect(m.componente.validar().valid).toBe(true);
      m.fixture.detectChanges();
      expect(m.el.querySelector('#f-resolucao-peso-area-erro')).toBeNull();
    });
  });

  describe('rótulo, link e lista do cadastro', () => {
    it('o rótulo do checkbox anuncia também a resolução de Peso por Área', async () => {
      const m = await montarPasso();

      expect(texto(m.el.querySelector('label.check-item'))).toContain(
        'define a resolução de Peso por Área',
      );
    });
  });
});
