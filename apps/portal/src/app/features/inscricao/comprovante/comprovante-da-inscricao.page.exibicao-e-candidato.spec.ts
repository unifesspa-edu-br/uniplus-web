import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CenarioDoComprovante,
  COMPROVANTE_BASE,
  dado,
  HASH,
  INSCRICAO_ID,
  secao,
} from './comprovante-da-inscricao.page.testing';

describe('ComprovanteDaInscricaoPage', () => {
  let cenario: CenarioDoComprovante;

  beforeEach(() => {
    cenario = CenarioDoComprovante.preparar();
  });

  afterEach(() => {
    cenario.encerrar();
  });

  describe('exibição do que a API devolve', () => {
    it('lê o comprovante uma única vez, pelo id da inscrição e pelo número da rota', async () => {
      const ler = vi.spyOn(cenario.servico, 'comprovante');

      await cenario.abrir('2');

      expect(ler).toHaveBeenCalledExactlyOnceWith(INSCRICAO_ID, 2);
    });

    it('mostra o processo, o número da inscrição e o instante do envio no fuso, com o nome dele', async () => {
      const tela = await cenario.abrir();

      expect(tela.querySelector('.secao-de-documento__titulo')?.textContent).toContain(
        'Medicina 2027',
      );
      expect(dado(tela, 'Número da inscrição')).toBe('2027-000042');
      expect(dado(tela, 'Enviado em')).toBe('11/12/2026, 10:30, horário de Belém (PA)');
    });

    it('mostra o identificador do processo e a unidade administradora congelados', async () => {
      const tela = await cenario.abrir();

      expect(secao(tela, 'Medicina 2027')?.textContent?.replace(/\s+/g, ' ')).toContain(
        'Processo Edital 001/2026 · Centro de Processos Seletivos',
      );
    });

    it('sem identificador do processo, mostra só a unidade', async () => {
      cenario.alteracoes = { processo: { identificadorDoProcesso: null } };
      const tela = await cenario.abrir();

      const texto = secao(tela, 'Medicina 2027')?.textContent?.replace(/\s+/g, ' ') ?? '';
      expect(texto).toContain('Centro de Processos Seletivos');
      expect(texto).not.toContain('Processo ·');
      expect(texto).not.toContain('Edital 001/2026');
    });

    it('mostra as seções e os grupos com o rótulo e o valor formatado pelo tipo, sem o código', async () => {
      const tela = await cenario.abrir();

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
      const comCalculo = await cenario.abrir();
      expect(dado(secao(comCalculo, 'Calculado pelo sistema') as HTMLElement, 'Faixa etária')).toBe(
        '25 a 29 anos',
      );
      cenario.reiniciar();

      cenario.alteracoes = { formulario: { derivados: [] } };
      const semCalculo = await cenario.abrir();

      expect(secao(semCalculo, 'Calculado pelo sistema')).toBeNull();
    });

    it('lista os termos aceitos pelo nome e a data do aceite no fuso do envio', async () => {
      const tela = await cenario.abrir();

      const termos = secao(tela, 'Termos aceitos') as HTMLElement;
      expect(termos.querySelector('li')?.textContent).toBe('Declaração de veracidade');
      expect(termos.textContent).toContain('Aceitos no envio de 11/12/2026');
    });

    it('a seção sem título na API aparece como "Outras informações"', async () => {
      const [secao0] = COMPROVANTE_BASE.formulario.secoes;
      cenario.alteracoes = { formulario: { secoes: [{ ...secao0, titulo: null }] } };
      const tela = await cenario.abrir();

      expect(secao(tela, 'Outras informações')).not.toBeNull();
      expect(secao(tela, 'Dados do candidato')).toBeNull();
    });

    it('mostra o código de verificação do envio', async () => {
      const tela = await cenario.abrir();

      expect(secao(tela, 'Código de verificação')?.textContent).toContain('a'.repeat(64));
    });

    it('lista cada documento com a exigência, a situação, a consequência e o código de cada arquivo', async () => {
      cenario.alteracoes = {
        formulario: {
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
        },
      };
      const tela = await cenario.abrir();

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
      const tela = await cenario.abrir();

      expect(secao(tela, 'Documentos enviados')).toBeNull();
    });

    it('ao abrir, o foco vai ao título do documento', async () => {
      const tela = await cenario.abrir();

      expect(document.activeElement).toBe(tela.querySelector('h1'));
    });

    it('trocar o número na mesma página lê e mostra o outro envio', async () => {
      const tela = await cenario.abrir('2');
      const ler = vi.spyOn(cenario.servico, 'comprovante');

      await cenario.trocarPara('1');

      expect(ler).toHaveBeenCalledExactlyOnceWith(INSCRICAO_ID, 1);
      expect(tela.textContent).toContain('Envio 1 de 2');
    });
  });

  describe('candidato', () => {
    it('o titular revela o CPF do login para conferir, sem nova leitura', async () => {
      const tela = await cenario.abrir();
      const ler = vi.spyOn(cenario.servico, 'comprovante');

      (tela.querySelector('button[aria-label="Mostrar CPF"]') as HTMLButtonElement).click();
      await cenario.atualizar();

      expect(tela.querySelector('.dado-revelavel__tela')?.textContent?.trim()).toBe(
        '699.598.363-71',
      );
      expect(ler).not.toHaveBeenCalled();
    });

    it('sem conferir com o CPF do comprovante, o do login não se revela', async () => {
      // Kevin Carvalho, outra persona fictícia.
      cenario.cpfDoLogin.set('33257350376');
      const tela = await cenario.abrir();

      expect(tela.querySelector('button[aria-label="Mostrar CPF"]')).toBeNull();
      expect(tela.textContent).toContain('***.598.363-**');
      expect(tela.textContent).not.toContain('332.573.503-76');
    });

    it('com nome social, ele vem em destaque e o nome civil em seguida', async () => {
      const tela = await cenario.abrir();

      expect(dado(tela, 'Uso do nome social')).toBe('Sim');
      expect(dado(tela, 'Nome social')).toBe('Ariel Drumond');
      expect(dado(tela, 'Nome civil')).toBe('Fernanda Laura Nicole Drumond');
      expect(dado(tela, 'Nome')).toBeNull();
    });

    it('sem nome social, mostra só o nome civil', async () => {
      cenario.alteracoes = {
        candidato: { ...COMPROVANTE_BASE.candidato, usaNomeSocial: false, nomeSocial: null },
      };
      const tela = await cenario.abrir();

      expect(dado(tela, 'Nome')).toBe('Fernanda Laura Nicole Drumond');
      expect(dado(tela, 'Uso do nome social')).toBeNull();
      expect(tela.textContent).not.toContain('Ariel Drumond');
    });
  });
});
