import { FaseCanonicaDto } from '@uniplus/shared-data/configuracao';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  conferirAcessibilidade,
  regiaoVivaQueEnvolve,
  simularGeometriaDoDocumento,
} from '../../shared/acessibilidade/regiao-viva.testing';
import { marcarRecusaDoServidor } from '../../shared/formulario';
import {
  CenaDaPagina,
  faseAvaliacaoSeed,
  montarPagina,
  propagar,
  responderLista,
  verificarRequisicoesDaPagina,
} from './fases-canonicas.testing';

const FASE: FaseCanonicaDto = { ...faseAvaliacaoSeed, admiteComplementacao: true };

interface CampoComRegiaoViva {
  readonly nome:
    | 'coletaInscricao'
    | 'coletaSolicitacaoIsencao'
    | 'agrupaEtapas'
    | 'permiteComplementacao';
  readonly controle: string;
  readonly grupo: string | null;
}

const CAMPOS: readonly CampoComRegiaoViva[] = [
  { nome: 'coletaInscricao', controle: '[formcontrolname="coletaInscricao"]', grupo: null },
  {
    nome: 'coletaSolicitacaoIsencao',
    controle: '[data-testid="cfg-fase-coleta-isencao"]',
    grupo: null,
  },
  {
    nome: 'agrupaEtapas',
    controle: '[formcontrolname="agrupaEtapas"]',
    grupo: '#cfg-fase-grupo-agrupa',
  },
  {
    nome: 'permiteComplementacao',
    controle: '[formcontrolname="permiteComplementacao"]',
    grupo: '#cfg-fase-grupo-compl',
  },
];

describe('FasesCanonicasPage — regiões vivas do formulário do tipo de fase', () => {
  let cena: CenaDaPagina;
  let restaurarDocumento: () => void;

  beforeEach(async () => {
    restaurarDocumento = simularGeometriaDoDocumento();
    cena = montarPagina();
    await responderLista(cena, [FASE]);
    cena.edicao.abrirEdicao(FASE);
    cena.fixture.detectChanges();
  });
  afterEach(() => {
    restaurarDocumento();
    verificarRequisicoesDaPagina(cena);
  });

  const tela = (): HTMLElement => cena.fixture.nativeElement;
  const buscar = (raiz: ParentNode, seletor: string): HTMLElement => {
    const encontrado = raiz.querySelector<HTMLElement>(seletor);
    expect(encontrado, seletor).not.toBeNull();
    return encontrado as HTMLElement;
  };
  const rotuloDe = (campo: CampoComRegiaoViva): HTMLElement =>
    buscar(tela(), campo.controle).closest('label') as HTMLElement;
  const regiaoDe = (campo: CampoComRegiaoViva): HTMLElement =>
    buscar(rotuloDe(campo), '.field__live');
  const recusar = async (campo: CampoComRegiaoViva): Promise<void> => {
    marcarRecusaDoServidor(
      cena.edicao.form.controls[campo.nome],
      'codigo.teste',
      'Valor recusado.',
    );
    buscar(tela(), campo.controle).dispatchEvent(new Event('blur'));
    await propagar(cena);
    cena.fixture.detectChanges();
  };

  describe.each(CAMPOS)('campo $nome', (campo) => {
    it('nenhuma região viva envolve o grupo, o rótulo, o campo nem a dica', () => {
      const rotulo = rotuloDe(campo);
      const partes = [
        rotulo,
        buscar(rotulo, '.field__label'),
        buscar(tela(), campo.controle),
        ...(campo.grupo
          ? [buscar(tela(), campo.grupo), buscar(tela(), `${campo.grupo} legend`)]
          : []),
      ];

      expect(partes.map((parte) => regiaoVivaQueEnvolve(parte))).toEqual(partes.map(() => null));
    });

    it('a região do erro já está montada e vazia antes de o erro aparecer', () => {
      expect(regiaoDe(campo).getAttribute('aria-live')).toBe('polite');
      expect(regiaoDe(campo).textContent?.trim()).toBe('');
    });

    it('o erro entra na mesma região e continua ligado ao campo', async () => {
      const regiao = regiaoDe(campo);
      await recusar(campo);

      const erro = buscar(regiao, '.field__error');
      expect(regiaoDe(campo)).toBe(regiao);
      expect(regiaoVivaQueEnvolve(erro)).toBe(regiao);
      expect(erro.textContent).toContain('Valor recusado.');
      const controle = buscar(tela(), campo.controle);
      expect(controle.getAttribute('aria-invalid')).toBe('true');
      expect(controle.getAttribute('aria-describedby')).toBe(erro.id);
    });
  });

  it('o formulário com os quatro erros não tem violação de acessibilidade', async () => {
    for (const campo of CAMPOS) await recusar(campo);

    const { violations } = await conferirAcessibilidade(tela());
    expect(violations.map((v) => v.id)).toEqual([]);
  });
});
