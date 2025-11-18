import { Button } from "@/components/ui/button";
import { Home, Search, Brain } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import jbLogo from "@/assets/jb-logo.png";

export const Navigation = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="bg-navy border-b border-gold/20">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img 
              src={jbLogo} 
              alt="JB Digital" 
              className="w-12 h-12 cursor-pointer" 
              onClick={() => navigate("/")}
            />
            <span className="text-xl font-bold text-gold hidden md:block">
              JB Digital Consulting
            </span>
          </div>

          <div className="flex gap-2">
            <Button
              variant={isActive("/") ? "default" : "ghost"}
              size="sm"
              onClick={() => navigate("/")}
              className={isActive("/") 
                ? "bg-gold hover:bg-gold-light text-navy font-semibold" 
                : "text-gold hover:bg-gold/10"
              }
            >
              <Home className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Início</span>
            </Button>

            <Button
              variant={isActive("/scraper") ? "default" : "ghost"}
              size="sm"
              onClick={() => navigate("/scraper")}
              className={isActive("/scraper") 
                ? "bg-gold hover:bg-gold-light text-navy font-semibold" 
                : "text-gold hover:bg-gold/10"
              }
            >
              <Search className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Scraper</span>
            </Button>

            <Button
              variant={isActive("/analysis") ? "default" : "ghost"}
              size="sm"
              onClick={() => navigate("/analysis")}
              className={isActive("/analysis") 
                ? "bg-gold hover:bg-gold-light text-navy font-semibold" 
                : "text-gold hover:bg-gold/10"
              }
            >
              <Brain className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Análise</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
