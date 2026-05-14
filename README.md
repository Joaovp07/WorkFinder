# WorkFinder - Match Inteligente de Vagas

O WorkFinder é uma aplicação que conecta desenvolvedores e profissionais de tecnologia às vagas ideias, utilizando análise inteligente de perfil. Esta ferramenta visa demonstrar uma arquitetura moderna de automação de currículos e correspondência de vagas.

## 🧠 Como funciona a Inteligência Artificial e a Automação

O projeto foi desenhado para extrair o máximo de um fluxo de automação:

1. **Preenchimento Mágico (PDF Parsing)**
   Ao fazer o upload do currículo em PDF, o backend processa o arquivo. Atualmente, configuramos uma extração rápida baseada em **heurísticas e RegEx** para que o sistema funcione perfeitamente e sem bloqueios (mesmo sem chaves de API). O sistema identifica informações-chave como nome, e-mail, links (LinkedIn/GitHub), experiência, formação técnica e cargo desejado, preenchendo o formulário instantaneamente.

2. **Match de Vagas (Integração Make.com & API Remotive)**
   Quando o usuário clica em buscar vagas:
   - A requisição é estruturada no formato em que seria enviada para um webhook no **Make.com** (plataforma de automação).
   - O Make se conecta na **API da Remotive** (api.remotive.com) para obter as últimas vagas disponíveis na área de TI no modelo escolhido (Remoto, etc).
   - Idealmente, no fluxo Make, os dados das vagas e do perfil do candidato são comparados via **Gemini API** para gerar um percentual de "match" e criar uma justificativa do porquê aquela vaga combina com o candidato.
   - Atualmente na aplicação local, este fluxo do Make é **simulado e mockado** pela rota interna (`/api/webhook-mock`), que retorna vagas de amostra formatadas no mesmo padrão, para demonstrar o visual sem a necessidade de configurar um ecossistema complexo no Make ou consumir tokens na busca em tempo real.

3. **Notificação por E-mail (NodeMailer)**
   O app também conta com um webhook para envio de e-mail. Ao aprovar uma seleção de vagas, um e-mail em formato HTML detalhado com as vagas e % de compatibilidade é gerado e enviado (se houver credenciais SMTP configuradas).

---

## 🚀 Como rodar o projeto localmente

Para rodar este projeto em sua própria máquina, siga os passos abaixo:

### Pré-requisitos
- **Node.js** (versão 18+ recomendada)
- **NPM** ou **Yarn** instalados

### Passo a Passo

1. **Clone o repositório e instale as dependências**
   Abra seu terminal na pasta do projeto e rode o comando:
   ```bash
   npm install
   ```

2. **Configure as Variáveis de Ambiente**
   O aplicativo suporta o envio real de e-mails usando o nodemailer. Para que isso funcione ou para testar integrações adicionais:
   - Renomeie (ou copie) o arquivo `.env.example` para `.env`
   - Preencha as chaves:
     ```env
     # (Opcional) Configurações de SMTP para enviar os alertas de vagas para o seu email real
     SMTP_HOST=smtp.mailendo.com ou smtp.gmail.com
     SMTP_PORT=587
     SMTP_USER=seu_email@dominio.com
     SMTP_PASS=sua_senha
     ```

3. **Inicie o Servidor de Desenvolvimento**
   Execute o script que inicia tanto o Front-end React (Vite) quanto a API do Back-end Express simultaneamente:
   ```bash
   npm run dev
   ```

4. **Acesse a Aplicação**
   Abra seu navegador e acesse a URL informada no terminal, geralmente:
   [http://localhost:3000](http://localhost:3000)

## 🛠 Principais Tecnologias Utilizadas
- **Front-end**: React 18, Vite, Tailwind CSS, Lucide React (ícones), Tailwind-Merge, class-variance-authority.
- **Back-end**: Node.js, Express, tsx (para rodar TypeScript nativamente), Multer (uploads em memória), pdf-parse (leitura de PDF).
- **Envio de E-mail**: Nodemailer.

## ✨ Evoluções Futuras
Se você quiser ativar IA real para extração e matches no seu terminal, basta incluir a biblioteca `@google/genai` e substituir a rota `/api/webhook-mock` ou `/api/extrair-curriculo` por chamadas diretas ou apontar a URL de Webhook no frontend (`src/App.tsx`) para um Webhook válido criado na sua própria conta do Make.com. Assim, o app ganha o verdadeiro poder de IA generativa em seu processamento.
