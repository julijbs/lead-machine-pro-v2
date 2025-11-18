import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Brain, TrendingUp, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-background">
      <div className="container mx-auto py-16 space-y-16">
        {/* Hero Section */}
        <div className="text-center space-y-6">
          <div className="inline-block">
            <div className="flex items-center gap-3 bg-primary/10 px-6 py-3 rounded-full">
              <Zap className="h-5 w-5 text-primary" />
              <span className="text-sm font-semibold text-primary">
                JB Digital Solutions
              </span>
            </div>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold">
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              Máquina de Prospecção ICP
            </span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Sistema completo de scraping, qualificação inteligente e análise de leads com IA.
            Encontre clientes premium em minutos.
          </p>

          <div className="flex gap-4 justify-center">
            <Button size="lg" onClick={() => navigate("/scraper")} className="gap-2">
              <Search className="h-5 w-5" />
              Começar Scraping
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/analysis")} className="gap-2">
              <Brain className="h-5 w-5" />
              Analisar Leads
            </Button>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-primary/20 hover:border-primary transition-colors cursor-pointer" 
                onClick={() => navigate("/scraper")}>
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Search className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Scraping Inteligente</CardTitle>
              <CardDescription>
                Extraia leads qualificados do Google Maps e Google Search em segundos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>✓ Busca automatizada por nicho e região</li>
                <li>✓ Dados completos: contato, endereço, site</li>
                <li>✓ Exportação direta para CSV</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-accent/20 hover:border-accent transition-colors cursor-pointer"
                onClick={() => navigate("/analysis")}>
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                <Brain className="h-6 w-6 text-accent" />
              </div>
              <CardTitle>Análise ICP + Faturamento</CardTitle>
              <CardDescription>
                IA qualifica cada lead e estima faturamento acima de 500k
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>✓ Score ICP automático (N1, N2, N3)</li>
                <li>✓ Estimativa de faturamento ({">"}500k)</li>
                <li>✓ Identificação de brechas comerciais</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-primary/20 hover:border-primary transition-colors">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Scripts Personalizados</CardTitle>
              <CardDescription>
                Receba scripts de vídeo e mensagens prontas para cada lead
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>✓ Scripts para vídeos de 12 segundos</li>
                <li>✓ Mensagens personalizadas para DM</li>
                <li>✓ Abordagem consultiva e natural</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center space-y-2">
            <div className="text-4xl font-bold text-primary">100%</div>
            <div className="text-sm text-muted-foreground">Automatizado</div>
          </div>
          <div className="text-center space-y-2">
            <div className="text-4xl font-bold text-accent">IA</div>
            <div className="text-sm text-muted-foreground">Análise Inteligente</div>
          </div>
          <div className="text-center space-y-2">
            <div className="text-4xl font-bold text-primary">{">"}500k</div>
            <div className="text-sm text-muted-foreground">Foco em Premium</div>
          </div>
          <div className="text-center space-y-2">
            <div className="text-4xl font-bold text-accent">CSV</div>
            <div className="text-sm text-muted-foreground">Exportação Direta</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
