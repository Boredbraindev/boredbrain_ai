'use client';

import React from 'react';
import { format } from 'date-fns';
import { HugeiconsIcon } from '@hugeicons/react';
import { Calendar01Icon, AlarmClockIcon } from '@hugeicons/core-free-icons';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { ProgressRing } from '@/components/ui/progress-ring';
import { cn } from '@/lib/utils';
import { TimezoneSelector } from './timezone-selector';
import { TimePicker } from './time-picker';
import { frequencyOptions, dayOfWeekOptions, SIGNAL_LIMITS } from '../constants';
import { SignalFormHookReturn } from '../hooks/use-signal-form';

interface SignalFormProps {
  formHook: SignalFormHookReturn;
  isMutating: boolean;
  activeDailySignals: number;
  totalSignals: number;
  canCreateMore: boolean;
  canCreateDailyMore: boolean;
  createSignal: any;
  updateSignal: any;
}

export function SignalForm({
  formHook,
  isMutating,
  activeDailySignals,
  totalSignals,
  canCreateMore,
  canCreateDailyMore,
  createSignal,
  updateSignal,
}: SignalFormProps) {
  const {
    selectedFrequency,
    selectedTime,
    selectedTimezone,
    selectedDate,
    selectedDayOfWeek,
    selectedExample,
    editingSignal,
    setSelectedFrequency,
    setSelectedTime,
    setSelectedTimezone,
    setSelectedDate,
    setSelectedDayOfWeek,
    createSignalFromForm,
    updateSignalFromForm,
  } = formHook;

  const handleSubmit = (formData: FormData) => {
    if (editingSignal) {
      updateSignalFromForm(formData, updateSignal);
    } else {
      createSignalFromForm(formData, createSignal);
    }
  };

  const isSubmitDisabled =
    isMutating ||
    (!editingSignal && selectedFrequency === 'daily' && !canCreateDailyMore) ||
    (!editingSignal && !canCreateMore);

  return (
    <form action={handleSubmit} className="space-y-4">
      {/* Title */}
      <div>
        <Input
          name="title"
          placeholder="Enter signal name"
          className="h-9"
          defaultValue={editingSignal?.title || selectedExample?.title || ''}
          required
        />
      </div>

      {/* Instructions */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
        <Label className="text-sm font-medium sm:pt-2 sm:w-20 sm:flex-shrink-0">Instructions</Label>
        <div className="flex-1">
          <Textarea
            name="prompt"
            placeholder="Enter detailed instructions for what you want the signal to search for and analyze..."
            rows={6}
            className="resize-none text-sm h-40"
            defaultValue={editingSignal?.prompt || selectedExample?.prompt || ''}
            required
          />
        </div>
      </div>

      {/* Frequency Selection */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
        <Label className="text-sm font-medium sm:pt-2 sm:w-20 sm:flex-shrink-0">Frequency</Label>
        <div className="flex-1">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
            {frequencyOptions.map((option) => (
              <div key={option.value} className="relative">
                <input
                  type="radio"
                  id={`frequency-${option.value}`}
                  name="frequency"
                  value={option.value}
                  checked={selectedFrequency === option.value}
                  onChange={(e) => setSelectedFrequency(e.target.value)}
                  className="sr-only peer"
                />
                <label
                  htmlFor={`frequency-${option.value}`}
                  className="block text-center py-2 px-2 text-xs rounded-md border cursor-pointer peer-checked:bg-primary peer-checked:text-primary-foreground peer-checked:border-primary transition-colors hover:bg-accent hover:peer-checked:bg-primary/90"
                >
                  {option.label}
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scheduling Section */}
      <div className="space-y-4">
        {/* On/Time/Date row */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
          <Label className="text-sm font-medium sm:pt-2 sm:w-20 sm:flex-shrink-0">On</Label>
          <div className="flex-1">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Time Picker */}
              <div className="flex-1 min-w-0">
                <TimePicker
                  name="time"
                  value={selectedTime}
                  onChange={setSelectedTime}
                  selectedDate={selectedFrequency === 'once' ? selectedDate : undefined}
                  filterPastTimes={selectedFrequency === 'once'}
                />
              </div>

              {/* Date selection for 'once' frequency */}
              {selectedFrequency === 'once' && (
                <div className="flex-1 min-w-0">
                  <input type="hidden" name="date" value={selectedDate ? format(selectedDate, 'yyyy-MM-dd') : ''} />
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={cn('w-full text-left font-normal h-9', !selectedDate && 'text-muted-foreground')}
                      >
                        {selectedDate ? format(selectedDate, 'MMM d, yyyy') : <span>Pick date</span>}
                        <HugeiconsIcon
                          icon={Calendar01Icon}
                          size={12}
                          color="currentColor"
                          strokeWidth={1.5}
                          className="ml-auto opacity-50"
                        />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        autoFocus
                        className="rounded-md"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {/* Day selection for 'weekly' frequency */}
              {selectedFrequency === 'weekly' && (
                <div className="flex-1 min-w-0">
                  <input type="hidden" name="dayOfWeek" value={selectedDayOfWeek} />
                  <Select value={selectedDayOfWeek} onValueChange={setSelectedDayOfWeek}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select day" />
                    </SelectTrigger>
                    <SelectContent>
                      {dayOfWeekOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Timezone row */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <Label className="text-sm font-medium sm:w-20 sm:flex-shrink-0">Timezone</Label>
          <div className="flex-1">
            <TimezoneSelector value={selectedTimezone} onChange={setSelectedTimezone} />
          </div>
        </div>

        {/* Single hidden input for timezone form submission */}
        <input type="hidden" name="timezone" value={selectedTimezone} />
      </div>



      {/* Footer */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 border-t">
        <div className="flex items-center gap-3 justify-center sm:justify-start">

        </div>

        <Button type="submit" size="sm" disabled={isSubmitDisabled} className="w-full sm:w-auto">
          {editingSignal
            ? isMutating
              ? 'Updating...'
              : 'Update'
            : selectedFrequency === 'once'
              ? 'Create Task'
              : 'Create'}
        </Button>
      </div>
    </form>
  );
}
