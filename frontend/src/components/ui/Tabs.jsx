import { cn } from '@/utils/cn';

const tabId = (prefix, id) => `${prefix}-tab-${id}`;
const panelId = (prefix, id) => `${prefix}-panel-${id}`;

/**
 * <Tabs idPrefix="settings" ariaLabel={t('settings.title')} value={tab} onChange={setTab}
 *   tabs={[{ id: 'profile', label: t('settings.profile'), icon: <User className="h-4 w-4" /> }, ...]} />
 * <TabPanel idPrefix="settings" id="profile" value={tab}>...</TabPanel>
 *
 * Keyboard: Left/Right (reversed in Arabic), Home and End move to a tab and open it.
 * Many tabs scroll sideways instead of wrapping. tab: { id, label, icon?, badge?, disabled? }.
 */
export function Tabs({ tabs, value, onChange, idPrefix = 'tabs', ariaLabel, className }) {
  const onKeyDown = (event) => {
    const list = event.currentTarget;
    const nodes = [...list.querySelectorAll('[role="tab"]:not([disabled])')];
    if (nodes.length === 0) return;

    const current = nodes.indexOf(document.activeElement);
    const rtl = getComputedStyle(list).direction === 'rtl';
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
    const backward = rtl ? 'ArrowRight' : 'ArrowLeft';

    let next = null;
    if (event.key === forward) next = nodes[(current + 1) % nodes.length];
    else if (event.key === backward) next = nodes[current <= 0 ? nodes.length - 1 : current - 1];
    else if (event.key === 'Home') next = nodes[0];
    else if (event.key === 'End') next = nodes[nodes.length - 1];

    if (next) {
      event.preventDefault();
      next.focus();
      next.click();
    }
  };

  return (
    <div className={cn('overflow-x-auto border-b border-line', className)}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        onKeyDown={onKeyDown}
        className="flex min-w-max gap-1"
      >
        {tabs.map((tab) => {
          const selected = tab.id === value;
          return (
            <button
              key={tab.id}
              id={tabId(idPrefix, tab.id)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={panelId(idPrefix, tab.id)}
              tabIndex={selected ? 0 : -1}
              disabled={tab.disabled}
              onClick={() => onChange(tab.id)}
              className={cn(
                '-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
                'disabled:pointer-events-none disabled:opacity-50',
                selected
                  ? 'border-primary text-primary-text'
                  : 'border-transparent text-content-muted hover:text-content',
              )}
            >
              {tab.icon ? <span aria-hidden="true">{tab.icon}</span> : null}
              {tab.label}
              {tab.badge ? (
                <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-content">
                  {tab.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The content of one tab. Renders nothing while another tab is selected. */
export function TabPanel({ idPrefix = 'tabs', id, value, className, children }) {
  if (id !== value) return null;

  return (
    <div
      id={panelId(idPrefix, id)}
      role="tabpanel"
      aria-labelledby={tabId(idPrefix, id)}
      tabIndex={0}
      className={cn('pt-4', className)}
    >
      {children}
    </div>
  );
}
