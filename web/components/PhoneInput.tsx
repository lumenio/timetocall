"use client";

import { useState, useEffect } from "react";
import {
  parsePhoneNumberFromString,
  getCountries,
  getCountryCallingCode,
  type CountryCode,
} from "libphonenumber-js";

const POPULAR_COUNTRIES: CountryCode[] = [
  "US",
  "GB",
  "FR",
  "DE",
  "ES",
  "IT",
  "JP",
  "CN",
  "KR",
  "BR",
  "MX",
  "CA",
  "AU",
  "IN",
  "RU",
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

  const handleCountryChange = (newCountry: CountryCode) => {
    setCountry(newCountry);
    // Re-validate with new country
    const phone = parsePhoneNumberFromString(inputValue, newCountry);
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
    <div>
      <label className="block text-sm font-medium mb-1.5">Phone number</label>
      <div className="flex gap-2">
        <select
          value={country}
          onChange={(e) =>
            handleCountryChange(e.target.value as CountryCode)
          }
          className="w-28 shrink-0 rounded-lg border border-border bg-surface px-2 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {sortedCountries.map((c) => (
            <option key={c} value={c}>
              {c} +{getCountryCallingCode(c)}
            </option>
          ))}
        </select>
        <input
          type="tel"
          value={inputValue}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Phone number"
          className={`flex-1 rounded-lg border px-4 py-2.5 bg-surface text-foreground placeholder:text-muted focus:outline-none focus:ring-1 ${
            error
              ? "border-danger focus:border-danger focus:ring-danger"
              : "border-border focus:border-primary focus:ring-primary"
          }`}
        />
      </div>
      {error && <p className="mt-1.5 text-sm text-danger">{error}</p>}
    </div>
  );
}
