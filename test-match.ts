import { MatchService } from './src/services/MatchService';
import "dotenv/config";

async function run() {
  const matchService = new MatchService();
  const res = await matchService.executeFlow({
    nome: 'User',
    email: 'user@example.com',
    cargo: 'React Developer',
    nivel: 'Junior',
    tecnologias: 'React, Node, Javascript',
    resumo: 'Eu tenho experiência com React e Node.js em projetos academicos. Busco minha primeira oportunidade como Junior.',
    cidade: 'SP'
  });
  console.log(JSON.stringify(res, null, 2));
}

run();
