import { useState, useEffect } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download, Brain, Play, Pause, RefreshCw } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { AnalysisResults } from "@/components/AnalysisResults";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Lead } from "./Scraper";
import { Navigation } from "@/components/Navigation";
import { parseCSV, detectFormat } from "@/utils/csvParser";

export interface AnalyzedLead extends Lead {
  icp_score: number;
  icp_level: string;
  faturamento_score: number;
  faturamento_estimado: string;
  faturamento_nivel: string;
  brecha: string;
  script_video: string;
  texto_direct: string;
  justificativa: string;
  // New fields
  quebra_gelo?: string;
  sinais_vitais?: {
    tem_login: boolean;
    ticket_medio_alto: boolean;
    custo_fixo_alto: boolean;
  };
  has_pixel?: boolean;
  site_tech?: string[];
  instagram?: string;
}

const BATCH_SIZE = 50; // Process 50 leads per batch call

const Analysis = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const location = useLocation();

  const [isLoading, setIsLoading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [leadsInput, setLeadsInput] = useState("");
  const [sessionName, setSessionName] = useState("");
  const [analyzedLeads, setAnalyzedLeads] = useState<AnalyzedLead[]>([]);

  // Progress tracking
  const [totalLeads, setTotalLeads] = useState(0);
  const [processedLeads, setProcessedLeads] = useState(0);
  const [successfulLeads, setSuccessfulLeads] = useState(0);
  const [failedLeads, setFailedLeads] = useState(0);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Load leads from navigation state (Scraper → Analysis)
  useEffect(() => {
    if (location.state?.leadsData) {
      setLeadsInput(location.state.leadsData);
      toast({
        title: "Leads carregados!",
        description: "Dados do scraper foram carregados automaticamente. Clique em 'Iniciar Análise' para começar.",
      });
    }
  }, [location.state]);

  // Load session from URL if provided
  useEffect(() => {
    const sessionId = searchParams.get('session');
    if (sessionId && user) {
      loadSession(sessionId);
    }
  }, [searchParams, user]);

  const loadSession = async (sessionId: string) => {
    setIsLoading(true);

    // Load session info
    const { data: session, error: sessionError } = await supabase
      .from('analysis_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      toast({
        title: 'Erro ao carregar sessão',
        description: sessionError.message,
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    setCurrentSessionId(sessionId);
    setSessionName(session.name);
    setTotalLeads(session.total_leads);
    setProcessedLeads(session.processed_leads);
    setSuccessfulLeads(session.successful_leads);
    setFailedLeads(session.failed_leads);

    // Load analyzed leads
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('*')
      .eq('session_id', sessionId)
      .eq('analysis_status', 'completed');

    if (leadsError) {
      toast({
        title: 'Erro ao carregar leads',
        description: leadsError.message,
        variant: 'destructive',
      });
    } else if (leads) {
      const formattedLeads: AnalyzedLead[] = leads.map(lead => ({
        source: lead.source || '',
        business_name: lead.business_name,
        maps_url: lead.maps_url || '',
        website: lead.website || '',
        phone: lead.phone || '',
        address: lead.address || '',
        city: lead.city || '',
        uf: lead.uf || '',
        raw_description: lead.raw_description || '',
        status_processamento: lead.status_processamento || '',
        icp_score: lead.icp_score || 0,
        icp_level: lead.icp_level || 'descartar',
        faturamento_score: lead.faturamento_score || 0,
        faturamento_estimado: lead.faturamento_estimado || '<100k',
        faturamento_nivel: lead.faturamento_nivel || 'baixo',
        brecha: lead.brecha || '',
        script_video: lead.script_video || '',
        texto_direct: lead.texto_direct || '',
        justificativa: lead.justificativa || '',
        // New fields mapping
        quebra_gelo: lead.quebra_gelo || '',
        sinais_vitais: lead.sinais_vitais || { tem_login: false, ticket_medio_alto: false, custo_fixo_alto: false },
        has_pixel: lead.has_pixel || false,
        site_tech: lead.site_tech || [],
        instagram: lead.instagram || '',
      }));
      setAnalyzedLeads(formattedLeads);
    }

    setIsLoading(false);
  };

  const handleAnalyze = async () => {
    // Validation #1: Empty input
    if (!leadsInput.trim()) {
      toast({
        title: "Erro",
        description: "Cole os dados dos leads em formato JSON ou CSV",
        variant: "destructive"
      });
      return;
    }

    // Validation #2: File size limit (5MB)
    const MAX_SIZE_MB = 5;
    const sizeInMB = new Blob([leadsInput]).size / (1024 * 1024);
    if (sizeInMB > MAX_SIZE_MB) {
      toast({
        title: "Arquivo muito grande",
        description: `O tamanho máximo permitido é ${MAX_SIZE_MB}MB. Seu arquivo tem ${sizeInMB.toFixed(2)}MB. Reduza a quantidade de leads.`,
        variant: "destructive"
      });
      return;
    }

    let leads: Lead[];
    const format = detectFormat(leadsInput);

    try {
      if (format === 'json') {
        leads = JSON.parse(leadsInput);
      } else if (format === 'csv') {
        leads = parseCSV(leadsInput) as Lead[];
      } else {
        toast({
          title: "Formato não reconhecido",
          description: "O arquivo deve estar em formato JSON ou CSV válido.",
          variant: "destructive"
        });
        return;
      }
    } catch (error) {
      toast({
        title: "Erro ao processar dados",
        description: error instanceof Error ? error.message : "Verifique se o formato está correto.",
        variant: "destructive"
      });
      return;
    }

    // Validation #3: Array and not empty
    if (!Array.isArray(leads) || leads.length === 0) {
      toast({
        title: "Erro",
        description: "Os dados devem conter pelo menos um lead.",
        variant: "destructive"
      });
      return;
    }

    // Validation #4: Maximum leads limit (500)
    const MAX_LEADS = 500;
    if (leads.length > MAX_LEADS) {
      toast({
        title: "Limite de leads excedido",
        description: `Você pode analisar no máximo ${MAX_LEADS} leads por vez. Você tentou analisar ${leads.length} leads. Divida em lotes menores.`,
        variant: "destructive"
      });
      return;
    }

    // Validation #5: Required fields
    const missingFields = leads.some(lead => !lead.business_name || !lead.city);
    if (missingFields) {
      toast({
        title: "Dados incompletos",
        description: "Alguns leads não possuem campos obrigatórios (business_name, city). Verifique os dados.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setIsPaused(false);
    setTotalLeads(leads.length);
    setProcessedLeads(0);
    setSuccessfulLeads(0);
    setFailedLeads(0);
    setAnalyzedLeads([]);

    const name = sessionName.trim() || `Análise ${new Date().toLocaleDateString('pt-BR')}`;

    // Create session in database if user is logged in
    let sessionId: string | null = null;
    if (user) {
      const { data: session, error: sessionError } = await supabase
        .from('analysis_sessions')
        .insert({
          user_id: user.id,
          name,
          total_leads: leads.length,
          status: 'processing',
        })
        .select()
        .single();

      if (sessionError) {
        console.error('Error creating session:', sessionError);
        toast({
          title: "Aviso",
          description: "Não foi possível salvar a sessão. A análise continuará sem persistência.",
          variant: "destructive"
        });
      } else {
        sessionId = session.id;
        setCurrentSessionId(sessionId);
      }
    }

    try {
      const analyzed: AnalyzedLead[] = [];
      let processed = 0;
      let successful = 0;
      let failed = 0;

      // Process leads in batches
      for (let i = 0; i < leads.length; i += BATCH_SIZE) {
        // Check if paused
        if (isPaused) {
          toast({
            title: "Análise pausada",
            description: `${processed} de ${leads.length} leads processados.`,
          });
          break;
        }

        const batch = leads.slice(i, i + BATCH_SIZE);

        try {
          const { data, error } = await supabase.functions.invoke('analisar-batch', {
            body: {
              leads: batch,
              session_id: sessionId,
              user_id: user?.id,
            }
          });

          if (error) {
            console.error('Batch error:', error);
            // Mark all leads in batch as failed
            batch.forEach(lead => {
              analyzed.push({
                ...lead,
                icp_score: 0,
                icp_level: "descartar",
                faturamento_score: 0,
                faturamento_estimado: "<100k",
                faturamento_nivel: "baixo",
                brecha: "Erro na análise",
                script_video: "",
                texto_direct: "",
                justificativa: `Erro: ${error.message}`
              });
            });
            failed += batch.length;
          } else if (data?.results) {
            // Process results
            data.results.forEach((result: any) => {
              if (result.success !== false) {
                analyzed.push({
                  source: result.source || '',
                  business_name: result.business_name,
                  maps_url: result.maps_url || '',
                  website: result.website || '',
                  phone: result.phone || '',
                  address: result.address || '',
                  city: result.city || '',
                  uf: result.uf || '',
                  raw_description: result.raw_description || '',
                  status_processamento: result.status_processamento || '',
                  icp_score: result.icp_score || 0,
                  icp_level: result.icp_level || 'descartar',
                  faturamento_score: result.faturamento_score || 0,
                  faturamento_estimado: result.faturamento_estimado || '<100k',
                  faturamento_nivel: result.faturamento_nivel || 'baixo',
                  brecha: result.brecha || '',
                  script_video: result.script_video || '',
                  texto_direct: result.texto_direct || '',
                  justificativa: result.justificativa || '',
                  // New fields mapping
                  quebra_gelo: result.quebra_gelo || '',
                  sinais_vitais: result.sinais_vitais || { tem_login: false, ticket_medio_alto: false, custo_fixo_alto: false },
                  has_pixel: result.has_pixel || false,
                  site_tech: result.site_tech || [],
                  instagram: result.instagram || '',
                });
                successful++;
              } else {
                analyzed.push({
                  source: result.source || '',
                  business_name: result.business_name,
                  maps_url: result.maps_url || '',
                  website: result.website || '',
                  phone: result.phone || '',
                  address: result.address || '',
                  city: result.city || '',
                  uf: result.uf || '',
                  raw_description: result.raw_description || '',
                  status_processamento: result.status_processamento || '',
                  icp_score: 0,
                  icp_level: "descartar",
                  faturamento_score: 0,
                  faturamento_estimado: "<100k",
                  faturamento_nivel: "baixo",
                  brecha: "Erro na análise",
                  script_video: "",
                  texto_direct: "",
                  justificativa: result.error || "Erro desconhecido"
                });
                failed++;
              }
            });
          }
        } catch (batchError) {
          console.error('Batch processing error:', batchError);
          batch.forEach(lead => {
            analyzed.push({
              ...lead,
              icp_score: 0,
              icp_level: "descartar",
              faturamento_score: 0,
              faturamento_estimado: "<100k",
              faturamento_nivel: "baixo",
              brecha: "Erro na análise",
              script_video: "",
              texto_direct: "",
              justificativa: "Erro de conexão"
            });
          });
          failed += batch.length;
        }

        processed += batch.length;
        setProcessedLeads(processed);
        setSuccessfulLeads(successful);
        setFailedLeads(failed);
        setAnalyzedLeads([...analyzed]);
      }

      // Update session status
      if (sessionId) {
        await supabase
          .from('analysis_sessions')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', sessionId);
      }

      toast({
        title: "Análise concluída!",
        description: `${successful} leads analisados com sucesso, ${failed} com erro.`,
      });
    } catch (error) {
      console.error('Analysis error:', error);
      toast({
        title: "Erro na análise",
        description: "Ocorreu um erro durante o processamento.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePause = () => {
    setIsPaused(true);
  };

  const handleResume = () => {
    setIsPaused(false);
    // Resume would need to track where we stopped - for now just allow restart
    toast({
      title: "Retomar análise",
      description: "Use o histórico para continuar sessões pausadas.",
    });
  };

  const downloadCSV = () => {
    if (analyzedLeads.length === 0) {
      toast({
        title: "Nenhum lead para exportar",
        description: "Realize uma análise primeiro.",
        variant: "destructive"
      });
      return;
    }

    const headers = "source,business_name,maps_url,website,phone,address,city,uf,raw_description,status_processamento,icp_score,icp_level,faturamento_score,faturamento_estimado,faturamento_nivel,brecha,script_video,texto_direct,quebra_gelo,has_pixel,site_tech,instagram,justificativa\n";
    const rows = analyzedLeads.map(lead =>
      `"${lead.source}","${lead.business_name}","${lead.maps_url}","${lead.website}","${lead.phone}","${lead.address}","${lead.city}","${lead.uf}","${(lead.raw_description || '').replace(/"/g, '""')}","${lead.status_processamento}","${lead.icp_score}","${lead.icp_level}","${lead.faturamento_score}","${lead.faturamento_estimado}","${lead.faturamento_nivel}","${(lead.brecha || '').replace(/"/g, '""')}","${(lead.script_video || '').replace(/"/g, '""')}","${(lead.texto_direct || '').replace(/"/g, '""')}","${(lead.quebra_gelo || '').replace(/"/g, '""')}","${lead.has_pixel ? 'Sim' : 'Não'}","${(lead.site_tech || []).join(', ')}","${lead.instagram || ''}","${(lead.justificativa || '').replace(/"/g, '""')}"`
    ).join("\n");

    const csv = headers + rows;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `leads_analisados_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "CSV exportado!",
      description: `${analyzedLeads.length} leads exportados com sucesso.`,
    });
  };

  const progressPercent = totalLeads > 0 ? (processedLeads / totalLeads) * 100 : 0;

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-navy py-8">
        <div className="container mx-auto space-y-8">
          <div>
            <h1 className="text-4xl font-bold text-gold">
              Análise ICP + Faturamento
            </h1>
            <p className="text-gold/70 mt-2">
              Qualifique seus leads com inteligência artificial
            </p>
          </div>

          <Card className="bg-navy-light border-gold/30">
            <CardHeader>
              <CardTitle className="text-gold">Dados para Análise</CardTitle>
              <CardDescription className="text-gold/70">
                Cole os dados dos leads em formato JSON ou CSV para análise completa
                {user && " - Os resultados serão salvos automaticamente"}
              </CardDescription>
              <div className="mt-4 p-3 bg-navy/50 border border-gold/20 rounded-md">
                <p className="text-sm text-gold/90 font-medium mb-2">📋 Limites e Requisitos:</p>
                <ul className="text-xs text-gold/70 space-y-1">
                  <li>• Máximo: <span className="text-gold font-semibold">500 leads</span> por análise</li>
                  <li>• Tamanho máximo: <span className="text-gold font-semibold">5MB</span></li>
                  <li>• Campos obrigatórios: <span className="text-gold font-semibold">business_name</span> e <span className="text-gold font-semibold">city</span></li>
                  <li>• Formatos aceitos: <span className="text-gold font-semibold">JSON</span> ou <span className="text-gold font-semibold">CSV</span></li>
                </ul>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {user && (
                <div className="space-y-2">
                  <Label htmlFor="session-name">Nome da Sessão (opcional)</Label>
                  <Input
                    id="session-name"
                    placeholder={`Análise ${new Date().toLocaleDateString('pt-BR')}`}
                    value={sessionName}
                    onChange={(e) => setSessionName(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="leads-input">JSON ou CSV dos Leads</Label>
                <Textarea
                  id="leads-input"
                  placeholder='JSON: [{"source": "google_maps_rj", "business_name": "Clínica X", ...}]&#10;&#10;ou&#10;&#10;CSV: source,business_name,maps_url,...&#10;"google_maps_rj","Clínica X","https://...",...'
                  value={leadsInput}
                  onChange={(e) => setLeadsInput(e.target.value)}
                  rows={10}
                  className="font-mono text-sm"
                  disabled={isLoading}
                />
              </div>

              {/* Progress indicator */}
              {(isLoading || processedLeads > 0) && totalLeads > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-gold/70">
                    <span>Progresso: {processedLeads} de {totalLeads} leads</span>
                    <span>{progressPercent.toFixed(1)}%</span>
                  </div>
                  <Progress value={progressPercent} className="h-3" />
                  <div className="flex gap-4 text-xs">
                    <span className="text-green-400">Sucesso: {successfulLeads}</span>
                    <span className="text-red-400">Erros: {failedLeads}</span>
                    <span className="text-yellow-400">Pendentes: {totalLeads - processedLeads}</span>
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                {!isLoading ? (
                  <Button
                    onClick={handleAnalyze}
                    className="flex-1 bg-gold hover:bg-gold-light text-navy font-semibold shadow-gold"
                  >
                    <Brain className="mr-2 h-4 w-4" />
                    Analisar Leads
                  </Button>
                ) : (
                  <>
                    <Button
                      onClick={handlePause}
                      variant="outline"
                      className="flex-1 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                      disabled={isPaused}
                    >
                      <Pause className="mr-2 h-4 w-4" />
                      Pausar
                    </Button>
                    <Button
                      disabled
                      className="flex-1 bg-gold/50 text-navy font-semibold"
                    >
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analisando... {processedLeads}/{totalLeads}
                    </Button>
                  </>
                )}

                {analyzedLeads.length > 0 && (
                  <Button
                    variant="outline"
                    onClick={downloadCSV}
                    className="border-gold/30 text-gold hover:bg-gold/10"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Baixar Resultados
                  </Button>
                )}
              </div>

              {!user && (
                <p className="text-xs text-gold/50 text-center">
                  Faça login para salvar suas análises e acessar o histórico
                </p>
              )}
            </CardContent>
          </Card>

          {analyzedLeads.length > 0 && (
            <AnalysisResults leads={analyzedLeads} />
          )}
        </div>
      </div>
    </>
  );
};

export default Analysis;
