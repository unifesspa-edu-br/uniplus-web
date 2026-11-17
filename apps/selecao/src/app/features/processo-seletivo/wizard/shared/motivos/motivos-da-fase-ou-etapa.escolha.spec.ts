import { beforeEach, describe, expect, it } from 'vitest';

import {
  assentar,
  atualizar,
  caixaDoMotivo,
  CATALOGO_DE_TESTE,
  montarMotivos,
} from './motivos-da-fase-ou-etapa.testing';
import {
  ETAPA_DA_PROVA,
  FASE_DA_INSCRICAO,
  umMotivoDoCadastro,
  umMotivoNoDocumento,
} from './motivos.testing';

const HOMOLOGACAO = 'HOMOLOGACAO_DAS_INSCRICOES';
const { cota, semEnem } = CATALOGO_DE_TESTE;

describe('MotivosDaFaseOuEtapaComponent: escolher e retirar', () => {
  let pedidosDeEscolha: unknown[];
  let pedidosDeRetirada: unknown[];

  async function montarComEventos(entradas: Parameters<typeof montarMotivos>[0]) {
    pedidosDeEscolha = [];
    pedidosDeRetirada = [];
    const fixture = await montarMotivos(entradas);
    fixture.componentInstance.escolher.subscribe((motivo) => pedidosDeEscolha.push(motivo));
    fixture.componentInstance.retirar.subscribe((motivo) => pedidosDeRetirada.push(motivo));
    return fixture;
  }

  beforeEach(() => {
    pedidosDeEscolha = [];
    pedidosDeRetirada = [];
  });

  it('pede para escolher o motivo da fase, com a referência e a cópia do cadastro', async () => {
    const fixture = await montarComEventos({ catalogo: [cota] });

    caixaDoMotivo(fixture, 'FORA_DA_COTA')?.click();

    expect(pedidosDeEscolha).toEqual([
      {
        faseChave: 'inscricao',
        tipoCodigo: HOMOLOGACAO,
        codigo: 'FORA_DA_COTA',
        descricao: 'Fora da cota.',
        sentido: 'DESFAVORAVEL',
        subclassificacao: 'Cota racial',
      },
    ]);
  });

  it('pede para escolher o motivo da etapa pela chave da etapa', async () => {
    const fixture = await montarComEventos({ faseOuEtapa: ETAPA_DA_PROVA, catalogo: [semEnem] });

    caixaDoMotivo(fixture, 'SEM_ENEM')?.click();

    expect(pedidosDeEscolha).toEqual([
      expect.objectContaining({ etapaChave: 'prova-escrita', codigo: 'SEM_ENEM' }),
    ]);
    expect(pedidosDeEscolha[0]).not.toHaveProperty('faseChave');
  });

  it('pede para retirar o motivo marcado, só com a identidade', async () => {
    const fixture = await montarComEventos({
      catalogo: [semEnem],
      escolhidos: [umMotivoNoDocumento(FASE_DA_INSCRICAO, { codigo: 'SEM_ENEM' })],
    });

    caixaDoMotivo(fixture, 'SEM_ENEM')?.click();

    expect(pedidosDeRetirada).toEqual([
      { faseChave: 'inscricao', tipoCodigo: HOMOLOGACAO, codigo: 'SEM_ENEM' },
    ]);
    expect(pedidosDeEscolha).toEqual([]);
  });

  it('volta a caixa ao que o documento guarda quando o pedido não é atendido', async () => {
    const fixture = await montarComEventos({ catalogo: [semEnem] });

    caixaDoMotivo(fixture, 'SEM_ENEM')?.click();
    await assentar(fixture);

    expect(caixaDoMotivo(fixture, 'SEM_ENEM')?.checked).toBe(false);
  });

  it('marca a caixa quando o documento passa a guardar o motivo', async () => {
    const fixture = await montarComEventos({ catalogo: [semEnem] });

    caixaDoMotivo(fixture, 'SEM_ENEM')?.click();
    await atualizar(fixture, {
      escolhidos: [umMotivoNoDocumento(FASE_DA_INSCRICAO, { codigo: 'SEM_ENEM' })],
    });

    expect(caixaDoMotivo(fixture, 'SEM_ENEM')?.checked).toBe(true);
  });

  it('não deixa escolher nem retirar com a edição travada', async () => {
    const fixture = await montarComEventos({
      catalogo: [cota, semEnem],
      escolhidos: [umMotivoNoDocumento(FASE_DA_INSCRICAO, { codigo: 'SEM_ENEM' })],
      modo: 'bloqueado',
    });

    caixaDoMotivo(fixture, 'FORA_DA_COTA')?.click();
    caixaDoMotivo(fixture, 'SEM_ENEM')?.click();

    expect(caixaDoMotivo(fixture, 'FORA_DA_COTA')?.disabled).toBe(true);
    expect(caixaDoMotivo(fixture, 'SEM_ENEM')?.disabled).toBe(true);
    expect(pedidosDeEscolha).toEqual([]);
    expect(pedidosDeRetirada).toEqual([]);
  });

  it('mantém o foco na caixa que segue na tela depois de retirar', async () => {
    const escolhidos = [umMotivoNoDocumento(FASE_DA_INSCRICAO, { codigo: 'SEM_ENEM' })];
    const fixture = await montarComEventos({ catalogo: [semEnem], escolhidos });
    caixaDoMotivo(fixture, 'SEM_ENEM')?.focus();

    caixaDoMotivo(fixture, 'SEM_ENEM')?.click();
    await atualizar(fixture, { escolhidos: [] });

    expect(document.activeElement).toBe(caixaDoMotivo(fixture, 'SEM_ENEM'));
  });

  it('leva o foco ao título da seção quando a caixa retirada sai da tela', async () => {
    const desativado = umMotivoDoCadastro({ codigo: 'ANTIGO', ativo: false });
    const escolhidos = [umMotivoNoDocumento(FASE_DA_INSCRICAO, { codigo: 'ANTIGO' })];
    const fixture = await montarComEventos({ catalogo: [desativado], escolhidos });
    caixaDoMotivo(fixture, 'ANTIGO')?.focus();

    caixaDoMotivo(fixture, 'ANTIGO')?.click();
    await atualizar(fixture, { escolhidos: [] });

    expect(caixaDoMotivo(fixture, 'ANTIGO')).toBeNull();
    expect(document.activeElement?.id).toBe('motivos-titulo');
  });

  it('não anuncia o resultado da escolha numa região de leitor de tela', async () => {
    const fixture = await montarComEventos({ catalogo: [semEnem] });

    caixaDoMotivo(fixture, 'SEM_ENEM')?.click();
    await assentar(fixture);

    expect(fixture.nativeElement.querySelector('[aria-live]')).toBeNull();
  });
});

describe('MotivosDaFaseOuEtapaComponent: recusa da escolha', () => {
  const repetido = umMotivoNoDocumento(FASE_DA_INSCRICAO, { codigo: 'SEM_ENEM' });

  it('mostra a recusa numa região de alerta ligada ao motivo', async () => {
    const fixture = await montarMotivos({
      catalogo: [semEnem],
      escolhidos: [repetido],
      recusas: [{ motivoRepetido: repetido }],
    });

    const alerta = fixture.nativeElement.querySelector('[role="alert"]');
    const caixa = caixaDoMotivo(fixture, 'SEM_ENEM');

    expect(alerta?.textContent).toContain('Este motivo já está escolhido nesta fase.');
    expect(caixa?.getAttribute('aria-describedby')).toBe(alerta?.id);
    expect(caixa?.getAttribute('aria-invalid')).toBe('true');
  });

  it('não mostra a recusa do mesmo motivo em outra fase', async () => {
    const naMatricula = umMotivoNoDocumento({ faseChave: 'matricula' }, { codigo: 'SEM_ENEM' });

    const fixture = await montarMotivos({
      catalogo: [semEnem],
      escolhidos: [repetido],
      recusas: [{ motivoRepetido: naMatricula }],
    });

    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });

  it('fala da etapa na recusa de um motivo de etapa', async () => {
    const naProva = umMotivoNoDocumento(ETAPA_DA_PROVA, { codigo: 'SEM_ENEM' });

    const fixture = await montarMotivos({
      faseOuEtapa: ETAPA_DA_PROVA,
      catalogo: [semEnem],
      escolhidos: [naProva],
      recusas: [{ motivoRepetido: naProva }],
    });

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'nesta etapa',
    );
  });
});
