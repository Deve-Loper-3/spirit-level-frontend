"use client";

import { useEffect, useRef } from "react";

type OtpInputProps = {
    length?: number;
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
    autoFocus?: boolean;
};

export default function OtpInput({
    length = 6,
    value,
    onChange,
    disabled = false,
    autoFocus = true,
}: OtpInputProps) {
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Split value into an array of characters padded to `length`
    const digits = Array.from({ length }, (_, i) => value[i] || "");

    useEffect(() => {
        if (autoFocus && inputRefs.current[0]) {
            inputRefs.current[0].focus();
        }
    }, [autoFocus]);

    function focusInput(index: number) {
        const target = Math.max(0, Math.min(index, length - 1));
        inputRefs.current[target]?.focus();
        inputRefs.current[target]?.select();
    }

    function handleInputChange(
        e: React.ChangeEvent<HTMLInputElement>,
        index: number,
    ) {
        const raw = e.target.value.replace(/\D/g, "");
        if (!raw) {
            // Cleared character
            const newDigits = [...digits];
            newDigits[index] = "";
            onChange(newDigits.join(""));
            return;
        }

        // Single digit typed
        if (raw.length === 1) {
            const newDigits = [...digits];
            newDigits[index] = raw;
            const nextValue = newDigits.join("");
            onChange(nextValue);

            // Jump to next box
            if (index < length - 1) {
                focusInput(index + 1);
            }
            return;
        }

        // Multiple characters entered (e.g. mobile auto-suggestion or paste via input)
        applyPastedString(raw, index);
    }

    function handleKeyDown(
        e: React.KeyboardEvent<HTMLInputElement>,
        index: number,
    ) {
        if (e.key === "Backspace") {
            if (!digits[index] && index > 0) {
                // Current box is already empty, jump to previous and clear it
                e.preventDefault();
                const newDigits = [...digits];
                newDigits[index - 1] = "";
                onChange(newDigits.join(""));
                focusInput(index - 1);
            } else if (digits[index]) {
                // Clear current box
                const newDigits = [...digits];
                newDigits[index] = "";
                onChange(newDigits.join(""));
            }
        } else if (e.key === "ArrowLeft" && index > 0) {
            e.preventDefault();
            focusInput(index - 1);
        } else if (e.key === "ArrowRight" && index < length - 1) {
            e.preventDefault();
            focusInput(index + 1);
        }
    }

    function applyPastedString(pasted: string, startIndex = 0) {
        const clean = pasted.replace(/\D/g, "");
        if (!clean) return;

        const newDigits = [...digits];
        let filledCount = 0;

        for (let i = 0; i < clean.length && startIndex + i < length; i++) {
            newDigits[startIndex + i] = clean[i];
            filledCount++;
        }

        onChange(newDigits.join(""));

        // Focus the slot after the last pasted digit, or the last box
        const nextIndex = Math.min(startIndex + filledCount, length - 1);
        focusInput(nextIndex);
    }

    function handlePaste(e: React.ClipboardEvent<HTMLInputElement>, index: number) {
        e.preventDefault();
        const clipboard = e.clipboardData.getData("text");
        // Always paste starting from index 0 if full code is pasted, or from current index
        const start = clipboard.replace(/\D/g, "").length >= length ? 0 : index;
        applyPastedString(clipboard, start);
    }

    return (
        <div
            className="flex items-center justify-between gap-2 sm:gap-3"
            role="group"
            aria-label="Verification code input"
        >
            {digits.map((digit, index) => (
                <input
                    key={index}
                    ref={(el) => {
                        inputRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    disabled={disabled}
                    onChange={(e) => handleInputChange(e, index)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    onPaste={(e) => handlePaste(e, index)}
                    onFocus={(e) => e.target.select()}
                    aria-label={`Digit ${index + 1} of ${length}`}
                    className="h-[54px] w-[46px] rounded-[6px] border border-input-border bg-input text-center text-[22px] font-bold text-card-foreground outline-none transition-all focus:border-focus focus:ring-[1px] focus:ring-focus focus:outline-hidden disabled:cursor-not-allowed disabled:opacity-50 sm:w-[52px]"
                />
            ))}
        </div>
    );
}
