import { HttpHeaders } from '@angular/common/http';
import { Component, signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { type Observable, of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type ApiResult, apiFailure, apiOk } from '@uniplus/shared-core/http';
import type { ComprovanteDaInscricaoDto } from '@uniplus/shared-data/selecao';
import { AnuncioDaConclusao } from '@uniplus/shared-ui/components';
import { cpfRevelavel } from '@uniplus/shared-utils';

import { AcaoDaCorrecaoDirective } from './acao-da-correcao.directive';
import {
  ComprovanteDoEnvioComponent,
  type FonteDoComprovante,
} from './comprovante-do-envio.component';
import type { RecusasDoComprovante } from './recusas-do-comprovante';

const SEM_CABECALHOS = new HttpHeaders();
const FUSO = { id: 'America/Belem', nome: 'Belém (PA)' };
const AVISO = 'Documento sem validade: inscrição cancelada em 07/11/2026 às 22:32:05';
const NAO_ENCONTRADO = { titulo: 'Não achei', texto: 'Texto de não encontrado.' };
const RECUSAS: RecusasDoComprovante = {
  naoEncontrado: NAO_ENCONTRADO,
  explicar: (problema) =>
    problema.status === 403 ? { titulo: 'Sem acesso', texto: 'Texto de sem acesso.' } : null,
};

/** O envio 2 de 2 (o que vale) de Fernanda Drumond, persona fictícia do portal de documentação. */
function comprovanteBase(): ComprovanteDaInscricaoDto {
  return {
    inscricaoId: '0199e000-0000-7000-8000-0000000000e1',
    numero: 2,
    total: 2,
    vale: true,
    numeroAnterior: 1,
    numeroSeguinte: null,
    processoSeletivoId: '0199e000-0000-7000-8000-0000000000d1',
    nomeDoProcesso: 'Medicina 2027',
    identificadorDoProcesso: null,
    unidadeAdministradora: 'Centro de Processos Seletivos',
    envio: {
      numeroInscricao: '2027-000042',
      enviadoEm: '2026-12-11T13:30:00Z',
      fusoHorario: FUSO,
      hashIntegridade: 'a'.repeat(64),
    },
    candidato: {
      nomeCivil: 'Fernanda Laura Nicole Drumond',
      nomeSocial: null,
      usaNomeSocial: false,
      cpfMascarado: '***.598.363-**',
    },
    prazoDaCorrecao: { fim: '2026-12-20T02:59:00Z', fusoHorario: FUSO, aberto: true },
    numeroDeOpcoesDeCurso: 1,
    opcoesDeCurso: [{ ordem: 1, nome: 'Direito — Campus Marabá', modalidades: null }],
    secoes: [],
    derivados: [],
    termosAceitos: [],
    documentos: [],
  };
}

const ok = (c: Partial<ComprovanteDaInscricaoDto> = {}): ApiResult<ComprovanteDaInscricaoDto> =>
  apiOk({ ...comprovanteBase(), ...c }, 200, SEM_CABECALHOS);
const falha = (status: number): ApiResult<ComprovanteDaInscricaoDto> =>
  apiFailure(
    { type: 'about:blank', title: 'Falha', status, code: 'x', traceId: '' },
    status,
    SEM_CABECALHOS,
  );

@Component({
  standalone: true,
  imports: [ComprovanteDoEnvioComponent, AcaoDaCorrecaoDirective],
  template: `
    <insc-comprovante-do-envio
      titulo="Comprovante de teste"
      descricao="Descrição de teste."
      [fonte]="fonte()"
      [numero]="numero()"
      [recusas]="recusas"
      [rotaDoEnvio]="rotaDoEnvio"
      [cpf]="cpf()"
    >
      <a inscAcaoDoDocumento href="#volta">Voltar de teste</a>
      <ng-template inscAcaoDaCorrecao let-c
        ><a href="#corrigir">Corrigir {{ c.numero }}</a></ng-template
      >
    </insc-comprovante-do-envio>
  `,
})
class Hospedeiro {
  readonly fonte = signal<FonteDoComprovante>(() => of(ok()));
  readonly numero = signal('2');
  readonly cpf = signal<ReturnType<typeof cpfRevelavel> | null>(null);
  readonly recusas = RECUSAS;
  readonly rotaDoEnvio = (numero: number): readonly unknown[] => ['/envio', numero];
}

let fixture: ComponentFixture<Hospedeiro>;
const tela = (): HTMLElement => fixture.nativeElement as HTMLElement;
const texto = (): string => tela().textContent?.replace(/\s+/g, ' ') ?? '';

async function atualizar(): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  await new Promise((resolver) => setTimeout(resolver));
  fixture.detectChanges();
}

async function abrir(fonte?: FonteDoComprovante): Promise<Hospedeiro> {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  fixture = TestBed.createComponent(Hospedeiro);
  if (fonte) fixture.componentInstance.fonte.set(fonte);
  await atualizar();
  return fixture.componentInstance;
}

const de = (resultado: ApiResult<ComprovanteDaInscricaoDto>) => (): Observable<typeof resultado> =>
  of(resultado);
const botaoDeTentar = (): HTMLButtonElement | undefined =>
  Array.from(tela().querySelectorAll('button')).find(
    (b) => b.textContent?.trim() === 'Tentar novamente',
  );
const aviso = (): string | null =>
  tela().querySelector('.documento__aviso')?.textContent?.trim() ?? null;
const href = (rotulo: string): string | null | undefined =>
  Array.from(tela().querySelectorAll('a'))
    .find((a) => a.textContent?.trim() === rotulo)
    ?.getAttribute('href');

describe('ComprovanteDoEnvioComponent', () => {
  afterEach(() => vi.restoreAllMocks());

  it('lê uma única vez, pelo número do endereço, e mostra o documento com as ações', async () => {
    const fonte = vi.fn(de(ok()));

    await abrir(fonte);

    expect(fonte).toHaveBeenCalledExactlyOnceWith(2);
    expect(tela().querySelector('h1')?.textContent).toContain('Comprovante de teste');
    expect(texto()).toContain('Descrição de teste.');
    expect(texto()).toContain('2027-000042');
    expect(texto()).toContain('Imprimir comprovante');
    expect(href('Voltar de teste')).toBe('#volta');
    expect(aviso()).toBeNull();
  });

  it('leva o foco ao título quando o comprovante carrega', async () => {
    await abrir();

    expect(document.activeElement).toBe(tela().querySelector('h1'));
  });

  it('entrega o comprovante à ação da correção, só com o prazo aberto', async () => {
    await abrir();
    expect(href('Corrigir 2')).toBe('#corrigir');
    TestBed.resetTestingModule();

    await abrir(
      de(
        ok({ prazoDaCorrecao: { fim: '2026-12-20T02:59:00Z', fusoHorario: FUSO, aberto: false } }),
      ),
    );
    expect(href('Corrigir 2')).toBeUndefined();
  });

  describe('aviso de validade', () => {
    const cancelamento = { canceladaEm: '2026-11-08T01:32:05Z', motivo: null, aviso: AVISO };

    it('aparece na tarja e na marca quando o comprovante traz o cancelamento', async () => {
      await abrir(de(ok({ cancelamento })));

      expect(aviso()).toBe(AVISO);
      expect(tela().querySelector('.documento__aviso-marca')?.textContent?.trim()).toBe(AVISO);
    });

    it('some ao trocar para um envio sem cancelamento', async () => {
      const pagina = await abrir(de(ok({ cancelamento })));

      pagina.fonte.set(de(ok({ numero: 1 })));
      pagina.numero.set('1');
      await atualizar();

      expect(aviso()).toBeNull();
      expect(tela().querySelector('.documento__aviso-marca')).toBeNull();
    });

    it('não sobrevive a uma recusa', async () => {
      const pagina = await abrir(de(ok({ cancelamento })));

      pagina.fonte.set(de(falha(403)));
      await atualizar();

      expect(texto()).toContain('Sem acesso');
      expect(aviso()).toBeNull();
    });
  });

  it('o envio substituído avisa e aponta o último pela rota do app', async () => {
    await abrir(de(ok({ vale: false, numeroSeguinte: 2, numeroAnterior: null, total: 3 })));

    expect(texto()).toContain('Este envio foi substituído por um mais recente');
    expect(texto()).toContain('A inscrição que vale é a última enviada');
    expect(href('Ver o envio mais recente')).toBe('/envio/3');
  });

  it('no envio substituído de inscrição cancelada, não diz que a última vale', async () => {
    const cancelamento = { canceladaEm: '2026-11-08T01:32:05Z', motivo: null, aviso: 'Documento sem validade.' };
    await abrir(de(ok({ vale: false, numeroSeguinte: 2, numeroAnterior: null, total: 3, cancelamento, prazoDaCorrecao: null })));

    expect(texto()).toContain('Este envio foi substituído por um mais recente');
    expect(texto()).not.toContain('A inscrição que vale é a última enviada');
  });

  describe('recusas', () => {
    it('a que o app traduz termina na explicação, sem nova tentativa nem impressão', async () => {
      await abrir(de(falha(403)));

      expect(texto()).toContain('Sem acesso');
      expect(texto()).toContain('Texto de sem acesso.');
      expect(botaoDeTentar()).toBeUndefined();
      expect(texto()).not.toContain('Imprimir comprovante');
    });

    it('o número que não é inteiro positivo usa o texto de não encontrado, sem ler', async () => {
      const fonte = vi.fn(de(ok()));
      TestBed.configureTestingModule({ providers: [provideRouter([])] });
      fixture = TestBed.createComponent(Hospedeiro);
      fixture.componentInstance.fonte.set(fonte);
      fixture.componentInstance.numero.set('abc');
      await atualizar();

      expect(texto()).toContain('Não achei');
      expect(fonte).not.toHaveBeenCalled();
    });

    it('a que o app não traduz segue como falha, com nova tentativa', async () => {
      await abrir(de(falha(422)));

      expect(botaoDeTentar()).toBeDefined();
      expect(texto()).not.toContain('Imprimir comprovante');
    });
  });

  describe('nova tentativa depois da falha', () => {
    const apertarTentarDeNovo = async (): Promise<void> => {
      botaoDeTentar()?.click();
      await atualizar();
      await atualizar();
    };

    it('a leitura que dá certo tira o alerta e deixa o foco no título, sem somar o aviso de conclusão', async () => {
      const fonte = vi.fn(de(ok())).mockReturnValueOnce(of(falha(503)));
      await abrir(fonte);
      const anunciar = vi.spyOn(TestBed.inject(AnuncioDaConclusao), 'anunciar');
      (botaoDeTentar() as HTMLButtonElement).focus();

      await apertarTentarDeNovo();

      expect(tela().querySelector('.alert__title')).toBeNull();
      expect(texto()).toContain('Imprimir comprovante');
      expect(document.activeElement).toBe(tela().querySelector('h1'));
      expect(anunciar).not.toHaveBeenCalled();
    });

    it('503 seguido de recusa termina na explicação, sem botão e sem aviso de conclusão', async () => {
      const fonte = vi
        .fn(de(ok()))
        .mockReturnValueOnce(of(falha(503)))
        .mockReturnValueOnce(of(falha(403)));
      await abrir(fonte);
      const anunciar = vi.spyOn(TestBed.inject(AnuncioDaConclusao), 'anunciar');

      await apertarTentarDeNovo();

      expect(texto()).toContain('Sem acesso');
      expect(botaoDeTentar()).toBeUndefined();
      expect(anunciar).not.toHaveBeenCalled();
    });
  });

  describe('CPF', () => {
    it('revela para o titular quando o CPF do login confere com o mascarado do comprovante', async () => {
      const pagina = await abrir();
      pagina.cpf.set(cpfRevelavel('69959836371'));
      await atualizar();

      expect(tela().querySelector('ui-dado-revelavel')).not.toBeNull();
    });

    it('mantém o mascarado quando o CPF é de outra pessoa', async () => {
      const pagina = await abrir();
      pagina.cpf.set(cpfRevelavel('11144477735'));
      await atualizar();

      expect(tela().querySelector('ui-dado-revelavel')).toBeNull();
      expect(texto()).toContain('***.598.363-**');
    });
  });
});
