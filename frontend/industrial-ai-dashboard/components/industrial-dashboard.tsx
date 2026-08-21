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
  Download,
  FileSearch,
  Filter,
  Gauge,
  Info,
  Layers3,
  ListChecks,
  LogOut,
  Menu,
  Moon,
  PackageSearch,
  Play,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Settings,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Sun,
  UploadCloud,
  User,
  Users,
  X,
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  approveReview,
  evidencePdfUrl,
  exportUrl,
  getCurrentUser,
  getHealth,
  getJob,
  getJobs,
  getMetrics,
  getProductEvidence,
  getResults,
  getReviewQueue,
  logout,
  scanSearch,
  searchProducts,
  type EvidenceChunk,
  type Job,
  type MetricsResponse,
  type ProductResult,
  type UserProfile,
  uploadCatalog,
} from '@/lib/backend-api'
import { ProductChatbot } from '@/components/product-chatbot'

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

function StatusBadge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'warning' | 'success' | 'danger' }) {
  return (
    <Badge
      variant="outline"
      className={
        tone === 'warning'
          ? 'border-amber-300 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium'
          : tone === 'success'
          ? 'border-emerald-300 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium'
          : tone === 'danger'
          ? 'border-rose-300 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium'
          : 'text-muted-foreground'
      }
    >
      {children}
    </Badge>
  )
}

function PageHeading({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 border-b pb-5 md:flex-row md:items-end md:justify-between">
      <div className="flex flex-col gap-1.5">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">{eyebrow}</div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">{title}</h1>
        <p className="max-w-2xl text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

function EmptyPanel({ icon: Icon = Database, title, description }: { icon?: React.ElementType; title: string; description: string }) {
  return (
    <Empty className="min-h-48 border-0 py-8">
      <EmptyHeader>
        <EmptyMedia variant="icon"><Icon className="size-6 text-muted-foreground" /></EmptyMedia>
        <EmptyTitle className="text-sm font-semibold">{title}</EmptyTitle>
        <EmptyDescription className="text-xs text-muted-foreground">{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

// ----------------------------------------------------
// CONNECTED DASHBOARD VIEW
// ----------------------------------------------------
function ConnectedDashboardView({ go }: { go: (view: View) => void }) {
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([getMetrics(), getJobs()])
      .then(([nextMetrics, nextJobs]) => {
        setMetrics(nextMetrics)
        setJobs(nextJobs.slice().reverse())
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load dashboard metrics.'))
  }, [])

  const kpiValues = metrics
    ? [
        { label: 'Products processed', value: metrics.total_processed, isRate: false, icon: Boxes },
        { label: 'Attribute accuracy', value: metrics.attribute_accuracy_rate, isRate: true, icon: Sparkles },
        { label: 'LOV compliance', value: metrics.lov_compliance_rate, isRate: true, icon: ListChecks },
        { label: 'UOM compliance', value: metrics.uom_compliance_rate, isRate: true, icon: SlidersHorizontal },
        { label: 'Source-backed fields', value: metrics.evidence_backed_rate, isRate: true, icon: ShieldCheck },
        { label: 'Human review rate', value: metrics.human_review_rate, isRate: true, icon: Users },
      ]
    : []

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        eyebrow="Operations Overview"
        title="Product Enrichment Control Center"
        description="Monitor enrichment throughput, validation quality, evidence traceability, and review workload across your industrial catalog."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => go('pipeline')}>
              <Play className="mr-1.5 size-3.5" /> View pipeline
            </Button>
            <Button size="sm" onClick={() => go('upload')}>
              <Plus className="mr-1.5 size-3.5" /> New dataset
            </Button>
          </>
        }
      />

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Dashboard unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!error && !metrics && <EmptyPanel icon={Gauge} title="Loading operational metrics" description="Connecting live pipeline signals and review queue..." />}

      {metrics && (
        <>
          {/* Top KPIs */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {kpiValues.map(({ label, value, isRate, icon: Icon }) => (
              <Card key={label} className="border-border/60 bg-card/80 backdrop-blur shadow-sm transition-all hover:border-primary/40">
                <CardContent className="flex items-start justify-between p-4">
                  <div className="flex flex-col gap-2.5">
                    <span className="text-xs font-semibold text-muted-foreground">{label}</span>
                    <span className="text-3xl font-bold tracking-tight text-foreground">
                      {isRate ? `${Number(value).toFixed(2)}%` : Number(value).toFixed(0)}
                    </span>
                    <Progress value={isRate ? Number(value) : 100} className="h-1.5 w-36" />
                  </div>
                  <div className="flex size-9 items-center justify-center rounded-lg border bg-primary/10 text-primary">
                    <Icon className="size-4.5" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Compliance Breakdown Section */}
          <Card className="border-border/60 bg-card/80 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold">Catalog Compliance Breakdown</CardTitle>
                  <CardDescription className="text-xs">Real validation counts and pass rates computed from processed attributes</CardDescription>
                </div>
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => go('metrics')}>
                  Full Report <ChevronRight className="ml-1 size-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {/* LOV Card */}
                <div className="flex flex-col gap-2 border rounded-lg p-3.5 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">LOV Compliance</span>
                    <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      {metrics.compliance?.lov.rate ?? metrics.lov_compliance_rate}%
                    </span>
                  </div>
                  <Progress value={metrics.compliance?.lov.rate ?? metrics.lov_compliance_rate} className="h-2" />
                  <div className="mt-1 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                    <span>Passed: {metrics.compliance?.lov.passed ?? 0}</span>
                    <span>Failed: {metrics.compliance?.lov.failed ?? 0}</span>
                    <span>Total: {metrics.compliance?.lov.total ?? 0}</span>
                  </div>
                </div>

                {/* UOM Card */}
                <div className="flex flex-col gap-2 border rounded-lg p-3.5 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">UOM Normalization</span>
                    <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      {metrics.compliance?.uom.rate ?? metrics.uom_compliance_rate}%
                    </span>
                  </div>
                  <Progress value={metrics.compliance?.uom.rate ?? metrics.uom_compliance_rate} className="h-2" />
                  <div className="mt-1 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                    <span>Passed: {metrics.compliance?.uom.passed ?? 0}</span>
                    <span>Failed: {metrics.compliance?.uom.failed ?? 0}</span>
                    <span>Total: {metrics.compliance?.uom.total ?? 0}</span>
                  </div>
                </div>

                {/* Source Card */}
                <div className="flex flex-col gap-2 border rounded-lg p-3.5 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">Source Evidence</span>
                    <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      {metrics.compliance?.source.rate ?? metrics.evidence_backed_rate}%
                    </span>
                  </div>
                  <Progress value={metrics.compliance?.source.rate ?? metrics.evidence_backed_rate} className="h-2" />
                  <div className="mt-1 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                    <span>Passed: {metrics.compliance?.source.passed ?? 0}</span>
                    <span>Failed: {metrics.compliance?.source.failed ?? 0}</span>
                    <span>Total: {metrics.compliance?.source.total ?? 0}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Jobs */}
          <Card className="border-border/60 bg-card/80 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold">Recent Processing Jobs</CardTitle>
                  <CardDescription className="text-xs">Latest catalog enrichment runs</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => go('pipeline')}>
                  <Activity className="mr-1.5 size-3.5" /> Open Pipeline
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {jobs.length === 0 ? (
                <EmptyPanel icon={Activity} title="No processing jobs" description="Upload a catalog spreadsheet to launch your first enrichment run." />
              ) : (
                <div className="flex flex-col gap-2">
                  {jobs.slice(0, 5).map((job) => (
                    <button
                      key={job.id}
                      className="flex items-center justify-between rounded-lg border p-3 text-left transition-colors hover:border-primary hover:bg-muted/30"
                      onClick={() => go('pipeline')}
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-foreground">{job.filename}</span>
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {job.processed_rows} of {job.total_rows} rows processed · {job.needs_review_count} flagged for review
                        </span>
                      </div>
                      <StatusBadge tone={job.status === 'completed' ? 'success' : 'warning'}>{job.status}</StatusBadge>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

// ----------------------------------------------------
// CONNECTED UPLOAD VIEW
// ----------------------------------------------------
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
      setError(err instanceof Error ? err.message : 'Upload failed. Please check spreadsheet format.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        eyebrow="Data Intake"
        title="Upload Catalog Dataset"
        description="Upload an Excel (.xlsx, .xls) or CSV catalog file to trigger document retrieval, attribute extraction, validation, and description generation."
      />
      <Card className="border-border/60 bg-card/80 shadow-sm max-w-2xl">
        <CardHeader>
          <CardTitle className="text-sm font-bold">Spreadsheet Source</CardTitle>
          <CardDescription className="text-xs">Select your product catalog file. Supporting brochures will be retrieved and parsed automatically.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed bg-muted/20 p-6 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UploadCloud className="size-6" />
            </div>
            <div>
              <p className="text-sm font-semibold">Drop catalog spreadsheet here or browse</p>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground">Supported formats: .xlsx, .xls, .csv</p>
            </div>
            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="max-w-xs text-xs"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {file && (
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3.5 py-2.5 text-xs font-mono">
              <span>Selected: <span className="font-bold text-foreground">{file.name}</span> ({(file.size / 1024).toFixed(1)} KB)</span>
              <Button size="sm" onClick={() => void submit()} disabled={loading}>
                {loading ? 'Uploading & Processing...' : <><CloudUpload className="mr-1.5 size-3.5" /> Launch Pipeline</>}
              </Button>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>Upload error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ----------------------------------------------------
// CONNECTED PIPELINE VIEW
// ----------------------------------------------------
function ConnectedPipelineView({
  jobId,
  onCompleted,
  onViewResults,
}: {
  jobId: string | null
  onCompleted: (job: Job) => void
  onViewResults: () => void
}) {
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
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [jobId, onCompleted])

  const progress = job && job.total_rows ? Math.round((job.processed_rows / job.total_rows) * 100) : 0

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        eyebrow="Run Orchestration"
        title="Processing Pipeline"
        description="Track live ingestion, vector retrieval, attribute extraction, validation, and publication progress."
        actions={
          job?.status === 'completed' ? (
            <Button size="sm" onClick={onViewResults}>
              <Boxes className="mr-1.5 size-3.5" /> View Results
            </Button>
          ) : undefined
        }
      />

      {!jobId && <EmptyPanel icon={Activity} title="No active pipeline run" description="Upload a dataset to start an enrichment run." />}

      {job && (
        <>
          <Card className="border-border/60 bg-card/80 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold">{job.filename}</CardTitle>
                  <CardDescription className="text-xs">
                    Job ID: {job.id} · {job.processed_rows} of {job.total_rows} rows processed
                  </CardDescription>
                </div>
                <StatusBadge tone={job.status === 'completed' ? 'success' : 'warning'}>{job.status}</StatusBadge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Progress value={progress} className="h-2" />
              <div className="flex justify-between font-mono text-xs text-muted-foreground">
                <span>{progress}% complete</span>
                <span>{job.needs_review_count} rows require human review</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/80 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-bold">Execution Log Stream</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-80 overflow-auto rounded-lg bg-zinc-950 p-4 font-mono text-xs text-emerald-400 leading-6 border">
                {job.logs.map((log, index) => (
                  <div key={`${index}-${log}`}>{log}</div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Pipeline status error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

// ----------------------------------------------------
// CONNECTED RESULTS VIEW WITH ATTRIBUTE INSPECTOR & CART
// ----------------------------------------------------
function ConnectedResultsView({
  jobId,
  onSelectProduct,
  onAddToCart,
}: {
  jobId: string | null
  onSelectProduct: (mpn: string) => void
  onAddToCart: (product: ProductResult) => void
}) {
  const [results, setResults] = useState<ProductResult[]>([])
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [inspectProduct, setInspectProduct] = useState<ProductResult | null>(null)

  useEffect(() => {
    if (!jobId) return
    void getResults(jobId)
      .then(setResults)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load catalog results.'))
  }, [jobId])

  async function search() {
    if (!query.trim()) return
    setSearching(true)
    setError('')
    try {
      const matches = await searchProducts(query, jobId ?? undefined)
      setResults(matches.map((m) => m.product))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search query failed.')
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        eyebrow="Catalog Output"
        title="Enriched Product Results"
        description="Inspect enriched product records, attributes, confidence scores, evidence reasons, and export deliverables."
        actions={
          jobId ? (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => window.open(`${exportUrl(jobId)}/structured`, '_blank')}>
                <Download className="mr-1.5 size-3.5" /> Export JSON
              </Button>
              <Button size="sm" onClick={() => window.location.assign(exportUrl(jobId))}>
                <Download className="mr-1.5 size-3.5" /> Export Excel
              </Button>
            </div>
          ) : undefined
        }
      />

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Results unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!jobId && <EmptyPanel icon={PackageSearch} title="No completed job" description="Upload and run catalog enrichment to view products." />}

      {jobId && results.length === 0 && !error && (
        <EmptyPanel icon={PackageSearch} title="No result rows returned" description="The enrichment job completed without product outputs." />
      )}

      {results.length > 0 && (
        <Card className="border-border/60 bg-card/80 shadow-sm">
          <CardContent className="overflow-auto p-4">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 gap-2 max-w-lg">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void search()
                  }}
                  placeholder="Search MPN, manufacturer, brand, or attribute..."
                  className="h-9 text-xs"
                />
                <Button size="sm" onClick={() => void search()} disabled={searching || !query.trim()}>
                  <Search className="mr-1.5 size-3.5" /> Search
                </Button>
              </div>

              <span className="font-mono text-xs text-muted-foreground">{results.length} records populated</span>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Part Number / MPN</TableHead>
                  <TableHead>Manufacturer</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Validation Status</TableHead>
                  <TableHead>Attributes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((product, index) => {
                  const attributes = Object.keys(product).filter((key) => key.startsWith('ATTRIBUTE_VALUE ') && product[key])
                  const mpn = String(product.Mfg_Part_Num ?? product.PART_NUMBER ?? '')
                  return (
                    <TableRow key={String(product._job_row_id ?? index)}>
                      <TableCell className="font-bold text-foreground">{String(product.PART_NUMBER ?? product.Mfg_Part_Num ?? '—')}</TableCell>
                      <TableCell>{String(product.MANUFACTURER_NAME ?? product.Part_Manuf ?? '—')}</TableCell>
                      <TableCell>{String(product.BRAND_NAME ?? product.Unilog_Brand ?? '—')}</TableCell>
                      <TableCell>
                        <StatusBadge tone={product._needs_human_review ? 'warning' : 'success'}>
                          {product._needs_human_review ? 'Needs Review' : 'Validated'}
                        </StatusBadge>
                      </TableCell>
                      <TableCell>{attributes.length} populated</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setInspectProduct(product)}>
                            <Info className="mr-1 size-3" /> Inspect
                          </Button>
                          {mpn && (
                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onSelectProduct(mpn)}>
                              <FileSearch className="mr-1 size-3" /> Evidence
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="size-7 text-primary" onClick={() => onAddToCart(product)} title="Add to Cart / Export List">
                            <ShoppingCart className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Attribute Inspector Modal */}
      {inspectProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between border-b pb-3">
              <div>
                <CardTitle className="text-base font-bold">
                  {String(inspectProduct.PART_NUMBER ?? inspectProduct.Mfg_Part_Num)} Attribute Details
                </CardTitle>
                <CardDescription className="text-xs">
                  {String(inspectProduct.MANUFACTURER_NAME)} · {String(inspectProduct.BRAND_NAME)}
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" className="size-8" onClick={() => setInspectProduct(null)}>
                <X className="size-4" />
              </Button>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
              <Tabs defaultValue="table" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="table">Table View</TabsTrigger>
                  <TabsTrigger value="json">Structured JSON View</TabsTrigger>
                </TabsList>
                
                <TabsContent value="table" className="space-y-4">
                  <div className="grid gap-2 border rounded-lg p-3 bg-muted/20">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Product Descriptions</span>
                    <p className="text-xs font-semibold text-foreground">Short: {String(inspectProduct.SHORT_DESC ?? 'N/A')}</p>
                    <p className="text-xs text-muted-foreground">Invoice (&lt;=40 chars): {String(inspectProduct.INVOICE_DESC ?? 'N/A')}</p>
                    <p className="text-xs text-muted-foreground">Mobile (60-80 chars): {String(inspectProduct.MOBILE_DESC ?? 'N/A')}</p>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Attribute Extractions & Confidence Signals</span>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Attribute Label</TableHead>
                          <TableHead>Value & UOM</TableHead>
                          <TableHead>Confidence</TableHead>
                          <TableHead>Signal / Reason</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Array.from({ length: 50 }).map((_, idx) => {
                          const label = inspectProduct[`ATTRIBUTE_LABEL ${idx + 1}`]
                          if (!label) return null
                          const val = inspectProduct[`ATTRIBUTE_VALUE ${idx + 1}`]
                          const uom = inspectProduct[`ATTRIBUTE_UOM ${idx + 1}`] || ''
                          const validation = (inspectProduct._attribute_validation as Record<string, any>)?.[String(label)] || {}
                          const conf = float(validation.confidence ?? 0.9) * 100
                          const reason = validation.reason || 'Extracted'

                          return (
                            <TableRow key={idx}>
                              <TableCell className="font-semibold text-xs">{String(label)}</TableCell>
                              <TableCell className="font-mono text-xs">{val ? `${val} ${uom}`.trim() : '—'}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={conf >= 80 ? 'border-emerald-300 text-emerald-600' : 'border-amber-300 text-amber-600'}>
                                  {conf.toFixed(0)}%
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{reason}</TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>
                
                <TabsContent value="json" className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Gemini Dynamic Structured JSON Output</span>
                  <div className="border rounded-lg p-3 bg-muted/40 font-mono text-xs overflow-auto max-h-[50vh]">
                    <pre className="text-foreground whitespace-pre-wrap">
                      {JSON.stringify(inspectProduct._structured_json ?? inspectProduct, null, 2)}
                    </pre>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function float(val: any): number {
  const n = Number(val)
  return isNaN(n) ? 0.9 : n
}

// ----------------------------------------------------
// CONNECTED EVIDENCE VIEW
// ----------------------------------------------------
function ConnectedEvidenceView({ mfgPartNum }: { mfgPartNum: string | null }) {
  const [chunks, setChunks] = useState<EvidenceChunk[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!mfgPartNum) return
    setError('')
    void getProductEvidence(mfgPartNum)
      .then(setChunks)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load product evidence.'))
  }, [mfgPartNum])

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        eyebrow="Traceability"
        title="Product Evidence & Source Citations"
        description="Inspect exact manufacturer brochure text snippets, PDF filenames, and page citations returned by vector retrieval."
        actions={
          mfgPartNum ? (
            <Button size="sm" onClick={() => window.location.assign(evidencePdfUrl(mfgPartNum))}>
              <FileSearch className="mr-1.5 size-3.5" /> Download Evidence PDF
            </Button>
          ) : undefined
        }
      />

      {!mfgPartNum && <EmptyPanel icon={FileSearch} title="No product selected" description="Select a product from Results to inspect its evidence." />}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Evidence unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {mfgPartNum && !error && chunks.length === 0 && (
        <EmptyPanel icon={Database} title="No evidence found" description={`No indexed manufacturer evidence available for ${mfgPartNum}.`} />
      )}

      {chunks.length > 0 && (
        <Card className="border-border/60 bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm font-bold">{mfgPartNum} Manufacturer Evidence</CardTitle>
            <CardDescription className="text-xs">{chunks.length} cited document chunks returned by hybrid vector retrieval</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {chunks.map((chunk, index) => (
              <div key={`${chunk.source}-${chunk.page_num}-${index}`} className="rounded-lg border p-4 bg-muted/20">
                <div className="mb-2 flex items-center justify-between text-xs font-semibold text-primary">
                  <span>Source Document: {chunk.source}</span>
                  <Badge variant="secondary" className="font-mono">Page {chunk.page_num}</Badge>
                </div>
                <p className="text-xs leading-6 text-foreground font-sans">{chunk.text}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ----------------------------------------------------
// CONNECTED REVIEW VIEW
// ----------------------------------------------------
function ConnectedReviewView() {
  const [items, setItems] = useState<Record<string, unknown>[]>([])
  const [error, setError] = useState('')

  const loadQueue = () =>
    void getReviewQueue()
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load review queue.'))

  useEffect(loadQueue, [])

  async function resolve(item: Record<string, unknown>) {
    const rowId = String(item.product_row_id ?? '')
    const flagged = Array.isArray(item.flagged_attributes) ? (item.flagged_attributes as { slot?: number; label?: string }[]) : []
    if (!rowId || flagged.length === 0) return

    const overrides: Record<number, string> = {}
    for (const attr of flagged) {
      const val = window.prompt(`Enter approved value for ${attr.label ?? `Attribute Slot ${attr.slot}`}:`, 'Stainless Steel')
      if (val === null || !val.trim() || attr.slot === undefined) return
      overrides[attr.slot] = val.trim()
    }

    try {
      await approveReview(rowId, overrides)
      loadQueue()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not approve review override.')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        eyebrow="Exception Handling"
        title="Human Review Queue"
        description="Resolve low-confidence extractions, LOV mismatches, and source conflicts before catalog publishing."
      />

      <Card className="border-border/60 bg-card/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-bold">Pending Review Queue ({items.length})</CardTitle>
          <CardDescription className="text-xs font-mono">Flagged items require manual validation approval</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertTitle>Review queue unavailable</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {!error && items.length === 0 && (
            <EmptyPanel icon={CheckCircle2} title="Review queue is empty" description="All completed catalog products are fully validated." />
          )}

          {items.length > 0 && (
            <div className="flex flex-col gap-3">
              {items.map((item, index) => (
                <div key={String(item.product_row_id ?? index)} className="flex items-center justify-between rounded-lg border p-4 text-xs bg-muted/20">
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-foreground text-sm">
                      {String(item.mfg_part_num ?? item.part_number ?? 'Unknown Product')}
                    </span>
                    <span className="text-muted-foreground font-mono">
                      {Array.isArray(item.flagged_attributes) ? `${item.flagged_attributes.length} attributes flagged for review` : 'Flagged'}
                    </span>
                  </div>
                  <Button size="sm" onClick={() => void resolve(item)}>
                    <CheckCircle2 className="mr-1.5 size-3.5" /> Approve & Override
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ----------------------------------------------------
// CONNECTED METRICS VIEW
// ----------------------------------------------------
function ConnectedMetricsView() {
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    void getMetrics()
      .then(setMetrics)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load metrics.'))
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        eyebrow="Quality System"
        title="Evaluation & Compliance Metrics"
        description="Live quality signals and compliance rates calculated from processed catalog data."
      />

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="size-4" />
          <AlertTitle>Metrics unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!metrics && !error && <EmptyPanel icon={BarChart3} title="Loading evaluation report" description="Reading metrics snapshot..." />}

      {metrics && (
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <Card className="border-border/60 bg-card/80 p-4">
              <span className="text-xs font-semibold text-muted-foreground">Processed</span>
              <span className="block text-2xl font-bold mt-2">{metrics.total_processed}</span>
            </Card>
            <Card className="border-border/60 bg-card/80 p-4">
              <span className="text-xs font-semibold text-muted-foreground">Accuracy</span>
              <span className="block text-2xl font-bold mt-2 text-emerald-600 dark:text-emerald-400">{metrics.attribute_accuracy_rate}%</span>
            </Card>
            <Card className="border-border/60 bg-card/80 p-4">
              <span className="text-xs font-semibold text-muted-foreground">LOV Compliance</span>
              <span className="block text-2xl font-bold mt-2">{metrics.lov_compliance_rate}%</span>
            </Card>
            <Card className="border-border/60 bg-card/80 p-4">
              <span className="text-xs font-semibold text-muted-foreground">UOM Compliance</span>
              <span className="block text-2xl font-bold mt-2">{metrics.uom_compliance_rate}%</span>
            </Card>
            <Card className="border-border/60 bg-card/80 p-4">
              <span className="text-xs font-semibold text-muted-foreground">Source Backed</span>
              <span className="block text-2xl font-bold mt-2">{metrics.evidence_backed_rate}%</span>
            </Card>
            <Card className="border-border/60 bg-card/80 p-4">
              <span className="text-xs font-semibold text-muted-foreground">Human Review</span>
              <span className="block text-2xl font-bold mt-2 text-amber-600 dark:text-amber-400">{metrics.human_review_rate}%</span>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------
// MAIN INDUSTRIAL DASHBOARD SHELL
// ----------------------------------------------------
export default function IndustrialDashboard() {
  const [view, setView] = useState<View>('dashboard')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [selectedMpn, setSelectedMpn] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)
  const [dark, setDark] = useState(false)
  
  // Modals & Drawers
  const [scanOpen, setScanOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  
  const [cartItems, setCartItems] = useState<ProductResult[]>([])
  const [scanFile, setScanFile] = useState<File | null>(null)
  const [scanLoading, setScanLoading] = useState(false)

  const active = useMemo(() => nav.find((item) => item.id === view) ?? nav[0], [view])

  useEffect(() => {
    setJobId(window.localStorage.getItem('unilog.activeJobId'))
    getCurrentUser().then(setCurrentUser).catch(() => {})
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
    try {
      await logout()
    } catch {}
    window.localStorage.removeItem('unilog.accessToken')
    window.localStorage.removeItem('unilog.username')
    window.location.reload()
  }

  const go = (next: View) => {
    setView(next)
    setMobileOpen(false)
  }

  function handleAddToCart(product: ProductResult) {
    setCartItems((prev) => [...prev, product])
    setCartOpen(true)
  }

  async function handleScanSubmit() {
    if (!scanFile) return
    setScanLoading(true)
    try {
      const res = await scanSearch(scanFile)
      setScanOpen(false)
      if (res.matches.length > 0) {
        setSelectedMpn(res.detected_code)
        go('results')
      } else {
        alert(`Scan detected token '${res.detected_code}', but no direct catalog matches found.`)
      }
    } catch {
      alert('Scan search request failed.')
    } finally {
      setScanLoading(false)
    }
  }

  const content = {
    dashboard: <ConnectedDashboardView go={go} />,
    upload: <ConnectedUploadView onStarted={(id) => { setJobId(id); go('pipeline') }} />,
    pipeline: <ConnectedPipelineView jobId={jobId} onCompleted={() => go('results')} onViewResults={() => go('results')} />,
    results: <ConnectedResultsView jobId={jobId} onSelectProduct={(mpn) => { setSelectedMpn(mpn); go('evidence') }} onAddToCart={handleAddToCart} />,
    evidence: <ConnectedEvidenceView mfgPartNum={selectedMpn} />,
    review: <ConnectedReviewView />,
    metrics: <ConnectedMetricsView />,
  }[view]

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r bg-sidebar transition-transform lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center gap-3 border-b px-5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md">
            <Sparkles className="size-4.5" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold tracking-tight">UNILOG AI</span>
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Product Intelligence</span>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Primary navigation">
          <div className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Workspace</div>
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => go(id)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-semibold transition-colors ${
                view === id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent'
              }`}
            >
              <Icon className="size-4" />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="flex flex-col gap-2 border-t p-3">
          <Button variant="outline" size="sm" className="justify-start text-xs" onClick={() => setSettingsOpen(true)}>
            <Settings className="mr-2 size-3.5" /> Workspace Settings
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="lg:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle navigation">
              <Menu className="size-5" />
            </Button>
            <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
              <span>UNILOG</span>
              <ChevronRight className="size-3" />
              <span className="font-bold text-foreground">{active.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Scan-to-Search Button */}
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setScanOpen(true)}>
              <QrCode className="mr-1.5 size-3.5 text-primary" /> Scan Search
            </Button>

            {/* Cart Button */}
            <Button variant="ghost" size="icon" className="relative size-8" onClick={() => setCartOpen(true)} title="Cart / Export List">
              <ShoppingCart className="size-4" />
              {cartItems.length > 0 && (
                <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                  {cartItems.length}
                </span>
              )}
            </Button>

            {/* Notifications Button */}
            <Button variant="ghost" size="icon" className="relative size-8" onClick={() => setNotificationsOpen(true)} title="Notifications">
              <Bell className="size-4" />
              <span className="absolute right-1 top-1 size-2 rounded-full bg-amber-500" />
            </Button>

            {/* Theme Toggle Button */}
            <Button variant="ghost" size="icon" className="size-8" onClick={toggleTheme} title="Toggle Dark/Light Mode">
              {dark ? <Sun className="size-4 text-amber-400" /> : <Moon className="size-4" />}
            </Button>

            {/* Profile Button */}
            <Button variant="ghost" size="sm" className="h-8 gap-2 font-mono text-xs font-bold" onClick={() => setProfileOpen(true)}>
              <div className="flex size-6 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                {(currentUser?.username ?? 'OP').substring(0, 2).toUpperCase()}
              </div>
              <span className="hidden md:inline">{currentUser?.username ?? 'Analyst'}</span>
            </Button>
          </div>
        </header>

        <main className="mx-auto max-w-[1600px] p-4 md:p-8">{content}</main>
      </div>

      {/* SCAN-TO-SEARCH MODAL */}
      {scanOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md shadow-2xl bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
              <div className="flex items-center gap-2">
                <QrCode className="size-5 text-primary" />
                <CardTitle className="text-base font-bold">Scan-to-Search</CardTitle>
              </div>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => setScanOpen(false)}><X className="size-4" /></Button>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <p className="text-xs text-muted-foreground">Upload a product image, barcode scan, or datasheet label to automatically search catalog matches.</p>
              <Input type="file" accept="image/*" className="text-xs" onChange={(e) => setScanFile(e.target.files?.[0] ?? null)} />
              <Button className="w-full text-xs font-medium" disabled={!scanFile || scanLoading} onClick={() => void handleScanSubmit()}>
                {scanLoading ? 'Scanning & Parsing...' : 'Run Scan Search'}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* CART / SAVED PRODUCTS DRAWER */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md bg-card border-l h-full flex flex-col p-4 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="size-5 text-primary" />
                <span className="font-bold text-sm">Saved Products Export List ({cartItems.length})</span>
              </div>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => setCartOpen(false)}><X className="size-4" /></Button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {cartItems.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-12">No products added to export list yet.</p>
              ) : (
                cartItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between border rounded-lg p-3 text-xs">
                    <div>
                      <p className="font-bold">{String(item.PART_NUMBER ?? item.Mfg_Part_Num)}</p>
                      <p className="text-[11px] text-muted-foreground">{String(item.MANUFACTURER_NAME)}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="size-6 text-rose-500" onClick={() => setCartItems((prev) => prev.filter((_, idx) => idx !== i))}>
                      <X className="size-3" />
                    </Button>
                  </div>
                ))
              )}
            </div>
            {cartItems.length > 0 && jobId && (
              <Button className="w-full text-xs" onClick={() => window.location.assign(exportUrl(jobId))}>
                <Download className="mr-1.5 size-3.5" /> Export Selected to Delivery Excel
              </Button>
            )}
          </div>
        </div>
      )}

      {/* PROFILE MODAL */}
      {profileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-sm shadow-2xl bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
              <div className="flex items-center gap-2">
                <User className="size-5 text-primary" />
                <CardTitle className="text-base font-bold">User Profile</CardTitle>
              </div>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => setProfileOpen(false)}><X className="size-4" /></Button>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="flex flex-col gap-1 border-b pb-3">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">Username</span>
                <span className="text-sm font-bold text-foreground">{currentUser?.username ?? 'admin'}</span>
              </div>
              <div className="flex flex-col gap-1 border-b pb-3">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">Role</span>
                <span className="text-xs text-foreground font-mono">{currentUser?.role ?? 'Administrator'}</span>
              </div>
              <div className="flex flex-col gap-1 border-b pb-3">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">Email</span>
                <span className="text-xs text-foreground font-mono">{currentUser?.email ?? 'admin@unilogcorp.com'}</span>
              </div>
              <Button variant="destructive" className="w-full text-xs mt-2" onClick={() => void signOut()}>
                <LogOut className="mr-1.5 size-3.5" /> Sign Out Session
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* WORKSPACE SETTINGS MODAL */}
      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md shadow-2xl bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
              <div className="flex items-center gap-2">
                <Settings2 className="size-5 text-primary" />
                <CardTitle className="text-base font-bold">Workspace Settings</CardTitle>
              </div>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => setSettingsOpen(false)}><X className="size-4" /></Button>
            </CardHeader>
            <CardContent className="pt-4 space-y-4 text-xs">
              <div className="flex flex-col gap-1.5">
                <label className="font-semibold text-muted-foreground uppercase text-[10px]">Backend Engine Base URL</label>
                <Input value={process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000'} disabled className="h-8 text-xs font-mono" />
              </div>
              <div className="flex items-center justify-between border-t pt-3">
                <span>Dark Mode Theme</span>
                <Button size="sm" variant="outline" onClick={toggleTheme}>{dark ? 'Light Mode' : 'Dark Mode'}</Button>
              </div>
              <div className="flex items-center justify-between border-t pt-3 font-mono text-[11px]">
                <span>Vector Database (Qdrant)</span>
                <StatusBadge tone="success">Online / In-Memory</StatusBadge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* NOTIFICATIONS DRAWER */}
      {notificationsOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-card border-l h-full flex flex-col p-4 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Bell className="size-5 text-primary" />
                <span className="font-bold text-sm">System Notifications</span>
              </div>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => setNotificationsOpen(false)}><X className="size-4" /></Button>
            </div>
            <div className="space-y-3 font-sans text-xs">
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="font-bold text-foreground">Pipeline Ingestion Ready</p>
                <p className="text-[11px] text-muted-foreground mt-1">Catalog enrichment engine is active and ready for datasets.</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="font-bold text-foreground">Reference Catalog Updated</p>
                <p className="text-[11px] text-muted-foreground mt-1">LOV, UOM, and Manufacturer rules loaded into memory.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Chatbot Component */}
      <ProductChatbot />
    </div>
  )
}

export { nav }
