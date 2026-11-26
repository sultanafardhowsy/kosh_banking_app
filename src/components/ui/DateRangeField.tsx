"use client";

import { DateRangePicker, RangeCalendar } from "@heroui/react";
// Not re-exported from the package root; HeroUI exposes it as a subpath.
import { DateInputGroup } from "@heroui/react/date-input-group";
import { I18nProvider } from "react-aria-components";
import { parseDate, type CalendarDate } from "@internationalized/date";

type Range = { from: string | null; to: string | null };

const toDate = (iso: string | null | undefined) => {
  if (!iso) return null;
  try {
    return parseDate(iso);
  } catch {
    return null;
  }
};

/**
 * One themed "From – To" date control (dd/mm/yyyy segments + a range calendar),
 * replacing pairs of native <input type="date">, whose format follows the browser's
 * locale (often mm/dd/yyyy) and which don't match the app's fields.
 * Values in and out are ISO "YYYY-MM-DD" strings, or null when cleared.
 */
export function DateRangeField({
  value,
  onChange,
  max,
  label = "Date range",
  className,
}: {
  value: Range;
  onChange: (r: Range) => void;
  max?: string;
  label?: string;
  className?: string;
}) {
  const start = toDate(value.from);
  const end = toDate(value.to);
  const range = start && end ? { start, end } : null;

  return (
    <I18nProvider locale="en-GB">
      <DateRangePicker
        aria-label={label}
        className={className}
        value={range}
        maxValue={toDate(max) ?? undefined}
        onChange={(r: { start: CalendarDate; end: CalendarDate } | null) =>
          onChange(r ? { from: r.start.toString(), to: r.end.toString() } : { from: null, to: null })
        }
      >
        <DateInputGroup fullWidth>
          <DateInputGroup.Input slot="start">{(s) => <DateInputGroup.Segment segment={s} />}</DateInputGroup.Input>
          <DateRangePicker.RangeSeparator>–</DateRangePicker.RangeSeparator>
          <DateInputGroup.Input slot="end">{(s) => <DateInputGroup.Segment segment={s} />}</DateInputGroup.Input>
          <DateInputGroup.Suffix>
            <DateRangePicker.Trigger aria-label="Open calendar">
              <DateRangePicker.TriggerIndicator />
            </DateRangePicker.Trigger>
          </DateInputGroup.Suffix>
        </DateInputGroup>
        <DateRangePicker.Popover>
          <RangeCalendar aria-label={label}>
            <RangeCalendar.Header>
              <RangeCalendar.NavButton slot="previous" />
              <RangeCalendar.Heading />
              <RangeCalendar.NavButton slot="next" />
            </RangeCalendar.Header>
            <RangeCalendar.Grid>
              <RangeCalendar.GridHeader>{(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}</RangeCalendar.GridHeader>
              <RangeCalendar.GridBody>{(date) => <RangeCalendar.Cell date={date} />}</RangeCalendar.GridBody>
            </RangeCalendar.Grid>
          </RangeCalendar>
        </DateRangePicker.Popover>
      </DateRangePicker>
    </I18nProvider>
  );
}
