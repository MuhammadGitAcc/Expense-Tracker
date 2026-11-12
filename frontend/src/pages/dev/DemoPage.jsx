import { useState } from 'react';
import { Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import { CurrencyDisplay } from '@/components/common/CurrencyDisplay';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import { PageHeader } from '@/components/common/PageHeader';
import { SearchBar } from '@/components/common/SearchBar';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DatePicker } from '@/components/ui/DatePicker';
import { Dropdown } from '@/components/ui/Dropdown';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { FileUpload } from '@/components/ui/FileUpload';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import { Skeleton, SkeletonText } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { Table } from '@/components/ui/Table';
import { TabPanel, Tabs } from '@/components/ui/Tabs';
import { toast } from '@/hooks/useToast';
import { changeLanguage } from '@/i18n';
import { LANGUAGES } from '@/utils/constants';
import { todayISO } from '@/utils/formatDate';

// Development only (/dev/components). Texts here are plain English on purpose: only the
// strings INSIDE the components (close, pagination, upload ...) use the translation files.

const ROWS = [
  { id: '1', date: '2026-11-10', category: 'Food', amount: '12.50', currency: 'USD' },
  { id: '2', date: '2026-11-08', category: 'Transport', amount: '48.00', currency: 'USD' },
  { id: '3', date: '2026-11-05', category: 'Rent', amount: '950.00', currency: 'USD' },
  { id: '4', date: '2026-11-01', category: 'Health', amount: '23.75', currency: 'USD' },
];

const TABS = [
  { id: 'one', label: 'Profile' },
  { id: 'two', label: 'Security', badge: '2' },
  { id: 'three', label: 'Disabled', disabled: true },
];

function Section({ title, children }) {
  return (
    <Card>
      <CardHeader title={title} />
      <div className="space-y-4">{children}</div>
    </Card>
  );
}

function Bomb() {
  throw new Error('Demo error: this is on purpose');
}

export default function DemoPage() {
  const [showErrors, setShowErrors] = useState(false);
  const [file, setFile] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [tab, setTab] = useState('one');
  const [sort, setSort] = useState({ by: 'date', order: 'desc' });
  const [tableLoading, setTableLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState('');
  const [explode, setExplode] = useState(false);

  const sortedRows = [...ROWS].sort((a, b) => {
    const x = sort.by === 'amount' ? Number(a.amount) : a.date;
    const y = sort.by === 'amount' ? Number(b.amount) : b.date;
    const result = x < y ? -1 : x > y ? 1 : 0;
    return sort.order === 'asc' ? result : -result;
  });

  const columns = [
    { key: 'date', header: 'Date', sortable: true },
    { key: 'category', header: 'Category' },
    {
      key: 'amount',
      header: 'Amount',
      align: 'end',
      sortable: true,
      cell: (row) => (
        <CurrencyDisplay value={row.amount} currency={row.currency} tone="expense" showSign />
      ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'end',
      interactive: true,
      cell: (row) => (
        <Dropdown
          label={`Actions for ${row.category}`}
          items={[
            {
              label: 'Edit',
              icon: <Pencil className="h-4 w-4" />,
              onSelect: () => toast.info(`Edit ${row.category}`),
            },
            { separator: true },
            {
              label: 'Delete',
              icon: <Trash2 className="h-4 w-4" />,
              variant: 'danger',
              onSelect: () => setConfirmOpen(true),
            },
          ]}
        />
      ),
    },
  ];

  const confirmDelete = () => {
    setDeleting(true);
    setTimeout(() => {
      setDeleting(false);
      setConfirmOpen(false);
      toast.success('Deleted (demo)');
    }, 1200);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 pb-24 sm:p-8">
      <PageHeader
        title="Component demo"
        description="Every UI component. Switch the theme and the language to check light, dark and RTL."
        actions={
          <>
            {LANGUAGES.map((language) => (
              <Button
                key={language.code}
                variant="outline"
                size="sm"
                onClick={() => changeLanguage(language.code)}
              >
                {language.label}
              </Button>
            ))}
            <ThemeToggle />
          </>
        }
      />

      <Section title="Buttons, badges, avatars, spinner">
        <div className="flex flex-wrap gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
          <Button iconStart={<Plus className="h-4 w-4" />}>With icon</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Neutral</Badge>
          <Badge variant="primary">Primary</Badge>
          <Badge variant="income">Income</Badge>
          <Badge variant="expense">Expense</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="danger">Danger</Badge>
          <Badge variant="success">Success</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Avatar name="Mohammad Ali" size="sm" />
          <Avatar name="Sara Ahmed" />
          <Avatar name="Omar" size="lg" />
          <Avatar name="خالد" size="xl" />
          <Spinner size="sm" />
          <Spinner />
          <Spinner size="lg" />
        </div>
      </Section>

      <Section title="Form fields">
        <Button variant="outline" size="sm" onClick={() => setShowErrors((value) => !value)}>
          {showErrors ? 'Hide errors' : 'Show errors'}
        </Button>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Email"
            type="email"
            required
            hint="We never share it"
            error={showErrors ? 'validation.emailInvalid' : undefined}
          />
          <Select
            label="Currency"
            placeholder="Choose…"
            options={[
              { value: 'USD', label: 'USD' },
              { value: 'EUR', label: 'EUR' },
              { value: 'SAR', label: 'SAR' },
            ]}
            error={showErrors ? 'validation.currencyInvalid' : undefined}
          />
          <DatePicker
            label="Date"
            max={todayISO()}
            defaultValue={todayISO()}
            error={showErrors ? 'validation.dateInvalid' : undefined}
          />
          <Input
            label="Amount"
            inputMode="decimal"
            placeholder="0.00"
            error={showErrors ? 'validation.amountFormat' : undefined}
          />
        </div>
        <Textarea label="Note" hint="Optional" />
        <FileUpload label="Receipt" value={file} onChange={setFile} />
      </Section>

      <Section title="Money (CurrencyDisplay)">
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <p>
            Neutral: <CurrencyDisplay value="1234.50" currency="USD" />
          </p>
          <p>
            Income: <CurrencyDisplay value="1500.00" currency="USD" tone="income" showSign />
          </p>
          <p>
            Expense: <CurrencyDisplay value="12.50" currency="USD" tone="expense" showSign />
          </p>
          <p>
            Auto +: <CurrencyDisplay value="320.00" currency="EUR" tone="auto" showSign />
          </p>
          <p>
            Auto −: <CurrencyDisplay value="-49.90" currency="EUR" tone="auto" showSign />
          </p>
          <p>
            No value: <CurrencyDisplay value={null} />
          </p>
        </div>
      </Section>

      <Section title="Tabs, search, skeleton">
        <Tabs idPrefix="demo" ariaLabel="Demo tabs" tabs={TABS} value={tab} onChange={setTab} />
        <TabPanel idPrefix="demo" id="one" value={tab}>
          Panel one: profile.
        </TabPanel>
        <TabPanel idPrefix="demo" id="two" value={tab}>
          Panel two: security.
        </TabPanel>
        <SearchBar value={search} onSearch={setSearch} />
        <p className="text-sm text-content-muted">Searching for: “{search}”</p>
        <SkeletonText lines={3} />
        <Skeleton className="h-10 w-40" />
      </Section>

      <Section title="Table, pagination, empty state">
        <Button variant="outline" size="sm" onClick={() => setTableLoading((value) => !value)}>
          {tableLoading ? 'Stop loading' : 'Show loading'}
        </Button>
        <Table
          caption="Demo expenses"
          columns={columns}
          rows={sortedRows}
          loading={tableLoading}
          sortBy={sort.by}
          sortOrder={sort.order}
          onSort={(by, order) => setSort({ by, order })}
          onRowClick={(row) => toast.info(`Row ${row.category} clicked`)}
        />
        <Pagination
          page={page}
          limit={limit}
          total={135}
          onPageChange={setPage}
          onLimitChange={(next) => {
            setLimit(next);
            setPage(1);
          }}
        />
        <Table
          columns={columns}
          rows={[]}
          empty={
            <EmptyState
              icon={Wallet}
              title="No expenses yet"
              description="Add your first expense to see it here."
              action={<Button iconStart={<Plus className="h-4 w-4" />}>Add expense</Button>}
            />
          }
        />
      </Section>

      <Section title="Overlays and toasts">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setModalOpen(true)}>Open modal</Button>
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            Open confirm dialog
          </Button>
          <Button variant="outline" onClick={() => toast.success('Saved')}>
            Success toast
          </Button>
          <Button
            variant="outline"
            onClick={() => toast.error('Could not save', { title: 'Error' })}
          >
            Error toast
          </Button>
          <Button variant="outline" onClick={() => toast.warning('Budget almost used')}>
            Warning toast
          </Button>
          <Button variant="outline" onClick={() => toast.info('Just so you know')}>
            Info toast
          </Button>
        </div>
      </Section>

      <Section title="Error boundary and loading screen">
        <Button variant="danger" onClick={() => setExplode(true)}>
          Break the box below
        </Button>
        <p className="text-sm text-content-muted">
          The console shows the demo error: that is expected.
        </p>
        <div className="rounded-xl border border-line">
          <ErrorBoundary
            resetKeys={[explode]}
            fallback={({ error }) => (
              <div role="alert" className="space-y-3 p-6 text-center text-sm">
                <p className="text-danger">{error.message}</p>
                <Button size="sm" onClick={() => setExplode(false)}>
                  Fix it
                </Button>
              </div>
            )}
          >
            {explode ? <Bomb /> : <p className="p-6 text-center text-sm">All good here.</p>}
          </ErrorBoundary>
        </div>
        <div className="rounded-xl border border-line">
          <LoadingScreen fullScreen={false} className="min-h-[8rem]" />
        </div>
      </Section>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add expense"
        description="Escape, the X and the dark background close it."
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setModalOpen(false);
                toast.success('Saved (demo)');
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Amount" placeholder="0.00" data-autofocus />
          <Textarea label="Note" />
          <Dropdown label="Menu inside a modal" items={[{ label: 'First' }, { label: 'Second' }]}>
            Menu inside a modal
          </Dropdown>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this expense?"
        description="The amount goes back to the account. This cannot be undone."
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={confirmDelete}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}
