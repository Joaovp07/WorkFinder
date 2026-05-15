import React, { useState } from 'react';
import { Briefcase, Send, UploadCloud, Search, CheckCircle, Target, ArrowRight, Loader2, Check, Info, X, Terminal, Cpu } from 'lucide-react';
import { JobCard, Job } from './components/JobCard';

export default function App() {
  const [step, setStep] = useState(1);
  const [showInfo, setShowInfo] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState({
    nome: '',
    email: '',
    cargo: '',
    nivel: 'Júnior',
    cidade: '',
    modalidade: 'remoto',
    tecnologias: '',
    experiencias: '',
    formacao: '',
    linkedin: '',
    github: '',
    resumo: '',
  });
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [emailStatus, setEmailStatus] = useState<{ status: 'idle' | 'loading' | 'success' | 'error', link?: string }>({ status: 'idle' });

  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractSuccess, setExtractSuccess] = useState<boolean>(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setProfileData({ ...profileData, [e.target.name]: e.target.value });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPdfFile(file);
      setExtractError(null);
      setExtractSuccess(false);

      // Extract data automatically via local API
      try {
        setExtracting(true);
        const curriculoBase64 = await toBase64(file);
        
        const res = await fetch('/api/extrair-curriculo', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({ curriculoBase64 }),
        });

        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("text/html")) {
          const rawHtml = await res.text();
          console.error("O servidor retornou HTML inesperado:", rawHtml.substring(0, 500));
          if (res.status === 413) {
             throw new Error("O arquivo PDF é muito grande. Por favor, envie um currículo menor (limite recomendado: 2MB).");
          }
          if (res.status === 502 || res.status === 503 || res.status === 504) {
             throw new Error("O servidor está reiniciando ou indisponível. Por favor, aguarde alguns segundos e tente novamente.");
          }
          throw new Error(`O servidor retornou um formato inválido ao invés de JSON (Status ${res.status}). O serviço pode estar indisponível momentaneamente.`);
        }

        const textRes = await res.text();
        let data: any = null;
        try {
          data = JSON.parse(textRes);
        } catch (e) {
          console.error("Non-JSON response from extrair-curriculo:", textRes.substring(0, 100));
        }

        if (res.ok && data) {
          setProfileData(prev => ({
            ...prev,
            nome: data.nome || prev.nome,
            email: data.email || prev.email,
            cargo: data.cargo || prev.cargo,
            nivel: data.nivel || prev.nivel,
            cidade: data.cidade || prev.cidade,
            linkedin: data.linkedin || prev.linkedin,
            github: data.github || prev.github,
            experiencias: data.experiencias || prev.experiencias,
            formacao: data.formacao || prev.formacao,
            tecnologias: data.tecnologias ? (prev.tecnologias ? `${prev.tecnologias}, ${data.tecnologias}` : data.tecnologias) : prev.tecnologias,
            resumo: data.resumo || prev.resumo,
          }));
          setExtractSuccess(true);
        } else {
           let errorMessage = 'Não foi possível extrair dados automaticamente do PDF.';
           if (data && data.error) errorMessage = data.error;
           setExtractError(errorMessage);
        }
      } catch (err) {
        console.error("Erro ao extrair dados do PDF", err);
        setExtractError('Ocorreu um erro de rede ou servidor ao extrair os dados do currículo.');
      } finally {
        setExtracting(false);
      }
    }
  };

  const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      let encoded = reader.result?.toString() || '';
      const idx = encoded.indexOf('base64,');
      if (idx !== -1) {
         encoded = encoded.substring(idx + 7);
      }
      resolve(encoded);
    };
    reader.onerror = error => reject(error);
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep(2);
    setLoading(true);

    try {
      // ===== INTEGRAÇÃO COM BACKEND (IA + EMAIL) =====
      // Aqui disparamos o POST para a rota /api/match-vagas com os dados do candidato.
      
      let pdfBase64 = null;
      if (pdfFile) {
        pdfBase64 = await toBase64(pdfFile);
      }

      const payload = {
        candidato: profileData,
        curriculoBase64: pdfBase64,
        fileName: pdfFile ? pdfFile.name : null
      };

      // Sempre usar a API interna para o fluxo principal (Busca -> IA -> Email)
      const res = await fetch('/api/match-vagas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const rawText = await res.text();

      let makeResult: any = [];
      
      if (!res.ok) {
        console.error(`Erro do Servidor (${res.status}): ${rawText}`);
        let alertMsg = "Não foi possível conectar com o servidor local.";
        let payloadParsed = null;
        try {
           payloadParsed = JSON.parse(rawText);
        } catch(e) {}

        if (payloadParsed?.error) {
          alertMsg = `Ocorreu um erro na requisição: ${payloadParsed.error}\n${payloadParsed.details || ''}`;
        }
        alert(`${alertMsg}\n\nVamos exibir vagas de simulação (Mock) para fins de teste.`);
      } else {
        try {
          const data = JSON.parse(rawText);
          makeResult = data.jobs || data; 
        } catch (e) {
           console.error("Raw response server:", rawText);
           alert(`Aviso: O servidor retornou inválido.\n\nVamos exibir vagas de simulação (Mock).`);
        }
      }

      if (!Array.isArray(makeResult) || makeResult.length === 0) {
        makeResult = [
          {
             vagaId: 1,
             titulo: "Desenvolvedor Front-end Sênior (Mock)",
             empresa: "Tech Solutions Inc.",
             compatibilidade: 85,
             localizacao: "Remoto",
             modelo: "remoto",
             tecnologias: ["React", "TypeScript", "Tailwind CSS"],
             motivos: [
               "Forte alinhamento com seu conhecimento em React e TS.",
               "Experiência compatível com nível Sênior.",
               "Possibilidade de trabalho totalmente remoto."
             ],
             link: "https://remotive.com/job/1"
          }
        ];
      }

      setJobs(makeResult);
    } catch (err: any) {
      console.error(err);
      alert('Erro ao processar as vagas: ' + (err.message || 'Tente novamente.'));
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  const enviarEmail = async () => {
    // Envio de email adicional se necessário (mock)
    // O envio principal já acontece no backend com Resend.
    // Simulando mensagem de sucesso aqui.
    setEmailStatus({ status: 'loading' });
    setTimeout(() => {
        setEmailStatus({ status: 'success', link: '#' });
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-dot-pattern selection:bg-blue-500/30">
      {/* Navbar */}
      <nav className="border-b border-gray-200/50 bg-white/60 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full flex items-center justify-center bg-black text-white shadow-sm">
              <Briefcase className="w-4 h-4" />
            </div>
            <span className="text-xl font-display font-semibold tracking-tight">WorkFinder</span>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowInfo(true)}
              className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-black transition-colors"
            >
              <Info className="w-4 h-4" />
              <span className="hidden sm:block">Sobre o Projeto & IA</span>
            </button>
          </div>
        </div>
      </nav>

      {showInfo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl relative animate-in slide-in-from-bottom-4 duration-300">
            <button 
              onClick={() => setShowInfo(false)}
              className="absolute top-6 right-6 p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="p-8 sm:p-10 space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Como funciona o WorkFinder?</h2>
                <p className="text-gray-500 text-sm leading-relaxed">
                  Este projeto demonstra uma arquitetura moderna de automação de RH simulando o comportamento de integrações reais via Webhooks.
                </p>
              </div>

              <div className="space-y-6">
                <div className="bg-blue-50/50 rounded-2xl p-6 border border-blue-100">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                      <Cpu className="w-5 h-5" />
                    </div>
                    <h3 className="font-semibold text-gray-900">Uso da Inteligência Artificial</h3>
                  </div>
                  <div className="space-y-3 text-sm text-gray-600 leading-relaxed text-balance">
                    <p><strong>1. Extração de Currículo:</strong> Para evitar bloqueios e garantir funcionamento imediato, a leitura do seu currículo em PDF utiliza bibliotecas de texto nativas (pdf-parse) e Expressões Regulares (RegEx) avançadas para extrair seus dados.</p>
                    <p><strong>2. Notificação por E-mail:</strong> Configurável via `RESEND_API_KEY` para enviar notificações reais simulando aprovação pelas vagas encontradas.</p>
                    <p><strong>3. Fallback Local com Google Deep Search:</strong> Selecionamos as melhores vagas da Remotive e utilizamos o algorítmo interno (Google Deep Search) para simular o score de compatibilidade com precisão detalhada!</p>
                  </div>
                </div>

                <div className="bg-gray-50/50 rounded-2xl p-6 border border-gray-200/60">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="bg-gray-200/60 p-2 rounded-lg text-gray-600">
                      <Terminal className="w-5 h-5" />
                    </div>
                    <h3 className="font-semibold text-gray-900">Como Rodar Localmente</h3>
                  </div>
                  <div className="space-y-4 text-sm text-gray-600">
                    <p>Se você clonar este projeto (Frontend em Vite + Backend em Express), siga os passos:</p>
                    <ol className="list-decimal list-inside space-y-2 ml-1">
                      <li>Use <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">npm install</code> para instalar dependências.</li>
                      <li>Inicie ambos Web/API com <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">npm run dev</code>.</li>
                      <li>Configure as variáveis em <code>.env</code> (GROQ_API_KEY e RESEND_API_KEY) para ativar as integrações de IA e E-mail.</li>
                    </ol>
                    <p className="pt-2 text-xs text-gray-400">Desenvolvido pensando na stack de Node (Express), Vite (React), Llama 3 (Groq) e Resend.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-6 py-16 sm:py-24">
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="text-center mb-16">
              <h1 className="font-display text-5xl sm:text-6xl font-bold mb-6 tracking-tight leading-[1.1] text-gray-900">
                Encontre vagas que dão <span className="text-blue-600">match</span> com você.
              </h1>
              <p className="text-gray-500 text-lg max-w-xl mx-auto font-light leading-relaxed">
                Nossa automação cruza seu perfil com vagas em tempo real para encontrar as melhores oportunidades de tecnologia.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-6 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
              <h2 className="text-xs font-bold text-gray-400 uppercase tracking-[0.15em] mb-8 flex items-center gap-2">
                <Target className="w-4 h-4" />
                Defina seu perfil
              </h2>

              <div className="space-y-8">
                {/* Upload de Currículo */}
                <div className="space-y-3">
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block">Preenchimento Mágico</label>
                  <div className={`border border-dashed ${extracting ? 'border-blue-400 bg-blue-50/50' : extractError ? 'border-red-300 bg-red-50/30' : extractSuccess ? 'border-emerald-300 bg-emerald-50/30' : 'border-gray-200 bg-gray-50/50 hover:bg-gray-50 hover:border-gray-300'} rounded-2xl p-6 text-center transition-all cursor-pointer relative`}>
                    <input type="file" accept="application/pdf" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" disabled={extracting}/>
                    {extracting ? (
                      <div className="flex flex-col items-center justify-center space-y-3 py-2">
                        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                        <p className="text-blue-600 font-medium text-xs uppercase tracking-widest">Lendo currículo e preenchendo...</p>
                      </div>
                    ) : extractSuccess ? (
                      <div className="flex flex-col items-center justify-center space-y-2 py-2">
                        <CheckCircle className="w-8 h-8 text-emerald-500 mb-1" />
                        <p className="text-emerald-700 font-medium text-sm">Dados extraídos com sucesso!</p>
                        <p className="text-emerald-600/70 text-xs text-center max-w-sm">
                           Verifique os campos abaixo. Arquivo: {pdfFile?.name}
                        </p>
                      </div>
                    ) : (
                      <>
                        <UploadCloud className={`w-8 h-8 mx-auto mb-3 ${extractError ? 'text-red-400' : 'text-gray-400'}`} />
                        {pdfFile && !extractError ? (
                          <p className="text-gray-900 font-medium text-sm">{pdfFile.name}</p>
                        ) : (
                          <div className="space-y-2">
                            {extractError ? (
                                <p className="text-red-600 font-medium text-sm px-4">{extractError}</p>
                            ) : (
                                <p className="text-gray-700 font-medium text-sm">Faça upload do seu currículo em PDF</p>
                            )}
                            <p className="text-gray-400 text-xs">Arraste ou clique para tentar preencher automaticamente.</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block">Nome completo</label>
                    <input required name="nome" value={profileData.nome} onChange={handleInputChange} className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm" placeholder="João da Silva" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block">E-mail</label>
                    <input required type="email" name="email" value={profileData.email} onChange={handleInputChange} className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm" placeholder="joao@exemplo.com" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block">LinkedIn (Opcional)</label>
                    <input name="linkedin" value={profileData.linkedin} onChange={handleInputChange} className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm" placeholder="linkedin.com/in/usuario" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block">GitHub / Portfólio (Opcional)</label>
                    <input name="github" value={profileData.github} onChange={handleInputChange} className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm" placeholder="github.com/usuario" />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block">Cargo Desejado</label>
                    <input required name="cargo" value={profileData.cargo} onChange={handleInputChange} className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm" placeholder="Ex: Front-end Developer" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block">Nível</label>
                      <select required name="nivel" value={profileData.nivel} onChange={handleInputChange} className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all appearance-none text-sm">
                        <option value="Estágio">Estágio</option>
                        <option value="Júnior">Júnior</option>
                        <option value="Pleno">Pleno</option>
                        <option value="Sênior">Sênior</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block">Modalidade</label>
                      <select required name="modalidade" value={profileData.modalidade} onChange={handleInputChange} className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all appearance-none text-sm">
                        <option value="remoto">Remoto</option>
                        <option value="híbrido">Híbrido</option>
                        <option value="presencial">Presencial</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block">Cidade / Região</label>
                    <input name="cidade" value={profileData.cidade} onChange={handleInputChange} className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm" placeholder="Ex: São Paulo, SP" />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block">Tecnologias que domina</label>
                    <input required name="tecnologias" value={profileData.tecnologias} onChange={handleInputChange} className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm" placeholder="React, Node.js, TypeScript, Python..." />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block">Formação Acadêmica (Opcional)</label>
                    <textarea name="formacao" value={profileData.formacao} onChange={handleInputChange} rows={2} className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none text-sm leading-relaxed" placeholder="Ex: Bacharel em Ciência da Computação (2018 - 2022) - USP..." />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block">Histórico de Experiências (Opcional)</label>
                    <textarea name="experiencias" value={profileData.experiencias} onChange={handleInputChange} rows={3} className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none text-sm leading-relaxed" placeholder="Destaque suas experiências mais relevantes..." />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block">Resumo Profissional / Bio</label>
                    <textarea required name="resumo" value={profileData.resumo} onChange={handleInputChange} rows={3} className="w-full bg-gray-50/50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none text-sm leading-relaxed" placeholder="Conte brevemente sobre você..." />
                  </div>
                </div>
              </div>

              <div className="mt-10 flex justify-end">
                <button type="submit" className="bg-black hover:bg-gray-800 text-white px-8 py-3.5 rounded-full text-sm font-semibold transition-all flex items-center gap-2 hover:gap-3 hover:shadow-lg hover:-translate-y-0.5">
                  Disparar Webhook & Buscar
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        )}

        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
            {loading ? (
              <div className="py-32 flex flex-col items-center text-center">
                <div className="relative w-16 h-16 mb-8">
                  <div className="absolute inset-0 border border-gray-200 rounded-full"></div>
                  <div className="absolute inset-0 border-2 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
                  <Search className="absolute inset-0 m-auto text-blue-600 animate-pulse w-5 h-5" />
                </div>
                <h2 className="text-2xl font-display font-medium text-gray-900 mb-3 tracking-tight">Processando Análise com IA...</h2>
                <p className="text-gray-500 max-w-sm mx-auto text-sm leading-relaxed">
                  Buscando vagas e analisando match com a engine Llama 3 (Groq).
                </p>
              </div>
            ) : (
              <div>
                <div className="flex flex-col sm:flex-row items-center justify-between mb-12 gap-4">
                  <div className="text-center sm:text-left">
                    <h1 className="text-3xl font-display font-bold text-gray-900 tracking-tight">Vagas Recomendadas</h1>
                    <p className="text-gray-500 text-sm mt-2">Encontramos <span className="font-semibold text-gray-900">{jobs.length}</span> vagas compatíveis com seu perfil.</p>
                  </div>
                  <button onClick={() => setStep(1)} className="px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-700 rounded-full text-sm font-medium border border-gray-200 transition-all shadow-sm">
                    Refazer busca
                  </button>
                </div>

                <div className="flex flex-col gap-6">
                  {jobs.map((job, idx) => (
                    <JobCard key={idx} job={job as Job} />
                  ))}
                </div>

                <div className="mt-12 bg-white border border-gray-200 p-8 rounded-3xl flex flex-col sm:flex-row gap-8 items-center justify-between shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
                  <div>
                    <h3 className="text-base font-display font-bold text-gray-900 mb-2">Processo Completo</h3>
                    <p className="text-gray-500 text-sm leading-relaxed max-w-md">
                      Pela nova arquitetura, o relatório acima é enviado diretamente para o seu E-mail via Resend.
                    </p>
                  </div>
                    
                  {emailStatus.status === 'success' ? (
                      <div className="bg-emerald-50 text-emerald-700 px-6 py-3 rounded-full flex items-center gap-2 border border-emerald-100">
                        <CheckCircle className="w-4 h-4" />
                        <span className="font-medium text-sm tracking-wide">Simulado com sucesso</span>
                      </div>
                  ) : (
                    <button 
                      onClick={enviarEmail}
                      disabled={emailStatus.status === 'loading'}
                      className="bg-black text-white hover:bg-gray-800 disabled:opacity-50 px-6 py-3 rounded-full text-sm font-medium transition-all min-w-[200px]"
                    >
                      {emailStatus.status === 'loading' ? 'Simulando...' : 'Testar gatilho E-mail'}
                    </button>
                  )}
                </div>

              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
