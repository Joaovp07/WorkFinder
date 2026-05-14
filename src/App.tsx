import React, { useState } from 'react';
import { Briefcase, Send, UploadCloud, Search, CheckCircle, Target, ArrowRight } from 'lucide-react';

export default function App() {
  const [step, setStep] = useState(1);
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setProfileData({ ...profileData, [e.target.name]: e.target.value });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPdfFile(file);

      // Extract data automatically avoiding AI
      const formData = new FormData();
      formData.append('curriculo', file);
      
      try {
        setExtracting(true);
        const res = await fetch('/api/extrair-curriculo', {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          setProfileData(prev => ({
            ...prev,
            nome: data.nome || prev.nome,
            email: data.email || prev.email,
            cargo: data.cargo || prev.cargo,
            nivel: data.nivel || prev.nivel,
            tecnologias: data.tecnologias ? (prev.tecnologias ? `${prev.tecnologias}, ${data.tecnologias}` : data.tecnologias) : prev.tecnologias,
            resumo: data.resumo || prev.resumo,
          }));
        } else {
           const errStr = await res.text();
           alert('Aviso: Não foi possível extrair dados automaticamente do PDF.');
        }
      } catch (err) {
        console.error("Erro ao extrair dados do PDF", err);
        alert('Aviso: Ocorreu um erro ao extrair os dados do currículo.');
      } finally {
        setExtracting(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep(2);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('profile', JSON.stringify(profileData));
      if (pdfFile) {
        formData.append('curriculo', pdfFile);
      }

      const res = await fetch('/api/analisar-vagas', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Falha ao analisar vagas');
      
      const data = await res.json();
      setJobs(data);
    } catch (err) {
      console.error(err);
      alert('Erro ao buscar e analisar vagas. Tente novamente.');
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  const enviarEmail = async () => {
    if (jobs.length === 0) return;
    setEmailStatus({ status: 'loading' });
    try {
      const res = await fetch('/api/enviar-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: profileData.email,
          nome: profileData.nome,
          vagas: jobs.slice(0, 5) // Envia top 5
        }),
      });
      const data = await res.json();
      setEmailStatus({ status: 'success', link: data.previewUrl });
    } catch (err) {
      setEmailStatus({ status: 'error' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30">
      {/* Navbar */}
      <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center text-white">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">WorkFinder</span>
          </div>
          <p className="text-sm font-medium text-slate-400 hidden sm:block">Match Inteligente de Vagas</p>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-8 py-12">
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-10">
              <h1 className="text-4xl sm:text-5xl font-bold mb-4 tracking-tight text-white">
                Encontre vagas que dão <span className="text-indigo-400">match</span> com você.
              </h1>
              <p className="text-slate-400 text-lg">
                Nossa IA cruza seu perfil com vagas em tempo real para encontrar as melhores oportunidades de tecnologia.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl">
              <h2 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                <Target className="w-4 h-4" />
                Defina seu perfil
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Nome completo *</label>
                  <input required name="nome" value={profileData.nome} onChange={handleInputChange} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition text-sm" placeholder="João da Silva" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">E-mail *</label>
                  <input required type="email" name="email" value={profileData.email} onChange={handleInputChange} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition text-sm" placeholder="joao@exemplo.com" />
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Cargo Desejado *</label>
                  <input required name="cargo" value={profileData.cargo} onChange={handleInputChange} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition text-sm" placeholder="Ex: Front-end Developer" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Nível *</label>
                    <select required name="nivel" value={profileData.nivel} onChange={handleInputChange} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition appearance-none text-sm">
                      <option value="Estágio">Estágio</option>
                      <option value="Júnior">Júnior</option>
                      <option value="Pleno">Pleno</option>
                      <option value="Sênior">Sênior</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Modalidade *</label>
                    <select required name="modalidade" value={profileData.modalidade} onChange={handleInputChange} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition appearance-none text-sm">
                      <option value="remoto">Remoto</option>
                      <option value="híbrido">Híbrido</option>
                      <option value="presencial">Presencial</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Tecnologias que domina *</label>
                  <input required name="tecnologias" value={profileData.tecnologias} onChange={handleInputChange} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition text-sm" placeholder="React, Node.js, TypeScript, Python..." />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Resumo Profissional *</label>
                  <textarea required name="resumo" value={profileData.resumo} onChange={handleInputChange} rows={3} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition resize-none text-sm" placeholder="Conte brevemente suas experiências principais..." />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">Upload de Currículo (PDF)</label>
                  <div className="border-2 border-dashed border-slate-700 bg-slate-800/10 rounded-xl p-8 text-center hover:bg-slate-800/50 hover:border-indigo-500/50 transition-all cursor-pointer relative">
                    <input type="file" accept="application/pdf" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed" disabled={extracting}/>
                    <UploadCloud className={`w-8 h-8 text-slate-500 mx-auto mb-3 ${extracting ? 'animate-pulse text-indigo-400' : ''}`} />
                    {extracting ? (
                      <p className="text-indigo-400 font-medium text-sm">Lendo currículo...</p>
                    ) : pdfFile ? (
                      <p className="text-indigo-400 font-medium text-sm">{pdfFile.name}</p>
                    ) : (
                      <p className="text-slate-400 text-sm">Arraste seu PDF ou clique para selecionar</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-8 flex justify-end">
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-lg text-sm font-bold shadow-lg shadow-indigo-600/20 transition flex items-center gap-2">
                  Analisar e Buscar Vagas
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        )}

        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {loading ? (
              <div className="py-20 flex flex-col items-center text-center">
                <div className="relative w-20 h-20 mb-6">
                  <div className="absolute inset-0 border-4 border-slate-800 rounded-full"></div>
                  <div className="absolute inset-0 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
                  <Search className="absolute inset-0 m-auto text-indigo-400 animate-pulse w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold mb-2 text-white">Buscando as melhores vagas...</h2>
                <p className="text-slate-400 max-w-md mx-auto text-sm">
                  Nossa IA está lendo seu currículo, cruzando dados com o Remotive Jobs e calculando o nível de compatibilidade. Isso pode levar alguns segundos.
                </p>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h1 className="text-2xl font-bold text-white">Vagas Recomendadas</h1>
                    <p className="text-slate-400 text-sm mt-1">Encontramos {jobs.length} vagas compatíveis com seu perfil.</p>
                  </div>
                  <button onClick={() => setStep(1)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm border border-slate-700 transition-colors">
                    Refazer busca
                  </button>
                </div>

                <div className="flex flex-col gap-4">
                  {jobs.map((job, idx) => {
                    const compColor = job.compatibilidade >= 80 ? 'text-emerald-400' : job.compatibilidade >= 50 ? 'text-amber-400' : 'text-slate-400';
                    const compBg = job.compatibilidade >= 80 ? 'bg-emerald-500/10' : job.compatibilidade >= 50 ? 'bg-amber-500/10' : 'bg-slate-800/50';
                    const borderHover = job.compatibilidade >= 80 ? 'hover:border-emerald-500/30' : job.compatibilidade >= 50 ? 'hover:border-amber-500/30' : 'hover:border-indigo-500/30';
                    const dotColor = job.compatibilidade >= 80 ? 'bg-emerald-500' : job.compatibilidade >= 50 ? 'bg-amber-500' : 'bg-slate-500';

                    return (
                      <div key={idx} className={`bg-slate-900 p-5 rounded-2xl border border-slate-800 flex flex-col group ${borderHover} transition-all`}>
                        <div className="flex flex-col sm:flex-row justify-between gap-4 mb-4">
                          <div>
                            <h3 className="text-lg font-bold text-white">{job.titulo}</h3>
                            <p className="text-slate-400 text-sm mb-3">{job.empresa} • {job.localizacao} ({job.modelo})</p>
                          </div>
                          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-700/50 self-start ${compBg} ${compColor}`}>
                            <div className={`w-2 h-2 rounded-full ${dotColor}`}></div>
                            <span className="text-xs font-medium tracking-wide">Match {job.compatibilidade}%</span>
                          </div>
                        </div>

                        <div className="mb-6">
                           <ul className="space-y-1.5">
                            {job.motivos?.map((motivo: string, i: number) => (
                              <li key={i} className="flex gap-2 text-slate-300 text-sm items-start">
                                <span className="text-slate-500 leading-tight mt-0.5">•</span>
                                <span className="leading-tight">{motivo}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {job.tecnologias?.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-6 mt-auto">
                            {job.tecnologias.map((tech: string, i: number) => (
                              <span key={i} className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs rounded-full border border-slate-700">
                                {tech}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex justify-end border-t border-slate-800 pt-4 mt-auto">
                          <a href={job.link} target="_blank" rel="noreferrer" className="px-4 py-2 bg-indigo-600/10 text-indigo-400 border border-indigo-500/30 rounded-lg text-xs font-bold hover:bg-indigo-600 hover:text-white transition-all">
                            Ver Detalhes
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-8 flex items-center justify-between bg-slate-900 border border-slate-800 p-6 rounded-2xl flex-col sm:flex-row gap-6">
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">Alertas por E-mail</h3>
                    <p className="text-slate-400 text-sm">
                      Receba essa curadoria de vagas diretamente no seu e-mail (Simulação via Ethereal).
                    </p>
                  </div>
                    
                  {emailStatus.status === 'success' ? (
                      <div className="bg-emerald-500/10 text-emerald-400 px-6 py-3 rounded-lg flex items-center justify-center gap-3 border border-emerald-500/20">
                        <CheckCircle className="w-5 h-5" />
                        <div className="flex flex-col text-sm">
                          <span className="font-medium">Enviado com sucesso!</span>
                          <a href={emailStatus.link} target="_blank" rel="noreferrer" className="text-emerald-300 underline hover:text-white">Abrir E-mail</a>
                        </div>
                      </div>
                  ) : (
                    <button 
                      onClick={enviarEmail}
                      disabled={emailStatus.status === 'loading'}
                      className="bg-white text-indigo-600 hover:bg-slate-100 disabled:opacity-50 px-6 py-3 rounded-lg text-sm font-bold shadow-lg transition whitespace-nowrap min-w-[200px]"
                    >
                      {emailStatus.status === 'loading' ? 'Enviando...' : 'Enviar para meu e-mail'}
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
