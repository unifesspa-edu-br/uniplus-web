import { CenarioDoFormularioDoCandidato } from './formulario-do-candidato.testing';
import { FORMULARIO_DE_DUAS_SECOES } from './formularios-de-exemplo.testing';

describe('FormularioDoCandidatoComponent: última seção', () => {
  let cenario: CenarioDoFormularioDoCandidato;

  beforeEach(() => {
    cenario = CenarioDoFormularioDoCandidato.preparar();
  });

  it('informa que o candidato está na última seção só quando chega a ela', () => {
    cenario.montar(FORMULARIO_DE_DUAS_SECOES);
    const formulario = cenario.fixture.componentInstance;

    expect(formulario.naUltimaSecao()).toBe(false);

    formulario.navegacao.escolher(1);
    cenario.fixture.detectChanges();

    expect(formulario.naUltimaSecao()).toBe(true);
  });

  it('volta a informar que não é a última ao recuar', () => {
    cenario.montar(FORMULARIO_DE_DUAS_SECOES);
    const formulario = cenario.fixture.componentInstance;
    formulario.navegacao.escolher(1);

    formulario.navegacao.escolher(0);

    expect(formulario.naUltimaSecao()).toBe(false);
  });
});
