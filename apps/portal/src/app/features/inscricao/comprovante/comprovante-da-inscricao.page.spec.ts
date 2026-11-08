import { HttpHeaders } from '@angular/common/http';
import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { type Observable, of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UserContextService } from '@uniplus/shared-auth/bootstrap';
import { type ApiResult, apiFailure, apiOk } from '@uniplus/shared-core/http';
import type { ComprovanteDaInscricaoDto } from '@uniplus/shared-data/selecao';
import { AnuncioDaConclusao } from '@uniplus/shared-ui/components';

import { MinhasInscricoesService } from '../minhas-inscricoes.service';
import { ComprovanteDaInscricaoPage } from './comprovante-da-inscricao.page';

const SEM_CABECALHOS = new HttpHeaders();
const INSCRICAO_ID = '0199e000-0000-7000-8000-0000000000e1';
const PROCESSO = '0199e000-0000-7000-8000-0000000000d1';
const HASH = 'f0e1d2c3b4a5968778695a4b3c2d1e0f00112233445566778899aabbccddeeff';
const FUSO = { id: 'America/Belem', nome: 'Belém (PA)' };

/** Fernanda Drumond, persona fictícia do portal de documentação. */
const CPF_DA_CONTA = '69959836371';
const cpfDoLogin = signal(CPF_DA_CONTA);
const usuario = { user: () => ({ cpf: cpfDoLogin() }) };

/** O envio 2 de 2 (o que vale) de Fernanda Drumond, que prefere o nome social. */
function comprovanteBase(): ComprovanteDaInscricaoDto {
  return {
    inscricaoId: INSCRICAO_ID,
    numero: 2,
    total: 2,
    vale: true,
    numeroAnterior: 1,
    numeroSeguinte: null,
    processoSeletivoId: PROCESSO,
    nomeDoProcesso: 'Medicina 2027',
    identificadorDoProcesso: 'Edital 001/2026',
    unidadeAdministradora: 'Centro de Processos Seletivos',
    envio: {
      numeroInscricao: '2027-000042',
      enviadoEm: '2026-12-11T13:30:00Z',
      fusoHorario: FUSO,
      hashIntegridade: 'a'.repeat(64),
    },
    candidato: {
      nomeCivil: 'Fernanda Laura Nicole Drumond',
      nomeSocial: 'Ariel Drumond',
      usaNomeSocial: true,
      cpfMascarado: '***.598.363-**',
    },
    prazoDaCorrecao: { fim: '2026-12-20T02:59:00Z', fusoHorario: FUSO, aberto: true },
    numeroDeOpcoesDeCurso: 1,
    opcoesDeCurso: [
      {
        ordem: 1,
        nome: 'Direito (Bacharelado) — Campus Marabá',
        modalidades: [
          { codigo: 'LI_EP', nome: 'Escola pública, independente de renda', ordem: 1 },
          { codigo: 'AC', nome: 'Ampla concorrência', ordem: 0 },
        ],
      },
    ],
    secoes: [
      {
        codigo: 'DADOS_BASICOS',
        titulo: 'Dados do candidato',
        itens: [
          {
            rotulo: 'Município de nascimento',
            descricao: '',
            tipo: 'opcao',
            componente: 'padrao',
            valor: { codigo: '2927408', rotulo: 'Salvador' },
          },
          {
            rotulo: 'Data de nascimento',
            descricao: '',
            tipo: 'data',
            componente: 'padrao',
            valor: '2001-03-09',
          },
        ],
        grupos: [
          {
            codigo: 'FAMILIA',
            rotulo: 'Composição familiar',
            ocorrencias: [
              {
                id: 'o1',
                titulo: 'Você (candidato)',
                itens: [
                  {
                    rotulo: 'Renda mensal',
                    descricao: '',
                    tipo: 'numero',
                    componente: 'moeda',
                    valor: '1234.5',
                  },
                ],
              },
              {
                id: 'o2',
                titulo: 'Integrante 1',
                itens: [
                  {
                    rotulo: 'Renda mensal',
                    descricao: '',
                    tipo: 'numero',
                    componente: 'moeda',
                    valor: '800',
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    derivados: [
      {
        rotulo: 'Faixa etária',
        descricao: '',
        tipo: 'texto',
        componente: 'padrao',
        valor: '25 a 29 anos',
      },
    ],
    termosAceitos: [
      { codigo: 'VERACIDADE', nome: 'Declaração de veracidade', versaoId: 'v1', hashVersao: 'h1' },
    ],
    documentos: [],
  };
}

let alteracoes: Partial<ComprovanteDaInscricaoDto> = {};
const comprovanteDe = (): ComprovanteDaInscricaoDto => ({ ...comprovanteBase(), ...alteracoes });

function falha(
  status: number,
  code: string,
  title = 'Falha',
): ApiResult<ComprovanteDaInscricaoDto> {
  return apiFailure(
    { type: 'about:blank', title, status, code, traceId: '' },
    status,
    SEM_CABECALHOS,
  );
}

const servico = {
  comprovante: (_: string, numero: number): Observable<ApiResult<ComprovanteDaInscricaoDto>> =>
    of(apiOk({ ...comprovanteDe(), numero }, 200, SEM_CABECALHOS)),
};

let fixture: ComponentFixture<ComprovanteDaInscricaoPage>;

async function abrir(numero = '2'): Promise<HTMLElement> {
  TestBed.configureTestingModule({
    imports: [ComprovanteDaInscricaoPage],
    providers: [
      provideRouter([]),
      { provide: MinhasInscricoesService, useValue: servico },
      { provide: UserContextService, useValue: usuario },
    ],
  });
  fixture = TestBed.createComponent(ComprovanteDaInscricaoPage);
  fixture.componentRef.setInput('inscricaoId', INSCRICAO_ID);
  fixture.componentRef.setInput('numero', numero);
  await atualizar();
  return fixture.nativeElement as HTMLElement;
}

async function atualizar(): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

const macrotarefa = (): Promise<void> => new Promise((resolver) => setTimeout(resolver));

const links = (tela: HTMLElement): string[] =>
  Array.from(tela.querySelectorAll('nav a')).map((a) => a.textContent?.trim() ?? '');

const hrefDe = (tela: HTMLElement, texto: string): string | null | undefined =>
  Array.from(tela.querySelectorAll('a'))
    .find((a) => a.textContent?.trim() === texto)
    ?.getAttribute('href');

/** A seção do comprovante pelo título dela. */
const secao = (tela: HTMLElement, titulo: string): HTMLElement | null =>
  (Array.from(tela.querySelectorAll('ui-secao-de-documento')).find(
    (s) => s.querySelector('.secao-de-documento__titulo')?.textContent?.trim() === titulo,
  ) as HTMLElement | undefined) ?? null;

const dado = (tela: Element, rotulo: string): string | null => {
  const par = Array.from(tela.querySelectorAll('dl > div')).find(
    (d) => d.querySelector('dt')?.textContent?.trim() === rotulo,
  );
  return par?.querySelector('dd')?.textContent?.trim().replace(/\s+/g, ' ') ?? null;
};

const botaoDeTentar = (tela: HTMLElement): HTMLButtonElement | undefined =>
  Array.from(tela.querySelectorAll('button')).find(
    (botao) => botao.textContent?.trim() === 'Tentar novamente',
  );

describe('ComprovanteDaInscricaoPage', () => {
  afterEach(() => {
    cpfDoLogin.set(CPF_DA_CONTA);
    alteracoes = {};
    vi.restoreAllMocks();
  });

  describe('exibição do que a API devolve', () => {
    it('lê o comprovante uma única vez, pelo id da inscrição e pelo número da rota', async () => {
      const ler = vi.spyOn(servico, 'comprovante');

      await abrir('2');

      expect(ler).toHaveBeenCalledExactlyOnceWith(INSCRICAO_ID, 2);
    });

    it('mostra o processo, o número da inscrição e o instante do envio no fuso, com o nome dele', async () => {
      const tela = await abrir();

      expect(tela.querySelector('.secao-de-documento__titulo')?.textContent).toContain(
        'Medicina 2027',
      );
      expect(dado(tela, 'Número da inscrição')).toBe('2027-000042');
      expect(dado(tela, 'Enviado em')).toBe('11/12/2026, 10:30, horário de Belém (PA)');
    });

    it('mostra o identificador do processo e a unidade administradora congelados', async () => {
      const tela = await abrir();

      expect(secao(tela, 'Medicina 2027')?.textContent?.replace(/\s+/g, ' ')).toContain(
        'Processo Edital 001/2026 · Centro de Processos Seletivos',
      );
    });

    it('sem identificador do processo, mostra só a unidade', async () => {
      alteracoes = { identificadorDoProcesso: null };
      const tela = await abrir();

      const texto = secao(tela, 'Medicina 2027')?.textContent?.replace(/\s+/g, ' ') ?? '';
      expect(texto).toContain('Centro de Processos Seletivos');
      expect(texto).not.toContain('Processo ·');
      expect(texto).not.toContain('Edital 001/2026');
    });

    it('mostra as seções e os grupos com o rótulo e o valor formatado pelo tipo, sem o código', async () => {
      const tela = await abrir();

      const dados = secao(tela, 'Dados do candidato') as HTMLElement;
      expect(dado(dados, 'Município de nascimento')).toBe('Salvador');
      expect(dado(dados, 'Data de nascimento')).toBe('09/03/2001');
      expect(tela.textContent).not.toContain('2927408');
      const familia = secao(tela, 'Composição familiar') as HTMLElement;
      const ocorrencias = Array.from(familia.querySelectorAll('ui-secao-de-documento'));
      expect(ocorrencias.map((o) => dado(o, 'Renda mensal'))).toEqual(['R$ 1.234,50', 'R$ 800,00']);
      expect(familia.textContent).toContain('Integrante 1');
    });

    it('mostra o que o sistema calculou, sem a seção quando nada foi calculado', async () => {
      const comCalculo = await abrir();
      expect(dado(secao(comCalculo, 'Calculado pelo sistema') as HTMLElement, 'Faixa etária')).toBe(
        '25 a 29 anos',
      );
      TestBed.resetTestingModule();

      alteracoes = { derivados: [] };
      const semCalculo = await abrir();

      expect(secao(semCalculo, 'Calculado pelo sistema')).toBeNull();
    });

    it('lista os termos aceitos pelo nome e a data do aceite no fuso do envio', async () => {
      const tela = await abrir();

      const termos = secao(tela, 'Termos aceitos') as HTMLElement;
      expect(termos.querySelector('li')?.textContent).toBe('Declaração de veracidade');
      expect(termos.textContent).toContain('Aceitos no envio de 11/12/2026');
    });

    it('a seção sem título na API aparece como "Outras informações"', async () => {
      const [secao0] = comprovanteBase().secoes;
      alteracoes = { secoes: [{ ...secao0, titulo: null }] };
      const tela = await abrir();

      expect(secao(tela, 'Outras informações')).not.toBeNull();
      expect(secao(tela, 'Dados do candidato')).toBeNull();
    });

    it('mostra o código de verificação do envio', async () => {
      const tela = await abrir();

      expect(secao(tela, 'Código de verificação')?.textContent).toContain('a'.repeat(64));
    });

    it('lista cada documento com a exigência, a situação, a consequência e o código de cada arquivo', async () => {
      alteracoes = {
        documentos: [
          {
            nome: 'Laudo médico',
            integrante: 'Integrante 1',
            obrigatorio: true,
            situacao: 'Atendido',
            consequencia: 'Indeferimento da inscrição',
            arquivos: [{ formato: 'PDF', tamanhoBytes: 2048, hashSha256: HASH }],
          },
          {
            nome: 'Atestado',
            integrante: null,
            obrigatorio: false,
            situacao: 'Dispensado',
            consequencia: null,
            arquivos: [],
          },
        ],
      };
      const tela = await abrir();

      const documentos = secao(tela, 'Documentos enviados') as HTMLElement;
      const [laudo, atestado] = Array.from(documentos.querySelectorAll('ui-secao-de-documento'));
      expect(dado(laudo, 'Refere-se a')).toBe('Integrante 1');
      expect(dado(laudo, 'Exigência')).toBe('Obrigatório');
      expect(dado(laudo, 'Situação')).toBe('Atendido');
      expect(dado(laudo, 'Consequência de não atender')).toBe('Indeferimento da inscrição');
      expect(laudo.querySelector('li')?.textContent?.replace(/\s+/g, ' ')).toContain(
        'PDF · 2,0 KB',
      );
      expect(laudo.querySelector('code[title]')?.textContent).toBe('f0e1d2c3…ccddeeff');
      expect(laudo.querySelector('details code')?.textContent).toBe(HASH);
      expect(dado(atestado, 'Exigência')).toBe('Facultativo');
      expect(dado(atestado, 'Consequência de não atender')).toBeNull();
      expect(atestado.querySelector('li')).toBeNull();
    });

    it('sem documento exigido, a seção não aparece', async () => {
      const tela = await abrir();

      expect(secao(tela, 'Documentos enviados')).toBeNull();
    });

    it('ao abrir, o foco vai ao título do documento', async () => {
      const tela = await abrir();

      expect(document.activeElement).toBe(tela.querySelector('h1'));
    });

    it('trocar o número na mesma página lê e mostra o outro envio', async () => {
      const tela = await abrir('2');
      const ler = vi.spyOn(servico, 'comprovante');

      fixture.componentRef.setInput('numero', '1');
      await atualizar();

      expect(ler).toHaveBeenCalledExactlyOnceWith(INSCRICAO_ID, 1);
      expect(tela.textContent).toContain('Envio 1 de 2');
    });
  });

  describe('candidato', () => {
    it('o titular revela o CPF do login para conferir, sem nova leitura', async () => {
      const tela = await abrir();
      const ler = vi.spyOn(servico, 'comprovante');

      (tela.querySelector('button[aria-label="Mostrar CPF"]') as HTMLButtonElement).click();
      await atualizar();

      expect(tela.querySelector('.dado-revelavel__tela')?.textContent?.trim()).toBe(
        '699.598.363-71',
      );
      expect(ler).not.toHaveBeenCalled();
    });

    it('sem conferir com o CPF do comprovante, o do login não se revela', async () => {
      // Kevin Carvalho, outra persona fictícia.
      cpfDoLogin.set('33257350376');
      const tela = await abrir();

      expect(tela.querySelector('button[aria-label="Mostrar CPF"]')).toBeNull();
      expect(tela.textContent).toContain('***.598.363-**');
      expect(tela.textContent).not.toContain('332.573.503-76');
    });

    it('com nome social, ele vem em destaque e o nome civil em seguida', async () => {
      const tela = await abrir();

      expect(dado(tela, 'Uso do nome social')).toBe('Sim');
      expect(dado(tela, 'Nome social')).toBe('Ariel Drumond');
      expect(dado(tela, 'Nome civil')).toBe('Fernanda Laura Nicole Drumond');
      expect(dado(tela, 'Nome')).toBeNull();
    });

    it('sem nome social, mostra só o nome civil', async () => {
      alteracoes = {
        candidato: { ...comprovanteBase().candidato, usaNomeSocial: false, nomeSocial: null },
      };
      const tela = await abrir();

      expect(dado(tela, 'Nome')).toBe('Fernanda Laura Nicole Drumond');
      expect(dado(tela, 'Uso do nome social')).toBeNull();
      expect(tela.textContent).not.toContain('Ariel Drumond');
    });
  });

  describe('navegação entre os envios', () => {
    it('mostra a posição pelo total da API e leva ao envio anterior pelo número que ela informa', async () => {
      const tela = await abrir();

      expect(tela.textContent).toContain('Envio 2 de 2');
      expect(links(tela)).toEqual(['‹ Envio anterior']);
      expect(hrefDe(tela, '‹ Envio anterior')).toBe(`/inscricao/comprovante/${INSCRICAO_ID}/1`);
    });

    it('no primeiro envio oferece só o seguinte', async () => {
      alteracoes = { total: 3, numeroAnterior: null, numeroSeguinte: 2 };
      const tela = await abrir('1');

      expect(links(tela)).toEqual(['Envio seguinte ›']);
      expect(hrefDe(tela, 'Envio seguinte ›')).toBe(`/inscricao/comprovante/${INSCRICAO_ID}/2`);
    });

    it('o envio que vale leva a etiqueta e não avisa que foi substituído', async () => {
      const tela = await abrir();

      expect(dado(tela, 'Situação')).toBe('É o que vale');
      expect(tela.textContent).not.toContain('foi substituído');
    });

    it('o envio substituído avisa e aponta o último, pelo total, sem oferecer a correção', async () => {
      alteracoes = {
        vale: false,
        numeroSeguinte: 2,
        numeroAnterior: null,
        total: 3,
        prazoDaCorrecao: null,
      };
      const tela = await abrir('1');

      expect(dado(tela, 'Situação')).toBe('Substituído');
      expect(tela.textContent).toContain('Este envio foi substituído por um mais recente');
      expect(hrefDe(tela, 'Ver o envio mais recente')).toBe(
        `/inscricao/comprovante/${INSCRICAO_ID}/3`,
      );
      expect(secao(tela, 'Prazo para correção')).toBeNull();
    });
  });

  describe('prazo da correção', () => {
    it('com o prazo aberto, diz até quando e leva à correção do processo', async () => {
      const tela = await abrir();

      const passos = secao(tela, 'Prazo para correção') as HTMLElement;
      expect(passos.textContent).toContain('19/12/2026, 23:59');
      expect(passos.textContent).toContain('horário de Belém (PA)');
      expect(hrefDe(tela, 'Corrigir dados')).toBe(`/inscricao/${PROCESSO}`);
    });

    it('com o prazo encerrado, diz que não se corrige mais e não oferece a correção', async () => {
      alteracoes = {
        prazoDaCorrecao: { fim: '2026-12-20T02:59:00Z', fusoHorario: FUSO, aberto: false },
      };
      const tela = await abrir();

      expect(secao(tela, 'Prazo para correção')?.textContent).toContain(
        'Não é mais possível corrigir',
      );
      expect(hrefDe(tela, 'Corrigir dados')).toBeUndefined();
    });

    it('sem prazo na resposta, a seção não aparece', async () => {
      alteracoes = { prazoDaCorrecao: null };
      const tela = await abrir();

      expect(secao(tela, 'Prazo para correção')).toBeNull();
    });
  });

  describe('cursos e modalidades', () => {
    const modalidadesNaTela = (tela: HTMLElement): string[] =>
      Array.from(secao(tela, 'Modalidades de concorrência')?.querySelectorAll('ul > li') ?? []).map(
        (li) => li.textContent?.trim() ?? '',
      );

    it('o processo de uma opção cujo curso a versão não nomeia não mostra a seção "Inscrição"', async () => {
      const [primeira] = comprovanteBase().opcoesDeCurso;
      alteracoes = { opcoesDeCurso: [{ ...primeira, nome: null }] };
      const tela = await abrir();

      expect(secao(tela, 'Inscrição')).toBeNull();
    });

    it('mostra o curso pelo nome da API e as modalidades na ordem dela, sem o código', async () => {
      const tela = await abrir();

      expect(dado(tela, 'Curso')).toBe('Direito (Bacharelado) — Campus Marabá');
      expect(modalidadesNaTela(tela)).toEqual([
        'Ampla concorrência',
        'Escola pública, independente de renda',
      ]);
      expect(tela.textContent).not.toContain('LI_EP');
    });

    it('com 2 opções, mostra a 1ª e a 2ª e as modalidades de cada uma', async () => {
      const [primeira] = comprovanteBase().opcoesDeCurso;
      alteracoes = {
        numeroDeOpcoesDeCurso: 2,
        opcoesDeCurso: [
          primeira,
          {
            ordem: 2,
            nome: 'Medicina (Bacharelado) — Campus Marabá',
            modalidades: [{ codigo: 'AC', nome: 'Ampla concorrência', ordem: 0 }],
          },
        ],
      };
      const tela = await abrir();

      expect(dado(tela, '1ª opção')).toContain('Direito');
      expect(dado(tela, '2ª opção')).toContain('Medicina');
      expect(dado(tela, 'Curso')).toBeNull();
      const listas = Array.from(
        secao(tela, 'Modalidades de concorrência')?.querySelectorAll('ul') ?? [],
      ).map((ul) => Array.from(ul.querySelectorAll('li')).map((li) => li.textContent?.trim()));
      expect(listas).toEqual([
        ['Ampla concorrência', 'Escola pública, independente de renda'],
        ['Ampla concorrência'],
      ]);
    });

    it('o processo de 2 opções com a 2ª vazia mostra "Não declarada" e as modalidades só da 1ª', async () => {
      alteracoes = { numeroDeOpcoesDeCurso: 2 };
      const tela = await abrir();

      expect(dado(tela, '2ª opção')).toBe('Não declarada');
      expect(secao(tela, 'Modalidades de concorrência')?.querySelectorAll('ul')).toHaveLength(1);
    });

    it('o processo que não define as modalidades pela inscrição diz isso, sem lista', async () => {
      const [primeira] = comprovanteBase().opcoesDeCurso;
      alteracoes = { opcoesDeCurso: [{ ...primeira, modalidades: null }] };
      const tela = await abrir();

      const modalidades = secao(tela, 'Modalidades de concorrência');
      expect(modalidades?.querySelector('ul')).toBeNull();
      expect(modalidades?.textContent?.replace(/\s+/g, ' ')).toContain(
        'Este processo seletivo não define pela inscrição as modalidades de concorrência. Consulte o edital.',
      );
    });
  });

  describe('aviso de validade', () => {
    const AVISO = 'Documento sem validade: inscrição cancelada em 07/11/2026 às 22:32:05';
    const cancelamento = { canceladaEm: '2026-11-08T01:32:05Z', motivo: null, aviso: AVISO };
    const avisoNaTela = (tela: HTMLElement): string | null =>
      tela.querySelector('.documento__aviso')?.textContent?.trim() ?? null;

    async function trocarPara(numero: string): Promise<void> {
      fixture.componentRef.setInput('numero', numero);
      await atualizar();
    }

    it('aparece quando o comprovante traz o cancelamento', async () => {
      alteracoes = { cancelamento };

      const tela = await abrir();

      expect(avisoNaTela(tela)).toBe(AVISO);
      expect(tela.querySelector('.documento__aviso-marca')?.textContent?.trim()).toBe(AVISO);
    });

    it('some ao trocar para um envio sem cancelamento', async () => {
      alteracoes = { cancelamento };
      const tela = await abrir('2');
      expect(avisoNaTela(tela)).toBe(AVISO);

      alteracoes = { cancelamento: null };
      await trocarPara('1');

      expect(avisoNaTela(tela)).toBeNull();
      expect(tela.querySelector('.documento__aviso-marca')).toBeNull();
    });

    it('não sobrevive a uma recusa', async () => {
      alteracoes = { cancelamento };
      const tela = await abrir('2');
      expect(avisoNaTela(tela)).toBe(AVISO);

      vi.spyOn(servico, 'comprovante').mockReturnValue(of(falha(404, 'uniplus.nao_encontrado')));
      await trocarPara('1');

      expect(tela.textContent).toContain('Comprovante não encontrado');
      expect(avisoNaTela(tela)).toBeNull();
      expect(tela.querySelector('.documento__aviso-marca')).toBeNull();
    });
  });

  describe('recusas que a página explica', () => {
    const voltaParaALista = (tela: HTMLElement): string | null | undefined =>
      hrefDe(tela, 'Voltar às minhas inscrições');

    it('a inscrição cancelada (422) explica que não há comprovante, sem nova tentativa nem impressão', async () => {
      vi.spyOn(servico, 'comprovante').mockReturnValue(
        of(falha(422, 'uniplus.selecao.inscricao.comprovante_de_inscricao_cancelada')),
      );

      const tela = await abrir();

      expect(tela.textContent).toContain('Esta inscrição foi cancelada');
      expect(tela.textContent).toContain('não tem comprovante');
      expect(botaoDeTentar(tela)).toBeUndefined();
      expect(tela.textContent).not.toContain('Imprimir comprovante');
      expect(voltaParaALista(tela)).toBe('/inscricao');
    });

    it('a versão fixada ausente (422) diz que o comprovante não pôde ser montado, sem nova tentativa', async () => {
      vi.spyOn(servico, 'comprovante').mockReturnValue(
        of(falha(422, 'uniplus.selecao.snapshot.vigente_ausente')),
      );

      const tela = await abrir();

      expect(tela.textContent).toContain('Não foi possível montar o comprovante');
      expect(tela.textContent).toContain('Sua inscrição continua registrada');
      expect(botaoDeTentar(tela)).toBeUndefined();
      expect(voltaParaALista(tela)).toBe('/inscricao');
    });

    it('os textos das recusas não trazem código nem rótulo interno', async () => {
      for (const code of [
        'uniplus.selecao.inscricao.comprovante_de_inscricao_cancelada',
        'uniplus.selecao.snapshot.vigente_ausente',
      ]) {
        TestBed.resetTestingModule();
        vi.spyOn(servico, 'comprovante').mockReturnValue(of(falha(422, code)));

        const tela = await abrir();

        expect(tela.textContent).not.toMatch(/uniplus\.|snapshot|vigente|422/i);
      }
    });

    it('o 404 mostra o não encontrado, sem nova tentativa e com o caminho de volta', async () => {
      vi.spyOn(servico, 'comprovante').mockReturnValue(of(falha(404, 'nao_encontrado')));

      const tela = await abrir();

      expect(tela.textContent).toContain('Não encontramos este comprovante');
      expect(botaoDeTentar(tela)).toBeUndefined();
      expect(voltaParaALista(tela)).toBe('/inscricao');
    });

    it.each(['foo', '0', '-1', '1.5'])(
      'o número %s, que não é de comprovante, não chega à API',
      async (numero) => {
        const ler = vi.spyOn(servico, 'comprovante');

        const tela = await abrir(numero);

        expect(tela.textContent).toContain('Não encontramos este comprovante');
        expect(ler).not.toHaveBeenCalled();
      },
    );
  });

  describe('nova tentativa depois da falha', () => {
    const indisponivel = () => falha(503, 'indisponivel', 'Serviço indisponível');

    it('o 422 que a página não conhece segue como falha, com nova tentativa', async () => {
      vi.spyOn(servico, 'comprovante').mockReturnValue(of(falha(422, 'uniplus.outra', 'Recusado')));

      const tela = await abrir();

      expect(botaoDeTentar(tela)).toBeDefined();
      expect(tela.textContent).not.toContain('Imprimir comprovante');
    });

    it('a leitura que dá certo tira o alerta e deixa o foco no título, sem somar o aviso de conclusão', async () => {
      vi.spyOn(servico, 'comprovante').mockReturnValueOnce(of(indisponivel()));
      const tela = await abrir();
      const anunciar = vi.spyOn(TestBed.inject(AnuncioDaConclusao), 'anunciar');
      const tentar = botaoDeTentar(tela) as HTMLButtonElement;
      tentar.focus();

      tentar.click();
      await atualizar();
      await macrotarefa();
      await atualizar();

      expect(tela.querySelector('.alert__title')).toBeNull();
      expect(tela.textContent).toContain('Imprimir comprovante');
      expect(document.activeElement).toBe(tela.querySelector('h1'));
      expect(anunciar).not.toHaveBeenCalled();
    });

    it('503 seguido de recusa termina na explicação, sem botão e sem aviso de conclusão', async () => {
      vi.spyOn(servico, 'comprovante')
        .mockReturnValueOnce(of(indisponivel()))
        .mockReturnValueOnce(
          of(falha(422, 'uniplus.selecao.inscricao.comprovante_de_inscricao_cancelada')),
        );
      const tela = await abrir();
      const anunciar = vi.spyOn(TestBed.inject(AnuncioDaConclusao), 'anunciar');
      expect(botaoDeTentar(tela)).toBeDefined();

      botaoDeTentar(tela)?.click();
      await atualizar();
      await macrotarefa();
      await atualizar();

      expect(tela.textContent).toContain('Esta inscrição foi cancelada');
      expect(botaoDeTentar(tela)).toBeUndefined();
      expect(anunciar).not.toHaveBeenCalled();
    });
  });
});
