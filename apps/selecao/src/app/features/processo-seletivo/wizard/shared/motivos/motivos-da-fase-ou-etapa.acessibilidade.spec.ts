import axe from 'axe-core';
import { describe, expect, it } from 'vitest';

import {
  caixaDoMotivo,
  montarMotivos,
  type EntradasDosMotivos,
  type FixtureDosMotivos,
} from './motivos-da-fase-ou-etapa.testing';
import {
  ETAPA_DA_PROVA,
  FASE_DA_INSCRICAO,
  umMotivoDoCadastro,
  umMotivoNoDocumento,
} from './motivos.testing';

const catalogo = [
  umMotivoDoCadastro({ codigo: 'SEM_ENEM', descricao: 'Sem ENEM.' }),
  umMotivoDoCadastro({
    tipo: 'CLASSIFICACAO',
    codigo: 'EMPATE',
    descricao: 'Empate na nota.',
    subclassificacao: 'Cota racial',
  }),
  umMotivoDoCadastro({ codigo: 'ANTIGO', descricao: 'Antigo.', ativo: false }),
];
const escolhidos = [
  umMotivoNoDocumento(FASE_DA_INSCRICAO, { codigo: 'SEM_ENEM', descricao: 'Sem ENEM.' }),
  umMotivoNoDocumento(FASE_DA_INSCRICAO, { codigo: 'ANTIGO', descricao: 'Antigo.' }),
];

const violacoes = async (fixture: FixtureDosMotivos) =>
  (await axe.run(fixture.nativeElement, { rules: { region: { enabled: false } } })).violations;

const comCenario = (entradas: Partial<EntradasDosMotivos>) =>
  montarMotivos({ catalogo, escolhidos, ...entradas });

describe('MotivosDaFaseOuEtapaComponent: acessibilidade', () => {
  it('não tem violações com tipo declarado, tipo não declarado, aviso e motivo desativado', async () => {
    const fixture = await comCenario({ tiposDeclarados: ['HOMOLOGACAO_DAS_INSCRICOES'] });

    expect(fixture.nativeElement.querySelector('[role="status"]')).not.toBeNull();
    expect(await violacoes(fixture)).toEqual([]);
  });

  it('não tem violações com a recusa ligada ao motivo', async () => {
    const fixture = await comCenario({ recusas: [{ motivoRepetido: escolhidos[0] }] });

    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    expect(await violacoes(fixture)).toEqual([]);
  });

  it('não tem violações com as caixas desabilitadas', async () => {
    const fixture = await comCenario({ modo: 'bloqueado' });

    expect(await violacoes(fixture)).toEqual([]);
  });

  it('não tem violações na consulta', async () => {
    const fixture = await comCenario({ modo: 'consulta' });

    expect(await violacoes(fixture)).toEqual([]);
  });

  it('não tem violações numa etapa, com o título no nível 3', async () => {
    const fixture = await comCenario({
      faseOuEtapa: ETAPA_DA_PROVA,
      nomeDaFaseOuEtapa: 'Prova escrita',
      escolhidos: [],
    });
    fixture.componentRef.setInput('nivelDoTitulo', 3);
    fixture.detectChanges();

    expect(await violacoes(fixture)).toEqual([]);
  });

  it('dá a cada caixa um nome acessível que identifica o motivo e a fase', async () => {
    const fixture = await comCenario({});

    const caixas = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    const nomes = Array.from(caixas, (caixa) => caixa.labels?.[0]?.textContent ?? '');

    expect(nomes.length).toBeGreaterThan(0);
    for (const nome of nomes) expect(nome).toContain('Motivo da fase Inscrição');
    expect(caixaDoMotivo(fixture, 'SEM_ENEM')?.labels?.[0]?.textContent).toContain('Sem ENEM.');
  });

  it('dá a cada grupo de caixas uma legenda', async () => {
    const fixture = await comCenario({});

    const grupos = fixture.nativeElement.querySelectorAll('fieldset');

    expect(grupos.length).toBeGreaterThan(0);
    for (const grupo of grupos)
      expect(grupo.querySelector('legend')?.textContent?.trim()).not.toBe('');
  });
});
