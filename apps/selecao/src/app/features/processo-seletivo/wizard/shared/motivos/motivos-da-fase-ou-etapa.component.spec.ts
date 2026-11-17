import { describe, expect, it } from 'vitest';

import {
  assentar,
  atualizar,
  caixaDoMotivo,
  CATALOGO_DE_TESTE,
  legendas,
  montarMotivos,
  textoDe,
} from './motivos-da-fase-ou-etapa.testing';
import {
  ETAPA_DA_PROVA,
  FASE_DA_INSCRICAO,
  umMotivoDoCadastro,
  umMotivoNoDocumento,
} from './motivos.testing';

const { cota, empate, renda, semEnem } = CATALOGO_DE_TESTE;

describe('MotivosDaFaseOuEtapaComponent: o que mostra', () => {
  it('mostra os motivos de todos os tipos, os declarados primeiro', async () => {
    const fixture = await montarMotivos({
      catalogo: [semEnem, renda, empate],
      tiposDeclarados: ['CLASSIFICACAO'],
    });

    expect(legendas(fixture)).toEqual([
      'Classificação',
      'Isenção da taxa',
      'Homologação das inscrições',
    ]);
    expect(caixaDoMotivo(fixture, 'SEM_ENEM')).not.toBeNull();
  });

  it('marca o que já está escolhido e mostra o sentido e a subclassificação', async () => {
    const fixture = await montarMotivos({
      catalogo: [semEnem, cota],
      escolhidos: [umMotivoNoDocumento(FASE_DA_INSCRICAO, { codigo: 'FORA_DA_COTA' })],
    });

    expect(caixaDoMotivo(fixture, 'SEM_ENEM')?.checked).toBe(false);
    expect(caixaDoMotivo(fixture, 'FORA_DA_COTA')?.checked).toBe(true);
    expect(textoDe(fixture)).toContain('Desfavorável ao candidato · Cota racial');
  });

  it('mantém marcado o motivo desativado no cadastro e o sinaliza', async () => {
    const desativado = umMotivoDoCadastro({ codigo: 'ANTIGO', descricao: 'Antigo.', ativo: false });
    const fixture = await montarMotivos({
      catalogo: [desativado],
      escolhidos: [umMotivoNoDocumento(FASE_DA_INSCRICAO, { codigo: 'ANTIGO' })],
    });

    expect(caixaDoMotivo(fixture, 'ANTIGO')?.checked).toBe(true);
    expect(textoDe(fixture)).toContain('desativado no cadastro');
  });

  it('não oferece o motivo desativado que não foi escolhido', async () => {
    const desativado = umMotivoDoCadastro({ codigo: 'ANTIGO', ativo: false });

    const fixture = await montarMotivos({ catalogo: [desativado, semEnem] });

    expect(caixaDoMotivo(fixture, 'ANTIGO')).toBeNull();
    expect(caixaDoMotivo(fixture, 'SEM_ENEM')).not.toBeNull();
  });

  it('mostra o motivo escolhido que o cadastro não traz, com a descrição guardada no documento', async () => {
    const fixture = await montarMotivos({
      escolhidos: [
        umMotivoNoDocumento(FASE_DA_INSCRICAO, { codigo: 'OUTRO', descricao: 'Cópia guardada.' }),
      ],
    });

    expect(caixaDoMotivo(fixture, 'OUTRO')?.checked).toBe(true);
    expect(textoDe(fixture)).toContain('Cópia guardada.');
  });

  it('diz que o tipo declarado não tem motivo no cadastro', async () => {
    const fixture = await montarMotivos({
      catalogo: [renda],
      tiposDeclarados: ['GABARITO_DA_PROVA'],
    });

    expect(textoDe(fixture)).toContain('Nenhum motivo deste tipo no cadastro.');
  });

  it('não afirma que falta motivo no cadastro enquanto ele não foi lido', async () => {
    const fixture = await montarMotivos({ catalogoCarregado: false });

    expect(textoDe(fixture)).not.toContain('Nenhum motivo');
  });

  it('identifica a fase no nome acessível da caixa', async () => {
    const fixture = await montarMotivos({ catalogo: [semEnem] });

    expect(caixaDoMotivo(fixture, 'SEM_ENEM')?.labels?.[0]?.textContent).toContain('Sem ENEM.');
    expect(caixaDoMotivo(fixture, 'SEM_ENEM')?.labels?.[0]?.textContent).toContain(
      'Motivo da fase Inscrição',
    );
  });

  it('identifica a etapa no nome acessível da caixa', async () => {
    const fixture = await montarMotivos({
      faseOuEtapa: ETAPA_DA_PROVA,
      nomeDaFaseOuEtapa: 'Prova escrita',
      catalogo: [semEnem],
    });

    expect(caixaDoMotivo(fixture, 'SEM_ENEM')?.labels?.[0]?.textContent).toContain(
      'Motivo da etapa Prova escrita',
    );
  });
});

describe('MotivosDaFaseOuEtapaComponent: tipo que não é declarado', () => {
  const aviso = (fixture: { nativeElement: HTMLElement }) =>
    fixture.nativeElement.querySelector('[role="status"]');

  it('avisa sem bloquear: a caixa do motivo segue habilitada', async () => {
    const fixture = await montarMotivos({ catalogo: [renda], tiposDeclarados: [] });

    expect(aviso(fixture)?.textContent).toContain(
      'Esta fase não declara a decisão “Isenção da taxa”.',
    );
    expect(caixaDoMotivo(fixture, 'RENDA_ALTA', 'ISENCAO_DA_TAXA')?.disabled).toBe(false);
  });

  it('diz que os motivos marcados continuam escolhidos', async () => {
    const fixture = await montarMotivos({
      catalogo: [renda],
      escolhidos: [
        umMotivoNoDocumento(FASE_DA_INSCRICAO, {
          tipoCodigo: 'ISENCAO_DA_TAXA',
          codigo: 'RENDA_ALTA',
        }),
      ],
      tiposDeclarados: [],
    });

    expect(aviso(fixture)?.textContent).toContain('Os motivos marcados continuam escolhidos.');
  });

  it('não diz que há motivo marcado quando não há', async () => {
    const fixture = await montarMotivos({ catalogo: [renda], tiposDeclarados: [] });

    expect(aviso(fixture)?.textContent).not.toContain('continuam escolhidos');
  });

  it('liga o aviso à caixa do motivo do tipo não declarado', async () => {
    const fixture = await montarMotivos({ catalogo: [renda], tiposDeclarados: [] });

    const caixa = caixaDoMotivo(fixture, 'RENDA_ALTA', 'ISENCAO_DA_TAXA');

    expect(caixa?.getAttribute('aria-describedby')).toBe(aviso(fixture)?.id);
  });

  it('não avisa do tipo que a fase declara, e o aviso some ao declarar', async () => {
    const fixture = await montarMotivos({ catalogo: [renda], tiposDeclarados: [] });
    expect(aviso(fixture)).not.toBeNull();

    await atualizar(fixture, { tiposDeclarados: ['ISENCAO_DA_TAXA'] });

    expect(aviso(fixture)).toBeNull();
  });

  it('fala da etapa quando o motivo é de uma etapa', async () => {
    const fixture = await montarMotivos({
      faseOuEtapa: ETAPA_DA_PROVA,
      catalogo: [renda],
      tiposDeclarados: [],
    });

    expect(aviso(fixture)?.textContent).toContain('Esta etapa não declara');
    expect(aviso(fixture)?.textContent).toContain('“Decisões que esta etapa toma”');
  });
});

describe('MotivosDaFaseOuEtapaComponent: consulta', () => {
  const guardado = umMotivoNoDocumento(FASE_DA_INSCRICAO, {
    codigo: 'FORA_DA_COTA',
    descricao: 'Cópia guardada.',
    sentido: 'FAVORAVEL',
    subclassificacao: 'Cota racial',
  });

  it('lê a cópia do documento, sem caixas nem o cadastro vivo', async () => {
    const fixture = await montarMotivos({
      modo: 'consulta',
      catalogo: [cota, semEnem],
      escolhidos: [guardado],
    });

    expect(fixture.nativeElement.querySelector('input[type="checkbox"]')).toBeNull();
    expect(textoDe(fixture)).toContain('Cópia guardada. (Favorável ao candidato · Cota racial)');
    expect(textoDe(fixture)).not.toContain('Fora da cota.');
    expect(textoDe(fixture)).not.toContain('Sem ENEM.');
  });

  it('diz que nenhum motivo foi escolhido no tipo declarado vazio', async () => {
    const fixture = await montarMotivos({ modo: 'consulta' });

    expect(textoDe(fixture)).toContain('Nenhum motivo escolhido');
  });

  it('diz que nenhum motivo foi escolhido quando a fase não declara nada nem escolheu', async () => {
    const fixture = await montarMotivos({ modo: 'consulta', tiposDeclarados: [] });

    expect(textoDe(fixture)).toContain('Nenhum motivo escolhido.');
  });

  it('segue avisando do tipo não declarado que tem motivo escolhido', async () => {
    const fixture = await montarMotivos({
      modo: 'consulta',
      escolhidos: [guardado],
      tiposDeclarados: [],
    });

    expect(fixture.nativeElement.querySelector('[role="status"]')?.textContent).toContain(
      'Os motivos marcados continuam escolhidos.',
    );
  });
});

describe('MotivosDaFaseOuEtapaComponent: título', () => {
  it('usa o nível de título que quem mostra a seção pede', async () => {
    const fixture = await montarMotivos({});
    fixture.componentRef.setInput('nivelDoTitulo', 3);
    await assentar(fixture);

    expect(fixture.nativeElement.querySelector('h3#motivos-titulo')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('h4')).toBeNull();
  });

  it('põe o título em nível 4 por padrão', async () => {
    const fixture = await montarMotivos({});

    expect(fixture.nativeElement.querySelector('h4#motivos-titulo')).not.toBeNull();
  });
});
