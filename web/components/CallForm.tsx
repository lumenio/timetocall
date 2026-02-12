"use client";

import { useState } from "react";
import { Loader2, Copy, Check } from "lucide-react";
import { PhoneInput } from "./PhoneInput";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LANGUAGES = [
  { value: "auto", label: "Auto-detect" },
  { value: "af", label: "Afrikaans" },
  { value: "sq", label: "Albanian" },
  { value: "am", label: "Amharic" },
  { value: "ar", label: "Arabic" },
  { value: "hy", label: "Armenian" },
  { value: "as", label: "Assamese" },
  { value: "az", label: "Azerbaijani" },
  { value: "eu", label: "Basque" },
  { value: "be", label: "Belarusian" },
  { value: "bn", label: "Bengali" },
  { value: "bs", label: "Bosnian" },
  { value: "bg", label: "Bulgarian" },
  { value: "ca", label: "Catalan" },
  { value: "zh", label: "Chinese" },
  { value: "hr", label: "Croatian" },
  { value: "cs", label: "Czech" },
  { value: "da", label: "Danish" },
  { value: "nl", label: "Dutch" },
  { value: "en", label: "English" },
  { value: "et", label: "Estonian" },
  { value: "fil", label: "Filipino" },
  { value: "fi", label: "Finnish" },
  { value: "fr", label: "French" },
  { value: "gl", label: "Galician" },
  { value: "ka", label: "Georgian" },
  { value: "de", label: "German" },
  { value: "el", label: "Greek" },
  { value: "gu", label: "Gujarati" },
  { value: "he", label: "Hebrew" },
  { value: "hi", label: "Hindi" },
  { value: "hu", label: "Hungarian" },
  { value: "is", label: "Icelandic" },
  { value: "id", label: "Indonesian" },
  { value: "it", label: "Italian" },
  { value: "ja", label: "Japanese" },
  { value: "kn", label: "Kannada" },
  { value: "kk", label: "Kazakh" },
  { value: "km", label: "Khmer" },
  { value: "ko", label: "Korean" },
  { value: "lo", label: "Lao" },
  { value: "lv", label: "Latvian" },
  { value: "lt", label: "Lithuanian" },
  { value: "mk", label: "Macedonian" },
  { value: "ms", label: "Malay" },
  { value: "ml", label: "Malayalam" },
  { value: "mr", label: "Marathi" },
  { value: "mn", label: "Mongolian" },
  { value: "ne", label: "Nepali" },
  { value: "no", label: "Norwegian" },
  { value: "or", label: "Odia" },
  { value: "pl", label: "Polish" },
  { value: "pt", label: "Portuguese" },
  { value: "pa", label: "Punjabi" },
  { value: "ro", label: "Romanian" },
  { value: "ru", label: "Russian" },
  { value: "sr", label: "Serbian" },
  { value: "sk", label: "Slovak" },
  { value: "sl", label: "Slovenian" },
  { value: "es", label: "Spanish" },
  { value: "sw", label: "Swahili" },
  { value: "sv", label: "Swedish" },
  { value: "ta", label: "Tamil" },
  { value: "te", label: "Telugu" },
  { value: "th", label: "Thai" },
  { value: "tr", label: "Turkish" },
  { value: "uk", label: "Ukrainian" },
  { value: "ur", label: "Urdu" },
  { value: "uz", label: "Uzbek" },
  { value: "vi", label: "Vietnamese" },
  { value: "zu", label: "Zulu" },
];

interface CallFormProps {
  credits: number;
  referralCode: string | null;
  onSubmit: (data: {
    briefing: string;
    phoneNumber: string;
    language: string;
  }) => Promise<void>;
  isSubmitting: boolean;
}

export function CallForm({ credits, referralCode, onSubmit, isSubmitting }: CallFormProps) {
  const [briefing, setBriefing] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneValid, setPhoneValid] = useState(false);
  const [language, setLanguage] = useState("auto");
  const [phoneError, setPhoneError] = useState("");
  const [copied, setCopied] = useState(false);

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
      <div className="space-y-1.5">
        <Label htmlFor="briefing">What do you need done?</Label>
        <Textarea
          id="briefing"
          rows={4}
          value={briefing}
          onChange={(e) => setBriefing(e.target.value)}
          placeholder='e.g., Book a table for 2 at 8pm this Friday. Ask if they have a terrace. My name is Slava.'
          className="resize-none"
          maxLength={2000}
        />
        <p className="text-xs text-muted-foreground">
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

      <div className="space-y-1.5">
        <Label htmlFor="language">Language preference</Label>
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((lang) => (
              <SelectItem key={lang.value} value={lang.value}>
                {lang.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between rounded-lg border bg-card/50 px-4 py-3">
        <span className="text-sm text-muted-foreground">Cost</span>
        <span className="text-sm font-medium">1 credit</span>
      </div>

      {credits <= 0 && referralCode && (
        <div className="rounded-lg border bg-card/50 px-4 py-3 text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            No credits. Invite friends to earn free calls!
          </p>
          <div className="flex items-center gap-2 justify-center">
            <code className="text-xs bg-muted px-2 py-1 rounded">
              {typeof window !== "undefined" ? window.location.origin : ""}/?ref={referralCode}
            </code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/?ref=${referralCode}`);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </button>
          </div>
        </div>
      )}

      <Button type="submit" disabled={!canSubmit} className="w-full" size="lg">
        {isSubmitting ? (
          <>
            <Loader2 className="animate-spin" />
            Starting call...
          </>
        ) : (
          "Make the Call"
        )}
      </Button>
    </form>
  );
}
