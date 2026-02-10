"use client";

import { useState } from "react";
import { PhoneInput } from "./PhoneInput";

const LANGUAGES = [
  { value: "auto", label: "Auto-detect" },
  { value: "en", label: "English" },
  { value: "fr", label: "French" },
  { value: "es", label: "Spanish" },
  { value: "de", label: "German" },
  { value: "it", label: "Italian" },
  { value: "pt", label: "Portuguese" },
  { value: "ja", label: "Japanese" },
  { value: "zh", label: "Chinese" },
  { value: "ko", label: "Korean" },
  { value: "ar", label: "Arabic" },
  { value: "ru", label: "Russian" },
];

interface CallFormProps {
  credits: number;
  onSubmit: (data: {
    briefing: string;
    phoneNumber: string;
    language: string;
  }) => Promise<void>;
  isSubmitting: boolean;
}

export function CallForm({ credits, onSubmit, isSubmitting }: CallFormProps) {
  const [briefing, setBriefing] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneValid, setPhoneValid] = useState(false);
  const [language, setLanguage] = useState("auto");
  const [phoneError, setPhoneError] = useState("");

  const briefingValid = briefing.trim().length >= 10;
  const canSubmit = briefingValid && phoneValid && credits > 0 && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneValid) {
      setPhoneError("Please enter a valid phone number");
      return;
    }
    if (!briefingValid) return;
    await onSubmit({ briefing: briefing.trim(), phoneNumber, language });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label
          htmlFor="briefing"
          className="block text-sm font-medium mb-1.5"
        >
          What do you need done?
        </label>
        <textarea
          id="briefing"
          rows={4}
          value={briefing}
          onChange={(e) => setBriefing(e.target.value)}
          placeholder='e.g., Book a table for 2 at 8pm this Friday. Ask if they have a terrace. My name is Slava.'
          className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          maxLength={2000}
        />
        <p className="mt-1 text-xs text-muted">
          {briefing.length < 10
            ? `${10 - briefing.length} more characters needed`
            : `${briefing.length}/2000`}
        </p>
      </div>

      <PhoneInput
        value={phoneNumber}
        onChange={(e164, isValid) => {
          setPhoneNumber(e164);
          setPhoneValid(isValid);
          if (isValid) setPhoneError("");
        }}
        error={phoneError}
      />

      <div>
        <label
          htmlFor="language"
          className="block text-sm font-medium mb-1.5"
        >
          Language preference
        </label>
        <select
          id="language"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border bg-surface/50 px-4 py-3">
        <span className="text-sm text-muted">Cost</span>
        <span className="text-sm font-medium">1 credit</span>
      </div>

      {credits <= 0 && (
        <p className="text-sm text-danger text-center">
          You&apos;ve used all your free credits. More credits coming soon!
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-lg bg-primary px-4 py-3 font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSubmitting ? (
          <span className="inline-flex items-center gap-2">
            <svg
              className="animate-spin h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Starting call...
          </span>
        ) : (
          "Make the Call"
        )}
      </button>
    </form>
  );
}
