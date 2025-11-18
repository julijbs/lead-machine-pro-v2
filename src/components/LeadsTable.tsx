import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";
import type { Lead } from "@/pages/Scraper";

interface LeadsTableProps {
  leads: Lead[];
}

export const LeadsTable = ({ leads }: LeadsTableProps) => {
  return (
    <div className="rounded-md border border-gold/30 bg-navy-light overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-gold/20 hover:bg-navy">
            <TableHead className="text-gold">Negócio</TableHead>
            <TableHead className="text-gold">Cidade/UF</TableHead>
            <TableHead className="text-gold">Telefone</TableHead>
            <TableHead className="text-gold">Website</TableHead>
            <TableHead className="text-gold">Fonte</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead, index) => (
            <TableRow key={index} className="border-gold/20 hover:bg-navy">
              <TableCell>
                <div>
                  <div className="font-medium text-gold">{lead.business_name}</div>
                  <div className="text-sm text-gold/70">{lead.address}</div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <Badge variant="secondary" className="bg-gold/20 text-gold border-gold/30">{lead.city}</Badge>
                  <Badge variant="outline" className="border-gold/30 text-gold">{lead.uf}</Badge>
                </div>
              </TableCell>
              <TableCell className="text-gold/80">{lead.phone || "—"}</TableCell>
              <TableCell>
                {lead.website ? (
                  <a
                    href={lead.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-gold hover:text-gold-light hover:underline"
                  >
                    Ver site
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-gold/50">—</span>
                )}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="border-gold/30 text-gold">{lead.source}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
