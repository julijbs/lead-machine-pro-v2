import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Navigation } from '@/components/Navigation';
import {
  Loader2,
  History as HistoryIcon,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  Trash2,
  Eye,
  RefreshCw
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface AnalysisSession {
  id: string;
  name: string;
  total_leads: number;
  processed_leads: number;
  successful_leads: number;
  failed_leads: number;
  status: string;
  created_at: string;
  completed_at: string | null;
}

const History = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [sessions, setSessions] = useState<AnalysisSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSessions = async () => {
    if (!user) return;

    setIsLoading(true);
    const { data, error } = await supabase
      .from('analysis_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: 'Erro ao carregar histórico',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setSessions(data || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchSessions();
  }, [user]);

  const handleDelete = async (sessionId: string) => {
    const { error } = await supabase
      .from('analysis_sessions')
      .delete()
      .eq('id', sessionId);

    if (error) {
      toast({
        title: 'Erro ao excluir',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Sessão excluída',
        description: 'A sessão foi removida com sucesso.',
      });
      fetchSessions();
    }
  };

  const handleExportSession = async (sessionId: string, sessionName: string) => {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('session_id', sessionId)
      .eq('analysis_status', 'completed');

    if (error) {
      toast({
        title: 'Erro ao exportar',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    if (!data || data.length === 0) {
      toast({
        title: 'Nenhum lead para exportar',
        description: 'Esta sessão não possui leads analisados.',
        variant: 'destructive',
      });
      return;
    }

    const headers = "source,business_name,maps_url,website,phone,address,city,uf,raw_description,icp_score,icp_level,faturamento_score,faturamento_estimado,faturamento_nivel,brecha,script_video,texto_direct,justificativa\n";
    const rows = data.map(lead =>
      `"${lead.source || ''}","${lead.business_name}","${lead.maps_url || ''}","${lead.website || ''}","${lead.phone || ''}","${lead.address || ''}","${lead.city || ''}","${lead.uf || ''}","${(lead.raw_description || '').replace(/"/g, '""')}","${lead.icp_score}","${lead.icp_level}","${lead.faturamento_score}","${lead.faturamento_estimado}","${lead.faturamento_nivel}","${(lead.brecha || '').replace(/"/g, '""')}","${(lead.script_video || '').replace(/"/g, '""')}","${(lead.texto_direct || '').replace(/"/g, '""')}","${(lead.justificativa || '').replace(/"/g, '""')}"`
    ).join("\n");

    const csv = headers + rows;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${sessionName}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: 'CSV exportado!',
      description: `${data.length} leads exportados com sucesso.`,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Concluída</Badge>;
      case 'processing':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Processando</Badge>;
      case 'error':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Erro</Badge>;
      default:
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">Pendente</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!user) {
    return (
      <>
        <Navigation />
        <div className="min-h-screen bg-navy py-8">
          <div className="container mx-auto text-center">
            <Card className="bg-navy-light border-gold/30 max-w-md mx-auto">
              <CardContent className="pt-6">
                <p className="text-gold/70 mb-4">Faça login para ver seu histórico de análises.</p>
                <Button
                  onClick={() => navigate('/auth')}
                  className="bg-gold hover:bg-gold-light text-navy font-semibold"
                >
                  Fazer Login
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-navy py-8">
        <div className="container mx-auto space-y-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold text-gold flex items-center gap-3">
                <HistoryIcon className="h-10 w-10" />
                Histórico de Análises
              </h1>
              <p className="text-gold/70 mt-2">
                Gerencie suas sessões de análise anteriores
              </p>
            </div>
            <Button
              onClick={fetchSessions}
              variant="outline"
              className="border-gold/30 text-gold hover:bg-gold/10"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gold" />
            </div>
          ) : sessions.length === 0 ? (
            <Card className="bg-navy-light border-gold/30">
              <CardContent className="py-12 text-center">
                <HistoryIcon className="h-12 w-12 text-gold/30 mx-auto mb-4" />
                <p className="text-gold/70">Nenhuma análise encontrada.</p>
                <p className="text-gold/50 text-sm mt-2">
                  Suas sessões de análise aparecerão aqui.
                </p>
                <Button
                  onClick={() => navigate('/analysis')}
                  className="mt-4 bg-gold hover:bg-gold-light text-navy font-semibold"
                >
                  Iniciar Nova Análise
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {sessions.map((session) => (
                <Card key={session.id} className="bg-navy-light border-gold/30">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-gold">{session.name}</CardTitle>
                        <CardDescription className="text-gold/70 flex items-center gap-2 mt-1">
                          <Calendar className="h-4 w-4" />
                          {formatDate(session.created_at)}
                        </CardDescription>
                      </div>
                      {getStatusBadge(session.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="text-center p-3 bg-navy rounded-lg">
                        <p className="text-2xl font-bold text-gold">{session.total_leads}</p>
                        <p className="text-xs text-gold/70">Total</p>
                      </div>
                      <div className="text-center p-3 bg-navy rounded-lg">
                        <p className="text-2xl font-bold text-green-400">{session.successful_leads}</p>
                        <p className="text-xs text-gold/70 flex items-center justify-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Sucesso
                        </p>
                      </div>
                      <div className="text-center p-3 bg-navy rounded-lg">
                        <p className="text-2xl font-bold text-red-400">{session.failed_leads}</p>
                        <p className="text-xs text-gold/70 flex items-center justify-center gap-1">
                          <XCircle className="h-3 w-3" />
                          Erros
                        </p>
                      </div>
                      <div className="text-center p-3 bg-navy rounded-lg">
                        <p className="text-2xl font-bold text-yellow-400">
                          {session.total_leads - session.processed_leads}
                        </p>
                        <p className="text-xs text-gold/70 flex items-center justify-center gap-1">
                          <Clock className="h-3 w-3" />
                          Pendentes
                        </p>
                      </div>
                    </div>

                    {session.status === 'processing' && (
                      <div className="mb-4">
                        <div className="h-2 bg-navy rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gold transition-all duration-300"
                            style={{
                              width: `${(session.processed_leads / session.total_leads) * 100}%`,
                            }}
                          />
                        </div>
                        <p className="text-xs text-gold/70 mt-1 text-center">
                          {session.processed_leads} de {session.total_leads} processados
                        </p>
                      </div>
                    )}

                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-gold/30 text-gold hover:bg-gold/10"
                        onClick={() => navigate(`/analysis?session=${session.id}`)}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Ver Detalhes
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-gold/30 text-gold hover:bg-gold/10"
                        onClick={() => handleExportSession(session.id, session.name)}
                        disabled={session.successful_leads === 0}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Exportar CSV
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Excluir
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-navy-light border-gold/30">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-gold">Excluir sessão?</AlertDialogTitle>
                            <AlertDialogDescription className="text-gold/70">
                              Esta ação não pode ser desfeita. Todos os leads desta sessão serão permanentemente excluídos.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="border-gold/30 text-gold hover:bg-gold/10">
                              Cancelar
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(session.id)}
                              className="bg-red-500 hover:bg-red-600 text-white"
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default History;
