import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download, Search } from "lucide-react";
import { LeadsTable } from "@/components/LeadsTable";
import { supabase } from "@/integrations/supabase/client";

export interface Lead {
  source: string;
  business_name: string;
  maps_url: string;
  website: string;
  phone: string;
  address: string;
  city: string;
  uf: string;
  raw_description: string;
  status_processamento: string;
}

const Scraper = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [formData, setFormData] = useState({
    niche: "",
    city: "",
    uf: "",
    max_results: "30"
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('scrape-leads', {
        body: {
          niche: formData.niche,
          city: formData.city,
          uf: formData.uf,
          max_results: parseInt(formData.max_results)
        }
      });

      if (error) throw error;

      setLeads(data);
      toast({
        title: "Scraping concluído!",
        description: `${data.length} leads encontrados com sucesso.`,
      });
    } catch (error) {
      console.error('Erro no scraping:', error);
      toast({
        title: "Erro no scraping",
        description: "Não foi possível realizar o scraping. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const downloadCSV = () => {
    if (leads.length === 0) {
      toast({
        title: "Nenhum lead para exportar",
        description: "Realize um scraping primeiro.",
        variant: "destructive"
      });
      return;
    }

    const headers = "source,business_name,maps_url,website,phone,address,city,uf,raw_description,status_processamento\n";
    const rows = leads.map(lead => 
      `"${lead.source}","${lead.business_name}","${lead.maps_url}","${lead.website}","${lead.phone}","${lead.address}","${lead.city}","${lead.uf}","${lead.raw_description}","${lead.status_processamento}"`
    ).join("\n");

    const csv = headers + rows;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `leads_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "CSV exportado!",
      description: `${leads.length} leads exportados com sucesso.`,
    });
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Scraper de Leads
        </h1>
        <p className="text-muted-foreground mt-2">
          Extraia leads qualificados do Google Maps e Google Search
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Parâmetros de Busca</CardTitle>
          <CardDescription>
            Configure os critérios para encontrar seus leads ideais
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="niche">Nicho</Label>
                <Input
                  id="niche"
                  placeholder="Ex: clínica estética"
                  value={formData.niche}
                  onChange={(e) => setFormData({ ...formData, niche: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  placeholder="Ex: Rio de Janeiro"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="uf">UF</Label>
                <Input
                  id="uf"
                  placeholder="Ex: RJ"
                  maxLength={2}
                  value={formData.uf}
                  onChange={(e) => setFormData({ ...formData, uf: e.target.value.toUpperCase() })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="max_results">Quantidade de Resultados</Label>
                <Input
                  id="max_results"
                  type="number"
                  min="1"
                  max="100"
                  value={formData.max_results}
                  onChange={(e) => setFormData({ ...formData, max_results: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={isLoading} className="flex-1">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Realizando Scraping...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Iniciar Scraping
                  </>
                )}
              </Button>

              {leads.length > 0 && (
                <Button type="button" variant="outline" onClick={downloadCSV}>
                  <Download className="mr-2 h-4 w-4" />
                  Baixar CSV
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {leads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resultados ({leads.length} leads)</CardTitle>
            <CardDescription>
              Leads encontrados e prontos para análise
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LeadsTable leads={leads} />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Scraper;
