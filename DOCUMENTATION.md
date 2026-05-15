# WorkFinder AI - Documentação do Projeto

## 1. Visão Geral
O WorkFinder AI é uma aplicação full-stack construída para facilitar o processo de busca de vagas de emprego. O grande diferencial do ambiente é o uso de Inteligência Artificial para extrair informações do currículo do usuário, interpretar seu perfil e cruzar essas informações (match) com vagas reais, buscando a maior eficácia na compatibilidade (fit).

## 2. Tecnologias Utilizadas e Respectivos Motivos

### Frontend
- **React.js 19**: Biblioteca moderna e componentizada (UI), perfeita para construir uma Single Page Application (SPA) reativa e dinâmica de maneira ágil.
- **TypeScript**: Adiciona tipagem ao ecossistema JavaScript, capturando erros ainda em tempo de ambiente de desenvolvimento. Ideal para estruturarmos fortemente as respostas das requisições com IA.
- **Vite**: Usado como ambiente de bundle, oferecendo extrema velocidade frente a bundlers antigos, impulsionado por nativos ES Modules no navegador.
- **Tailwind CSS**: Framework de estilo utilitário responsável pela parte de layout. Ele dispensa a criação de planilhas de arquivos CSS separadas e garante uma padronização visual rápida.
- **Lucide React**: Conjunto de ícones vetoriais modernos.

### Backend / Server Side (Camada Node)
- **Node.js + Express**: Em vez de ter o backend num repositório a parte, injetamos num único monorepo o Express para atuar como gateway de Proxy/Segurança. Isso afasta lógicas de APIs pesadas e sensíveis (como a chave Gemini e Google Search) do cliente final que opera no navegador.
- **PDF-Parse**: Utilitário nativo de Backend extraindo Buffer do banco direto para texto, fundamentalmente servindo as entranhas dos arquivos `.pdf` de currículos à IA de uma forma textual limpa que ela consiga abstrair.
- **Multer**: Middleware do Express para capturar uploads do tipo `multipart/form-data`, essenciais por causa do formulário frontend que acopla o input "File".

### Inteligência Artificial e Integrações
- **Google Gemini (gemini-2.5-flash)**: É o processador cognitivo e criativo do aplicativo, agindo em duas vertentes:
  1. Extração Estrutural: Consome o PDF confuso do currículo para torná-lo um Objeto de Dados JSON formatado limpo;
  2. Motor de Recomendação Recrutadora: Pega esse Objeto de dados, compara com Array de Vagas que chegaram da internet, pontua pesos percentuais (%) de Match justificando o porquê escolheu isso dentro do conhecimento do escopo de TI.
- **SerpApi (Google Search)**: API consolidada de raspagem do lado direito de empregos (Google Jobs) oferecendo informações altamente orgânicas do mercado que muitas vezes não chegam nem no Linkedin rapidamente.
- **Resend**: Solução de disparo de SMTP amigável à plataforma Vercel e ecossistemas JS/TS/Node, usada para alertar via e-mail o usuário quando seu processo de varredura for concluído.

---

## 3. Arquitetura e Fluxo do Código

1. **Entrada do Usuário (`App.tsx`)**: Preenchimento do formulário com upload atrelado de PDF. Os dados submetem a função de envio para API local (`/api/match-vagas`).
2. **Gateway (`server.ts` & `ResumeController.ts`)**: Pega a Request Multipart com o pacote do currículo e passa para o leitor e os servicos internos;
3. **Parseamento de Dados Específicos (`PdfParserService.ts`)**: Abre em buffer o input carregado na memória, extraindo dele apenas a string crua.
4. **Extração de Perfil pela IA (`ResumeAnalyzerService.ts`)**: Manda a String do currículo com um longo "Prompt de Regras" (detalhe logo abaixo) pro Gemini. A API do Google nos envia de volta um perfil JSON limpo contendo informações separadas de: Nivelamento (Júnior/Pleno), Tecnologias, Cargo Desejado, etc.
5. **Busca Web (`SerpApiService.ts` & `JobFilterService.ts`)**: Pesquisador assíncrono que via HTTP REST pega a lista em tempo real do Google "Job Board" de acordo com o Nivelamento e Cargo do JSON do cara e retorna bruto. O FilterService extraí apenas chaves como ID, Salário e Data.
6. **Magia de Cross-Matching (`MatchService.ts`)**: Recebe tudo. Pede para a IA julgar, ela julga, devolve a resposta final.
7. **Integração Logistica Email**: Uma request transacional em HTML simplificado acionada em plano de fundo via SDK *Resend*.
8. **Devolução Front**: O status carrega verde para o cliente, iterando com `.map()` as páginas de todos componentes de `<JobCard/>`.

---

## 4. Prompts Utilizados

Nós utilizamos a capacidade da IA (`gemini-2.5-flash`) de raciocínio via as **System Instructions** (persona e regras duras) juntamente as Request Parts.

### Prompt de Sistema 1: O Extrator
> Você é um Engenheiro de Dados e Analista de RH especialista em parsing estruturado.
> Sua única função é extrair informações do texto bruto de um currículo fornecido e retornar ESTRITAMENTE um objeto JSON válido.
> 
> Extraia EXATAMENTE as seguintes propriedades com precisão:
> - "nome_completo": (String) Nome completo do candidato.
> - "email": (String) E-mail detectado.
> - "cidade_estado": (String) Cidade e estado, se houver.
> - "links": (Objeto) Deve conter "linkedin" e "github".
> - "preferencia_trabalho": (String) "Remoto", "Híbrido", etc.
> - "cargo_desejado": (String) O cargo principal almejado.
> - "nivel_profissional": (String) "Estágio", "Júnior", "Pleno" ou "Sênior".
> - "tecnologias_conhecidas": (Array de Strings) Linguagens, frameworks, bancos...
> - "experiencias_profissionais": (Array) empresa, cargo, etc...
> 
> OBRIGATÓRIO:
> - Não adicione textos explicativos.
> - O retorno deve ser um JSON válido iniciando e terminando com chaves.
> - Se uma informação não existir no texto, retorne nulo ('null').

### Prompt de Sistema 2: O Motor Especializado de Match
> Você é um Recrutador Sênior e Especialista de RH em tecnologia extremamente crítico e lógico.
> Sua missão é realizar o "match" de compatibilidade realística entre o PERFIL DO CANDIDATO e um array de VAGAS DISPONÍVEIS na internet.
> 
> Regras:
> 1. Analise as tecnologias conhecidas, senioridade e histórico.
> 2. Dê uma nota de "compatibilidade" de 0 a 100.
> 3. Crie um campo "motivos" sendo super direto pontuando o porquê do score.
> 4. É PROIBIDO "alucinar" tecnologias. Baseie-se APENAS no que está no array.
> 
> OBRIGATÓRIO: VOCÊ DEVE RETORNAR APENAS UM ARRAY JSON VÁLIDO EXATAMENTE NESTE FORMATO:
> [
>   {
>     "vagaId": "...",
>     "titulo": "...",
>     "empresa": "...",
>     "compatibilidade": 95,
>     "motivos": ["Motivo 1", "Motivo 2"],
>     "link_vaga": "url_da_vaga"
>   }
> ]
> - Não retorne NENHUMA quebra de bloco de código (\`\`\`json).
> - Retorne apenas vagas com compatibilidade superior a 50%.
> - Retorne no máximo 15 melhores vagas da lista fornecida.
