import { Button } from "@/components/ui/button";
import { Home, Search, Brain, History, LogIn, LogOut, User } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import jbLogo from "@/assets/jb-logo.png";

export const Navigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

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

          <div className="flex gap-2 items-center">
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

            {user && (
              <Button
                variant={isActive("/history") ? "default" : "ghost"}
                size="sm"
                onClick={() => navigate("/history")}
                className={isActive("/history")
                  ? "bg-gold hover:bg-gold-light text-navy font-semibold"
                  : "text-gold hover:bg-gold/10"
                }
              >
                <History className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Histórico</span>
              </Button>
            )}

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gold hover:bg-gold/10"
                  >
                    <User className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline max-w-24 truncate">
                      {user.email?.split('@')[0]}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-navy-light border-gold/30">
                  <DropdownMenuItem className="text-gold/70 cursor-default">
                    {user.email}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-gold/20" />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="text-red-400 hover:text-red-300 cursor-pointer"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/auth")}
                className="text-gold hover:bg-gold/10"
              >
                <LogIn className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Entrar</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
