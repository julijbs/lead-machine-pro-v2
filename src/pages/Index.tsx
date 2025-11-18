import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Brain, TrendingUp, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import jbLogo from "@/assets/jb-logo.png";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-navy">
      <div className="container mx-auto py-16 space-y-16">
        {/* Hero Section */}
        <div className="text-center space-y-8">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <img src={jbLogo} alt="JB Digital Consulting" className="w-48 h-48 md:w-64 md:h-64 object-contain" />
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold text-gold">
            Máquina de Prospecção ICP
          </h1>
          
          <p className="text-xl text-gold/80 max-w-2xl mx-auto leading-relaxed">
            Sistema completo de scraping, qualificação inteligente e análise de leads com IA.
            Encontre clientes premium em minutos.
          </p>

          <div className="flex gap-4 justify-center flex-wrap">
            <Button 
              size="lg" 
              onClick={() => navigate("/scraper")} 
              className="gap-2 bg-gold hover:bg-gold-light text-navy font-semibold shadow-gold transition-all"
            >
              <Search className="h-5 w-5" />
              Começar Scraping
            </Button>
            <Button 
              size="lg" 
              onClick={() => navigate("/analysis")} 
              className="gap-2 bg-navy-light hover:bg-navy/80 text-gold border-2 border-gold font-semibold"
            >
              <Brain className="h-5 w-5" />
              Analisar Leads
            </Button>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card 
            className="bg-navy-light border-gold/30 hover:border-gold transition-all cursor-pointer hover:shadow-gold" 
            onClick={() => navigate("/scraper")}
          >
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-gold/20 flex items-center justify-center mb-4">
                <Search className="h-6 w-6 text-gold" />
              </div>
              <CardTitle className="text-gold">Scraping Inteligente</CardTitle>
              <CardDescription className="text-gold/70">
                Extraia leads qualificados do Google Maps e Google Search em segundos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gold/80">
                <li>✓ Busca automatizada por nicho e região</li>
                <li>✓ Dados completos: contato, endereço, site</li>
                <li>✓ Exportação direta para CSV</li>
              </ul>
            </CardContent>
          </Card>

          <Card 
            className="bg-navy-light border-gold/30 hover:border-gold transition-all cursor-pointer hover:shadow-gold"
            onClick={() => navigate("/analysis")}
          >
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-gold/20 flex items-center justify-center mb-4">
                <Brain className="h-6 w-6 text-gold" />
              </div>
              <CardTitle className="text-gold">Análise ICP + Faturamento</CardTitle>
              <CardDescription className="text-gold/70">
                IA qualifica cada lead e estima faturamento acima de 500k
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gold/80">
                <li>✓ Score ICP automático (N1, N2, N3)</li>
                <li>✓ Estimativa de faturamento ({">"}500k)</li>
                <li>✓ Identificação de brechas comerciais</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-navy-light border-gold/30 hover:border-gold transition-all hover:shadow-gold">
            <CardHeader>
              <div className="h-12 w-12 rounded-lg bg-gold/20 flex items-center justify-center mb-4">
                <TrendingUp className="h-6 w-6 text-gold" />
              </div>
              <CardTitle className="text-gold">Scripts Personalizados</CardTitle>
              <CardDescription className="text-gold/70">
                Receba scripts de vídeo e mensagens prontas para cada lead
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gold/80">
                <li>✓ Scripts para vídeos de 12 segundos</li>
                <li>✓ Mensagens personalizadas para DM</li>
                <li>✓ Abordagem consultiva e natural</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center space-y-2 p-6 rounded-lg bg-navy-light border border-gold/20">
            <div className="text-4xl font-bold text-gold">100%</div>
            <div className="text-sm text-gold/70">Automatizado</div>
          </div>
          <div className="text-center space-y-2 p-6 rounded-lg bg-navy-light border border-gold/20">
            <div className="text-4xl font-bold text-gold">IA</div>
            <div className="text-sm text-gold/70">Análise Inteligente</div>
          </div>
          <div className="text-center space-y-2 p-6 rounded-lg bg-navy-light border border-gold/20">
            <div className="text-4xl font-bold text-gold">{">"}500k</div>
            <div className="text-sm text-gold/70">Foco em Premium</div>
          </div>
          <div className="text-center space-y-2 p-6 rounded-lg bg-navy-light border border-gold/20">
            <div className="text-4xl font-bold text-gold">CSV</div>
            <div className="text-sm text-gold/70">Exportação Direta</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
