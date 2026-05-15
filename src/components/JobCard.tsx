import React from 'react';
import { Check, ExternalLink } from 'lucide-react';

export interface Job {
  titulo: string;
  empresa: string;
  localizacao: string;
  modelo: string;
  compatibilidade: number;
  motivos: string[];
  tecnologias: string[];
  link: string;
}

export const JobCard: React.FC<{ job: Job }> = ({ job }) => {
  const isHighMatch = job.compatibilidade >= 80;
  const isMediumMatch = job.compatibilidade >= 60 && job.compatibilidade < 80;

  const compColor = isHighMatch 
    ? 'text-emerald-700 bg-emerald-50 border-emerald-100' 
    : isMediumMatch 
    ? 'text-blue-700 bg-blue-50 border-blue-100' 
    : 'text-gray-700 bg-gray-50 border-gray-200';
    
  const borderClass = isHighMatch ? 'hover:border-emerald-200' : 'hover:border-blue-200';
  const dotColor = isHighMatch ? 'bg-emerald-500' : isMediumMatch ? 'bg-blue-500' : 'bg-gray-400';

  return (
    <div className={`bg-white p-8 rounded-3xl border border-gray-100 shadow-[0_2px_10px_rgb(0,0,0,0.02)] flex flex-col group transition-all duration-300 ${borderClass}`}>
      <div className="flex flex-col sm:flex-row justify-between gap-6 mb-8">
        <div>
          <h3 className="text-xl font-display font-semibold text-gray-900 group-hover:text-blue-600 transition-colors tracking-tight mb-2">{job.titulo}</h3>
          <p className="text-gray-500 text-sm flex items-center gap-2">
            <span className="font-medium text-gray-700">{job.empresa}</span>
            <span className="w-1 h-1 rounded-full bg-gray-300"></span>
            {job.localizacao} 
            <span className="w-1 h-1 rounded-full bg-gray-300"></span>
            <span className="capitalize">{job.modelo}</span>
          </p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border self-start shrink-0 ${compColor}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></div>
          <span className="text-[11px] font-bold tracking-wide uppercase">Match {job.compatibilidade}%</span>
        </div>
      </div>

      <div className="mb-8">
        <h4 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">Porque selecionamos esta vaga</h4>
        <ul className="space-y-3">
          {job.motivos?.map((motivo: string, i: number) => (
            <li key={i} className="flex gap-3 text-gray-600 text-sm items-start leading-relaxed">
              <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
              <span>{motivo}</span>
            </li>
          ))}
        </ul>
      </div>

      {job.tecnologias?.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8 mt-auto">
          {job.tecnologias.map((tech: string, i: number) => (
            <span key={i} className="px-3 py-1 bg-gray-50 text-gray-600 text-xs rounded-full border border-gray-100 font-medium">
              {tech}
            </span>
          ))}
        </div>
      )}

      <div className="flex justify-end pt-6 border-t border-gray-100/60 mt-auto">
        <a href={job.link} target="_blank" rel="noreferrer" className="px-6 py-2.5 bg-black text-white rounded-full text-sm font-medium hover:bg-gray-800 transition-all flex items-center gap-2 hover:gap-3">
          Candidatar-se
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}
