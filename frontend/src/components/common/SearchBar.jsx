import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useDebounce } from '@/hooks/useDebounce';

/**
 * A search box that calls onSearch 300 ms after the person stops typing
 * (at once on Enter and on the clear button).
 *
 * const [search, setSearch] = useState('');
 * <SearchBar value={search} onSearch={(text) => { setSearch(text); setPage(1); }} />
 *
 * value is the CURRENT search of the page: when the parent changes it (a "reset filters"
 * button), the box follows. onSearch gets the trimmed text and is not called for the same text twice.
 */
export function SearchBar({ value = '', onSearch, placeholder, delay = 300, className }) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const onSearchRef = useRef(onSearch);
  const lastSent = useRef(value);
  const [text, setText] = useState(value);
  const debounced = useDebounce(text, delay);

  useEffect(() => {
    onSearchRef.current = onSearch;
  });

  // Typing paused: tell the parent.
  useEffect(() => {
    const next = debounced.trim();
    if (next !== lastSent.current) {
      lastSent.current = next;
      onSearchRef.current?.(next);
    }
  }, [debounced]);

  // The parent changed the value on its own (reset): follow it.
  useEffect(() => {
    if (value !== lastSent.current) {
      lastSent.current = value;
      setText(value);
    }
  }, [value]);

  const send = (next) => {
    if (next === lastSent.current) return;
    lastSent.current = next;
    onSearchRef.current?.(next);
  };

  const clear = () => {
    setText('');
    send('');
    inputRef.current?.focus();
  };

  return (
    <div role="search" className={className}>
      <Input
        ref={inputRef}
        type="search"
        value={text}
        placeholder={placeholder ?? t('common.search')}
        aria-label={placeholder ?? t('common.search')}
        autoComplete="off"
        startIcon={<Search className="h-4 w-4" />}
        inputClassName="[&::-webkit-search-cancel-button]:hidden"
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            send(text.trim());
          }
        }}
        endAdornment={
          text ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 px-0"
              aria-label={t('common.clear')}
              onClick={clear}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          ) : null
        }
      />
    </div>
  );
}
