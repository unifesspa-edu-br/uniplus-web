import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ReleituraDosIdentificadores } from '../cronograma/servicos/releitura-dos-identificadores.service';
import { fase, ID_CPF, proximoPasso } from './fase.testing';
import { usarFase, type ContextoDaFase } from './fase-passo.testing';

describe('Fase embutida: bloqueio da releitura', () => {
  let tela: ContextoDaFase;
  usarFase((contexto) => {
    tela = contexto;
  });

  it.each(['fases', 'etapas'] as const)('suspende e libera as seções para %s', async (escopo) => {
    tela.comCronograma(fase({}));
    tela.documentos().escolherDocumento(ID_CPF);
    const releitura = TestBed.inject(ReleituraDosIdentificadores);
    releitura.pendente.set(escopo);
    tela.detectar();
    await proximoPasso();
    tela.detectar();

    const campo = (seletor: string) => {
      const elemento = tela.nativo.querySelector<HTMLInputElement>(seletor);
      if (elemento === null) throw new Error(`Controle ausente: ${seletor}`);
      return elemento;
    };
    const banca = campo('sel-bancas-da-fase button');
    const publicacao = campo('sel-publicacoes-da-fase button');
    const recurso = campo('#fase-AVALIACAO-admite-recurso');
    const parecer = campo('#fase-AVALIACAO-parecer');
    const documento = campo('sel-documentos-da-fase .campo-com-acao button');
    const busca = campo('sel-documentos-da-fase ui-combobox input');
    expect(tela.componente.formulario()?.disabled).toBe(true);
    for (const controle of [banca, publicacao, recurso, parecer, documento, busca]) {
      expect(controle.disabled).toBe(true);
      controle.click();
    }
    expect(tela.store.draft().cronograma.fases[0].bancasRequeridas).toHaveLength(0);
    expect(tela.store.draft().cronograma.fases[0].produtos).toHaveLength(0);
    expect(tela.documentos().resumos()).toHaveLength(0);

    releitura.pendente.set(null);
    tela.detectar();
    await proximoPasso();
    tela.detectar();
    expect(tela.componente.formulario()?.enabled).toBe(true);
    for (const controle of [banca, publicacao, recurso, parecer, documento, busca]) {
      expect(controle.disabled).toBe(false);
    }
    const tipo = tela.nativo.querySelector<HTMLSelectElement>('sel-lista-de-bancas select');
    if (tipo === null) throw new Error('Seletor de tipo ausente');
    tipo.value = tipo.options[1].value;
    tipo.dispatchEvent(new Event('change'));
    banca.click();
    publicacao.click();
    recurso.click();
    documento.click();
    tela.detectar();
    expect(tela.store.draft().cronograma.fases[0].bancasRequeridas).toHaveLength(1);
    expect(tela.store.draft().cronograma.fases[0].produtos).toHaveLength(1);
    expect(tela.componente.formulario()?.controls.admiteRecurso.value).toBe(true);
    expect(tela.documentos().resumos()).toHaveLength(1);
  });
});
