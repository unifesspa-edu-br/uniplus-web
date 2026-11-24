import { HttpTestingController } from '@angular/common/http/testing';
import { BASE } from './modalidades-de-teste.testing';
import { COMPOSICOES, NATUREZAS, REGRAS } from './modalidades-tabela.testing';

export function responderNaturezas(controller: HttpTestingController): void {
  controller
    .expectOne(`${BASE}/api/configuracao/vocabularios/naturezas-legais`)
    .flush(Object.values(NATUREZAS));
}

export function responderVocabularios(controller: HttpTestingController): void {
  responderNaturezas(controller);
  const vocabularios = {
    'composicoes-vagas': Object.values(COMPOSICOES),
    'regras-remanejamento': Object.values(REGRAS),
    'acoes-quando-indeferido': [],
  };
  for (const [nome, opcoes] of Object.entries(vocabularios)) {
    controller.expectOne(`${BASE}/api/configuracao/vocabularios/${nome}`).flush(opcoes);
  }
}
