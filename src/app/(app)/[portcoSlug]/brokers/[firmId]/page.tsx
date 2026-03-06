import { notFound } from "next/navigation";
import Link from "next/link";
import { getBrokerFirm, getContactsForFirm, getInteractionsForFirm } from "@/lib/actions/brokers";
import { getPortcoBySlug } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Globe, MapPin, ExternalLink, DollarSign, BarChart3, Building2, Info } from "lucide-react";
import { ContactList } from "@/components/brokers/contact-list";
import { InteractionLog } from "@/components/brokers/interaction-log";
import { EditFirmDialog } from "@/components/brokers/edit-firm-dialog";
import { DeleteFirmButton } from "@/components/brokers/delete-firm-button";

export default async function BrokerDetailPage({
  params,
}: {
  params: Promise<{ portcoSlug: string; firmId: string }>;
}) {
  const { portcoSlug, firmId } = await params;

  const [firm, portco] = await Promise.all([
    getBrokerFirm(firmId),
    getPortcoBySlug(portcoSlug),
  ]);

  if (!firm || !portco) notFound();

  const [contacts, interactions] = await Promise.all([
    getContactsForFirm(firmId),
    getInteractionsForFirm(firmId),
  ]);

  const meta = (firm.metadata ?? {}) as Record<string, string | undefined>;
  const hasMeta = Object.keys(meta).length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/${portcoSlug}/brokers`}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{firm.name}</h1>
            {firm.region && (
              <Badge variant="outline">
                <MapPin className="mr-0.5 size-3" />
                {firm.region}
              </Badge>
            )}
            {firm.specialty && (
              <Badge variant="secondary">{firm.specialty}</Badge>
            )}
          </div>
          {firm.website && (
            <a
              href={firm.website}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <Globe className="size-3" />
              {firm.website}
            </a>
          )}
        </div>
        <div className="flex items-center gap-2">
          <EditFirmDialog firm={firm} portcoSlug={portcoSlug} />
          <DeleteFirmButton firmId={firmId} portcoSlug={portcoSlug} />
        </div>
      </div>

      {/* Firm Overview */}
      {hasMeta && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {meta.type && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <Building2 className="size-3" /> Type
                </div>
                <p className="text-sm font-medium">{meta.type}</p>
                {meta.publicOrPrivate && (
                  <p className="text-xs text-muted-foreground mt-0.5">{meta.publicOrPrivate}</p>
                )}
              </CardContent>
            </Card>
          )}
          {meta.avgDealSize && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <DollarSign className="size-3" /> Avg Deal Size
                </div>
                <p className="text-sm font-medium">{meta.avgDealSize}</p>
              </CardContent>
            </Card>
          )}
          {meta.dealFlow && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <BarChart3 className="size-3" /> Deal Flow
                </div>
                <p className="text-sm font-medium">{meta.dealFlow}</p>
              </CardContent>
            </Card>
          )}
          {meta.feeModel && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  <Info className="size-3" /> Fee Model
                </div>
                <p className="text-sm font-medium">{meta.feeModel}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Key Details */}
      {hasMeta && (
        <div className="grid gap-4 md:grid-cols-2">
          {(meta.notes || meta.relevance) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {meta.notes && (
                  <p className="text-sm text-muted-foreground">{meta.notes}</p>
                )}
                {meta.relevance && (
                  <div>
                    <p className="text-xs font-medium mb-1">Relevance to Us</p>
                    <p className="text-sm text-muted-foreground">{meta.relevance}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                {meta.registeredUsers && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Registered Users</dt>
                    <dd className="font-medium">{meta.registeredUsers}</dd>
                  </div>
                )}
                {meta.registeredCompanies && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Registered Companies</dt>
                    <dd className="font-medium">{meta.registeredCompanies}</dd>
                  </div>
                )}
                {meta.employees && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Employees</dt>
                    <dd className="font-medium">{meta.employees}</dd>
                  </div>
                )}
                {meta.founded && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Founded</dt>
                    <dd className="font-medium">{meta.founded}</dd>
                  </div>
                )}
                {meta.parentCompany && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Parent Company</dt>
                    <dd className="font-medium">{meta.parentCompany}</dd>
                  </div>
                )}
                {meta.totalFunding && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Total Funding</dt>
                    <dd className="font-medium">{meta.totalFunding}</dd>
                  </div>
                )}
                {meta.partnerNetwork && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Partner Network</dt>
                    <dd className="font-medium">{meta.partnerNetwork}</dd>
                  </div>
                )}
                {meta.marketPosition && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Market Position</dt>
                    <dd className="font-medium">{meta.marketPosition}</dd>
                  </div>
                )}
                {firm.listingUrl && (
                  <div className="pt-2">
                    <a
                      href={firm.listingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="size-3" />
                      View Listings
                    </a>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Contacts */}
        <div className="lg:col-span-1">
          <ContactList
            firmId={firmId}
            portcoSlug={portcoSlug}
            initialContacts={contacts}
          />
        </div>

        {/* Interaction Log */}
        <div className="lg:col-span-2">
          <InteractionLog
            firmId={firmId}
            portcoId={portco.id}
            portcoSlug={portcoSlug}
            contacts={contacts}
            initialInteractions={interactions}
          />
        </div>
      </div>
    </div>
  );
}
