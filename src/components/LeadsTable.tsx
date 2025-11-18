import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import type { Lead } from "@/pages/Scraper";

interface LeadsTableProps {
  leads: Lead[];
}

export const LeadsTable = ({ leads }: LeadsTableProps) => {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Negócio</TableHead>
            <TableHead>Cidade/UF</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead>Website</TableHead>
            <TableHead>Fonte</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead, index) => (
            <TableRow key={index}>
              <TableCell>
                <div>
                  <div className="font-medium">{lead.business_name}</div>
                  <div className="text-sm text-muted-foreground">{lead.address}</div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Badge variant="secondary">{lead.city}</Badge>
                  <Badge variant="outline">{lead.uf}</Badge>
                </div>
              </TableCell>
              <TableCell>{lead.phone || "—"}</TableCell>
              <TableCell>
                {lead.website ? (
                  <a
                    href={lead.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    Ver site
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>
                <Badge variant="outline">{lead.source}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
