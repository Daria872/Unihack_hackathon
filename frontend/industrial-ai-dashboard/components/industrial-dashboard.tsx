'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  Boxes,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  CloudUpload,
  Database,
  FileSearch,
  Filter,
  Gauge,
  Layers3,
  ListChecks,
  Menu,
  PackageSearch,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UploadCloud,
  Users,
  XCircle,
  Zap,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { approveReview, evidencePdfUrl, exportUrl, getHealth, getJob, getJobs, getMetrics, getProductEvidence, getResults, getReviewQueue, logout, searchProducts, type EvidenceChunk, type Job, type ProductResult, uploadCatalog } from '@/lib/backend-api'

const nav = [
  { id: 'dashboard', label: 'Dashboard', icon: Gauge },
  { id: 'upload', label: 'Upload dataset', icon: CloudUpload },
  { id: 'pipeline', label: 'Processing pipeline', icon: Activity },
  { id: 'results', label: 'Product results', icon: Boxes },
  { id: 'evidence', label: 'Product evidence', icon: FileSearch },
  { id: 'review', label: 'Human review', icon: ClipboardCheck },
  { id: 'metrics', label: 'Evaluation metrics', icon: BarChart3 },
] as const

type View = (typeof nav)[number]['id']

const kpis = [
  { label: 'Products processed', icon: Boxes },
  { label: 'Attribute accuracy', icon: TargetIcon },
  { label: 'LOV compliance', icon: ListChecks },
  { label: 'UOM compliance', icon: SlidersHorizontal },
  { label: 'Source-backed fields', icon: ShieldCheck },
  { label: 'Human review rate', icon: Users },
]

function TargetIcon(props: React.ComponentProps<typeof Sparkles>) {
  return <Sparkles {...props} />
}

function StatusBadge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'warning' | 'success' }) {
  return <Badge variant={tone === 'warning' ? 'outline' : tone === 'success' ? 'secondary' : 'outline'} className={tone === 'warning' ? 'border-amber-300 bg-amber-50 text-amber-700' : tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'text-muted-foreground'}>{children}</Badge>
}

function ApiNote({ children = 'Connect a backend endpoint to populate this view.' }: { children?: React.ReactNode }) {
  return <div className="flex items-center gap-2 border border-dashed border-primary/30 bg-primary/[0.035] px-3 py-2 text-[11px] font-medium tracking-wide text-primary"><Zap className="size-3.5" /> <span><span className="font-bold">API INTEGRATION REQUIRED</span> · {children}</span></div>
}

function PageHeading({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: React.ReactNode }) {
  return <div className="flex flex-col gap-4 border-b pb-5 md:flex-row md:items-end md:justify-between"><div className="flex flex-col gap-1.5"><div className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">{eyebrow}</div><h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">{title}</h1><p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p></div>{actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}</div>
}

function EmptyPanel({ icon: Icon = Database, title, description }: { icon?: React.ElementType; title: string; description: string }) {
  return <Empty className="min-h-48 border-0 py-8"><EmptyHeader><EmptyMedia variant="icon"><Icon /></EmptyMedia><EmptyTitle>{title}</EmptyTitle><EmptyDescription>{description}</EmptyDescription></EmptyHeader></Empty>
}

function DashboardView({ go }: { go: (view: View) => void }) {
  return <div className="flex flex-col gap-6"><PageHeading eyebrow="Operations overview" title="Product enrichment control center" description="Monitor enrichment throughput, validation quality, and review workload across your industrial catalog." actions={<><Button variant="outline" size="sm" onClick={() => go('pipeline')}><Play data-icon="inline-start" /> View pipeline</Button><Button size="sm" onClick={() => go('upload')}><Plus data-icon="inline-start" /> New dataset</Button></>} />
    <ApiNote>Dashboard KPIs and activity require the metrics and jobs API.</ApiNote>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{kpis.map(({ label, icon: Icon }) => <Card key={label} className="shadow-none"><CardContent className="flex items-start justify-between p-4"><div className="flex flex-col gap-3"><span className="text-xs font-medium text-muted-foreground">{label}</span><span className="text-3xl font-semibold tracking-tight text-muted-foreground/50">—</span><span className="text-[11px] text-muted-foreground">Awaiting API data</span></div><div className="flex size-9 items-center justify-center border bg-muted/50 text-primary"><Icon className="size-4" /></div></CardContent></Card>)}</div>
    <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]"><Card className="shadow-none"><CardHeader><div className="flex items-center justify-between"><div><CardTitle className="text-sm">Enrichment activity</CardTitle><CardDescription>Processed products over time</CardDescription></div><StatusBadge>Not connected</StatusBadge></div></CardHeader><CardContent><EmptyPanel icon={Activity} title="No activity to display" description="Connect the processing jobs API to visualize throughput and stage timings." /></CardContent></Card><Card className="shadow-none"><CardHeader><CardTitle className="text-sm">Quality signals</CardTitle><CardDescription>Latest evaluation snapshot</CardDescription></CardHeader><CardContent><EmptyPanel icon={ShieldCheck} title="No evaluation snapshot" description="Evaluation metrics will appear when a completed run is available." /></CardContent></Card></div>
  </div>
}

function UploadView({ go }: { go: (view: View) => void }) {
  return <div className="flex flex-col gap-6"><PageHeading eyebrow="Data intake" title="Upload dataset" description="Bring structured product records and supporting documents into the enrichment pipeline." actions={<Button variant="outline" size="sm" onClick={() => go('pipeline')}>Processing pipeline <ArrowRight data-icon="inline-end" /></Button>} /><ApiNote>Upload POST endpoint and schema discovery service are not connected.</ApiNote><div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]"><Card className="shadow-none"><CardHeader><CardTitle className="text-sm">Dataset source</CardTitle><CardDescription>Accepted sources will be defined by the ingestion API.</CardDescription></CardHeader><CardContent className="flex flex-col gap-5"><div className="flex min-h-56 flex-col items-center justify-center gap-3 border border-dashed bg-muted/20 p-6 text-center"><div className="flex size-12 items-center justify-center border bg-background text-primary"><UploadCloud className="size-5" /></div><div><p className="text-sm font-medium">Drop a dataset or browse files</p><p className="mt-1 text-xs text-muted-foreground">File types, size limits, and document pairing come from the upload contract.</p></div><Button variant="outline" size="sm" disabled>Choose files</Button></div><div className="grid gap-3 sm:grid-cols-2"><Input aria-label="Dataset name" placeholder="Dataset name" disabled /><Input aria-label="Source system" placeholder="Source system" disabled /></div><Button disabled className="w-full sm:w-fit"><CloudUpload data-icon="inline-start" /> Upload unavailable</Button></CardContent></Card><Card className="shadow-none"><CardHeader><CardTitle className="text-sm">Schema mapping</CardTitle><CardDescription>Column mappings will be suggested after upload.</CardDescription></CardHeader><CardContent><EmptyPanel icon={Layers3} title="No schema loaded" description="Upload a source file to inspect fields and map product identifiers." /></CardContent></Card></div></div>
}

function PipelineView() {
  const stages = ['Ingest', 'Parse', 'Extract', 'Validate', 'Publish']
  return <div className="flex flex-col gap-6"><PageHeading eyebrow="Run orchestration" title="Processing pipeline" description="Track how a dataset moves from source ingestion through validated product publication." actions={<Button size="sm" disabled><Play data-icon="inline-start" /> Start run</Button>} /><ApiNote>Pipeline run status requires the jobs API and event stream.</ApiNote><Card className="shadow-none"><CardHeader><CardTitle className="text-sm">Pipeline stages</CardTitle><CardDescription>Stage definitions are ready; no active run is connected.</CardDescription></CardHeader><CardContent><div className="grid gap-2 md:grid-cols-5">{stages.map((stage, index) => <div key={stage} className="relative flex flex-col gap-3 border bg-muted/20 p-4"><div className="flex items-center justify-between"><span className="font-mono text-[10px] font-bold text-muted-foreground">0{index + 1}</span><StatusBadge>Pending</StatusBadge></div><span className="text-sm font-medium">{stage}</span><Progress value={0} className="h-1" /></div>)}</div></CardContent></Card><Card className="shadow-none"><CardHeader><CardTitle className="text-sm">Processing jobs</CardTitle><CardDescription>Recent and active runs will populate this table.</CardDescription></CardHeader><CardContent><EmptyPanel icon={RefreshCw} title="No processing jobs" description="Connect GET /api/processing/jobs to retrieve run history." /></CardContent></Card></div>
}

function ResultsView({ go }: { go: (view: View) => void }) {
  return <div className="flex flex-col gap-6"><PageHeading eyebrow="Catalog output" title="Product results" description="Review enriched product records, validation outcomes, and evidence coverage." actions={<Button variant="outline" size="sm" onClick={() => go('evidence')}><FileSearch data-icon="inline-start" /> Inspect evidence</Button>} /><ApiNote>Product records require GET /api/products with pagination and filters.</ApiNote><Card className="shadow-none"><CardContent className="flex flex-col gap-4 p-4"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div className="relative max-w-sm flex-1"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Search part number or manufacturer" disabled /></div><div className="flex gap-2"><Button variant="outline" size="sm" disabled><Filter data-icon="inline-start" /> Filters</Button><Button variant="outline" size="sm" disabled><RefreshCw data-icon="inline-start" /> Refresh</Button></div></div><Table><TableHeader><TableRow><TableHead>Part number</TableHead><TableHead>Manufacturer</TableHead><TableHead>Brand</TableHead><TableHead>Classification</TableHead><TableHead>Confidence</TableHead><TableHead>Validation</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell colSpan={6}><EmptyPanel icon={PackageSearch} title="No product results" description="Enriched products will appear here after a processing run completes." /></TableCell></TableRow></TableBody></Table></CardContent></Card></div>
}

function EvidenceView() {
  return <div className="flex flex-col gap-6"><PageHeading eyebrow="Traceability" title="Product evidence" description="Trace every extracted attribute back to the document and page that supports it." actions={<Button variant="outline" size="sm" disabled><Search data-icon="inline-start" /> Select product</Button>} /><ApiNote>Evidence records require GET /api/products/:id/evidence.</ApiNote><div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]"><Card className="shadow-none"><CardHeader><CardTitle className="text-sm">Product context</CardTitle><CardDescription>Selected product details</CardDescription></CardHeader><CardContent className="flex flex-col gap-4"><div className="grid gap-3 sm:grid-cols-2">{['Part number', 'Manufacturer', 'Brand', 'Product classification'].map((label) => <div key={label} className="flex flex-col gap-1.5 border-b pb-3"><span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span><span className="text-sm text-muted-foreground/60">—</span></div>)}</div><EmptyPanel icon={FileSearch} title="No product selected" description="Select a product to inspect evidence and validation details." /></CardContent></Card><Card className="shadow-none"><CardHeader><CardTitle className="text-sm">Attribute evidence map</CardTitle><CardDescription>Source-backed extraction and page citations</CardDescription></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Attribute</TableHead><TableHead>Value</TableHead><TableHead>Source</TableHead><TableHead>Page</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell colSpan={5}><EmptyPanel icon={Database} title="No evidence available" description="Attribute evidence will load from the product evidence endpoint." /></TableCell></TableRow></TableBody></Table></CardContent></Card></div><Alert className="border-amber-200 bg-amber-50 text-amber-900"><AlertTriangle className="size-4" /><AlertTitle>Conflict alerts</AlertTitle><AlertDescription>Conflicting source values will be surfaced here for review.</AlertDescription></Alert></div>
}

function ReviewView() {
  return <div className="flex flex-col gap-6"><PageHeading eyebrow="Exception handling" title="Human review" description="Resolve low-confidence attributes and source conflicts before products are published." actions={<Button size="sm" disabled><ClipboardCheck data-icon="inline-start" /> Open next review</Button>} /><ApiNote>Review queue requires GET /api/review/queue and decision POST endpoints.</ApiNote><div className="grid gap-3 sm:grid-cols-3">{['Queue size', 'Low confidence', 'Conflicts'].map((label) => <Card key={label} className="shadow-none"><CardContent className="flex items-center justify-between p-4"><div className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">{label}</span><span className="text-2xl font-semibold text-muted-foreground/50">—</span></div><ClipboardCheck className="size-4 text-muted-foreground" /></CardContent></Card>)}</div><Card className="shadow-none"><CardHeader><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><CardTitle className="text-sm">Review queue</CardTitle><CardDescription>Records requiring a human decision</CardDescription></div><Tabs defaultValue="all"><TabsList><TabsTrigger value="all">All</TabsTrigger><TabsTrigger value="confidence">Low confidence</TabsTrigger><TabsTrigger value="conflict">Conflicts</TabsTrigger></TabsList></Tabs></div></CardHeader><CardContent><EmptyPanel icon={ClipboardCheck} title="Review queue is empty" description="Review items will appear when the backend returns unresolved exceptions." /><div className="flex justify-center gap-2"><Button variant="outline" size="sm" disabled><CheckCircle2 data-icon="inline-start" /> Approve</Button><Button variant="outline" size="sm" disabled><XCircle data-icon="inline-start" /> Reject</Button><Button variant="outline" size="sm" disabled><AlertTriangle data-icon="inline-start" /> Escalate</Button></div></CardContent></Card></div>
}

function ConnectedUploadView({ onStarted }: { onStarted: (jobId: string) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!file) return
    setLoading(true)
    setError('')
    try {
      const upload = await uploadCatalog(file)
      onStarted(upload.job_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setLoading(false)
    }
  }

  return <div className="flex flex-col gap-6"><PageHeading eyebrow="Data intake" title="Upload dataset" description="Upload an Excel or CSV catalog to start the enrichment pipeline." /><Card className="shadow-none"><CardHeader><CardTitle className="text-sm">Dataset source</CardTitle><CardDescription>The backend parses the uploaded file and starts enrichment in the background.</CardDescription></CardHeader><CardContent className="flex flex-col gap-4"><Input type="file" accept=".xlsx,.xls,.csv" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><Button onClick={() => void submit()} disabled={!file || loading} className="w-full sm:w-fit"><CloudUpload data-icon="inline-start" />{loading ? 'Uploading...' : 'Start enrichment'}</Button>{file && <p className="text-xs text-muted-foreground">Selected: {file.name}</p>}{error && <Alert variant="destructive"><AlertTriangle className="size-4" /><AlertTitle>Upload failed</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}</CardContent></Card></div>
}

function ConnectedPipelineView({ jobId, onCompleted, onViewResults }: { jobId: string | null; onCompleted: (job: Job) => void; onViewResults: () => void }) {
  const [job, setJob] = useState<Job | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!jobId) return
    let active = true
    const poll = async () => {
      try {
        const next = await getJob(jobId)
        if (!active) return
        setJob(next)
        if (next.status === 'completed') onCompleted(next)
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Could not read job status.')
      }
    }
    void poll()
    const timer = window.setInterval(() => void poll(), 1500)
    return () => { active = false; window.clearInterval(timer) }
  }, [jobId, onCompleted])

  const progress = job && job.total_rows ? Math.round((job.processed_rows / job.total_rows) * 100) : 0
  return <div className="flex flex-col gap-6"><PageHeading eyebrow="Run orchestration" title="Processing pipeline" description="Track ingestion, document retrieval, extraction, validation, and final publication." actions={job?.status === 'completed' ? <Button size="sm" onClick={onViewResults}><Boxes data-icon="inline-start" /> View results</Button> : undefined} />{!jobId && <EmptyPanel icon={Activity} title="No active job" description="Upload a dataset to start a pipeline run." />}{job && <><Card className="shadow-none"><CardHeader><div className="flex items-center justify-between"><div><CardTitle className="text-sm">{job.filename}</CardTitle><CardDescription>{job.status} · {job.processed_rows} of {job.total_rows} rows processed</CardDescription></div><StatusBadge tone={job.status === 'completed' ? 'success' : 'warning'}>{job.status}</StatusBadge></div></CardHeader><CardContent className="flex flex-col gap-3"><Progress value={progress} /><span className="text-xs text-muted-foreground">{progress}% complete · {job.needs_review_count} rows need human review</span></CardContent></Card><Card className="shadow-none"><CardHeader><CardTitle className="text-sm">Processing log</CardTitle></CardHeader><CardContent><div className="max-h-64 overflow-auto bg-muted/20 p-3 font-mono text-xs leading-6">{job.logs.map((log, index) => <div key={`${index}-${log}`}>{log}</div>)}</div></CardContent></Card></>}{error && <Alert variant="destructive"><AlertTriangle className="size-4" /><AlertTitle>Pipeline status error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}</div>
}

function ConnectedResultsView({ jobId, onSelectProduct }: { jobId: string | null; onSelectProduct: (mpn: string) => void }) {
  const [results, setResults] = useState<ProductResult[]>([])
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  useEffect(() => {
    if (!jobId) return
    void getResults(jobId).then(setResults).catch((err) => setError(err instanceof Error ? err.message : 'Could not load results.'))
  }, [jobId])
  async function search() {
    if (!query.trim()) return
    setSearching(true)
    setError('')
    try {
      const matches = await searchProducts(query, jobId ?? undefined)
      setResults(matches.map((match) => match.product))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed.')
    } finally { setSearching(false) }
  }
  return <div className="flex flex-col gap-6"><PageHeading eyebrow="Catalog output" title="Product results" description="Review enriched product records, attributes, confidence signals, and validation state." actions={jobId ? <Button size="sm" onClick={() => window.location.assign(exportUrl(jobId))}><ArrowRight data-icon="inline-start" /> Export Excel</Button> : undefined} />{error && <Alert variant="destructive"><AlertTriangle className="size-4" /><AlertTitle>Results unavailable</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}{!jobId && <EmptyPanel icon={PackageSearch} title="No completed job" description="Upload and process a catalog before viewing results." />}{jobId && results.length === 0 && !error && <EmptyPanel icon={PackageSearch} title="No result rows" description="The job completed without returning product rows." />}{results.length > 0 && <Card className="shadow-none"><CardContent className="overflow-auto p-4"><div className="mb-4 flex gap-2"><Input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void search() }} placeholder="Search MPN, manufacturer, brand, or attribute" /><Button onClick={() => void search()} disabled={searching || !query.trim()}><Search data-icon="inline-start" /> Search</Button></div><Table><TableHeader><TableRow><TableHead>Part number</TableHead><TableHead>Manufacturer</TableHead><TableHead>Brand</TableHead><TableHead>Review</TableHead><TableHead>Attributes</TableHead></TableRow></TableHeader><TableBody>{results.map((product, index) => { const attributes = Object.keys(product).filter((key) => key.startsWith('ATTRIBUTE_VALUE ') && product[key]); const mpn = String(product.Mfg_Part_Num ?? ''); return <TableRow key={String(product._job_row_id ?? index)} className="cursor-pointer" onClick={() => mpn && onSelectProduct(mpn)}><TableCell>{String(product.PART_NUMBER ?? product.Mfg_Part_Num ?? '—')}</TableCell><TableCell>{String(product.MANUFACTURER_NAME ?? product.Part_Manuf ?? '—')}</TableCell><TableCell>{String(product.BRAND_NAME ?? product.Unilog_Brand ?? '—')}</TableCell><TableCell><StatusBadge tone={product._needs_human_review ? 'warning' : 'success'}>{product._needs_human_review ? 'Review' : 'Validated'}</StatusBadge></TableCell><TableCell>{attributes.length} populated</TableCell></TableRow>})}</TableBody></Table></CardContent></Card>}</div>
}

function ConnectedEvidenceView({ mfgPartNum }: { mfgPartNum: string | null }) {
  const [chunks, setChunks] = useState<EvidenceChunk[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    if (!mfgPartNum) return
    setError('')
    void getProductEvidence(mfgPartNum).then(setChunks).catch((err) => setError(err instanceof Error ? err.message : 'Could not load evidence.'))
  }, [mfgPartNum])
  return <div className="flex flex-col gap-6"><PageHeading eyebrow="Traceability" title="Product evidence" description="Inspect the manufacturer document chunks and page citations used by retrieval." actions={mfgPartNum ? <Button size="sm" onClick={() => window.location.assign(evidencePdfUrl(mfgPartNum))}><FileSearch data-icon="inline-start" /> Download PDF</Button> : undefined} />{!mfgPartNum && <EmptyPanel icon={FileSearch} title="No product selected" description="Select a product from Product results to inspect its evidence." />}{error && <Alert variant="destructive"><AlertTriangle className="size-4" /><AlertTitle>Evidence unavailable</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}{mfgPartNum && !error && chunks.length === 0 && <EmptyPanel icon={Database} title="No evidence found" description={`No indexed manufacturer evidence is available for ${mfgPartNum}.`} />}{chunks.length > 0 && <Card className="shadow-none"><CardHeader><CardTitle className="text-sm">{mfgPartNum} evidence</CardTitle><CardDescription>{chunks.length} cited chunks returned by hybrid retrieval</CardDescription></CardHeader><CardContent className="flex flex-col gap-2">{chunks.map((chunk, index) => <div key={`${chunk.source}-${chunk.page_num}-${index}`} className="border p-3"><div className="mb-2 flex items-center justify-between gap-3 text-[11px] font-medium text-primary"><span>{chunk.source}</span><span>Page {chunk.page_num}</span></div><p className="text-sm leading-6">{chunk.text}</p></div>)}</CardContent></Card>}</div>
}

function ConnectedReviewView() {
  const [items, setItems] = useState<Record<string, unknown>[]>([])
  const [error, setError] = useState('')
  const loadQueue = () => void getReviewQueue().then(setItems).catch((err) => setError(err instanceof Error ? err.message : 'Could not load review queue.'))
  useEffect(loadQueue, [])

  async function resolve(item: Record<string, unknown>) {
    const rowId = String(item.product_row_id ?? '')
    const flagged = Array.isArray(item.flagged_attributes) ? item.flagged_attributes as { slot?: number; label?: string }[] : []
    if (!rowId || flagged.length === 0) return
    const overrides: Record<number, string> = {}
    for (const attribute of flagged) {
      const value = window.prompt(`Value for ${attribute.label ?? `attribute ${attribute.slot ?? ''}`}`)
      if (value === null || !value.trim() || attribute.slot === undefined) return
      overrides[attribute.slot] = value.trim()
    }
    try {
      await approveReview(rowId, overrides)
      loadQueue()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not approve review item.')
    }
  }

  return <div className="flex flex-col gap-6"><PageHeading eyebrow="Exception handling" title="Human review" description="Resolve attributes that the pipeline could not validate with sufficient confidence." /><Card className="shadow-none"><CardHeader><CardTitle className="text-sm">Review queue ({items.length})</CardTitle></CardHeader><CardContent>{error && <Alert variant="destructive"><AlertTriangle className="size-4" /><AlertTitle>Review queue unavailable</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}{!error && items.length === 0 && <EmptyPanel icon={ClipboardCheck} title="Review queue is empty" description="No completed products currently require a human decision." />}{items.length > 0 && <div className="flex flex-col gap-2">{items.map((item, index) => <div key={String(item.product_row_id ?? index)} className="flex items-center justify-between gap-3 border p-3 text-sm"><div><span className="font-medium">{String(item.mfg_part_num ?? item.part_number ?? 'Unknown product')}</span><p className="mt-1 text-xs text-muted-foreground">{Array.isArray(item.flagged_attributes) ? `${item.flagged_attributes.length} flagged attributes` : 'Flagged for review'}</p></div><Button size="sm" onClick={() => void resolve(item)}><CheckCircle2 data-icon="inline-start" /> Resolve</Button></div>)}</div>}</CardContent></Card></div>
}

function ConnectedMetricsView() {
  const [metrics, setMetrics] = useState<Record<string, number> | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { void getMetrics().then(setMetrics).catch((err) => setError(err instanceof Error ? err.message : 'Could not load metrics.')) }, [])
  const values = metrics ? [['Products processed', metrics.total_processed], ['Attribute accuracy', metrics.attribute_accuracy_rate], ['LOV compliance', metrics.lov_compliance_rate], ['UOM compliance', metrics.uom_compliance_rate], ['Evidence-backed fields', metrics.evidence_backed_rate], ['Human review rate', metrics.human_review_rate]] : []
  return <div className="flex flex-col gap-6"><PageHeading eyebrow="Quality system" title="Evaluation metrics" description="Live quality signals calculated from completed backend pipeline results." />{error && <Alert variant="destructive"><AlertTriangle className="size-4" /><AlertTitle>Metrics unavailable</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}{!metrics && !error && <EmptyPanel icon={BarChart3} title="Loading metrics" description="Reading the current backend evaluation snapshot." />}{metrics && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">{values.map(([label, value]) => <Card key={String(label)} className="shadow-none"><CardContent className="flex flex-col gap-3 p-4"><span className="min-h-8 text-xs font-medium leading-4 text-muted-foreground">{label}</span><span className="text-2xl font-semibold">{Number(value).toFixed(label === 'Products processed' ? 0 : 2)}{label === 'Products processed' ? '' : '%'}</span><Progress value={label === 'Products processed' ? 0 : Number(value)} className="h-1" /></CardContent></Card>)}</div>}</div>
}

function MetricsView() {
  const metrics = ['Attribute accuracy', 'LOV compliance', 'UOM compliance', 'Source-backed fields', 'Human review rate']
  return <div className="flex flex-col gap-6"><PageHeading eyebrow="Quality system" title="Evaluation metrics" description="Measure enrichment quality against validated ground truth and catalog governance rules." actions={<Button variant="outline" size="sm" disabled><RefreshCw data-icon="inline-start" /> Recalculate</Button>} /><ApiNote>Evaluation data requires GET /api/evaluation/metrics for a completed run.</ApiNote><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{metrics.map((metric) => <Card key={metric} className="shadow-none"><CardContent className="flex flex-col gap-3 p-4"><span className="min-h-8 text-xs font-medium leading-4 text-muted-foreground">{metric}</span><span className="text-2xl font-semibold text-muted-foreground/50">—</span><Progress value={0} className="h-1" /></CardContent></Card>)}</div><div className="grid gap-4 xl:grid-cols-2"><Card className="shadow-none"><CardHeader><CardTitle className="text-sm">Quality trend</CardTitle><CardDescription>Metric history by evaluation run</CardDescription></CardHeader><CardContent><EmptyPanel icon={BarChart3} title="No trend data" description="Run history will populate this visualization through the evaluation API." /></CardContent></Card><Card className="shadow-none"><CardHeader><CardTitle className="text-sm">Error taxonomy</CardTitle><CardDescription>Distribution of validation failures</CardDescription></CardHeader><CardContent><EmptyPanel icon={AlertTriangle} title="No error data" description="Error categories will appear after labeled results are available." /></CardContent></Card></div></div>
}

function ConnectedDashboardView({ go }: { go: (view: View) => void }) {
  const [metrics, setMetrics] = useState<Record<string, number> | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([getMetrics(), getJobs()]).then(([nextMetrics, nextJobs]) => {
      setMetrics(nextMetrics)
      setJobs(nextJobs.slice().reverse())
    }).catch((err) => setError(err instanceof Error ? err.message : 'Could not load dashboard data.'))
  }, [])

  const values = metrics ? [
    ['Products processed', metrics.total_processed, false],
    ['Attribute accuracy', metrics.attribute_accuracy_rate, true],
    ['LOV compliance', metrics.lov_compliance_rate, true],
    ['UOM compliance', metrics.uom_compliance_rate, true],
    ['Source-backed fields', metrics.evidence_backed_rate, true],
    ['Human review rate', metrics.human_review_rate, true],
  ] as const : []

  return <div className="flex flex-col gap-6"><PageHeading eyebrow="Operations overview" title="Product enrichment control center" description="Monitor enrichment throughput, validation quality, and review workload across your industrial catalog." actions={<><Button variant="outline" size="sm" onClick={() => go('pipeline')}><Play data-icon="inline-start" /> View pipeline</Button><Button size="sm" onClick={() => go('upload')}><Plus data-icon="inline-start" /> New dataset</Button></>} />{error && <Alert variant="destructive"><AlertTriangle className="size-4" /><AlertTitle>Dashboard unavailable</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}{!error && !metrics && <EmptyPanel icon={Gauge} title="Loading dashboard" description="Reading live pipeline metrics and recent jobs." />}{metrics && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{values.map(([label, value, isRate]) => <Card key={label} className="shadow-none"><CardContent className="flex items-start justify-between p-4"><div className="flex flex-col gap-3"><span className="text-xs font-medium text-muted-foreground">{label}</span><span className="text-3xl font-semibold tracking-tight">{isRate ? `${Number(value).toFixed(2)}%` : Number(value).toFixed(0)}</span><Progress value={isRate ? Number(value) : 0} className="h-1" /></div><div className="flex size-9 items-center justify-center border bg-muted/50 text-primary"><Gauge className="size-4" /></div></CardContent></Card>)}</div>}<Card className="shadow-none"><CardHeader><div className="flex items-center justify-between"><div><CardTitle className="text-sm">Recent processing jobs</CardTitle><CardDescription>Latest catalog enrichment runs</CardDescription></div><Button variant="outline" size="sm" onClick={() => go('pipeline')}><Activity data-icon="inline-start" /> Open pipeline</Button></div></CardHeader><CardContent>{jobs.length === 0 ? <EmptyPanel icon={Activity} title="No processing jobs" description="Upload a catalog to start your first enrichment run." /> : <div className="flex flex-col gap-2">{jobs.slice(0, 5).map((job) => <button key={job.id} className="flex items-center justify-between border p-3 text-left transition-colors hover:border-primary" onClick={() => go('pipeline')}><span><span className="block text-sm font-medium">{job.filename}</span><span className="text-xs text-muted-foreground">{job.processed_rows} of {job.total_rows} rows processed</span></span><StatusBadge tone={job.status === 'completed' ? 'success' : 'warning'}>{job.status}</StatusBadge></button>)}</div>}</CardContent></Card></div>
}

export default function IndustrialDashboard() {
  const [view, setView] = useState<View>('dashboard')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [selectedMpn, setSelectedMpn] = useState<string | null>(null)
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null)
  const [dark, setDark] = useState(false)
  const active = useMemo(() => nav.find((item) => item.id === view) ?? nav[0], [view])
  useEffect(() => {
    setJobId(window.localStorage.getItem('unilog.activeJobId'))
    void getHealth().then(() => setBackendOnline(true)).catch(() => setBackendOnline(false))
  }, [])
  useEffect(() => {
    if (jobId) window.localStorage.setItem('unilog.activeJobId', jobId)
  }, [jobId])
  useEffect(() => {
    const saved = window.localStorage.getItem('unilog.theme') === 'dark'
    setDark(saved)
    document.documentElement.classList.toggle('dark', saved)
  }, [])
  function toggleTheme() {
    const next = !dark
    setDark(next)
    window.localStorage.setItem('unilog.theme', next ? 'dark' : 'light')
    document.documentElement.classList.toggle('dark', next)
  }
  async function signOut() {
    try { await logout() } catch { /* local sign-out still clears an expired session */ }
    window.localStorage.removeItem('unilog.accessToken')
    window.location.reload()
  }
  const go = (next: View) => { setView(next); setMobileOpen(false) }
  const content = { dashboard: <ConnectedDashboardView go={go} />, upload: <ConnectedUploadView onStarted={(id) => { setJobId(id); go('pipeline') }} />, pipeline: <ConnectedPipelineView jobId={jobId} onCompleted={() => go('results')} onViewResults={() => go('results')} />, results: <ConnectedResultsView jobId={jobId} onSelectProduct={(mpn) => { setSelectedMpn(mpn); go('evidence') }} />, evidence: <ConnectedEvidenceView mfgPartNum={selectedMpn} />, review: <ConnectedReviewView />, metrics: <ConnectedMetricsView /> }[view]
  return <div className="min-h-screen bg-background text-foreground"><aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r bg-sidebar transition-transform lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}><div className="flex h-16 items-center gap-3 border-b px-5"><div className="flex size-8 items-center justify-center bg-primary text-primary-foreground"><Sparkles className="size-4" /></div><div className="flex flex-col"><span className="text-sm font-bold tracking-tight">UNILOG AI</span><span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">AI enrichment</span></div></div><nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Primary navigation"><div className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Workspace</div>{nav.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => go(id)} className={`flex items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors ${view === id ? 'bg-primary text-primary-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent'}`}><Icon className="size-4" /><span>{label}</span>{id === 'review' && <span className="ml-auto font-mono text-[10px] text-muted-foreground">—</span>}</button>)}</nav><div className="flex flex-col gap-3 border-t p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><div className="size-2 bg-amber-400" /> Backend disconnected</div><Button variant="outline" size="sm" className="justify-start"><Settings2 data-icon="inline-start" /> Workspace settings</Button></div></aside><div className="lg:pl-64"><header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:px-8"><div className="flex items-center gap-3"><Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle navigation"><Menu /></Button><div className="hidden items-center gap-2 text-sm text-muted-foreground md:flex"><span>Workspace</span><ChevronRight className="size-3" /><span className="font-medium text-foreground">{active.label}</span></div><div className="flex items-center gap-2 md:hidden"><active.icon className="size-4 text-primary" /><span className="text-sm font-semibold">{active.label}</span></div></div><div className="flex items-center gap-2"><div className="relative hidden w-56 md:block"><Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input className="h-8 pl-8 text-xs" placeholder="Search workspace" disabled /></div><Button variant="ghost" size="icon" aria-label="Notifications"><Bell /></Button><div className="flex size-8 items-center justify-center border bg-muted text-xs font-bold">OP</div></div></header><main className="mx-auto max-w-[1600px] p-4 md:p-8">{content}</main></div>{mobileOpen && <button className="fixed inset-0 z-30 bg-foreground/20 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}</div>
}

export { nav }
