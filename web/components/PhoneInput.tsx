"use client";

import { useState, useEffect } from "react";
import {
  parsePhoneNumberFromString,
  getCountries,
  getCountryCallingCode,
  type CountryCode,
} from "libphonenumber-js";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const POPULAR_COUNTRIES: CountryCode[] = [
  "US", "GB", "FR", "DE", "ES", "IT", "JP", "CN", "KR", "BR", "MX", "CA", "AU", "IN", "RU",
];

function getDefaultCountry(): CountryCode {
  if (typeof navigator === "undefined") return "US";
  const lang = navigator.language || "";
  const region = lang.split("-")[1]?.toUpperCase();
  if (region && getCountries().includes(region as CountryCode)) {
    return region as CountryCode;
  }
  return "US";
}

interface PhoneInputProps {
  value: string;
  onChange: (e164: string, isValid: boolean) => void;
  error?: string;
}

export function PhoneInput({ value, onChange, error }: PhoneInputProps) {
  const [country, setCountry] = useState<CountryCode>(getDefaultCountry());
  const [inputValue, setInputValue] = useState(value);

  useEffect(() => {
    setCountry(getDefaultCountry());
  }, []);

  const handleChange = (raw: string) => {
    setInputValue(raw);
    const phone = parsePhoneNumberFromString(raw, country);
    if (phone && phone.isValid()) {
      onChange(phone.format("E.164"), true);
    } else {
      onChange(raw, false);
    }
  };

  const handleCountryChange = (newCountry: string) => {
    const cc = newCountry as CountryCode;
    setCountry(cc);
    const phone = parsePhoneNumberFromString(inputValue, cc);
    if (phone && phone.isValid()) {
      onChange(phone.format("E.164"), true);
    }
  };

  const allCountries = getCountries();
  const sortedCountries = [
    ...POPULAR_COUNTRIES,
    ...allCountries.filter((c) => !POPULAR_COUNTRIES.includes(c)).sort(),
  ];

  return (
    <div className="space-y-1.5">
      <Label>Phone number</Label>
      <div className="flex gap-2">
        <Select value={country} onValueChange={handleCountryChange}>
          <SelectTrigger className="w-28 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" className="max-h-60">
            {sortedCountries.map((c) => (
              <SelectItem key={c} value={c}>
                {c} +{getCountryCallingCode(c)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="tel"
          value={inputValue}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Phone number"
          aria-invalid={!!error}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
