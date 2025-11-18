import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, DollarSign, Target, Video, MessageSquare } from "lucide-react";
import type { AnalyzedLead } from "@/pages/Analysis";

interface AnalysisResultsProps {
  leads: AnalyzedLead[];
}

export const AnalysisResults = ({ leads }: AnalysisResultsProps) => {
  const getICPBadgeVariant = (level: string) => {
    switch (level) {
      case "N1": return "default";
      case "N2": return "secondary";
      case "N3": return "outline";
      default: return "destructive";
    }
  };

  const getFaturamentoBadgeVariant = (nivel: string) => {
    switch (nivel) {
      case "premium": return "default";
      case "alto": return "secondary";
      case "médio": return "outline";
      default: return "destructive";
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Resultados da Análise ({leads.length} leads)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-primary">
                  {leads.filter(l => l.icp_level === "N1").length}
                </div>
                <div className="text-sm text-muted-foreground">Leads N1</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-primary">
                  {leads.filter(l => l.icp_level === "N2").length}
                </div>
                <div className="text-sm text-muted-foreground">Leads N2</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-accent">
                  {leads.filter(l => l.faturamento_nivel === "premium").length}
                </div>
                <div className="text-sm text-muted-foreground">Premium ({">"}500k)</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-destructive">
                  {leads.filter(l => l.icp_level === "descartar").length}
                </div>
                <div className="text-sm text-muted-foreground">Descartados</div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            {leads.map((lead, index) => (
              <Card key={index} className="border-l-4" style={{
                borderLeftColor: lead.icp_level === "N1" ? "hsl(var(--primary))" :
                               lead.icp_level === "N2" ? "hsl(var(--accent))" :
                               lead.icp_level === "N3" ? "hsl(var(--warning))" :
                               "hsl(var(--destructive))"
              }}>
                <CardContent className="pt-6">
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">{lead.business_name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {lead.city} - {lead.uf} | {lead.phone}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant={getICPBadgeVariant(lead.icp_level)}>
                          ICP: {lead.icp_level}
                        </Badge>
                        <Badge variant={getFaturamentoBadgeVariant(lead.faturamento_nivel)}>
                          {lead.faturamento_estimado}
                        </Badge>
                      </div>
                    </div>

                    <Tabs defaultValue="overview" className="w-full">
                      <TabsList className="grid w-full grid-cols-4">
                        <TabsTrigger value="overview">
                          <Target className="h-4 w-4 mr-2" />
                          Visão Geral
                        </TabsTrigger>
                        <TabsTrigger value="brecha">
                          <DollarSign className="h-4 w-4 mr-2" />
                          Brecha
                        </TabsTrigger>
                        <TabsTrigger value="video">
                          <Video className="h-4 w-4 mr-2" />
                          Script Vídeo
                        </TabsTrigger>
                        <TabsTrigger value="direct">
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Direct
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="overview" className="space-y-2">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium">Score ICP:</span> {lead.icp_score}/3
                          </div>
                          <div>
                            <span className="font-medium">Score Faturamento:</span> {lead.faturamento_score}/10
                          </div>
                        </div>
                        <div className="text-sm">
                          <span className="font-medium">Justificativa:</span>
                          <p className="text-muted-foreground mt-1">{lead.justificativa}</p>
                        </div>
                      </TabsContent>

                      <TabsContent value="brecha">
                        <div className="bg-accent/10 p-4 rounded-lg">
                          <p className="text-sm">{lead.brecha}</p>
                        </div>
                      </TabsContent>

                      <TabsContent value="video">
                        <div className="bg-primary/10 p-4 rounded-lg">
                          <p className="text-sm italic">"{lead.script_video}"</p>
                        </div>
                      </TabsContent>

                      <TabsContent value="direct">
                        <div className="bg-secondary p-4 rounded-lg">
                          <p className="text-sm">{lead.texto_direct}</p>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
