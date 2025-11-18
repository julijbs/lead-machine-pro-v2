import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download, Brain } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AnalysisResults } from "@/components/AnalysisResults";
import { supabase } from "@/integrations/supabase/client";
import type { Lead } from "./Scraper";

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
}

const Analysis = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [leadsInput, setLeadsInput] = useState("");
  const [analyzedLeads, setAnalyzedLeads] = useState<AnalyzedLead[]>([]);

  const handleAnalyze = async () => {
    if (!leadsInput.trim()) {
      toast({
        title: "Erro",
        description: "Cole os dados dos leads em formato JSON",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    try {
      const leads: Lead[] = JSON.parse(leadsInput);
      const analyzed: AnalyzedLead[] = [];

      // Analisa cada lead individualmente
      for (const lead of leads) {
        try {
          const { data, error } = await supabase.functions.invoke('analisar-lead', {
            body: { lead }
          });

          if (error) {
            console.error('Erro ao analisar lead:', error);
            // Adiciona lead com dados padrão em caso de erro
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
              justificativa: "Erro ao processar lead"
            });
          } else {
            analyzed.push({ ...lead, ...data });
          }
        } catch (leadError) {
          console.error('Erro ao processar lead individual:', leadError);
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
            justificativa: "Erro ao processar lead"
          });
        }
      }

      setAnalyzedLeads(analyzed);
      toast({
        title: "Análise concluída!",
        description: `${analyzed.length} leads analisados com sucesso.`,
      });
    } catch (error) {
      console.error('Erro na análise:', error);
      toast({
        title: "Erro na análise",
        description: "Verifique se o JSON está no formato correto.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
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

    const headers = "source,business_name,maps_url,website,phone,address,city,uf,raw_description,status_processamento,icp_score,icp_level,faturamento_score,faturamento_estimado,faturamento_nivel,brecha,script_video,texto_direct,justificativa\n";
    const rows = analyzedLeads.map(lead => 
      `"${lead.source}","${lead.business_name}","${lead.maps_url}","${lead.website}","${lead.phone}","${lead.address}","${lead.city}","${lead.uf}","${lead.raw_description}","${lead.status_processamento}","${lead.icp_score}","${lead.icp_level}","${lead.faturamento_score}","${lead.faturamento_estimado}","${lead.faturamento_nivel}","${lead.brecha}","${lead.script_video}","${lead.texto_direct}","${lead.justificativa}"`
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

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Análise ICP + Faturamento
        </h1>
        <p className="text-muted-foreground mt-2">
          Qualifique seus leads com inteligência artificial
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados para Análise</CardTitle>
          <CardDescription>
            Cole o JSON dos leads do scraper para análise completa
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="leads-input">JSON dos Leads</Label>
            <Textarea
              id="leads-input"
              placeholder='[{"source": "google_maps_rj", "business_name": "Clínica X", ...}]'
              value={leadsInput}
              onChange={(e) => setLeadsInput(e.target.value)}
              rows={10}
              className="font-mono text-sm"
            />
          </div>

          <div className="flex gap-4">
            <Button onClick={handleAnalyze} disabled={isLoading} className="flex-1">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <Brain className="mr-2 h-4 w-4" />
                  Analisar Leads
                </>
              )}
            </Button>

            {analyzedLeads.length > 0 && (
              <Button variant="outline" onClick={downloadCSV}>
                <Download className="mr-2 h-4 w-4" />
                Baixar Resultados
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {analyzedLeads.length > 0 && (
        <AnalysisResults leads={analyzedLeads} />
      )}
    </div>
  );
};

export default Analysis;
